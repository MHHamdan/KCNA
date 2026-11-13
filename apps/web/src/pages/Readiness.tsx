import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DOMAINS, OBJECTIVES } from '@kcna/content';
import { COVERAGE_TARGET, HALF_LIFE_DAYS, READINESS_WEIGHTS, READY_RULES, computeReadiness, performanceSummary, type ReadinessStatus } from '@kcna/engine';
import { useProgress } from '../lib/store';
import { PageHeader } from '../components/Layout';
import { AskAI } from '../components/TutorPanel';
import { Bar, DOMAIN_COLORS, pct } from '../components/ui';

export const STATUS_LABEL: Record<ReadinessStatus, string> = {
  'not-started': 'Not started',
  building: 'Building foundations',
  approaching: 'Approaching readiness',
  ready: 'Evidence suggests you are ready',
};

export function ReadinessPage() {
  const p = useProgress();
  const r = useMemo(() => computeReadiness(p), [p]);
  const weakest = r.weakestDomain ? DOMAINS.find((d) => d.id === r.weakestDomain) : null;
  return (
    <div className="space-y-6">
      <PageHeader title="Am I ready for KCNA?" subtitle="A conservative, evidence-based preparation indicator built from your answers, mock exams, coverage and retention. It is not a statistically validated probability of passing." />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="card text-center">
          <p className="label">Readiness indicator</p>
          <p className="mt-2 text-5xl font-bold text-slate-900 dark:text-white">{r.index}</p>
          <p className="text-sm text-slate-500">out of 100</p>
          <p className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-semibold ${r.status === 'ready' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200' : r.status === 'approaching' ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'}`}>{STATUS_LABEL[r.status]}</p>
          <div className="mt-4 space-y-2 text-left text-sm">
            {(
              [
                ['Knowledge (domain-weighted mastery)', r.components.knowledge, READINESS_WEIGHTS.knowledge],
                ['Recent full mock exams', r.components.mocks, READINESS_WEIGHTS.mocks],
                ['Objective coverage', r.components.coverage, READINESS_WEIGHTS.coverage],
                ['Flashcard retention', r.components.retention, READINESS_WEIGHTS.retention],
              ] as const
            ).map(([l, v, w]) => (
              <div key={l}>
                <div className="flex justify-between text-xs">
                  <span>
                    {l} · weight {w * 100}%
                  </span>
                  <span>{pct(v)}</span>
                </div>
                <Bar value={v} label={l} />
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2 className="font-semibold">Readiness checklist</h2>
          <ul className="mt-3 space-y-2">
            {r.checklist.map((c) => (
              <li key={c.id} className="flex items-start gap-3 text-sm">
                <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs ${c.met ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500 dark:bg-ink-800'}`} aria-hidden="true">
                  {c.met ? '✓' : ''}
                </span>
                <span>
                  <span className="font-medium">{c.label}</span>
                  <span className="sr-only">{c.met ? ' (met)' : ' (not met)'}</span>
                  <span className="block text-xs text-slate-500">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            “Ready” requires an index ≥ {READY_RULES.index}, at least {READY_RULES.minMocks} full mocks averaging ≥ {READY_RULES.mockMean * 100}%, every domain ≥ {READY_RULES.domainFloor * 100}% and coverage ≥ {READY_RULES.coverage * 100}%. Completing lessons alone never makes you “ready”.
          </p>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold">Personalised study plan</h2>
        {weakest && (
          <p className="mt-2 text-sm">
            Your weakest domain by expected points lost is <strong>{weakest.name}</strong> ({weakest.weight}% of the exam, conservative mastery {pct(r.domains[weakest.id])}).
          </p>
        )}
        <ol className="mt-3 space-y-3">
          {r.plan.map((x, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800 dark:bg-brand-500/20 dark:text-brand-200">{i + 1}</span>
              <span>
                <a href={x.href} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                  {x.label}
                </a>
                <span className="block text-xs text-slate-500">{x.reason}</span>
              </span>
            </li>
          ))}
          {!r.plan.length && <li className="text-sm text-slate-500">Start the learning path to generate a plan.</li>}
        </ol>
        <AskAI className="mt-4" mode="revision" label="Ask AI to coach my revision" question="Based on my performance summary, explain my biggest risks for the KCNA exam and run a short revision drill on my weakest topic." context={{ performance: performanceSummary(r), page: 'readiness' }} />
      </div>

      <div className="card">
        <h2 className="font-semibold">Objective mastery</h2>
        <div className="mt-3 grid gap-x-8 gap-y-3 md:grid-cols-2">
          {OBJECTIVES.map((o) => {
            const m = r.objectives[o.id];
            return (
              <div key={o.id}>
                <div className="flex justify-between text-sm">
                  <Link to={`/practice?objective=${o.id}`} className="hover:underline">
                    {o.name}
                  </Link>
                  <span className="text-xs text-slate-500">
                    {m.attempts ? `${pct(m.lower)} (mean ${pct(m.mean)}, ${m.distinct}/${COVERAGE_TARGET} distinct)` : 'no evidence'}
                  </span>
                </div>
                <Bar value={m.lower} className={DOMAIN_COLORS[o.domain]} label={`${o.name} mastery`} />
              </div>
            );
          })}
        </div>
      </div>

      <details className="card text-sm">
        <summary className="cursor-pointer font-semibold">How is this calculated?</summary>
        <div className="mt-3 space-y-2 text-slate-600 dark:text-slate-400">
          <p>
            <strong>Objective mastery</strong>: each answer is weighted by recency (half-life {HALF_LIFE_DAYS} days; review re-answers count 0.8). A Beta(1,1) prior is updated with weighted correct/incorrect counts and we report the posterior mean minus one standard deviation — a conservative lower estimate that stays low until there is enough evidence.
          </p>
          <p>
            <strong>Knowledge</strong> = Σ domain weight × average objective mastery in that domain. <strong>Mocks</strong> = mean of up to 3 full mocks in the last {READY_RULES.mockWindowDays} days (quick mocks count at half value only when no full mock exists). <strong>Coverage</strong> = share of each objective’s {COVERAGE_TARGET}-question target answered, weighted by exam weight. <strong>Retention</strong> = share of studied flashcards with ≥7-day intervals minus a lapse penalty.
          </p>
          <p>
            Index = 100 × ({READINESS_WEIGHTS.knowledge}·K + {READINESS_WEIGHTS.mocks}·M + {READINESS_WEIGHTS.coverage}·C + {READINESS_WEIGHTS.retention}·R − inconsistency penalty). See docs/EXAM_READINESS.md for the full rationale.
          </p>
        </div>
      </details>
    </div>
  );
}
