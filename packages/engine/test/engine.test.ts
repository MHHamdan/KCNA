import { describe, expect, it } from 'vitest';
import { questions, questionById, lessons, type Question } from '@kcna/content';
import {
  SearchIndex,
  addAttempts,
  addExam,
  allocateByWeight,
  buildChat,
  computeReadiness,
  contentIndex,
  dueCards,
  emptyProgress,
  evaluateCommand,
  exportProgress,
  gradeExam,
  importProgress,
  ImportError,
  isCorrect,
  newCard,
  objectiveMastery,
  parseKubectl,
  parseManifests,
  repeatedMistakes,
  retrievalQuery,
  retrieve,
  review,
  selectExamQuestions,
  validateTutorRequest,
  cleanModelOutput,
  factCheck,
  dueQuestionReviews,
  lessonMastered,
  QUESTION_GRADUATE_DAYS,
  checkYamlChallenge,
  type Attempt,
  type ExamRecord,
  type TutorRequest,
} from '../src';

const DAY = 86_400_000;

describe('search', () => {
  const idx = new SearchIndex([
    { id: 'a', kind: 'lesson', title: 'Pods', text: 'A Pod is the smallest deployable unit', href: '#/a' },
    { id: 'b', kind: 'lesson', title: 'Services', text: 'A Service gives Pods a stable virtual IP', href: '#/b' },
    { id: 'c', kind: 'glossary', title: 'kube-proxy', text: 'Programs Service rules on nodes', href: '#/c' },
  ]);
  it('ranks title matches first and stems plurals', () => {
    expect(idx.search('pods')[0].doc.id).toBe('a');
    expect(idx.search('service virtual ip')[0].doc.id).toBe('b');
  });
  it('keeps hyphenated k8s terms searchable', () => {
    expect(idx.search('kube-proxy')[0].doc.id).toBe('c');
    expect(idx.search('proxy')[0].doc.id).toBe('c');
  });
  it('returns nothing for stop words only', () => {
    expect(idx.search('the and of')).toEqual([]);
  });
  it('real content index finds the right lessons', () => {
    const i = contentIndex();
    expect(i.search('CrashLoopBackOff')[0].doc.lessonId).toBeDefined();
    expect(i.search('PersistentVolumeClaim StorageClass').slice(0, 3).map((h) => h.doc.lessonId)).toContain('persistent-volumes-and-csi');
    expect(i.search('RBAC RoleBinding').slice(0, 3).map((h) => h.doc.lessonId)).toContain('authentication-authorization-rbac');
  });
});

