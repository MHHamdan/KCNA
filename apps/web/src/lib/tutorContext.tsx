import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TutorContext, TutorMode, TutorSource } from '@kcna/engine';
import { MAX_TUTOR_MESSAGES } from '@kcna/engine';
import { checkTutor, streamTutor, TutorError, type TutorAvailability } from './tutor';
import { getProgress, updateProgress } from './store';

export interface TutorMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: TutorSource[];
  error?: { code: string; message: string; question: string };
  context?: TutorContext;
}

interface TutorState {
  open: boolean;
  setOpen: (o: boolean) => void;
  mode: TutorMode;
  setMode: (m: TutorMode) => void;
  messages: TutorMessage[];
  streaming: boolean;
  availability: TutorAvailability;
  refreshAvailability: () => void;
  /** context of the page the learner is on; attached to the next question */
  pageContext: TutorContext;
  setPageContext: (c: TutorContext) => void;
  ask: (question: string, opts?: { context?: TutorContext; mode?: TutorMode }) => void;
  stop: () => void;
  clear: () => void;
}

const Ctx = createContext<TutorState | null>(null);

export function TutorProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<TutorMode>('explain');
  const [messages, setMessages] = useState<TutorMessage[]>(() =>
    getProgress().prefs.saveTutorHistory ? getProgress().tutorHistory.map((t) => ({ ...t })) : [],
  );
  const [streaming, setStreaming] = useState(false);
  const [availability, setAvailability] = useState<TutorAvailability>({ state: 'checking' });
  const [pageContext, setPageContext] = useState<TutorContext>({});
  const abortRef = useRef<AbortController | null>(null);
  const checkedAt = useRef(0);

  const refreshAvailability = useCallback(() => {
    checkedAt.current = Date.now();
    setAvailability({ state: 'checking' });
    void checkTutor().then(setAvailability);
  }, []);

  // probe lazily, the first time the tutor is opened (avoids waking the Space for every visitor)
  useEffect(() => {
    if (open && Date.now() - checkedAt.current > 60_000) refreshAvailability();
  }, [open, refreshAvailability]);

  useEffect(() => {
    if (!getProgress().prefs.saveTutorHistory) return;
    updateProgress((p) => ({
      ...p,
      tutorHistory: messages.filter((m) => !m.error && m.content).map((m) => ({ role: m.role, content: m.content })).slice(-MAX_TUTOR_MESSAGES),
    }));
  }, [messages]);

  const ask = useCallback(
    (question: string, opts: { context?: TutorContext; mode?: TutorMode } = {}) => {
      const q = question.trim();
      if (!q || streaming) return;
      const useMode = opts.mode ?? mode;
      if (opts.mode) setMode(opts.mode);
      // the full-page tutor already shows the conversation; only open the drawer elsewhere
      if (!window.location.hash.startsWith('#/tutor')) setOpen(true);
      const context = { ...pageContext, ...opts.context };
      const history = [...messages.filter((m) => !m.error && m.content), { role: 'user' as const, content: q }];
      setMessages((ms) => [...ms, { role: 'user', content: q, context }, { role: 'assistant', content: '' }]);
      setStreaming(true);
      const ac = new AbortController();
      abortRef.current = ac;
      const patchLast = (fn: (m: TutorMessage) => TutorMessage) =>
        setMessages((ms) => {
          const copy = [...ms];
          copy[copy.length - 1] = fn(copy[copy.length - 1]);
          return copy;
        });
      streamTutor(
        {
          mode: useMode,
          level: getProgress().prefs.tutorLevel,
          messages: history.slice(-12).map(({ role, content }) => ({ role, content: content.slice(0, role === 'user' ? 2000 : 4000) })),
          context,
        },
        {
          onMeta: (m) => patchLast((x) => ({ ...x, sources: m.sources })),
          onToken: (t) => patchLast((x) => ({ ...x, content: x.content + t })),
        },
        ac.signal,
      )
        .catch((e: unknown) => {
          const err = e instanceof TutorError ? e : new TutorError('network', 'Unexpected error.');
          if (err.code === 'aborted') return patchLast((x) => ({ ...x, content: x.content + (x.content ? '\n\n*(stopped)*' : '*(stopped)*') }));
          patchLast((x) => ({ ...x, error: { code: err.code, message: err.message, question: q } }));
          if (['unavailable', 'loading', 'disabled', 'quota', 'network'].includes(err.code)) refreshAvailability();
        })
        .finally(() => {
          setStreaming(false);
          abortRef.current = null;
        });
    },
    [messages, mode, pageContext, streaming, refreshAvailability],
  );

  const value = useMemo<TutorState>(
    () => ({
      open,
      setOpen,
      mode,
      setMode,
      messages,
      streaming,
      availability,
      refreshAvailability,
      pageContext,
      setPageContext,
      ask,
      stop: () => abortRef.current?.abort(),
      clear: () => {
        abortRef.current?.abort();
        setMessages([]);
        updateProgress((p) => ({ ...p, tutorHistory: [] }));
      },
    }),
    [open, mode, messages, streaming, availability, refreshAvailability, pageContext, ask],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTutor() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTutor outside TutorProvider');
  return c;
}

/** Register what the learner is looking at so tutor questions carry relevant context. */
export function usePageContext(ctx: TutorContext) {
  const { setPageContext } = useTutor();
  const key = JSON.stringify(ctx);
  useEffect(() => {
    setPageContext(JSON.parse(key) as TutorContext);
    return () => setPageContext({});
  }, [key, setPageContext]);
}
