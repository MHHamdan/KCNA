import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, type ServerConfig } from '../src/server';
import { DisabledProvider, OpenAICompatibleProvider, type Provider } from '../src/providers';

// A fake OpenAI-compatible model server (stands in for llama-server / HF router).
let mockBehaviour: 'ok' | 'quota' | 'down' | 'slow' | 'loading' | 'wrong' = 'ok';
let lastBody: { messages: { role: string; content: string }[]; max_tokens: number } | null = null;
let mock: Server;
let mockUrl = '';

beforeAll(async () => {
  mock = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(mockBehaviour === 'loading' ? 503 : 200).end('{}');
      return;
    }
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      lastBody = JSON.parse(body);
      if (mockBehaviour === 'quota') return void res.writeHead(402).end('{"error":"payment required"}');
      if (mockBehaviour === 'down') return void res.writeHead(500).end();
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const send = (t: string) => res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`);
      if (mockBehaviour === 'slow') return void setTimeout(() => res.end(), 2000);
      if (mockBehaviour === 'wrong') {
        send('To roll back, delete the Deployment and apply it again.');
        res.write('data: [DONE]\n\n');
        return void res.end();
      }
      send('<think>internal</think>');
      send('A Pod is ');
      send('the smallest unit [1].');
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });
  await new Promise<void>((r) => mock.listen(0, '127.0.0.1', r));
  mockUrl = `http://127.0.0.1:${(mock.address() as AddressInfo).port}`;
});
afterAll(() => mock.close());

function cfg(over: Partial<ServerConfig> = {}): ServerConfig {
  return {
    port: 0,
    allowedOrigins: ['https://mhhamdan.github.io'],
    provider: new OpenAICompatibleProvider({ name: 'llamacpp', baseUrl: `${mockUrl}/v1`, healthUrl: `${mockUrl}/health`, model: 'test-model' }),
    rateLimit: { max: 100, windowMs: 60_000 },
    concurrency: 1,
    maxQueue: 2,
    maxTokens: 300,
    timeoutMs: 10_000,
    ...over,
  };
}

async function start(c: ServerConfig) {
  const s = createApp(c);
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  return { s, url: `http://127.0.0.1:${(s.address() as AddressInfo).port}` };
}

