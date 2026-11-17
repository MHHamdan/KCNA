import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { anyLessonById, glossary, infraLessons, lessons, sequencePuzzles, type Lesson } from '@kcna/content';
import {
  achievements,
  addAttempts,
  bumpCounter,
  dailyChallenge,
  dayKey,
  explainCoverage,
  levelInfo,
  newCard,
  nextFeedItem,
  recordActivity,
  review,
  rng,
  shuffle,
  skillStars,
  streak,
  totalXp,
  type Attempt,
  type FeedItem,
  type FeedTrack,
  type Grade,
} from '@kcna/engine';
import { updateProgress, useProgress } from '../lib/store';
import { PageHeader } from '../components/Layout';
import { Md } from '../components/Md';
import { QuestionCard } from '../components/QuestionCard';
import { MatchGame, SequenceGame } from '../components/MiniGames';
import { AskAI } from '../components/TutorPanel';
import { Bar, ObjectiveChip, Tabs, lessonPath } from '../components/ui';

const saveAttempt = (q: { id: string; objective: string }, ok: boolean, sel: number[], source: Attempt['source'] = 'quiz') =>
  updateProgress((pr) => addAttempts(pr, [{ qid: q.id, objective: q.objective as Attempt['objective'], correct: ok, at: Date.now(), source, selected: sel }]));

// ---------------- habit strip (used on dashboards) ----------------

export function HabitStrip() {
  const p = useProgress();
  const lvl = levelInfo(totalXp(p));
  const st = streak(p);
  const done = !!p.play.daily[dayKey(Date.now())];
  return (
    <div className="card grid gap-4 p-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-semibold">
            Level {lvl.level} · <span className="text-violet-600 dark:text-violet-300">{lvl.title}</span>
          </p>
          <span className="text-xs text-slate-500">
            {lvl.into}/{lvl.need} XP
          </span>
        </div>
        <Bar value={lvl.progress} className="bg-violet-500" label="Progress to next level" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden="true">
          {st.current > 0 ? '🔥' : '🪵'}
        </span>
        <div className="text-sm">
          <p className="font-semibold">{st.current}-day streak</p>
          <p className="text-xs text-slate-500">{st.atRisk ? 'Study today to keep it alive' : `Best ${st.best}`}</p>
        </div>
      </div>
      <div className="text-sm">
        <p className="font-semibold">
          Today {Math.min(st.today, st.goal)}/{st.goal}
        </p>
        <Bar value={st.today / st.goal} className={st.goalMet ? 'bg-emerald-500' : 'bg-amber-500'} label="Daily goal" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to="/daily" className={done ? 'btn-ghost' : 'btn-primary'}>
          {done ? '✓ Daily done' : "Today's challenge"}
        </Link>
        <Link to="/feed" className="btn-ai">
          ∞ Endless feed
        </Link>
      </div>
    </div>
  );
}

// ---------------- endless feed ----------------

