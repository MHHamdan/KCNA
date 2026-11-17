// Break-Fix Arena: a small, deterministic Kubernetes cluster simulator.
// A reconcile loop (one tick per second in the UI) models Deployments with
// surge-based rolling updates, scheduling against node capacity, cordons and
// taints, kubelet retries, CrashLoopBackOff, OOMKills, Services/endpoints and an
// error budget. "Chaos" injects realistic faults; the learner restores service
// with real kubectl commands. Pedagogy over fidelity: behaviour mirrors real
// Kubernetes semantics, but timings are compressed.
import { parseKubectl, type ParsedCommand } from './kubectl';

export type FaultId = 'bad-image' | 'missing-configmap' | 'selector-typo' | 'scaled-to-zero' | 'oom' | 'cordoned-nodes' | 'bad-taint' | 'bad-env';

interface Template {
  image: string;
  configRef?: string;
  env: Record<string, string>;
  memLimitMi: number;
  restartNonce: number;
}

interface SimDeployment {
  name: string;
  replicas: number;
  labels: Record<string, string>;
  containerPort: number;
  memRequestMi: number;
  /** memory the application really needs */
  memUsageMi: number;
  template: Template;
  history: Template[];
}

interface SimPod {
  name: string;
  deployment: string;
  hash: string;
  spec: Template;
  node?: string;
  created: number;
  restarts: number;
  /** tick at which the container last (re)started */
  startedAt: number;
  lastState?: 'OOMKilled' | 'Error';
  status: string;
  ready: boolean;
}

interface SimNode {
  name: string;
  cordoned: boolean;
  taints: { key: string; value: string; effect: 'NoSchedule' | 'NoExecute' }[];
  memMi: number;
}

interface SimService {
  name: string;
  selector: Record<string, string>;
  port: number;
  targetPort: number;
}

export interface SimEvent {
  tick: number;
  type: 'Normal' | 'Warning';
  reason: string;
  object: string;
  message: string;
}

export interface ActiveFault {
  id: FaultId;
  at: number;
  resolvedAt?: number;
  hintsUsed: number;
}

export interface ArenaState {
  tick: number;
  seed: number;
  level: 1 | 2 | 3;
  nodes: SimNode[];
  deployments: SimDeployment[];
  services: SimService[];
  configmaps: Record<string, Record<string, string>>;
  pods: SimPod[];
  events: SimEvent[];
  /** planned fault injections */
  schedule: { at: number; id: FaultId }[];
  faults: ActiveFault[];
  /** error budget, 100 → 0 */
  budget: number;
  /** recent success ratios for the sparkline */
  served: number[];
  commands: number;
  healthyStreak: number;
  outcome: 'running' | 'won' | 'lost';
}

export const VALID_IMAGES = new Set(['nginx:1.27', 'nginx:1.27-alpine', 'nginx:1.26', 'registry.example/api:2.4.1', 'registry.example/api:2.4.0']);
const VALID_MODES = new Set(['prod', 'staging']);
const NODE_MEM = 1024;

export const FAULTS: Record<FaultId, { title: string; hints: string[] }> = {
  'bad-image': {
    title: 'A broken release was pushed',
    hints: ['Look at the Pod STATUS column for web — is the image being pulled?', '`kubectl describe pod <web-pod>` shows the pull error and the exact image.', 'Roll back with `kubectl rollout undo deployment/web` (or set a valid image).'],
  },
  'missing-configmap': {
    title: 'Configuration disappeared',
    hints: ['New web Pods cannot start their container. Which status do they show?', '`kubectl describe pod <web-pod>` names a missing ConfigMap.', 'Recreate it: `kubectl create configmap web-config --from-literal=MODE=prod` — the kubelet retries on its own.'],
  },
  'selector-typo': {
    title: 'Traffic stopped reaching the app',
    hints: ['Pods look healthy, but users get errors. Does the Service have endpoints?', '`kubectl describe svc web` — compare the selector with the Pod labels (`kubectl get pods --show-labels`).', 'Fix it: `kubectl set selector service web app=web`.'],
  },
  'scaled-to-zero': {
    title: 'Capacity vanished',
    hints: ['How many web Pods are running? Check `kubectl get deploy web`.', 'Someone scaled the Deployment down.', '`kubectl scale deployment web --replicas=3`.'],
  },
  oom: {
    title: 'Pods keep dying under load',
    hints: ['web Pods restart repeatedly. What does `kubectl describe pod` say about the Last State?', 'Exit code 137 / OOMKilled means the memory limit is below what the app needs (`kubectl top pods`).', '`kubectl set resources deployment web --limits=memory=256Mi`.'],
  },
  'cordoned-nodes': {
    title: 'Maintenance was left unfinished',
    hints: ['Some Pods are Pending. Why can\'t they be scheduled? Check `kubectl get events`.', '`kubectl get nodes` — look for SchedulingDisabled.', '`kubectl uncordon node-2` and `kubectl uncordon node-3`.'],
  },
  'bad-taint': {
    title: 'Pods were evicted cluster-wide',
    hints: ['Pods are Pending everywhere. What do the FailedScheduling events say?', '`kubectl describe node node-1` — look at Taints.', 'Remove it from every node: `kubectl taint nodes --all maintenance-`.'],
  },
  'bad-env': {
    title: 'A config change made the app crash',
    hints: ['web Pods are in CrashLoopBackOff. What did the last run print?', '`kubectl logs <web-pod> --previous` shows the fatal error.', 'Fix the variable: `kubectl set env deployment/web APP_MODE=prod` (or roll back).'],
  },
};

