import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DOMAINS, EXAM_FORMAT, questionById, questions, type DomainId, type Question } from '@kcna/content';
import { addExam, gradeExam, isCorrect, recentWrong, selectExamQuestions, type ExamRecord } from '@kcna/engine';
import { getProgress, updateProgress, useProgress } from '../lib/store';
import { PageHeader } from '../components/Layout';
import { Md, MdInline } from '../components/Md';
import { AskAI, explainWrongPrompt } from '../components/TutorPanel';
import { Bar, DOMAIN_COLORS, ObjectiveChip, Tabs, domainName, pct } from '../components/ui';

const ACTIVE_KEY = 'kcna-exam-active-v1';
const L = (i: number) => String.fromCharCode(65 + i);

interface ActiveExam {
  id: string;
  mode: ExamRecord['mode'];
  domain?: DomainId;
  startedAt: number;
  timeLimitSec: number;
  questionIds: string[];
  answers: Record<string, number[]>;
  flagged: string[];
  current: number;
}

const MODES = {
  full: { label: 'Full mock', count: EXAM_FORMAT.questionCount, minutes: EXAM_FORMAT.durationMinutes, desc: `${EXAM_FORMAT.questionCount} questions · ${EXAM_FORMAT.durationMinutes} minutes · domain-weighted like the real exam` },
  short: { label: 'Quick mock', count: 20, minutes: 30, desc: '20 questions · 30 minutes · domain-weighted' },
  domain: { label: 'Domain test', count: 20, minutes: 30, desc: 'Up to 20 questions from one domain · 30 minutes' },
} as const;

