import { useMemo, useState } from 'react';
import { questionById, type Question } from '@kcna/content';
import { addAttempts, recentWrong, repeatedMistakes } from '@kcna/engine';
import { updateProgress, useProgress } from '../lib/store';
import { PageHeader } from '../components/Layout';
import { QuestionCard } from '../components/QuestionCard';
import { Empty, Tabs, objectiveName } from '../components/ui';

export function ReviewPage() {
  const p = useProgress();
  const [tab, setTab] = useState<'repeated' | 'recent'>('repeated');
  const [session, setSession] = useState<string[] | null>(null);
  const [i, setI] = useState(0);
  const [answered, setAnswered] = useState(false);
  const repeated = useMemo(() => repeatedMistakes(p.attempts), [p.attempts]);
  const recent = useMemo(() => recentWrong(p.attempts), [p.attempts]);
  const ids = tab === 'repeated' ? repeated.map((r) => r.qid) : recent;

  if (session) {
    const q = questionById(session[i]) as Question | undefined;
    if (!q || i >= session.length)
      return (
        <div>
          <PageHeader title="Review session complete" />
          <button type="button" className="btn-primary" onClick={() => (setSession(null), setI(0))}>
            Back to review
          </button>
        </div>
      );
    return (
      <div className="space-y-3">
        <PageHeader title="Smart review session" subtitle="Re-answer questions you previously missed. A correct answer now clears them from the repeated-mistake list." />
        <QuestionCard
          key={q.id}
          q={q}
          index={i}
          total={session.length}
          onAnswered={(ok, sel) => {
            setAnswered(true);
            updateProgress((pr) => addAttempts(pr, [{ qid: q.id, objective: q.objective, correct: ok, at: Date.now(), source: 'review', selected: sel }]));
          }}
        />
        {answered && (
          <button type="button" className="btn-primary" onClick={() => (setI(i + 1), setAnswered(false))}>
            Next →
          </button>
        )}
      </div>
    );
  }

  // group by objective so patterns are visible
  const byObj = new Map<string, number>();
  for (const id of ids) {
    const q = questionById(id);
    if (q) byObj.set(q.objective, (byObj.get(q.objective) ?? 0) + 1);
  }
  return (
    <div>
      <PageHeader title="Smart review" subtitle="Wrong-answer review driven by your history. Repeated mistakes (missed twice or more and not yet corrected) usually point to a misconception." />
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'repeated', label: `Repeated mistakes (${repeated.length})` },
          { value: 'recent', label: `Currently wrong (${recent.length})` },
        ]}
      />
      {ids.length === 0 ? (
        <div className="mt-4">
          <Empty>{p.attempts.length ? 'Nothing to review here — nice work.' : 'Answer some practice questions first.'}</Empty>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="card">
            <p className="font-semibold">Where the mistakes cluster</p>
            <ul className="mt-2 flex flex-wrap gap-2 text-sm">
              {[...byObj.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([o, n]) => (
                  <li key={o} className="chip">
                    {objectiveName(o as Question['objective'])} · {n}
                  </li>
                ))}
            </ul>
            <button type="button" className="btn-primary mt-4" onClick={() => (setSession(ids.slice(0, 15)), setI(0), setAnswered(false))}>
              Start review ({Math.min(15, ids.length)} questions)
            </button>
          </div>
          <ul className="space-y-2">
            {ids.slice(0, 30).map((id) => {
              const q = questionById(id);
              if (!q) return null;
              const r = repeated.find((x) => x.qid === id);
              return (
                <li key={id} className="card py-3 text-sm">
                  <span className="line-clamp-2">{q.prompt.replace(/```[\s\S]*?```/g, '[output]')}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {objectiveName(q.objective)}
                    {r ? ` · missed ${r.wrongCount}×` : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
