import type { KubectlExpectation } from '@kcna/content';

// Parser for the simulated terminal. It understands enough kubectl grammar to
// accept reasonable variations (aliases, flag order, -n vs --namespace,
// pod/name vs pod name, --flag=value vs --flag value).

export const RESOURCE_ALIASES: Record<string, string> = {};
const KINDS: [string, string[]][] = [
  ['pods', ['pod', 'po']],
  ['deployments', ['deployment', 'deploy']],
  ['replicasets', ['replicaset', 'rs']],
  ['services', ['service', 'svc']],
  ['nodes', ['node', 'no']],
  ['namespaces', ['namespace', 'ns']],
  ['configmaps', ['configmap', 'cm']],
  ['secrets', ['secret']],
  ['events', ['event', 'ev']],
  ['persistentvolumeclaims', ['persistentvolumeclaim', 'pvc']],
  ['persistentvolumes', ['persistentvolume', 'pv']],
  ['storageclasses', ['storageclass', 'sc']],
  ['ingresses', ['ingress', 'ing']],
  ['networkpolicies', ['networkpolicy', 'netpol']],
  ['serviceaccounts', ['serviceaccount', 'sa']],
  ['roles', ['role']],
  ['rolebindings', ['rolebinding']],
  ['clusterroles', ['clusterrole']],
  ['clusterrolebindings', ['clusterrolebinding']],
  ['jobs', ['job']],
  ['cronjobs', ['cronjob', 'cj']],
  ['daemonsets', ['daemonset', 'ds']],
  ['statefulsets', ['statefulset', 'sts']],
  ['endpoints', ['endpoint', 'ep']],
  ['endpointslices', ['endpointslice']],
  ['horizontalpodautoscalers', ['horizontalpodautoscaler', 'hpa']],
  ['all', []],
];
for (const [canon, aliases] of KINDS) {
  RESOURCE_ALIASES[canon] = canon;
  for (const a of aliases) RESOURCE_ALIASES[a] = canon;
}

/** Canonicalize a resource token, tolerating "deployments.apps" style group suffixes. */
export function canonicalResource(token: string): string | undefined {
  const t = token.toLowerCase().split('.')[0];
  return RESOURCE_ALIASES[t];
}

const SHORT_FLAGS: Record<string, string> = {
  o: 'output',
  n: 'namespace',
  A: 'all-namespaces',
  l: 'selector',
  p: 'previous',
  c: 'container',
  w: 'watch',
  i: 'stdin',
  t: 'tty',
};
/** Flags that never take a value. */
const BOOLEAN_FLAGS = new Set(['all-namespaces', 'previous', 'watch', 'show-labels', 'follow', 'stdin', 'tty', 'all', 'recursive', 'record', 'dry-run', 'wide', 'help', 'force', 'now']);
const SUBCOMMAND_VERBS = new Set(['rollout', 'config', 'auth', 'set', 'top', 'create']);
const SUBCOMMANDS: Record<string, Set<string>> = {
  rollout: new Set(['status', 'history', 'undo', 'restart', 'pause', 'resume']),
  config: new Set(['get-contexts', 'current-context', 'use-context', 'view', 'set-context']),
  auth: new Set(['can-i', 'whoami']),
  set: new Set(['image', 'resources', 'env', 'selector']),
};

export interface ParsedCommand {
  verb: string;
  subcommand?: string;
  resource?: string;
  name?: string;
  namespace?: string;
  flags: Record<string, string>;
  args: string[];
  raw: string;
}

export type ParseResult = { ok: true; cmd: ParsedCommand } | { ok: false; error: string };

/** Shell-like split honouring single and double quotes. */
export function splitArgs(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: string | null = null;
  let has = false;
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
    } else if (/\s/.test(ch)) {
      if (cur || has) out.push(cur);
      cur = '';
      has = false;
    } else cur += ch;
  }
  if (cur || has) out.push(cur);
  return out;
}

