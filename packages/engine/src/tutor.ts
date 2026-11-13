import { lessonById, questionById, yamlChallenges, terminalChallenges, troubleshootingScenarios, labs } from '@kcna/content';
import type { SearchHit, SearchIndex } from './search';
import { parseManifests } from './yamlcheck';

export const TUTOR_MODES = ['explain', 'socratic', 'exam-coach', 'troubleshoot', 'yaml-review', 'revision'] as const;
export type TutorMode = (typeof TUTOR_MODES)[number];

export const TUTOR_LIMITS = {
  maxMessages: 12,
  maxUserChars: 2000,
  maxAssistantChars: 4000,
  maxYamlChars: 6000,
  maxPerformanceChars: 1500,
  maxLabErrorChars: 2000,
  maxPageChars: 80,
  retrievalDocs: 4,
  snippetChars: 600,
} as const;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TutorContext {
  lessonId?: string;
  questionId?: string;
  selected?: number[];
  yaml?: string;
  performance?: string;
  /** what the learner is looking at, e.g. "diagram:cluster-architecture", "terminal:term-crashloop" */
  page?: string;
  labError?: string;
}

export interface TutorRequest {
  mode: TutorMode;
  level: 'beginner' | 'technical';
  messages: ChatMessage[];
  context: TutorContext;
}

export interface TutorSource {
  title: string;
  href: string;
  url?: string;
}

type V<T> = { ok: true; value: T } | { ok: false; error: string };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ID = /^[a-z0-9:-]{1,80}$/;

