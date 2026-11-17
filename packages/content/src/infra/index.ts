import type { DesignCase, InfraLesson, InfraQuestion } from '../types';
import { infraLessons1 } from './lessons-1';
import { infraLessons2 } from './lessons-2';
import { infraLessons3 } from './lessons-3';
import { infraQuestions1 } from './questions-1';
import { infraQuestions2 } from './questions-2';
import { infraQuestions3 } from './questions-3';
import { designCases1 } from './design-1';
import { designCases2 } from './design-2';

export * from './curriculum';
export { behavioralPrompts } from './behavioral';
export { infraFlashcards } from './flashcards';
export { infraResources, INFRA_RESOURCES_VERIFIED_AT } from './resources';

export const infraLessons: InfraLesson[] = [...infraLessons1, ...infraLessons2, ...infraLessons3].sort(
  (a, b) => a.stage - b.stage || a.order - b.order,
);
export const infraQuestions: InfraQuestion[] = [...infraQuestions1, ...infraQuestions2, ...infraQuestions3];
export const designCases: DesignCase[] = [...designCases1, ...designCases2];

const infraLessonIndex = new Map(infraLessons.map((l) => [l.id, l]));
const infraQuestionIndex = new Map(infraQuestions.map((q) => [q.id, q]));
export const infraLessonById = (id: string) => infraLessonIndex.get(id);
export const infraQuestionById = (id: string) => infraQuestionIndex.get(id);
export const designCaseById = (id: string) => designCases.find((c) => c.id === id);

export function infraKnowledgeCheckFor(lessonId: string, n = 3): InfraQuestion[] {
  return infraQuestions
    .filter((q) => q.lessonId === lessonId)
    .sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id))
    .slice(0, n);
}
