import { describe, expect, it } from 'vitest';
import {
  INFRA_DOMAINS,
  INFRA_TOPICS,
  behavioralPrompts,
  designCases,
  infraFlashcards,
  infraKnowledgeCheckFor,
  infraLessons,
  infraQuestions,
  infraResources,
  lessons,
  questions,
} from '../src';

const topicIds = new Set(INFRA_TOPICS.map((t) => t.id));
const lessonIds = new Set(infraLessons.map((l) => l.id));
const urlOk = (u: string) => /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(u);
const unique = (xs: string[]) => new Set(xs).size === xs.length;

describe('infra curriculum', () => {
  it('every topic belongs to exactly one listed domain', () => {
    const listed = INFRA_DOMAINS.flatMap((d) => d.topics);
    expect(unique(listed)).toBe(true);
    expect(new Set(listed)).toEqual(topicIds);
    for (const t of INFRA_TOPICS) expect(INFRA_DOMAINS.find((d) => d.id === t.domain)!.topics).toContain(t.id);
  });
  it('one lesson per topic, ids never collide with KCNA', () => {
    for (const t of INFRA_TOPICS) expect(lessonIds.has(`infra-${t.id}`), t.id).toBe(true);
    const kcna = new Set([...lessons.map((l) => l.id), ...questions.map((q) => q.id)]);
    for (const id of [...lessonIds, ...infraQuestions.map((q) => q.id)]) expect(kcna.has(id), id).toBe(false);
  });
});

describe('infra lessons', () => {
  it.each(infraLessons.map((l) => [l.id, l] as const))('%s is complete with an interview angle', (_, l) => {
    expect(l.scope).toBe('senior');
    for (const o of l.objectives) expect(topicIds.has(o), o).toBe(true);
    for (const f of ['what', 'why', 'problem', 'how', 'summary'] as const) expect(l[f].length, f).toBeGreaterThan(80);
    expect(l.components.length).toBeGreaterThanOrEqual(3);
    expect(l.misconceptions.length).toBeGreaterThanOrEqual(2);
    expect(l.interview, 'interview block').toBeDefined();
    expect(l.interview!.seniorAnswer.length).toBeGreaterThan(150);
    expect(l.interview!.followUps.length).toBeGreaterThanOrEqual(3);
    expect(l.interview!.redFlags.length).toBeGreaterThanOrEqual(3);
    for (const r of l.references) expect(urlOk(r.url), r.url).toBe(true);
    expect(infraKnowledgeCheckFor(l.id).length, 'knowledge check').toBeGreaterThanOrEqual(2);
  });
});

describe('infra questions', () => {
  it('has a large, unique bank covering every topic', () => {
    expect(infraQuestions.length).toBeGreaterThanOrEqual(140);
    expect(unique(infraQuestions.map((q) => q.id))).toBe(true);
    for (const t of INFRA_TOPICS) expect(infraQuestions.filter((q) => q.objective === t.id).length, t.id).toBeGreaterThanOrEqual(4);
  });
  it.each(infraQuestions.map((q) => [q.id, q] as const))('%s is well-formed', (_, q) => {
    expect(topicIds.has(q.objective)).toBe(true);
    expect(INFRA_TOPICS.find((t) => t.id === q.objective)!.domain).toBe(q.domain);
    expect(lessonIds.has(q.lessonId), q.lessonId).toBe(true);
    expect(q.choices.length).toBeGreaterThanOrEqual(3);
    expect(unique(q.choices)).toBe(true);
    expect(q.choiceRationale).toHaveLength(q.choices.length);
    for (const a of q.answer) expect(a >= 0 && a < q.choices.length).toBe(true);
    if (q.type === 'single') expect(q.answer).toHaveLength(1);
    else expect(q.answer.length).toBeGreaterThanOrEqual(2);
    for (const r of q.references) expect(urlOk(r.url), r.url).toBe(true);
  });
  it('spreads correct answers across positions', () => {
    const counts = [0, 0, 0, 0];
    for (const q of infraQuestions.filter((x) => x.type === 'single')) counts[Math.min(3, q.answer[0])]++;
    const total = counts.reduce((a, b) => a + b, 0);
    for (const c of counts) expect(c / total).toBeGreaterThan(0.12);
  });
});