export function parseKubectl(line: string): ParseResult {
  const tokens = splitArgs(line.trim());
  if (!tokens.length) return { ok: false, error: 'Empty command.' };
  if (tokens[0] === 'k') tokens[0] = 'kubectl';
  if (tokens[0] !== 'kubectl') return { ok: false, error: `This simulator only understands kubectl commands (got "${tokens[0]}").` };
  const flags: Record<string, string> = {};
  const positional: string[] = [];
  let verbSeen: string | undefined;
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '--') {
      positional.push(...tokens.slice(i));
      break;
    }
    if (t.startsWith('--')) {
      const [k, v] = t.slice(2).split(/=(.*)/s, 2);
      if (v !== undefined) flags[k] = v;
      else if (BOOLEAN_FLAGS.has(k) || i + 1 >= tokens.length || tokens[i + 1].startsWith('-')) flags[k] = '';
      else flags[k] = tokens[++i];
      continue;
    }
    if (t.startsWith('-') && t.length > 1) {
      const letter = t[1];
      // "-f" means --filename for apply/create/delete/replace and --follow for logs
      const name = letter === 'f' ? (verbSeen === 'logs' ? 'follow' : 'filename') : (SHORT_FLAGS[letter] ?? letter);
      const inline = t.slice(2).replace(/^=/, '');
      if (inline) flags[name] = inline;
      else if (BOOLEAN_FLAGS.has(name) || i + 1 >= tokens.length || tokens[i + 1].startsWith('-')) flags[name] = '';
      else flags[name] = tokens[++i];
      continue;
    }
    if (!verbSeen) verbSeen = t;
    positional.push(t);
  }
  if (!positional.length) return { ok: false, error: 'Missing kubectl verb, e.g. "kubectl get pods".' };
  const verb = positional.shift()!.toLowerCase();
  const cmd: ParsedCommand = { verb, flags, args: [], raw: line };
  if (flags.namespace !== undefined) cmd.namespace = flags.namespace;

  if (SUBCOMMANDS[verb] && positional.length) {
    const sub = positional[0].toLowerCase();
    if (SUBCOMMANDS[verb].has(sub)) {
      cmd.subcommand = sub;
      positional.shift();
    }
  } else if (verb === 'top' && positional.length) {
    // kubectl top pods|nodes
  } else if (SUBCOMMAND_VERBS.has(verb) && verb === 'create' && positional[0] === 'secret' && positional.length > 1) {
    // kubectl create secret generic NAME
    cmd.resource = 'secrets';
    cmd.subcommand = positional[1];
    cmd.name = positional[2];
    cmd.args = positional.slice(3);
    return { ok: true, cmd };
  }

  // resource and name: "pod web", "pod/web", "pods,svc"
  if (positional.length && verb !== 'logs' && verb !== 'exec' && verb !== 'port-forward' && verb !== 'run' && cmd.subcommand !== 'can-i') {
    const first = positional[0];
    if (first.includes('/')) {
      const [r, n] = first.split('/', 2);
      const canon = canonicalResource(r);
      if (canon) {
        cmd.resource = canon;
        cmd.name = n;
        positional.shift();
      }
    } else {
      const canon = canonicalResource(first);
      if (canon) {
        cmd.resource = canon;
        positional.shift();
        if (positional.length && !positional[0].includes('=')) cmd.name = positional.shift();
      }
    }
  } else if (positional.length && (verb === 'logs' || verb === 'exec' || verb === 'port-forward')) {
    const first = positional.shift()!;
    if (first.includes('/')) {
      const [r, n] = first.split('/', 2);
      cmd.resource = canonicalResource(r) ?? r;
      cmd.name = n;
    } else {
      cmd.resource = 'pods';
      cmd.name = first;
    }
  } else if (positional.length && verb === 'run') {
    cmd.resource = 'pods';
    cmd.name = positional.shift();
  } else if (cmd.subcommand === 'can-i') {
    // kubectl auth can-i <verb> <resource>
    cmd.args = positional.splice(0);
    if (cmd.args[1]) cmd.resource = canonicalResource(cmd.args[1]) ?? cmd.args[1];
    return { ok: true, cmd };
  }
  cmd.args = positional;
  return { ok: true, cmd };
}

const norm = (v: string) => v.trim().replace(/^['"]|['"]$/g, '');

/** Does a parsed command satisfy an expectation? Extra learner flags are tolerated. */
export function matchesExpectation(cmd: ParsedCommand, exp: KubectlExpectation): boolean {
  if (cmd.verb !== exp.verb) return false;
  if (exp.subcommand && cmd.subcommand !== exp.subcommand) return false;
  if (exp.resource) {
    const want = canonicalResource(exp.resource) ?? exp.resource;
    // logs/exec default to pods; "kubectl top pods" puts the kind in args
    const have = cmd.resource ?? (cmd.verb === 'top' && cmd.args[0] ? canonicalResource(cmd.args[0]) : undefined);
    if (have !== want) return false;
  }
  if (exp.name !== undefined && cmd.name !== exp.name) return false;
  if (exp.namespace !== undefined) {
    const ns = cmd.namespace ?? 'default';
    if (ns !== exp.namespace && cmd.flags['all-namespaces'] === undefined) return false;
  }
  for (const [flag, value] of Object.entries(exp.flags ?? {})) {
    let have = cmd.flags[flag];
    if (have === undefined && flag === 'all-namespaces' && cmd.flags['all-namespaces'] !== undefined) have = '';
    if (have === undefined) return false;
    if (value !== '' && norm(have) !== norm(value)) return false;
  }
  return true;
}

export type CommandFeedback =
  | { status: 'correct'; matched: KubectlExpectation }
  | { status: 'parse-error'; message: string }
  | { status: 'wrong'; message: string };

/** Evaluate a learner command against a step's accepted expectations. */
export function evaluateCommand(line: string, expected: KubectlExpectation[]): CommandFeedback {
  const parsed = parseKubectl(line);
  if (!parsed.ok) return { status: 'parse-error', message: parsed.error };
  const cmd = parsed.cmd;
  const hit = expected.find((e) => matchesExpectation(cmd, e));
  if (hit) return { status: 'correct', matched: hit };
  const sameVerb = expected.find((e) => e.verb === cmd.verb);
  if (!sameVerb) return { status: 'wrong', message: `"kubectl ${cmd.verb}" is valid, but this step needs a different verb.` };
  if (sameVerb.resource && cmd.resource !== (canonicalResource(sameVerb.resource) ?? sameVerb.resource))
    return { status: 'wrong', message: `Right verb — check which resource type you are targeting.` };
  if (sameVerb.name && cmd.name !== sameVerb.name) return { status: 'wrong', message: 'Right verb and resource — check the object name.' };
  if (sameVerb.namespace && (cmd.namespace ?? 'default') !== sameVerb.namespace) return { status: 'wrong', message: 'Close — this object lives in a different namespace.' };
  return { status: 'wrong', message: 'Close — a flag or option is missing or different.' };
}
