// SM-2 spaced repetition (Wozniak, 1990) — small, well-understood, good enough
// for a ~100-card deck. Grades: 0 again, 3 hard, 4 good, 5 easy.

export interface CardState {
  ef: number; // easiness factor, >= 1.3
  interval: number; // days
  reps: number; // consecutive successful reviews
  lapses: number;
  due: number; // epoch ms
  last: number; // epoch ms
}

export type Grade = 0 | 3 | 4 | 5;
const DAY = 86_400_000;

export function newCard(now = Date.now()): CardState {
  return { ef: 2.5, interval: 0, reps: 0, lapses: 0, due: now, last: 0 };
}

export function review(card: CardState, grade: Grade, now = Date.now()): CardState {
  let { ef, interval, reps, lapses } = card;
  if (grade < 3) {
    reps = 0;
    lapses += 1;
    interval = 0; // relearn later today
  } else {
    reps += 1;
    interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(interval * ef);
    if (grade === 3) interval = Math.max(1, Math.round(interval * 0.8));
  }
  ef = Math.max(1.3, ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  const due = interval === 0 ? now + 10 * 60_000 : now + interval * DAY;
  return { ef: Math.round(ef * 100) / 100, interval, reps, lapses, due, last: now };
}

export function dueCards<T extends { id: string }>(cards: T[], states: Record<string, CardState>, now = Date.now()): T[] {
  return cards
    .filter((c) => {
      const s = states[c.id];
      return !s || s.due <= now;
    })
    .sort((a, b) => (states[a.id]?.due ?? 0) - (states[b.id]?.due ?? 0));
}

/** Share of studied cards that have reached a 7+ day interval, i.e. retained beyond short-term memory. */
export function retentionScore(states: Record<string, CardState>): { score: number; studied: number } {
  const s = Object.values(states).filter((c) => c.last > 0);
  if (!s.length) return { score: 0, studied: 0 };
  const mature = s.filter((c) => c.interval >= 7).length;
  const lapsePenalty = s.reduce((acc, c) => acc + Math.min(c.lapses, 3), 0) / (s.length * 6);
  return { score: Math.max(0, mature / s.length - lapsePenalty), studied: s.length };
}
