import type { Domain, DomainId, Objective, ObjectiveId, Stage } from './types';

/**
 * Verified 2026-11-12 against the CNCF KCNA curriculum
 * (https://github.com/cncf/curriculum/blob/main/KCNA_Curriculum.pdf) and the
 * Linux Foundation exam page. Exam format: online proctored, multiple choice, 90 minutes.
 * 60 questions / 75% pass mark are widely reported by the LF candidate resources;
 * re-check the Candidate Handbook before booking.
 */
export const CURRICULUM_VERIFIED_AT = '2026-11-12';

export const EXAM_FORMAT = {
  durationMinutes: 90,
  questionCount: 60,
  passPercent: 75,
  format: 'Online, proctored, multiple-choice',
  sources: [
    { title: 'KCNA exam page (Linux Foundation)', url: 'https://training.linuxfoundation.org/certification/kubernetes-cloud-native-associate/' },
    { title: 'KCNA curriculum (CNCF)', url: 'https://github.com/cncf/curriculum' },
  ],
} as const;

export const DOMAINS: Domain[] = [
  { id: 'fundamentals', name: 'Kubernetes Fundamentals', weight: 44, objectives: ['kf-core', 'kf-admin', 'kf-scheduling', 'kf-containerization'] },
  { id: 'orchestration', name: 'Container Orchestration', weight: 28, objectives: ['co-networking', 'co-security', 'co-troubleshooting', 'co-storage'] },
  { id: 'delivery', name: 'Cloud Native Application Delivery', weight: 16, objectives: ['cad-delivery', 'cad-debugging'] },
  { id: 'architecture', name: 'Cloud Native Architecture', weight: 12, objectives: ['cna-observability', 'cna-ecosystem', 'cna-community'] },
];

export const OBJECTIVES: Objective[] = [
  { id: 'kf-core', domain: 'fundamentals', name: 'Kubernetes Core Concepts', description: 'API objects, workloads, the control plane, desired state and reconciliation.' },
  { id: 'kf-admin', domain: 'fundamentals', name: 'Administration', description: 'kubectl, kubeconfig, namespaces, cluster lifecycle, API extensibility.' },
  { id: 'kf-scheduling', domain: 'fundamentals', name: 'Scheduling', description: 'How the scheduler places Pods: resources, selectors, affinity, taints and tolerations.' },
  { id: 'kf-containerization', domain: 'fundamentals', name: 'Containerization', description: 'Containers, images, OCI, registries and container runtimes.' },
  { id: 'co-networking', domain: 'orchestration', name: 'Networking', description: 'Pod networking, CNI, Services, DNS, Ingress/Gateway and NetworkPolicies.' },
  { id: 'co-security', domain: 'orchestration', name: 'Security', description: 'Authentication, authorization, RBAC, ServiceAccounts, Pod security and secrets.' },
  { id: 'co-troubleshooting', domain: 'orchestration', name: 'Troubleshooting', description: 'Diagnosing Pod, scheduling, networking and configuration failures.' },
  { id: 'co-storage', domain: 'orchestration', name: 'Storage', description: 'Volumes, PersistentVolumes, PVCs, StorageClasses and CSI.' },
  { id: 'cad-delivery', domain: 'delivery', name: 'Application Delivery', description: 'CI/CD, GitOps, Helm, Kustomize, rollouts and deployment strategies.' },
  { id: 'cad-debugging', domain: 'delivery', name: 'Debugging', description: 'Debugging applications running on Kubernetes.' },
  { id: 'cna-observability', domain: 'architecture', name: 'Observability', description: 'Metrics, logs, traces, Prometheus and OpenTelemetry.' },
  { id: 'cna-ecosystem', domain: 'architecture', name: 'Cloud Native Ecosystem and Principles', description: 'Cloud-native principles, microservices, autoscaling, serverless, service mesh and CNCF projects.' },
  { id: 'cna-community', domain: 'architecture', name: 'Cloud Native Community and Collaboration', description: 'CNCF structure, project maturity, SIGs, KEPs, open governance and roles.' },
];

export const STAGES: Stage[] = [
  { id: 0, title: 'Foundations', goal: 'Linux, networking, containers and YAML – the vocabulary Kubernetes assumes.' },
  { id: 1, title: 'Kubernetes Architecture', goal: 'Understand every control-plane and node component and how desired state is reconciled.' },
  { id: 2, title: 'Workloads', goal: 'Run applications with Pods, Deployments and the other workload controllers.' },
  { id: 3, title: 'Networking', goal: 'Follow a packet from client to Pod through Services, DNS and Ingress.' },
  { id: 4, title: 'Configuration & Storage', goal: 'Inject configuration and persist data safely.' },
  { id: 5, title: 'Security & Operations', goal: 'Control access, harden workloads and troubleshoot with kubectl.' },
  { id: 6, title: 'Application Delivery', goal: 'Ship changes with CI/CD, GitOps, Helm and safe rollouts.' },
  { id: 7, title: 'Cloud Native Architecture', goal: 'Observability, autoscaling, service mesh and the CNCF community.' },
  { id: 8, title: 'Exam Preparation', goal: 'Mock exams, weak-topic review and readiness evaluation.' },
];

export const domainById = (id: DomainId) => DOMAINS.find((d) => d.id === id)!;
export const objectiveById = (id: ObjectiveId) => OBJECTIVES.find((o) => o.id === id)!;
export const domainOfObjective = (id: ObjectiveId): DomainId => objectiveById(id).domain;