describe('exam engine', () => {
  it('allocates 60 questions by official weights', () => {
    expect(allocateByWeight(60)).toEqual({ fundamentals: 26, orchestration: 17, delivery: 10, architecture: 7 });
    const a = allocateByWeight(20);
    expect(Object.values(a).reduce((x, y) => x + y, 0)).toBe(20);
  });
  it('selects a weighted, duplicate-free, reproducible exam', () => {
    const e1 = selectExamQuestions(questions, { total: 60, seed: 42 });
    const e2 = selectExamQuestions(questions, { total: 60, seed: 42 });
    expect(e1.map((q) => q.id)).toEqual(e2.map((q) => q.id));
    expect(new Set(e1.map((q) => q.id)).size).toBe(60);
    const byDomain = (d: string) => e1.filter((q) => q.domain === d).length;
    expect(byDomain('fundamentals')).toBe(26);
    expect(byDomain('orchestration')).toBe(17);
    expect(byDomain('delivery')).toBe(10);
    expect(byDomain('architecture')).toBe(7);
    expect(selectExamQuestions(questions, { total: 60, seed: 7 }).map((q) => q.id)).not.toEqual(e1.map((q) => q.id));
  });
  it('tops up from other domains when a pool is small', () => {
    const small = questions.filter((q) => q.domain !== 'architecture').concat(questions.filter((q) => q.domain === 'architecture').slice(0, 2));
    const e = selectExamQuestions(small, { total: 60, seed: 1 });
    expect(e).toHaveLength(60);
    expect(new Set(e.map((q) => q.id)).size).toBe(60);
  });
  it('domain tests stay in their domain', () => {
    const e = selectExamQuestions(questions, { total: 20, seed: 3, domain: 'delivery' });
    expect(e.every((q) => q.domain === 'delivery')).toBe(true);
  });
  it('scores single and multi-select exactly', () => {
    const multi = { answer: [0, 2] };
    expect(isCorrect(multi, [2, 0])).toBe(true);
    expect(isCorrect(multi, [0])).toBe(false);
    expect(isCorrect(multi, [0, 1, 2])).toBe(false);
    expect(isCorrect({ answer: [1] }, undefined)).toBe(false);
  });
  it('grades exams with domain breakdown, wrong and unanswered lists', () => {
    const qs = questions.slice(0, 4);
    const answers: Record<string, number[]> = { [qs[0].id]: qs[0].answer, [qs[1].id]: [(qs[1].answer[0] + 1) % qs[1].choices.length] };
    const g = gradeExam(qs, answers, 75);
    expect(g.correct).toBe(1);
    expect(g.total).toBe(4);
    expect(g.passed).toBe(false);
    expect(g.wrong).toHaveLength(3);
    expect(g.unanswered).toEqual([qs[2].id, qs[3].id]);
    expect(Object.values(g.byDomain).reduce((a, d) => a + d!.total, 0)).toBe(4);
  });
});

describe('spaced repetition (SM-2)', () => {
  it('grows intervals on success and resets on lapse', () => {
    const t0 = Date.UTC(2026, 0, 1);
    let c = review(newCard(t0), 4, t0);
    expect(c.interval).toBe(1);
    c = review(c, 4, t0 + DAY);
    expect(c.interval).toBe(6);
    c = review(c, 5, t0 + 7 * DAY);
    expect(c.interval).toBeGreaterThan(6);
    const lapsed = review(c, 0, t0 + 30 * DAY);
    expect(lapsed.interval).toBe(0);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.ef).toBeGreaterThanOrEqual(1.3);
  });
  it('lists due cards, new cards included', () => {
    const now = Date.now();
    const cards = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];
    const due = dueCards(cards, { x: { ...newCard(now), due: now + DAY }, y: { ...newCard(now), due: now - 1 } }, now);
    expect(due.map((c) => c.id)).toEqual(['z', 'y']);
  });
});

function attempts(objective: Attempt['objective'], correct: number, wrong: number, at = Date.now()): Attempt[] {
  return [
    ...Array.from({ length: correct }, (_, i) => ({ qid: `${objective}-c${i}`, objective, correct: true, at, source: 'quiz' as const })),
    ...Array.from({ length: wrong }, (_, i) => ({ qid: `${objective}-w${i}`, objective, correct: false, at, source: 'quiz' as const })),
  ];
}

