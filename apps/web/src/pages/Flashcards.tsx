import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { flashcards, infraFlashcards, INFRA_TOPICS, OBJECTIVES, type Flashcard } from '@kcna/content';
import { dueCards, newCard, recordActivity, review, type Grade } from '@kcna/engine';
import { updateProgress, useProgress } from '../lib/store';
import { PageHeader } from '../components/Layout';
import { Md } from '../components/Md';
import { AskAI } from '../components/TutorPanel';
import { ObjectiveChip, lessonPath } from '../components/ui';

export function FlashcardsPage({ track = 'kcna' }: { track?: 'kcna' | 'infra' }) {
  const p = useProgress();
  const infra = track === 'infra';
  const allCards: Flashcard<string>[] = infra ? infraFlashcards : flashcards;
  const objectiveList: { id: string; name: string }[] = infra ? INFRA_TOPICS : OBJECTIVES;
  const [objective, setObjective] = useState<string>('');
  const [flipped, setFlipped] = useState(false);
  const deck = useMemo(() => allCards.filter((c) => !objective || c.objective === objective), [objective, allCards]);
  // snapshot the queue at session start so reviewed cards leave it predictably
  const [queue, setQueue] = useState<string[]>([]);
  useEffect(() => {
    const due = dueCards(deck, p.cards);
    const studied = due.filter((c) => p.cards[c.id]);
    const fresh = due.filter((c) => !p.cards[c.id]).slice(0, 10);
    setQueue([...studied, ...fresh].map((c) => c.id));
    setFlipped(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck]);
  const card = allCards.find((c) => c.id === queue[0]);
  const deckIds = new Set(allCards.map((c) => c.id));
  const studied = Object.keys(p.cards).filter((id) => deckIds.has(id)).length;
  const mature = Object.entries(p.cards).filter(([id, c]) => deckIds.has(id) && c.interval >= 7).length;

  const grade = (g: Grade) => {
    if (!card) return;
    updateProgress((pr) => recordActivity({ ...pr, cards: { ...pr.cards, [card.id]: review(pr.cards[card.id] ?? newCard(), g) } }));
    setQueue((q) => (g === 0 ? [...q.slice(1), q[0]] : q.slice(1)));
    setFlipped(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select')) return;
      if (e.key === ' ') {
        e.preventDefault();
        setFlipped((f) => !f);
      }
      if (flipped && ['1', '2', '3', '4'].includes(e.key)) grade(([0, 3, 4, 5] as Grade[])[Number(e.key) - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div>
      <PageHeader title={infra ? 'Senior interview flashcards' : 'Flashcards'} subtitle={`Spaced repetition (SM-2). ${allCards.length} cards · ${studied} studied · ${mature} retained beyond a week. Space flips, 1–4 grades.`} />
      <select className="input mb-4 w-auto" value={objective} onChange={(e) => setObjective(e.target.value)} aria-label="Filter by objective">
        <option value="">All objectives</option>
        {objectiveList.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {!card ? (
        <div className="card max-w-2xl text-center">
          <p className="text-lg font-semibold">No cards due right now 🎉</p>
          <p className="mt-1 text-sm text-slate-500">Come back later — cards reappear when they are about to be forgotten.</p>
        </div>
      ) : (
        <div className="max-w-2xl">
          <p className="mb-2 text-xs text-slate-500">{queue.length} card(s) in this session</p>
          <button type="button" onClick={() => setFlipped(!flipped)} className="card block min-h-56 w-full text-left" aria-label={flipped ? 'Card answer, press to show question' : 'Card question, press to reveal answer'} data-testid="flashcard">
            <div className="flex justify-between">
              <ObjectiveChip id={card.objective} />
              <span className="text-xs text-slate-500">{flipped ? 'Answer' : 'Question'}</span>
            </div>
            <Md className={`mt-4 ${flipped ? 'text-sm' : 'text-lg font-medium'}`}>{flipped ? card.back : card.front}</Md>
            {!flipped && <p className="mt-6 text-xs text-slate-500">Click or press Space to reveal</p>}
          </button>
          {flipped && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {(
                [
                  [0, 'Again', 'border-rose-400'],
                  [3, 'Hard', 'border-amber-400'],
                  [4, 'Good', 'border-emerald-400'],
                  [5, 'Easy', 'border-sky-400'],
                ] as [Grade, string, string][]
              ).map(([g, l, c], i) => (
                <button key={g} type="button" className={`btn-ghost ${c}`} onClick={() => grade(g)}>
                  <span className="text-xs text-slate-500">{i + 1}</span> {l}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link className="btn-ghost" to={lessonPath(card.lessonId)}>
              Open lesson
            </Link>
            <AskAI question={`Help me remember this: "${card.front}". Give me a memorable explanation or mnemonic.`} context={{ lessonId: card.lessonId }} />
          </div>
        </div>
      )}
    </div>
  );
}