/** Strict validation of an untrusted tutor request body. */
export function validateTutorRequest(body: unknown): V<TutorRequest> {
  if (!isObj(body)) return { ok: false, error: 'Body must be a JSON object.' };
  const mode = body.mode ?? 'explain';
  if (typeof mode !== 'string' || !(TUTOR_MODES as readonly string[]).includes(mode)) return { ok: false, error: 'Unknown tutor mode.' };
  const level = body.level ?? 'beginner';
  if (level !== 'beginner' && level !== 'technical') return { ok: false, error: 'level must be beginner or technical.' };
  if (!Array.isArray(body.messages) || body.messages.length === 0) return { ok: false, error: 'messages must be a non-empty array.' };
  const L = TUTOR_LIMITS;
  const messages: ChatMessage[] = [];
  for (const m of body.messages.slice(-L.maxMessages)) {
    if (!isObj(m) || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string')
      return { ok: false, error: 'Each message needs role (user|assistant) and string content.' };
    const max = m.role === 'user' ? L.maxUserChars : L.maxAssistantChars;
    if (m.role === 'user' && m.content.length > max) return { ok: false, error: `Messages are limited to ${max} characters.` };
    const content = m.content.slice(0, max).trim();
    if (!content) return { ok: false, error: 'Messages must not be empty.' };
    messages.push({ role: m.role, content });
  }
  if (messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') return { ok: false, error: 'The last message must come from the user.' };

  const ctx: TutorContext = {};
  const c = body.context;
  if (c !== undefined) {
    if (!isObj(c)) return { ok: false, error: 'context must be an object.' };
    if (c.lessonId !== undefined) {
      if (typeof c.lessonId !== 'string' || !ID.test(c.lessonId) || !lessonById(c.lessonId)) return { ok: false, error: 'Unknown lessonId.' };
      ctx.lessonId = c.lessonId;
    }
    if (c.questionId !== undefined) {
      if (typeof c.questionId !== 'string' || !questionById(c.questionId)) return { ok: false, error: 'Unknown questionId.' };
      ctx.questionId = c.questionId;
      if (c.selected !== undefined) {
        const q = questionById(c.questionId)!;
        if (!Array.isArray(c.selected) || c.selected.length > q.choices.length || !c.selected.every((i) => Number.isInteger(i) && i >= 0 && i < q.choices.length))
          return { ok: false, error: 'selected must be valid choice indices.' };
        ctx.selected = c.selected as number[];
      }
    }
    if (c.yaml !== undefined) {
      if (typeof c.yaml !== 'string' || c.yaml.length > L.maxYamlChars) return { ok: false, error: `YAML is limited to ${L.maxYamlChars} characters.` };
      ctx.yaml = c.yaml;
    }
    if (c.performance !== undefined) {
      if (typeof c.performance !== 'string') return { ok: false, error: 'performance must be a string.' };
      ctx.performance = c.performance.slice(0, L.maxPerformanceChars);
    }
    if (c.page !== undefined) {
      if (typeof c.page !== 'string' || c.page.length > L.maxPageChars) return { ok: false, error: 'page is invalid.' };
      ctx.page = c.page;
    }
    if (c.labError !== undefined) {
      if (typeof c.labError !== 'string') return { ok: false, error: 'labError must be a string.' };
      ctx.labError = c.labError.slice(0, L.maxLabErrorChars);
    }
  }
  return { ok: true, value: { mode: mode as TutorMode, level, messages, context: ctx } };
}

const MODE_INSTRUCTIONS: Record<TutorMode, string> = {
  explain:
    'MODE: Explain. Teach the concept clearly: start with a one-sentence answer, then how it works, then a concrete example (YAML or kubectl if useful). End with one short question that checks understanding.',
  socratic:
    'MODE: Socratic. Do NOT give the full answer. Ask one or two guiding questions at a time that lead the learner to reason it out, building on what they said. Confirm or gently correct their reasoning. Reveal the answer only if they explicitly ask for it.',
  'exam-coach':
    'MODE: Exam coach. Focus strictly on what the KCNA exam expects. Name the tested concept, the common misconception or trap, and why each wrong option is wrong. Keep it brief and exam-oriented; label anything deeper as "beyond KCNA".',
  troubleshoot:
    'MODE: Troubleshooting. Work through Symptom → Hypothesis → Investigation → Evidence → Solution. Ask what the learner observes and suggest the next kubectl command to gather evidence. Do not reveal the final fix until the evidence supports it or the learner asks for it.',
  'yaml-review':
    'MODE: YAML review. Explain what the manifest does, field by field where it matters, then list problems. Treat the deterministic validator findings below as facts. Never invent fields; if unsure whether a field exists, say so.',
  revision:
    "MODE: Revision coach. Use the learner's performance summary to explain WHY specific topics are recommended, then run a short focused revision: a key-idea recap and 2-3 quick practice questions (answers hidden until the learner replies).",
};

export const SYSTEM_RULES = `You are the KCNA Tutor inside the KCNA Interactive Learning Lab, helping a learner prepare for the CNCF Kubernetes and Cloud Native Associate exam.
Rules:
- Ground answers in the REFERENCE MATERIAL supplied with the question; cite it inline as [1], [2]. If the material does not cover something, say so and answer cautiously from general Kubernetes knowledge, marking it "(general knowledge — verify in the docs)".
- Never invent kubectl commands, flags, API fields or documentation links. Only mention URLs that appear in the reference material.
- Prefer the reference material over your own memory whenever they differ.
- Be precise about these frequently confused facts:
  * When a container crashes, the kubelet restarts that container in place inside the same Pod (same Pod name and IP; RESTARTS increases; repeated crashes show CrashLoopBackOff). Files in the container's writable layer are lost on restart; only volumes persist. A controller creates a replacement Pod only when the Pod object is deleted or evicted, or its node is lost.
  * Roll back a Deployment with \`kubectl rollout undo deployment/<name>\`; deleting a Deployment deletes its Pods.
  * Secrets are base64-encoded, not encrypted, by default.
  * The scheduler only assigns Pods to nodes; the kubelet starts containers.
- When something goes beyond the KCNA exam, label it "(beyond KCNA)".
- If an AUTHORITATIVE ANSWER is provided, it is correct. Never contradict it; explain it.
- Say when you are uncertain. Keep answers focused: usually under 200 words. Use short paragraphs, bullet lists and fenced code blocks.
- Stay on Kubernetes, cloud-native and KCNA study topics; politely decline unrelated requests.`;

export function systemPrompt(mode: TutorMode, level: TutorRequest['level']): string {
  const lvl =
    level === 'beginner'
      ? 'LEVEL: Beginner — use plain language and an everyday analogy before technical detail.'
      : 'LEVEL: Technical — use precise terminology and mention the relevant API objects and fields.';
  return `${SYSTEM_RULES}\n\n${MODE_INSTRUCTIONS[mode]}\n${lvl}`;
}

/** Learner vocabulary → the terms the lessons actually use (BM25 is lexical). */
const QUERY_EXPANSIONS: [RegExp, string][] = [
  [/\bcrash(es|ed|ing)?\b|\bdies?\b|\bkeeps? (dying|failing)\b/i, 'container restart restartPolicy CrashLoopBackOff exits back-off kubelet'],
  [/\broll ?back|\brevert|\bundo\b/i, 'rollout undo revision history ReplicaSet'],
  [/\bexpose|\breach(able)?\b|\baccess (my|the) app/i, 'Service ClusterIP NodePort LoadBalancer Ingress'],
  [/\bpersist|\bkeep (my |the )?data|\blose data|\bdata loss/i, 'PersistentVolume PersistentVolumeClaim volume storage'],
  [/\bpermission|\bforbidden|\bnot allowed|\bwho can\b/i, 'RBAC Role RoleBinding ServiceAccount authorization'],
  [/\bslow|\blatency/i, 'latency metrics traces observability'],
  [/\bstuck\b|\bpending\b|\bwon'?t (start|schedule)/i, 'Pending scheduling FailedScheduling events describe'],
  [/\bscale|\bmore (copies|replicas)|\bautoscal/i, 'replicas scale HorizontalPodAutoscaler'],
  [/\bpassword|\bcredential|\bapi key/i, 'Secret ConfigMap'],
  [/\bhealth ?check|\bnot ready\b/i, 'readiness liveness probe'],
];

export function expandQuery(q: string): string {
  const extra = QUERY_EXPANSIONS.filter(([re]) => re.test(q)).map(([, t]) => t);
  return extra.length ? `${q} ${extra.join(' ')}` : q;
}

/** Build the retrieval query: the latest user turn plus the previous one for follow-ups ("what about if it crashes?"). */
export function retrievalQuery(req: TutorRequest): string {
  const users = req.messages.filter((m) => m.role === 'user');
  const last = users[users.length - 1]?.content ?? '';
  const prev = users.length > 1 ? users[users.length - 2].content : '';
  const lesson = req.context.lessonId ? lessonById(req.context.lessonId)?.title ?? '' : '';
  const q = req.context.questionId ? questionById(req.context.questionId)?.prompt ?? '' : '';
  // short follow-ups lean on the previous turn
  return [expandQuery(last), last.length < 80 ? prev : '', lesson, q.slice(0, 200)].filter(Boolean).join(' ');
}

export function retrieve(index: SearchIndex, req: TutorRequest): SearchHit[] {
  return index.search(retrievalQuery(req), { limit: TUTOR_LIMITS.retrievalDocs, boostLesson: req.context.lessonId });
}

const letter = (i: number) => String.fromCharCode(65 + i);

/** Context block appended to the latest user turn (keeps the system prompt static for prompt caching). */
export function contextBlock(req: TutorRequest, hits: SearchHit[]): { text: string; sources: TutorSource[] } {
  const parts: string[] = [];
  const sources: TutorSource[] = [];
  const seen = new Set<string>();
  hits.forEach((h, i) => {
    const snippet = h.doc.text.replace(/\s+/g, ' ').slice(0, TUTOR_LIMITS.snippetChars);
    parts.push(`[${i + 1}] ${h.doc.title}\n${snippet}`);
    sources.push({ title: h.doc.title, href: h.doc.href });
    for (const r of h.doc.refs ?? [])
      if (!seen.has(r.url) && sources.length < 10) {
        sources.push({ title: r.title, href: r.url, url: r.url });
        seen.add(r.url);
      }
  });
  const ctx = req.context;
  const extra: string[] = [];
  if (ctx.lessonId) {
    const l = lessonById(ctx.lessonId)!;
    extra.push(`CURRENT LESSON: ${l.title} (scope: ${l.scope}). Summary: ${l.summary}`);
  }
  if (ctx.page) {
    const [kind, id] = ctx.page.split(':');
    const item =
      kind === 'terminal' ? terminalChallenges.find((t) => t.id === id)?.title
      : kind === 'yaml' ? yamlChallenges.find((t) => t.id === id)?.title
      : kind === 'troubleshoot' ? troubleshootingScenarios.find((t) => t.id === id)?.title
      : kind === 'lab' ? labs.find((t) => t.id === id)?.title
      : id;
    extra.push(`LEARNER IS VIEWING: ${kind}${item ? ` — ${item}` : ''}`);
  }
  if (ctx.questionId) {
    const q = questionById(ctx.questionId)!;
    const choices = q.choices.map((c, i) => `${letter(i)}. ${c}`).join('\n');
    const sel = ctx.selected?.length ? ctx.selected.map(letter).join(', ') : 'nothing';
    extra.push(
      `PRACTICE QUESTION (unofficial, original):\n${q.prompt}\n${choices}\nLearner selected: ${sel}\nAUTHORITATIVE ANSWER: ${q.answer.map(letter).join(', ')}\nOfficial explanation: ${q.explanation}\nPer-option notes:\n${q.choiceRationale.map((r, i) => `${letter(i)}: ${r}`).join('\n')}`,
    );
  }
  if (ctx.yaml) {
    const report = parseManifests(ctx.yaml);
    const findings = report.parsed
      ? report.findings.map((f) => `- ${f.level.toUpperCase()}: ${f.message}${f.path ? ` (${f.path})` : ''}`).join('\n') || '- No issues found by the validator.'
      : `- ${report.error}`;
    extra.push(`MANIFEST:\n\`\`\`yaml\n${ctx.yaml}\n\`\`\`\nDETERMINISTIC VALIDATOR FINDINGS:\n${findings}`);
  }
  if (ctx.labError) extra.push(`LAB ERROR OUTPUT FROM THE LEARNER:\n\`\`\`\n${ctx.labError}\n\`\`\``);
  if (ctx.performance) extra.push(`LEARNER PERFORMANCE SUMMARY (from local progress):\n${ctx.performance}`);
  const text = [parts.length ? `REFERENCE MATERIAL:\n${parts.join('\n\n')}` : 'REFERENCE MATERIAL: none matched.', ...extra].join('\n\n');
  return { text, sources };
}

/** Final message list for an OpenAI-compatible chat endpoint. */
export function buildChat(req: TutorRequest, hits: SearchHit[]): { messages: { role: 'system' | 'user' | 'assistant'; content: string }[]; sources: TutorSource[] } {
  const { text, sources } = contextBlock(req, hits);
  const history = req.messages.slice(0, -1);
  const last = req.messages[req.messages.length - 1];
  return {
    messages: [
      { role: 'system', content: systemPrompt(req.mode, req.level) },
      ...history,
      { role: 'user', content: `${text}\n\n---\nLEARNER: ${last.content}` },
    ],
    sources,
  };
}

/** Remove any reasoning traces some models emit. */
export function cleanModelOutput(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^\s*<think>[\s\S]*$/, '').trimStart();
}
