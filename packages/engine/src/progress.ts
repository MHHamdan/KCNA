import type { DomainId, ObjectiveId } from '@kcna/content';
import type { CardState } from './srs';

export const PROGRESS_VERSION = 1;
export const MAX_ATTEMPTS = 5000;
export const MAX_EXAMS = 200;
export const MAX_TUTOR_MESSAGES = 40;

export interface Attempt {
  qid: string;
  objective: ObjectiveId;
  correct: boolean;
  /** epoch ms */
  at: number;
  source: 'quiz' | 'exam' | 'review';
  selected?: number[];
}

export interface ExamRecord {
  id: string;
  mode: 'full' | 'short' | 'domain';
  startedAt: number;
  finishedAt: number;
  durationSec: number;
  timeLimitSec: number;
  questionIds: string[];
  answers: Record<string, number[]>;
  flagged: string[];
  score: number; // 0..1
  byDomain: Partial<Record<DomainId, { correct: number; total: number }>>;
}

export interface Preferences {
  theme: 'system' | 'light' | 'dark';
  tutorLevel: 'beginner' | 'technical';
  saveTutorHistory: boolean;
  dailyGoalMinutes: number;
  examDate?: string; // YYYY-MM-DD
}

export interface TutorTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface Progress {
  version: number;
  createdAt: number;
  updatedAt: number;
  lessonsCompleted: Record<string, number>;
  labsCompleted: Record<string, number>;
  /** terminal / yaml / troubleshooting / decision items, keyed by item id */
  practiceCompleted: Record<string, number>;
  attempts: Attempt[];
  exams: ExamRecord[];
  cards: Record<string, CardState>;
  /** YYYY-MM-DD -> number of learning events that day */
  activity: Record<string, number>;
  prefs: Preferences;
  tutorHistory: TutorTurn[];
}

export function emptyProgress(now = Date.now()): Progress {
  return {
    version: PROGRESS_VERSION,
    createdAt: now,
    updatedAt: now,
    lessonsCompleted: {},
    labsCompleted: {},
    practiceCompleted: {},
    attempts: [],
    exams: [],
    cards: {},
    activity: {},
    prefs: { theme: 'system', tutorLevel: 'beginner', saveTutorHistory: false, dailyGoalMinutes: 30 },
    tutorHistory: [],
  };
}

export const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

export function recordActivity(p: Progress, now = Date.now()): Progress {
  const k = dayKey(now);
  return { ...p, updatedAt: now, activity: { ...p.activity, [k]: (p.activity[k] ?? 0) + 1 } };
}

export function addAttempts(p: Progress, attempts: Attempt[], now = Date.now()): Progress {
  const all = [...p.attempts, ...attempts];
  return recordActivity({ ...p, attempts: all.slice(Math.max(0, all.length - MAX_ATTEMPTS)) }, now);
}

export function addExam(p: Progress, exam: ExamRecord, attempts: Attempt[]): Progress {
  const exams = [...p.exams, exam].slice(-MAX_EXAMS);
  return addAttempts({ ...p, exams }, attempts, exam.finishedAt);
}

// ---------- export / import ----------

export interface ExportFile {
  app: 'kcna-interactive-lab';
  exportedAt: string;
  progress: Progress;
}

export function exportProgress(p: Progress, now = new Date()): string {
  const file: ExportFile = { app: 'kcna-interactive-lab', exportedAt: now.toISOString(), progress: p };
  return JSON.stringify(file, null, 2);
}

export class ImportError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumRecord = (v: unknown) => isObj(v) && Object.values(v).every((x) => typeof x === 'number' && Number.isFinite(x));

/** Parse and validate an exported progress file. Unknown fields are dropped. */
export function importProgress(json: string): Progress {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new ImportError('File is not valid JSON.');
  }
  const p = isObj(raw) && raw.app === 'kcna-interactive-lab' ? raw.progress : raw;
  if (!isObj(p)) throw new ImportError('File does not contain KCNA progress data.');
  if (typeof p.version !== 'number' || p.version > PROGRESS_VERSION)
    throw new ImportError(`Unsupported progress version: ${String(p.version)}.`);
  const base = emptyProgress();
  for (const key of ['lessonsCompleted', 'labsCompleted', 'practiceCompleted', 'activity'] as const)
    if (p[key] !== undefined && !isNumRecord(p[key])) throw new ImportError(`Field "${key}" is malformed.`);
  if (p.attempts !== undefined && !Array.isArray(p.attempts)) throw new ImportError('Field "attempts" is malformed.');
  if (p.exams !== undefined && !Array.isArray(p.exams)) throw new ImportError('Field "exams" is malformed.');
  if (p.cards !== undefined && !isObj(p.cards)) throw new ImportError('Field "cards" is malformed.');

  const attempts = ((p.attempts as unknown[]) ?? []).filter(
    (a): a is Attempt =>
      isObj(a) && typeof a.qid === 'string' && typeof a.objective === 'string' && typeof a.correct === 'boolean' && typeof a.at === 'number',
  );
  const exams = ((p.exams as unknown[]) ?? []).filter(
    (e): e is ExamRecord =>
      isObj(e) && typeof e.id === 'string' && typeof e.score === 'number' && Array.isArray(e.questionIds) && typeof e.finishedAt === 'number',
  );
  const cards: Progress['cards'] = {};
  for (const [id, c] of Object.entries((p.cards as Record<string, unknown>) ?? {}))
    if (isObj(c) && typeof c.due === 'number' && typeof c.ef === 'number' && typeof c.interval === 'number')
      cards[id] = c as unknown as CardState;
  const prefs = isObj(p.prefs) ? { ...base.prefs, ...(p.prefs as Partial<Preferences>) } : base.prefs;
  const tutorHistory = Array.isArray(p.tutorHistory)
    ? (p.tutorHistory as unknown[])
        .filter((t): t is TutorTurn => isObj(t) && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
        .slice(-MAX_TUTOR_MESSAGES)
    : [];
  return {
    version: PROGRESS_VERSION,
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : base.createdAt,
    updatedAt: Date.now(),
    lessonsCompleted: (p.lessonsCompleted as Record<string, number>) ?? {},
    labsCompleted: (p.labsCompleted as Record<string, number>) ?? {},
    practiceCompleted: (p.practiceCompleted as Record<string, number>) ?? {},
    activity: (p.activity as Record<string, number>) ?? {},
    attempts: attempts.slice(-MAX_ATTEMPTS),
    exams: exams.slice(-MAX_EXAMS),
    cards,
    prefs,
    tutorHistory,
  };
}

/** Flat CSV of every answered question, for "download study history". */
export function historyCsv(p: Progress): string {
  const rows = [['timestamp', 'question_id', 'objective', 'source', 'correct']];
  for (const a of p.attempts) rows.push([new Date(a.at).toISOString(), a.qid, a.objective, a.source, String(a.correct)]);
  return rows.map((r) => r.join(',')).join('\n');
}
