import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { sequencePuzzles } from '@kcna/content';
import { rng, shuffle } from '@kcna/engine';
import { Md } from './Md';
import { lessonPath } from './ui';

/** Order-the-steps puzzle. Up/down buttons keep it keyboard- and touch-friendly. */
export function SequenceGame({ id, onDone }: { id: string; onDone?: (correct: boolean) => void }) {
  const puzzle = sequencePuzzles.find((s) => s.id === id)!;
  const initial = useMemo(() => {
    let order = shuffle(puzzle.steps.map((_, i) => i), rng(id.length * 7919 + Date.now()));
    if (order.every((v, i) => v === i)) order = [...order.slice(1), order[0]];
    return order;
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [order, setOrder] = useState(initial);
  const [checked, setChecked] = useState(false);
  const correct = order.every((v, i) => v === i);
  const move = (i: number, d: -1 | 1) => {
    if (checked) return;
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };
  return (
    <div className="space-y-3" data-testid="sequence-game">
      <div>
        <p className="font-semibold">{puzzle.title}</p>
        <p className="text-sm text-slate-500">{puzzle.prompt}</p>
      </div>
      <ol className="space-y-1.5">
        {order.map((stepIdx, i) => {
          const right = checked && stepIdx === i;
          const wrong = checked && stepIdx !== i;
          return (
            <li key={stepIdx} className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${right ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : wrong ? 'border-rose-400 bg-rose-50 dark:bg-rose-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
              <span className="w-5 shrink-0 text-center font-mono text-xs text-slate-500">{i + 1}</span>
              <span className="flex-1">{puzzle.steps[stepIdx]}</span>
              {!checked && (
                <span className="flex shrink-0 flex-col">
                  <button type="button" className="rounded px-1.5 text-xs hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-ink-800" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move "${puzzle.steps[stepIdx]}" up`}>
                    ▲
                  </button>
                  <button type="button" className="rounded px-1.5 text-xs hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-ink-800" disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label={`Move "${puzzle.steps[stepIdx]}" down`}>
                    ▼
                  </button>
                </span>
              )}
              {wrong && <span className="shrink-0 text-xs text-rose-600">should be #{stepIdx + 1}</span>}
            </li>
          );
        })}
      </ol>
      {!checked ? (
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setChecked(true);
            onDone?.(correct);
          }}
        >
          Check order
        </button>
      ) : (
        <div className="space-y-2">
          <p role="status" className={`font-semibold ${correct ? 'text-emerald-600' : 'text-rose-600'}`}>
            {correct ? '✓ Perfect order' : '✗ Not quite — the correct position is shown on each step'}
          </p>
          <Md className="text-sm">{puzzle.explanation}</Md>
          <Link to={lessonPath(puzzle.lessonId)} className="text-sm underline">
            Related lesson
          </Link>
        </div>
      )}
    </div>
  );
}

/** Tap a term, then its definition. Mistakes flash but do not end the round. */
export function MatchGame({ pairs, onDone }: { pairs: { term: string; definition: string }[]; onDone?: (mistakes: number) => void }) {
  const defs = useMemo(() => shuffle(pairs.map((_, i) => i), rng(pairs.length * 31 + Date.now())), [pairs]);
  const [sel, setSel] = useState<number | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [miss, setMiss] = useState(0);
  const [flash, setFlash] = useState<number | null>(null);
  const pick = (d: number) => {
    if (sel === null || done.has(d)) return;
    if (d === sel) {
      const next = new Set(done).add(d);
      setDone(next);
      setSel(null);
      if (next.size === pairs.length) onDone?.(miss);
    } else {
      setMiss((m) => m + 1);
      setFlash(d);
      setTimeout(() => setFlash(null), 500);
    }
  };
  return (
    <div className="space-y-3" data-testid="match-game">
      <p className="text-sm text-slate-500">Tap a term, then the matching definition.</p>
      <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
        <div className="space-y-1.5">
          {pairs.map((p, i) => (
            <button key={p.term} type="button" disabled={done.has(i)} onClick={() => setSel(i)} aria-pressed={sel === i} className={`block w-full rounded-lg border px-3 py-2 text-left text-sm font-medium ${done.has(i) ? 'border-emerald-400 opacity-50' : sel === i ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
              {p.term}
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          {defs.map((d) => (
            <button key={d} type="button" disabled={done.has(d)} onClick={() => pick(d)} className={`block w-full rounded-lg border px-3 py-2 text-left text-xs ${done.has(d) ? 'border-emerald-400 opacity-50' : flash === d ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/10' : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'}`}>
              {pairs[d].definition}
            </button>
          ))}
        </div>
      </div>
      {done.size === pairs.length && (
        <p role="status" className="font-semibold text-emerald-600">
          ✓ All matched{miss ? ` (${miss} miss${miss > 1 ? 'es' : ''})` : ' — flawless'}
        </p>
      )}
    </div>
  );
}
