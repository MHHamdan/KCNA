import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import {
  buildChat,
  cleanModelOutput,
  contentIndex,
  retrieve,
  validateTutorRequest,
  TUTOR_LIMITS,
} from '@kcna/engine';
import { Gate, RateLimiter } from './limits';
import { ProviderError, providerFromEnv, type Provider } from './providers';

export interface ServerConfig {
  port: number;
  staticDir?: string;
  allowedOrigins: string[];
  provider: Provider;
  rateLimit: { max: number; windowMs: number };
  concurrency: number;
  maxQueue: number;
  maxTokens: number;
  timeoutMs: number;
}

export function configFromEnv(env = process.env): ServerConfig {
  return {
    port: Number(env.PORT ?? 7860),
    staticDir: env.STATIC_DIR,
    allowedOrigins: (env.ALLOWED_ORIGINS ?? 'https://mhhamdan.github.io').split(',').map((s) => s.trim()).filter(Boolean),
    provider: providerFromEnv(env),
    rateLimit: { max: Number(env.RATE_LIMIT_MAX ?? 20), windowMs: Number(env.RATE_LIMIT_WINDOW_MS ?? 10 * 60_000) },
    concurrency: Number(env.TUTOR_CONCURRENCY ?? 1),
    maxQueue: Number(env.TUTOR_MAX_QUEUE ?? 4),
    maxTokens: Number(env.TUTOR_MAX_TOKENS ?? 600),
    timeoutMs: Number(env.TUTOR_TIMEOUT_MS ?? 180_000),
  };
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  // The Space page on huggingface.co embeds the app in an iframe.
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'self' https://huggingface.co https://*.hf.space",
};

const MAX_BODY = 32 * 1024;

function clientKey(req: IncomingMessage): string {
  // HF Spaces sit behind a proxy; the first X-Forwarded-For hop is the client.
  const xff = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0].trim();
  return ip || req.socket.remoteAddress || 'unknown';
}

