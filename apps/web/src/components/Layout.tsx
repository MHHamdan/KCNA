import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTutor } from '../lib/tutorContext';
import { updateProgress, useProgress } from '../lib/store';
import { Icon } from './Icon';
import { TutorDrawer } from './TutorPanel';
import { applyTheme } from '../lib/theme';

const NAV: { group: string; items: { to: string; label: string; icon: string }[] }[] = [
  {
    group: 'Play & habit',
    items: [
      { to: '/feed', label: '∞ Endless feed', icon: 'spark' },
      { to: '/daily', label: 'Daily challenge', icon: 'flag' },
      { to: '/arena', label: 'Break-Fix Arena', icon: 'wrench' },
      { to: '/games', label: 'Mini-games', icon: 'game' },
      { to: '/explain', label: 'Explain it back', icon: 'book' },
      { to: '/map', label: 'Skill map & badges', icon: 'target' },
    ],
  },
  {
    group: 'Learn',
    items: [
      { to: '/', label: 'Dashboard', icon: 'home' },
      { to: '/path', label: 'Learning path', icon: 'path' },
      { to: '/explore', label: 'Architecture explorer', icon: 'cluster' },
      { to: '/network', label: 'Networking visualizer', icon: 'network' },
      { to: '/storage', label: 'Storage visualizer', icon: 'disk' },
      { to: '/compare', label: 'Concept comparisons', icon: 'compare' },
      { to: '/ecosystem', label: 'CNCF ecosystem', icon: 'layers' },
    ],
  },
  {
    group: 'Practice',
    items: [
      { to: '/terminal', label: 'Terminal trainer', icon: 'terminal' },
      { to: '/yaml', label: 'YAML trainer', icon: 'code' },
      { to: '/troubleshoot', label: 'Troubleshooting', icon: 'wrench' },
      { to: '/decisions', label: 'Decision game', icon: 'game' },
      { to: '/labs', label: 'Kubernetes labs', icon: 'flask' },
    ],
  },
  {
    group: 'Exam prep',
    items: [
      { to: '/practice', label: 'Practice questions', icon: 'quiz' },
      { to: '/exam', label: 'Mock exam', icon: 'timer' },
      { to: '/review', label: 'Smart review', icon: 'review' },
      { to: '/flashcards', label: 'Flashcards', icon: 'cards' },
      { to: '/readiness', label: 'Am I ready?', icon: 'target' },
    ],
  },
  {
    group: 'Cloud Infra · Senior',
    items: [
      { to: '/infra', label: 'Track home', icon: 'layers' },
      { to: '/infra/practice', label: 'Interview questions', icon: 'quiz' },
      { to: '/infra/design', label: 'System design', icon: 'cluster' },
      { to: '/infra/behavioral', label: 'Behavioural', icon: 'review' },
      { to: '/infra/mock', label: 'Mock interview', icon: 'spark' },
      { to: '/infra/flashcards', label: 'Infra flashcards', icon: 'cards' },
      { to: '/infra/readiness', label: 'Interview readiness', icon: 'target' },
      { to: '/infra/resources', label: 'Reading list', icon: 'link' },
    ],
  },
  {
    group: 'Reference',
    items: [
      { to: '/tutor', label: 'AI tutor', icon: 'spark' },
      { to: '/glossary', label: 'Glossary', icon: 'glossary' },
      { to: '/resources', label: 'Free resources', icon: 'link' },
      { to: '/settings', label: 'Progress & settings', icon: 'settings' },
    ],
  },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="space-y-5 px-3 py-4">
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="label mb-1.5 px-2">{g.group}</p>
          <ul className="space-y-0.5">
            {g.items.map((it) => (
              <li key={it.to}>
                <NavLink
                  to={it.to}
                  end={it.to === '/' || it.to === '/infra'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ${isActive ? 'bg-brand-50 font-semibold text-brand-800 dark:bg-brand-500/10 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-ink-850'}`
                  }
                >
                  <Icon name={it.icon} className="size-4.5 shrink-0" />
                  {it.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SearchBox() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !(e.target as HTMLElement).closest('input,textarea,[contenteditable]'))) {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <form
      role="search"
      className="relative w-full max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <Icon name="search" className="pointer-events-none absolute top-2.5 left-3 size-4 text-slate-400" />
      <label htmlFor="global-search" className="sr-only">
        Search lessons, glossary and labs
      </label>
      <input id="global-search" className="input pl-9" placeholder="Search… (press /)" value={q} onChange={(e) => setQ(e.target.value)} />
    </form>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const tutor = useTutor();
  const theme = useProgress().prefs.theme;
  const loc = useLocation();
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    // follow OS light/dark changes while the app is open
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [loc.pathname]);
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only z-50 rounded bg-brand-600 px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-3 backdrop-blur sm:px-5 dark:border-slate-800 dark:bg-ink-950/90">
        <button type="button" className="rounded p-1.5 lg:hidden" onClick={() => setMenu(true)} aria-label="Open menu">
          <Icon name="menu" />
        </button>
        <NavLink to="/" className="flex shrink-0 items-center gap-2 font-semibold">
          <svg viewBox="0 0 64 64" className="size-7" aria-hidden="true">
            <rect width="64" height="64" rx="14" className="fill-brand-600" />
            <path d="M32 10l18 10v24L32 54 14 44V20z" fill="none" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
            <circle cx="32" cy="32" r="6" fill="#fbbf24" />
          </svg>
          <span className="hidden sm:inline">KCNA Lab</span>
        </NavLink>
        <div className="flex flex-1 justify-center">
          <SearchBox />
        </div>
        <button
          type="button"
          className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-ink-850"
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => updateProgress((p) => ({ ...p, prefs: { ...p.prefs, theme: isDark ? 'light' : 'dark' } }))}
        >
          <Icon name={isDark ? 'sun' : 'moon'} />
        </button>
        <button type="button" className="btn-ai" onClick={() => tutor.setOpen(!tutor.open)} aria-expanded={tutor.open}>
          <Icon name="spark" className="size-4" />
          <span className="hidden sm:inline">Tutor</span>
        </button>
      </header>
      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-slate-200 lg:block dark:border-slate-800">
          <Sidebar />
        </aside>
        {menu && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMenu(false)} />
            <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-white dark:bg-ink-900">
              <div className="flex justify-end p-2">
                <button type="button" className="rounded p-1.5" onClick={() => setMenu(false)} aria-label="Close menu">
                  <Icon name="x" />
                </button>
              </div>
              <Sidebar onNavigate={() => setMenu(false)} />
            </div>
          </div>
        )}
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 outline-none sm:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
      <TutorDrawer />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · KCNA Lab`;
  }, [title]);
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