function FeedCard({ item, onNext }: { item: FeedItem; onNext: (xp: number) => void }) {
  const [answered, setAnswered] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [revealed, setRevealed] = useState(false);
  if (item.kind === 'question' || item.kind === 'review')
    return (
      <div className="space-y-3">
        <QuestionCard
          q={item.question}
          onAnswered={(ok, sel) => {
            setAnswered(true);
            saveAttempt(item.question, ok, sel, item.kind === 'review' ? 'review' : 'quiz');
          }}
        />
        {answered && (
          <button type="button" className="btn-primary" onClick={() => onNext(10)} autoFocus>
            Next →
          </button>
        )}
      </div>
    );
  if (item.kind === 'flashcard') {
    const grade = (g: Grade) => {
      updateProgress((pr) => recordActivity({ ...pr, cards: { ...pr.cards, [item.card.id]: review(pr.cards[item.card.id] ?? newCard(), g) } }));
      onNext(4);
    };
    return (
      <div className="card space-y-3">
        <ObjectiveChip id={item.card.objective} />
        <button type="button" className="block w-full text-left" onClick={() => setFlipped(true)}>
          <Md className="text-lg font-medium">{item.card.front}</Md>
          {!flipped && <p className="mt-3 text-xs text-slate-500">Recall it, then tap to reveal</p>}
        </button>
        {flipped && (
          <>
            <Md className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-ink-850">{item.card.back}</Md>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  [0, 'Again'],
                  [3, 'Hard'],
                  [4, 'Good'],
                  [5, 'Easy'],
                ] as [Grade, string][]
              ).map(([g, l]) => (
                <button key={g} type="button" className="btn-ghost" onClick={() => grade(g)}>
                  {l}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }
  if (item.kind === 'myth')
    return (
      <div className="card space-y-3">
        <p className="label">Myth buster · {item.lesson.title}</p>
        <p className="text-lg font-medium">“{item.myth}”</p>
        <p className="text-sm text-slate-500">This is a common belief. Why is it wrong? Think it through, then reveal.</p>
        {!revealed ? (
          <button type="button" className="btn-primary" onClick={() => setRevealed(true)}>
            Reveal reality
          </button>
        ) : (
          <>
            <Md className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50/60 p-3 text-sm dark:bg-emerald-500/5">{item.reality}</Md>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  updateProgress((pr) => bumpCounter(pr, 'myth'));
                  onNext(15);
                }}
              >
                I knew it →
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  updateProgress((pr) => bumpCounter(pr, 'myth'));
                  onNext(15);
                }}
              >
                I didn’t — noted →
              </button>
              <Link className="btn-ghost" to={lessonPath(item.lesson.id)}>
                Open lesson
              </Link>
            </div>
          </>
        )}
      </div>
    );
  if (item.kind === 'sequence')
    return (
      <div className="card space-y-3">
        <SequenceGame
          id={item.id}
          onDone={(ok) => {
            setAnswered(true);
            if (ok) updateProgress((pr) => bumpCounter(pr, 'sequence'));
          }}
        />
        {answered && (
          <button type="button" className="btn-primary" onClick={() => onNext(15)}>
            Next →
          </button>
        )}
      </div>
    );
  return (
    <div className="card space-y-3">
      <MatchGame
        pairs={item.pairs}
        onDone={() => {
          setAnswered(true);
          updateProgress((pr) => bumpCounter(pr, 'match'));
        }}
      />
      {answered && (
        <button type="button" className="btn-primary" onClick={() => onNext(15)}>
          Next →
        </button>
      )}
    </div>
  );
}

export function FeedPage() {
  const p = useProgress();
  const [track, setTrack] = useState<FeedTrack>('both');
  const [n, setN] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [sessionXp, setSessionXp] = useState(0);
  const [seed] = useState(() => Date.now() & 0x7fffffff);
  // the item is chosen once per position so answering doesn't reshuffle the card
  const item = useMemo(() => nextFeedItem(p, track, recent, seed + n * 7919), [n, track]); // eslint-disable-line react-hooks/exhaustive-deps
  const key = item.kind === 'question' || item.kind === 'review' ? item.question.id : item.kind === 'flashcard' ? item.card.id : item.kind === 'sequence' ? item.id : item.kind === 'myth' ? `myth:${item.lesson.id}:${item.myth}` : `match:${n}`;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="∞ Endless feed" subtitle="Never stop learning: an adaptive, never-ending mix of spaced reviews, weak-topic questions, new material, myth busters, step puzzles and matching — interleaved across topics, because mixing is what makes it stick." />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={track}
          onChange={(t) => {
            setTrack(t);
            setN((x) => x + 1);
          }}
          options={[
            { value: 'both', label: 'Everything' },
            { value: 'kcna', label: 'KCNA' },
            { value: 'infra', label: 'Senior infra' },
          ]}
        />
        <p className="text-sm text-slate-500">
          This session: <strong>{n}</strong> cards · <strong>+{sessionXp}</strong> XP
        </p>
      </div>
      <p className="text-xs text-violet-700 dark:text-violet-300">↳ {item.why}</p>
      <FeedCard
        key={`${n}-${key}`}
        item={item}
        onNext={(xp) => {
          setSessionXp((x) => x + xp);
          setRecent((r) => [...r, key].slice(-40));
          setN((x) => x + 1);
        }}
      />
      {n > 0 && n % 10 === 0 && <p className="rounded-lg bg-violet-50 p-3 text-sm dark:bg-violet-500/10">🎉 {n} cards this session. Short breaks help memory — but the feed never ends when you are ready for more.</p>}
    </div>
  );
}

