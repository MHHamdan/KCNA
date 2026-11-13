// Content schema for the KCNA Interactive Learning Lab.
// Every learning item maps to at least one official KCNA competency (ObjectiveId).

export type DomainId = 'fundamentals' | 'orchestration' | 'delivery' | 'architecture';

export type ObjectiveId =
  | 'kf-core'
  | 'kf-admin'
  | 'kf-scheduling'
  | 'kf-containerization'
  | 'co-networking'
  | 'co-security'
  | 'co-troubleshooting'
  | 'co-storage'
  | 'cad-delivery'
  | 'cad-debugging'
  | 'cna-observability'
  | 'cna-ecosystem'
  | 'cna-community';

/**
 * kcna       – inside the KCNA exam scope
 * foundation – prerequisite knowledge that the exam assumes
 * beyond     – deeper CKA/CKAD/DevOps material, not required for KCNA
 */
export type Scope = 'kcna' | 'foundation' | 'beyond';

export interface Reference {
  title: string;
  url: string;
}

export interface Domain {
  id: DomainId;
  name: string;
  weight: number; // percent of exam
  objectives: ObjectiveId[];
}

export interface Objective {
  id: ObjectiveId;
  domain: DomainId;
  name: string;
  description: string;
}

export interface Stage {
  id: number;
  title: string;
  goal: string;
}

/** Text fields accept a small, safe Markdown subset: paragraphs, **bold**, `code`, - lists, ``` fences. */
export type Md = string;

export interface Lesson {
  id: string;
  title: string;
  stage: number;
  order: number;
  objectives: ObjectiveId[];
  scope: Scope;
  estMinutes: number;
  summary: string;
  what: Md;
  why: Md;
  problem: Md;
  how: Md;
  components: { name: string; description: Md }[];
  misconceptions: { myth: string; reality: Md }[];
  example: { title: string; description: Md; code?: string; language?: 'yaml' | 'bash' | 'text' | 'json' };
  diagram?: DiagramId;
  exercise: { prompt: Md; solution: Md };
  faq: { q: string; a: Md }[];
  keyTerms: string[];
  /** "beyond the exam" depth note, clearly marked as optional. */
  deeper?: Md;
  references: Reference[];
}

export type DiagramId =
  | 'cluster-architecture'
  | 'request-flow'
  | 'reconciliation-loop'
  | 'deployment-hierarchy'
  | 'service-networking'
  | 'ingress-flow'
  | 'storage-binding'
  | 'rbac-model'
  | 'observability-pillars'
  | 'gitops-flow'
  | 'container-layers';

export interface Question {
  id: string;
  domain: DomainId;
  objective: ObjectiveId;
  lessonId: string;
  difficulty: 1 | 2 | 3;
  /** single = exactly one correct; multi = "select all that apply" (2+ correct). */
  type: 'single' | 'multi';
  prompt: Md;
  choices: string[];
  /** zero-based indices of correct choices */
  answer: number[];
  explanation: Md;
  /** one entry per choice explaining why it is right or wrong */
  choiceRationale: string[];
  references: Reference[];
  tags: string[];
}

export interface Flashcard {
  id: string;
  front: Md;
  back: Md;
  objective: ObjectiveId;
  lessonId: string;
}

export interface GlossaryTerm {
  term: string;
  definition: Md;
  objective: ObjectiveId;
  lessonId?: string;
  related?: string[];
}

export interface Comparison {
  id: string;
  a: string;
  b: string;
  /** optional third item, e.g. Metrics vs Logs vs Traces */
  c?: string;
  objective: ObjectiveId;
  lessonId: string;
  rows: { aspect: string; a: string; b: string; c?: string }[];
  rule: Md; // one-sentence rule of thumb
  examTrap: Md;
}

/** A simulated kubectl invocation the terminal trainer accepts for a step. */
export interface KubectlExpectation {
  verb: string; // get, describe, logs, apply, create, delete, expose, scale, rollout, run, exec, top, explain, edit, set, label, config, auth
  /** canonical resource kind plural lower-case e.g. pods, deployments, services; optional for verbs like logs */
  resource?: string;
  /** sub-command for rollout/config/auth e.g. 'status', 'undo', 'history', 'can-i', 'get-contexts' */
  subcommand?: string;
  name?: string;
  namespace?: string;
  /** canonical long flag name without dashes -> required value ('' = presence only) */
  flags?: Record<string, string>;
}

export interface TerminalChallenge {
  id: string;
  title: string;
  objective: ObjectiveId;
  lessonId: string;
  difficulty: 1 | 2 | 3;
  scenario: Md;
  steps: {
    task: Md;
    expect: KubectlExpectation[];
    output: string; // simulated output printed on success
    hint: string;
    explanation: Md;
  }[];
}

export type YamlCheck =
  | { path: string; op: 'equals'; value: string | number | boolean; message: string }
  | { path: string; op: 'exists'; message: string }
  | { path: string; op: 'absent'; message: string }
  | { path: string; op: 'matches'; value: string; message: string }
  | { path: string; op: 'oneOf'; value: (string | number)[]; message: string }
  | { path: string; op: 'gte'; value: number; message: string }
  | { op: 'selectorMatchesTemplate'; message: string }
  | { op: 'servicePortMatchesContainer'; message: string };

export interface YamlChallenge {
  id: string;
  title: string;
  objective: ObjectiveId;
  lessonId: string;
  kind: 'fix' | 'complete';
  difficulty: 1 | 2 | 3;
  instructions: Md;
  starter: string;
  /** Paths use dot notation; arrays use [index], e.g. spec.template.spec.containers[0].image */
  checks: YamlCheck[];
  solution: string;
  explanation: Md;
}

export interface TroubleshootingScenario {
  id: string;
  title: string;
  objective: ObjectiveId;
  lessonId: string;
  difficulty: 1 | 2 | 3;
  symptom: Md;
  /** simulated cluster output shown up front */
  evidence: { command: string; output: string }[];
  stages: {
    phase: 'hypothesis' | 'investigation' | 'evidence' | 'solution';
    question: Md;
    options: { text: string; correct: boolean; feedback: Md }[];
    /** extra simulated output revealed after answering correctly */
    reveal?: { command: string; output: string };
  }[];
  takeaway: Md;
  references: Reference[];
}

export interface Lab {
  id: string;
  title: string;
  objectives: ObjectiveId[];
  scope: Scope;
  /** full = complete walk-through tested on kind; design = outline for a future milestone */
  status: 'full' | 'design';
  environment: 'kind' | 'minikube' | 'kind-or-minikube';
  estMinutes: number;
  objective: Md;
  prerequisites: string[];
  architecture: Md;
  tasks: { title: string; instructions: Md; commands: string[]; expected?: string; hint?: Md }[];
  validation: { description: string; command: string; expected: string }[];
  troubleshooting: { symptom: string; fix: Md }[];
  cleanup: string[];
  references: Reference[];
}

export interface DecisionGame {
  id: string;
  objective: ObjectiveId;
  scenario: Md;
  options: string[];
  answer: number;
  explanation: Md;
}

export interface Resource {
  title: string;
  url: string;
  provider: string;
  topic: string;
  cost: 'free' | 'free-tier' | 'free-audit';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  objectives: ObjectiveId[];
  sequence: number; // suggested study order
  note?: string;
}

export interface EcosystemProject {
  name: string;
  category: string;
  /** CNCF maturity as last verified; see VERIFIED_AT in ecosystem.ts */
  maturity: 'graduated' | 'incubating' | 'sandbox' | 'non-cncf';
  purpose: string;
  examRelevance: 'core' | 'recognize' | 'optional';
  url: string;
}
