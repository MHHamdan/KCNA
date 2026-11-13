import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { troubleshootingScenarios } from '@kcna/content';
import { recordActivity } from '@kcna/engine';
import { updateProgress, useProgress } from '../lib/store';
import { usePageContext } from '../lib/tutorContext';
import { PageHeader } from '../components/Layout';
import { Md } from '../components/Md';
import { CodeBlock } from '../components/CodeBlock';
import { AskAI } from '../components/TutorPanel';
import { ObjectiveChip, References } from '../components/ui';

const PHASES = ['hypothesis', 'investigation', 'evidence', 'solution'] as const;
const PHASE_LABEL: Record<(typeof PHASES)[number], string> = { hypothesis: 'Hypothesis', investigation: 'Investigation', evidence: 'Evidence', solution: 'Solution' };

export function TroubleshootPage() {
  const [params, setParams] = useSearchParams();
  const p = useProgress();
  const sc = troubleshootingScenarios.find((s) => s.id === params.get('id')) ?? troubleshootingScenarios[0];
  const [stage, setStage] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [revealed, setRevealed] = useState<{ command: string; output: string }[]>([]);
  usePageContext({ lessonId: sc.lessonId, page: `troubleshoot:${sc.id}` });
  useEffect(() => {
    setStage(0);
    setPicked(null);
    setMistakes(0);
    setRevealed([]);
  }, [sc.id]);
  const done = stage >= sc.stages.length;
  const st = sc.stages[Math.min(stage, sc.stages.length - 1)];

  const choose = (i: number) => {
    setPicked(i);
    if (!st.options[i].correct) setMistakes((m) => m + 1);
  };
  const advance = () => {
    if (st.reveal) setRevealed((r) => [...r, st.reveal!]);
    setPicked(null);
    const next = stage + 1;
    setStage(next);
    if (next >= sc.stages.length) updateProgress((pr) => recordActivity({ ...pr, practiceCompleted: { ...pr.practiceCompleted, [sc.id]: Date.now() } }));
  };

  return (
    <div>
      <PageHeader title="Troubleshooting simulator" subtitle="Diagnose realistic failures with the method real operators use: Symptom → Hypothesis → Investigation → Evidence → Solution. Cluster output is simulated." />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {troubleshootingScenarios.map((s) => (
          <button key={s.id} type="button" onClick={() => setParams({ id: s.id })} className={`chip px-3 py-1 ${s.id === sc.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-slate-100 dark:hover:bg-ink-800'}`}>
            {p.practiceCompleted[s.id] && '✓ '}
            {s.title}
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <div className="card">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{sc.title}</h2>
              <ObjectiveChip id={sc.objective} />
            </div>
            <p className="label mt-3">Symptom</p>
            <Md className="text-sm">{sc.symptom}</Md>
          </div>
          <div className="card">
            <p className="label">Evidence collected</p>
            {[...sc.evidence, ...revealed].map((e, i) => (
              <CodeBlock key={i} code={`$ ${e.command}\n${e.output}`} language="text" title={e.command} />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <ol className="flex gap-1" aria-label="Progress">
            {PHASES.map((ph, i) => (
              <li key={ph} className={`flex-1 rounded-md px-2 py-1 text-center text-xs font-semibold ${i < stage ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200' : i === stage ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-ink-800'}`}>
                {PHASE_LABEL[ph]}
              </li>
            ))}
          </ol>
          {done ? (
            <div className="card space-y-3">
              <p className="font-semibold text-emerald-600">Resolved {mistakes === 0 ? 'with no wrong turns' : `with ${mistakes} wrong turn(s)`}.</p>
              <p className="label">Takeaway</p>
              <Md className="text-sm">{sc.takeaway}</Md>
              <References refs={sc.references} />
            </div>
          ) : (
            <div className="card">
              <p className="label">{PHASE_LABEL[st.phase]}</p>
              <Md className="mt-1 text-sm font-medium">{st.question}</Md>
              <div className="mt-3 space-y-2">
                {st.options.map((o, i) => {
                  const show = picked !== null && (picked === i || o.correct);
                  const cls = picked === null ? 'border-slate-200 hover:border-slate-400 dark:border-slate-700' : o.correct && show ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : picked === i ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/10' : 'border-slate-200 opacity-60 dark:border-slate-700';
                  return (
                    <button key={i} type="button" disabled={picked !== null && st.options[picked].correct} onClick={() => choose(i)} className={`block w-full rounded-lg border p-3 text-left text-sm ${cls}`}>
                      {o.text}
                      {picked === i && <Md className="mt-1 text-xs">{o.feedback}</Md>}
                    </button>
                  );
                })}
              </div>
              {picked !== null && st.options[picked].correct && (
                <button type="button" className="btn-primary mt-3" onClick={advance}>
                  {stage === sc.stages.length - 1 ? 'Finish' : 'Next phase →'}
                </button>
              )}
              {picked !== null && !st.options[picked].correct && <p className="mt-2 text-xs text-slate-500">Not quite — read the feedback and try another option.</p>}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <AskAI mode="troubleshoot" question={`Help me troubleshoot "${sc.title}". What should I check next, and why?`} context={{ lessonId: sc.lessonId, page: `troubleshoot:${sc.id}` }} />
            <Link className="btn-ghost" to={`/lessons/${sc.lessonId}`}>
              Related lesson
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
