import { describe, expect, it } from 'vitest';
import {
  DOMAINS,
  OBJECTIVES,
  STAGES,
  comparisons,
  decisionGames,
  ecosystemProjects,
  flashcards,
  glossary,
  knowledgeCheckFor,
  labs,
  lessons,
  questions,
  resources,
  terminalChallenges,
  troubleshootingScenarios,
  yamlChallenges,
  domainOfObjective,
} from '../src';
import { checkYamlChallenge, matchesExpectation, parseKubectl } from '@kcna/engine';

const lessonIds = new Set(lessons.map((l) => l.id));
const objectiveIds = new Set(OBJECTIVES.map((o) => o.id));
const urlOk = (u: string) => /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(u);
const unique = (xs: string[]) => new Set(xs).size === xs.length;

describe('curriculum', () => {
  it('domain weights match the official KCNA curriculum and sum to 100', () => {
    expect(Object.fromEntries(DOMAINS.map((d) => [d.id, d.weight]))).toEqual({ fundamentals: 44, orchestration: 28, delivery: 16, architecture: 12 });
    expect(DOMAINS.reduce((a, d) => a + d.weight, 0)).toBe(100);
  });
  it('has the 13 official competencies, each in exactly one domain', () => {
    expect(OBJECTIVES).toHaveLength(13);
    const listed = DOMAINS.flatMap((d) => d.objectives);
    expect(new Set(listed)).toEqual(objectiveIds);
    for (const o of OBJECTIVES) expect(DOMAINS.find((d) => d.id === o.domain)!.objectives).toContain(o.id);
  });
});

describe('lessons', () => {
  it('meets the release target of 16+ substantive lessons', () => {
    expect(lessons.length).toBeGreaterThanOrEqual(16);
    expect(unique(lessons.map((l) => l.id))).toBe(true);
  });
  it.each(lessons.map((l) => [l.id, l] as const))('%s is complete and mapped', (_, l) => {
    expect(STAGES.map((s) => s.id)).toContain(l.stage);
    expect(l.objectives.length).toBeGreaterThan(0);
    for (const o of l.objectives) expect(objectiveIds.has(o)).toBe(true);
    for (const f of ['what', 'why', 'problem', 'how', 'summary'] as const) expect(l[f].length, f).toBeGreaterThan(60);
    expect(l.components.length).toBeGreaterThanOrEqual(2);
    expect(l.misconceptions.length).toBeGreaterThanOrEqual(2);
    expect(l.faq.length).toBeGreaterThanOrEqual(2);
    expect(l.exercise.prompt.length).toBeGreaterThan(20);
    expect(l.references.length).toBeGreaterThan(0);
    for (const r of l.references) expect(urlOk(r.url), r.url).toBe(true);
    expect(knowledgeCheckFor(l.id).length, 'knowledge check questions').toBeGreaterThanOrEqual(2);
  });
  it('orders lessons uniquely within each stage', () => {
    for (const s of STAGES) {
      const orders = lessons.filter((l) => l.stage === s.id).map((l) => String(l.order));
      expect(unique(orders), `stage ${s.id}`).toBe(true);
    }
  });
});

describe('question bank', () => {
  it('has 150+ unique original questions', () => {
    expect(questions.length).toBeGreaterThanOrEqual(150);
    expect(unique(questions.map((q) => q.id))).toBe(true);
  });
  it.each(questions.map((q) => [q.id, q] as const))('%s is well-formed', (_, q) => {
    expect(objectiveIds.has(q.objective)).toBe(true);
    expect(domainOfObjective(q.objective)).toBe(q.domain);
    expect(lessonIds.has(q.lessonId), `lesson ${q.lessonId}`).toBe(true);
    expect(q.choices.length).toBeGreaterThanOrEqual(3);
    expect(unique(q.choices)).toBe(true);
    expect(q.choiceRationale).toHaveLength(q.choices.length);
    expect(unique(q.answer.map(String))).toBe(true);
    for (const a of q.answer) expect(a >= 0 && a < q.choices.length).toBe(true);
    if (q.type === 'single') expect(q.answer).toHaveLength(1);
    else expect(q.answer.length).toBeGreaterThanOrEqual(2);
    expect(q.explanation.length).toBeGreaterThan(40);
    for (const r of q.references) expect(urlOk(r.url), r.url).toBe(true);
    expect(q.prompt).not.toMatch(/all of the above|none of the above/i);
  });
  it('covers every objective and supports a non-repeating weighted 60-question mock', () => {
    for (const o of OBJECTIVES) expect(questions.filter((q) => q.objective === o.id).length, o.id).toBeGreaterThanOrEqual(4);
    const need = { fundamentals: 26, orchestration: 17, delivery: 10, architecture: 7 };
    for (const [d, n] of Object.entries(need)) expect(questions.filter((q) => q.domain === d).length, d).toBeGreaterThanOrEqual(n);
  });
  it('spreads correct answers across positions (no "always B")', () => {
    const counts = [0, 0, 0, 0];
    for (const q of questions.filter((x) => x.type === 'single')) counts[Math.min(3, q.answer[0])]++;
    const total = counts.reduce((a, b) => a + b, 0);
    for (const c of counts) expect(c / total).toBeGreaterThan(0.12);
  });
});

