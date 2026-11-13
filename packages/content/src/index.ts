import type { Lesson, Question } from './types';
import { lessonsA } from './lessons/a';
import { lessonsB } from './lessons/b';
import { lessonsC } from './lessons/c';
import { questionsFundamentals } from './questions/fundamentals';
import { questionsOrchestration } from './questions/orchestration';
import { questionsDeliveryArchitecture } from './questions/delivery-architecture';

export * from './types';
export * from './curriculum';
export { flashcards } from './flashcards';
export { glossary } from './glossary';
export { comparisons } from './comparisons';
export { resources, RESOURCES_VERIFIED_AT } from './resources';
export { ecosystemProjects, ECOSYSTEM_VERIFIED_AT } from './ecosystem';
export { labs } from './labs';
export { terminalChallenges } from './practice/terminal';
export { yamlChallenges } from './practice/yaml';
export { troubleshootingScenarios } from './practice/troubleshooting';
export { decisionGames } from './practice/decisions';

export const lessons: Lesson[] = [...lessonsA, ...lessonsB, ...lessonsC].sort(
  (a, b) => a.stage - b.stage || a.order - b.order,
);

export const questions: Question[] = [
  ...questionsFundamentals,
  ...questionsOrchestration,
  ...questionsDeliveryArchitecture,
];

const lessonIndex = new Map(lessons.map((l) => [l.id, l]));
const questionIndex = new Map(questions.map((q) => [q.id, q]));

export const lessonById = (id: string) => lessonIndex.get(id);
export const questionById = (id: string) => questionIndex.get(id);

/** Knowledge check for a lesson: up to `n` bank questions taught by that lesson, easiest first. */
export function knowledgeCheckFor(lessonId: string, n = 3): Question[] {
  return questions
    .filter((q) => q.lessonId === lessonId)
    .sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id))
    .slice(0, n);
}
