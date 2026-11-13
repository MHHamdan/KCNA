import { useState } from 'react';
import { decisionGames } from '@kcna/content';
import { recordActivity } from '@kcna/engine';
import { updateProgress } from '../lib/store';
import { PageHeader } from '../components/Layout';
import { Md } from '../components/Md';
import { AskAI } from '../components/TutorPanel';
import { Bar, ObjectiveChip } from '../components/ui';

export function DecisionsPage() {
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const done = i >= decisionGames.length;
  const g = decisionGames[Math.min(i, decisionGames.length - 1)];
  return (
    <div>
      <PageHeader title="Architecture decision game" subtitle="Pick the right Kubernetes resource or approach for each scenario. First answer counts toward your score." />
      <div className="mb-4 max-w-md">
        <Bar value={i / decisionGames.length} label="Game progress" />
        <p className="mt-1 text-xs text-slate-500">
          {Math.min(i, decisionGames.length)} / {decisionGames.length} · score {score}
        </p>
      </div>
      {done ? (
        <div className="card">
          <p className="text-lg font-semibold">
            You scored {score} / {decisionGames.length}
          </p>
          <button type="button" className="btn-primary mt-3" onClick={() => (setI(0), setPick(null), setScore(0))}>
            Play again
          </button>
        </div>
      ) : (
        <div className="card max-w-3xl">
          <ObjectiveChip id={g.objective} />
          <Md className="mt-2 font-medium">{g.scenario}</Md>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {g.options.map((o, j) => {
              const cls = pick === null ? 'border-slate-200 hover:border-brand-400 dark:border-slate-700' : j === g.answer ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : j === pick ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/10' : 'border-slate-200 opacity-60 dark:border-slate-700';
              return (
                <button
                  key={j}
                  type="button"
                  disabled={pick !== null}
                  className={`rounded-lg border p-3 text-left text-sm ${cls}`}
                  onClick={() => {
                    setPick(j);
                    if (j === g.answer) setScore((s) => s + 1);
                  }}
                >
                  {o}
                </button>
              );
            })}
          </div>
          {pick !== null && (
            <div className="mt-4 space-y-3">
              <Md className="text-sm">{g.explanation}</Md>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    if (i === decisionGames.length - 1) updateProgress((p) => recordActivity({ ...p, practiceCompleted: { ...p.practiceCompleted, 'decision-game': Date.now() } }));
                    setI(i + 1);
                    setPick(null);
                  }}
                >
                  Next scenario →
                </button>
                <AskAI mode="exam-coach" question={`Scenario: ${g.scenario.slice(0, 400)}\nWhy is "${g.options[g.answer]}" the best choice${pick !== g.answer ? ` instead of "${g.options[pick]}"` : ''}?`} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
