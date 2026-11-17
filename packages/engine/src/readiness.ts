import {
  isKcnaQuestion,
  knowledgeCheckFor,
  DOMAINS,
  OBJECTIVES,
  labs,
  lessons,
  terminalChallenges,
  troubleshootingScenarios,
  yamlChallenges,
  type DomainId,
  type ObjectiveId,
} from '@kcna/content';
import { dueQuestionReviews, type Attempt, type Progress } from './progress';
import { dueCards, retentionScore } from './srs';
import { flashcards } from '@kcna/content';

const DAY = 86_400_000;
/** Evidence half-life: an answer from 3 weeks ago counts half as much as today's. */
export const HALF_LIFE_DAYS = 21;
/** Distinct questions per objective that count as "covered". */
export const COVERAGE_TARGET = 6;

export interface ObjectiveMastery extends Mastery {
  objective: ObjectiveId;
  domain: DomainId;
}

/** Beta-Binomial mastery with a uniform prior and exponential recency decay. */
export interface Mastery {
  attempts: number;
  distinct: number;
  mean: number;
  lower: number;
  evidence: number;
}

/** Beta-Binomial mastery with a uniform prior and exponential recency decay, for any topic id. */
export function masteryFor(attempts: Attempt[], id: string, now = Date.now()): Mastery {
  const mine = attempts.filter((a) => a.objective === id);
  let wc = 0;
  let ww = 0;
  for (const a of mine) {
    const w = Math.pow(0.5, Math.max(0, now - a.at) / DAY / HALF_LIFE_DAYS) * (a.source === 'review' ? 0.8 : 1);
    ww += w;
    if (a.correct) wc += w;
  }
  const alpha = 1 + wc;
  const beta = 1 + (ww - wc);
  const n = alpha + beta;
  const mean = alpha / n;
  const sd = Math.sqrt((alpha * beta) / (n * n * (n + 1)));
  // no evidence → no credit (the prior alone must not raise mastery)
  return { attempts: mine.length, distinct: new Set(mine.map((a) => a.qid)).size, mean, lower: mine.length ? Math.max(0, mean - sd) : 0, evidence: ww };
}

export function objectiveMastery(attempts: Attempt[], now = Date.now()): Record<ObjectiveId, ObjectiveMastery> {
  const out = {} as Record<ObjectiveId, ObjectiveMastery>;
  for (const o of OBJECTIVES) {
    out[o.id] = { objective: o.id, domain: o.domain, ...masteryFor(attempts, o.id, now) };
  }
  return out;
}

export function domainMastery(m: Record<ObjectiveId, ObjectiveMastery>): Record<DomainId, number> {
  const out = {} as Record<DomainId, number>;
  for (const d of DOMAINS) out[d.id] = d.objectives.reduce((s, o) => s + m[o].lower, 0) / d.objectives.length;
  return out;
}

/** Objective weight = its domain weight shared equally among the domain's objectives. */
export const objectiveWeight = (o: ObjectiveId) => {
  const d = DOMAINS.find((x) => x.objectives.includes(o))!;
  return d.weight / 100 / d.objectives.length;
};

export interface RepeatedMistake {
  qid: string;
  objective: Attempt['objective'];
  wrongCount: number;
}

/** Questions missed at least twice and not answered correctly since the last miss. */
export function repeatedMistakes(attempts: Attempt[]): RepeatedMistake[] {
  const byQ = new Map<string, Attempt[]>();
  for (const a of attempts) byQ.set(a.qid, [...(byQ.get(a.qid) ?? []), a]);
  const out: RepeatedMistake[] = [];
  for (const [qid, list] of byQ) {
    const sorted = list.sort((a, b) => a.at - b.at);
    const wrong = sorted.filter((a) => !a.correct).length;
    if (wrong >= 2 && !sorted[sorted.length - 1].correct) out.push({ qid, objective: sorted[0].objective, wrongCount: wrong });
  }
  return out.sort((a, b) => b.wrongCount - a.wrongCount);
}

/** Questions whose most recent attempt was wrong. */
export function recentWrong(attempts: Attempt[]): string[] {
  const last = new Map<string, Attempt>();
  for (const a of attempts) if (!last.has(a.qid) || last.get(a.qid)!.at <= a.at) last.set(a.qid, a);
  return [...last.values()].filter((a) => !a.correct).sort((a, b) => b.at - a.at).map((a) => a.qid);
}