async function chat(url: string, body: unknown, headers: Record<string, string> = {}) {
  const r = await fetch(`${url}/api/tutor/chat`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const text = await r.text();
  const events = [...text.matchAll(/event: (\w+)\ndata: (.*)\n/g)].map((m) => ({ event: m[1], data: JSON.parse(m[2]) }));
  return { status: r.status, headers: r.headers, text, events };
}

const ask = (content: string, extra: object = {}) => ({ mode: 'explain', messages: [{ role: 'user', content }], ...extra });

describe('tutor API', () => {
  it('reports health without leaking secrets', async () => {
    const { s, url } = await start(cfg());
    const j = await (await fetch(`${url}/api/health`)).json();
    expect(j.tutor).toMatchObject({ provider: 'llamacpp', model: 'test-model', state: 'ready' });
    expect(JSON.stringify(j)).not.toMatch(/token|hf_/i);
    s.close();
  });

  it('streams a grounded answer with sources and strips reasoning traces', async () => {
    mockBehaviour = 'ok';
    const { s, url } = await start(cfg());
    const r = await chat(url, ask('What is a Pod?'));
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toMatch(/event-stream/);
    const meta = r.events.find((e) => e.event === 'meta')!;
    expect(meta.data.sources.length).toBeGreaterThan(0);
    const answer = r.events.filter((e) => e.event === 'token').map((e) => e.data.t).join('');
    expect(answer).toBe('A Pod is the smallest unit [1].');
    expect(r.events.at(-1)!.event).toBe('done');
    expect(lastBody!.max_tokens).toBe(300);
    expect(lastBody!.messages[0].role).toBe('system');
    s.close();
  });

  it('appends verified corrections when the model repeats a known misconception', async () => {
    mockBehaviour = 'wrong';
    const { s, url } = await start(cfg());
    const r = await chat(url, ask('How do I roll back?'));
    const notes = r.events.find((e) => e.event === 'notes');
    expect(notes?.data.notes[0]).toMatchObject({ id: 'rollback-by-delete', lessonId: 'rollouts-and-deployment-strategies' });
    expect(r.events.at(-1)!.event).toBe('done');
    mockBehaviour = 'ok';
    const ok = await chat(url, ask('What is a Pod?'));
    expect(ok.events.some((e) => e.event === 'notes')).toBe(false);
    s.close();
  });

  it('forwards conversation history for follow-up questions', async () => {
    mockBehaviour = 'ok';
    const { s, url } = await start(cfg());
    await chat(url, {
      mode: 'explain',
      messages: [
        { role: 'user', content: 'What is a Pod?' },
        { role: 'assistant', content: 'A Pod is the smallest deployable unit.' },
        { role: 'user', content: 'What happens if it crashes?' },
      ],
    });
    const roles = lastBody!.messages.map((m) => m.role);
    expect(roles).toEqual(['system', 'user', 'assistant', 'user']);
    expect(lastBody!.messages[2].content).toMatch(/smallest deployable unit/);
    expect(lastBody!.messages[3].content).toMatch(/What happens if it crashes\?/);
    s.close();
  });

  it('returns 503 with a clear code when the model is unavailable or loading', async () => {
    const { s, url } = await start(cfg({ provider: new OpenAICompatibleProvider({ name: 'llamacpp', baseUrl: 'http://127.0.0.1:1/v1', healthUrl: 'http://127.0.0.1:1/health', model: 'x' }) }));
    const r = await chat(url, ask('hi'));
    expect(r.status).toBe(503);
    expect(JSON.parse(r.text).error).toBe('unavailable');
    s.close();
    mockBehaviour = 'loading';
    const b = await start(cfg());
    expect(JSON.parse((await chat(b.url, ask('hi'))).text).error).toBe('loading');
    b.s.close();
  });

  it('surfaces quota exhaustion from the provider as an error event', async () => {
    mockBehaviour = 'quota';
    const { s, url } = await start(cfg());
    const r = await chat(url, ask('hi'));
    const err = r.events.find((e) => e.event === 'error')!;
    expect(err.data.code).toBe('quota');
    s.close();
  });

  it('enforces a monthly request cap for paid providers', async () => {
    mockBehaviour = 'ok';
    const capped = new OpenAICompatibleProvider({ name: 'hf-router', baseUrl: `${mockUrl}/v1`, model: 'm', apiKey: 'secret', monthlyRequestCap: 1 });
    const { s, url } = await start(cfg({ provider: capped }));
    expect((await chat(url, ask('one'))).status).toBe(200);
    const second = await chat(url, ask('two'));
    expect(second.status).toBe(503);
    expect(JSON.parse(second.text).error).toBe('quota');
    s.close();
  });

  it('reports disabled tutor deployments', async () => {
    const { s, url } = await start(cfg({ provider: new DisabledProvider() as Provider }));
    expect(JSON.parse((await chat(url, ask('hi'))).text).error).toBe('disabled');
    s.close();
  });

  it('times out slow models', async () => {
    mockBehaviour = 'slow';
    const { s, url } = await start(cfg({ timeoutMs: 300 }));
    const r = await chat(url, ask('hi'));
    expect(r.events.some((e) => e.event === 'error' || e.event === 'done')).toBe(true);
    s.close();
  });

  it('rate-limits per client', async () => {
    mockBehaviour = 'ok';
    const { s, url } = await start(cfg({ rateLimit: { max: 2, windowMs: 60_000 } }));
    const h = { 'x-forwarded-for': '203.0.113.9' };
    expect((await chat(url, ask('a'), h)).status).toBe(200);
    expect((await chat(url, ask('b'), h)).status).toBe(200);
    const third = await chat(url, ask('c'), h);
    expect(third.status).toBe(429);
    expect(third.headers.get('retry-after')).toBeTruthy();
    expect((await chat(url, ask('d'), { 'x-forwarded-for': '198.51.100.1' })).status).toBe(200);
    s.close();
  });

  it('validates input and size', async () => {
    const { s, url } = await start(cfg());
    expect((await chat(url, { mode: 'explain', messages: [{ role: 'user', content: 'x'.repeat(2500) }] })).status).toBe(400);
    expect((await chat(url, { mode: 'evil', messages: [{ role: 'user', content: 'x' }] })).status).toBe(400);
    const big = await fetch(`${url}/api/tutor/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pad: 'x'.repeat(40_000) }) });
    expect(big.status).toBe(413);
    const wrongType = await fetch(`${url}/api/tutor/chat`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'hi' });
    expect(wrongType.status).toBe(415);
    s.close();
  });

  it('allows the GitHub Pages origin and blocks others', async () => {
    mockBehaviour = 'ok';
    const { s, url } = await start(cfg());
    const ok = await chat(url, ask('hi'), { origin: 'https://mhhamdan.github.io' });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://mhhamdan.github.io');
    const pre = await fetch(`${url}/api/tutor/chat`, { method: 'OPTIONS', headers: { origin: 'https://mhhamdan.github.io' } });
    expect(pre.status).toBe(204);
    const bad = await chat(url, ask('hi'), { origin: 'https://evil.example' });
    expect(bad.status).toBe(403);
    s.close();
  });

  it('serves static files with security headers and blocks path traversal', async () => {
    const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'kcna-static-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>KCNA</title>');
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'assets', 'a.js'), 'console.log(1)');
    const { s, url } = await start(cfg({ staticDir: dir }));
    const home = await fetch(url + '/');
    expect(home.status).toBe(200);
    expect(home.headers.get('content-security-policy')).toMatch(/frame-ancestors/);
    expect((await fetch(url + '/assets/a.js')).headers.get('cache-control')).toMatch(/immutable/);
    const trav = await fetch(url + '/..%2f..%2fetc%2fpasswd');
    expect(await trav.text()).not.toMatch(/root:/);
    s.close();
  });
});
