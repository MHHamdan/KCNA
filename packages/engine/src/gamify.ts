// Habit and motivation layer. Everything is DERIVED from real learning evidence
// in Progress (answers, mastery, labs, designs, stories, games), so XP cannot be
// farmed by clicking and never disagrees with what was actually learned.
import {
  INFRA_TOPICS,
  OBJECTIVES,
  designCases,
  flashcards,
  glossary,
  infraFlashcards,
  infraLessons,
  infraQuestions,
  lessons,
  questions,
  sequencePuzzles,
  type Lesson,
  type Question,
} from '@kcna/content';
import { dayKey, dueQuestionReviews, type Progress } from './progress';
import { dueCards } from './srs';
import { lessonMastered, masteryFor } from './readiness';
import { designCoverage } from './infraReadiness';
import { rng, shuffle } from './exam';

const DAY = 86_400_000;

// ---------------- XP & levels ----------------

export const XP_RULES = {
  correctAnswer: 10,
  wrongAnswer: 3, // effort still counts — mistakes are how you learn
  lessonRead: 30,
  lessonMastered: 70,
  lab: 150,
  practiceItem: 40,
  flashcardStudied: 4,
  solidDesign: 200,
  story: 80,
  mock: 120,
  arenaWinPerLevel: 120,
  daily: 60,
  activity: 15, // sequences, matches, myth busts, explain-backs
} as const;

export function totalXp(p: Progress): number {
  const R = XP_RULES;
  const correct = p.attempts.filter((a) => a.correct).length;
  const mastered = [...lessons, ...infraLessons].filter((l) => lessonMastered(p, l.id)).length;
  const solid = designCases.filter((c) => designCoverage(p, c.id) >= 0.7).length;
  const stories = Object.values(p.behavioralStories).filter((s) => s.story.trim().split(/\s+/).length >= 80).length;
  const counters = Object.values(p.play.counters).reduce((a, b) => a + b, 0);
  return (
    correct * R.correctAnswer +
    (p.attempts.length - correct) * R.wrongAnswer +
    Object.keys(p.lessonsCompleted).length * R.lessonRead +
    mastered * R.lessonMastered +
    Object.keys(p.labsCompleted).length * R.lab +
    Object.keys(p.practiceCompleted).length * R.practiceItem +
    Object.keys(p.cards).length * R.flashcardStudied +
    solid * R.solidDesign +
    stories * R.story +
    p.mockInterviews.length * R.mock +
    p.play.arena.filter((r) => r.won).reduce((s, r) => s + r.level * R.arenaWinPerLevel, 0) +
    Object.keys(p.play.daily).length * R.daily +
    counters * R.activity
  );
}

/** Level n needs 150·n^1.6 cumulative XP — fast early wins, then a long tail. */
export const xpForLevel = (n: number) => Math.round(150 * Math.pow(n, 1.6));

const TITLES = ['Curious Cadet', 'Pod Wrangler', 'Service Seeker', 'Config Keeper', 'Cluster Operator', 'Incident Tamer', 'Reliability Engineer', 'Platform Builder', 'Cloud Architect', 'Distinguished Engineer'];

export function levelInfo(xp: number) {
  let level = 1;
  while (xpForLevel(level) <= xp) level++;
  const floor = level === 1 ? 0 : xpForLevel(level - 1);
  const ceil = xpForLevel(level);
  return { level, title: TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 3))], xp, into: xp - floor, need: ceil - floor, progress: (xp - floor) / (ceil - floor) };
}

// ---------------- streaks & daily goal ----------------

export const DAILY_GOAL_EVENTS = 15;

export function streak(p: Progress, now = Date.now()) {
  const active = (t: number) => (p.activity[dayKey(t)] ?? 0) > 0;
  let current = 0;
  // today not studied yet does not break the streak until tomorrow
  let t = active(now) ? now : now - DAY;
  while (active(t)) {
    current++;
    t -= DAY;
  }
  const days = Object.keys(p.activity).filter((d) => p.activity[d] > 0).sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of days) {
    const ms = Date.parse(d);
    run = prev !== null && ms - prev === DAY ? run + 1 : 1;
    best = Math.max(best, run);
    prev = ms;
  }
  const today = p.activity[dayKey(now)] ?? 0;
  return { current, best: Math.max(best, current), today, goal: DAILY_GOAL_EVENTS, goalMet: today >= DAILY_GOAL_EVENTS, atRisk: !active(now) && current > 0 };
}