describe('mastery and readiness', () => {
  it('is conservative with little evidence', () => {
    const m = objectiveMastery(attempts('kf-core', 2, 0));
    expect(m['kf-core'].mean).toBeGreaterThan(0.7);
    expect(m['kf-core'].lower).toBeLessThan(0.6);
    const big = objectiveMastery(attempts('kf-core', 40, 0));
    expect(big['kf-core'].lower).toBeGreaterThan(0.9);
  });
  it('decays old evidence', () => {
    const now = Date.now();
    const old = objectiveMastery(attempts('kf-core', 20, 0, now - 120 * DAY), now)['kf-core'];
    const fresh = objectiveMastery(attempts('kf-core', 20, 0, now), now)['kf-core'];
    expect(old.lower).toBeLessThan(fresh.lower);
  });
  it('gives zero mastery and zero index with no evidence', () => {
    const r = computeReadiness(emptyProgress());
    expect(r.index).toBe(0);
    expect(Object.values(r.domains).every((d) => d === 0)).toBe(true);
  });
  it('does not call a learner ready for completing lessons only', () => {
    const p = emptyProgress();
    for (const l of lessons) p.lessonsCompleted[l.id] = Date.now();
    const r = computeReadiness(p);
    expect(r.status).toBe('not-started');
    expect(r.index).toBeLessThan(30);
  });
  it('requires mocks before "ready" even with perfect quiz accuracy', () => {
    let p = emptyProgress();
    for (const q of questions) p = addAttempts(p, [{ qid: q.id, objective: q.objective, correct: true, at: Date.now(), source: 'quiz' }]);
    const r = computeReadiness(p);
    expect(r.status).not.toBe('ready');
    expect(r.checklist.find((c) => c.id === 'mocks')!.met).toBe(false);
    expect(r.plan.some((x) => x.kind === 'mock')).toBe(true);
  });
  it('reaches "ready" with strong, consistent, broad evidence', () => {
    let p = emptyProgress();
    const now = Date.now();
    for (const q of questions) p = addAttempts(p, [{ qid: q.id, objective: q.objective, correct: true, at: now, source: 'quiz' }], now);
    for (let i = 0; i < 3; i++) {
      const rec: ExamRecord = { id: `e${i}`, mode: 'full', startedAt: now - i * DAY, finishedAt: now - i * DAY, durationSec: 3000, timeLimitSec: 5400, questionIds: [], answers: {}, flagged: [], score: 0.88, byDomain: {} };
      p = addExam(p, rec, []);
    }
    for (let i = 0; i < 20; i++) p.cards[`fc-${i}`] = { ef: 2.5, interval: 10, reps: 3, lapses: 0, due: now + 10 * DAY, last: now };
    const r = computeReadiness(p, now);
    expect(r.status).toBe('ready');
    expect(r.index).toBeGreaterThanOrEqual(80);
  });
  it('identifies the weakest domain by expected points lost', () => {
    let p = emptyProgress();
    p = addAttempts(p, [...attempts('kf-core', 20, 2), ...attempts('co-networking', 3, 12), ...attempts('cad-delivery', 10, 1)]);
    const r = computeReadiness(p);
    expect(r.weakObjectives).toContain('co-networking');
    expect(r.plan.some((x) => x.label.includes('Networking'))).toBe(true);
  });
  it('detects repeated mistakes until corrected', () => {
    const t = Date.now();
    const a: Attempt[] = [
      { qid: 'q1', objective: 'kf-core', correct: false, at: t - 3 },
      { qid: 'q1', objective: 'kf-core', correct: false, at: t - 2 },
      { qid: 'q2', objective: 'kf-core', correct: false, at: t - 3 },
      { qid: 'q2', objective: 'kf-core', correct: false, at: t - 2 },
      { qid: 'q2', objective: 'kf-core', correct: true, at: t - 1 },
    ].map((x) => ({ ...x, objective: 'kf-core' as const, source: 'quiz' as const }));
    expect(repeatedMistakes(a).map((r) => r.qid)).toEqual(['q1']);
  });
});

describe('progress persistence', () => {
  it('round-trips through export/import', () => {
    let p = emptyProgress();
    p.lessonsCompleted.pods = 123;
    p = addAttempts(p, attempts('kf-core', 2, 1));
    p.cards['fc-001'] = newCard();
    const back = importProgress(exportProgress(p));
    expect(back.lessonsCompleted).toEqual({ pods: 123 });
    expect(back.attempts).toHaveLength(3);
    expect(back.cards['fc-001']).toBeDefined();
  });
  it('rejects malformed or foreign files with clear errors', () => {
    expect(() => importProgress('not json')).toThrow(ImportError);
    expect(() => importProgress('{"version": 99}')).toThrow(/Unsupported/);
    expect(() => importProgress('{"version":1,"lessonsCompleted":"x"}')).toThrow(/lessonsCompleted/);
  });
  it('drops invalid attempt rows instead of failing', () => {
    const p = importProgress(JSON.stringify({ version: 1, attempts: [{ qid: 'a', objective: 'kf-core', correct: true, at: 1 }, { bogus: true }] }));
    expect(p.attempts).toHaveLength(1);
  });
  it('caps stored attempts', () => {
    let p = emptyProgress();
    p = addAttempts(p, Array.from({ length: 5100 }, (_, i) => ({ qid: `q${i}`, objective: 'kf-core' as const, correct: true, at: i, source: 'quiz' as const })));
    expect(p.attempts).toHaveLength(5000);
    expect(p.attempts[0].qid).toBe('q100');
  });
});

