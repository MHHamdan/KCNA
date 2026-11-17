import { INFRA_DOMAINS, INFRA_TOPICS, behavioralPrompts, designCases, infraLessons, type InfraDomainId, type InfraTopicId } from '@kcna/content';
import type { Progress } from './progress';
import { masteryFor, type Mastery, type Recommendation } from './readiness';

// Senior interview readiness for the Cloud Infrastructure track. Like the KCNA
// indicator it is a conservative heuristic, not a probability of an offer.

/** Domain weights by how often a domain dominates senior infra interviews. */
const IMPORTANCE_WEIGHT = { core: 3, high: 2, medium: 1 } as const;
export const INFRA_TARGETS = {
  distinctPerTopic: 5,
  designCases: 6,
  /** share of a case's rubric signals a design must cover to count as solid */
  designRubricShare: 0.7,
  stories: 8,
  mockInterviews: 4,
} as const;
export const INFRA_WEIGHTS = { knowledge: 0.4, coverage: 0.1, design: 0.25, stories: 0.1, mocks: 0.15 } as const;

export interface InfraReadiness {
  index: number;
  status: 'not-started' | 'building' | 'interview-ready-soon' | 'interview-ready';
  components: { knowledge: number; coverage: number; design: number; stories: number; mocks: number };
  topics: Record<InfraTopicId, Mastery>;
  domains: Record<InfraDomainId, number>;
  solidDesigns: number;
  checklist: { id: string; label: string; met: boolean; detail: string }[];
  plan: Recommendation[];
}

/** Rubric coverage (0..1) of a practised design case. */
export function designCoverage(p: Progress, caseId: string): number {
  const c = designCases.find((x) => x.id === caseId);
  const d = p.designPractice[caseId];
  if (!c || !d) return 0;
  const total = c.rubric.reduce((n, r) => n + r.signals.length, 0);
  return total ? d.checked.length / total : 0;
}

