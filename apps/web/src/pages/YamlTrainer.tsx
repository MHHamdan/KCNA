import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { yamlChallenges } from '@kcna/content';
import { checkYamlChallenge, recordActivity, type ChallengeResult } from '@kcna/engine';
import { updateProgress, useProgress } from '../lib/store';
import { usePageContext } from '../lib/tutorContext';
import { PageHeader } from '../components/Layout';
import { Md } from '../components/Md';
import { CodeBlock } from '../components/CodeBlock';
import { AskAI } from '../components/TutorPanel';
import { ObjectiveChip } from '../components/ui';

export function YamlPage() {
  const [params, setParams] = useSearchParams();
  const p = useProgress();
  const ch = yamlChallenges.find((c) => c.id === params.get('id')) ?? yamlChallenges[0];
  const [text, setText] = useState(ch.starter);
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  usePageContext({ lessonId: ch.lessonId, page: `yaml:${ch.id}` });
  useEffect(() => {
    setText(ch.starter);
    setResult(null);
    setShowSolution(false);
  }, [ch.id, ch.starter]);

  const check = () => {
    const r = checkYamlChallenge(text, ch.checks);
    setResult(r);
    if (r.passed) updateProgress((pr) => recordActivity({ ...pr, practiceCompleted: { ...pr.practiceCompleted, [ch.id]: Date.now() } }));
  };

  return (
    <div>
      <PageHeader title="YAML trainer" subtitle="Fix and complete real-looking manifests. Your YAML is parsed and checked deterministically in the browser — nothing is sent to a cluster." />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {yamlChallenges.map((c) => (
          <button key={c.id} type="button" onClick={() => setParams({ id: c.id })} className={`chip px-3 py-1 ${c.id === ch.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-slate-100 dark:hover:bg-ink-800'}`}>
            {p.practiceCompleted[c.id] && '✓ '}
            {c.title}
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{ch.title}</h2>
            <span className="chip">{ch.kind === 'fix' ? 'Fix the bug' : 'Complete it'}</span>
            <ObjectiveChip id={ch.objective} />
          </div>
          <Md className="mt-2 text-sm">{ch.instructions}</Md>
          <label htmlFor="yaml-editor" className="label mt-3 block">
            Manifest
          </label>
          <textarea
            id="yaml-editor"
            className="mt-1 h-80 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-[12.5px] leading-relaxed dark:border-slate-700 dark:bg-ink-950"
            spellCheck={false}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                const t = e.currentTarget;
                const s = t.selectionStart;
                setText(text.slice(0, s) + '  ' + text.slice(t.selectionEnd));
                requestAnimationFrame(() => (t.selectionStart = t.selectionEnd = s + 2));
              }
            }}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={check}>
              Validate
            </button>
            <button type="button" className="btn-ghost" onClick={() => (setText(ch.starter), setResult(null))}>
              Reset
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowSolution(!showSolution)}>
              {showSolution ? 'Hide' : 'Show'} solution
            </button>
          </div>
        </div>
        <div className="space-y-4">
          <div className="card" aria-live="polite">
            <h2 className="font-semibold">Results</h2>
            {!result && <p className="mt-2 text-sm text-slate-500">Edit the manifest and press Validate.</p>}
            {result && !result.parsed && <p className="mt-2 text-sm text-rose-600">{result.parseError}</p>}
            {result?.parsed && (
              <>
                <p className={`mt-2 font-semibold ${result.passed ? 'text-emerald-600' : 'text-rose-600'}`}>{result.passed ? '✓ All checks pass' : 'Some checks fail'}</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {result.results.map((r, i) => (
                    <li key={i} className={r.passed ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}>
                      {r.passed ? '✓' : '✗'} {r.message}
                    </li>
                  ))}
                </ul>
                {result.findings.length > 0 && (
                  <>
                    <p className="label mt-3">Validator findings</p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {result.findings.map((f, i) => (
                        <li key={i}>
                          <span className={`chip mr-1 ${f.level === 'error' ? 'border-rose-400 text-rose-600' : f.level === 'warning' ? 'border-amber-400 text-amber-600' : ''}`}>{f.level}</span>
                          {f.message}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {result.passed && <Md className="mt-3 text-sm">{ch.explanation}</Md>}
              </>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <AskAI label="AI review of my YAML" mode="yaml-review" question="Review my manifest for this challenge. Point me to the problem without rewriting the whole thing." context={{ lessonId: ch.lessonId, page: `yaml:${ch.id}`, yaml: text.slice(0, 6000) }} />
              <Link to={`/lessons/${ch.lessonId}`} className="btn-ghost">
                Related lesson
              </Link>
            </div>
          </div>
          {showSolution && (
            <div className="card">
              <h2 className="font-semibold">Reference solution</h2>
              <CodeBlock code={ch.solution} language="yaml" />
              <Md className="text-sm">{ch.explanation}</Md>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
