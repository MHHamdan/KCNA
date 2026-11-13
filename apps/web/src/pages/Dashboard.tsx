import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DOMAINS, EXAM_FORMAT, flashcards, labs, lessons, questions } from '@kcna/content';
import { computeReadiness, dueCards, nextLesson, performanceSummary } from '@kcna/engine';
import { useProgress } from '../lib/store';
import { PageHeader } from '../components/Layout';
import { AskAI } from '../components/TutorPanel';
import { Bar, DOMAIN_COLORS, Stat, objectiveName, pct } from '../components/ui';
import { STATUS_LABEL } from './Readiness';

function Heatmap({ activity }: { activity: Record<string, number> }) {
  const days = Array.from({ length: 84 }, (_, i) => {
    const d = new Date(Date.now() - (83 - i) * 86_400_000).toISOString().slice(0, 10);
    return { d, n: activity[d] ?? 0 };
  });
  const shade = (n: number) => (n === 0 ? 'bg-slate-200 dark:bg-ink-800' : n < 5 ? 'bg-brand-200 dark:bg-brand-900' : n < 15 ? 'bg-brand-400 dark:bg-brand-700' : 'bg-brand-600 dark:bg-brand-400');
  const active = days.filter((d) => d.n > 0).length;
  return (
    <div>
      <div className="grid grid-flow-col grid-rows-7 gap-1" aria-label={`Study activity: ${active} active days in the last 12 weeks`}>
        {days.map((d) => (
          <div key={d.d} className={`size-3 rounded-sm ${shade(d.n)}`} title={`${d.d}: ${d.n} learning events`} />
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">{active} active days in the last 12 weeks</p>
    </div>
  );
}

export function Dashboard() {
  const p = useProgress();
  const r = useMemo(() => computeReadiness(p), [p]);
  const next = nextLesson(p);
  const due = dueCards(flashcards, p.cards).length;
  const answered = p.attempts.length;
  const accuracy = answered ? p.attempts.filter((a) => a.correct).length / answered : 0;
  const lessonsDone = Object.keys(p.lessonsCompleted).length;
  const labsDone = Object.keys(p.labsCompleted).length;
  const lastExams = [...p.exams].sort((a, b) => b.finishedAt - a.finishedAt).slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title="KCNA Interactive Learning Lab"
        subtitle="Master Kubernetes and Cloud Native — learn, practice, troubleshoot, ask, review and pass."
        actions={
          <>
            {next && (
              <Link to={`/lessons/${next.id}`} className="btn-primary">
                {lessonsDone ? 'Continue' : 'Start'}: {next.title}
              </Link>
            )}
            <Link to="/exam" className="btn-ghost">
              Mock exam
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Readiness indicator" value={`${r.index}/100`} hint={STATUS_LABEL[r.status]} />
        <Stat label="Lessons" value={`${lessonsDone}/${lessons.length}`} hint={`${labsDone}/${labs.filter((l) => l.status === 'full').length} hands-on labs done`} />
        <Stat label="Question accuracy" value={answered ? pct(accuracy) : '—'} hint={`${answered} answers · ${questions.length} questions in bank`} />
        <Stat label="Flashcards due" value={due} hint={<Link className="underline" to="/flashcards">Review now</Link>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-2" aria-labelledby="dm">
          <div className="flex items-center justify-between">
            <h2 id="dm" className="font-semibold">Domain mastery</h2>
            <span className="text-xs text-slate-500">conservative estimate · exam weight</span>
          </div>
          <div className="mt-4 space-y-4">
            {DOMAINS.map((d) => (
              <div key={d.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>
                    {d.name} <span className="text-slate-500">· {d.weight}%</span>
                  </span>
                  <span className="font-medium">{answered ? pct(r.domains[d.id]) : '—'}</span>
                </div>
                <Bar value={r.domains[d.id]} className={DOMAIN_COLORS[d.id]} label={`${d.name} mastery`} />
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Mastery uses recency-weighted answers with a Bayesian lower bound, so a few lucky answers can’t inflate it. See <Link className="underline" to="/readiness">Am I ready?</Link> for the full breakdown.
          </p>
        </section>

        <section className="card" aria-labelledby="next">
          <h2 id="next" className="font-semibold">What to study next</h2>
          {r.plan.length ? (
            <ol className="mt-3 space-y-3">
              {r.plan.slice(0, 4).map((x, i) => (
                <li key={i} className="text-sm">
                  <a href={x.href} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                    {x.label}
                  </a>
                  <p className="text-xs text-slate-500">{x.reason}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Answer a few questions to get personalised recommendations.</p>
          )}
          {answered > 0 && (
            <AskAI className="mt-4" label="Ask AI why these are recommended" mode="revision" question="Why are these topics recommended for me, and what should I focus on this week?" context={{ performance: performanceSummary(r), page: 'dashboard' }} />
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card" aria-labelledby="weak">
          <h2 id="weak" className="font-semibold">Weakest objectives</h2>
          {answered ? (
            <ul className="mt-3 space-y-2 text-sm">
              {r.weakObjectives.map((o) => (
                <li key={o} className="flex items-center justify-between gap-2">
                  <Link to={`/practice?objective=${o}`} className="hover:underline">
                    {objectiveName(o)}
                  </Link>
                  <span className="text-xs text-slate-500">
                    {pct(r.objectives[o].lower)} · {r.objectives[o].attempts} ans.
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No answers yet.</p>
          )}
        </section>
        <section className="card" aria-labelledby="mocks">
          <h2 id="mocks" className="font-semibold">Mock exam history</h2>
          {lastExams.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {lastExams.map((e) => (
                <li key={e.id} className="flex justify-between">
                  <span>
                    {new Date(e.finishedAt).toLocaleDateString()} · {e.mode} ({e.questionIds.length}q)
                  </span>
                  <span className={`font-semibold ${e.score * 100 >= EXAM_FORMAT.passPercent ? 'text-emerald-600' : 'text-rose-600'}`}>{pct(e.score)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No mock exams yet. Take one after a few lessons.</p>
          )}
        </section>
        <section className="card" aria-labelledby="act">
          <h2 id="act" className="font-semibold">Daily study activity</h2>
          <div className="mt-3">
            <Heatmap activity={p.activity} />
          </div>
        </section>
      </div>

      <section className="card" aria-labelledby="flow">
        <h2 id="flow" className="font-semibold">Your study loop</h2>
        <ol className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {[
            ['Learn', '/path'],
            ['Visualize', '/explore'],
            ['Practice', '/terminal'],
            ['Ask AI', '/tutor'],
            ['Quiz', '/practice'],
            ['Diagnose', '/readiness'],
            ['Review', '/review'],
            ['Mock exam', '/exam'],
            ['Exam readiness', '/readiness'],
          ].map(([l, to], i, a) => (
            <li key={l} className="flex items-center gap-2">
              <Link to={to} className="chip px-3 py-1 hover:bg-slate-100 dark:hover:bg-ink-800">
                {l}
              </Link>
              {i < a.length - 1 && <span className="text-slate-400">→</span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