describe('kubectl simulator', () => {
  const exp = [{ verb: 'get', resource: 'pods', namespace: 'shop' }];
  it.each([
    'kubectl get pods -n shop',
    'kubectl get po --namespace shop',
    'kubectl get pod --namespace=shop',
    'kubectl -n shop get pods',
    'k get pods -n shop -o wide',
    'kubectl get pods -A',
  ])('accepts variation: %s', (cmd) => {
    expect(evaluateCommand(cmd, exp).status).toBe('correct');
  });
  it('rejects the wrong namespace / resource with targeted feedback', () => {
    expect(evaluateCommand('kubectl get pods', exp)).toMatchObject({ status: 'wrong', message: expect.stringMatching(/namespace/) });
    expect(evaluateCommand('kubectl get svc -n shop', exp)).toMatchObject({ status: 'wrong', message: expect.stringMatching(/resource/) });
    expect(evaluateCommand('ls -la', exp).status).toBe('parse-error');
  });
  it('parses names in both forms and logs flags', () => {
    const a = parseKubectl('kubectl describe deploy/web');
    const b = parseKubectl('kubectl describe deployment web');
    expect(a.ok && b.ok && a.cmd.resource === b.cmd.resource && a.cmd.name === b.cmd.name).toBe(true);
    const l = parseKubectl('kubectl logs web-123 -p -c app');
    expect(l.ok && l.cmd.flags.previous === '' && l.cmd.flags.container === 'app' && l.cmd.name === 'web-123').toBe(true);
    const f = parseKubectl('kubectl apply -f deploy.yaml');
    expect(f.ok && f.cmd.flags.filename).toBe('deploy.yaml');
    const r = parseKubectl('kubectl rollout undo deployment/web --to-revision=2');
    expect(r.ok && r.cmd.subcommand === 'undo' && r.cmd.resource === 'deployments' && r.cmd.flags['to-revision'] === '2').toBe(true);
    const s = parseKubectl('kubectl scale deployment web --replicas 5');
    expect(s.ok && s.cmd.flags.replicas).toBe('5');
  });
  it('checks flag values when required', () => {
    const e = [{ verb: 'scale', resource: 'deployments', name: 'web', flags: { replicas: '5' } }];
    expect(evaluateCommand('kubectl scale deploy web --replicas=5', e).status).toBe('correct');
    expect(evaluateCommand('kubectl scale deploy web --replicas=3', e).status).toBe('wrong');
  });
});