// ---------------- helpers ----------------

function rnd(state: ArenaState) {
  // xorshift on the stored seed: deterministic per game
  let x = state.seed || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.seed = x >>> 0;
  return state.seed / 4294967296;
}

const suffix = (s: ArenaState, n = 5) =>
  Array.from({ length: n }, () => 'bcdfghjklmnpqrstvwxz2456789'[Math.floor(rnd(s) * 27)]).join('');

function hashOf(t: Template) {
  const str = JSON.stringify(t);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36).slice(0, 8).padEnd(8, 'x').slice(0, 10).replace(/[^a-z0-9]/g, 'x');
}

const age = (s: ArenaState, from: number) => {
  const sec = Math.max(0, s.tick - from) * 4 + 3; // a tick ≈ 4 s of cluster time
  return sec < 120 ? `${sec}s` : `${Math.floor(sec / 60)}m${sec % 60 ? `${sec % 60}s` : ''}`;
};

function event(s: ArenaState, type: SimEvent['type'], reason: string, object: string, message: string) {
  const last = s.events[s.events.length - 1];
  if (last && last.reason === reason && last.object === object && last.message === message) {
    last.tick = s.tick;
    return;
  }
  s.events.push({ tick: s.tick, type, reason, object, message });
  if (s.events.length > 80) s.events.shift();
}

const matches = (sel: Record<string, string>, labels: Record<string, string>) => Object.entries(sel).every(([k, v]) => labels[k] === v);

function podFits(s: ArenaState, pod: SimPod, node: SimNode, d: SimDeployment) {
  if (node.cordoned) return 'unschedulable';
  if (node.taints.length) return 'taint';
  const used = s.pods.filter((p) => p.node === node.name).reduce((m, p) => m + (s.deployments.find((x) => x.name === p.deployment)?.memRequestMi ?? 0), 0);
  if (used + d.memRequestMi > node.memMi) return 'memory';
  void pod;
  return 'ok';
}

// ---------------- setup ----------------

export function newArena(level: 1 | 2 | 3, seed = Date.now()): ArenaState {
  const webT: Template = { image: 'nginx:1.27', configRef: 'web-config', env: { APP_MODE: 'prod' }, memLimitMi: 256, restartNonce: 0 };
  const apiT: Template = { image: 'registry.example/api:2.4.1', env: { APP_MODE: 'prod' }, memLimitMi: 256, restartNonce: 0 };
  const s: ArenaState = {
    tick: 0,
    seed: (seed >>> 0) || 1,
    level,
    nodes: ['node-1', 'node-2', 'node-3'].map((name) => ({ name, cordoned: false, taints: [], memMi: NODE_MEM })),
    deployments: [
      { name: 'web', replicas: 3, labels: { app: 'web' }, containerPort: 80, memRequestMi: 256, memUsageMi: 180, template: webT, history: [{ ...webT, image: 'nginx:1.26' }] },
      { name: 'api', replicas: 2, labels: { app: 'api' }, containerPort: 8080, memRequestMi: 256, memUsageMi: 150, template: apiT, history: [] },
    ],
    services: [
      { name: 'web', selector: { app: 'web' }, port: 80, targetPort: 80 },
      { name: 'api', selector: { app: 'api' }, port: 8080, targetPort: 8080 },
    ],
    configmaps: { 'web-config': { MODE: 'prod' } },
    pods: [],
    events: [],
    schedule: [],
    faults: [],
    budget: 100,
    served: [],
    commands: 0,
    healthyStreak: 0,
    outcome: 'running',
  };
  // pre-warm: everything running
  for (let i = 0; i < 6; i++) reconcile(s);
  for (const p of s.pods) {
    p.created = -40;
    p.startedAt = -40;
  }
  s.events = [];
  const pool: FaultId[] = ['bad-image', 'missing-configmap', 'selector-typo', 'scaled-to-zero', 'oom', 'cordoned-nodes', 'bad-taint', 'bad-env'];
  const picks: FaultId[] = [];
  // exclusive groups: faults that would mask each other
  const clash: Partial<Record<FaultId, FaultId[]>> = { 'bad-image': ['bad-env', 'oom', 'missing-configmap'], 'bad-env': ['bad-image', 'oom'], oom: ['bad-image', 'bad-env'], 'missing-configmap': ['bad-image'], 'cordoned-nodes': ['bad-taint'], 'bad-taint': ['cordoned-nodes'], 'scaled-to-zero': [] };
  while (picks.length < level) {
    const f = pool[Math.floor(rnd(s) * pool.length)];
    if (picks.includes(f) || picks.some((p) => clash[p]?.includes(f) || clash[f]?.includes(p))) continue;
    picks.push(f);
  }
  picks.forEach((id, i) => s.schedule.push({ at: 4 + i * 25, id }));
  return s;
}

// ---------------- fault injection ----------------

function web(s: ArenaState) {
  return s.deployments.find((d) => d.name === 'web')!;
}