function json(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw new Error('too-large');
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function createApp(cfg: ServerConfig) {
  const limiter = new RateLimiter(cfg.rateLimit.max, cfg.rateLimit.windowMs);
  const gate = new Gate(cfg.concurrency, cfg.maxQueue);
  const index = contentIndex();
  const staticRoot = cfg.staticDir ? resolve(cfg.staticDir) : undefined;

  /** Returns CORS headers, or null if this cross-origin caller is not allowed. */
  function cors(req: IncomingMessage): Record<string, string> | null {
    const origin = req.headers.origin;
    if (!origin) return {};
    const host = req.headers['x-forwarded-host'] ?? req.headers.host;
    try {
      if (new URL(origin).host === host) return {};
    } catch {
      return null;
    }
    if (!cfg.allowedOrigins.includes(origin)) return null;
    return { 'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-max-age': '600' };
  }

  async function health(res: ServerResponse, h: Record<string, string>) {
    const state = await cfg.provider.state();
    json(res, 200, {
      status: 'ok',
      tutor: { provider: cfg.provider.name, model: cfg.provider.model, state, queued: gate.queued },
      limits: { ...TUTOR_LIMITS, requestsPerWindow: cfg.rateLimit.max, windowMinutes: cfg.rateLimit.windowMs / 60_000 },
      corpusDocs: index.size,
    }, h);
  }

  async function chat(req: IncomingMessage, res: ServerResponse, h: Record<string, string>) {
    if (!String(req.headers['content-type'] ?? '').includes('application/json')) return json(res, 415, { error: 'bad-request', message: 'Use application/json.' }, h);
    const wait = limiter.check(clientKey(req));
    if (wait) return json(res, 429, { error: 'rate-limited', message: `Tutor request limit reached. Try again in ${wait}s.`, retryAfter: wait }, { ...h, 'retry-after': String(wait) });
    let body: unknown;
    try {
      body = JSON.parse(await readBody(req));
    } catch (e) {
      return json(res, (e as Error).message === 'too-large' ? 413 : 400, { error: 'bad-request', message: 'Invalid or oversized JSON body.' }, h);
    }
    const v = validateTutorRequest(body);
    if (!v.ok) return json(res, 400, { error: 'bad-request', message: v.error }, h);

    const state = await cfg.provider.state();
    if (state !== 'ready') {
      const code = state === 'quota-exhausted' ? 'quota' : state === 'disabled' ? 'disabled' : state === 'loading' ? 'loading' : 'unavailable';
      return json(res, 503, { error: code, message: `AI tutor is ${state.replace('-', ' ')}.` }, h);
    }

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), cfg.timeoutMs);
    res.on('close', () => ac.abort());
    let release: (() => void) | null;
    try {
      release = await gate.acquire(ac.signal);
    } catch {
      clearTimeout(timer);
      return;
    }
    if (!release) {
      clearTimeout(timer);
      return json(res, 503, { error: 'busy', message: 'The tutor is busy answering other learners. Try again shortly.' }, h);
    }

    const hits = retrieve(index, v.value);
    const { messages, sources } = buildChat(v.value, hits);
    res.writeHead(200, { ...h, 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no', connection: 'keep-alive' });
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send('meta', { sources, model: cfg.provider.model, provider: cfg.provider.name });
    const started = Date.now();
    let out = '';
    let sentLen = 0;
    try {
      for await (const tok of cfg.provider.stream({ messages, maxTokens: cfg.maxTokens, temperature: 0.3, signal: ac.signal })) {
        out += tok;
        // strip reasoning traces before forwarding; hold back while a <think> block is open
        const clean = cleanModelOutput(out);
        if (out.includes('<think>') && !out.includes('</think>')) continue;
        if (clean.length > sentLen) {
          send('token', { t: clean.slice(sentLen) });
          sentLen = clean.length;
        }
      }
      send('done', { ms: Date.now() - started });
      log(`tutor ok mode=${v.value.mode} turns=${v.value.messages.length} chars=${sentLen} ms=${Date.now() - started}`);
    } catch (e) {
      const pe = e instanceof ProviderError ? e : new ProviderError('upstream', 'Unexpected model error.');
      send('error', { code: pe.code, message: pe.message });
      log(`tutor err code=${pe.code} ms=${Date.now() - started}`);
    } finally {
      clearTimeout(timer);
      release();
      res.end();
    }
  }

  function serveStatic(req: IncomingMessage, res: ServerResponse) {
    if (!staticRoot) return json(res, 404, { error: 'not-found' });
    const url = new URL(req.url ?? '/', 'http://x');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = normalize(join(staticRoot, rel));
    if (!file.startsWith(staticRoot)) return json(res, 403, { error: 'forbidden' });
    const target = existsSync(file) && statSync(file).isFile() ? file : join(staticRoot, 'index.html');
    const isAsset = target.includes(`${staticRoot}/assets/`);
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'content-type': MIME[extname(target)] ?? 'application/octet-stream',
      'cache-control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(target).pipe(res);
  }

  return createServer(async (req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    try {
      if (path.startsWith('/api/')) {
        const h = cors(req);
        if (h === null) return json(res, 403, { error: 'forbidden-origin' });
        if (req.method === 'OPTIONS') {
          res.writeHead(204, h);
          return res.end();
        }
        if (path === '/api/health' && req.method === 'GET') return await health(res, h);
        if (path === '/api/tutor/chat' && req.method === 'POST') return await chat(req, res, h);
        return json(res, 404, { error: 'not-found' }, h);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'method-not-allowed' });
      return serveStatic(req, res);
    } catch (e) {
      log(`error ${(e as Error).message}`);
      if (!res.headersSent) json(res, 500, { error: 'internal' });
      else res.end();
    }
  });
}

// Privacy: never log message content, IPs or tokens.
function log(msg: string) {
  if (process.env.NODE_ENV !== 'test') console.log(`${new Date().toISOString()} ${msg}`);
}