describe('YAML validation', () => {
  const good = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 2
  selector:
    matchLabels: { app: web }
  template:
    metadata:
      labels: { app: web }
    spec:
      containers:
        - name: web
          image: nginx:1.27
          resources:
            requests: { cpu: 100m, memory: 64Mi }
`;
  it('accepts a valid Deployment', () => {
    const r = parseManifests(good);
    expect(r.parsed).toBe(true);
    expect(r.findings.filter((f) => f.level === 'error')).toEqual([]);
  });
  it('flags selector mismatch, missing image, bad quantity and wrong apiVersion', () => {
    const bad = good.replace('labels: { app: web }', 'labels: { app: api }').replace('image: nginx:1.27', 'image: ""').replace('cpu: 100m', 'cpu: lots').replace('apps/v1', 'v1');
    const msgs = parseManifests(bad).findings.map((f) => f.message).join('\n');
    expect(msgs).toMatch(/matchLabels must match/);
    expect(msgs).toMatch(/needs an image/);
    expect(msgs).toMatch(/not a valid quantity/);
    expect(msgs).toMatch(/apps\/v1/);
  });
  it('reports syntax errors with a line number', () => {
    const r = checkYamlChallenge('apiVersion: v1\nkind: Pod\n  metadata: [', []);
    expect(r.parsed).toBe(false);
    expect(r.parseError).toMatch(/line/);
  });
  it('runs challenge checks', () => {
    const r = checkYamlChallenge(good, [
      { path: 'spec.replicas', op: 'gte', value: 2, message: 'replicas' },
      { path: 'spec.template.spec.containers[0].image', op: 'matches', value: '^nginx:', message: 'image' },
      { op: 'selectorMatchesTemplate', message: 'selector' },
    ]);
    expect(r.passed).toBe(true);
  });
});

describe('AI tutor protocol', () => {
  const base = { mode: 'explain', messages: [{ role: 'user', content: 'What is a Pod?' }] };
  it('validates and normalises requests', () => {
    const v = validateTutorRequest(base);
    expect(v.ok && v.value.level).toBe('beginner');
    expect(validateTutorRequest({ ...base, mode: 'jailbreak' }).ok).toBe(false);
    expect(validateTutorRequest({ mode: 'explain', messages: [] }).ok).toBe(false);
    expect(validateTutorRequest({ mode: 'explain', messages: [{ role: 'system', content: 'x' }] }).ok).toBe(false);
    expect(validateTutorRequest({ ...base, messages: [{ role: 'user', content: 'x'.repeat(2001) }] }).ok).toBe(false);
    expect(validateTutorRequest({ ...base, context: { lessonId: '../etc/passwd' } }).ok).toBe(false);
    expect(validateTutorRequest({ ...base, context: { questionId: 'q-unknown' } }).ok).toBe(false);
    expect(validateTutorRequest({ ...base, context: { yaml: 'a'.repeat(7000) } }).ok).toBe(false);
  });
  it('bounds conversation history and requires a final user turn', () => {
    const msgs: { role: string; content: string }[] = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
    msgs.push({ role: 'user', content: 'last' });
    const v = validateTutorRequest({ mode: 'explain', messages: msgs });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.value.messages.length).toBeLessThanOrEqual(12);
      expect(v.value.messages[0].role).toBe('user');
      expect(v.value.messages.at(-1)!.content).toBe('last');
    }
    expect(validateTutorRequest({ mode: 'explain', messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] }).ok).toBe(false);
  });
  it('carries prior turns so follow-ups keep context', () => {
    const req = validateTutorRequest({
      mode: 'explain',
      messages: [
        { role: 'user', content: 'What is a Pod?' },
        { role: 'assistant', content: 'A Pod is the smallest deployable unit…' },
        { role: 'user', content: 'Why do we need a Deployment then?' },
      ],
    });
    expect(req.ok).toBe(true);
    if (!req.ok) return;
    const { messages } = buildChat(req.value, retrieve(contentIndex(), req.value));
    expect(messages[0].role).toBe('system');
    expect(messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(messages[1].content).toBe('What is a Pod?');
    expect(messages.at(-1)!.content).toMatch(/LEARNER: Why do we need a Deployment then\?/);
    expect(messages.at(-1)!.content).toMatch(/REFERENCE MATERIAL/);
    // the system prompt is static per mode so llama.cpp can reuse its prompt cache
    expect(messages[0].content).not.toMatch(/REFERENCE MATERIAL:\n/);
  });
  it('uses the previous question for short follow-ups during retrieval', () => {
    const req = { mode: 'explain', level: 'beginner', context: {}, messages: [{ role: 'user', content: 'How do Services pick Pods?' }, { role: 'assistant', content: '…' }, { role: 'user', content: 'and if it fails?' }] } as TutorRequest;
    expect(retrievalQuery(req)).toMatch(/Services pick Pods/);
    const hits = retrieve(contentIndex(), req);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.doc.lessonId === 'services')).toBe(true);
  });
  it('expands learner vocabulary so follow-ups find the right lesson', () => {
    const req = { mode: 'explain', level: 'beginner', context: {}, messages: [{ role: 'user', content: 'Why do we need a Deployment then?' }, { role: 'assistant', content: '…' }, { role: 'user', content: 'What happens if the Pod crashes?' }] } as TutorRequest;
    expect(retrieve(contentIndex(), req).map((h) => h.doc.lessonId)).toContain('pods');
    const rb = { mode: 'explain', level: 'beginner', context: {}, messages: [{ role: 'user', content: 'How do I roll back a bad release?' }] } as TutorRequest;
    expect(retrieve(contentIndex(), rb).map((h) => h.doc.lessonId)).toContain('rollouts-and-deployment-strategies');
  });
  it('boosts the current lesson in retrieval and returns cited sources', () => {
    const v = validateTutorRequest({ mode: 'explain', messages: [{ role: 'user', content: 'what happens on failure?' }], context: { lessonId: 'health-probes' } });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const hits = retrieve(contentIndex(), v.value);
    expect(hits[0].doc.lessonId).toBe('health-probes');
    const { sources } = buildChat(v.value, hits);
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.some((s) => s.url?.startsWith('https://'))).toBe(true);
  });
  it('injects the authoritative answer for "why was I wrong"', () => {
    const q = questions[0] as Question;
    const wrong = (q.answer[0] + 1) % q.choices.length;
    const v = validateTutorRequest({ mode: 'exam-coach', messages: [{ role: 'user', content: 'Why was I wrong?' }], context: { questionId: q.id, selected: [wrong] } });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const { messages } = buildChat(v.value, []);
    const last = messages.at(-1)!.content;
    expect(last).toContain(`AUTHORITATIVE ANSWER: ${q.answer.map((i) => String.fromCharCode(65 + i)).join(', ')}`);
    expect(last).toContain(`Learner selected: ${String.fromCharCode(65 + wrong)}`);
    expect(last).toContain(questionById(q.id)!.explanation.slice(0, 40));
    expect(validateTutorRequest({ mode: 'exam-coach', messages: [{ role: 'user', content: 'x' }], context: { questionId: q.id, selected: [99] } }).ok).toBe(false);
  });
  it('runs the deterministic validator for YAML review', () => {
    const v = validateTutorRequest({ mode: 'yaml-review', messages: [{ role: 'user', content: 'Review' }], context: { yaml: 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: x\nspec:\n  containers:\n    - name: a\n' } });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(buildChat(v.value, []).messages.at(-1)!.content).toMatch(/ERROR: Every container needs an image/);
  });
  it('gives each mode distinct instructions', () => {
    const sys = (mode: string) => {
      const v = validateTutorRequest({ mode, messages: [{ role: 'user', content: 'x' }] });
      return v.ok ? buildChat(v.value, []).messages[0].content : '';
    };
    const all = ['explain', 'socratic', 'exam-coach', 'troubleshoot', 'yaml-review', 'revision'].map(sys);
    expect(new Set(all).size).toBe(6);
    expect(sys('socratic')).toMatch(/Do NOT give the full answer/);
    expect(sys('troubleshoot')).toMatch(/Symptom → Hypothesis → Investigation → Evidence → Solution/);
  });
  it('strips reasoning traces from model output', () => {
    expect(cleanModelOutput('<think>hmm</think>A Pod is…')).toBe('A Pod is…');
    expect(cleanModelOutput('<think>still thinking')).toBe('');
  });
});

describe('fact guard', () => {
  it('flags known misconceptions', () => {
    expect(factCheck('If the Pod crashes, the Deployment controller creates a new Pod with the same spec.').map((n) => n.id)).toContain('crash-means-new-pod');
    expect(factCheck('No data loss: the data inside the container is preserved after a restart.').map((n) => n.id)).toContain('container-restart-data');
    expect(factCheck('To roll back, simply delete the Deployment and re-apply.').map((n) => n.id)).toContain('rollback-by-delete');
    expect(factCheck('Secrets are encrypted by default in etcd.').map((n) => n.id)).toContain('secrets-encrypted');
    expect(factCheck('The scheduler starts the containers on the node.').map((n) => n.id)).toContain('scheduler-starts-containers');
    expect(factCheck('kubectl run nginx creates a Deployment.').map((n) => n.id)).toContain('kubectl-run-deployment');
  });
  it('does not flag correct or negated statements', () => {
    const ok = [
      'The kubelet restarts the crashed container in place; the Pod is not replaced.',
      'Do not delete the Deployment to roll back; use kubectl rollout undo.',
      'Secrets are not encrypted by default, only base64-encoded.',
      'The scheduler assigns Pods to nodes; the kubelet starts containers.',
      'kubectl run creates a single Pod.',
      'Data in a PersistentVolume survives Pod replacement.',
    ];
    for (const t of ok) expect(factCheck(t), t).toEqual([]);
  });
});

describe('spaced review of missed questions', () => {
  const q = questions[0];
  const at = (t: number, correct: boolean) => ({ qid: q.id, objective: q.objective, correct, at: t, source: 'quiz' as const });
  it('schedules a missed question for tomorrow and graduates it after spaced correct answers', () => {
    const t0 = Date.UTC(2026, 0, 1);
    let p = addAttempts(emptyProgress(t0), [at(t0, false)], t0);
    expect(dueQuestionReviews(p, t0)).toEqual([]);
    expect(dueQuestionReviews(p, t0 + 86_400_000)).toEqual([q.id]);
    let t = t0 + 86_400_000;
    for (let i = 0; i < 8 && p.questionReviews[q.id]; i++) {
      p = addAttempts(p, [at(t, true)], t);
      t = p.questionReviews[q.id]?.due ?? t;
    }
    expect(p.questionReviews[q.id]).toBeUndefined();
    expect(QUESTION_GRADUATE_DAYS).toBeGreaterThanOrEqual(14);
  });
  it('a new miss resets the schedule', () => {
    const t0 = Date.UTC(2026, 0, 1);
    let p = addAttempts(emptyProgress(t0), [at(t0, false)], t0);
    p = addAttempts(p, [at(t0 + 86_400_000, true)], t0 + 86_400_000);
    p = addAttempts(p, [at(t0 + 2 * 86_400_000, false)], t0 + 2 * 86_400_000);
    expect(p.questionReviews[q.id].due).toBe(t0 + 3 * 86_400_000);
    expect(p.questionReviews[q.id].lapses).toBeGreaterThanOrEqual(1);
  });
  it('survives export/import', () => {
    const p = addAttempts(emptyProgress(), [at(Date.now(), false)]);
    expect(importProgress(exportProgress(p)).questionReviews[q.id]).toBeDefined();
  });
});

describe('lesson mastery', () => {
  it('requires the latest answer to every knowledge-check question to be correct', () => {
    const checks = questions.filter((x) => x.lessonId === 'pods').sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id)).slice(0, 3);
    let p = emptyProgress();
    p.lessonsCompleted.pods = Date.now();
    expect(lessonMastered(p, 'pods')).toBe(false);
    const t = Date.now();
    p = addAttempts(p, checks.map((c, i) => ({ qid: c.id, objective: c.objective, correct: i > 0, at: t, source: 'quiz' as const })));
    expect(lessonMastered(p, 'pods')).toBe(false);
    p = addAttempts(p, [{ qid: checks[0].id, objective: checks[0].objective, correct: true, at: t + 1, source: 'quiz' as const }]);
    expect(lessonMastered(p, 'pods')).toBe(true);
  });
});
