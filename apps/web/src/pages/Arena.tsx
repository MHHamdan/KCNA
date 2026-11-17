import { useEffect, useRef, useState } from 'react';
import { FAULTS, arenaScore, execArena, newArena, nextHint, recordActivity, servedRatio, tick, type ArenaState } from '@kcna/engine';
import { updateProgress, useProgress } from '../lib/store';
import { usePageContext } from '../lib/tutorContext';
import { PageHeader } from '../components/Layout';
import { AskAI } from '../components/TutorPanel';

const STATUS_COLOR: Record<string, string> = {
  Running: 'bg-emerald-500',
  ContainerCreating: 'bg-sky-400',
  Pending: 'bg-slate-400',
  ErrImagePull: 'bg-rose-500',
  ImagePullBackOff: 'bg-rose-500',
  CreateContainerConfigError: 'bg-orange-500',
  CrashLoopBackOff: 'bg-rose-600',
  OOMKilled: 'bg-fuchsia-600',
  Error: 'bg-rose-600',
};

function Sparkline({ values }: { values: number[] }) {
  const w = 240;
  const h = 40;
  const pts = values.map((v, i) => `${(i / Math.max(1, 59)) * w},${h - v * (h - 4) - 2}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" role="img" aria-label="Requests served over the last minute">
      <polyline points={pts} fill="none" strokeWidth="2" className="stroke-brand-500" />
    </svg>
  );
}

function ClusterView({ s }: { s: ArenaState }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3" aria-label="Cluster map">
      {s.nodes.map((n) => (
        <div key={n.name} className={`rounded-lg border p-2 ${n.cordoned ? 'border-dashed border-amber-400' : n.taints.length ? 'border-rose-400' : 'border-slate-300 dark:border-slate-700'}`}>
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>{n.name}</span>
            <span className="text-[10px] font-normal text-slate-500">{n.cordoned ? 'cordoned' : n.taints.length ? 'tainted' : 'ready'}</span>
          </div>
          <div className="mt-1.5 flex min-h-6 flex-wrap gap-1">
            {s.pods
              .filter((p) => p.node === n.name)
              .map((p) => (
                <span key={p.name} title={`${p.name}: ${p.status}${p.ready ? ' (ready)' : ''}`} className={`inline-block h-5 rounded px-1 text-[9px] leading-5 font-semibold text-white ${STATUS_COLOR[p.status] ?? 'bg-slate-500'} ${p.ready ? '' : 'opacity-70'}`}>
                  {p.deployment}
                </span>
              ))}
          </div>
        </div>
      ))}
      {s.pods.some((p) => !p.node) && (
        <div className="rounded-lg border border-dashed border-slate-400 p-2 text-xs sm:col-span-3">
          <span className="font-semibold">Pending (unscheduled): </span>
          {s.pods
            .filter((p) => !p.node)
            .map((p) => p.deployment)
            .join(', ')}
        </div>
      )}
    </div>
  );
}

export function ArenaPage() {
  const p = useProgress();
  const [state, setState] = useState<ArenaState | null>(null);
  const [lines, setLines] = useState<{ kind: 'cmd' | 'out' | 'err' | 'info'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const started = useRef(0);
  const saved = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  usePageContext({ page: 'arena:break-fix' });

  useEffect(() => {
    if (!state || state.outcome !== 'running') return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') setState((s) => (s ? tick(s) : s));
    }, 1000);
    return () => clearInterval(t);
  }, [state?.outcome, state === null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [lines]);

  // announce injected faults in the terminal
  const announced = useRef(0);
  useEffect(() => {
    if (!state) return;
    if (state.faults.length > announced.current) {
      const f = state.faults[state.faults.length - 1];
      announced.current = state.faults.length;
      setLines((l) => [...l, { kind: 'err', text: `🔥 PAGER: ${FAULTS[f.id].title}. Restore service before the error budget runs out.` }]);
    }
    if (state.outcome !== 'running' && !saved.current) {
      saved.current = true;
      const run = { at: Date.now(), level: state.level, won: state.outcome === 'won', score: state.outcome === 'won' ? arenaScore(state) : 0, seconds: Math.round((Date.now() - started.current) / 1000), hints: state.faults.reduce((n, f) => n + f.hintsUsed, 0) };
      updateProgress((pr) => recordActivity({ ...pr, play: { ...pr.play, arena: [...pr.play.arena, run].slice(-200) } }));
    }
  }, [state]);

  const start = (level: 1 | 2 | 3) => {
    const s = newArena(level);
    started.current = Date.now();
    saved.current = false;
    announced.current = 0;
    setState(s);
    setLines([{ kind: 'info', text: `Arena level ${level}: a 3-node cluster runs "web" (3 replicas) and "api" (2). Chaos will strike ${level} time(s). Use kubectl to find and fix each fault. Type "hint" if stuck.` }]);
  };

  const run = () => {
    const cmd = input.trim();
    if (!cmd || !state) return;
    setHistory((h) => [...h, cmd]);
    setHIdx(-1);
    setInput('');
    if (cmd === 'clear') return setLines([]);
    if (cmd === 'hint') {
      const { state: ns, hint } = nextHint(state);
      setState(ns);
      return setLines((l) => [...l, { kind: 'cmd', text: cmd }, { kind: 'info', text: `💡 ${hint}` }]);
    }
    const r = execArena(state, cmd.replace(/^k\s/, 'kubectl '));
    setState(r.state);
    setLines((l) => [...l, { kind: 'cmd', text: cmd }, { kind: r.ok ? 'out' : 'err', text: r.output }]);
  };

  const best = (lvl: number) => Math.max(0, ...p.play.arena.filter((r) => r.level === lvl && r.won).map((r) => r.score));
  const wins = p.play.arena.filter((r) => r.won).length;

  if (!state)
    return (
      <div className="space-y-6">
        <PageHeader
          title="Break-Fix Arena"
          subtitle="A live, simulated Kubernetes cluster. Chaos injects real-world failures while users are hitting your app; you have an error budget and a terminal. Diagnose with kubectl, fix the root cause, keep the service up."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {([1, 2, 3] as const).map((lvl) => (
            <div key={lvl} className="card space-y-2">
              <p className="text-lg font-semibold">
                Level {lvl} {['🟢', '🟠', '🔴'][lvl - 1]}
              </p>
              <p className="text-sm text-slate-500">{lvl === 1 ? 'One incident. Learn the loop: observe → hypothesise → fix → verify.' : lvl === 2 ? 'Two incidents, back to back. Budget drains faster.' : 'Three incidents. Triage under pressure, no time to waste.'}</p>
              <p className="text-xs text-slate-500">Best score: {best(lvl) || '—'}</p>
              <button type="button" className="btn-primary w-full" onClick={() => start(lvl)}>
                Start level {lvl}
              </button>
            </div>
          ))}
        </div>
        <div className="card text-sm text-slate-600 dark:text-slate-400">
          <p className="font-semibold text-slate-800 dark:text-slate-200">How it works</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>The cluster reconciles every second: rolling updates surge one Pod at a time and keep old Pods until new ones are Ready; the kubelet retries; the scheduler respects capacity, cordons and taints.</li>
            <li>Supported: get, describe, logs (--previous), top pods, rollout status|history|undo|restart, set image|env|resources|selector, scale, create configmap, delete pod, cordon/uncordon, taint … -.</li>
            <li>Faults: broken images, missing ConfigMaps, Service selector typos, accidental scale-downs, OOMKills, forgotten cordons, NoExecute taints, bad environment variables.</li>
            <li>Score = remaining error budget × level − hints − time to recover. {wins} round(s) won so far.</li>
          </ul>
        </div>
      </div>
    );

  const ratio = servedRatio(state);
  const over = state.outcome !== 'running';
  return (
    <div className="space-y-4">
      <PageHeader title={`Break-Fix Arena · level ${state.level}`} subtitle="Simulation — commands are interpreted by an in-browser cluster model, not a real cluster." />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#0b1017] font-mono text-[12.5px] text-slate-200" onClick={() => document.getElementById('arena-input')?.focus()}>
            <div className="max-h-[440px] min-h-[300px] overflow-y-auto p-3" role="log" aria-live="polite">
              {lines.map((l, i) => (
                <pre key={i} className={`whitespace-pre-wrap ${l.kind === 'cmd' ? 'text-sky-300' : l.kind === 'err' ? 'text-rose-400' : l.kind === 'info' ? 'text-amber-300' : 'text-slate-200'}`}>
                  {l.kind === 'cmd' ? `$ ${l.text}` : l.text}
                </pre>
              ))}
              {!over && (
                <div className="flex items-center gap-2" ref={endRef}>
                  <span className="text-emerald-400">$</span>
                  <label htmlFor="arena-input" className="sr-only">
                    kubectl command
                  </label>
                  <input
                    id="arena-input"
                    autoFocus
                    className="flex-1 bg-transparent text-slate-100 outline-none"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') run();
                      if (e.key === 'ArrowUp' && history.length) {
                        e.preventDefault();
                        const i = hIdx < 0 ? history.length - 1 : Math.max(0, hIdx - 1);
                        setHIdx(i);
                        setInput(history[i]);
                      }
                    }}
                    placeholder="kubectl get pods"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['kubectl get pods -o wide', 'kubectl get events', 'kubectl get endpoints', 'kubectl get nodes', 'kubectl get deploy', 'hint'].map((c) => (
              <button key={c} type="button" className="chip font-mono hover:bg-slate-100 dark:hover:bg-ink-800" disabled={over} onClick={() => setInput(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <aside className="space-y-3">
          <div className="card space-y-2 p-4">
            <div className="flex justify-between text-sm font-semibold">
              <span>Error budget</span>
              <span className={state.budget < 30 ? 'text-rose-600' : ''}>{Math.round(state.budget)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-ink-800" role="progressbar" aria-valuenow={Math.round(state.budget)} aria-valuemin={0} aria-valuemax={100} aria-label="Error budget">
              <div className={`h-full transition-all ${state.budget < 30 ? 'bg-rose-500' : state.budget < 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${state.budget}%` }} />
            </div>
            <p className="text-xs text-slate-500">Users served right now: {Math.round(ratio * 100)}%</p>
            <Sparkline values={state.served} />
          </div>
          <div className="card p-4">
            <p className="label mb-2">Cluster</p>
            <ClusterView s={state} />
          </div>
          <div className="card space-y-1 p-4 text-sm">
            <p className="label">Incidents</p>
            {state.faults.length === 0 && <p className="text-slate-500">All quiet… for now.</p>}
            {state.faults.map((f, i) => (
              <p key={i}>
                {f.resolvedAt ? '✅' : '🔥'} {FAULTS[f.id].title}
                {f.resolvedAt ? <span className="text-xs text-slate-500"> — fixed in ~{(f.resolvedAt - f.at) * 4}s cluster time</span> : null}
              </p>
            ))}
            <p className="text-xs text-slate-500">
              {state.schedule.filter((x) => x.at > state.tick).length} more incident(s) scheduled · {state.commands} commands
            </p>
          </div>
          {over && (
            <div className={`card space-y-2 p-4 ${state.outcome === 'won' ? 'border-emerald-400' : 'border-rose-400'}`} role="status">
              <p className="text-lg font-bold">{state.outcome === 'won' ? `🏆 Service restored — score ${arenaScore(state)}` : '💥 Error budget exhausted'}</p>
              <p className="text-sm text-slate-500">{state.outcome === 'won' ? 'Write the one-line postmortem in your head: what failed, how you detected it, what fixed it, what would prevent it.' : 'Review which signal would have led you to the fault fastest, then try again.'}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={() => start(state.level)}>
                  Play again
                </button>
                {state.level < 3 && state.outcome === 'won' && (
                  <button type="button" className="btn-ghost" onClick={() => start((state.level + 1) as 2 | 3)}>
                    Next level
                  </button>
                )}
                <button type="button" className="btn-ghost" onClick={() => setState(null)}>
                  Menu
                </button>
              </div>
              <AskAI
                mode="troubleshoot"
                label="Debrief with the AI tutor"
                question={`I just played a Kubernetes break-fix round. Incidents: ${state.faults.map((f) => FAULTS[f.id].title).join('; ')}. Outcome: ${state.outcome}. Walk me through the fastest diagnosis path for each and how to prevent it in production.`}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