export type ReadinessStatus = 'not-started' | 'building' | 'approaching' | 'ready';

export interface ChecklistItem {
  id: string;
  label: string;
  met: boolean;
  detail: string;
}

export interface Recommendation {
  kind: 'lesson' | 'practice' | 'questions' | 'mistakes' | 'flashcards' | 'mock' | 'lab';
  label: string;
  href: string;
  reason: string;
}

export interface Readiness {
  index: number; // 0..100 preparation indicator (NOT a pass probability)
  status: ReadinessStatus;
  components: { knowledge: number; mocks: number; coverage: number; retention: number };
  objectives: Record<ObjectiveId, ObjectiveMastery>;
  domains: Record<DomainId, number>;
  weakestDomain: DomainId | null;
  weakObjectives: ObjectiveId[];
  recentMockScores: number[];
  mockConsistency: number | null; // std-dev of recent full mock scores
  repeated: RepeatedMistake[];
  checklist: ChecklistItem[];
  plan: Recommendation[];
}

/** An objective counts as a demonstrated weakness after this much evidence. */
export const WEAK_RULE = { minAttempts: 5, maxMean: 0.65 } as const;

export const READINESS_WEIGHTS = { knowledge: 0.4, mocks: 0.35, coverage: 0.15, retention: 0.1 } as const;
export const READY_RULES = {
  minMocks: 2,
  mockMean: 0.8,
  domainFloor: 0.65,
  coverage: 0.85,
  index: 80,
  mockWindowDays: 30,
} as const;

