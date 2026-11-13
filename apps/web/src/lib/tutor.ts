import type { ChatMessage, TutorContext, TutorMode, TutorSource } from '@kcna/engine';

declare const __TUTOR_API__: string;
export const TUTOR_API: string = __TUTOR_API__;

export type TutorAvailability =
  | { state: 'checking' }
  | { state: 'ready' | 'loading' | 'unavailable' | 'disabled' | 'quota-exhausted'; model?: string; provider?: string; message?: string };

export async function checkTutor(signal?: AbortSignal): Promise<TutorAvailability> {
  try {
    const r = await fetch(`${TUTOR_API}/api/health`, { signal: signal ?? AbortSignal.timeout(8000) });
    if (!r.ok) return { state: 'unavailable', message: `Tutor service returned HTTP ${r.status}.` };
    const j = (await r.json()) as { tutor: { state: TutorAvailability['state']; model: string; provider: string } };
    return { state: j.tutor.state as 'ready', model: j.tutor.model, provider: j.tutor.provider };
  } catch {
    return {
      state: 'unavailable',
      message: TUTOR_API
        ? 'Could not reach the tutor service on Hugging Face (it may be asleep or starting up — free Spaces sleep when idle).'
        : 'Could not reach the tutor service.',
    };
  }
}

export interface StreamHandlers {
  onMeta?: (m: { sources: TutorSource[]; model: string }) => void;
  onToken: (t: string) => void;
}

export class TutorError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** POST a tutor request and consume the server-sent event stream. */
export async function streamTutor(
  body: { mode: TutorMode; level: 'beginner' | 'technical'; messages: ChatMessage[]; context: TutorContext },
  h: StreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${TUTOR_API}/api/tutor/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    if (signal.aborted) throw new TutorError('aborted', 'Stopped.');
    throw new TutorError('network', 'Could not reach the tutor service.');
  }
  if (!res.ok || !res.body) {
    let msg = `Tutor error (HTTP ${res.status}).`;
    let code = 'upstream';
    try {
      const j = (await res.json()) as { error: string; message: string };
      msg = j.message;
      code = j.error;
    } catch {
      /* non-JSON */
    }
    throw new TutorError(code, msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const ev = frame.match(/^event: (.*)$/m)?.[1];
      const data = frame.match(/^data: (.*)$/m)?.[1];
      if (!ev || !data) continue;
      const j = JSON.parse(data);
      if (ev === 'meta') h.onMeta?.(j);
      else if (ev === 'token') h.onToken(j.t);
      else if (ev === 'error') throw new TutorError(j.code, j.message);
      else if (ev === 'done') return;
    }
  }
}
