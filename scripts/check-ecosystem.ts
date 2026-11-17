// Compares the ecosystem explorer's CNCF maturity levels with the official CNCF
// landscape data. Usage: npm run check:ecosystem  (exits 1 on any mismatch)
import { parse } from 'yaml';
import { ecosystemProjects } from '@kcna/content';

const res = await fetch('https://raw.githubusercontent.com/cncf/landscape/master/landscape.yml');
if (!res.ok) throw new Error(`landscape download failed: HTTP ${res.status}`);
const y = parse(await res.text()) as { landscape: { subcategories?: { items?: { name: string; project?: string }[] }[] }[] };
const maturity = new Map<string, string>();
for (const c of y.landscape) for (const sc of c.subcategories ?? []) for (const it of sc.items ?? []) if (it.project) maturity.set(it.name.toLowerCase(), it.project);

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
let bad = 0;
for (const p of ecosystemProjects) {
  const hit = [...maturity.entries()].find(([k]) => key(k) === key(p.name) || k.startsWith(p.name.toLowerCase() + ' '));
  const actual = hit ? hit[1] : 'non-cncf';
  if (actual !== p.maturity) {
    bad++;
    console.log(`MISMATCH ${p.name}: content=${p.maturity} landscape=${actual}`);
  }
}
console.log(`Checked ${ecosystemProjects.length} projects against ${maturity.size} CNCF projects.`);
process.exit(bad ? 1 : 0);

export {};