describe('practice content', () => {
  it('meets release minimums', () => {
    expect(terminalChallenges.length).toBeGreaterThanOrEqual(5);
    expect(yamlChallenges.length).toBeGreaterThanOrEqual(5);
    expect(troubleshootingScenarios.length).toBeGreaterThanOrEqual(5);
    expect(labs.length).toBeGreaterThanOrEqual(15);
    expect(labs.filter((l) => l.status === 'full').length).toBeGreaterThanOrEqual(5);
    expect(flashcards.length).toBeGreaterThanOrEqual(50);
    expect(glossary.length).toBeGreaterThanOrEqual(50);
  });
  it('all ids are unique across practice items', () => {
    const ids = [...terminalChallenges, ...yamlChallenges, ...troubleshootingScenarios, ...labs, ...decisionGames, ...comparisons, ...flashcards].map((x) => x.id);
    expect(unique(ids)).toBe(true);
  });
  it.each(yamlChallenges.map((c) => [c.id, c] as const))('YAML %s: starter fails, solution passes', (_, c) => {
    expect(checkYamlChallenge(c.starter, c.checks).passed).toBe(false);
    const sol = checkYamlChallenge(c.solution, c.checks);
    expect(sol.parseError).toBeUndefined();
    expect(sol.results.filter((r) => !r.passed)).toEqual([]);
    expect(sol.passed).toBe(true);
  });
  it.each(terminalChallenges.map((c) => [c.id, c] as const))('terminal %s: every expectation is reachable by a canonical command', (_, c) => {
    expect(lessonIds.has(c.lessonId)).toBe(true);
    for (const step of c.steps) {
      expect(step.expect.length).toBeGreaterThan(0);
      for (const e of step.expect) {
        const parts = ['kubectl', e.verb, e.subcommand, e.resource && e.name ? `${e.resource}/${e.name}` : (e.resource ?? e.name)].filter(Boolean);
        if (e.verb === 'logs' || e.verb === 'exec') parts.splice(2, 1, e.name ?? '');
        if (e.namespace) parts.push('--namespace', e.namespace);
        for (const [k, v] of Object.entries(e.flags ?? {})) parts.push(v === '' ? `--${k}` : `--${k}=${v}`);
        const cmd = parts.join(' ');
        const parsed = parseKubectl(cmd);
        expect(parsed.ok, cmd).toBe(true);
        if (parsed.ok) expect(matchesExpectation(parsed.cmd, e), `${cmd} vs ${JSON.stringify(e)}`).toBe(true);
      }
    }
  });
  it.each(troubleshootingScenarios.map((s) => [s.id, s] as const))('troubleshooting %s: one correct option per stage, full method', (_, s) => {
    expect(s.stages.map((x) => x.phase)).toEqual(expect.arrayContaining(['hypothesis', 'investigation', 'solution']));
    for (const st of s.stages) expect(st.options.filter((o) => o.correct)).toHaveLength(1);
    expect(lessonIds.has(s.lessonId)).toBe(true);
  });
  it('decision games have valid answers', () => {
    for (const g of decisionGames) expect(g.answer >= 0 && g.answer < g.options.length).toBe(true);
  });
  it('labs are fully specified and reference real objectives', () => {
    for (const l of labs) {
      for (const o of l.objectives) expect(objectiveIds.has(o)).toBe(true);
      expect(l.tasks.length).toBeGreaterThan(0);
      expect(l.cleanup.length).toBeGreaterThan(0);
      if (l.status === 'full') {
        expect(l.validation.length).toBeGreaterThan(0);
        expect(l.tasks.every((t) => t.commands.length > 0 || t.instructions.length > 0)).toBe(true);
      }
    }
  });
});

describe('reference content', () => {
  it('cross-references resolve', () => {
    for (const f of flashcards) expect(lessonIds.has(f.lessonId), f.id).toBe(true);
    for (const c of comparisons) expect(lessonIds.has(c.lessonId), c.id).toBe(true);
    const terms = new Set(glossary.map((g) => g.term));
    for (const g of glossary) {
      if (g.lessonId) expect(lessonIds.has(g.lessonId), g.term).toBe(true);
      for (const r of g.related ?? []) expect(terms.has(r), `${g.term} → ${r}`).toBe(true);
    }
  });
  it('resources and ecosystem links are https', () => {
    for (const r of resources) expect(urlOk(r.url), r.url).toBe(true);
    for (const p of ecosystemProjects) expect(urlOk(p.url), p.url).toBe(true);
  });
  it('every objective has at least one lesson (coverage matrix has no gaps)', () => {
    for (const o of OBJECTIVES) expect(lessons.some((l) => l.objectives.includes(o.id)), o.id).toBe(true);
  });
});