function rollout(s: ArenaState, d: SimDeployment, t: Template, cause: string) {
  d.history.push(d.template);
  if (d.history.length > 10) d.history.shift();
  d.template = t;
  event(s, 'Normal', 'ScalingReplicaSet', `deployment/${d.name}`, `${cause}: new ReplicaSet ${d.name}-${hashOf(t).slice(0, 8)} scaled up`);
}

function inject(s: ArenaState, id: FaultId) {
  const w = web(s);
  s.faults.push({ id, at: s.tick, hintsUsed: 0 });
  switch (id) {
    case 'bad-image':
      rollout(s, w, { ...w.template, image: 'nginx:1.27-alpne' }, 'CI deployed nginx:1.27-alpne');
      break;
    case 'missing-configmap':
      delete s.configmaps['web-config'];
      rollout(s, w, { ...w.template, restartNonce: w.template.restartNonce + 1 }, 'kubectl rollout restart');
      break;
    case 'selector-typo':
      s.services.find((x) => x.name === 'web')!.selector = { app: 'wbe' };
      break;
    case 'scaled-to-zero':
      w.replicas = 0;
      event(s, 'Normal', 'ScalingReplicaSet', 'deployment/web', 'Scaled down replica set to 0');
      break;
    case 'oom':
      w.memUsageMi = 180;
      rollout(s, w, { ...w.template, memLimitMi: 64 }, 'cost-saving PR lowered limits.memory to 64Mi');
      break;
    case 'cordoned-nodes':
      for (const n of s.nodes.filter((x) => x.name !== 'node-1')) {
        n.cordoned = true;
        for (const p of s.pods.filter((x) => x.node === n.name)) {
          event(s, 'Normal', 'Evicted', `pod/${p.name}`, `Evicted by drain of ${n.name}`);
        }
        s.pods = s.pods.filter((x) => x.node !== n.name);
      }
      break;
    case 'bad-taint':
      for (const n of s.nodes) n.taints.push({ key: 'maintenance', value: 'true', effect: 'NoExecute' });
      break;
    case 'bad-env':
      rollout(s, w, { ...w.template, env: { ...w.template.env, APP_MODE: 'debgu' } }, 'config change APP_MODE=debgu');
      break;
  }
}

// ---------------- reconcile loop ----------------

function podProblem(s: ArenaState, p: SimPod, d: SimDeployment): 'image' | 'config' | 'env' | 'oom' | null {
  if (!VALID_IMAGES.has(p.spec.image)) return 'image';
  if (p.spec.configRef && !s.configmaps[p.spec.configRef]) return 'config';
  if (p.spec.env.APP_MODE && !VALID_MODES.has(p.spec.env.APP_MODE)) return 'env';
  if (p.spec.memLimitMi < d.memUsageMi) return 'oom';
  return null;
}

function updatePod(s: ArenaState, p: SimPod, d: SimDeployment) {
  if (!p.node) {
    p.status = 'Pending';
    p.ready = false;
    return;
  }
  const problem = podProblem(s, p, d);
  const run = s.tick - p.startedAt;
  if (problem === 'image') {
    p.status = run < 2 ? 'ErrImagePull' : 'ImagePullBackOff';
    p.ready = false;
    event(s, 'Warning', 'Failed', `pod/${p.name}`, `Failed to pull image "${p.spec.image}": not found`);
    return;
  }
  if (problem === 'config') {
    p.status = 'CreateContainerConfigError';
    p.ready = false;
    event(s, 'Warning', 'Failed', `pod/${p.name}`, `Error: configmap "${p.spec.configRef}" not found`);
    return;
  }
  if (problem === 'env' || problem === 'oom') {
    // crash, then exponential back-off between restarts
    const backoff = Math.min(8, 2 ** Math.min(p.restarts, 3));
    if (run >= backoff + 1) {
      p.restarts += 1;
      p.startedAt = s.tick;
      p.lastState = problem === 'oom' ? 'OOMKilled' : 'Error';
      event(s, 'Warning', 'BackOff', `pod/${p.name}`, 'Back-off restarting failed container');
    }
    p.status = p.restarts === 0 ? 'Running' : run === 0 ? (problem === 'oom' ? 'OOMKilled' : 'Error') : 'CrashLoopBackOff';
    p.ready = false;
    return;
  }
  // healthy container: create → running → ready
  if (s.tick - p.created < 1 && p.restarts === 0) {
    p.status = 'ContainerCreating';
    p.ready = false;
  } else {
    p.status = 'Running';
    p.ready = s.tick - p.startedAt >= 2 || s.tick - p.created >= 2;
  }
}

function schedule(s: ArenaState, p: SimPod, d: SimDeployment) {
  const reasons = s.nodes.map((n) => podFits(s, p, n, d));
  const idx = s.nodes
    .map((n, i) => ({ n, i, used: s.pods.filter((x) => x.node === n.name).length }))
    .filter(({ i }) => reasons[i] === 'ok')
    .sort((a, b) => a.used - b.used)[0];
  if (idx) {
    p.node = idx.n.name;
    p.created = s.tick;
    p.startedAt = s.tick;
    event(s, 'Normal', 'Scheduled', `pod/${p.name}`, `Successfully assigned default/${p.name} to ${idx.n.name}`);
    return;
  }
  const parts: string[] = [];
  const count = (r: string) => reasons.filter((x) => x === r).length;
  if (count('memory')) parts.push(`${count('memory')} Insufficient memory`);
  if (count('taint')) parts.push(`${count('taint')} node(s) had untolerated taint {maintenance: true}`);
  if (count('unschedulable')) parts.push(`${count('unschedulable')} node(s) were unschedulable`);
  event(s, 'Warning', 'FailedScheduling', `pod/${p.name}`, `0/${s.nodes.length} nodes are available: ${parts.join(', ')}.`);
}

