import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { terminalChallenges } from '@kcna/content';
import { evaluateCommand, recordActivity } from '@kcna/engine';
import { updateProgress, useProgress } from '../lib/store';
import { usePageContext } from '../lib/tutorContext';
import { PageHeader } from '../components/Layout';
import { Md } from '../components/Md';
import { AskAI } from '../components/TutorPanel';
import { ObjectiveChip } from '../components/ui';

interface Line {
  kind: 'cmd' | 'out' | 'ok' | 'err' | 'info';
  text: string;
}

export function TerminalPage() {
  const [params, setParams] = useSearchParams();
  const p = useProgress();
  const id = params.get('id') ?? terminalChallenges[0].id;
  const ch = terminalChallenges.find((c) => c.id === id) ?? terminalChallenges[0];
  const [step, setStep] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState('');
  const [hint, setHint] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  usePageContext({ lessonId: ch.lessonId, page: `terminal:${ch.id}` });

  const reset = () => {
    setStep(0);
    setHint(false);
    setLines([{ kind: 'info', text: `Simulated cluster — commands are checked, not executed. Type "hint" for help or "clear".` }]);
  };
  useEffect(reset, [ch.id]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [lines]);

  const done = step >= ch.steps.length;
  const cur = ch.steps[Math.min(step, ch.steps.length - 1)];

  const run = () => {
    const cmd = input.trim();
    if (!cmd) return;
    setHistory((h) => [...h, cmd]);
    setHIdx(-1);
    setInput('');
    if (cmd === 'clear') return setLines([]);
    if (cmd === 'hint') {
      setHint(true);
      return setLines((l) => [...l, { kind: 'cmd', text: cmd }, { kind: 'info', text: `Hint: ${cur.hint}` }]);
    }
    if (done) return setLines((l) => [...l, { kind: 'cmd', text: cmd }, { kind: 'info', text: 'Challenge complete — pick another one.' }]);
    const fb = evaluateCommand(cmd, cur.expect);
    if (fb.status === 'correct') {
      const next = step + 1;
      setLines((l) => [...l, { kind: 'cmd', text: cmd }, { kind: 'out', text: cur.output }, { kind: 'ok', text: `✓ Step ${step + 1} complete` }]);
      setStep(next);
      setHint(false);
      if (next >= ch.steps.length) updateProgress((pr) => recordActivity({ ...pr, practiceCompleted: { ...pr.practiceCompleted, [ch.id]: Date.now() } }));
    } else {
      setLines((l) => [...l, { kind: 'cmd', text: cmd }, { kind: 'err', text: fb.message }]);
    }
  };

  return (
    <div>
      <PageHeader title="Terminal trainer" subtitle="Practise kubectl in a simulated terminal. Reasonable variations are accepted (aliases like po/svc/deploy, -n or --namespace, flag order). This is a simulation, not a live cluster." />
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <nav aria-label="Challenges" className="space-y-1.5">
          {terminalChallenges.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setParams({ id: c.id })}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${c.id === ch.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-ink-850'}`}
            >
              <span>{c.title}</span>
              {p.practiceCompleted[c.id] && <span className="text-emerald-600">✓</span>}
            </button>
          ))}
        </nav>
        <div className="space-y-4">
          <div className="card">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{ch.title}</h2>
              <ObjectiveChip id={ch.objective} />
            </div>
            <Md className="mt-2 text-sm">{ch.scenario}</Md>
            <div className="mt-3 rounded-lg border-l-4 border-brand-500 bg-brand-50 p-3 text-sm dark:bg-brand-500/10">
              {done ? (
                <p className="font-semibold text-emerald-700 dark:text-emerald-300">All {ch.steps.length} steps complete.</p>
              ) : (
                <>
                  <p className="label mb-1">
                    Step {step + 1} of {ch.steps.length}
                  </p>
                  <Md>{cur.task}</Md>
                  {hint && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Hint: {cur.hint}</p>}
                </>
              )}
            </div>
            {step > 0 && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-slate-500">Why the previous step matters</summary>
                <Md className="mt-1">{ch.steps[step - 1].explanation}</Md>
              </details>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#0b1017] font-mono text-[13px] text-slate-200 shadow-inner" onClick={() => inputRef.current?.focus()}>
            <div className="flex items-center gap-1.5 border-b border-slate-800 px-3 py-2">
              <span className="size-2.5 rounded-full bg-rose-500" />
              <span className="size-2.5 rounded-full bg-amber-400" />
              <span className="size-2.5 rounded-full bg-emerald-500" />
              <span className="ml-2 text-xs text-slate-400">kcna-sim — simulated cluster</span>
            </div>
            <div className="max-h-[420px] min-h-[260px] overflow-y-auto p-3" role="log" aria-live="polite">
              {lines.map((l, i) => (
                <pre key={i} className={`whitespace-pre-wrap ${l.kind === 'cmd' ? 'text-sky-300' : l.kind === 'ok' ? 'text-emerald-400' : l.kind === 'err' ? 'text-rose-400' : l.kind === 'info' ? 'text-slate-400' : 'text-slate-200'}`}>
                  {l.kind === 'cmd' ? `$ ${l.text}` : l.text}
                </pre>
              ))}
              <div className="flex items-center gap-2" ref={endRef}>
                <span className="text-emerald-400">$</span>
                <label htmlFor="term-input" className="sr-only">
                  Command
                </label>
                <input
                  id="term-input"
                  ref={inputRef}
                  className="flex-1 bg-transparent text-slate-100 outline-none"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') run();
                    if (e.key === 'ArrowUp' && history.length) {
                      e.preventDefault();
                      const i = hIdx < 0 ? history.length - 1 : Math.max(0, hIdx - 1);
                      setHIdx(i);
                      setInput(history[i]);
                    }
                  }}
                  placeholder="kubectl …"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => setHint(true)}>
              Show hint
            </button>
            <button type="button" className="btn-ghost" onClick={reset}>
              Restart
            </button>
            <AskAI
              question={done ? 'Summarise what this terminal challenge taught me and how it maps to the exam.' : `I'm stuck on this step: "${cur.task.slice(0, 200)}". Help me figure out the right kubectl command without just giving it away.`}
              mode="socratic"
              context={{ lessonId: ch.lessonId, page: `terminal:${ch.id}` }}
            />
            <Link to={`/lessons/${ch.lessonId}`} className="btn-ghost">
              Related lesson
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
