import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DOMAINS, OBJECTIVES, questions, type DomainId, type ObjectiveId, type Question } from '@kcna/content';
import { addAttempts, rng, shuffle } from '@kcna/engine';
import { updateProgress, useProgress } from '../lib/store';
import { PageHeader } from '../components/Layout';
import { QuestionCard } from '../components/QuestionCard';
import { pct } from '../components/ui';

export function PracticePage() {
  const [params, setParams] = useSearchParams();
  const p = useProgress();
  const objective = params.get('objective') as ObjectiveId | null;
  const domain = params.get('domain') as DomainId | null;
  const unseenOnly = params.get('unseen') === '1';
  const [seed, setSeed] = useState(() => Date.now());
  const [i, setI] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);

  const seen = useMemo(() => new Set(p.attempts.map((a) => a.qid)), [p.attempts]);
  const pool: Question[] = useMemo(() => {
    let qs = questions.filter((q) => (!objective || q.objective === objective) && (!domain || q.domain === domain));
    if (unseenOnly) qs = qs.filter((q) => !seen.has(q.id));
    return shuffle(qs, rng(seed)).slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objective, domain, unseenOnly, seed]);

  const restart = (next: Record<string, string>) => {
    setParams(next);
    setSeed(Date.now());
    setI(0);
    setResults([]);
  };
  const q = pool[i];
  const finished = pool.length > 0 && i >= pool.length;
  const label = objective ? OBJECTIVES.find((o) => o.id === objective)?.name : domain ? DOMAINS.find((d) => d.id === domain)?.name : 'All domains';

  return (
    <div>
      <PageHeader title="Practice questions" subtitle={`${questions.length} original, unofficial KCNA-style questions with explanations. Sessions of 10, with immediate feedback.`} />
      <div className="card mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="label block">Domain</span>
          <select className="input mt-1 w-auto" value={domain ?? ''} onChange={(e) => restart(e.target.value ? { domain: e.target.value } : {})}>
            <option value="">All domains</option>
            {DOMAINS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.weight}%)
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="label block">Objective</span>
          <select className="input mt-1 w-auto" value={objective ?? ''} onChange={(e) => restart(e.target.value ? { objective: e.target.value } : {})}>
            <option value="">Any objective</option>
            {OBJECTIVES.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={unseenOnly} onChange={(e) => restart({ ...Object.fromEntries(params), unseen: e.target.checked ? '1' : '' })} />
          Unseen questions only
        </label>
        <button type="button" className="btn-ghost" onClick={() => restart(Object.fromEntries(params))}>
          New set
        </button>
      </div>
      <p className="mb-3 text-sm text-slate-500">
        Practising: <strong>{label}</strong>
      </p>
      {pool.length === 0 && <div className="card text-sm">No questions match — you may have answered every question in this filter. Untick “unseen only”.</div>}
      {finished ? (
        <div className="card">
          <p className="text-lg font-semibold">
            Session score: {results.filter(Boolean).length} / {results.length} ({pct(results.filter(Boolean).length / Math.max(1, results.length))})
          </p>
          <p className="mt-1 text-sm text-slate-500">Your mastery estimates and study plan have been updated.</p>
          <button type="button" className="btn-primary mt-3" onClick={() => restart(Object.fromEntries(params))}>
            Another 10 questions
          </button>
        </div>
      ) : (
        q && (
          <div className="space-y-3">
            <QuestionCard
              key={q.id + seed}
              q={q}
              index={i}
              total={pool.length}
              onAnswered={(ok, sel) => {
                setResults((r) => [...r, ok]);
                updateProgress((pr) => addAttempts(pr, [{ qid: q.id, objective: q.objective, correct: ok, at: Date.now(), source: 'quiz', selected: sel }]));
              }}
            />
            {results.length > i && (
              <button type="button" className="btn-primary" onClick={() => setI(i + 1)}>
                {i === pool.length - 1 ? 'See results' : 'Next question →'}
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}