// ---------------- daily challenge ----------------

export function DailyPage() {
  const p = useProgress();
  const today = dayKey(Date.now());
  const ch = useMemo(() => dailyChallenge(today), [today]);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const done = p.play.daily[today];
  const total = ch.questions.length + 1;
  const finish = (finalScore: number) => updateProgress((pr) => recordActivity({ ...pr, play: { ...pr.play, daily: { ...pr.play.daily, [today]: { at: Date.now(), correct: finalScore, total } } } }));
  const history = Object.entries(p.play.daily).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={`Daily challenge · ${today}`} subtitle="Five interleaved questions across both tracks plus one step puzzle. Everyone gets the same challenge today; it takes about five minutes." />
      {done && i === 0 ? (
        <div className="card space-y-2">
          <p className="text-lg font-semibold">
            ✓ Done today: {done.correct}/{done.total}
          </p>
          <p className="text-sm text-slate-500">Come back tomorrow for a new one — or keep going in the endless feed.</p>
          <Link to="/feed" className="btn-ai">
            ∞ Endless feed
          </Link>
        </div>
      ) : i < ch.questions.length ? (
        <div className="space-y-3">
          <QuestionCard
            key={ch.questions[i].id}
            q={ch.questions[i]}
            index={i}
            total={total}
            onAnswered={(ok, sel) => {
              setAnswered(true);
              if (ok) setScore((s) => s + 1);
              saveAttempt(ch.questions[i], ok, sel);
            }}
          />
          {answered && (
            <button type="button" className="btn-primary" onClick={() => (setI(i + 1), setAnswered(false))}>
              Next →
            </button>
          )}
        </div>
      ) : i === ch.questions.length ? (
        <div className="card space-y-3">
          <p className="label">Final: put it in order</p>
          <SequenceGame
            id={ch.sequenceId}
            onDone={(ok) => {
              const final = score + (ok ? 1 : 0);
              setScore(final);
              finish(final);
              if (ok) updateProgress((pr) => bumpCounter(pr, 'sequence'));
              setI(i + 1);
            }}
          />
        </div>
      ) : (
        <div className="card space-y-2" role="status">
          <p className="text-2xl font-bold">
            {score}/{total} {score === total ? '🏆' : score >= total - 1 ? '🎯' : '💪'}
          </p>
          <p className="text-sm text-slate-500">Daily challenge saved. Missed questions are now in your spaced review queue.</p>
          <div className="flex gap-2">
            <Link to="/feed" className="btn-ai">
              Keep going: endless feed
            </Link>
            <Link to="/arena" className="btn-ghost">
              Break-Fix Arena
            </Link>
          </div>
        </div>
      )}
      {history.length > 0 && (
        <div className="card">
          <p className="label mb-2">Last two weeks</p>
          <div className="flex flex-wrap gap-1.5">
            {history.map(([d, r]) => (
              <span key={d} className="chip" title={d}>
                {d.slice(5)} · {r.correct}/{r.total}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- games hub ----------------

export function GamesPage() {
  const [mode, setMode] = useState<'sequence' | 'match'>('sequence');
  const [round, setRound] = useState(0);
  const p = useProgress();
  const seqId = useMemo(() => sequencePuzzles[Math.floor(rng(round * 104729 + Date.now())() * sequencePuzzles.length)].id, [round]);
  const pairs = useMemo(
    () => shuffle(glossary.filter((g) => g.definition.length < 240), rng(round * 7 + Date.now())).slice(0, 5).map((g) => ({ term: g.term, definition: g.definition.replace(/[`*]/g, '').split(/(?<=\.)\s/)[0] })),
    [round],
  );
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="Mini-games" subtitle={`Quick, different ways to retrieve what you know. Sequences solved: ${p.play.counters.sequence ?? 0} · boards matched: ${p.play.counters.match ?? 0}.`} />
      <Tabs
        value={mode}
        onChange={(m) => {
          setMode(m);
          setRound((r) => r + 1);
        }}
        options={[
          { value: 'sequence', label: '🧩 Order the steps' },
          { value: 'match', label: '🔗 Match pairs' },
        ]}
      />
      <div className="card">
        {mode === 'sequence' ? (
          <SequenceGame key={`${seqId}-${round}`} id={seqId} onDone={(ok) => ok && updateProgress((pr) => bumpCounter(pr, 'sequence'))} />
        ) : (
          <MatchGame key={round} pairs={pairs} onDone={() => updateProgress((pr) => bumpCounter(pr, 'match'))} />
        )}
      </div>
      <button type="button" className="btn-primary" onClick={() => setRound((r) => r + 1)}>
        New round →
      </button>
    </div>
  );
}

// ---------------- explain it back (Feynman) ----------------

export function ExplainPage() {
  const all = useMemo(() => [...lessons, ...infraLessons] as Lesson<string>[], []);
  const [lessonId, setLessonId] = useState(() => all[Math.floor(Math.random() * all.length)].id);
  const lesson = anyLessonById(lessonId) as Lesson<string>;
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const cov = explainCoverage(lesson, text);
  useEffect(() => {
    setText('');
    setSubmitted(false);
  }, [lessonId]);
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="🧠 Explain it back" subtitle="The Feynman technique: explain a concept in plain words as if teaching a new teammate. Gaps in your explanation are gaps in your understanding." />
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto max-w-full" value={lessonId} onChange={(e) => setLessonId(e.target.value)} aria-label="Concept">
          {all.map((l) => (
            <option key={l.id} value={l.id}>
              {l.id.startsWith('infra-') ? '[Infra] ' : '[KCNA] '}
              {l.title}
            </option>
          ))}
        </select>
        <button type="button" className="btn-ghost" onClick={() => setLessonId(all[Math.floor(Math.random() * all.length)].id)}>
          🎲 Random
        </button>
      </div>
      <div className="card space-y-3">
        <p className="text-lg font-semibold">Explain: {lesson.title}</p>
        <p className="text-sm text-slate-500">Cover what it is, why it exists, how it works, and one thing people get wrong. Aim for 120–250 words, without looking.</p>
        <label htmlFor="explain" className="sr-only">
          Your explanation
        </label>
        <textarea id="explain" className="input h-48 text-sm" maxLength={6000} value={text} onChange={(e) => setText(e.target.value)} disabled={submitted} />
        <div className="flex flex-wrap items-center gap-2">
          {!submitted ? (
            <button
              type="button"
              className="btn-primary"
              disabled={cov.words < 30}
              onClick={() => {
                setSubmitted(true);
                updateProgress((pr) => bumpCounter(pr, 'explain'));
              }}
            >
              Check my explanation
            </button>
          ) : (
            <button type="button" className="btn-ghost" onClick={() => setSubmitted(false)}>
              Edit
            </button>
          )}
          <span className="text-xs text-slate-500">{cov.words} words</span>
        </div>
      </div>
      {submitted && (
        <div className="card space-y-3" role="status">
          <p className="font-semibold">Key terms covered: {Math.round(cov.coverage * 100)}%</p>
          <Bar value={cov.coverage} className={cov.coverage >= 0.6 ? 'bg-emerald-500' : 'bg-amber-500'} label="Key term coverage" />
          <div className="flex flex-wrap gap-1.5">
            {cov.terms.map((t) => (
              <span key={t.term} className={`chip ${t.hit ? 'border-emerald-400 text-emerald-700 dark:text-emerald-300' : 'border-rose-300 text-rose-700 dark:text-rose-300'}`}>
                {t.hit ? '✓' : '✗'} {t.term}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-500">Term coverage is a rough check — clarity and correctness matter more. Compare with the lesson summary:</p>
          <Md className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-ink-850">{lesson.summary}</Md>
          <div className="flex flex-wrap gap-2">
            <AskAI label="AI: critique my explanation" mode="socratic" question={`Here is my explanation of "${lesson.title}". Point out what is wrong, vague or missing, then ask me one question that exposes my weakest spot.`} context={{ lessonId: lesson.id, answer: text.slice(0, 6000) }} />
            <Link to={lessonPath(lesson.id)} className="btn-ghost">
              Re-read the lesson
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- progress map: level, achievements, constellation ----------------

const GROUP_COLORS: Record<string, string> = {
  fundamentals: '#14a090',
  orchestration: '#0ea5e9',
  delivery: '#f59e0b',
  architecture: '#8b5cf6',
  networking: '#38bdf8',
  compute: '#2dbcaa',
  'storage-data': '#fbbf24',
  distributed: '#a78bfa',
  reliability: '#fb7185',
  security: '#34d399',
  automation: '#22d3ee',
  observability: '#fb923c',
  'architecture-cost': '#a3e635',
  'interview-craft': '#e879f9',
};

const GROUP_NAMES: Record<string, string> = {
  fundamentals: 'K8s fundamentals',
  orchestration: 'Orchestration',
  delivery: 'App delivery',
  architecture: 'Cloud native arch.',
  networking: 'Networking',
  compute: 'Compute',
  'storage-data': 'Storage & data',
  distributed: 'Distributed systems',
  reliability: 'Reliability & SRE',
  security: 'Security',
  automation: 'Automation',
  observability: 'Observability',
  'architecture-cost': 'Architecture & cost',
  'interview-craft': 'Interview craft',
};

function Constellation() {
  const p = useProgress();
  const stars = skillStars(p);
  const W = 1000;
  const H = 680;
  const cx = W / 2;
  const cy = H / 2;
  // KCNA domains on an inner ring, infra domains on an outer ring; each domain's
  // topics form a small cluster that faces outward so labels never collide.
  const ring = (track: 'kcna' | 'infra') => [...new Set(stars.filter((s) => s.track === track).map((s) => s.group))];
  const layout = (track: 'kcna' | 'infra', rx: number, ry: number, offset: number) =>
    ring(track).map((g, gi, all) => {
      const a = (gi / all.length) * Math.PI * 2 + offset;
      const gx = cx + Math.cos(a) * rx;
      const gy = cy + Math.sin(a) * ry;
      const members = stars.filter((s) => s.group === g);
      return {
        g,
        gx,
        gy,
        a,
        members: members.map((s, k) => {
          const spread = members.length > 1 ? (k / (members.length - 1) - 0.5) * 1.6 : 0;
          const r = track === 'kcna' ? 62 : 54;
          return { s, x: gx + Math.cos(a + spread) * r, y: gy + Math.sin(a + spread) * r * 0.75 };
        }),
      };
    });
  const groups = [...layout('kcna', 150, 105, -Math.PI / 4), ...layout('infra', 375, 235, -Math.PI / 2)];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-xl bg-[#0b1017]" role="group" aria-label="Skill constellation: every topic as a star, brighter when mastered">
      {[...Array(90)].map((_, i) => (
        <circle key={i} cx={(i * 137.5) % W} cy={(i * 89.3 + 17) % H} r={i % 7 === 0 ? 1.2 : 0.7} fill="#334155" />
      ))}
      <ellipse cx={cx} cy={cy} rx={150} ry={105} fill="none" stroke="#1e293b" strokeDasharray="3 6" />
      <ellipse cx={cx} cy={cy} rx={375} ry={235} fill="none" stroke="#1e293b" strokeDasharray="3 6" />
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#94a3b8" fontSize="14" fontWeight="700">
        KCNA
      </text>
      <text x={cx} y={cy + 13} textAnchor="middle" fill="#64748b" fontSize="10.5">
        inner ring · senior infra outer ring
      </text>
      {groups.map(({ g, gx, gy, members }) => {
        const color = GROUP_COLORS[g] ?? '#94a3b8';
        return (
          <g key={g}>
            {members.map((m, i) => i > 0 && <line key={i} x1={members[i - 1].x} y1={members[i - 1].y} x2={m.x} y2={m.y} stroke={color} strokeOpacity={0.25} />)}
            <text x={gx} y={gy + 4} textAnchor="middle" fill={color} fontSize="10.5" fontWeight="700" opacity={0.9}>
              {GROUP_NAMES[g] ?? g}
            </text>
            {members.map(({ s, x, y }) => {
              const lit = s.mastery;
              return (
                <a key={s.id} href={s.href} aria-label={`${s.name}: ${Math.round(lit * 100)}% mastery`}>
                  <title>{`${s.name}: ${Math.round(lit * 100)}% mastery (${s.answered} answers)`}</title>
                  {lit > 0.7 && <circle cx={x} cy={y} r={15} fill={color} opacity={0.18} />}
                  <circle cx={x} cy={y} r={4 + lit * 7} fill={s.answered ? color : '#0b1017'} stroke={color} strokeWidth={1.5} opacity={0.4 + lit * 0.6} />
                </a>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function StarList() {
  const p = useProgress();
  const stars = skillStars(p).sort((a, b) => a.mastery - b.mastery);
  return (
    <details className="card">
      <summary className="cursor-pointer font-semibold">All topics by mastery (weakest first)</summary>
      <ul className="mt-3 grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
        {stars.map((s) => (
          <li key={s.id}>
            <a href={s.href} className="flex justify-between gap-2 hover:underline">
              <span>
                <span className="text-xs text-slate-500">{s.track === 'kcna' ? 'KCNA' : 'Infra'} · </span>
                {s.name}
              </span>
              <span className="text-xs text-slate-500">{s.answered ? `${Math.round(s.mastery * 100)}%` : '—'}</span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ProgressMapPage() {
  const p = useProgress();
  const lvl = levelInfo(totalXp(p));
  const st = streak(p);
  const ach = achievements(p);
  const unlocked = ach.filter((a) => a.unlocked).length;
  return (
    <div className="space-y-6">
      <PageHeader title="Skill map & achievements" subtitle="Every topic across both tracks is a star; it brightens as your conservative mastery grows. XP and badges are computed from real evidence — answers, mastered lessons, labs, designs, Arena wins — so they cannot be farmed." />
      <HabitStrip />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="label">Total XP</p>
          <p className="text-3xl font-bold">{lvl.xp.toLocaleString()}</p>
          <p className="text-xs text-slate-500">
            Level {lvl.level} · {lvl.need - lvl.into} XP to level {lvl.level + 1}
          </p>
        </div>
        <div className="card">
          <p className="label">Streak</p>
          <p className="text-3xl font-bold">{st.current} 🔥</p>
          <p className="text-xs text-slate-500">Best: {st.best} days</p>
        </div>
        <div className="card">
          <p className="label">Achievements</p>
          <p className="text-3xl font-bold">
            {unlocked}/{ach.length}
          </p>
          <p className="text-xs text-slate-500">Arena wins: {p.play.arena.filter((r) => r.won).length}</p>
        </div>
      </div>
      <Constellation />
      <StarList />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ach.map((a) => (
          <div key={a.id} className={`card flex gap-3 p-4 ${a.unlocked ? 'border-violet-400' : 'border-dashed'}`}>
            <span className={`text-3xl ${a.unlocked ? '' : 'grayscale'}`} aria-hidden="true">
              {a.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {a.title} {a.unlocked && <span className="text-xs text-violet-600 dark:text-violet-300">unlocked</span>}
              </p>
              <p className="text-xs text-slate-500">{a.description}</p>
              {!a.unlocked && <Bar value={a.progress} className="bg-violet-500" label={`${a.title} progress`} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