export function computeReadiness(all: Progress, now = Date.now()): Readiness {
  // the KCNA indicator only considers KCNA questions (the infra track has its own)
  const p: Progress = { ...all, attempts: all.attempts.filter((a) => isKcnaQuestion(a.qid)) };
  const objectives = objectiveMastery(p.attempts, now);
  const domains = domainMastery(objectives);
  const knowledge = DOMAINS.reduce((s, d) => s + (d.weight / 100) * domains[d.id], 0);
  const coverage = OBJECTIVES.reduce((s, o) => s + objectiveWeight(o.id) * Math.min(1, objectives[o.id].distinct / COVERAGE_TARGET), 0);
  const kcnaCardIds = new Set(flashcards.map((f) => f.id));
  const retention = retentionScore(Object.fromEntries(Object.entries(p.cards).filter(([id]) => kcnaCardIds.has(id)))).score;

  const fullMocks = p.exams.filter((e) => e.mode === 'full' && now - e.finishedAt <= READY_RULES.mockWindowDays * DAY).sort((a, b) => b.finishedAt - a.finishedAt);
  const recent = fullMocks.slice(0, 3).map((e) => e.score);
  // short mocks count at half weight when no full mock exists yet
  const shortMocks = p.exams.filter((e) => e.mode === 'short').sort((a, b) => b.finishedAt - a.finishedAt).slice(0, 3);
  const mocks = recent.length
    ? recent.reduce((a, b) => a + b, 0) / recent.length
    : shortMocks.length
      ? (0.5 * shortMocks.reduce((a, e) => a + e.score, 0)) / shortMocks.length
      : 0;
  const consistency =
    recent.length >= 2 ? Math.sqrt(recent.reduce((s, x) => s + (x - mocks) ** 2, 0) / recent.length) : null;
  const consistencyPenalty = consistency !== null ? Math.min(0.1, Math.max(0, consistency - 0.05)) : 0;

  const W = READINESS_WEIGHTS;
  const index = Math.round(
    100 * Math.max(0, W.knowledge * knowledge + W.mocks * mocks + W.coverage * coverage + W.retention * retention - consistencyPenalty),
  );

  const weakestDomain = p.attempts.length
    ? [...DOMAINS].sort((a, b) => b.weight * (1 - domains[b.id]) - a.weight * (1 - domains[a.id]))[0].id
    : null;
  // Demonstrated weaknesses (enough answers, low accuracy) outrank merely unpractised
  // objectives; within each group, rank by expected exam points lost.
  const loss = (o: ObjectiveId) => objectiveWeight(o) * (1 - objectives[o].lower);
  const demonstrated = (o: ObjectiveId) => objectives[o].attempts >= WEAK_RULE.minAttempts && objectives[o].mean < WEAK_RULE.maxMean;
  const weakObjectives = OBJECTIVES.map((o) => o.id)
    .sort((a, b) => Number(demonstrated(b)) - Number(demonstrated(a)) || loss(b) - loss(a))
    .slice(0, 3);
  const repeated = repeatedMistakes(p.attempts);
  const lessonsDone = Object.keys(p.lessonsCompleted).length;

  const R = READY_RULES;
  const minDomain = Math.min(...Object.values(domains));
  const checklist: ChecklistItem[] = [
    {
      id: 'lessons',
      label: 'Mastered every KCNA lesson (knowledge check all correct)',
      met: lessons.filter((l) => l.scope === 'kcna').every((l) => lessonMastered(p, l.id)),
      detail: `${lessons.filter((l) => lessonMastered(p, l.id)).length}/${lessons.length} mastered · ${lessonsDone} marked complete`,
    },
    { id: 'coverage', label: `Practised every objective (≥${COVERAGE_TARGET} distinct questions each)`, met: coverage >= R.coverage, detail: `${Math.round(coverage * 100)}% weighted coverage` },
    { id: 'domains', label: `Every domain at ≥${R.domainFloor * 100}% conservative mastery`, met: minDomain >= R.domainFloor, detail: `Lowest domain: ${Math.round(minDomain * 100)}%` },
    { id: 'mocks', label: `${R.minMocks}+ full mock exams in the last ${R.mockWindowDays} days`, met: fullMocks.length >= R.minMocks, detail: `${fullMocks.length} recent full mock exam(s)` },
    { id: 'mock-score', label: `Recent full mocks average ≥${R.mockMean * 100}% (5 points above the pass mark)`, met: recent.length >= R.minMocks && mocks >= R.mockMean, detail: recent.length ? `Average ${Math.round(mocks * 100)}%` : 'No full mock yet' },
    { id: 'consistency', label: 'Consistent mock results (spread ≤ 5 points)', met: consistency !== null && consistency <= 0.05, detail: consistency === null ? 'Needs 2+ full mocks' : `±${Math.round(consistency * 100)} points` },
    { id: 'mistakes', label: 'No unresolved repeated mistakes', met: repeated.length === 0 && p.attempts.length > 0, detail: `${repeated.length} question(s) missed 2+ times` },
    { id: 'retention', label: 'Flashcards retained beyond one week', met: retention >= 0.5, detail: `${Math.round(retention * 100)}% mature cards` },
  ];

  const status: ReadinessStatus =
    p.attempts.length === 0
      ? 'not-started'
      : index >= R.index && checklist.filter((c) => ['coverage', 'domains', 'mocks', 'mock-score'].includes(c.id)).every((c) => c.met)
        ? 'ready'
        : index >= 60 && mocks >= 0.7
          ? 'approaching'
          : 'building';

  return {
    index,
    status,
    components: { knowledge, mocks, coverage, retention },
    objectives,
    domains,
    weakestDomain,
    weakObjectives,
    recentMockScores: recent,
    mockConsistency: consistency,
    repeated,
    checklist,
    plan: studyPlan(p, objectives, weakObjectives, repeated, fullMocks.length ? fullMocks[0].finishedAt : null, now),
  };
}

