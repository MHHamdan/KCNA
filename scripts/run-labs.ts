// Executes the "full" labs against a real kind cluster (named kcna, created by
// the labs workflow) and reports which commands fail. Interactive commands are
// made non-interactive; watches are time-boxed; port-forward is skipped.
// Usage: npx tsx scripts/run-labs.ts [lab-id ...]
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { labs } from '@kcna/content';

interface Result {
  lab: string;
  cmd: string;
  status: 'ok' | 'fail' | 'skipped';
  code: number | null;
  output: string;
}

function prepare(cmd: string): { run?: string; skip?: string } {
  const c = cmd.trim();
  if (!c || c.startsWith('#')) return { skip: 'comment' };
  if (/^kind (create|delete) cluster/.test(c)) return { skip: 'cluster managed by the workflow' };
  if (/port-forward/.test(c)) return { skip: 'port-forward needs a second terminal' };
  if (/^(open|xdg-open|curl -s localhost|curl localhost)/.test(c)) return { skip: 'needs port-forward' };
  let run = c.replace(/\s-it\s/g, ' -i ').replace(/\s-ti\s/g, ' -i ');
  // time-box watches (they never exit on their own)
  if (/\s(-w|--watch)(\s|$)/.test(run)) run = `timeout 20 ${run} || true`;
  return { run };
}

function exec(cmd: string, cwd: string) {
  const r = spawnSync('bash', ['-o', 'pipefail', '-c', cmd], { cwd, encoding: 'utf8', timeout: 240_000, env: { ...process.env, KUBECONFIG: process.env.KUBECONFIG } });
  return { code: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().slice(-1500) };
}

const only = process.argv.slice(2);
const results: Result[] = [];
for (const lab of labs.filter((l) => l.status === 'full' && (!only.length || only.includes(l.id)))) {
  const dir = mkdtempSync(join(tmpdir(), `${lab.id}-`));
  console.log(`\n=== ${lab.id}`);
  const cmds = [...lab.tasks.flatMap((t) => t.commands), ...lab.validation.map((v) => v.command)];
  for (const cmd of cmds) {
    const p = prepare(cmd);
    if (p.skip) {
      results.push({ lab: lab.id, cmd, status: 'skipped', code: null, output: p.skip });
      continue;
    }
    const r = exec(p.run!, dir);
    const ok = r.code === 0;
    results.push({ lab: lab.id, cmd, status: ok ? 'ok' : 'fail', ...r });
    console.log(`${ok ? '✓' : '✗'} ${cmd.split('\n')[0].slice(0, 110)}${ok ? '' : `\n    exit ${r.code}: ${r.output.split('\n').slice(-3).join(' | ')}`}`);
  }
  for (const cmd of lab.cleanup) {
    const p = prepare(cmd);
    if (p.run) exec(`${p.run} || true`, dir);
  }
}

const by = (lab: string) => results.filter((r) => r.lab === lab);
const labsRun = [...new Set(results.map((r) => r.lab))];
const lines = ['| Lab | Commands run | Passed | Failed | Skipped |', '|---|---:|---:|---:|---:|'];
for (const l of labsRun) {
  const rs = by(l);
  lines.push(`| ${l} | ${rs.filter((r) => r.status !== 'skipped').length} | ${rs.filter((r) => r.status === 'ok').length} | ${rs.filter((r) => r.status === 'fail').length} | ${rs.filter((r) => r.status === 'skipped').length} |`);
}
const fails = results.filter((r) => r.status === 'fail');
if (fails.length) {
  lines.push('', '### Failures', '');
  for (const f of fails) lines.push(`- **${f.lab}** \`${f.cmd.split('\n')[0].slice(0, 120)}\` → exit ${f.code}: \`${f.output.split('\n').slice(-2).join(' ').slice(0, 300)}\``);
}
const summary = lines.join('\n');
console.log(`\n${summary}`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Lab verification on kind\n\n${summary}\n`);
process.exit(fails.length ? 1 : 0);