// ---------------- achievements ----------------

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number; // 0..1
}

export function achievements(p: Progress, now = Date.now()): Achievement[] {
  const st = streak(p, now);
  const correct = p.attempts.filter((a) => a.correct).length;
  const kcnaMastered = lessons.filter((l) => lessonMastered(p, l.id)).length;
  const infraMastered = infraLessons.filter((l) => lessonMastered(p, l.id)).length;
  const fullMocks = p.exams.filter((e) => e.mode === 'full');
  const arenaWins = (lvl: number) => p.play.arena.filter((r) => r.won && r.level >= lvl).length;
  const flawless = p.play.arena.some((r) => r.won && r.hints === 0 && r.level >= 2);
  const solid = designCases.filter((c) => designCoverage(p, c.id) >= 0.7).length;
  const c = p.play.counters;
  const a = (id: string, icon: string, title: string, description: string, value: number, target: number): Achievement => ({
    id,
    icon,
    title,
    description,
    unlocked: value >= target,
    progress: Math.min(1, value / target),
  });
  return [
    a('first-steps', '🌱', 'First steps', 'Answer your first 10 questions', p.attempts.length, 10),
    a('centurion', '💯', 'Centurion', '100 correct answers', correct, 100),
    a('thousand', '🏔️', 'Thousand-answer climb', '1,000 correct answers', correct, 1000),
    a('streak-7', '🔥', 'On fire', 'Study 7 days in a row', st.best, 7),
    a('streak-30', '☄️', 'Unstoppable', 'Study 30 days in a row', st.best, 30),
    a('streak-100', '🌌', 'Never stop learning', 'Study 100 days in a row', st.best, 100),
    a('kcna-half', '☸️', 'Halfway to KCNA', 'Master 20 KCNA lessons', kcnaMastered, 20),
    a('kcna-all', '🎓', 'KCNA scholar', `Master all ${lessons.length} KCNA lessons`, kcnaMastered, lessons.length),
    a('mock-pass', '🎯', 'Mock passer', 'Score ≥ 75% on a full mock exam', fullMocks.filter((e) => e.score >= 0.75).length, 1),
    a('mock-ready', '🏅', 'Exam-day ready', 'Three full mocks at ≥ 80%', fullMocks.filter((e) => e.score >= 0.8).length, 3),
    a('first-fix', '🧯', 'First responder', 'Win a Break-Fix Arena round', arenaWins(1), 1),
    a('chaos-master', '🐒', 'Chaos master', 'Win a level-3 Arena round', arenaWins(3), 1),
    a('flawless', '🥷', 'No hints needed', 'Win a level-2+ Arena round without hints', flawless ? 1 : 0, 1),
    a('architect', '🏗️', 'Architect', 'Complete 3 system designs at ≥ 70% of the rubric', solid, 3),
    a('storyteller', '🎙️', 'Storyteller', 'Write 8 STAR stories', Object.keys(p.behavioralStories).length, 8),
    a('interviewed', '🤝', 'Battle-tested', 'Finish 5 AI mock interviews', p.mockInterviews.length, 5),
    a('infra-deep', '🌐', 'Deep infrastructure', 'Master 13 infra lessons', infraMastered, 13),
    a('sequencer', '🧩', 'Sequencer', 'Solve 10 order-the-steps puzzles', c.sequence ?? 0, 10),
    a('matchmaker', '🔗', 'Matchmaker', 'Clear 10 match-pairs boards', c.match ?? 0, 10),
    a('feynman', '🧠', 'Feynman technique', 'Explain 5 concepts back in your own words', c.explain ?? 0, 5),
    a('daily-10', '📅', 'Daily habit', 'Complete 10 daily challenges', Object.keys(p.play.daily).length, 10),
    a('hands-on', '🧪', 'Hands on', 'Complete 3 real-cluster labs', Object.keys(p.labsCompleted).length, 3),
  ];
}

// ---------------- skill constellation ----------------

export interface SkillStar {
  id: string;
  track: 'kcna' | 'infra';
  name: string;
  group: string;
  mastery: number;
  answered: number;
  href: string;
}

