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
  status: 'ok' | 'expected-error' | 'fail' | 'skipped';
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

// One logical terminal session per lab: shell variables set by one command
// (e.g. NODE_PORT=$(...)) are visible to the next, as they are for a learner.
function exec(cmd: string, cwd: string) {
  const env = join(cwd, '.session-env');
  const script = `set -a; [ -f ${env} ] && . ${env}; ${cmd}\nrc=$?; set +a; export -p > ${env}.next 2>/dev/null; exit $rc`;
  const r = spawnSync('bash', ['-o', 'pipefail', '-c', script], { cwd, encoding: 'utf8', timeout: 240_000 });
  spawnSync('bash', ['-c', `[ -f ${env}.next ] && grep -vE ' (BASHOPTS|BASH_[A-Z_]+|SHELLOPTS|PWD|OLDPWD|SHLVL|_)=' ${env}.next > ${env}; true`]);
  return { code: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().slice(-1500) };
}

/** A failing command is fine when the lab itself says this error is the expected outcome. */
function expectedError(output: string, expected: string | undefined): boolean {
  if (!expected) return false;
  const lines = output.split('\n').map((l) => l.trim()).filter((l) => /error|not found|timed out/i.test(l));
  return lines.some((l) => expected.includes(l) || expected.includes(l.replace(/^error: /, '')));
}

const only = process.argv.slice(2);
const results: Result[] = [];
for (const lab of labs.filter((l) => l.status === 'full' && (!only.length || only.includes(l.id)))) {
  const dir = mkdtempSync(join(tmpdir(), `${lab.id}-`));
  console.log(`\n=== ${lab.id}`);
  const cmds = [
    ...lab.tasks.flatMap((t) => t.commands.map((c) => ({ cmd: c, expected: t.expected }))),
    ...lab.validation.map((v) => ({ cmd: v.command, expected: v.expected })),
  ];
  for (const { cmd, expected } of cmds) {
    const p = prepare(cmd);
    if (p.skip) {
      results.push({ lab: lab.id, cmd, status: 'skipped', code: null, output: p.skip });
      continue;
    }
    const r = exec(p.run!, dir);
    const status: Result['status'] = r.code === 0 ? 'ok' : expectedError(r.output, expected) ? 'expected-error' : 'fail';
    results.push({ lab: lab.id, cmd, status, ...r });
    const mark = status === 'ok' ? '✓' : status === 'expected-error' ? '✓ (expected error)' : '✗';
    console.log(`${mark} ${cmd.split('\n')[0].slice(0, 110)}${status === 'fail' ? `\n    exit ${r.code}: ${r.output.split('\n').slice(-3).join(' | ')}` : ''}`);
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
  lines.push(`| ${l} | ${rs.filter((r) => r.status !== 'skipped').length} | ${rs.filter((r) => r.status === 'ok' || r.status === 'expected-error').length} | ${rs.filter((r) => r.status === 'fail').length} | ${rs.filter((r) => r.status === 'skipped').length} |`);
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
