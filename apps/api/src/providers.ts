// Model provider abstraction. Every provider speaks the OpenAI-compatible
// /v1/chat/completions protocol (llama.cpp's llama-server and the Hugging Face
// router both do), so one streaming client covers them.

export type ProviderState = 'ready' | 'loading' | 'unavailable' | 'disabled' | 'quota-exhausted';

export interface ChatParams {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  maxTokens: number;
  temperature: number;
  signal: AbortSignal;
}

export class ProviderError extends Error {
  constructor(
    public code: 'unavailable' | 'quota' | 'timeout' | 'upstream',
    message: string,
  ) {
    super(message);
  }
}

export interface Provider {
  readonly name: string;
  readonly model: string;
  state(): Promise<ProviderState>;
  stream(p: ChatParams): AsyncGenerator<string>;
}

export class DisabledProvider implements Provider {
  readonly name = 'none';
  readonly model = 'none';
  async state(): Promise<ProviderState> {
    return 'disabled';
  }
  // eslint-disable-next-line require-yield
  async *stream(): AsyncGenerator<string> {
    throw new ProviderError('unavailable', 'The AI tutor is disabled on this deployment.');
  }
}

export interface OpenAICompatibleOptions {
  name: string;
  baseUrl: string; // e.g. http://127.0.0.1:8081/v1
  model: string;
  apiKey?: string;
  healthUrl?: string;
  /** Hard cap on requests per calendar month (protects included credits). 0 = unlimited. */
  monthlyRequestCap?: number;
  extraBody?: Record<string, unknown>;
}

export class OpenAICompatibleProvider implements Provider {
  readonly name: string;
  readonly model: string;
  private month = '';
  private used = 0;

  constructor(private o: OpenAICompatibleOptions) {
    this.name = o.name;
    this.model = o.model;
  }

  private capReached(): boolean {
    const m = new Date().toISOString().slice(0, 7);
    if (m !== this.month) {
      this.month = m;
      this.used = 0;
    }
    return !!this.o.monthlyRequestCap && this.used >= this.o.monthlyRequestCap;
  }

  async state(): Promise<ProviderState> {
    if (this.capReached()) return 'quota-exhausted';
    if (!this.o.healthUrl) return 'ready';
    try {
      const r = await fetch(this.o.healthUrl, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return 'ready';
      return r.status === 503 ? 'loading' : 'unavailable';
    } catch {
      return 'unavailable';
    }
  }

  async *stream(p: ChatParams): AsyncGenerator<string> {
    if (this.capReached()) throw new ProviderError('quota', 'Monthly AI request budget for this deployment is used up.');
    this.used++;
    let res: Response;
    try {
      res = await fetch(`${this.o.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: p.signal,
        headers: {
          'content-type': 'application/json',
          ...(this.o.apiKey ? { authorization: `Bearer ${this.o.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.model,
          messages: p.messages,
          max_tokens: p.maxTokens,
          temperature: p.temperature,
          stream: true,
          ...this.o.extraBody,
        }),
      });
    } catch (e) {
      if (p.signal.aborted) throw new ProviderError('timeout', 'The model took too long to respond.');
      throw new ProviderError('unavailable', `Model backend unreachable (${(e as Error).name}).`);
    }
    if (res.status === 402 || res.status === 429) throw new ProviderError('quota', 'The model provider reports that the free quota is exhausted or rate-limited.');
    if (res.status === 503) throw new ProviderError('unavailable', 'The model is still loading. Try again in a minute.');
    if (!res.ok || !res.body) throw new ProviderError('upstream', `Model backend returned HTTP ${res.status}.`);

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') return;
          try {
            const j = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
            const t = j.choices?.[0]?.delta?.content;
            if (t) yield t;
          } catch {
            /* ignore keep-alive / partial frames */
          }
        }
      }
    } catch (e) {
      if (p.signal.aborted) throw new ProviderError('timeout', 'The model took too long to respond.');
      throw e;
    }
  }
}

/** Build the provider from environment variables. See docs/AI_TUTOR.md. */
export function providerFromEnv(env: NodeJS.ProcessEnv = process.env): Provider {
  const kind = env.TUTOR_PROVIDER ?? 'llamacpp';
  if (kind === 'none') return new DisabledProvider();
  if (kind === 'hf-router') {
    const token = env.HF_TOKEN;
    if (!token) return new DisabledProvider();
    return new OpenAICompatibleProvider({
      name: 'hf-router',
      baseUrl: 'https://router.huggingface.co/v1',
      model: env.HF_ROUTER_MODEL ?? 'Qwen/Qwen3-4B-Instruct-2507',
      apiKey: token,
      monthlyRequestCap: Number(env.HF_ROUTER_MONTHLY_REQUEST_CAP ?? 300),
    });
  }
  const base = env.LLAMA_URL ?? 'http://127.0.0.1:8081';
  return new OpenAICompatibleProvider({
    name: 'llamacpp',
    baseUrl: `${base}/v1`,
    healthUrl: `${base}/health`,
    model: env.TUTOR_MODEL ?? 'local',
    extraBody: { chat_template_kwargs: { enable_thinking: false }, cache_prompt: true },
  });
}