export function skillStars(p: Progress, now = Date.now()): SkillStar[] {
  return [
    ...OBJECTIVES.map((o) => {
      const m = masteryFor(p.attempts, o.id, now);
      return { id: o.id, track: 'kcna' as const, name: o.name, group: o.domain, mastery: m.lower, answered: m.attempts, href: `#/practice?objective=${o.id}` };
    }),
    ...INFRA_TOPICS.map((t) => {
      const m = masteryFor(p.attempts, t.id, now);
      return { id: t.id, track: 'infra' as const, name: t.name, group: t.domain, mastery: m.lower, answered: m.attempts, href: `#/infra/practice?topic=${t.id}` };
    }),
  ];
}

// ---------------- daily challenge ----------------

export interface DailyChallenge {
  date: string;
  questions: Question<string, string>[];
  sequenceId: string;
}

/** Same challenge for everyone on a given date: 5 interleaved questions + one sequence puzzle. */
export function dailyChallenge(date = dayKey(Date.now())): DailyChallenge {
  const seed = Number(date.replace(/-/g, '')) * 2654435761;
  const r = rng(seed >>> 0);
  const k = shuffle(questions, r);
  const i = shuffle(infraQuestions, r);
  // interleave domains: pick from distinct objectives
  const pick: Question<string, string>[] = [];
  const seen = new Set<string>();
  for (const q of [...k.slice(0, 40), ...i.slice(0, 40)].sort(() => r() - 0.5)) {
    if (seen.has(q.objective)) continue;
    seen.add(q.objective);
    pick.push(q);
    if (pick.length === 5) break;
  }
  return { date, questions: pick, sequenceId: sequencePuzzles[Math.floor(r() * sequencePuzzles.length)].id };
}

// ---------------- endless adaptive feed ----------------

export type FeedItem =
  | { kind: 'review'; question: Question<string, string>; why: string }
  | { kind: 'question'; question: Question<string, string>; why: string }
  | { kind: 'flashcard'; card: { id: string; front: string; back: string; lessonId: string; objective: string }; why: string }
  | { kind: 'myth'; lesson: Lesson<string>; myth: string; reality: string; why: string }
  | { kind: 'sequence'; id: string; why: string }
  | { kind: 'match'; pairs: { term: string; definition: string }[]; why: string };

export type FeedTrack = 'both' | 'kcna' | 'infra';

/**
 * Picks the next card for the never-ending feed. Priority: due missed questions
 * (spacing), due flashcards, then an interleaved mix weighted toward weak
 * topics, with unseen material, myth busting and mini-games for variety.
 * `recent` holds ids shown this session so nothing repeats back to back.
 */
