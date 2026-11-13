import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { comparisons, ECOSYSTEM_VERIFIED_AT, ecosystemProjects, glossary, OBJECTIVES, resources, RESOURCES_VERIFIED_AT } from '@kcna/content';
import { contentIndex } from '@kcna/engine';
import { usePageContext } from '../lib/tutorContext';
import { PageHeader } from '../components/Layout';
import { Md } from '../components/Md';
import { AskAI } from '../components/TutorPanel';
import { ObjectiveChip } from '../components/ui';

export function ComparePage() {
  const [params] = useSearchParams();
  const [id, setId] = useState(params.get('id') ?? comparisons[0]?.id);
  const c = comparisons.find((x) => x.id === id) ?? comparisons[0];
  usePageContext({ lessonId: c?.lessonId, page: `compare:${c?.id}` });
  if (!c) return null;
  const cols = [c.a, c.b, c.c].filter(Boolean) as string[];
  return (
    <div>
      <PageHeader title="Concept comparisons" subtitle="The distinctions the KCNA exam loves to test, side by side." />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {comparisons.map((x) => (
          <button key={x.id} type="button" onClick={() => setId(x.id)} className={`chip px-3 py-1 ${x.id === c.id ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200' : 'hover:bg-slate-100 dark:hover:bg-ink-800'}`}>
            {[x.a, x.b, x.c].filter(Boolean).join(' vs ')}
          </button>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{cols.join(' vs ')}</h2>
          <ObjectiveChip id={c.objective} />
        </div>
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="py-2 pr-3 font-semibold text-slate-500">Aspect</th>
              {cols.map((h) => (
                <th key={h} className="py-2 pr-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.rows.map((r) => (
              <tr key={r.aspect} className="border-b border-slate-100 align-top dark:border-slate-800">
                <td className="py-2 pr-3 font-medium text-slate-500">{r.aspect}</td>
                <td className="py-2 pr-3">{r.a}</td>
                <td className="py-2 pr-3">{r.b}</td>
                {c.c && <td className="py-2 pr-3">{r.c}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-500/10">
            <p className="font-semibold">Rule of thumb</p>
            <Md>{c.rule}</Md>
          </div>
          <div className="rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-500/10">
            <p className="font-semibold">Exam trap</p>
            <Md>{c.examTrap}</Md>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to={`/lessons/${c.lessonId}`} className="btn-ghost">
            Related lesson
          </Link>
          <AskAI question={`Compare ${cols.join(' and ')} with a concrete scenario where choosing wrong causes a problem.`} context={{ lessonId: c.lessonId }} mode="exam-coach" />
        </div>
      </div>
    </div>
  );
}

const MATURITY_STYLE: Record<string, string> = {
  graduated: 'border-emerald-400 text-emerald-700 dark:text-emerald-300',
  incubating: 'border-sky-400 text-sky-700 dark:text-sky-300',
  sandbox: 'border-slate-400',
  'non-cncf': 'border-slate-300 text-slate-500',
};

export function EcosystemPage() {
  const cats = [...new Set(ecosystemProjects.map((p) => p.category))];
  const [cat, setCat] = useState<string>('all');
  const [rel, setRel] = useState<string>('all');
  const list = ecosystemProjects.filter((p) => (cat === 'all' || p.category === cat) && (rel === 'all' || p.examRelevance === rel));
  usePageContext({ lessonId: 'cncf-community-and-governance', page: 'ecosystem' });
  return (
    <div>
      <PageHeader title="CNCF ecosystem explorer" subtitle={`Key cloud-native projects organised by purpose. Maturity levels as last verified on ${ECOSYSTEM_VERIFIED_AT} — check landscape.cncf.io for the current state.`} />
      <div className="mb-4 flex flex-wrap gap-2">
        <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="all">All categories</option>
          {cats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className="input w-auto" value={rel} onChange={(e) => setRel(e.target.value)} aria-label="Exam relevance">
          <option value="all">Any exam relevance</option>
          <option value="core">Core for KCNA</option>
          <option value="recognize">Recognise the name</option>
          <option value="optional">Optional</option>
        </select>
      </div>
      {cats
        .filter((c) => cat === 'all' || c === cat)
        .map((c) => {
          const items = list.filter((p) => p.category === c);
          if (!items.length) return null;
          return (
            <section key={c} className="mb-6">
              <h2 className="label mb-2">{c}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((p) => (
                  <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer" className="card block hover:border-brand-400">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{p.name}</p>
                      <span className={`chip ${MATURITY_STYLE[p.maturity]}`}>{p.maturity === 'non-cncf' ? 'not CNCF' : p.maturity}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{p.purpose}</p>
                    <p className="mt-2 text-xs text-slate-500">Exam: {p.examRelevance === 'core' ? 'know it well' : p.examRelevance === 'recognize' ? 'recognise its purpose' : 'optional'}</p>
                  </a>
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}

export function GlossaryPage() {
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const list = glossary.filter((g) => !q || g.term.toLowerCase().includes(q.toLowerCase()) || g.definition.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader title="Glossary" subtitle={`${glossary.length} Kubernetes and cloud-native terms, each linked to its KCNA objective.`} />
      <input className="input mb-4 max-w-md" placeholder="Filter terms…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter glossary" />
      <dl className="grid gap-3 md:grid-cols-2">
        {list.map((g) => (
          <div key={g.term} className="card">
            <dt className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{g.term}</span>
              <ObjectiveChip id={g.objective} />
            </dt>
            <dd className="mt-1 text-sm">
              <Md>{g.definition}</Md>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {g.lessonId && (
                  <Link className="underline" to={`/lessons/${g.lessonId}`}>
                    Lesson
                  </Link>
                )}
                {g.related?.map((r) => (
                  <button key={r} type="button" className="text-slate-500 underline" onClick={() => setQ(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ResourcesPage() {
  const sorted = [...resources].sort((a, b) => a.sequence - b.sequence);
  return (
    <div>
      <PageHeader title="Free resource library" subtitle={`Curated official and free resources in a suggested order. Availability and pricing last checked ${RESOURCES_VERIFIED_AT}; providers can change terms.`} />
      <ol className="space-y-3">
        {sorted.map((r) => (
          <li key={r.url} className="card flex gap-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800 dark:bg-brand-500/20 dark:text-brand-200">{r.sequence}</span>
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

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const hits = useMemo(() => (q ? contentIndex().search(q, { limit: 25 }) : []), [q]);
  return (
    <div>
      <PageHeader title={q ? `Search: ${q}` : 'Search'} subtitle={`Searches lessons, FAQs, the glossary, comparisons, labs and flashcards (${OBJECTIVES.length} objectives).`} />
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const v = new FormData(e.currentTarget).get('q');
          setParams({ q: String(v ?? '') });
        }}
        className="mb-4 flex max-w-xl gap-2"
      >
        <input name="q" defaultValue={q} key={q} className="input" aria-label="Search query" />
        <button className="btn-primary">Search</button>
      </form>
      {q && !hits.length && <p className="text-sm text-slate-500">No results. Try a shorter or different term.</p>}
      <ul className="space-y-2">
        {hits.map((h) => (
          <li key={h.doc.id} className="card py-3">
            <a href={h.doc.href} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
              {h.doc.title}
            </a>
            <span className="chip ml-2">{h.doc.kind}</span>
            <p className="mt-1 line-clamp-2 text-sm text-slate-500">{h.doc.text.replace(/[`*]/g, '').slice(0, 240)}</p>
          </li>
        ))}
      </ul>
      {q && (
        <div className="mt-4">
          <AskAI label="Ask the AI tutor instead" question={q} />
        </div>
      )}
    </div>
  );
}