function studyPlan(
  p: Progress,
  m: Record<ObjectiveId, ObjectiveMastery>,
  weak: ObjectiveId[],
  repeated: RepeatedMistake[],
  lastFullMock: number | null,
  now: number,
): Recommendation[] {
  const plan: Recommendation[] = [];
  const objName = (o: ObjectiveId) => OBJECTIVES.find((x) => x.id === o)!.name;
  if (p.attempts.length < 10) {
    const next = nextLesson(p);
    if (next) plan.push({ kind: 'lesson', label: `Study: ${next.title}`, href: `#/lessons/${next.id}`, reason: 'Not enough answered questions yet to diagnose weaknesses — follow the learning path first.' });
  }
  for (const o of weak.slice(0, 2)) {
    const pct = Math.round(m[o].lower * 100);
    const lesson = lessons.find((l) => l.objectives.includes(o) && !p.lessonsCompleted[l.id]) ?? lessons.find((l) => l.objectives.includes(o));
    if (lesson)
      plan.push({ kind: 'lesson', label: `Review: ${lesson.title}`, href: `#/lessons/${lesson.id}`, reason: `${objName(o)} is one of your highest-impact gaps (conservative mastery ${pct}%, ${m[o].attempts} answers).` });
    const practice =
      troubleshootingScenarios.find((s) => s.objective === o && !p.practiceCompleted[s.id]) ??
      terminalChallenges.find((s) => s.objective === o && !p.practiceCompleted[s.id]) ??
      yamlChallenges.find((s) => s.objective === o && !p.practiceCompleted[s.id]);
    if (practice) {
      const route = practice.id.startsWith('ts-') ? 'troubleshoot' : practice.id.startsWith('term-') ? 'terminal' : 'yaml';
      plan.push({ kind: 'practice', label: `Practise: ${practice.title}`, href: `#/${route}?id=${practice.id}`, reason: `Hands-on work on ${objName(o)}.` });
    }
    plan.push({ kind: 'questions', label: `Answer 10 ${objName(o)} questions`, href: `#/practice?objective=${o}`, reason: m[o].distinct < COVERAGE_TARGET ? `Only ${m[o].distinct} distinct questions answered so far.` : 'Fresh evidence will update your mastery estimate.' });
  }
  const dueQ = dueQuestionReviews(p, now).length;
  if (dueQ)
    plan.push({ kind: 'mistakes', label: `Review ${dueQ} missed question(s) due today`, href: '#/review', reason: 'Missed questions come back on a spaced schedule until you answer them correctly over several weeks.' });
  else if (repeated.length)
    plan.push({ kind: 'mistakes', label: `Re-attempt ${Math.min(repeated.length, 10)} repeatedly missed question(s)`, href: '#/review', reason: 'Repeated misses usually signal a misconception rather than a slip.' });
  const due = dueCards(flashcards, p.cards, now).filter((c) => p.cards[c.id]).length;
  if (due) plan.push({ kind: 'flashcards', label: `Review ${due} due flashcard(s)`, href: '#/flashcards', reason: 'Spaced repetition keeps facts from decaying before exam day.' });
  const lab = labs.find((l) => l.status === 'full' && !p.labsCompleted[l.id] && l.objectives.some((o) => weak.includes(o)));
  if (lab) plan.push({ kind: 'lab', label: `Lab: ${lab.title}`, href: `#/labs/${lab.id}`, reason: 'Running it on a real (local) cluster cements the concept.' });
  if (p.attempts.length >= 40 && (!lastFullMock || now - lastFullMock > 7 * DAY))
    plan.push({ kind: 'mock', label: 'Take a full 60-question mock exam', href: '#/exam', reason: lastFullMock ? 'Your last full mock is more than a week old.' : 'You have enough practice to benchmark against exam conditions.' });
  return plan.slice(0, 7);
}

/** A lesson is mastered when the latest answer to every knowledge-check question is correct. */
export function lessonMastered(p: Progress, lessonId: string): boolean {
  const qs = knowledgeCheckFor(lessonId);
  if (!qs.length) return false;
  return qs.every((q) => {
    let last: Attempt | undefined;
    for (const a of p.attempts) if (a.qid === q.id && (!last || a.at >= last.at)) last = a;
    return !!last?.correct;
  });
}

/** First lesson in learning-path order that hasn't been completed. */
export function nextLesson(p: Progress) {
  return lessons.find((l) => !p.lessonsCompleted[l.id]) ?? null;
}

/** Compact, privacy-preserving summary sent to the AI tutor in Revision mode. */
export function performanceSummary(r: Readiness): string {
  const dom = DOMAINS.map((d) => `${d.name} (${d.weight}%): ${Math.round(r.domains[d.id] * 100)}%`).join('; ');
  const weak = r.weakObjectives.map((o) => `${OBJECTIVES.find((x) => x.id === o)!.name} ${Math.round(r.objectives[o].lower * 100)}% over ${r.objectives[o].attempts} answers`).join('; ');
  return [
    `Readiness indicator ${r.index}/100 (${r.status}).`,
    `Conservative domain mastery: ${dom}.`,
    `Weakest objectives: ${weak}.`,
    r.recentMockScores.length ? `Recent full mock scores: ${r.recentMockScores.map((s) => Math.round(s * 100) + '%').join(', ')}.` : 'No full mock exam yet.',
    r.repeated.length ? `${r.repeated.length} question(s) missed repeatedly.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
