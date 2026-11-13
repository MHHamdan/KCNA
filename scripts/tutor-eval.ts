// Evaluates a deployed tutor against KCNA facts it must state (and common errors it
// must not make), and measures latency. Usage:
//   npx tsx scripts/tutor-eval.ts [baseUrl]      (default https://mhamdan-kcna.hf.space)
// Results feed docs/MODEL_SELECTION.md.

interface Case {
  name: string;
  turns: string[];
  context?: Record<string, unknown>;
  must: RegExp[];
  mustNot: RegExp[];
}

const CASES: Case[] = [
  {
    name: 'container crash vs Pod replacement',
    turns: ['A container in one of my Deployment’s Pods keeps crashing. What does Kubernetes do?'],
    must: [/restart/i, /(in place|same pod|kubelet)/i, /crashloopbackoff/i],
    mustNot: [/data (inside|in) the container[^.]*(preserved|safe|kept)/i, /\bno data loss\b/i],
  },
  {
    name: 'rollback',
    turns: ['How do I roll back a Deployment to the previous version?'],
    must: [/rollout undo/i],
    mustNot: [/delete the deployment[^.]*roll/i],
  },
  {
    name: 'secrets encoding',
    turns: ['Are Kubernetes Secrets encrypted by default?'],
    must: [/base64/i, /\bnot\b/i],
    mustNot: [/secrets are encrypted by default/i],
  },
  {
    name: 'scheduler role',
    turns: ['What exactly does the kube-scheduler do?'],
    must: [/node/i, /(filter|scor|assign|bind)/i],
    mustNot: [/scheduler (starts|runs|launches|creates) (the )?containers/i],
  },
  {
    name: 'service vs ingress',
    turns: ['What is the difference between a Service and an Ingress?'],
    must: [/(http|layer 7|l7|host|path)/i, /(clusterip|stable|virtual ip|load.?balanc)/i],
    mustNot: [],
  },
  {
    name: 'state store',
    turns: ['Which component stores the cluster state?'],
    must: [/etcd/i],
    mustNot: [],
  },
  {
    name: 'follow-up continuity',
    turns: ['What is a ReplicaSet?', 'And how is it related to a Deployment?'],
    must: [/deployment/i, /replicaset/i, /(manag|own|creat)/i],
    mustNot: [],
  },
];

const base = process.argv[2] ?? 'https://mhamdan-kcna.hf.space';

async function ask(messages: { role: string; content: string }[], context: Record<string, unknown> = {}) {
  const t0 = Date.now();
  let first: number | null = null;
  let text = '';
  const res = await fetch(`${base}/api/tutor/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'explain', level: 'beginner', messages, context }),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const ev = frame.match(/^event: (.*)$/m)?.[1];
      const data = frame.match(/^data: (.*)$/m)?.[1];
      if (ev === 'token' && data) {
        first ??= Date.now() - t0;
        text += JSON.parse(data).t;
      }
      if (ev === 'error' && data) throw new Error(JSON.parse(data).message);
    }
  }
  return { text, first: (first ?? 0) / 1000, total: (Date.now() - t0) / 1000 };
}

const health = await (await fetch(`${base}/api/health`)).json();
console.log(`model: ${health.tutor.model} (${health.tutor.state})`);
let passed = 0;
let checks = 0;
const lat: { first: number; total: number; words: number }[] = [];
for (const c of CASES) {
  const msgs: { role: string; content: string }[] = [];
  let last = { text: '', first: 0, total: 0 };
  for (const t of c.turns) {
    msgs.push({ role: 'user', content: t });
    last = await ask(msgs, c.context);
    msgs.push({ role: 'assistant', content: last.text });
    lat.push({ first: last.first, total: last.total, words: last.text.split(/\s+/).length });
  }
  const fails = [
    ...c.must.filter((r) => !r.test(last.text)).map((r) => `missing ${r}`),
    ...c.mustNot.filter((r) => r.test(last.text)).map((r) => `contains "${last.text.match(r)![0].slice(0, 120)}"`),
  ];
  const n = c.must.length + c.mustNot.length;
  passed += n - fails.length;
  checks += n;
  console.log(`${fails.length ? '✗' : '✓'} ${c.name} — first ${last.first.toFixed(1)}s, total ${last.total.toFixed(1)}s${fails.length ? ' — ' + fails.join('; ') : ''}`);
}
const avg = (k: 'first' | 'total' | 'words') => lat.reduce((a, x) => a + x[k], 0) / lat.length;
console.log(`\nfact checks: ${passed}/${checks} (${Math.round((passed / checks) * 100)}%)`);
console.log(`avg first token ${avg('first').toFixed(1)}s · avg total ${avg('total').toFixed(1)}s · avg ${Math.round(avg('words'))} words · ~${(avg('words') * 1.35 / Math.max(0.1, avg('total') - avg('first'))).toFixed(1)} tok/s`);

export {};