describe('system design cases', () => {
  it('has 10 complete cases', () => {
    expect(designCases.length).toBeGreaterThanOrEqual(10);
    expect(unique(designCases.map((c) => c.id))).toBe(true);
  });
  it.each(designCases.map((c) => [c.id, c] as const))('%s has every section and a usable rubric', (_, c) => {
    for (const t of c.topics) expect(topicIds.has(t), t).toBe(true);
    expect(c.clarifyingQuestions.length).toBeGreaterThanOrEqual(5);
    expect(c.requirements.functional.length).toBeGreaterThan(0);
    expect(c.requirements.nonFunctional.length).toBeGreaterThan(0);
    expect(c.estimates.length).toBeGreaterThan(150);
    expect(c.architecture.length).toBeGreaterThan(300);
    expect(c.deepDives.length).toBeGreaterThanOrEqual(3);
    expect(c.tradeoffs.length).toBeGreaterThanOrEqual(3);
    expect(c.failureModes.length).toBeGreaterThanOrEqual(4);
    expect(c.followUps.length).toBeGreaterThanOrEqual(3);
    expect(c.rubric.length).toBeGreaterThanOrEqual(4);
    for (const r of c.rubric) {
      expect(r.signals.length).toBeGreaterThanOrEqual(2);
      expect(unique(r.signals)).toBe(true);
    }
    for (const r of c.references) expect(urlOk(r.url), r.url).toBe(true);
  });
});

describe('behavioural, flashcards, resources', () => {
  it('behavioural prompts cover the senior themes', () => {
    expect(behavioralPrompts.length).toBeGreaterThanOrEqual(12);
    expect(unique(behavioralPrompts.map((b) => b.id))).toBe(true);
    for (const theme of ['ownership', 'incident', 'influence', 'ambiguity', 'conflict', 'failure'])
      expect(behavioralPrompts.some((b) => b.theme === theme), theme).toBe(true);
    for (const b of behavioralPrompts) {
      expect(b.signals.length).toBeGreaterThanOrEqual(3);
      expect(b.pitfalls.length).toBeGreaterThanOrEqual(2);
    }
  });
  it('flashcards cover every topic and resolve their lessons', () => {
    expect(infraFlashcards.length).toBeGreaterThanOrEqual(80);
    expect(unique(infraFlashcards.map((f) => f.id))).toBe(true);
    for (const f of infraFlashcards) {
      expect(topicIds.has(f.objective), f.id).toBe(true);
      expect(lessonIds.has(f.lessonId), f.id).toBe(true);
    }
    for (const t of INFRA_TOPICS) expect(infraFlashcards.some((f) => f.objective === t.id), t.id).toBe(true);
  });
  it('resources are https and mapped to topics', () => {
    expect(infraResources.length).toBeGreaterThanOrEqual(15);
    for (const r of infraResources) {
      expect(urlOk(r.url), r.url).toBe(true);
      for (const o of r.objectives) expect(topicIds.has(o), o).toBe(true);
    }
  });
});

import { sequencePuzzles, anyLessonById } from '../src';
describe('step-ordering puzzles', () => {
  it('are well-formed and cover both tracks', () => {
    expect(sequencePuzzles.length).toBeGreaterThanOrEqual(20);
    expect(new Set(sequencePuzzles.map((s) => s.id)).size).toBe(sequencePuzzles.length);
    expect(sequencePuzzles.filter((s) => s.track === 'kcna').length).toBeGreaterThanOrEqual(8);
    expect(sequencePuzzles.filter((s) => s.track === 'infra').length).toBeGreaterThanOrEqual(8);
    for (const s of sequencePuzzles) {
      expect(s.steps.length, s.id).toBeGreaterThanOrEqual(4);
      expect(s.steps.length, s.id).toBeLessThanOrEqual(7);
      expect(new Set(s.steps).size, s.id).toBe(s.steps.length);
      for (const st of s.steps) expect(st.length, `${s.id}: ${st}`).toBeLessThanOrEqual(110);
      expect(anyLessonById(s.lessonId), `${s.id} lesson ${s.lessonId}`).toBeDefined();
      expect(s.explanation.length).toBeGreaterThan(40);
    }
  });
});
