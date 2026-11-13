import { useEffect, useState } from 'react';

// A small engine for pedagogical, step-through SVG diagrams. Each step
// highlights the components involved and the edge that "carries" the action,
// with a one-paragraph narration. Auto-play is disabled when the user prefers
// reduced motion.

export interface DNode {
  id: string;
  label: string;
  sub?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind?: 'control' | 'node' | 'pod' | 'store' | 'net' | 'ext' | 'group' | 'obj';
}

export interface DEdge {
  from: string;
  to: string;
  label?: string;
}

export interface DStep {
  title: string;
  text: string;
  highlight: string[];
  edges?: DEdge[];
}

export interface DiagramSpec {
  width: number;
  height: number;
  nodes: DNode[];
  /** static edges always drawn faintly */
  edges?: DEdge[];
}

const KIND_STYLE: Record<NonNullable<DNode['kind']>, string> = {
  control: 'fill-sky-50 stroke-sky-400 dark:fill-sky-500/10 dark:stroke-sky-500/60',
  node: 'fill-emerald-50 stroke-emerald-400 dark:fill-emerald-500/10 dark:stroke-emerald-500/60',
  pod: 'fill-amber-50 stroke-amber-400 dark:fill-amber-500/10 dark:stroke-amber-500/60',
  store: 'fill-violet-50 stroke-violet-400 dark:fill-violet-500/10 dark:stroke-violet-500/60',
  net: 'fill-cyan-50 stroke-cyan-400 dark:fill-cyan-500/10 dark:stroke-cyan-500/60',
  ext: 'fill-slate-100 stroke-slate-400 dark:fill-slate-500/10 dark:stroke-slate-500',
  group: 'fill-transparent stroke-slate-300 [stroke-dasharray:5_4] dark:stroke-slate-600',
  obj: 'fill-white stroke-slate-400 dark:fill-ink-850 dark:stroke-slate-500',
};

function center(n: DNode) {
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}

/** Point where the segment from the node centre towards (tx,ty) leaves the rectangle. */
function border(n: DNode, tx: number, ty: number) {
  const c = center(n);
  const dx = tx - c.x;
  const dy = ty - c.y;
  if (!dx && !dy) return c;
  const sx = dx ? n.w / 2 / Math.abs(dx) : Infinity;
  const sy = dy ? n.h / 2 / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: c.x + dx * s, y: c.y + dy * s };
}