export function reconcile(s: ArenaState) {
  // NoExecute taints evict everything (no tolerations in this cluster)
  for (const n of s.nodes)
    if (n.taints.some((t) => t.effect === 'NoExecute'))
      for (const p of s.pods.filter((x) => x.node === n.name)) {
        event(s, 'Warning', 'TaintManagerEviction', `pod/${p.name}`, `Marking for deletion: node ${n.name} has NoExecute taint maintenance=true`);
        s.pods = s.pods.filter((x) => x !== p);
      }

  for (const d of s.deployments) {
    const h = hashOf(d.template);
    const mine = s.pods.filter((p) => p.deployment === d.name);
    const current = mine.filter((p) => p.hash === h);
    const old = mine.filter((p) => p.hash !== h);
    // scale down surplus current pods
    if (current.length > d.replicas) {
      const extra = current.slice(d.replicas);
      s.pods = s.pods.filter((p) => !extra.includes(p));
    }
    // surge: create one new pod while total < replicas + 1 (maxSurge 1)
    const total = Math.min(current.length, d.replicas) + old.length;
    if (current.length < d.replicas && (total < d.replicas + 1 || old.length === 0)) {
      const p: SimPod = { name: `${d.name}-${h.slice(0, 8)}-${suffix(s)}`, deployment: d.name, hash: h, spec: structuredClone(d.template), created: s.tick, restarts: 0, startedAt: s.tick, status: 'Pending', ready: false };
      s.pods.push(p);
    }
    // retire old pods only when a new one is ready, or when they are broken anyway (maxUnavailable 0)
    const readyCurrent = current.filter((p) => p.ready).length;
    const oldSorted = [...old].sort((a, b) => Number(a.ready) - Number(b.ready));
    if (oldSorted.length && (readyCurrent + old.filter((p) => p.ready).length > d.replicas || !oldSorted[0].ready || d.replicas === 0)) {
      s.pods = s.pods.filter((p) => p !== oldSorted[0]);
    }
    if (d.replicas === 0) s.pods = s.pods.filter((p) => p.deployment !== d.name);
  }
  for (const p of s.pods) {
    const d = s.deployments.find((x) => x.name === p.deployment)!;
    if (!p.node) schedule(s, p, d);
    updatePod(s, p, d);
  }
}

// ---------------- health, scoring, tick ----------------

export function endpoints(s: ArenaState, svc: SimService) {
  return s.pods.filter((p) => p.ready && matches(svc.selector, s.deployments.find((d) => d.name === p.deployment)!.labels));
}

/** Share of user requests to the web Service that succeed this tick. */
export function servedRatio(s: ArenaState) {
  const svc = s.services.find((x) => x.name === 'web')!;
  const n = endpoints(s, svc).length;
  return n === 0 ? 0 : Math.min(1, 0.4 + 0.2 * n);
}

function faultResolved(s: ArenaState, id: FaultId): boolean {
  const w = web(s);
  const webPods = s.pods.filter((p) => p.deployment === 'web');
  const allReady = webPods.length >= w.replicas && webPods.filter((p) => p.ready && p.hash === hashOf(w.template)).length >= w.replicas;
  switch (id) {
    case 'bad-image':
      return VALID_IMAGES.has(w.template.image) && allReady;
    case 'missing-configmap':
      return !!s.configmaps['web-config']?.MODE && allReady;
    case 'selector-typo':
      return matches(s.services.find((x) => x.name === 'web')!.selector, w.labels) && Object.keys(s.services.find((x) => x.name === 'web')!.selector).length > 0;
    case 'scaled-to-zero':
      return w.replicas >= 3 && allReady;
    case 'oom':
      return w.template.memLimitMi >= w.memUsageMi && allReady;
    case 'cordoned-nodes':
      return s.nodes.filter((n) => n.cordoned).length === 0 && s.pods.every((p) => p.node);
    case 'bad-taint':
      return s.nodes.every((n) => !n.taints.length) && s.pods.every((p) => p.node);
    case 'bad-env':
      return VALID_MODES.has(w.template.env.APP_MODE ?? 'prod') && allReady;
  }
}

export function tick(prev: ArenaState): ArenaState {
  if (prev.outcome !== 'running') return prev;
  const s = structuredClone(prev);
  s.tick += 1;
  for (const f of s.schedule.filter((x) => x.at === s.tick)) inject(s, f.id);
  reconcile(s);
  const ratio = servedRatio(s);
  s.served.push(ratio);
  if (s.served.length > 60) s.served.shift();
  // budget drains with unserved traffic, faster at higher levels
  s.budget = Math.max(0, s.budget - (1 - ratio) * (1.2 + s.level * 0.4));
  for (const f of s.faults) if (!f.resolvedAt && faultResolved(s, f.id)) f.resolvedAt = s.tick;
  const allInjected = s.schedule.every((x) => x.at <= s.tick);
  const healthy = s.faults.every((f) => f.resolvedAt) && ratio === 1;
  s.healthyStreak = healthy ? s.healthyStreak + 1 : 0;
  if (s.budget <= 0) s.outcome = 'lost';
  else if (allInjected && s.healthyStreak >= 4) s.outcome = 'won';
  return s;
}

