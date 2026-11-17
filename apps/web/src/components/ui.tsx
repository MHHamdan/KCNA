import { type ReactNode } from 'react';
import { DOMAINS, INFRA_DOMAINS, INFRA_TOPICS, OBJECTIVES, type DomainId, type InfraDomainId, type ObjectiveId, type Reference, type Scope } from '@kcna/content';

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const objectiveName = (o: string) => OBJECTIVES.find((x) => x.id === o)?.name ?? INFRA_TOPICS.find((x) => x.id === o)?.name ?? o;
export const domainName = (d: DomainId) => DOMAINS.find((x) => x.id === d)?.name ?? d;

export const DOMAIN_COLORS: Record<DomainId, string> = {
  fundamentals: 'bg-brand-500',
  orchestration: 'bg-sky-500',
  delivery: 'bg-amber-500',
  architecture: 'bg-violet-500',
};

export function Bar({ value, className = 'bg-brand-500', label }: { value: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-ink-800" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label ?? "Progress"}>
      <div className={`h-full rounded-full transition-all ${className}`} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card">
      <p className="label">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function ScopeBadge({ scope }: { scope: Scope }) {
  const m: Record<Scope, [string, string]> = {
    kcna: ['KCNA exam', 'border-brand-300 text-brand-700 dark:border-brand-500/40 dark:text-brand-300'],
    foundation: ['Foundation', 'border-sky-300 text-sky-700 dark:border-sky-500/40 dark:text-sky-300'],
    beyond: ['Beyond KCNA', 'border-amber-300 text-amber-700 dark:border-amber-500/40 dark:text-amber-300'],
    senior: ['Senior interview', 'border-violet-300 text-violet-700 dark:border-violet-500/40 dark:text-violet-300'],
  };
  return <span className={`chip ${m[scope][1]}`}>{m[scope][0]}</span>;
}

export const INFRA_DOMAIN_COLORS: Record<InfraDomainId, string> = {
  networking: 'bg-sky-500',
  compute: 'bg-brand-500',
  'storage-data': 'bg-amber-500',
  distributed: 'bg-violet-500',
  reliability: 'bg-rose-500',
  security: 'bg-emerald-600',
  automation: 'bg-cyan-500',
  observability: 'bg-orange-500',
  'architecture-cost': 'bg-lime-600',
  'interview-craft': 'bg-fuchsia-500',
};
export const infraDomainName = (d: InfraDomainId) => INFRA_DOMAINS.find((x) => x.id === d)?.name ?? d;

export function ObjectiveChip({ id }: { id: ObjectiveId | string }) {
  const t = INFRA_TOPICS.find((x) => x.id === id);
  if (t)
    return (
      <span className="chip" title={t.description}>
        <span className={`size-1.5 rounded-full ${INFRA_DOMAIN_COLORS[t.domain]}`} />
        {t.name}
      </span>
    );
  const o = OBJECTIVES.find((x) => x.id === id);
  if (!o) return null;
  return (
    <span className="chip" title={o.description}>
      <span className={`size-1.5 rounded-full ${DOMAIN_COLORS[o.domain]}`} />
      {o.name}
    </span>
  );
}

export function References({ refs }: { refs: Reference[] }) {
  if (!refs.length) return null;
  return (
    <ul className="space-y-1 text-sm">
      {refs.map((r) => (
        <li key={r.url}>
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline underline-offset-2 dark:text-brand-300">
            {r.title}
          </a>
          <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">↗ {new URL(r.url).hostname}</span>
        </li>
      ))}
    </ul>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card text-center text-sm text-slate-500">{children}</div>;
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-ink-850" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-sm font-medium ${value === o.value ? 'bg-white shadow-sm dark:bg-ink-800 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const lessonPath = (lessonId: string) => (lessonId.startsWith('infra-') ? `/infra/lessons/${lessonId}` : `/lessons/${lessonId}`);

export function useHashQuery(): URLSearchParams {
  const h = typeof window !== 'undefined' ? window.location.hash : '';
  const i = h.indexOf('?');
  return new URLSearchParams(i >= 0 ? h.slice(i + 1) : '');
}