function loadActive(): ActiveExam | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? (JSON.parse(raw) as ActiveExam) : null;
  } catch {
    return null;
  }
}
function saveActive(a: ActiveExam | null) {
  try {
    if (a) localStorage.setItem(ACTIVE_KEY, JSON.stringify(a));
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* in-memory only */
  }
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, '0')}`;

export function ExamPage() {
  const [active, setActive] = useState<ActiveExam | null>(loadActive);
  const [resultId, setResultId] = useState<string | null>(null);
  const update = (a: ActiveExam | null) => {
    saveActive(a);
    setActive(a);
  };
  if (active) return <ExamRunner exam={active} onChange={update} onFinish={(id) => (update(null), setResultId(id))} />;
  if (resultId) return <ExamResults examId={resultId} onBack={() => setResultId(null)} />;
  return <ExamSetup onStart={update} onOpen={setResultId} />;
}

function ExamSetup({ onStart, onOpen }: { onStart: (a: ActiveExam) => void; onOpen: (id: string) => void }) {
  const p = useProgress();
  const [mode, setMode] = useState<keyof typeof MODES>('full');
  const [domain, setDomain] = useState<DomainId>('orchestration');
  const start = () => {
    const m = MODES[mode];
    const qs = selectExamQuestions(questions, { total: m.count, seed: Date.now() & 0x7fffffff, domain: mode === 'domain' ? domain : undefined, prioritize: recentWrong(getProgress().attempts).slice(0, 15) });
    onStart({ id: `exam-${Date.now()}`, mode, domain: mode === 'domain' ? domain : undefined, startedAt: Date.now(), timeLimitSec: m.minutes * 60, questionIds: qs.map((q) => q.id), answers: {}, flagged: [], current: 0 });
  };
  const history = [...p.exams].sort((a, b) => b.finishedAt - a.finishedAt);
  return (
    <div>
      <PageHeader title="Mock exam" subtitle="Timed, KCNA-style practice exams built from original questions. These are unofficial practice questions — not real exam content." />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="card space-y-4">
          <Tabs value={mode} onChange={setMode} options={Object.entries(MODES).map(([k, v]) => ({ value: k as keyof typeof MODES, label: v.label }))} />
          <p className="text-sm">{MODES[mode].desc}</p>
          {mode === 'domain' && (
            <select className="input w-auto" value={domain} onChange={(e) => setDomain(e.target.value as DomainId)} aria-label="Domain">
              {DOMAINS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
            <li>Navigate freely, flag questions to revisit, and change answers until you submit.</li>
            <li>The timer keeps running if you refresh; the exam auto-submits at zero.</li>
            <li>Pass mark used for practice: {EXAM_FORMAT.passPercent}% (verify the current official value in the LF candidate handbook).</li>
            <li>Questions you recently got wrong are slightly more likely to appear.</li>
          </ul>
          <button type="button" className="btn-primary" onClick={start}>
            Start {MODES[mode].label.toLowerCase()}
          </button>
        </div>
        <div className="card">
          <h2 className="font-semibold">Exam history</h2>
          {history.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {history.slice(0, 12).map((e) => (
                <li key={e.id}>
                  <button type="button" className="flex w-full justify-between rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-ink-850" onClick={() => onOpen(e.id)}>
                    <span>
                      {new Date(e.finishedAt).toLocaleDateString()} · {e.mode} · {e.questionIds.length}q
                    </span>
                    <span className={`font-semibold ${e.score * 100 >= EXAM_FORMAT.passPercent ? 'text-emerald-600' : 'text-rose-600'}`}>{pct(e.score)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No exams yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ExamRunner({ exam, onChange, onFinish }: { exam: ActiveExam; onChange: (a: ActiveExam | null) => void; onFinish: (id: string) => void }) {
  const qs = useMemo(() => exam.questionIds.map((id) => questionById(id)).filter(Boolean) as Question[], [exam.questionIds]);
  const [now, setNow] = useState(Date.now());
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = Math.round(exam.timeLimitSec - (now - exam.startedAt) / 1000);
  const q = qs[exam.current];
  const answered = qs.filter((x) => exam.answers[x.id]?.length).length;

  const submit = () => {
    const finishedAt = Date.now();
    const g = gradeExam(qs, exam.answers, EXAM_FORMAT.passPercent);
    const record: ExamRecord = {
      id: exam.id,
      mode: exam.mode,
      startedAt: exam.startedAt,
      finishedAt,
      durationSec: Math.min(exam.timeLimitSec, Math.round((finishedAt - exam.startedAt) / 1000)),
      timeLimitSec: exam.timeLimitSec,
      questionIds: exam.questionIds,
      answers: exam.answers,
      flagged: exam.flagged,
      score: g.score,
      byDomain: g.byDomain,
    };
    updateProgress((p) => addExam(p, record, qs.map((x) => ({ qid: x.id, objective: x.objective, correct: isCorrect(x, exam.answers[x.id]), at: finishedAt, source: 'exam' as const, selected: exam.answers[x.id] ?? [] }))));
    onFinish(exam.id);
  };
  useEffect(() => {
    if (remaining <= 0) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining <= 0]);

  if (!q) return null;
  const sel = exam.answers[q.id] ?? [];
  const multi = q.type === 'multi';
  const setSel = (i: number) => {
    const cur = exam.answers[q.id] ?? [];
    const next = multi ? (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]) : [i];
    onChange({ ...exam, answers: { ...exam.answers, [q.id]: next } });
  };
  const go = (n: number) => onChange({ ...exam, current: Math.max(0, Math.min(qs.length - 1, n)) });
  const flagged = exam.flagged.includes(q.id);

  return (
    <div>
      <div className="sticky top-14 z-20 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur sm:-mx-8 sm:px-8 dark:border-slate-800 dark:bg-ink-950/95">
        <p className="text-sm font-semibold">
          {MODES[exam.mode].label} · Question {exam.current + 1} of {qs.length} · {answered} answered
        </p>
        <p className={`font-mono text-lg font-bold ${remaining < 300 ? 'text-rose-600' : ''}`} role="timer" aria-label={`Time remaining ${fmt(remaining)}`}>
          ⏱ {fmt(Math.max(0, remaining))}
        </p>
        <button type="button" className="btn-primary" onClick={() => setConfirm(true)}>
          Submit exam
        </button>
      </div>
      {confirm && (
        <div className="card mb-4 border-amber-400" role="alertdialog" aria-labelledby="confirm-title">
          <p id="confirm-title" className="font-semibold">
            Submit now? {qs.length - answered} unanswered, {exam.flagged.length} flagged.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary" onClick={submit}>
              Yes, submit
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>
              Keep working
            </button>
          </div>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_250px]">
        <div className="card" data-testid="exam-question">
          <div className="mb-2 flex items-center justify-between">
            <span className="chip">Unofficial practice question</span>
            <button type="button" className={`chip ${flagged ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : ''}`} onClick={() => onChange({ ...exam, flagged: flagged ? exam.flagged.filter((x) => x !== q.id) : [...exam.flagged, q.id] })} aria-pressed={flagged}>
              ⚑ {flagged ? 'Flagged' : 'Flag for review'}
            </button>
          </div>
          <Md className="text-[15px] font-medium">{q.prompt}</Md>
          {multi && <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">Select {q.answer.length}.</p>}
          <fieldset className="mt-3 space-y-2">
            <legend className="sr-only">Choices</legend>
            {q.choices.map((c, i) => (
              <label key={i} className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${sel.includes(i) ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'}`}>
                <input type={multi ? 'checkbox' : 'radio'} name={`exam-${q.id}`} className="mt-0.5 accent-brand-600" checked={sel.includes(i)} onChange={() => setSel(i)} />
                <span>
                  <strong className="mr-1">{L(i)}.</strong>
                  <MdInline>{c}</MdInline>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="mt-4 flex justify-between">
            <button type="button" className="btn-ghost" onClick={() => go(exam.current - 1)} disabled={exam.current === 0}>
              ← Previous
            </button>
            <button type="button" className="btn-primary" onClick={() => go(exam.current + 1)} disabled={exam.current === qs.length - 1}>
              Next →
            </button>
          </div>
        </div>
        <nav className="card" aria-label="Question navigator">
          <p className="label mb-2">Navigator</p>
          <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
            {qs.map((x, i) => {
              const a = exam.answers[x.id]?.length;
              const f = exam.flagged.includes(x.id);
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Question ${i + 1}${a ? ', answered' : ''}${f ? ', flagged' : ''}`}
                  aria-current={i === exam.current}
                  className={`relative h-8 rounded text-xs font-medium ${i === exam.current ? 'ring-2 ring-brand-500' : ''} ${a ? 'bg-brand-600 text-white dark:bg-brand-500 dark:text-ink-950' : 'bg-slate-100 dark:bg-ink-800'}`}
                >
                  {i + 1}
                  {f && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-amber-500" />}
                </button>
              );
            })}
          </div>
          <button type="button" className="mt-4 text-xs text-rose-600 underline" onClick={() => window.confirm('Abandon this exam? It will not be saved.') && onChange(null)}>
            Abandon exam
          </button>
        </nav>
      </div>
    </div>
  );
}

function ExamResults({ examId, onBack }: { examId: string; onBack: () => void }) {
  const p = useProgress();
  const e = p.exams.find((x) => x.id === examId);
  const [filter, setFilter] = useState<'wrong' | 'flagged' | 'all'>('wrong');
  if (!e)
    return (
      <div className="card">
        Exam not found. <button className="underline" onClick={onBack}>Back</button>
      </div>
    );
  const qs = e.questionIds.map((id) => questionById(id)).filter(Boolean) as Question[];
  const g = gradeExam(qs, e.answers, EXAM_FORMAT.passPercent);
  const list = qs.filter((q) => (filter === 'all' ? true : filter === 'flagged' ? e.flagged.includes(q.id) : g.wrong.includes(q.id)));
  const objStats = Object.entries(g.byObjective).sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total);
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Result: ${pct(e.score)} — ${g.passed ? 'above' : 'below'} the ${EXAM_FORMAT.passPercent}% practice pass mark`}
        subtitle={`${g.correct}/${g.total} correct · ${Math.round(e.durationSec / 60)} of ${Math.round(e.timeLimitSec / 60)} minutes used · ${new Date(e.finishedAt).toLocaleString()}`}
        actions={
          <>
            <button type="button" className="btn-ghost" onClick={onBack}>
              Exam home
            </button>
            <Link className="btn-primary" to="/readiness">
              Update readiness
            </Link>
          </>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3">
          <h2 className="font-semibold">By domain</h2>
          {DOMAINS.filter((d) => e.byDomain[d.id]).map((d) => {
            const s = e.byDomain[d.id]!;
            return (
              <div key={d.id}>
                <div className="flex justify-between text-sm">
                  <span>{domainName(d.id)}</span>
                  <span>
                    {s.correct}/{s.total} ({pct(s.correct / s.total)})
                  </span>
                </div>
                <Bar value={s.correct / s.total} className={DOMAIN_COLORS[d.id]} label={`${domainName(d.id)} score`} />
              </div>
            );
          })}
        </div>
        <div className="card">
          <h2 className="font-semibold">Weakest objectives in this exam</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {objStats.slice(0, 5).map(([o, s]) => (
              <li key={o} className="flex items-center justify-between gap-2">
                <Link to={`/practice?objective=${o}`}>
                  <ObjectiveChip id={o as Question['objective']} />
                </Link>
                <span>
                  {s.correct}/{s.total}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Review</h2>
        <Tabs
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'wrong', label: `Wrong (${g.wrong.length})` },
            { value: 'flagged', label: `Flagged (${e.flagged.length})` },
            { value: 'all', label: `All (${qs.length})` },
          ]}
        />
      </div>
      <div className="space-y-4">
        {list.map((q) => {
          const sel = e.answers[q.id] ?? [];
          const ok = isCorrect(q, sel);
          return (
            <div key={q.id} className="card" data-testid="review-item">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`chip ${ok ? 'border-emerald-400 text-emerald-700' : 'border-rose-400 text-rose-700'}`}>{ok ? 'Correct' : sel.length ? 'Wrong' : 'Unanswered'}</span>
                <ObjectiveChip id={q.objective} />
              </div>
              <Md className="font-medium">{q.prompt}</Md>
              <ul className="mt-2 space-y-1 text-sm">
                {q.choices.map((c, i) => (
                  <li key={i} className={q.answer.includes(i) ? 'font-medium text-emerald-700 dark:text-emerald-300' : sel.includes(i) ? 'text-rose-700 line-through dark:text-rose-300' : ''}>
                    {L(i)}. <MdInline>{c}</MdInline>
                    {(q.answer.includes(i) || sel.includes(i)) && <span className="block pl-4 text-xs font-normal text-slate-500 no-underline">{q.choiceRationale[i]}</span>}
                  </li>
                ))}
              </ul>
              <Md className="mt-2 text-sm">{q.explanation}</Md>
              {!ok && <AskAI className="mt-2" label="Explain why my answer was wrong" mode="exam-coach" question={explainWrongPrompt(q.id, sel)} context={{ questionId: q.id, selected: sel, lessonId: q.lessonId }} />}
            </div>
          );
        })}
        {!list.length && <p className="text-sm text-slate-500">Nothing to show for this filter.</p>}
      </div>
    </div>
  );
}
