import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Question } from '@kcna/content';
import { isCorrect } from '@kcna/engine';
import { Md, MdInline } from './Md';
import { AskAI, explainWrongPrompt } from './TutorPanel';
import { ObjectiveChip, References } from './ui';

const L = (i: number) => String.fromCharCode(65 + i);

/** Practice-mode question: answer → immediate feedback with per-option rationale. */
export function QuestionCard({
  q,
  onAnswered,
  index,
  total,
  showLesson = true,
}: {
  q: Question;
  onAnswered?: (correct: boolean, selected: number[]) => void;
  index?: number;
  total?: number;
  showLesson?: boolean;
}) {
  const [sel, setSel] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const multi = q.type === 'multi';
  const correct = done && isCorrect(q, sel);
  const toggle = (i: number) => {
    if (done) return;
    setSel((s) => (multi ? (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]) : [i]));
  };
  const submit = () => {
    setDone(true);
    onAnswered?.(isCorrect(q, sel), sel);
  };
  return (
    <div className="card" data-testid="question-card">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {index !== undefined && total !== undefined && (
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Question {index + 1} / {total}
          </span>
        )}
        <ObjectiveChip id={q.objective} />
        <span className="chip">Difficulty {q.difficulty}/3</span>
        <span className="chip">Unofficial practice</span>
      </div>
      <Md className="text-[15px] font-medium text-slate-900 dark:text-slate-100">{q.prompt}</Md>
      {multi && <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">Select {q.answer.length}.</p>}
      <fieldset className="mt-3 space-y-2">
        <legend className="sr-only">Answer choices</legend>
        {q.choices.map((c, i) => {
          const picked = sel.includes(i);
          const isAns = q.answer.includes(i);
          const state = !done ? (picked ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700') : isAns ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : picked ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/10' : 'border-slate-200 opacity-75 dark:border-slate-700';
          return (
            <label key={i} className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${state}`}>
              <input type={multi ? 'checkbox' : 'radio'} name={`q-${q.id}`} className="mt-0.5 accent-brand-600" checked={picked} disabled={done} onChange={() => toggle(i)} />
              <span className="flex-1">
                <span className="mr-1.5 font-semibold">{L(i)}.</span>
                <MdInline>{c}</MdInline>
                {done && (isAns || picked) && <span className={`mt-1 block text-xs ${isAns ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{q.choiceRationale[i]}</span>}
              </span>
            </label>
          );
        })}
      </fieldset>
      {!done ? (
        <button type="button" className="btn-primary mt-4" disabled={multi ? sel.length !== q.answer.length : sel.length === 0} onClick={submit}>
          Check answer
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <p className={`font-semibold ${correct ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`} role="status">
            {correct ? '✓ Correct' : `✗ Not quite — correct answer: ${q.answer.map(L).join(', ')}`}
          </p>
          <Md className="text-sm">{q.explanation}</Md>
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-500">Why each option is right or wrong</summary>
            <ul className="mt-2 space-y-1">
              {q.choiceRationale.map((r, i) => (
                <li key={i}>
                  <strong>{L(i)}.</strong> {r}
                </li>
              ))}
            </ul>
          </details>
          <div className="flex flex-wrap items-center gap-2">
            {!correct && <AskAI label="Explain why my answer was wrong" mode="exam-coach" question={explainWrongPrompt(q.id, sel)} context={{ questionId: q.id, selected: sel, lessonId: q.lessonId }} />}
            {correct && <AskAI label="Ask AI to go deeper" question="I got this right. What related concept could the exam test next, and how?" context={{ questionId: q.id, selected: sel, lessonId: q.lessonId }} mode="exam-coach" />}
            {showLesson && (
              <Link to={`/lessons/${q.lessonId}`} className="btn-ghost">
                Open lesson
              </Link>
            )}
          </div>
          <References refs={q.references} />
        </div>
      )}
    </div>
  );
}
