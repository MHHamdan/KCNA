import { parseAllDocuments } from 'yaml';
import type { YamlCheck } from '@kcna/content';

export interface Finding {
  level: 'error' | 'warning' | 'info';
  message: string;
  path?: string;
}

export interface YamlReport {
  parsed: boolean;
  documents: Record<string, unknown>[];
  findings: Finding[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Read a dot/bracket path like spec.template.spec.containers[0].image. */
export function getPath(root: unknown, path: string): unknown {
  let cur: unknown = root;
  for (const part of path.split('.')) {
    const m = part.match(/^([^[\]]*)((?:\[\d+\])*)$/);
    if (!m) return undefined;
    if (m[1]) {
      if (!isObj(cur)) return undefined;
      cur = cur[m[1]];
    }
    for (const idx of m[2].match(/\d+/g) ?? []) {
      if (!Array.isArray(cur)) return undefined;
      cur = cur[Number(idx)];
    }
  }
  return cur;
}

const KNOWN_KINDS: Record<string, string[]> = {
  Pod: ['v1'],
  Service: ['v1'],
  ConfigMap: ['v1'],
  Secret: ['v1'],
  Namespace: ['v1'],
  ServiceAccount: ['v1'],
  PersistentVolume: ['v1'],
  PersistentVolumeClaim: ['v1'],
  Deployment: ['apps/v1'],
  ReplicaSet: ['apps/v1'],
  StatefulSet: ['apps/v1'],
  DaemonSet: ['apps/v1'],
  Job: ['batch/v1'],
  CronJob: ['batch/v1'],
  Ingress: ['networking.k8s.io/v1'],
  NetworkPolicy: ['networking.k8s.io/v1'],
  Role: ['rbac.authorization.k8s.io/v1'],
  RoleBinding: ['rbac.authorization.k8s.io/v1'],
  ClusterRole: ['rbac.authorization.k8s.io/v1'],
  ClusterRoleBinding: ['rbac.authorization.k8s.io/v1'],
  StorageClass: ['storage.k8s.io/v1'],
  HorizontalPodAutoscaler: ['autoscaling/v2'],
};

const WORKLOADS_WITH_TEMPLATE = new Set(['Deployment', 'ReplicaSet', 'StatefulSet', 'DaemonSet', 'Job']);

function podSpecOf(doc: Obj): { spec: Obj | undefined; base: string } {
  const kind = doc.kind as string;
  if (kind === 'Pod') return { spec: getPath(doc, 'spec') as Obj | undefined, base: 'spec' };
  if (kind === 'CronJob') return { spec: getPath(doc, 'spec.jobTemplate.spec.template.spec') as Obj | undefined, base: 'spec.jobTemplate.spec.template.spec' };
  if (WORKLOADS_WITH_TEMPLATE.has(kind)) return { spec: getPath(doc, 'spec.template.spec') as Obj | undefined, base: 'spec.template.spec' };
  return { spec: undefined, base: '' };
}

const QUANTITY = /^\d+(\.\d+)?(m|Ki|Mi|Gi|Ti|Pi|Ei|k|M|G|T|P|E)?$/;
const DNS1123 = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

/** Deterministic lints for common manifest mistakes. Not a full schema validator. */
export function lintManifest(doc: Obj): Finding[] {
  const f: Finding[] = [];
  const kind = doc.kind;
  if (typeof doc.apiVersion !== 'string') f.push({ level: 'error', message: 'Missing apiVersion.', path: 'apiVersion' });
  if (typeof kind !== 'string') {
    f.push({ level: 'error', message: 'Missing kind.', path: 'kind' });
    return f;
  }
  const known = KNOWN_KINDS[kind];
  if (known && typeof doc.apiVersion === 'string' && !known.includes(doc.apiVersion))
    f.push({ level: 'error', message: `${kind} uses apiVersion ${known.join(' or ')}, not "${doc.apiVersion}".`, path: 'apiVersion' });
  if (!known) f.push({ level: 'info', message: `Kind "${kind}" is not in the trainer's built-in list; only generic checks applied.` });
  const name = getPath(doc, 'metadata.name');
  if (typeof name !== 'string') f.push({ level: 'error', message: 'metadata.name is required.', path: 'metadata.name' });
  else if (!DNS1123.test(name)) f.push({ level: 'error', message: `metadata.name "${name}" must be lowercase alphanumerics, "-" or ".".`, path: 'metadata.name' });

  if (WORKLOADS_WITH_TEMPLATE.has(kind) && kind !== 'Job') {
    const sel = getPath(doc, 'spec.selector.matchLabels');
    const labels = getPath(doc, 'spec.template.metadata.labels');
    if (!isObj(sel)) f.push({ level: 'error', message: `${kind} needs spec.selector.matchLabels.`, path: 'spec.selector.matchLabels' });
    else if (!isObj(labels) || Object.entries(sel).some(([k, v]) => labels[k] !== v))
      f.push({ level: 'error', message: 'spec.selector.matchLabels must match spec.template.metadata.labels — otherwise the API server rejects the object.', path: 'spec.selector' });
  }
  const { spec, base } = podSpecOf(doc);
  if (base) {
    const containers = spec?.containers;
    if (!Array.isArray(containers) || !containers.length) f.push({ level: 'error', message: 'A Pod template needs at least one container.', path: `${base}.containers` });
    else
      containers.forEach((c, i) => {
        const p = `${base}.containers[${i}]`;
        if (!isObj(c)) return;
        if (typeof c.name !== 'string') f.push({ level: 'error', message: 'Every container needs a name.', path: `${p}.name` });
        if (typeof c.image !== 'string' || !c.image) f.push({ level: 'error', message: 'Every container needs an image.', path: `${p}.image` });
        else if (!c.image.includes(':') && !c.image.includes('@'))
          f.push({ level: 'warning', message: `Image "${c.image}" has no tag, so it resolves to :latest — pin a version for reproducible rollouts.`, path: `${p}.image` });
        else if (c.image.endsWith(':latest')) f.push({ level: 'warning', message: 'Avoid the :latest tag in manifests; pin a version.', path: `${p}.image` });
        const res = c.resources;
        if (!isObj(res)) f.push({ level: 'info', message: `Container "${String(c.name)}" sets no resource requests/limits (BestEffort QoS).`, path: `${p}.resources` });
        else
          for (const section of ['requests', 'limits'] as const) {
            const r = res[section];
            if (isObj(r))
              for (const [k, v] of Object.entries(r))
                if (!QUANTITY.test(String(v))) f.push({ level: 'error', message: `${section}.${k} "${String(v)}" is not a valid quantity (e.g. 250m, 128Mi).`, path: `${p}.resources.${section}.${k}` });
          }
        if (Array.isArray(c.ports))
          c.ports.forEach((port, j) => {
            if (isObj(port) && typeof port.containerPort !== 'number')
              f.push({ level: 'error', message: 'containerPort must be a number.', path: `${p}.ports[${j}].containerPort` });
          });
        for (const probe of ['livenessProbe', 'readinessProbe', 'startupProbe'])
          if (isObj(c[probe]) && !['httpGet', 'tcpSocket', 'exec', 'grpc'].some((h) => isObj((c[probe] as Obj)[h])))
            f.push({ level: 'error', message: `${probe} needs a handler: httpGet, tcpSocket, exec or grpc.`, path: `${p}.${probe}` });
      });
    if (spec && isObj(spec.securityContext) === false && kind === 'Pod')
      f.push({ level: 'info', message: 'Consider a securityContext (runAsNonRoot, readOnlyRootFilesystem) for least privilege.' });
  }
  if (kind === 'Service') {
    const ports = getPath(doc, 'spec.ports');
    if (!Array.isArray(ports) || !ports.length) f.push({ level: 'error', message: 'A Service needs spec.ports.', path: 'spec.ports' });
    if (!isObj(getPath(doc, 'spec.selector')) && getPath(doc, 'spec.type') !== 'ExternalName')
      f.push({ level: 'warning', message: 'Service has no selector, so Kubernetes will not create endpoints for it automatically.', path: 'spec.selector' });
    const type = getPath(doc, 'spec.type');
    if (type !== undefined && !['ClusterIP', 'NodePort', 'LoadBalancer', 'ExternalName'].includes(String(type)))
      f.push({ level: 'error', message: `Unknown Service type "${String(type)}".`, path: 'spec.type' });
  }
  if (kind === 'Secret' && isObj(doc.data))
    f.push({ level: 'info', message: 'Secret data is only base64-encoded. Enable encryption at rest and restrict access with RBAC.' });
  if (kind === 'PersistentVolumeClaim') {
    const modes = getPath(doc, 'spec.accessModes');
    if (!Array.isArray(modes) || !modes.length) f.push({ level: 'error', message: 'A PVC needs spec.accessModes.', path: 'spec.accessModes' });
    else
      for (const m of modes)
        if (!['ReadWriteOnce', 'ReadOnlyMany', 'ReadWriteMany', 'ReadWriteOncePod'].includes(String(m)))
          f.push({ level: 'error', message: `Unknown access mode "${String(m)}".`, path: 'spec.accessModes' });
    if (getPath(doc, 'spec.resources.requests.storage') === undefined)
      f.push({ level: 'error', message: 'A PVC needs spec.resources.requests.storage.', path: 'spec.resources.requests.storage' });
  }
  return f;
}

function runCheck(doc: Obj, check: YamlCheck): boolean {
  switch (check.op) {
    case 'equals':
      return String(getPath(doc, check.path)) === String(check.value);
    case 'exists':
      return getPath(doc, check.path) !== undefined && getPath(doc, check.path) !== null;
    case 'absent':
      return getPath(doc, check.path) === undefined;
    case 'matches': {
      const v = getPath(doc, check.path);
      return v !== undefined && new RegExp(check.value).test(String(v));
    }
    case 'oneOf':
      return check.value.map(String).includes(String(getPath(doc, check.path)));
    case 'gte':
      return Number(getPath(doc, check.path)) >= check.value;
    case 'selectorMatchesTemplate': {
      const sel = getPath(doc, 'spec.selector.matchLabels');
      const labels = getPath(doc, 'spec.template.metadata.labels');
      return isObj(sel) && isObj(labels) && Object.keys(sel).length > 0 && Object.entries(sel).every(([k, v]) => labels[k] === v);
    }
    case 'servicePortMatchesContainer': {
      const target = getPath(doc, 'spec.ports[0].targetPort') ?? getPath(doc, 'spec.ports[0].port');
      const anno = getPath(doc, 'metadata.annotations');
      const containerPort = isObj(anno) ? anno['kcna.lab/container-port'] : undefined;
      return target !== undefined && String(target) === String(containerPort);
    }
  }
}

export interface ChallengeResult {
  parsed: boolean;
  passed: boolean;
  results: { message: string; passed: boolean }[];
  findings: Finding[];
  parseError?: string;
}

/** Parse YAML text into documents with friendly errors. */
export function parseManifests(text: string): YamlReport & { error?: string } {
  const docs = parseAllDocuments(text);
  const documents: Obj[] = [];
  for (const d of Array.isArray(docs) ? docs : [docs]) {
    if (d.errors.length) {
      const e = d.errors[0];
      const line = e.linePos?.[0]?.line;
      return { parsed: false, documents: [], findings: [], error: `YAML syntax error${line ? ` on line ${line}` : ''}: ${e.message.split('\n')[0]}` };
    }
    const js = d.toJS();
    if (js === null || js === undefined) continue;
    if (!isObj(js)) return { parsed: false, documents: [], findings: [], error: 'Each YAML document must be a mapping (key: value), not a list or scalar.' };
    documents.push(js);
  }
  const findings = documents.flatMap((d) => lintManifest(d));
  return { parsed: true, documents, findings };
}

/** Validate a learner's answer for a YAML challenge (checks run on the first document). */
export function checkYamlChallenge(text: string, checks: YamlCheck[]): ChallengeResult {
  const r = parseManifests(text);
  if (!r.parsed || !r.documents.length)
    return { parsed: false, passed: false, results: [], findings: [], parseError: r.error ?? 'No YAML document found.' };
  const doc = r.documents[0];
  const results = checks.map((c) => ({ message: c.message, passed: runCheck(doc, c) }));
  const errors = r.findings.filter((x) => x.level === 'error');
  return { parsed: true, passed: results.every((x) => x.passed) && errors.length === 0, results, findings: r.findings };
}
