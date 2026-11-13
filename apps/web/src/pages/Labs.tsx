import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { labs } from '@kcna/content';
import { recordActivity } from '@kcna/engine';
import { updateProgress, useProgress } from '../lib/store';
import { usePageContext } from '../lib/tutorContext';
import { PageHeader } from '../components/Layout';
import { Md } from '../components/Md';
import { CodeBlock } from '../components/CodeBlock';
import { AskAI } from '../components/TutorPanel';
import { ObjectiveChip, References, ScopeBadge } from '../components/ui';

export function LabsPage() {
  const p = useProgress();
  return (
    <div>
      <PageHeader
        title="Kubernetes labs"
        subtitle="Hands-on labs for a real local cluster using kind or minikube (free). These run on your machine — the browser simulators elsewhere in the app are separate and do not touch a cluster."
      />
      <div className="card mb-6 text-sm">
        <p className="font-semibold">Set up once</p>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Install Docker (or Podman), <a className="underline" href="https://kubernetes.io/docs/tasks/tools/" target="_blank" rel="noopener noreferrer">kubectl</a> and <a className="underline" href="https://kind.sigs.k8s.io/docs/user/quick-start/" target="_blank" rel="noopener noreferrer">kind</a>. No cloud account or payment is required. Prefer a browser? <a className="underline" href="https://killercoda.com/playgrounds" target="_blank" rel="noopener noreferrer">Killercoda playgrounds</a> offer free time-limited clusters (terms may change).
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {labs.map((l) => (
          <Link key={l.id} to={`/labs/${l.id}`} className="card block hover:border-brand-400">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{l.title}</p>
              {p.labsCompleted[l.id] ? <span className="text-emerald-600">✓</span> : <span className={`chip ${l.status === 'full' ? 'border-emerald-400 text-emerald-700 dark:text-emerald-300' : ''}`}>{l.status === 'full' ? 'Full walkthrough' : 'Design outline'}</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <ScopeBadge scope={l.scope} />
              <span className="chip">{l.environment}</span>
              <span className="chip">{l.estMinutes} min</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function LabPage() {
  const { id = '' } = useParams();
  const lab = labs.find((l) => l.id === id);
  const p = useProgress();
  const [err, setErr] = useState('');
  usePageContext({ page: `lab:${id}` });
  if (!lab) return <div className="card">Lab not found.</div>;
  const done = !!p.labsCompleted[lab.id];
  return (
    <div className="space-y-6">
      <PageHeader title={lab.title} subtitle={lab.status === 'design' ? 'Design outline — the steps are complete enough to follow, but this lab has not yet been expanded with full expected output.' : `Full walkthrough · ~${lab.estMinutes} minutes · runs on ${lab.environment}`} />
      <div className="-mt-3 flex flex-wrap gap-2">
        <ScopeBadge scope={lab.scope} />
        {lab.objectives.map((o) => (
          <ObjectiveChip key={o} id={o} />
        ))}
      </div>
      <section className="card space-y-3">
        <h2 className="font-semibold">Objective</h2>
        <Md className="text-sm">{lab.objective}</Md>
        <h3 className="label">Prerequisites</h3>
        <ul className="list-disc pl-5 text-sm">
          {lab.prerequisites.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <h3 className="label">Architecture</h3>
        <Md className="text-sm">{lab.architecture}</Md>
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Tasks</h2>
        {lab.tasks.map((t, i) => (
          <div key={i} className="card">
            <h3 className="font-semibold">
              {i + 1}. {t.title}
            </h3>
            <Md className="mt-1 text-sm">{t.instructions}</Md>
            {t.commands.length > 0 && <CodeBlock code={t.commands.join('\n')} language="bash" />}
            {t.expected && <CodeBlock code={t.expected} language="text" title="Expected output (approximate)" />}
            {t.hint && (
              <details className="text-sm">
                <summary className="cursor-pointer text-slate-500">Hint</summary>
                <Md className="mt-1">{t.hint}</Md>
              </details>
            )}
          </div>
        ))}
      </section>
      <section className="card space-y-3">
        <h2 className="font-semibold">Validate</h2>
        {lab.validation.map((v, i) => (
          <div key={i}>
            <p className="text-sm">{v.description}</p>
            <CodeBlock code={`$ ${v.command}\n${v.expected}`} language="text" />
          </div>
        ))}
      </section>
      <section className="card space-y-3">
        <h2 className="font-semibold">Troubleshooting</h2>
        <dl className="space-y-2 text-sm">
          {lab.troubleshooting.map((t) => (
            <div key={t.symptom}>
              <dt className="font-medium">{t.symptom}</dt>
              <dd>
                <Md>{t.fix}</Md>
              </dd>
            </div>
          ))}
        </dl>
        <div className="rounded-lg border border-violet-200 p-3 dark:border-violet-500/30">
          <label htmlFor="lab-error" className="text-sm font-medium">
            Stuck? Paste the error or command output and ask the tutor to diagnose it.
          </label>
          <textarea id="lab-error" className="input mt-2 h-24 font-mono text-xs" maxLength={2000} value={err} onChange={(e) => setErr(e.target.value)} placeholder="e.g. Error from server (NotFound): …" />
          <div className="mt-2">
            <AskAI label="Diagnose my lab error" mode="troubleshoot" question="I hit this error in the lab. What does it mean and how do I fix it?" context={{ page: `lab:${lab.id}`, labError: err || undefined }} />
          </div>
        </div>
      </section>
      <section className="card space-y-2">
        <h2 className="font-semibold">Clean up</h2>
        <CodeBlock code={lab.cleanup.join('\n')} language="bash" />
        <References refs={lab.references} />
      </section>
      <button
        type="button"
        className={done ? 'btn-ghost' : 'btn-primary'}
        onClick={() =>
          updateProgress((pr) => {
            const lc = { ...pr.labsCompleted };
            if (done) delete lc[lab.id];
            else lc[lab.id] = Date.now();
            return recordActivity({ ...pr, labsCompleted: lc });
          })
        }
      >
        {done ? '✓ Completed — mark as not done' : 'Mark lab complete'}
      </button>
    </div>
  );
}
