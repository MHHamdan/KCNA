// Deterministic check of model output against well-known Kubernetes misconceptions.
// Small CPU-hosted models sometimes repeat these even when told not to, so the
// server appends a verified correction (with a lesson link) when one is detected.
// Rules are deliberately narrow; a sentence containing a negation is skipped so
// "do not delete the Deployment to roll back" is not flagged.

export interface FactNote {
  id: string;
  correction: string;
  lessonId: string;
}

interface Rule extends FactNote {
  pattern: RegExp;
  /** skip when the matched sentence also matches this (a legitimately different case) */
  unless?: RegExp;
}

const RULES: Rule[] = [
  {
    id: 'container-restart-data',
    pattern: /\bno data loss\b|data[^.]{0,50}\b(preserved|safe|kept|survives?)\b[^.]{0,60}\b(restart|crash|recreat|replac)|\b(restart|crash|recreat|replac)\w*[^.]{0,60}\bdata[^.]{0,40}\b(preserved|safe|kept)\b/i,
    correction:
      'When a container restarts, anything written to its own filesystem (writable layer) is lost. Only data in volumes (emptyDir survives container restarts; PersistentVolumes survive Pod replacement) is kept.',
    lessonId: 'volumes',
    unless: /\b(volume|pvc|persistentvolume|statefulset)/i,
  },
  {
    id: 'crash-means-new-pod',
    pattern: /\bcrash\w*[^.]{0,100}\b(creates? a (brand )?new pod|replaced entirely|is replaced by a new pod|not restarted)/i,
    correction:
      'A crashing container is restarted in place by the kubelet, inside the same Pod (same name and IP; the RESTARTS count increases; repeated crashes show CrashLoopBackOff). A controller creates a new Pod only when the Pod object is deleted or evicted, or its node is lost.',
    lessonId: 'pods',
  },
  {
    id: 'rollback-by-delete',
    pattern: /\bdelet\w* (the |a |your )?deployment[^.]{0,80}\broll ?back|\broll ?back[^.]{0,80}\bdelet\w* (the |a |your )?deployment/i,
    correction: 'Roll back a Deployment with `kubectl rollout undo deployment/<name>` (optionally `--to-revision=N`). Deleting a Deployment deletes its ReplicaSets and Pods.',
    lessonId: 'rollouts-and-deployment-strategies',
  },
  {
    id: 'secrets-encrypted',
    pattern: /\bsecrets? (are|is) (automatically |always )?encrypted( at rest)? by default/i,
    correction: 'Secret values are only base64-encoded by default. Encryption at rest must be configured for etcd, and access should be restricted with RBAC.',
    lessonId: 'configmaps-and-secrets',
  },
  {
    id: 'scheduler-starts-containers',
    pattern: /\bscheduler (starts|runs|launches|creates|pulls)\b[^.]{0,30}\b(containers?|images?)/i,
    correction: 'The kube-scheduler only chooses a node and binds the Pod to it. The kubelet on that node starts the containers through the container runtime.',
    lessonId: 'control-plane-controllers',
  },
  {
    id: 'kubectl-run-deployment',
    pattern: /\bkubectl run\b[^.]{0,60}\bcreates? (a |an )?deployment/i,
    correction: '`kubectl run` creates a single Pod. Use `kubectl create deployment` (or a manifest) to create a Deployment.',
    lessonId: 'kubectl-and-cluster-administration',
  },
  {
    id: 'docker-required',
    pattern: /\b(kubernetes|kubelet) (requires|needs|uses) docker( engine)? (as|for) (its |the )?(container )?runtime/i,
    correction: 'Kubernetes uses CRI-compatible runtimes such as containerd or CRI-O. Docker Engine support via dockershim was removed in Kubernetes 1.24. Images built with Docker still work, because they are OCI images.',
    lessonId: 'node-components',
  },
  {
    id: 'psp-current',
    pattern: /\b(use|enable|configure|create) (a )?PodSecurityPolic(y|ies)\b/i,
    correction: 'PodSecurityPolicy was removed in Kubernetes 1.25. Use Pod Security Admission (Pod Security Standards: privileged, baseline, restricted) or a policy engine such as Kyverno or OPA Gatekeeper.',
    lessonId: 'pod-security-and-least-privilege',
  },
];

const NEGATION = /\b(not|n't|never|avoid|instead of|rather than|misconception|myth|wrong|incorrect)\b/i;

function sentenceAround(text: string, index: number): string {
  const start = Math.max(text.lastIndexOf('.', index), text.lastIndexOf('\n', index)) + 1;
  const endDot = text.indexOf('.', index);
  const endNl = text.indexOf('\n', index);
  const end = [endDot, endNl].filter((x) => x >= 0).reduce((a, b) => Math.min(a, b), text.length);
  return text.slice(start, end);
}

export function factCheck(text: string): FactNote[] {
  const notes: FactNote[] = [];
  for (const r of RULES) {
    const m = r.pattern.exec(text);
    if (!m) continue;
    const sentence = sentenceAround(text, m.index);
    if (NEGATION.test(sentence) || r.unless?.test(sentence)) continue;
    notes.push({ id: r.id, correction: r.correction, lessonId: r.lessonId });
  }
  return notes;
}
