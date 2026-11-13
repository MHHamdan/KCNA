import { useRef, useState } from 'react';
import { emptyProgress, exportProgress, historyCsv, importProgress, ImportError } from '@kcna/engine';
import { download, setProgress, storageAvailable, updateProgress, useProgress } from '../lib/store';
import { useTutor } from '../lib/tutorContext';
import { TUTOR_API } from '../lib/tutor';
import { PageHeader } from '../components/Layout';

declare const __DEPLOY_TARGET__: string;
declare const __BUILD_TIME__: string;

export function SettingsPage() {
  const p = useProgress();
  const tutor = useTutor();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const stamp = new Date().toISOString().slice(0, 10);
  const setPref = <K extends keyof typeof p.prefs>(k: K, v: (typeof p.prefs)[K]) => updateProgress((pr) => ({ ...pr, prefs: { ...pr.prefs, [k]: v } }));

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Progress & settings" subtitle="Your progress is stored only in this browser. Export it regularly to keep a backup or move between devices." />
      {!storageAvailable() && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">Browser storage is unavailable (private mode or quota). Progress will be lost on refresh — export it before leaving.</p>}

      <section className="card space-y-3" aria-labelledby="data">
        <h2 id="data" className="font-semibold">Your data</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {Object.keys(p.lessonsCompleted).length} lessons · {p.attempts.length} answers · {p.exams.length} mock exams · {Object.keys(p.cards).length} flashcards studied. GitHub Pages and Hugging Face are different websites, so each keeps its own copy — use export/import to move progress between them.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => download(`kcna-progress-${stamp}.json`, exportProgress(p))}>
            Export progress (JSON)
          </button>
          <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
            Import progress
          </button>
          <button type="button" className="btn-ghost" onClick={() => download(`kcna-study-history-${stamp}.csv`, historyCsv(p), 'text/csv')}>
            Download study history (CSV)
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="import-input"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const imported = importProgress(await f.text());
                if (!window.confirm(`Replace current progress with the imported file (${imported.attempts.length} answers, ${Object.keys(imported.lessonsCompleted).length} lessons)?`)) return;
                setProgress(imported);
                setMsg({ ok: true, text: 'Progress imported.' });
              } catch (err) {
                setMsg({ ok: false, text: err instanceof ImportError ? err.message : 'Could not read that file.' });
              }
            }}
          />
        </div>
        {msg && (
          <p role="status" className={`text-sm ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
            {msg.text}
          </p>
        )}
        <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
          <button
            type="button"
            className="btn-ghost border-rose-300 text-rose-700 dark:text-rose-300"
            onClick={() => {
              if (window.confirm('Reset ALL progress? Export first if you want a backup. This cannot be undone.')) {
                setProgress(emptyProgress());
                setMsg({ ok: true, text: 'Progress reset.' });
              }
            }}
          >
            Reset progress
          </button>
        </div>
      </section>

      <section className="card space-y-3" aria-labelledby="prefs">
        <h2 id="prefs" className="font-semibold">Preferences</h2>
        <label className="flex items-center justify-between gap-4 text-sm">
          Theme
          <select className="input w-auto" value={p.prefs.theme} onChange={(e) => setPref('theme', e.target.value as 'system')}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-4 text-sm">
          Tutor explanation level
          <select className="input w-auto" value={p.prefs.tutorLevel} onChange={(e) => setPref('tutorLevel', e.target.value as 'beginner')}>
            <option value="beginner">Beginner</option>
            <option value="technical">Technical</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-4 text-sm">
          Target exam date
          <input type="date" className="input w-auto" value={p.prefs.examDate ?? ''} onChange={(e) => setPref('examDate', e.target.value || undefined)} />
        </label>
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>
            Save tutor conversations in this browser
            <span className="block text-xs text-slate-500">Off by default. Conversations are never stored on the server.</span>
          </span>
          <input type="checkbox" checked={p.prefs.saveTutorHistory} onChange={(e) => setPref('saveTutorHistory', e.target.checked)} />
        </label>
        <button type="button" className="btn-ghost" onClick={tutor.clear}>
          Clear AI conversation
        </button>
      </section>

      <section className="card space-y-2 text-sm" aria-labelledby="about">
        <h2 id="about" className="font-semibold">About this deployment</h2>
        <p>
          Target: <code>{__DEPLOY_TARGET__}</code> · built {new Date(__BUILD_TIME__).toLocaleString()}
        </p>
        <p>
          Tutor API: <code>{TUTOR_API || '(same origin)'}</code> · status: <code>{tutor.availability.state}</code>
          {'model' in tutor.availability && tutor.availability.model ? (
            <>
              {' '}
              · model <code>{tutor.availability.model}</code>
            </>
          ) : null}
        </p>
        <p className="text-slate-500">
          All practice questions are original and unofficial. KCNA is a trademark of The Linux Foundation; this project is not affiliated with or endorsed by CNCF or the Linux Foundation. Source:{' '}
          <a className="underline" href="https://github.com/MHHamdan/KCNA" target="_blank" rel="noopener noreferrer">
            github.com/MHHamdan/KCNA
          </a>
        </p>
      </section>
    </div>
  );
}