export function arenaScore(s: ArenaState) {
  const hints = s.faults.reduce((n, f) => n + f.hintsUsed, 0);
  const mttr = s.faults.filter((f) => f.resolvedAt).reduce((n, f) => n + (f.resolvedAt! - f.at), 0) / Math.max(1, s.faults.length);
  return Math.max(0, Math.round(s.budget * 10 * s.level - hints * 60 - mttr * 2));
}

export function nextHint(s: ArenaState): { state: ArenaState; hint: string | null } {
  const n = structuredClone(s);
  const f = n.faults.find((x) => !x.resolvedAt);
  if (!f) return { state: n, hint: s.faults.length ? 'All injected faults are fixed — keep service healthy for a few seconds.' : 'All quiet. Chaos has not struck yet… explore the cluster with kubectl get.' };
  const hints = FAULTS[f.id].hints;
  const h = hints[Math.min(f.hintsUsed, hints.length - 1)];
  f.hintsUsed = Math.min(f.hintsUsed + 1, hints.length);
  return { state: n, hint: h };
}

// ---------------- kubectl ----------------

const pad = (rows: string[][]) => {
  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => (r[i] ?? '').length)));
  return rows.map((r) => r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(w[i] + 3))).join('')).join('\n');
};

function findPod(s: ArenaState, name?: string) {
  if (!name) return undefined;
  return s.pods.find((p) => p.name === name) ?? s.pods.find((p) => p.name.startsWith(name));
}

function getCmd(s: ArenaState, c: ParsedCommand): string {
  const wide = c.flags.output === 'wide';
  const showLabels = c.flags['show-labels'] !== undefined;
  const sel = c.flags.selector?.split('=');
  switch (c.resource) {
    case 'pods': {
      let pods = s.pods;
      if (c.name) pods = pods.filter((p) => p.name === c.name || p.name.startsWith(c.name!));
      if (sel) pods = pods.filter((p) => s.deployments.find((d) => d.name === p.deployment)!.labels[sel[0]] === sel[1]);
      if (!pods.length) return c.name ? `Error from server (NotFound): pods "${c.name}" not found` : 'No resources found in default namespace.';
      const head = ['NAME', 'READY', 'STATUS', 'RESTARTS', 'AGE', ...(wide ? ['IP', 'NODE'] : []), ...(showLabels ? ['LABELS'] : [])];
      return pad([
        head,
        ...pods.map((p, i) => [
          p.name,
          `${p.ready ? 1 : 0}/1`,
          p.status,
          p.restarts ? `${p.restarts} (${age(s, p.startedAt)} ago)` : '0',
          age(s, p.created),
          ...(wide ? [p.node ? `10.244.${s.nodes.findIndex((n) => n.name === p.node) + 1}.${10 + i}` : '<none>', p.node ?? '<none>'] : []),
          ...(showLabels ? [Object.entries(s.deployments.find((d) => d.name === p.deployment)!.labels).map(([k, v]) => `${k}=${v}`).join(',') + `,pod-template-hash=${p.hash.slice(0, 8)}`] : []),
        ]),
      ]);
    }
    case 'deployments': {
      const ds = c.name ? s.deployments.filter((d) => d.name === c.name) : s.deployments;
      if (!ds.length) return `Error from server (NotFound): deployments.apps "${c.name}" not found`;
      return pad([
        ['NAME', 'READY', 'UP-TO-DATE', 'AVAILABLE', 'AGE'],
        ...ds.map((d) => {
          const pods = s.pods.filter((p) => p.deployment === d.name);
          const ready = pods.filter((p) => p.ready).length;
          const upd = pods.filter((p) => p.hash === hashOf(d.template)).length;
          return [d.name, `${ready}/${d.replicas}`, String(Math.min(upd, d.replicas)), String(ready), '41m'];
        }),
      ]);
    }
    case 'services':
      return pad([['NAME', 'TYPE', 'CLUSTER-IP', 'EXTERNAL-IP', 'PORT(S)', 'AGE'], ['kubernetes', 'ClusterIP', '10.96.0.1', '<none>', '443/TCP', '52m'], ...s.services.filter((x) => !c.name || x.name === c.name).map((x, i) => [x.name, 'ClusterIP', `10.96.${12 + i}.${40 + i}`, '<none>', `${x.port}/TCP`, '41m'])]);
    case 'endpoints':
    case 'endpointslices':
      return pad([['NAME', 'ENDPOINTS', 'AGE'], ...s.services.filter((x) => !c.name || x.name === c.name).map((x) => {
        const eps = endpoints(s, x).map((p) => `10.244.${s.nodes.findIndex((n) => n.name === p.node) + 1}.${10 + s.pods.indexOf(p)}:${x.targetPort}`);
        return [x.name, eps.length ? eps.slice(0, 3).join(',') + (eps.length > 3 ? ` + ${eps.length - 3} more...` : '') : '<none>', '41m'];
      })]);
    case 'nodes':
      return pad([['NAME', 'STATUS', 'ROLES', 'AGE', 'VERSION'], ...s.nodes.map((n) => [n.name, n.cordoned ? 'Ready,SchedulingDisabled' : 'Ready', '<none>', '52m', 'v1.33.1'])]);
    case 'configmaps':
      return pad([['NAME', 'DATA', 'AGE'], ['kube-root-ca.crt', '1', '52m'], ...Object.entries(s.configmaps).map(([k, v]) => [k, String(Object.keys(v).length), '41m'])]);
    case 'events': {
      const evs = s.events.slice(-14);
      if (!evs.length) return 'No events found in default namespace.';
      return pad([['LAST SEEN', 'TYPE', 'REASON', 'OBJECT', 'MESSAGE'], ...evs.map((e) => [age(s, e.tick), e.type, e.reason, e.object, e.message])]);
    }
    case 'all':
      return [getCmd(s, { ...c, resource: 'pods' }), '', getCmd(s, { ...c, resource: 'services' }), '', getCmd(s, { ...c, resource: 'deployments' })].join('\n');
    default:
      return `error: the simulator supports get pods|deployments|services|endpoints|nodes|configmaps|events`;
  }
}

