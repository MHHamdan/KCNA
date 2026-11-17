import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { contentIndex, TUTOR_MODES, type TutorMode } from '@kcna/engine';
import { anyLessonById, anyQuestionById as questionById } from '@kcna/content';
import { useTutor, type TutorMessage } from '../lib/tutorContext';
import { updateProgress, useProgress } from '../lib/store';
import { Md, MdInline } from './Md';

const MdInlineSafe = ({ text }: { text: string }) => <MdInline>{text}</MdInline>;
import { Icon } from './Icon';

export const MODE_INFO: Record<TutorMode, { label: string; hint: string }> = {
  explain: { label: 'Explain', hint: 'Clear explanation with an example' },
  socratic: { label: 'Socratic', hint: 'Guides you with questions instead of answers' },
  'exam-coach': { label: 'Exam coach', hint: 'KCNA scope, traps and why options are wrong' },
  troubleshoot: { label: 'Troubleshoot', hint: 'Symptom → hypothesis → evidence → fix' },
  'yaml-review': { label: 'YAML review', hint: 'Paste a manifest for a validated review' },
  revision: { label: 'Revision', hint: 'Uses your progress to drill weak topics' },
  interviewer: { label: 'Mock interviewer', hint: 'Senior infra interviewer: one question at a time, then scored feedback' },
};

const FOLLOW_UPS: Record<TutorMode, string[]> = {
  explain: ['Explain it more simply', 'Go deeper technically', 'Give me a real-world example', 'Quiz me on this'],
  socratic: ['Give me a hint', "I think I've got it — check my reasoning", 'Reveal the answer'],
  'exam-coach': ['What is the exam trap here?', 'Which similar concepts get confused?', 'Give me a practice question'],
  troubleshoot: ['What command should I run next?', 'What does this evidence tell us?', 'Show me the fix'],
  'yaml-review': ['What would happen if I applied this?', 'How do I make it more secure?', 'Explain the selector'],
  revision: ['Why are these topics recommended?', 'Start a 5-minute drill', 'Make me a 7-day plan'],
  interviewer: ['Can you rephrase the question?', 'Give me a harder follow-up', 'End interview — give me feedback'],
};

function StatusPill() {
  const { availability, refreshAvailability } = useTutor();
  const s = availability.state;
  const map: Record<string, [string, string]> = {
    checking: ['Checking…', 'bg-slate-400'],
    ready: ['AI online', 'bg-emerald-500'],
    loading: ['Model starting', 'bg-amber-500'],
    unavailable: ['AI offline', 'bg-rose-500'],
    disabled: ['AI disabled', 'bg-slate-500'],
    'quota-exhausted': ['Quota used up', 'bg-rose-500'],
  };
  const [label, dot] = map[s];
  return (
    <button type="button" onClick={refreshAvailability} className="chip" title={'model' in availability && availability.model ? `Model: ${availability.model}` : 'Re-check tutor status'}>
      <span className={`size-2 rounded-full ${dot}`} />
      {label}
    </button>
  );
}

