import { describe, expect, it } from 'vitest';
import { execArena, newArena, nextHint, servedRatio, tick, type ArenaState, type FaultId } from '../src';

function forced(id: FaultId): ArenaState {
  const s = newArena(1, 42);
  s.schedule = [{ at: 2, id }];
  return s;
}
const run = (s: ArenaState, n: number) => {
  for (let i = 0; i < n; i++) s = tick(s);
  return s;
};
const sh = (s: ArenaState, cmd: string) => {
  const r = execArena(s, cmd);
  return { s: r.state, out: r.output };
};
const webPod = (s: ArenaState) => s.pods.find((p) => p.deployment === 'web' && !p.ready)?.name ?? s.pods.find((p) => p.deployment === 'web')!.name;

const CASES: { id: FaultId; symptom: (s: ArenaState) => string; fixes: string[] }[] = [
  { id: 'bad-image', symptom: (s) => sh(s, 'kubectl get pods').out, fixes: ['kubectl rollout undo deployment/web'] },
  { id: 'missing-configmap', symptom: (s) => sh(s, `kubectl describe pod ${webPod(s)}`).out, fixes: ['kubectl create configmap web-config --from-literal=MODE=prod'] },
  { id: 'selector-typo', symptom: (s) => sh(s, 'kubectl get endpoints web').out, fixes: ['kubectl set selector service web app=web'] },
  { id: 'scaled-to-zero', symptom: (s) => sh(s, 'kubectl get deploy web').out, fixes: ['kubectl scale deployment web --replicas=3'] },
  { id: 'oom', symptom: (s) => sh(s, `kubectl describe pod ${webPod(s)}`).out, fixes: ['kubectl set resources deployment web --limits=memory=256Mi'] },
  { id: 'cordoned-nodes', symptom: (s) => sh(s, 'kubectl get nodes').out, fixes: ['kubectl uncordon node-2', 'kubectl uncordon node-3'] },
  { id: 'bad-taint', symptom: (s) => sh(s, 'kubectl describe node node-1').out, fixes: ['kubectl taint nodes --all maintenance-'] },
  { id: 'bad-env', symptom: (s) => sh(s, `kubectl logs ${webPod(s)} --previous`).out, fixes: ['kubectl set env deployment/web APP_MODE=prod'] },
];
const EXPECT: Record<FaultId, RegExp> = {
  'bad-image': /ImagePullBackOff|ErrImagePull/,
  'missing-configmap': /configmap "web-config" not found/,
  'selector-typo': /web\s+<none>/,
  'scaled-to-zero': /0\/0/,
  oom: /OOMKilled/,
  'cordoned-nodes': /SchedulingDisabled/,
  'bad-taint': /maintenance=true:NoExecute/,
  'bad-env': /FATAL unknown APP_MODE "debgu"/,
};

describe('break-fix arena', () => {
  it('starts healthy and serves all traffic', () => {
    const s = run(newArena(1, 7), 1);
    expect(servedRatio(s)).toBe(1);
    expect(s.pods.filter((p) => p.ready)).toHaveLength(5);
  });

  it.each(CASES.map((c) => [c.id, c] as const))('%s: symptom is discoverable and the taught fix wins the round', (_, c) => {
    let s = run(forced(c.id), 12);
    expect(s.faults.map((f) => f.id)).toEqual([c.id]);
    expect(s.faults[0].resolvedAt).toBeUndefined();
    expect(c.symptom(s)).toMatch(EXPECT[c.id]);
    // the hints walk towards the fix
    const h3 = nextHint(nextHint(nextHint(s).state).state).hint!;
    expect(h3).toMatch(/kubectl/);
    for (const f of c.fixes) {
      const r = execArena(s, f);
      expect(r.ok, `${f}: ${r.output}`).toBe(true);
      s = r.state;
    }
    for (let i = 0; i < 40 && s.outcome === 'running'; i++) s = tick(s);
    expect(s.outcome).toBe('won');
    expect(s.faults[0].resolvedAt).toBeDefined();
  });

  it('a broken rollout keeps old Pods serving (maxUnavailable 0)', () => {
    const s = run(forced('bad-image'), 12);
    expect(servedRatio(s)).toBeGreaterThan(0);
    expect(s.pods.filter((p) => p.deployment === 'web' && p.ready).length).toBe(3);
  });

  it('ignoring an outage loses the round when the error budget runs out', () => {
    let s = forced('selector-typo');
    for (let i = 0; i < 400 && s.outcome === 'running'; i++) s = tick(s);
    expect(s.outcome).toBe('lost');
  });

  it('wrong fixes do not count and invalid commands are explained', () => {
    let s = run(forced('selector-typo'), 8);
    s = execArena(s, 'kubectl delete pod ' + s.pods[0].name).state;
    s = run(s, 10);
    expect(s.faults[0].resolvedAt).toBeUndefined();
    expect(execArena(s, 'kubectl delete deployment web').output).toMatch(/only lets you delete pods/);
    expect(execArena(s, 'rm -rf /').ok).toBe(false);
  });

  it('levels inject distinct, non-masking faults', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const s = newArena(3, seed);
      const ids = s.schedule.map((x) => x.id);
      expect(new Set(ids).size).toBe(3);
      expect(ids.includes('cordoned-nodes') && ids.includes('bad-taint')).toBe(false);
    }
  });
});
