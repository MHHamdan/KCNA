import { DOMAINS, type DomainId, type Question } from '@kcna/content';

/** Deterministic PRNG (mulberry32) so exams can be reproduced from a seed in tests. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Split `total` across domains proportionally to exam weights (largest-remainder method). */
export function allocateByWeight(total: number, weights = DOMAINS.map((d) => ({ id: d.id, weight: d.weight }))): Record<DomainId, number> {
  const sum = weights.reduce((a, w) => a + w.weight, 0);
  const raw = weights.map((w) => ({ id: w.id, exact: (total * w.weight) / sum }));
  const out = Object.fromEntries(raw.map((r) => [r.id, Math.floor(r.exact)])) as Record<DomainId, number>;
  let left = total - Object.values(out).reduce((a, b) => a + b, 0);
  for (const r of [...raw].sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)))) {
    if (left-- <= 0) break;
    out[r.id] += 1;
  }
  return out;
}

export interface ExamOptions {
  total: number;
  seed: number;
  domain?: DomainId; // domain-focused test
  /** question ids answered wrong recently; these get mild priority so mocks double as review */
  prioritize?: string[];
}

/** Pick questions for a mock exam, honouring domain weights and topping up from other
 *  domains if a domain pool is too small. Never returns duplicates. */
export function selectExamQuestions(pool: Question[], opts: ExamOptions): Question[] {
  const rand = rng(opts.seed);
  const pri = new Set(opts.prioritize ?? []);
  const order = (qs: Question[]) => {
    const s = shuffle(qs, rand);
    return [...s.filter((q) => pri.has(q.id)).slice(0, Math.ceil(qs.length * 0.25)), ...s].filter(
      (q, i, a) => a.findIndex((x) => x.id === q.id) === i,
    );
  };
  if (opts.domain) return order(pool.filter((q) => q.domain === opts.domain)).slice(0, opts.total);

  const quota = allocateByWeight(opts.total);
  const chosen: Question[] = [];
  const leftovers: Question[] = [];
  for (const d of DOMAINS) {
    const qs = order(pool.filter((q) => q.domain === d.id));
    chosen.push(...qs.slice(0, quota[d.id]));
    leftovers.push(...qs.slice(quota[d.id]));
  }
  if (chosen.length < opts.total) chosen.push(...shuffle(leftovers, rand).slice(0, opts.total - chosen.length));
  return shuffle(chosen, rand);
}

export function isCorrect(q: Pick<Question, 'answer'>, selected: number[] | undefined): boolean {
  if (!selected || selected.length !== q.answer.length) return false;
  const s = new Set(selected);
  return q.answer.every((a) => s.has(a));
}

export interface ExamGrade {
  correct: number;
  total: number;
  score: number;
  passed: boolean;
  byDomain: Partial<Record<DomainId, { correct: number; total: number }>>;
  byObjective: Record<string, { correct: number; total: number }>;
  wrong: string[];
  unanswered: string[];
}

export function gradeExam(qs: Question[], answers: Record<string, number[]>, passPercent = 75): ExamGrade {
  const byDomain: ExamGrade['byDomain'] = {};
  const byObjective: ExamGrade['byObjective'] = {};
  const wrong: string[] = [];
  const unanswered: string[] = [];
  let correct = 0;
  for (const q of qs) {
    const ok = isCorrect(q, answers[q.id]);
    const d = (byDomain[q.domain] ??= { correct: 0, total: 0 });
    const o = (byObjective[q.objective] ??= { correct: 0, total: 0 });
    d.total++;
    o.total++;
    if (ok) {
      correct++;
      d.correct++;
      o.correct++;
    } else {
      wrong.push(q.id);
      if (!answers[q.id]?.length) unanswered.push(q.id);
    }
  }
  const score = qs.length ? correct / qs.length : 0;
  return { correct, total: qs.length, score, passed: score * 100 >= passPercent, byDomain, byObjective, wrong, unanswered };
}
