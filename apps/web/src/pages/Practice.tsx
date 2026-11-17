import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DOMAINS, INFRA_DOMAINS, INFRA_TOPICS, OBJECTIVES, infraQuestions, questions, type Question } from '@kcna/content';
import { addAttempts, type Attempt, rng, shuffle } from '@kcna/engine';
import { updateProgress, useProgress } from '../lib/store';
import { PageHeader } from '../components/Layout';
import { QuestionCard } from '../components/QuestionCard';
import { pct } from '../components/ui';

export function PracticePage({ track = 'kcna' }: { track?: 'kcna' | 'infra' }) {
  const [params, setParams] = useSearchParams();
  const p = useProgress();
  const infra = track === 'infra';
  const bank: Question<string, string>[] = infra ? infraQuestions : questions;
  const domainList: { id: string; name: string; weight?: number }[] = infra ? INFRA_DOMAINS : DOMAINS;
  const objectiveList: { id: string; name: string }[] = infra ? INFRA_TOPICS : OBJECTIVES;
  const objectiveKey = infra ? 'topic' : 'objective';
  const objective = params.get(objectiveKey);
  const domain = params.get('domain');
  const unseenOnly = params.get('unseen') === '1';
  const [seed, setSeed] = useState(() => Date.now());
  const [i, setI] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);

  const seen = useMemo(() => new Set(p.attempts.map((a) => a.qid)), [p.attempts]);
  const pool: Question<string, string>[] = useMemo(() => {
    let qs = bank.filter((q) => (!objective || q.objective === objective) && (!domain || q.domain === domain));
    if (unseenOnly) qs = qs.filter((q) => !seen.has(q.id));
    return shuffle(qs, rng(seed)).slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objective, domain, unseenOnly, seed, track]);

  const restart = (next: Record<string, string>) => {
    setParams(next);
    setSeed(Date.now());
    setI(0);
    setResults([]);
  };
  const q = pool[i];
  const finished = pool.length > 0 && i >= pool.length;
  const label = objective ? objectiveList.find((o) => o.id === objective)?.name : domain ? domainList.find((d) => d.id === domain)?.name : 'All domains';

  return (
    <div>
      <PageHeader
        title={infra ? 'Senior interview questions' : 'Practice questions'}
        subtitle={infra ? `${bank.length} scenario and trade-off questions at senior cloud infrastructure level. Sessions of 10, with explanations of the trade-off behind every option.` : `${bank.length} original, unofficial KCNA-style questions with explanations. Sessions of 10, with immediate feedback.`}
      />
      <div className="card mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="label block">Domain</span>
          <select className="input mt-1 w-auto" value={domain ?? ''} onChange={(e) => restart(e.target.value ? { domain: e.target.value } : {})}>
            <option value="">All domains</option>
            {domainList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.weight ? ` (${d.weight}%)` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="label block">{infra ? 'Topic' : 'Objective'}</span>
          <select className="input mt-1 w-auto" value={objective ?? ''} onChange={(e) => restart(e.target.value ? { [objectiveKey]: e.target.value } : {})}>
            <option value="">{infra ? 'Any topic' : 'Any objective'}</option>
            {objectiveList.map((o) => (
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
                updateProgress((pr) => addAttempts(pr, [{ qid: q.id, objective: q.objective as Attempt['objective'], correct: ok, at: Date.now(), source: 'quiz', selected: sel }]));
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
