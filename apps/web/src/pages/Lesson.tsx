import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { comparisons, knowledgeCheckFor, lessonById, lessons, type ObjectiveId } from '@kcna/content';
import { addAttempts, lessonMastered, recordActivity } from '@kcna/engine';
import { updateProgress, useProgress } from '../lib/store';
import { usePageContext } from '../lib/tutorContext';
import { PageHeader } from '../components/Layout';
import { Md } from '../components/Md';
import { CodeBlock } from '../components/CodeBlock';
import { QuestionCard } from '../components/QuestionCard';
import { AskAI } from '../components/TutorPanel';
import { LessonDiagram } from '../components/diagrams';
import { ObjectiveChip, References, ScopeBadge, useHashQuery } from '../components/ui';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={`s-${id}`} className="scroll-mt-20" aria-labelledby={`h-${id}`}>
      <h2 id={`h-${id}`} className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function LessonPage() {
  const { id = '' } = useParams();
  const lesson = lessonById(id);
  const p = useProgress();
  const q = useHashQuery();
  usePageContext({ lessonId: lesson?.id });
  const checks = useMemo(() => (lesson ? knowledgeCheckFor(lesson.id) : []), [lesson]);
  const idx = lessons.findIndex((l) => l.id === id);
  const prev = lessons[idx - 1];
  const next = lessons[idx + 1];
  const section = q.get('s');
  useEffect(() => {
    if (section) setTimeout(() => document.getElementById(`s-${section}`)?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [section, id]);

  if (!lesson)
    return (
      <div className="card">
        Lesson not found. <Link to="/path" className="underline">Back to the learning path</Link>
      </div>
    );
  const done = !!p.lessonsCompleted[lesson.id];
  const related = comparisons.filter((c) => c.lessonId === lesson.id);
  return (
    <article className="grid gap-8 xl:grid-cols-[1fr_220px]">
      <div className="min-w-0 space-y-8">
        <div>
          <p className="label mb-1">
            <Link to="/path" className="hover:underline">
              Stage {lesson.stage}
            </Link>{' '}
            · {lesson.estMinutes} min
          </p>
          <PageHeader title={lesson.title} subtitle={lesson.summary} />
          <div className="-mt-3 flex flex-wrap items-center gap-2">
            <ScopeBadge scope={lesson.scope} />
            {lesson.objectives.map((o: ObjectiveId) => (
              <ObjectiveChip key={o} id={o} />
            ))}
            <AskAI question={`Explain "${lesson.title}" to me.`} context={{ lessonId: lesson.id }} />
          </div>
        </div>

        <Section id="what" title="What it is">
          <Md>{lesson.what}</Md>
        </Section>
        <Section id="why" title="Why it exists">
          <Md>{lesson.why}</Md>
        </Section>
        <Section id="problem" title="The problem it solves">
          <Md>{lesson.problem}</Md>
        </Section>
        <Section id="how" title="How it works">
          <Md>{lesson.how}</Md>
        </Section>
        {lesson.diagram && (
          <Section id="diagram" title="Visualize it">
            <LessonDiagram id={lesson.diagram} />
            <div className="mt-3">
              <AskAI label="Ask AI about this diagram" question={`Walk me through the "${lesson.title}" diagram step by step.`} context={{ lessonId: lesson.id, page: `diagram:${lesson.diagram}` }} />
            </div>
          </Section>
        )}
        <Section id="components" title="Important components">
          <dl className="grid gap-3 sm:grid-cols-2">
            {lesson.components.map((c) => (
              <div key={c.name} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <dt className="font-semibold">{c.name}</dt>
                <dd className="text-sm">
                  <Md>{c.description}</Md>
                </dd>
              </div>
            ))}
          </dl>
        </Section>
        <Section id="misconceptions" title="Common misconceptions">
          <ul className="space-y-3">
            {lesson.misconceptions.map((m) => (
              <li key={m.myth} className="rounded-lg border-l-4 border-amber-400 bg-amber-50/60 p-3 dark:bg-amber-500/5">
                <p className="text-sm font-medium">
                  <span className="text-rose-700 dark:text-rose-400">Myth:</span> {m.myth}
                </p>
                <div className="mt-1 text-sm">
                  <span className="font-medium text-emerald-800 dark:text-emerald-400">Reality: </span>
                  <Md className="inline [&>p]:inline">{m.reality}</Md>
                </div>
              </li>
            ))}
          </ul>
        </Section>
        <Section id="example" title={`Example: ${lesson.example.title}`}>
          <Md>{lesson.example.description}</Md>
          {lesson.example.code && <CodeBlock code={lesson.example.code} language={lesson.example.language} />}
          {lesson.example.code && lesson.example.language === 'yaml' && (
            <AskAI label="Ask AI to explain this YAML" mode="yaml-review" question="Explain this manifest field by field." context={{ lessonId: lesson.id, yaml: lesson.example.code }} />
          )}
        </Section>
        <Section id="exercise" title="Try it">
          <Md>{lesson.exercise.prompt}</Md>
          <details className="mt-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <summary className="cursor-pointer text-sm font-medium">Show solution</summary>
            <Md className="mt-2 text-sm">{lesson.exercise.solution}</Md>
          </details>
        </Section>
        {lesson.deeper && (
          <Section id="deeper" title="Beyond the exam (optional)">
            <div className="rounded-lg border border-dashed border-amber-300 p-3 text-sm dark:border-amber-500/40">
              <Md>{lesson.deeper}</Md>
            </div>
          </Section>
        )}
        <Section id="check" title="Knowledge check">
          <p className={`mb-3 text-sm ${lessonMastered(p, lesson.id) ? 'font-medium text-emerald-700 dark:text-emerald-300' : 'text-slate-500'}`}>
            {lessonMastered(p, lesson.id)
              ? '★ Mastered — your latest answer to every question below is correct.'
              : 'Answer every question correctly to master this lesson. Missed questions come back in Smart review.'}
          </p>
          {checks.length ? (
            <div className="space-y-4">
              {checks.map((c, i) => (
                <QuestionCard
                  key={c.id}
                  q={c}
                  index={i}
                  total={checks.length}
                  showLesson={false}
                  onAnswered={(ok, sel) => updateProgress((pr) => addAttempts(pr, [{ qid: c.id, objective: c.objective, correct: ok, at: Date.now(), source: 'quiz', selected: sel }]))}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No knowledge-check questions for this lesson yet.</p>
          )}
        </Section>
        <Section id="faq" title="Learner questions">
          <div className="space-y-2">
            {lesson.faq.map((f) => (
              <details key={f.q} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <summary className="cursor-pointer font-medium">{f.q}</summary>
                <Md className="mt-2 text-sm">{f.a}</Md>
              </details>
            ))}
          </div>
        </Section>
        {related.length > 0 && (
          <Section id="compare" title="Commonly confused">
            <div className="flex flex-wrap gap-2">
              {related.map((c) => (
                <Link key={c.id} className="btn-ghost" to={`/compare?id=${c.id}`}>
                  {[c.a, c.b, c.c].filter(Boolean).join(' vs ')}
                </Link>
              ))}
            </div>
          </Section>
        )}
        <Section id="refs" title="Official references">
          <References refs={lesson.references} />
        </Section>

        <div className="card flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className={done ? 'btn-ghost' : 'btn-primary'}
            onClick={() =>
              updateProgress((pr) => {
                const lc = { ...pr.lessonsCompleted };
                if (done) delete lc[lesson.id];
                else lc[lesson.id] = Date.now();
                return recordActivity({ ...pr, lessonsCompleted: lc });
              })
            }
          >
            {done ? '✓ Completed — mark as not done' : 'Mark lesson complete'}
          </button>
          <div className="flex gap-2">
            {prev && (
              <Link className="btn-ghost" to={`/lessons/${prev.id}`}>
                ← {prev.title}
              </Link>
            )}
            {next && (
              <Link className="btn-ghost" to={`/lessons/${next.id}`}>
                {next.title} →
              </Link>
            )}
          </div>
        </div>
      </div>
      <nav aria-label="On this page" className="hidden xl:block">
        <div className="sticky top-20 space-y-1 text-sm">
          <p className="label mb-2">On this page</p>
          {[
            ['what', 'What it is'],
            ['why', 'Why it exists'],
            ['how', 'How it works'],
            ...(lesson.diagram ? [['diagram', 'Diagram']] : []),
            ['components', 'Components'],
            ['misconceptions', 'Misconceptions'],
            ['example', 'Example'],
            ['exercise', 'Exercise'],
            ['check', 'Knowledge check'],
            ['faq', 'FAQ'],
            ['refs', 'References'],
          ].map(([sid, label]) => (
            <a key={sid} href={`#s-${sid}`} onClick={(e) => (e.preventDefault(), document.getElementById(`s-${sid}`)?.scrollIntoView({ behavior: 'smooth' }))} className="block text-slate-500 hover:text-slate-900 dark:hover:text-white">
              {label}
            </a>
          ))}
        </div>
      </nav>
    </article>
  );
}