function describe(s: ArenaState, c: ParsedCommand): string {
  if (c.resource === 'pods' || (!c.resource && c.name)) {
    const p = findPod(s, c.name);
    if (!p) return `Error from server (NotFound): pods "${c.name ?? ''}" not found`;
    const d = s.deployments.find((x) => x.name === p.deployment)!;
    const evs = s.events.filter((e) => e.object === `pod/${p.name}`).slice(-5);
    const waitingReason = ['ErrImagePull', 'ImagePullBackOff', 'CreateContainerConfigError', 'CrashLoopBackOff'].includes(p.status) ? p.status : '';
    return [
      `Name:         ${p.name}`,
      `Namespace:    default`,
      `Node:         ${p.node ?? '<none>'}`,
      `Labels:       ${Object.entries(d.labels).map(([k, v]) => `${k}=${v}`).join(',')}`,
      `Status:       ${p.node ? 'Running' : 'Pending'}`,
      `Containers:`,
      `  ${d.name}:`,
      `    Image:          ${p.spec.image}`,
      `    Port:           ${d.containerPort}/TCP`,
      `    State:          ${waitingReason ? `Waiting\n      Reason:       ${waitingReason}` : p.node ? 'Running' : 'Waiting'}`,
      ...(p.lastState ? [`    Last State:     Terminated`, `      Reason:       ${p.lastState}`, `      Exit Code:    ${p.lastState === 'OOMKilled' ? 137 : 1}`] : []),
      `    Ready:          ${p.ready}`,
      `    Restart Count:  ${p.restarts}`,
      `    Limits:`,
      `      memory:  ${p.spec.memLimitMi}Mi`,
      `    Requests:`,
      `      memory:  ${d.memRequestMi}Mi`,
      `    Environment:`,
      ...Object.entries(p.spec.env).map(([k, v]) => `      ${k}:  ${v}`),
      ...(p.spec.configRef ? [`    Environment Variables from:`, `      ${p.spec.configRef}  ConfigMap  Optional: false`] : []),
      `Events:`,
      ...(evs.length ? evs.map((e) => `  ${e.type.padEnd(8)} ${e.reason.padEnd(18)} ${age(s, e.tick).padEnd(6)} ${e.message}`) : ['  <none>']),
    ].join('\n');
  }
  if (c.resource === 'deployments') {
    const d = s.deployments.find((x) => x.name === c.name);
    if (!d) return `Error from server (NotFound): deployments.apps "${c.name ?? ''}" not found`;
    return [
      `Name:               ${d.name}`,
      `Selector:           ${Object.entries(d.labels).map(([k, v]) => `${k}=${v}`).join(',')}`,
      `Replicas:           ${d.replicas} desired | ${s.pods.filter((p) => p.deployment === d.name && p.hash === hashOf(d.template)).length} updated | ${s.pods.filter((p) => p.deployment === d.name).length} total`,
      `StrategyType:       RollingUpdate (maxSurge 1, maxUnavailable 0)`,
      `Pod Template:`,
      `  Image:            ${d.template.image}`,
      `  Limits memory:    ${d.template.memLimitMi}Mi`,
      `  Environment:      ${Object.entries(d.template.env).map(([k, v]) => `${k}=${v}`).join(', ')}`,
      ...(d.template.configRef ? [`  Env from:         ${d.template.configRef} (ConfigMap)`] : []),
    ].join('\n');
  }
  if (c.resource === 'services') {
    const svc = s.services.find((x) => x.name === c.name);
    if (!svc) return `Error from server (NotFound): services "${c.name ?? ''}" not found`;
    const eps = endpoints(s, svc);
    return [`Name:              ${svc.name}`, `Selector:          ${Object.entries(svc.selector).map(([k, v]) => `${k}=${v}`).join(',')}`, `Type:              ClusterIP`, `Port:              <unset>  ${svc.port}/TCP`, `TargetPort:        ${svc.targetPort}/TCP`, `Endpoints:         ${eps.length ? eps.map((p) => `${p.name}:${svc.targetPort}`).join(',') : '<none>'}`].join('\n');
  }
  if (c.resource === 'nodes') {
    const n = s.nodes.find((x) => x.name === c.name);
    if (!n) return `Error from server (NotFound): nodes "${c.name ?? ''}" not found`;
    const used = s.pods.filter((p) => p.node === n.name).reduce((m, p) => m + s.deployments.find((d) => d.name === p.deployment)!.memRequestMi, 0);
    return [`Name:               ${n.name}`, `Taints:             ${n.taints.length ? n.taints.map((t) => `${t.key}=${t.value}:${t.effect}`).join(', ') : '<none>'}`, `Unschedulable:      ${n.cordoned}`, `Allocatable memory: ${n.memMi}Mi`, `Allocated requests: memory ${used}Mi (${Math.round((used / n.memMi) * 100)}%)`, `Non-terminated Pods: ${s.pods.filter((p) => p.node === n.name).length}`].join('\n');
  }
  return 'error: describe supports pods, deployments, services and nodes in the simulator';
}

