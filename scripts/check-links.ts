// Verifies every external reference URL in the content resolves (no invented links).
// Usage: npm run check:links   (exits 1 if any link is broken)
import { comparisons, designCases, ecosystemProjects, infraLessons, infraQuestions, infraResources, INFRA_CORE_REFERENCES, labs, lessons, questions, resources, troubleshootingScenarios } from '@kcna/content';

const urls = new Map<string, string[]>();
const add = (url: string, where: string) => urls.set(url, [...(urls.get(url) ?? []), where]);
for (const l of lessons) l.references.forEach((r) => add(r.url, `lesson:${l.id}`));
for (const q of questions) q.references.forEach((r) => add(r.url, `question:${q.id}`));
for (const l of labs) l.references.forEach((r) => add(r.url, `lab:${l.id}`));
for (const s of troubleshootingScenarios) s.references.forEach((r) => add(r.url, `troubleshoot:${s.id}`));
for (const r of resources) add(r.url, 'resources');
for (const p of ecosystemProjects) add(p.url, `ecosystem:${p.name}`);
for (const l of infraLessons) l.references.forEach((r) => add(r.url, `infra-lesson:${l.id}`));
for (const q of infraQuestions) q.references.forEach((r) => add(r.url, `infra-question:${q.id}`));
for (const c of designCases) c.references.forEach((r) => add(r.url, `design:${c.id}`));
for (const r of infraResources) add(r.url, 'infra-resources');
for (const r of INFRA_CORE_REFERENCES) add(r.url, 'infra-core');
void comparisons;

async function check(url: string): Promise<number> {
  for (const method of ['HEAD', 'GET'] as const) {
    try {
      const r = await fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(20_000), headers: { 'user-agent': 'Mozilla/5.0 (kcna-link-check)' } });
      if (r.ok || (method === 'GET' && r.status < 400)) return r.status;
      if (method === 'GET') return r.status;
    } catch {
      if (method === 'GET') return 0;
    }
  }
  return 0;
}

const list = [...urls.keys()];
const bad: { url: string; status: number; where: string[] }[] = [];
let i = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (i < list.length) {
      const url = list[i++];
      const status = await check(url);
      // 403/429 usually mean bot protection, not a missing page
      if (status === 0 || (status >= 400 && status !== 403 && status !== 429)) bad.push({ url, status, where: urls.get(url)! });
    }
  }),
);
console.log(`Checked ${list.length} unique URLs.`);
for (const b of bad) console.log(`BROKEN ${b.status} ${b.url}  <- ${b.where.slice(0, 4).join(', ')}${b.where.length > 4 ? ` (+${b.where.length - 4})` : ''}`);
process.exit(bad.length ? 1 : 0);
