import { describe, expect, it } from 'vitest';
import { infraQuestions, lessons, questions, sequencePuzzles } from '@kcna/content';
import {
  achievements,
  addAttempts,
  bumpCounter,
  dailyChallenge,
  emptyProgress,
  explainCoverage,
  exportProgress,
  importProgress,
  levelInfo,
  nextFeedItem,
  skillStars,
  streak,
  studyReminderIcs,
  totalXp,
  xpForLevel,
  type FeedItem,
} from '../src';

const DAY = 86_400_000;

describe('XP and levels', () => {
  it('derives XP from learning evidence only', () => {
    expect(totalXp(emptyProgress())).toBe(0);
    const q = questions[0];
    const p = addAttempts(emptyProgress(), [{ qid: q.id, objective: q.objective, correct: true, at: Date.now(), source: 'quiz' }]);
    expect(totalXp(p)).toBe(10);
    const p2 = addAttempts(p, [{ qid: q.id, objective: q.objective, correct: false, at: Date.now(), source: 'quiz' }]);
    expect(totalXp(p2)).toBe(13);
  });
  it('levels grow monotonically with progress bars between them', () => {
    expect(levelInfo(0)).toMatchObject({ level: 1, into: 0 });
    for (let n = 1; n < 30; n++) expect(xpForLevel(n + 1)).toBeGreaterThan(xpForLevel(n));
    const l = levelInfo(xpForLevel(3) + 5);
    expect(l.level).toBe(4);
    expect(l.progress).toBeGreaterThan(0);
    expect(l.progress).toBeLessThan(1);
  });
});

describe('streaks', () => {
  it('counts consecutive days and does not break before the day is over', () => {
    const now = Date.UTC(2026, 10, 18, 12);
    const p = emptyProgress();
    for (let i = 1; i <= 5; i++) p.activity[new Date(now - i * DAY).toISOString().slice(0, 10)] = 3;
    const s = streak(p, now);
    expect(s.current).toBe(5);
    expect(s.atRisk).toBe(true);
    p.activity[new Date(now).toISOString().slice(0, 10)] = 20;
    expect(streak(p, now)).toMatchObject({ current: 6, best: 6, goalMet: true, atRisk: false });
  });
  it('a gap resets the current streak but keeps the best', () => {
    const now = Date.UTC(2026, 10, 18, 12);
    const p = emptyProgress();
    for (const i of [1, 4, 5, 6, 7]) p.activity[new Date(now - i * DAY).toISOString().slice(0, 10)] = 1;
    expect(streak(p, now)).toMatchObject({ current: 1, best: 4 });
  });
});

describe('achievements and skill map', () => {
  it('unlock from evidence', () => {
    let p = emptyProgress();
    expect(achievements(p).filter((a) => a.unlocked)).toHaveLength(0);
    p = addAttempts(p, questions.slice(0, 10).map((q) => ({ qid: q.id, objective: q.objective, correct: true, at: Date.now(), source: 'quiz' as const })));
    p.play.arena.push({ at: 1, level: 3, won: true, score: 900, seconds: 120, hints: 0 });
    const un = achievements(p).filter((a) => a.unlocked).map((a) => a.id);
    expect(un).toEqual(expect.arrayContaining(['first-steps', 'first-fix', 'chaos-master', 'flawless']));
  });
  it('maps all 39 topics across both tracks', () => {
    const stars = skillStars(emptyProgress());
    expect(stars).toHaveLength(13 + 26);
    expect(stars.every((s) => s.mastery === 0)).toBe(true);
  });
});

describe('daily challenge', () => {
  it('is deterministic per date, interleaved, and changes daily', () => {
    const a = dailyChallenge('2026-11-18');
    const b = dailyChallenge('2026-11-18');
    const c = dailyChallenge('2026-11-19');
    expect(a.questions.map((q) => q.id)).toEqual(b.questions.map((q) => q.id));
    expect(a.questions.map((q) => q.id)).not.toEqual(c.questions.map((q) => q.id));
    expect(a.questions).toHaveLength(5);
    expect(new Set(a.questions.map((q) => q.objective)).size).toBe(5);
    expect(sequencePuzzles.some((s) => s.id === a.sequenceId)).toBe(true);
  });
});

describe('endless feed', () => {
  it('never runs dry and varies its item types', () => {
    const p = emptyProgress();
    const kinds = new Set<string>();
    const recent: string[] = [];
    for (let i = 0; i < 300; i++) {
      const it: FeedItem = nextFeedItem(p, 'both', recent.slice(-20), i * 7919 + 1);
      kinds.add(it.kind);
      const id = it.kind === 'question' || it.kind === 'review' ? it.question.id : it.kind === 'flashcard' ? it.card.id : it.kind === 'sequence' ? it.id : it.kind;
      expect(recent.slice(-20)).not.toContain(id === 'match' || id === 'myth' ? '__' : id);
      recent.push(id);
    }
    expect([...kinds]).toEqual(expect.arrayContaining(['question', 'flashcard', 'myth', 'sequence', 'match']));
  });
  it('prioritises due missed questions', () => {
    const q = questions[3];
    const t0 = Date.now() - 2 * DAY;
    const p = addAttempts(emptyProgress(), [{ qid: q.id, objective: q.objective, correct: false, at: t0, source: 'quiz' }], t0);
    let reviews = 0;
    for (let i = 0; i < 50; i++) if (nextFeedItem(p, 'kcna', [], i + 11).kind === 'review') reviews++;
    expect(reviews).toBeGreaterThan(15);
  });
  it('respects the chosen track', () => {
    const p = emptyProgress();
    for (let i = 0; i < 80; i++) {
      const it = nextFeedItem(p, 'infra', [], i + 3);
      if (it.kind === 'question') expect(infraQuestions.some((q) => q.id === it.question.id)).toBe(true);
    }
  });
});

describe('explain-it-back and reminders', () => {
  it('scores key-term coverage of a learner explanation', () => {
    const pods = lessons.find((l) => l.id === 'pods')!;
    const none = explainCoverage(pods, 'It is a thing that runs stuff.');
    const good = explainCoverage(pods, pods.keyTerms.join(', ') + ' — all explained in my own words.');
    expect(none.coverage).toBeLessThan(0.3);
    expect(good.coverage).toBe(1);
  });
  it('generates a valid daily recurring calendar event', () => {
    const ics = studyReminderIcs('19:30', 'https://mhamdan-kcna.hf.space', new Date(2026, 10, 18));
    expect(ics).toMatch(/BEGIN:VCALENDAR/);
    expect(ics).toMatch(/RRULE:FREQ=DAILY/);
    expect(ics).toMatch(/DTSTART:20261118T193000/);
  });
  it('play state survives export/import', () => {
    let p = bumpCounter(emptyProgress(), 'sequence', 2);
    p.play.arena.push({ at: 5, level: 2, won: true, score: 700, seconds: 90, hints: 1 });
    p.play.daily['2026-11-18'] = { at: 1, correct: 4, total: 6 };
    p = importProgress(exportProgress(p));
    expect(p.play.counters.sequence).toBe(2);
    expect(p.play.arena).toHaveLength(1);
    expect(p.play.daily['2026-11-18'].correct).toBe(4);
  });
});
