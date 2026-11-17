import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  INFRA_DOMAINS,
  INFRA_RESOURCES_VERIFIED_AT,
  behavioralPrompts,
  designCaseById,
  designCases,
  infraLessons,
  infraQuestions,
  infraResources,
  type InfraDomainId,
} from '@kcna/content';
import { INFRA_TARGETS, INFRA_WEIGHTS, computeInfraReadiness, designCoverage, recordActivity } from '@kcna/engine';
import { updateProgress, useProgress } from '../lib/store';
import { usePageContext, useTutor } from '../lib/tutorContext';
import { PageHeader } from '../components/Layout';
import { Md } from '../components/Md';
import { AskAI } from '../components/TutorPanel';
import { Bar, INFRA_DOMAIN_COLORS, ObjectiveChip, References, Stat, pct } from '../components/ui';
import { HabitStrip } from './Play';

const STATUS_LABEL = {
  'not-started': 'Not started',
  building: 'Building depth',
  'interview-ready-soon': 'Nearly interview-ready',
  'interview-ready': 'Evidence says you are interview-ready',
} as const;

// ---------------- Track home ----------------

export function InfraHome() {
  const p = useProgress();
  const r = useMemo(() => computeInfraReadiness(p), [p]);
  const read = infraLessons.filter((l) => p.lessonsCompleted[l.id]).length;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Cloud Infrastructure — Senior Interview Prep"
        subtitle="A standalone track for senior and staff cloud infrastructure, platform and SRE interviews. It covers networking, data, distributed systems, reliability, security, automation, observability, architecture and cost, plus system design and behavioural rounds. Vendor-neutral, with AWS, Azure and Google Cloud equivalents."
        actions={
          <>
            <Link className="btn-primary" to={`/infra/lessons/${(infraLessons.find((l) => !p.lessonsCompleted[l.id]) ?? infraLessons[0])?.id}`}>
              {read ? 'Continue learning' : 'Start the track'}
            </Link>
            <Link className="btn-ghost" to="/infra/mock">
              Mock interview
            </Link>
          </>
        }
      />
      <HabitStrip />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Interview readiness" value={`${r.index}/100`} hint={STATUS_LABEL[r.status]} />
        <Stat label="Lessons" value={`${read}/${infraLessons.length}`} hint="with interview angles" />
        <Stat label="System designs" value={`${r.solidDesigns}/${designCases.length}`} hint={`solid (≥${INFRA_TARGETS.designRubricShare * 100}% of rubric)`} />
        <Stat label="Mock interviews" value={p.mockInterviews.length} hint={`${Object.keys(p.behavioralStories).length}/${behavioralPrompts.length} STAR stories written`} />
      </div>

      <section className="card">
        <h2 className="font-semibold">How to prepare (about 4–6 weeks at 1 hour a day)</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
          <li>
            <strong>Weeks 1–3: depth.</strong> One lesson a day. Read the <em>Interview angle</em> section out loud, then answer the knowledge check and 10 questions on that topic.
          </li>
          <li>
            <strong>Weeks 2–5: system design.</strong> Two timed cases a week. Write your design before opening the reference, then self-grade with the rubric and ask the AI interviewer for a score.
          </li>
          <li>
            <strong>Week 3 onwards: stories.</strong> Write at least 8 STAR stories from your own experience, then drill them in behavioural mocks.
          </li>
          <li>
            <strong>Final 2 weeks: mocks.</strong> Run mixed mock interviews and close the gaps on the readiness page.
          </li>
        </ol>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {INFRA_DOMAINS.map((d) => {
          const ls = infraLessons.filter((l) => d.topics.some((t) => l.objectives.includes(t)));
          return (
            <section key={d.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{d.name}</h2>
                  <p className="text-xs text-slate-500">{d.summary}</p>
                </div>
                <span className={`chip ${d.importance === 'core' ? 'border-violet-400 text-violet-700 dark:text-violet-300' : ''}`}>{d.importance}</span>
              </div>
              <div className="mt-3">
                <Bar value={r.domains[d.id]} className={INFRA_DOMAIN_COLORS[d.id]} label={`${d.name} mastery`} />
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {ls.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2">
                    <Link to={`/infra/lessons/${l.id}`} className="hover:underline">
                      {l.title}
                    </Link>
                    {p.lessonsCompleted[l.id] ? <span className="text-emerald-600">✓</span> : <span className="text-xs text-slate-500">{l.estMinutes} min</span>}
                  </li>
                ))}
              </ul>
              <Link to={`/infra/practice?domain=${d.id}`} className="mt-3 inline-block text-xs text-brand-700 underline dark:text-brand-300">
                Practise {d.name} questions
              </Link>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- System design ----------------

export function InfraDesignList() {
  const p = useProgress();
  return (
    <div>
      <PageHeader
        title="System design interviews"
        subtitle="Ten infrastructure design cases at senior and staff level. Each has a model answer, the trade-offs interviewers probe, failure modes and a grading rubric. Write your own design first, then compare."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {designCases.map((c) => {
          const cov = designCoverage(p, c.id);
          return (
            <Link key={c.id} to={`/infra/design/${c.id}`} className="card block hover:border-brand-400">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{c.title}</p>
                <span className="chip">{c.difficulty}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {c.topics.slice(0, 3).map((t) => (
                  <ObjectiveChip key={t} id={t} />
                ))}
              </div>
              {p.designPractice[c.id] && (
                <div className="mt-3 text-xs text-slate-500">
                  Rubric covered {pct(cov)}
                  <Bar value={cov} label={`${c.title} rubric coverage`} />
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function useCountdown(minutes: number) {
  const [end, setEnd] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!end) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [end]);
  const left = end ? Math.max(0, Math.round((end - now) / 1000)) : minutes * 60;
  return { running: !!end, left, start: () => setEnd(Date.now() + minutes * 60_000), stop: () => setEnd(null) };
}

export function InfraDesignCase() {
  const { id = '' } = useParams();
  const c = designCaseById(id);
  const p = useProgress();
  const attempt = p.designPractice[id];
  const [draft, setDraft] = useState(attempt?.answer ?? '');
  const timer = useCountdown(45);
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  usePageContext({ caseId: c?.id });
  useEffect(() => setDraft(p.designPractice[id]?.answer ?? ''), [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return <div className="card">Case not found.</div>;

  const save = (patch: { answer?: string; checked?: string[] }) =>
    updateProgress((pr) => {
      const cur = pr.designPractice[c.id] ?? { at: Date.now(), checked: [], answer: '' };
      return recordActivity({ ...pr, designPractice: { ...pr.designPractice, [c.id]: { ...cur, ...patch, at: Date.now() } } });
    });
  const onDraft = (v: string) => {
    setDraft(v);
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => save({ answer: v }), 800);
  };
  const checked = new Set(attempt?.checked ?? []);
  const toggle = (key: string) => {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    save({ checked: [...next] });
  };
  const total = c.rubric.reduce((n, r) => n + r.signals.length, 0);
  const mm = String(Math.floor(timer.left / 60)).padStart(2, '0');
  const ss = String(timer.left % 60).padStart(2, '0');

  return (
    <div className="space-y-6">
      <PageHeader title={c.title} subtitle={`System design interview · ${c.difficulty} level · aim for 45 minutes`} />
      <div className="-mt-3 flex flex-wrap gap-1.5">
        {c.topics.map((t) => (
          <ObjectiveChip key={t} id={t} />
        ))}
      </div>

      <section className="card space-y-3">
        <p className="label">The interviewer says</p>
        <Md className="text-[15px]">{c.prompt}</Md>
        <div className="flex flex-wrap items-center gap-2">
          {!timer.running ? (
            <button type="button" className="btn-primary" onClick={timer.start}>
              Start 45-minute timer
            </button>
          ) : (
            <span className={`font-mono text-lg font-bold ${timer.left < 300 ? 'text-rose-600' : ''}`} role="timer">
              ⏱ {mm}:{ss}
            </span>
          )}
          <AskAI
            label="Run this as a live mock interview"
            mode="interviewer"
            question={`Run the "${c.title}" system design interview with me. State the problem as the interviewer and wait for my clarifying questions.`}
            context={{ caseId: c.id }}
          />
        </div>
      </section>

      <section className="card space-y-2">
        <label htmlFor="design-answer" className="font-semibold">
          Your design (saved on this device)
        </label>
        <p className="text-xs text-slate-500">Work through it in order: requirements, estimates, APIs and data, high-level design, deep dives, failure modes, trade-offs. Write before you open the reference sections below.</p>
        <textarea id="design-answer" className="input h-72 font-mono text-[13px]" value={draft} maxLength={6000} onChange={(e) => onDraft(e.target.value)} placeholder="Requirements:&#10;- ...&#10;Estimates:&#10;- ...&#10;High-level design:&#10;- ..." />
        <div className="flex flex-wrap items-center gap-2">
          <AskAI label="Ask the AI interviewer to grade my design" mode="interviewer" question="Here is my written design. Evaluate it against the rubric and give me scored feedback." context={{ caseId: c.id, answer: draft.slice(0, 6000) }} />
          <span className="text-xs text-slate-500">{draft.trim() ? `${draft.trim().split(/\s+/).length} words` : 'Nothing written yet'}</span>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Reference answer (open after you have tried)</h2>
        {(
          [
            ['Clarifying questions to ask', <ul key="c" className="list-disc space-y-1 pl-5 text-sm">{c.clarifyingQuestions.map((q) => <li key={q}>{q}</li>)}</ul>],
            [
              'Requirements',
              <div key="r" className="grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <p className="label mb-1">Functional</p>
                  <ul className="list-disc space-y-1 pl-5">{c.requirements.functional.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
                <div>
                  <p className="label mb-1">Non-functional</p>
                  <ul className="list-disc space-y-1 pl-5">{c.requirements.nonFunctional.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              </div>,
            ],
            ['Back-of-the-envelope estimates', <Md key="e" className="text-sm">{c.estimates}</Md>],
            ['Reference architecture', <Md key="a" className="text-sm">{c.architecture}</Md>],
            [
              'Deep dives',
              <div key="d" className="space-y-3">
                {c.deepDives.map((d) => (
                  <div key={d.title}>
                    <p className="font-medium">{d.title}</p>
                    <Md className="text-sm">{d.body}</Md>
                  </div>
                ))}
              </div>,
            ],
            [
              'Trade-offs',
              <div key="t" className="space-y-3 text-sm">
                {c.tradeoffs.map((t) => (
                  <div key={t.decision} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <p className="font-medium">{t.decision}</p>
                    <p className="text-xs text-slate-500">Options: {t.options}</p>
                    <Md className="mt-1">{t.choice}</Md>
                  </div>
                ))}
              </div>,
            ],
            [
              'Failure modes',
              <ul key="f" className="space-y-2 text-sm">
                {c.failureModes.map((f) => (
                  <li key={f.failure}>
                    <span className="font-medium text-rose-700 dark:text-rose-300">{f.failure}:</span> <Md className="inline [&>p]:inline">{f.mitigation}</Md>
                  </li>
                ))}
              </ul>,
            ],
            [
              'Follow-up questions',
              <div key="q" className="space-y-2">
                {c.followUps.map((f) => (
                  <details key={f.q} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <summary className="cursor-pointer font-medium">{f.q}</summary>
                    <Md className="mt-2 text-sm">{f.a}</Md>
                  </details>
                ))}
              </div>,
            ],
          ] as [string, React.ReactNode][]
        ).map(([title, body]) => (
          <details key={title} className="card">
            <summary className="cursor-pointer font-semibold">{title}</summary>
            <div className="mt-3">{body}</div>
          </details>
        ))}
      </section>

      <section className="card space-y-3" aria-labelledby="rubric">
        <div className="flex items-center justify-between gap-2">
          <h2 id="rubric" className="font-semibold">
            Self-grade with the interviewer's rubric
          </h2>
          <span className="text-sm font-medium">
            {checked.size}/{total} ({pct(total ? checked.size / total : 0)})
          </span>
        </div>
        <p className="text-xs text-slate-500">Tick only what your written design actually covered. At {INFRA_TARGETS.designRubricShare * 100}% or more the case counts as solid for readiness.</p>
        {c.rubric.map((r) => (
          <fieldset key={r.area}>
            <legend className="label mb-1">{r.area}</legend>
            {r.signals.map((sig) => {
              const key = `${r.area}::${sig}`;
              return (
                <label key={key} className="flex cursor-pointer items-start gap-2 py-0.5 text-sm">
                  <input type="checkbox" className="mt-1 accent-brand-600" checked={checked.has(key)} onChange={() => toggle(key)} />
                  {sig}
                </label>
              );
            })}
          </fieldset>
        ))}
        <References refs={c.references} />
      </section>
    </div>
  );
}

// ---------------- Behavioural ----------------

export function InfraBehavioral() {
  const [params, setParams] = useSearchParams();
  const p = useProgress();
  const b = behavioralPrompts.find((x) => x.id === params.get('id')) ?? behavioralPrompts[0];
  const [story, setStory] = useState(p.behavioralStories[b?.id ?? '']?.story ?? '');
  usePageContext({ behavioralId: b?.id });
  useEffect(() => setStory(p.behavioralStories[b?.id ?? '']?.story ?? ''), [b?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!b) return null;
  const words = story.trim() ? story.trim().split(/\s+/).length : 0;
  const save = (v: string) => updateProgress((pr) => recordActivity({ ...pr, behavioralStories: { ...pr.behavioralStories, [b.id]: { at: Date.now(), story: v } } }));
  return (
    <div>
      <PageHeader title="Behavioural interviews" subtitle="Senior rounds test scope, ownership, judgement and influence. Build a story bank from your own experience: one STAR story per prompt, with numbers." />
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <nav aria-label="Prompts" className="space-y-1.5">
          {behavioralPrompts.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setParams({ id: x.id })}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${x.id === b.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-ink-850'}`}
            >
              <span className="label block">{x.theme}</span>
              {x.question}
              {p.behavioralStories[x.id] && <span className="ml-1 text-emerald-600">✓</span>}
            </button>
          ))}
        </nav>
        <div className="space-y-4">
          <section className="card space-y-3">
            <h2 className="text-lg font-semibold">“{b.question}”</h2>
            <div>
              <p className="label mb-1">What the interviewer is scoring</p>
              <ul className="list-disc space-y-1 pl-5 text-sm">{b.signals.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
            <div>
              <p className="label mb-1">How to structure it</p>
              <Md className="text-sm">{b.guidance}</Md>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">Pitfalls and an example outline</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-rose-800 dark:text-rose-300">{b.pitfalls.map((x) => <li key={x}>{x}</li>)}</ul>
              <Md className="mt-2">{b.exampleOutline}</Md>
            </details>
          </section>
          <section className="card space-y-2">
            <label htmlFor="story" className="font-semibold">
              Your STAR story (saved on this device)
            </label>
            <textarea id="story" className="input h-64 text-sm" maxLength={6000} value={story} onChange={(e) => setStory(e.target.value)} onBlur={() => story.trim() && save(story)} placeholder={'Situation: …\nTask: …\nAction (what *you* did): …\nResult (with numbers): …\nLearning: …'} />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-primary" disabled={!story.trim()} onClick={() => save(story)}>
                Save story
              </button>
              <AskAI label="AI feedback on my story" mode="interviewer" question="Evaluate my STAR story for this prompt against the signals and tell me how to make it senior-level." context={{ behavioralId: b.id, answer: story.slice(0, 6000) }} />
              <AskAI label="Practise it live" mode="interviewer" question={`Ask me this behavioural question as an interviewer and probe my answer with follow-ups: "${b.question}"`} context={{ behavioralId: b.id }} />
              <span className={`text-xs ${words >= 80 ? 'text-emerald-600' : 'text-slate-500'}`}>{words} words{words < 80 ? ' (aim for 80–250)' : ''}</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------------- Mock interviews ----------------

export function InfraMock() {
  const t = useTutor();
  const p = useProgress();
  const [domain, setDomain] = useState<InfraDomainId>('networking');
  const d = INFRA_DOMAINS.find((x) => x.id === domain)!;
  const start = (question: string, context = {}) => {
    t.clear();
    t.ask(question, { mode: 'interviewer', context });
  };
  const randomStory = () => behavioralPrompts[Math.floor(Math.random() * behavioralPrompts.length)];
  return (
    <div className="space-y-6">
      <PageHeader
        title="AI mock interviews"
        subtitle="The tutor plays a senior infrastructure interviewer. It asks one question at a time, presses on your trade-offs and failure modes, then scores you against a rubric. Answer in your own words as if speaking, and press 'End interview' for feedback."
      />
      <p className="text-sm">
        Completed mock interviews: <strong>{p.mockInterviews.length}</strong> (target {INFRA_TARGETS.mockInterviews}+ before real interviews).
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <section className="card space-y-3">
          <h2 className="font-semibold">Technical deep dive</h2>
          <p className="text-sm text-slate-500">Rapid-fire depth questions on one domain, with follow-ups.</p>
          <select className="input" value={domain} onChange={(e) => setDomain(e.target.value as InfraDomainId)} aria-label="Domain">
            {INFRA_DOMAINS.filter((x) => x.id !== 'interview-craft').map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn-primary" onClick={() => start(`Run a 20-minute senior technical deep-dive interview on ${d.name} (${d.summary}). Start with your first question.`)}>
            Start deep dive
          </button>
        </section>
        <section className="card space-y-3">
          <h2 className="font-semibold">System design</h2>
          <p className="text-sm text-slate-500">A full design round on a realistic infrastructure problem.</p>
          <ul className="space-y-1 text-sm">
            {designCases.slice(0, 10).map((c) => (
              <li key={c.id}>
                <button type="button" className="text-left text-brand-700 hover:underline dark:text-brand-300" onClick={() => start(`Run the "${c.title}" system design interview with me. State the problem as the interviewer and wait for my clarifying questions.`, { caseId: c.id })}>
                  {c.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="card space-y-3">
          <h2 className="font-semibold">Behavioural</h2>
          <p className="text-sm text-slate-500">A senior behavioural question with probing follow-ups on your role, impact and judgement.</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              const b = randomStory();
              start(`Ask me this behavioural question as an interviewer and probe my answer with follow-ups: "${b.question}"`, { behavioralId: b.id });
            }}
          >
            Random behavioural question
          </button>
          <Link className="block text-sm underline" to="/infra/behavioral">
            Prepare stories first
          </Link>
        </section>
      </div>
      <section className="card text-sm text-slate-600 dark:text-slate-400">
        <p className="font-semibold text-slate-800 dark:text-slate-200">Getting the most out of AI mocks</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Answer in full sentences, the way you would speak. Say your assumptions and numbers explicitly.</li>
          <li>Push back when the interviewer is wrong. Defending a trade-off is a senior signal.</li>
          <li>The model runs on free CPU, so every answer takes about a minute. Use that time to plan your next point.</li>
          <li>AI feedback is a coach, not a judge. Calibrate it against the rubric and the reference answers.</li>
        </ul>
      </section>
    </div>
  );
}

// ---------------- Readiness ----------------

export function InfraReadinessPage() {
  const p = useProgress();
  const r = useMemo(() => computeInfraReadiness(p), [p]);
  return (
    <div className="space-y-6">
      <PageHeader title="Am I ready for senior infra interviews?" subtitle="A conservative indicator built from topic mastery, coverage, rubric-graded system designs, written stories and mock interviews. It is not a prediction of an offer." />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="card text-center">
          <p className="label">Interview readiness</p>
          <p className="mt-2 text-5xl font-bold text-slate-900 dark:text-white">{r.index}</p>
          <p className="text-sm text-slate-500">out of 100 · {STATUS_LABEL[r.status]}</p>
          <div className="mt-4 space-y-2 text-left text-sm">
            {(
              [
                ['Knowledge (importance-weighted)', r.components.knowledge, INFRA_WEIGHTS.knowledge],
                ['Topic coverage', r.components.coverage, INFRA_WEIGHTS.coverage],
                ['System design practice', r.components.design, INFRA_WEIGHTS.design],
                ['Behavioural stories', r.components.stories, INFRA_WEIGHTS.stories],
                ['Mock interviews', r.components.mocks, INFRA_WEIGHTS.mocks],
              ] as const
            ).map(([l, v, w]) => (
              <div key={l}>
                <div className="flex justify-between text-xs">
                  <span>
                    {l} · {w * 100}%
                  </span>
                  <span>{pct(v)}</span>
                </div>
                <Bar value={v} label={l} />
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2 className="font-semibold">Checklist</h2>
          <ul className="mt-3 space-y-2">
            {r.checklist.map((c) => (
              <li key={c.id} className="flex items-start gap-3 text-sm">
                <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs ${c.met ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-ink-800'}`} aria-hidden="true">
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
          <h2 className="mt-6 font-semibold">Next steps</h2>
          <ol className="mt-2 space-y-2 text-sm">
            {r.plan.map((x, i) => (
              <li key={i}>
                <a className="font-medium text-brand-700 hover:underline dark:text-brand-300" href={x.href}>
                  {x.label}
                </a>
                <span className="block text-xs text-slate-500">{x.reason}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="card">
        <h2 className="font-semibold">Domain mastery (conservative)</h2>
        <div className="mt-3 grid gap-x-8 gap-y-3 md:grid-cols-2">
          {INFRA_DOMAINS.map((d) => (
            <div key={d.id}>
              <div className="flex justify-between text-sm">
                <Link className="hover:underline" to={`/infra/practice?domain=${d.id}`}>
                  {d.name}
                </Link>
                <span className="text-xs text-slate-500">{pct(r.domains[d.id])}</span>
              </div>
              <Bar value={r.domains[d.id]} className={INFRA_DOMAIN_COLORS[d.id]} label={`${d.name} mastery`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- Resources ----------------

export function InfraResourcesPage() {
  const sorted = [...infraResources].sort((a, b) => a.sequence - b.sequence);
  return (
    <div>
      <PageHeader title="Senior infrastructure reading list" subtitle={`The references this track is built on, in suggested order. Links last checked ${INFRA_RESOURCES_VERIFIED_AT}. ${infraQuestions.length} practice questions and ${designCases.length} design cases cite them.`} />
      <ol className="space-y-3">
        {sorted.map((r) => (
          <li key={r.url} className="card flex gap-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-800 dark:bg-violet-500/20 dark:text-violet-200">{r.sequence}</span>
            <div className="min-w-0">
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
                {r.title} ↗
              </a>
              <p className="text-sm text-slate-500">
                {r.provider} · {r.topic}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="chip">{r.cost === 'free' ? 'Free' : r.cost === 'free-audit' ? 'Free to audit' : 'Free tier'}</span>
                <span className="chip">{r.difficulty}</span>
                {r.objectives.slice(0, 3).map((o) => (
                  <ObjectiveChip key={o} id={o} />
                ))}
              </div>
              {r.note && <p className="mt-1 text-xs text-slate-500">{r.note}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