function Fallback({ question }: { question: string }) {
  const hits = useMemo(() => contentIndex().search(question, { limit: 4 }), [question]);
  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-ink-850">
      <p className="mb-1.5 font-medium">From the built-in knowledge base (no AI):</p>
      {hits.length ? (
        <ul className="space-y-1.5">
          {hits.map((h) => (
            <li key={h.doc.id}>
              <a className="font-medium text-brand-700 underline dark:text-brand-300" href={h.doc.href}>
                {h.doc.title}
              </a>
              <p className="line-clamp-2 text-xs text-slate-500">{h.doc.text.replace(/[`*]/g, '').slice(0, 180)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-500">No matching lesson content. Try the glossary or search.</p>
      )}
    </div>
  );
}

function Bubble({ m, last }: { m: TutorMessage; last: boolean }) {
  const { streaming } = useTutor();
  if (m.role === 'user')
    return (
      <div className="ml-8 rounded-xl rounded-br-sm bg-brand-600 px-3 py-2 text-sm whitespace-pre-wrap text-white dark:bg-brand-700">{m.content}</div>
    );
  return (
    <div className="mr-4 text-sm">
      {m.content ? <Md>{m.content}</Md> : !m.error && last && streaming ? <TypingDots /> : null}
      {m.error && (
        <div role="alert">
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            <strong>AI tutor unavailable:</strong> {m.error.message}
          </p>
          <Fallback question={m.error.question} />
        </div>
      )}
      {m.notes && m.notes.length > 0 && (
        <div className="mt-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs dark:border-emerald-500/40 dark:bg-emerald-500/10" data-testid="fact-notes">
          <p className="font-semibold text-emerald-900 dark:text-emerald-200">Verified correction (from the course content)</p>
          <ul className="mt-1 space-y-1">
            {m.notes.map((n) => (
              <li key={n.id}>
                <MdInlineSafe text={n.correction} />{' '}
                <a className="underline" href={`#/lessons/${n.lessonId}`}>
                  Lesson
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {m.sources && m.sources.length > 0 && m.content && (
        <details className="mt-2 text-xs text-slate-500">
          <summary className="cursor-pointer select-none">Sources used ({m.sources.length})</summary>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            {m.sources.map((s, i) => (
              <li key={i}>
                <a href={s.href} {...(s.url ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="underline">
                  {s.title}
                </a>
                {s.url && <span className="ml-1">↗</span>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-2" aria-label="Tutor is thinking">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </span>
  );
}

export function TutorConversation({ compact = false }: { compact?: boolean }) {
  const t = useTutor();
  const endInterview = () => {
    t.ask('End interview — give me feedback.', { mode: 'interviewer' });
    updateProgress((p) => ({ ...p, mockInterviews: [...p.mockInterviews, Date.now()].slice(-200) }));
  };
  const prefs = useProgress().prefs;
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  // braces matter: scrollIntoView returns a Promise in recent browsers, which must not leak as an effect cleanup
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [t.messages]);
  const ctx = t.pageContext;
  const ctxLabel = ctx.caseId
    ? `System design: ${ctx.caseId}`
    : ctx.behavioralId
      ? `Behavioural: ${ctx.behavioralId}`
      : ctx.questionId
    ? `Question ${ctx.questionId}`
    : ctx.lessonId
      ? `Lesson: ${anyLessonById(ctx.lessonId)?.title}`
      : ctx.page
        ? `Viewing: ${ctx.page.replace(':', ' — ')}`
        : null;
  const send = () => {
    if (!input.trim()) return;
    t.ask(input);
    setInput('');
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-slate-200 px-4 pb-3 dark:border-slate-800">
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Tutor mode">
          {TUTOR_MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={t.mode === m}
              title={MODE_INFO[m].hint}
              onClick={() => t.setMode(m)}
              className={`rounded-md px-2 py-1 text-xs font-medium ${t.mode === m ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-ink-800 dark:text-slate-300'}`}
            >
              {MODE_INFO[m].label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
          <span>{MODE_INFO[t.mode].hint}</span>
          <label className="flex items-center gap-1.5">
            Level
            <select
              className="rounded border border-slate-300 bg-transparent px-1 py-0.5 dark:border-slate-700"
              value={prefs.tutorLevel}
              onChange={(e) => updateProgress((p) => ({ ...p, prefs: { ...p.prefs, tutorLevel: e.target.value as 'beginner' | 'technical' } }))}
            >
              <option value="beginner">Beginner</option>
              <option value="technical">Technical</option>
            </select>
          </label>
        </div>
        {ctxLabel && (
          <div className="flex items-center gap-2 text-xs">
            <span className="chip border-violet-300 text-violet-700 dark:border-violet-500/40 dark:text-violet-300">Context · {ctxLabel}</span>
          </div>
        )}
        {t.availability.state !== 'ready' && t.availability.state !== 'checking' && (
          <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            {t.availability.state === 'loading'
              ? 'The tutor model is starting (cold start can take a minute or two). You can still browse; questions will work once it is ready.'
              : ('message' in t.availability && t.availability.message) || 'The AI tutor is not available right now. You will get answers from the built-in knowledge base instead.'}
          </p>
        )}
      </div>
      <div className={`flex-1 space-y-4 overflow-y-auto px-4 py-4 ${compact ? '' : ''}`} aria-live="polite">
        {t.messages.length === 0 && (
          <div className="space-y-3 text-sm text-slate-500">
            <p>Ask anything about Kubernetes or the KCNA exam. Follow-up questions keep the conversation context.</p>
            <div className="flex flex-wrap gap-1.5">
              {['What is a Pod?', 'Why do we need a Deployment?', 'Service vs Ingress?', 'How does the scheduler pick a node?'].map((q) => (
                <button key={q} type="button" className="chip hover:bg-slate-100 dark:hover:bg-ink-800" onClick={() => t.ask(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {t.messages.map((m, i) => (
          <Bubble key={i} m={m} last={i === t.messages.length - 1} />
        ))}
        {t.messages.length > 0 && !t.streaming && !t.messages[t.messages.length - 1].error && (
          <div className="flex flex-wrap gap-1.5">
            {FOLLOW_UPS[t.mode].map((q) => (
              <button key={q} type="button" className="chip hover:bg-slate-100 dark:hover:bg-ink-800" onClick={() => (q.startsWith('End interview') ? endInterview() : t.ask(q))}>
                {q}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-end gap-2">
          <label htmlFor="tutor-input" className="sr-only">
            Ask the tutor
          </label>
          <textarea
            id="tutor-input"
            className="input max-h-40 min-h-[2.5rem] resize-y"
            rows={2}
            maxLength={2000}
            placeholder={t.mode === 'yaml-review' ? 'Paste a manifest or ask about one…' : 'Ask a question… (Enter to send)'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (t.mode === 'yaml-review' && /^\s*(apiVersion|kind):/m.test(input)) {
                  t.ask('Review this manifest.', { context: { yaml: input } });
                  setInput('');
                } else send();
              }
            }}
          />
          {t.streaming ? (
            <button type="button" className="btn-ghost" onClick={t.stop}>
              Stop
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              disabled={!input.trim()}
              onClick={() => {
                if (t.mode === 'yaml-review' && /^\s*(apiVersion|kind):/m.test(input)) {
                  t.ask('Review this manifest.', { context: { yaml: input } });
                  setInput('');
                } else send();
              }}
            >
              Send
            </button>
          )}
        </div>
        {t.mode === 'interviewer' && t.messages.length > 1 && !t.streaming && (
          <button type="button" className="btn-ai mt-2 w-full" onClick={endInterview}>
            End interview &amp; get scored feedback
          </button>
        )}
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
          <span>AI can be wrong — check the cited sources.</span>
          <button type="button" className="underline" onClick={t.clear}>
            Clear conversation
          </button>
        </div>
      </div>
    </div>
  );
}

export function TutorDrawer() {
  const t = useTutor();
  const onTutorPage = useLocation().pathname === '/tutor';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && t.open) t.setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [t]);
  if (!t.open || onTutorPage) return null;
  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl sm:w-[440px] dark:border-slate-800 dark:bg-ink-900"
      aria-label="AI tutor"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon name="spark" className="size-5 text-violet-500" />
          <h2 className="font-semibold">AI Tutor</h2>
          <StatusPill />
        </div>
        <div className="flex items-center gap-1">
          <Link to="/tutor" className="rounded p-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-ink-800" onClick={() => t.setOpen(false)}>
            Full page
          </Link>
          <button type="button" className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-ink-800" onClick={() => t.setOpen(false)} aria-label="Close tutor">
            <Icon name="x" className="size-5" />
          </button>
        </div>
      </div>
      <TutorConversation />
    </aside>
  );
}

export { StatusPill };

/** Contextual entry point used throughout the app. */
export function AskAI({
  label = 'Ask AI about this',
  question,
  context,
  mode,
  className = '',
}: {
  label?: string;
  question: string;
  context?: import('@kcna/engine').TutorContext;
  mode?: TutorMode;
  className?: string;
}) {
  const t = useTutor();
  return (
    <button type="button" className={`btn-ai ${className}`} onClick={() => t.ask(question, { context, mode })} disabled={t.streaming}>
      <Icon name="spark" className="size-4" />
      {label}
    </button>
  );
}

export function explainWrongPrompt(qid: string, selected: number[]) {
  const q = questionById(qid);
  const pick = selected.map((i) => String.fromCharCode(65 + i)).join(', ') || 'nothing';
  return `I answered ${pick} on this practice question${q ? ` about ${q.tags[0] ?? 'Kubernetes'}` : ''}. Explain why my answer was wrong and what I should remember.`;
}
