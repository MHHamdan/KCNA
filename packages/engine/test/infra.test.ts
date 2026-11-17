import { describe, expect, it } from 'vitest';
import { designCases, infraQuestions, questions } from '@kcna/content';
import {
  addAttempts,
  buildChat,
  computeInfraReadiness,
  computeReadiness,
  contentIndex,
  designCoverage,
  emptyProgress,
  exportProgress,
  importProgress,
  retrieve,
  validateTutorRequest,
} from '../src';

const att = (q: { id: string; objective: string }, correct: boolean, at = Date.now()) => ({
  qid: q.id,
  objective: q.objective as never,
  correct,
  at,
  source: 'quiz' as const,
});

describe('track separation', () => {
  it('infra answers never move the KCNA readiness indicator, and vice versa', () => {
    const p = addAttempts(emptyProgress(), infraQuestions.map((q) => att(q, true)));
    expect(computeReadiness(p).status).toBe('not-started');
    expect(computeReadiness(p).index).toBe(0);
    expect(computeInfraReadiness(p).components.knowledge).toBeGreaterThan(0.5);
    const k = addAttempts(emptyProgress(), questions.map((q) => att(q, true)));
    expect(computeInfraReadiness(k).components.knowledge).toBe(0);
  });
});

describe('infra readiness', () => {
  it('starts at zero and needs designs, stories and mocks — not just quiz accuracy', () => {
    expect(computeInfraReadiness(emptyProgress()).index).toBe(0);
    let p = emptyProgress();
    for (let i = 0; i < 3; i++) p = addAttempts(p, infraQuestions.map((q) => att(q, true)));
    const r = computeInfraReadiness(p);
    expect(r.status).not.toBe('interview-ready');
    expect(r.checklist.find((c) => c.id === 'design')!.met).toBe(false);
    expect(r.plan.some((x) => x.href.startsWith('#/infra/design/'))).toBe(true);
  });
  it('counts a design as solid only above the rubric threshold', () => {
    const c = designCases[0];
    const all = c.rubric.flatMap((r) => r.signals.map((s) => `${r.area}::${s}`));
    const p = emptyProgress();
    p.designPractice[c.id] = { at: Date.now(), checked: all.slice(0, 2), answer: 'x' };
    expect(designCoverage(p, c.id)).toBeLessThan(0.7);
    p.designPractice[c.id] = { at: Date.now(), checked: all, answer: 'x' };
    expect(designCoverage(p, c.id)).toBe(1);
    expect(computeInfraReadiness(p).solidDesigns).toBe(1);
  });
  it('reaches interview-ready with broad evidence', () => {
    let p = emptyProgress();
    for (let i = 0; i < 3; i++) p = addAttempts(p, infraQuestions.map((q) => att(q, true)));
    for (const c of designCases) p.designPractice[c.id] = { at: Date.now(), checked: c.rubric.flatMap((r) => r.signals.map((s) => `${r.area}::${s}`)), answer: 'd' };
    for (let i = 0; i < 8; i++) p.behavioralStories[`bh-${i}`] = { at: Date.now(), story: 'word '.repeat(120) };
    p.mockInterviews = [1, 2, 3, 4];
    const r = computeInfraReadiness(p);
    expect(r.status).toBe('interview-ready');
    expect(r.index).toBeGreaterThanOrEqual(75);
  });
  it('persists designs, stories and mocks through export/import', () => {
    const p = emptyProgress();
    p.designPractice[designCases[0].id] = { at: 1, checked: ['a::b'], answer: 'my design' };
    p.behavioralStories['bh-x'] = { at: 2, story: 'my story' };
    p.mockInterviews = [3];
    const back = importProgress(exportProgress(p));
    expect(back.designPractice[designCases[0].id].answer).toBe('my design');
    expect(back.behavioralStories['bh-x'].story).toBe('my story');
    expect(back.mockInterviews).toEqual([3]);
  });
});

describe('interviewer mode', () => {
  it('validates infra context and injects the case rubric as authoritative', () => {
    const c = designCases[0];
    const v = validateTutorRequest({ mode: 'interviewer', messages: [{ role: 'user', content: 'Grade my design' }], context: { caseId: c.id, answer: 'Two regions, active-active…' } });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const hits = retrieve(contentIndex(), v.value);
    expect(hits).toEqual([]); // the rubric is the context; no extra snippets
    const { messages } = buildChat(v.value, hits);
    expect(messages[0].content).toMatch(/Mock interviewer/);
    expect(messages[0].content).toMatch(/never credit a rubric item they did not mention/);
    const last = messages.at(-1)!.content;
    expect(last).toContain(`SYSTEM DESIGN CASE: ${c.title}`);
    expect(last).toContain('RUBRIC (authoritative');
    expect(last).toContain(c.rubric[0].signals[0]);
    expect(last).toContain("CANDIDATE'S WRITTEN ANSWER");
  });
  it('rejects unknown cases and oversized answers', () => {
    expect(validateTutorRequest({ mode: 'interviewer', messages: [{ role: 'user', content: 'x' }], context: { caseId: 'sd-nope' } }).ok).toBe(false);
    expect(validateTutorRequest({ mode: 'interviewer', messages: [{ role: 'user', content: 'x' }], context: { answer: 'a'.repeat(6001) } }).ok).toBe(false);
  });
  it('retrieval finds infra lessons for senior questions', () => {
    const v = validateTutorRequest({ mode: 'explain', messages: [{ role: 'user', content: 'How do retries with exponential backoff and jitter prevent retry storms?' }] });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(retrieve(contentIndex(), v.value).map((h) => h.doc.lessonId)).toContain('infra-dist-patterns');
  });
});