function logs(s: ArenaState, c: ParsedCommand): string {
  let p = findPod(s, c.name);
  if (!p && c.resource === 'deployments') p = s.pods.find((x) => x.deployment === c.name);
  if (!p) return `error: pods "${c.name ?? ''}" not found`;
  const d = s.deployments.find((x) => x.name === p.deployment)!;
  const problem = podProblem(s, p, d);
  const prev = c.flags.previous !== undefined;
  if (problem === 'image' || problem === 'config') return `Error from server (BadRequest): container "${d.name}" in pod "${p.name}" is waiting to start: ${p.status}`;
  if (problem === 'env') {
    if (!prev && p.status !== 'Running') return `Error from server (BadRequest): container "${d.name}" in pod "${p.name}" is waiting to start: back-off — try --previous`;
    return `2026-11-18T09:14:03Z INFO  starting ${d.name} (mode=${p.spec.env.APP_MODE})\n2026-11-18T09:14:03Z FATAL unknown APP_MODE "${p.spec.env.APP_MODE}" (expected prod|staging)`;
  }
  if (problem === 'oom') return prev || p.restarts ? `2026-11-18T09:14:03Z INFO  warming cache (target 180Mi)…\n2026-11-18T09:14:04Z INFO  cache 61Mi / 180Mi\n(process killed: no further output — check Last State in describe)` : 'INFO  warming cache…';
  if (prev && !p.restarts) return `Error from server (BadRequest): previous terminated container "${d.name}" in pod "${p.name}" not found`;
  return d.name === 'web' ? `10.244.1.1 - - "GET / HTTP/1.1" 200 615\n10.244.2.1 - - "GET /health HTTP/1.1" 200 2` : `{"level":"info","msg":"listening on :8080"}`;
}

export interface ExecResult {
  state: ArenaState;
  output: string;
  ok: boolean;
}