export function DiagramSvg({
  spec,
  highlight = [],
  activeEdges = [],
  selected,
  onSelect,
  title,
}: {
  spec: DiagramSpec;
  highlight?: string[];
  activeEdges?: DEdge[];
  selected?: string;
  onSelect?: (id: string) => void;
  title: string;
}) {
  const byId = new Map(spec.nodes.map((n) => [n.id, n]));
  const dim = highlight.length > 0;
  const line = (e: DEdge, active: boolean, i: number) => {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) return null;
    const ca = center(a);
    const cb = center(b);
    const p1 = border(a, cb.x, cb.y);
    const p2 = border(b, ca.x, ca.y);
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    return (
      <g key={`${e.from}-${e.to}-${i}-${active}`}>
        <line
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          className={active ? 'flow-line stroke-violet-500' : 'stroke-slate-300 dark:stroke-slate-600'}
          strokeWidth={active ? 2.5 : 1.2}
          markerEnd={active ? 'url(#arrow-active)' : 'url(#arrow)'}
        />
        {e.label && active && (
          <g>
            <rect x={mx - e.label.length * 3.4 - 6} y={my - 10} width={e.label.length * 6.8 + 12} height={18} rx={4} className="fill-violet-600" />
            <text x={mx} y={my + 3} textAnchor="middle" className="fill-white text-[10.5px] font-medium">
              {e.label}
            </text>
          </g>
        )}
      </g>
    );
  };
  return (
    <svg viewBox={`0 0 ${spec.width} ${spec.height}`} className="h-auto w-full select-none" role="img" aria-label={title}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" className="fill-slate-400" />
        </marker>
        <marker id="arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" className="fill-violet-500" />
        </marker>
      </defs>
      {spec.nodes
        .filter((n) => n.kind === 'group')
        .map((n) => (
          <g key={n.id}>
            <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={12} className={`${KIND_STYLE.group} ${dim && !highlight.includes(n.id) ? 'opacity-50' : ''}`} strokeWidth={1.5} />
            <text x={n.x + 12} y={n.y + 20} className="fill-slate-500 text-[12px] font-semibold tracking-wide uppercase dark:fill-slate-400">
              {n.label}
            </text>
          </g>
        ))}
      {(spec.edges ?? []).map((e, i) => line(e, false, i))}
      {spec.nodes
        .filter((n) => n.kind !== 'group')
        .map((n) => {
          const hl = highlight.includes(n.id);
          const sel = selected === n.id;
          const interactive = !!onSelect;
          return (
            <g
              key={n.id}
              className={`${interactive ? 'cursor-pointer' : ''} transition-opacity ${dim && !hl ? 'opacity-35' : ''}`}
              onClick={() => onSelect?.(n.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect?.(n.id)}
              tabIndex={interactive ? 0 : undefined}
              role={interactive ? 'button' : undefined}
              aria-label={interactive ? `${n.label}${n.sub ? ` (${n.sub})` : ''}` : undefined}
              aria-pressed={interactive ? sel : undefined}
            >
              <rect
                x={n.x}
                y={n.y}
                width={n.w}
                height={n.h}
                rx={8}
                className={`${KIND_STYLE[n.kind ?? 'obj']} ${hl ? '!stroke-violet-500' : ''} ${sel ? '!stroke-brand-600' : ''}`}
                strokeWidth={hl || sel ? 2.5 : 1.3}
              />
              <text x={n.x + n.w / 2} y={n.y + n.h / 2 + (n.sub ? -2 : 4)} textAnchor="middle" className="fill-slate-800 text-[12.5px] font-semibold dark:fill-slate-100">
                {n.label}
              </text>
              {n.sub && (
                <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 13} textAnchor="middle" className="fill-slate-500 text-[10.5px] dark:fill-slate-400">
                  {n.sub}
                </text>
              )}
            </g>
          );
        })}
      {activeEdges.map((e, i) => line(e, true, i))}
    </svg>
  );
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Step-through player: Prev / Play / Next with narration. */
export function StepPlayer({ spec, steps, title, onStep }: { spec: DiagramSpec; steps: DStep[]; title: string; onStep?: (i: number) => void }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    setI(0);
    setPlaying(false);
  }, [steps]);
  useEffect(() => {
    onStep?.(i);
  }, [i, onStep]);
  useEffect(() => {
    if (!playing) return;
    if (i >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setI((x) => x + 1), 3800);
    return () => clearTimeout(t);
  }, [playing, i, steps.length]);
  const s = steps[i];
  return (
    <div>
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2 dark:border-slate-800 dark:bg-ink-950/40">
        <DiagramSvg spec={spec} highlight={s.highlight} activeEdges={s.edges} title={title} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>
          ← Prev
        </button>
        {!reducedMotion() && (
          <button type="button" className="btn-ghost" onClick={() => (i >= steps.length - 1 ? (setI(0), setPlaying(true)) : setPlaying(!playing))}>
            {playing ? 'Pause' : i >= steps.length - 1 ? 'Replay' : 'Play'}
          </button>
        )}
        <button type="button" className="btn-primary" onClick={() => setI((x) => Math.min(steps.length - 1, x + 1))} disabled={i === steps.length - 1}>
          Next →
        </button>
        <div className="ml-auto flex gap-1" aria-hidden="true">
          {steps.map((_, j) => (
            <button key={j} type="button" tabIndex={-1} onClick={() => setI(j)} className={`h-1.5 w-5 rounded-full ${j <= i ? 'bg-violet-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
          ))}
        </div>
      </div>
      <div className="mt-3 rounded-lg border-l-4 border-violet-500 bg-violet-50 p-3 dark:bg-violet-500/10" aria-live="polite">
        <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
          Step {i + 1} of {steps.length}: {s.title}
        </p>
        <p className="mt-1 text-sm">{s.text}</p>
      </div>
    </div>
  );
}