export function computeInfraReadiness(p: Progress, now = Date.now()): InfraReadiness {
  const topicIds = new Set(INFRA_TOPICS.map((t) => t.id));
  const attempts = p.attempts.filter((a) => topicIds.has(a.objective as InfraTopicId));
  const topics = {} as Record<InfraTopicId, Mastery>;
  for (const t of INFRA_TOPICS) topics[t.id] = masteryFor(attempts, t.id, now);
  const domains = {} as Record<InfraDomainId, number>;
  for (const d of INFRA_DOMAINS) domains[d.id] = d.topics.reduce((s, t) => s + topics[t].lower, 0) / d.topics.length;

  const wSum = INFRA_DOMAINS.reduce((s, d) => s + IMPORTANCE_WEIGHT[d.importance], 0);
  const knowledge = INFRA_DOMAINS.reduce((s, d) => s + (IMPORTANCE_WEIGHT[d.importance] / wSum) * domains[d.id], 0);
  const coverage = INFRA_TOPICS.reduce((s, t) => s + Math.min(1, topics[t.id].distinct / INFRA_TARGETS.distinctPerTopic), 0) / INFRA_TOPICS.length;
  const solidDesigns = designCases.filter((c) => designCoverage(p, c.id) >= INFRA_TARGETS.designRubricShare).length;
  const design = Math.min(1, solidDesigns / INFRA_TARGETS.designCases);
  const storyCount = Object.values(p.behavioralStories).filter((s) => s.story.trim().split(/\s+/).length >= 80).length;
  const stories = Math.min(1, storyCount / INFRA_TARGETS.stories);
  const mocks = Math.min(1, p.mockInterviews.length / INFRA_TARGETS.mockInterviews);
  const W = INFRA_WEIGHTS;
  const index = Math.round(100 * (W.knowledge * knowledge + W.coverage * coverage + W.design * design + W.stories * stories + W.mocks * mocks));

  const minCore = Math.min(...INFRA_DOMAINS.filter((d) => d.importance === 'core' && d.id !== 'interview-craft').map((d) => domains[d.id]));
  const checklist = [
    { id: 'lessons', label: 'Studied every lesson in the track', met: infraLessons.every((l) => p.lessonsCompleted[l.id]), detail: `${infraLessons.filter((l) => p.lessonsCompleted[l.id]).length}/${infraLessons.length} lessons read` },
    { id: 'core', label: 'Core domains ≥ 70% (networking, data, distributed systems, reliability)', met: minCore >= 0.7, detail: `Lowest core domain: ${Math.round(minCore * 100)}%` },
    { id: 'coverage', label: `Answered ≥ ${INFRA_TARGETS.distinctPerTopic} distinct questions in every topic`, met: coverage >= 0.95, detail: `${Math.round(coverage * 100)}% coverage` },
    { id: 'design', label: `${INFRA_TARGETS.designCases} system designs covering ≥ ${INFRA_TARGETS.designRubricShare * 100}% of their rubric`, met: solidDesigns >= INFRA_TARGETS.designCases, detail: `${solidDesigns} solid design(s)` },
    { id: 'stories', label: `${INFRA_TARGETS.stories} behavioural STAR stories written (80+ words each)`, met: storyCount >= INFRA_TARGETS.stories, detail: `${storyCount} story/stories` },
    { id: 'mocks', label: `${INFRA_TARGETS.mockInterviews} AI mock interviews completed with feedback`, met: p.mockInterviews.length >= INFRA_TARGETS.mockInterviews, detail: `${p.mockInterviews.length} completed` },
  ];

  const plan: Recommendation[] = [];
  const nextLesson = infraLessons.find((l) => !p.lessonsCompleted[l.id]);
  if (nextLesson) plan.push({ kind: 'lesson', label: `Study: ${nextLesson.title}`, href: `#/infra/lessons/${nextLesson.id}`, reason: 'Next lesson in the track.' });
  const weakest = [...INFRA_TOPICS]
    .filter((t) => t.domain !== 'interview-craft')
    .sort((a, b) => topics[a.id].lower - topics[b.id].lower)
    .slice(0, 2);
  for (const t of weakest)
    plan.push({ kind: 'questions', label: `Answer 10 questions on ${t.name}`, href: `#/infra/practice?topic=${t.id}`, reason: topics[t.id].attempts ? `Conservative mastery ${Math.round(topics[t.id].lower * 100)}%.` : 'No evidence yet for this topic.' });
  const nextCase = designCases.find((c) => designCoverage(p, c.id) < INFRA_TARGETS.designRubricShare);
  if (nextCase) plan.push({ kind: 'practice', label: `System design: ${nextCase.title}`, href: `#/infra/design/${nextCase.id}`, reason: 'Timed design practice graded against a senior rubric.' });
  const nextStory = behavioralPrompts.find((b) => !p.behavioralStories[b.id]);
  if (nextStory) plan.push({ kind: 'practice', label: `Write a STAR story: ${nextStory.question}`, href: `#/infra/behavioral?id=${nextStory.id}`, reason: 'Prepared stories make behavioural rounds predictable.' });
  if (p.mockInterviews.length < INFRA_TARGETS.mockInterviews) plan.push({ kind: 'mock', label: 'Run an AI mock interview', href: '#/infra/mock', reason: 'Practise answering out loud under follow-up pressure.' });

  const anyEvidence = attempts.length > 0 || Object.keys(p.designPractice).length > 0 || storyCount > 0;
  const status: InfraReadiness['status'] = !anyEvidence
    ? 'not-started'
    : index >= 75 && checklist.filter((c) => ['core', 'design', 'mocks'].includes(c.id)).every((c) => c.met)
      ? 'interview-ready'
      : index >= 55
        ? 'interview-ready-soon'
        : 'building';
  return { index, status, components: { knowledge, coverage, design, stories, mocks }, topics, domains, solidDesigns, checklist, plan: plan.slice(0, 7) };
}
