// Assembles the Hugging Face Space repository contents into .space-build/:
//   README.md, Dockerfile, start.sh   (from space/)
//   server.mjs                         (bundled API from apps/api/dist)
//   web/                               (HF build of the web app from apps/web/dist)
// Run after `npm run build`. CI uploads this folder to the Space.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, '.space-build');
const need = [join(root, 'apps/web/dist/index.html'), join(root, 'apps/api/dist/server.mjs')];
for (const f of need) if (!existsSync(f)) throw new Error(`Missing ${f} — run "npm run build" first.`);

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ['README.md', 'Dockerfile', 'start.sh']) cpSync(join(root, 'space', f), join(out, f));
cpSync(join(root, 'apps/api/dist/server.mjs'), join(out, 'server.mjs'));
cpSync(join(root, 'apps/web/dist'), join(out, 'web'), { recursive: true });
// lets CI confirm the Space is serving this exact commit
writeFileSync(join(out, 'web', 'version.json'), JSON.stringify({ sha: process.env.GITHUB_SHA ?? 'local', builtAt: new Date().toISOString() }));
console.log(`Space bundle ready in ${out}`);