/** Run one learner command against the simulated cluster. */
export function execArena(prev: ArenaState, line: string): ExecResult {
  const s = structuredClone(prev);
  const parsed = parseKubectl(line);
  if (!parsed.ok) return { state: prev, output: parsed.error, ok: false };
  s.commands += 1;
  const c = parsed.cmd;
  const w = (name?: string) => s.deployments.find((d) => d.name === name);
  const out = (output: string, ok = true): ExecResult => ({ state: s, output, ok });
  switch (c.verb) {
    case 'get':
      return out(getCmd(s, c));
    case 'describe':
      return out(describe(s, c));
    case 'logs':
      return out(logs(s, c));
    case 'top':
      return out(pad([['NAME', 'CPU(cores)', 'MEMORY(bytes)'], ...s.pods.filter((p) => p.node && p.status === 'Running').map((p) => {
        const d = s.deployments.find((x) => x.name === p.deployment)!;
        return [p.name, '12m', `${Math.min(d.memUsageMi, p.spec.memLimitMi - 3)}Mi`];
      })]));
    case 'scale': {
      const d = w(c.name);
      const r = Number(c.flags.replicas);
      if (!d || !Number.isInteger(r) || r < 0) return out('error: usage: kubectl scale deployment <name> --replicas=N', false);
      d.replicas = Math.min(r, 10);
      return out(`deployment.apps/${d.name} scaled`);
    }
    case 'rollout': {
      const d = w(c.name);
      if (!d) return out(`Error from server (NotFound): deployments.apps "${c.name ?? ''}" not found`, false);
      if (c.subcommand === 'undo') {
        const prevT = d.history.pop();
        if (!prevT) return out('error: no rollout history found', false);
        d.template = prevT;
        event(s, 'Normal', 'DeploymentRollback', `deployment/${d.name}`, `Rolled back to image ${prevT.image}`);
        return out(`deployment.apps/${d.name} rolled back`);
      }
      if (c.subcommand === 'restart') {
        rollout(s, d, { ...d.template, restartNonce: d.template.restartNonce + 1 }, 'kubectl rollout restart');
        return out(`deployment.apps/${d.name} restarted`);
      }
      if (c.subcommand === 'history')
        return out(pad([['REVISION', 'CHANGE-CAUSE'], ...[...d.history, d.template].map((t, i) => [String(i + 1), `image=${t.image} limits.memory=${t.memLimitMi}Mi APP_MODE=${t.env.APP_MODE ?? ''}`])]));
      if (c.subcommand === 'status') {
        const pods = s.pods.filter((p) => p.deployment === d.name);
        const upd = pods.filter((p) => p.hash === hashOf(d.template) && p.ready).length;
        return out(upd >= d.replicas ? `deployment "${d.name}" successfully rolled out` : `Waiting for deployment "${d.name}" rollout to finish: ${upd} of ${d.replicas} updated replicas are available...`);
      }
      return out('error: supported: rollout status|history|undo|restart', false);
    }
    case 'set': {
      const d = w(c.name);
      if (!d && c.subcommand !== 'selector') return out(`error: deployment "${c.name ?? ''}" not found`, false);
      if (c.subcommand === 'image') {
        const assign = c.args.find((a) => a.includes('='));
        const img = assign?.split('=')[1];
        if (!img) return out('error: usage: kubectl set image deployment/<name> <container>=<image>', false);
        rollout(s, d!, { ...d!.template, image: img }, `image updated to ${img}`);
        return out(`deployment.apps/${d!.name} image updated`);
      }
      if (c.subcommand === 'env') {
        const assigns = c.args.filter((a) => a.includes('='));
        if (!assigns.length) return out('error: usage: kubectl set env deployment/<name> KEY=value', false);
        const env = { ...d!.template.env };
        for (const a of assigns) {
          const [k, v] = a.split('=');
          env[k] = v;
        }
        rollout(s, d!, { ...d!.template, env }, 'environment updated');
        return out(`deployment.apps/${d!.name} env updated`);
      }
      if (c.subcommand === 'resources') {
        const lim = c.flags.limits?.match(/memory=(\d+)(Mi|Gi)/);
        if (!lim) return out('error: usage: kubectl set resources deployment/<name> --limits=memory=256Mi', false);
        const mi = Number(lim[1]) * (lim[2] === 'Gi' ? 1024 : 1);
        rollout(s, d!, { ...d!.template, memLimitMi: mi }, `limits.memory set to ${mi}Mi`);
        return out(`deployment.apps/${d!.name} resource requirements updated`);
      }
      if (c.subcommand === 'selector') {
        const svc = s.services.find((x) => x.name === c.name);
        const assigns = c.args.filter((a) => a.includes('='));
        if (c.resource !== 'services' || !svc || !assigns.length) return out('error: usage: kubectl set selector service <name> key=value', false);
        svc.selector = Object.fromEntries(assigns.map((a) => a.split('=') as [string, string]));
        return out(`service/${svc.name} selector updated`);
      }
      return out('error: supported: set image|env|resources|selector', false);
    }
    case 'delete': {
      if (c.resource === 'pods') {
        const p = findPod(s, c.name);
        if (!p) return out(`Error from server (NotFound): pods "${c.name ?? ''}" not found`, false);
        s.pods = s.pods.filter((x) => x !== p);
        return out(`pod "${p.name}" deleted`);
      }
      return out('error: the simulator only lets you delete pods (deleting other objects in production is how outages start)', false);
    }
    case 'create': {
      if (c.resource === 'configmaps' || c.args[0] === 'configmap' || line.includes(' configmap ')) {
        const name = c.name ?? c.args.find((a) => !a.includes('='));
        const lit = Object.entries(c.flags)
          .filter(([k]) => k === 'from-literal')
          .map(([, v]) => v);
        const raw = line.match(/--from-literal[= ]([^\s]+)/g)?.map((m) => m.replace(/--from-literal[= ]/, '')) ?? lit;
        if (!name) return out('error: usage: kubectl create configmap <name> --from-literal=KEY=value', false);
        if (s.configmaps[name]) return out(`Error from server (AlreadyExists): configmaps "${name}" already exists`, false);
        s.configmaps[name] = Object.fromEntries(raw.map((kv) => kv.split('=') as [string, string]));
        return out(`configmap/${name} created`);
      }
      return out('error: the simulator supports `kubectl create configmap`', false);
    }
    case 'cordon':
    case 'uncordon': {
      const n = s.nodes.find((x) => x.name === (c.resource === 'nodes' ? c.name : (c.name ?? c.args[0])));
      if (!n) return out(`Error from server (NotFound): nodes "${c.name ?? c.args[0] ?? ''}" not found`, false);
      n.cordoned = c.verb === 'cordon';
      return out(`node/${n.name} ${c.verb}ed`);
    }
    case 'taint': {
      const all = c.flags.all !== undefined;
      const targets = all ? s.nodes : s.nodes.filter((n) => n.name === c.name);
      const spec = c.args.find((a) => a.endsWith('-') || a.includes(':')) ?? (all && c.name ? c.name : '');
      if (!targets.length || !spec) return out('error: usage: kubectl taint nodes <node>|--all <key>-', false);
      if (spec.endsWith('-')) {
        const key = spec.slice(0, -1).split(/[=:]/)[0];
        for (const n of targets) n.taints = n.taints.filter((t) => t.key !== key);
        return out(targets.map((n) => `node/${n.name} untainted`).join('\n'));
      }
      return out('error: adding taints is disabled in the arena — you are here to fix things', false);
    }
    default:
      return out(`"kubectl ${c.verb}" is not available in the arena. Try get, describe, logs, top, rollout, set, scale, create configmap, delete pod, cordon/uncordon, taint … -`, false);
  }
}

// Expose for tests/UI
export { hashOf as _hashOf };
