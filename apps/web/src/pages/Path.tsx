import { Link } from 'react-router-dom';
import { STAGES, lessons } from '@kcna/content';
import { lessonMastered } from '@kcna/engine';
import { useProgress } from '../lib/store';
import { PageHeader } from '../components/Layout';
import { Bar, ObjectiveChip, ScopeBadge } from '../components/ui';

export function PathPage() {
  const p = useProgress();
  return (
    <div>
      <PageHeader title="Learning path" subtitle="Nine stages from Linux foundations to exam readiness. Each lesson maps to official KCNA competencies; foundation lessons cover prerequisites the exam assumes." />
      <ol className="space-y-6">
        {STAGES.map((s) => {
          const ls = lessons.filter((l) => l.stage === s.id);
          const done = ls.filter((l) => p.lessonsCompleted[l.id]).length;
          const mastered = ls.filter((l) => lessonMastered(p, l.id)).length;
          return (
            <li key={s.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="label">Stage {s.id}</p>
                  <h2 className="text-lg font-semibold">{s.title}</h2>
                  <p className="text-sm text-slate-500">{s.goal}</p>
                </div>
                {ls.length > 0 && (
                  <div className="w-40 text-right text-xs text-slate-500">
                    {done}/{ls.length} read · {mastered} mastered
                    <Bar value={mastered / ls.length} label={`${s.title} mastery`} />
                  </div>
                )}
              </div>
              {s.id === 8 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    ['Domain practice tests', '/practice'],
                    ['Smart review', '/review'],
                    ['Flashcards', '/flashcards'],
                    ['Timed mock exam', '/exam'],
                    ['Readiness evaluation', '/readiness'],
                  ].map(([l, to]) => (
                    <Link key={to} to={to} className="btn-ghost">
                      {l}
                    </Link>
                  ))}
                </div>
              ) : (
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {ls.map((l) => (
                    <li key={l.id}>
                      <Link to={`/lessons/${l.id}`} className="flex h-full flex-col gap-1.5 rounded-lg border border-slate-200 p-3 hover:border-brand-400 dark:border-slate-700">
                        <span className="flex items-start justify-between gap-2">
                          <span className="font-medium">{l.title}</span>
                          {lessonMastered(p, l.id) ? (
                            <span className="chip border-emerald-400 text-emerald-700 dark:text-emerald-300" title="Knowledge check passed">★ Mastered</span>
                          ) : p.lessonsCompleted[l.id] ? (
                            <span className="text-emerald-600" aria-label="completed" title="Read — pass the knowledge check to master it">✓</span>
                          ) : (
                            <span className="text-xs text-slate-500">{l.estMinutes} min</span>
                          )}
                        </span>
                        <span className="line-clamp-2 text-xs text-slate-500">{l.summary}</span>
                        <span className="flex flex-wrap gap-1">
                          <ScopeBadge scope={l.scope} />
                          {l.objectives.slice(0, 2).map((o) => (
                            <ObjectiveChip key={o} id={o} />
                          ))}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