export function nextFeedItem(p: Progress, track: FeedTrack, recent: string[], seed: number, now = Date.now()): FeedItem {
  const r = rng(seed >>> 0);
  const inTrack = (id: string) => track === 'both' || (track === 'infra' ? id.startsWith('iq-') || id.startsWith('ifc-') || id.startsWith('infra-') : !(id.startsWith('iq-') || id.startsWith('ifc-') || id.startsWith('infra-')));
  const recentSet = new Set(recent);
  const bank = [...(track !== 'infra' ? questions : []), ...(track !== 'kcna' ? infraQuestions : [])] as Question<string, string>[];
  const byId = new Map(bank.map((q) => [q.id, q]));

  const due = dueQuestionReviews(p, now).filter((id) => inTrack(id) && !recentSet.has(id) && byId.has(id));
  if (due.length && r() < 0.6) return { kind: 'review', question: byId.get(due[0])!, why: 'You missed this before — it is due for spaced review.' };

  const deck = [...(track !== 'infra' ? flashcards : []), ...(track !== 'kcna' ? infraFlashcards : [])] as { id: string; front: string; back: string; lessonId: string; objective: string }[];
  const dueCardsList = dueCards(deck, p.cards, now).filter((c) => p.cards[c.id] && !recentSet.has(c.id));
  if (dueCardsList.length && r() < 0.5) return { kind: 'flashcard', card: dueCardsList[0], why: 'Flashcard due today.' };

  const roll = r();
  if (roll < 0.1) {
    const ls = [...(track !== 'infra' ? lessons : []), ...(track !== 'kcna' ? infraLessons : [])] as Lesson<string>[];
    const l = ls[Math.floor(r() * ls.length)];
    const m = l.misconceptions[Math.floor(r() * l.misconceptions.length)];
    if (m && !recentSet.has(`myth:${l.id}:${m.myth}`)) return { kind: 'myth', lesson: l, myth: m.myth, reality: m.reality, why: 'Myth buster — common misconception.' };
  }
  if (roll < 0.17) {
    const seqs = sequencePuzzles.filter((s) => track === 'both' || s.track === track).filter((s) => !recentSet.has(s.id));
    if (seqs.length) return { kind: 'sequence', id: seqs[Math.floor(r() * seqs.length)].id, why: 'Put the steps in order.' };
  }
  if (roll < 0.23 && track !== 'infra') {
    const terms = shuffle(glossary.filter((g) => g.definition.length < 240), r).slice(0, 4);
    return { kind: 'match', pairs: terms.map((g) => ({ term: g.term, definition: g.definition.replace(/[`*]/g, '').split(/(?<=\.)\s/)[0] })), why: 'Match each term to its meaning.' };
  }
  if (roll < 0.3) {
    const fresh = deck.filter((c) => !p.cards[c.id] && !recentSet.has(c.id));
    if (fresh.length) return { kind: 'flashcard', card: fresh[Math.floor(r() * fresh.length)], why: 'New flashcard.' };
  }

  // weighted question pick: weak topics more often, unseen preferred, interleaved
  const seen = new Set(p.attempts.map((a) => a.qid));
  const candidates = bank.filter((q) => !recentSet.has(q.id));
  const weight = (q: Question<string, string>) => {
    const m = masteryFor(p.attempts, q.objective, now);
    return (1.2 - m.lower) * (seen.has(q.id) ? 0.5 : 1.5) * (m.attempts === 0 ? 1.3 : 1);
  };
  const total = candidates.reduce((s, q) => s + weight(q), 0);
  let x = r() * total;
  for (const q of candidates) {
    x -= weight(q);
    if (x <= 0) {
      const m = masteryFor(p.attempts, q.objective, now);
      return { kind: 'question', question: q, why: !seen.has(q.id) ? (m.attempts ? 'New question on a topic you are building.' : 'New topic for you.') : m.lower < 0.6 ? 'Weak topic — extra practice.' : 'Keeping it fresh.' };
    }
  }
  const q = candidates[0] ?? bank[0];
  return { kind: 'question', question: q, why: 'Keep going.' };
}

// ---------------- explain-it-back ----------------

/** Which of the lesson's key terms appear in the learner's own explanation. */
export function explainCoverage(lesson: Lesson<string>, text: string) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const t = ` ${norm(text)} `;
  const terms = lesson.keyTerms.map((k) => {
    const core = norm(k.replace(/\(.*?\)/g, ''));
    // accept the term or its first two words (e.g. "liveness probe" from "liveness probe (http)")
    const short = core.split(' ').slice(0, 2).join(' ');
    return { term: k, hit: core.length > 0 && (t.includes(` ${core} `) || (short.length > 3 && t.includes(` ${short}`))) };
  });
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return { terms, coverage: terms.length ? terms.filter((x) => x.hit).length / terms.length : 0, words };
}

// ---------------- calendar reminder ----------------

/** A recurring daily study reminder as an iCalendar file (no server, no account). */
export function studyReminderIcs(time: string, appUrl: string, start = new Date()): string {
  const [hh, mm] = time.split(':').map(Number);
  const d = new Date(start);
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const t = `${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}00`;
  const end = `${String(hh).padStart(2, '0')}${String(Math.min(59, mm + 30)).padStart(2, '0')}00`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KCNA Interactive Learning Lab//EN',
    'BEGIN:VEVENT',
    `UID:kcna-daily-${ymd}@kcna-lab`,
    `DTSTAMP:${ymd}T000000Z`,
    `DTSTART:${ymd}T${t}`,
    `DTEND:${ymd}T${end}`,
    'RRULE:FREQ=DAILY',
    'SUMMARY:Never stop learning — 20 min in the KCNA Lab',
    `DESCRIPTION:Daily challenge + due reviews + one Arena round. ${appUrl}`,
    `URL:${appUrl}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT0M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Time to learn',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
