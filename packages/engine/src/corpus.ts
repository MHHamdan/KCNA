import {
  comparisons,
  flashcards,
  glossary,
  labs,
  lessons,
  questions,
  type Lesson,
} from '@kcna/content';
import { SearchIndex, type SearchDoc } from './search';

const lessonHref = (id: string, anchor?: string) => `#/lessons/${id}${anchor ? `?s=${anchor}` : ''}`;

function lessonDocs(l: Lesson): SearchDoc[] {
  const base = { lessonId: l.id, objective: l.objectives[0], refs: l.references };
  const docs: SearchDoc[] = [
    { ...base, id: `lesson:${l.id}`, kind: 'lesson', title: l.title, text: `${l.summary}\n${l.what}\n${l.keyTerms.join(', ')}`, href: lessonHref(l.id) },
    { ...base, id: `lesson:${l.id}:why`, kind: 'section', title: `${l.title} — why it exists`, text: `${l.why}\n${l.problem}`, href: lessonHref(l.id, 'why') },
    { ...base, id: `lesson:${l.id}:how`, kind: 'section', title: `${l.title} — how it works`, text: l.how, href: lessonHref(l.id, 'how') },
    {
      ...base,
      id: `lesson:${l.id}:components`,
      kind: 'section',
      title: `${l.title} — components`,
      text: l.components.map((c) => `${c.name}: ${c.description}`).join('\n'),
      href: lessonHref(l.id, 'components'),
    },
    {
      ...base,
      id: `lesson:${l.id}:misconceptions`,
      kind: 'section',
      title: `${l.title} — common misconceptions`,
      text: l.misconceptions.map((m) => `Myth: ${m.myth}\nReality: ${m.reality}`).join('\n'),
      href: lessonHref(l.id, 'misconceptions'),
    },
    {
      ...base,
      id: `lesson:${l.id}:example`,
      kind: 'section',
      title: `${l.title} — example: ${l.example.title}`,
      text: `${l.example.description}\n${l.example.code ?? ''}`,
      href: lessonHref(l.id, 'example'),
    },
  ];
  if (l.deeper)
    docs.push({ ...base, id: `lesson:${l.id}:deeper`, kind: 'section', title: `${l.title} — beyond the exam`, text: l.deeper, href: lessonHref(l.id, 'deeper') });
  l.faq.forEach((f, i) =>
    docs.push({ ...base, id: `lesson:${l.id}:faq:${i}`, kind: 'faq', title: f.q, text: f.a, href: lessonHref(l.id, 'faq') }),
  );
  return docs;
}

/** All authored learning content as retrievable documents. Question docs are optional
 *  because exposing explanations in search would spoil practice quizzes. */
export function buildCorpus(opts: { includeQuestions?: boolean } = {}): SearchDoc[] {
  const docs: SearchDoc[] = lessons.flatMap(lessonDocs);
  for (const g of glossary)
    docs.push({
      id: `glossary:${g.term}`,
      kind: 'glossary',
      title: g.term,
      text: g.definition + (g.related?.length ? `\nRelated: ${g.related.join(', ')}` : ''),
      href: `#/glossary?q=${encodeURIComponent(g.term)}`,
      lessonId: g.lessonId,
      objective: g.objective,
    });
  for (const c of comparisons)
    docs.push({
      id: `comparison:${c.id}`,
      kind: 'comparison',
      title: [c.a, c.b, c.c].filter(Boolean).join(' vs '),
      text: `${c.rule}\n${c.rows.map((r) => `${r.aspect}: ${c.a}: ${r.a}; ${c.b}: ${r.b}${c.c ? `; ${c.c}: ${r.c}` : ''}`).join('\n')}\nExam trap: ${c.examTrap}`,
      href: `#/compare?id=${c.id}`,
      lessonId: c.lessonId,
      objective: c.objective,
    });
  for (const lab of labs)
    docs.push({
      id: `lab:${lab.id}`,
      kind: 'lab',
      title: `Lab: ${lab.title}`,
      text: `${lab.objective}\n${lab.tasks.map((t) => t.title).join('\n')}\n${lab.troubleshooting.map((t) => `${t.symptom}: ${t.fix}`).join('\n')}`,
      href: `#/labs/${lab.id}`,
      objective: lab.objectives[0],
      refs: lab.references,
    });
  for (const f of flashcards)
    docs.push({ id: `flashcard:${f.id}`, kind: 'flashcard', title: f.front, text: f.back, href: `#/lessons/${f.lessonId}`, lessonId: f.lessonId, objective: f.objective });
  if (opts.includeQuestions)
    for (const q of questions)
      docs.push({
        id: `question:${q.id}`,
        kind: 'question',
        title: q.prompt.slice(0, 120),
        text: q.explanation,
        href: `#/lessons/${q.lessonId}`,
        lessonId: q.lessonId,
        objective: q.objective,
        refs: q.references,
      });
  return docs;
}

let cached: SearchIndex | undefined;
export function contentIndex(): SearchIndex {
  return (cached ??= new SearchIndex(buildCorpus()));
}
