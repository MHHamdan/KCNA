import type { EcosystemProject } from './types';

/** Maturity levels last checked on this date; recheck https://www.cncf.io/projects/ before relying on them. */
export const ECOSYSTEM_VERIFIED_AT = '2026-11-12';

export const ecosystemProjects: EcosystemProject[] = [
  // Orchestration & Scheduling
  { name: "Kubernetes", category: "Orchestration & Scheduling", maturity: "graduated", examRelevance: "core",
    purpose: "Container orchestration: schedules, scales and self-heals containerized workloads through a declarative API.", url: "https://kubernetes.io/" },
  { name: "Volcano", category: "Orchestration & Scheduling", maturity: "incubating", examRelevance: "optional",
    purpose: "Batch scheduler for Kubernetes aimed at AI/ML, big-data and HPC jobs (gang scheduling, queues).", url: "https://volcano.sh/" },

  // Runtime
  { name: "containerd", category: "Runtime", maturity: "graduated", examRelevance: "core",
    purpose: "Industry-standard container runtime implementing the CRI; the most common Kubernetes node runtime.", url: "https://containerd.io/" },
  { name: "CRI-O", category: "Runtime", maturity: "graduated", examRelevance: "core",
    purpose: "Lightweight container runtime built specifically for the Kubernetes CRI and OCI runtimes.", url: "https://cri-o.io/" },
  { name: "Docker", category: "Runtime", maturity: "non-cncf", examRelevance: "recognize",
    purpose: "Developer tooling for building and running containers; produces OCI images. Kubernetes removed dockershim in 1.24.", url: "https://www.docker.com/" },

  // Networking
  { name: "Cilium", category: "Networking", maturity: "graduated", examRelevance: "core",
    purpose: "eBPF-based CNI providing networking, NetworkPolicy, load balancing (kube-proxy replacement) and observability.", url: "https://cilium.io/" },
  { name: "Calico", category: "Networking", maturity: "non-cncf", examRelevance: "recognize",
    purpose: "Popular CNI plugin for Pod networking and NetworkPolicy enforcement, maintained by Tigera.", url: "https://www.tigera.io/project-calico/" },
  { name: "CoreDNS", category: "Networking", maturity: "graduated", examRelevance: "core",
    purpose: "Plugin-based DNS server; the default cluster DNS that resolves Service names.", url: "https://coredns.io/" },

  // Service Mesh & Proxy
  { name: "Envoy", category: "Service Mesh & Proxy", maturity: "graduated", examRelevance: "core",
    purpose: "High-performance L4/L7 proxy; data plane for Istio and many gateways.", url: "https://www.envoyproxy.io/" },
  { name: "Istio", category: "Service Mesh & Proxy", maturity: "graduated", examRelevance: "core",
    purpose: "Service mesh providing mTLS, traffic management and telemetry using Envoy, in sidecar or ambient (sidecarless) mode.", url: "https://istio.io/" },
  { name: "Linkerd", category: "Service Mesh & Proxy", maturity: "graduated", examRelevance: "core",
    purpose: "Lightweight service mesh with its own Rust micro-proxy; automatic mTLS and golden metrics.", url: "https://linkerd.io/" },

  // Storage
  { name: "Rook", category: "Storage", maturity: "graduated", examRelevance: "recognize",
    purpose: "Storage operator that runs Ceph on Kubernetes for block, file and object storage.", url: "https://rook.io/" },
  { name: "Longhorn", category: "Storage", maturity: "incubating", examRelevance: "recognize",
    purpose: "Distributed block storage for Kubernetes with replicated volumes, snapshots and backups via CSI.", url: "https://longhorn.io/" },

  // Observability
  { name: "Prometheus", category: "Observability", maturity: "graduated", examRelevance: "core",
    purpose: "Pull-based metrics collection, time-series database, PromQL and alerting rules.", url: "https://prometheus.io/" },
  { name: "Grafana", category: "Observability", maturity: "non-cncf", examRelevance: "recognize",
    purpose: "Dashboards and visualization for metrics, logs and traces; commonly paired with Prometheus.", url: "https://grafana.com/" },
  { name: "Fluentd", category: "Observability", maturity: "graduated", examRelevance: "core",
    purpose: "Unified logging layer that collects, transforms and routes logs (Fluent Bit is the lightweight agent).", url: "https://www.fluentd.org/" },
  { name: "Jaeger", category: "Observability", maturity: "graduated", examRelevance: "core",
    purpose: "Distributed tracing backend and UI for following requests across microservices.", url: "https://www.jaegertracing.io/" },
  { name: "OpenTelemetry", category: "Observability", maturity: "incubating", examRelevance: "recognize",
    purpose: "Vendor-neutral APIs, SDKs and Collector for traces, metrics and logs; instrumentation standard, not a backend.", url: "https://opentelemetry.io/" },

  // CI/CD & GitOps
  { name: "Argo", category: "CI/CD & GitOps", maturity: "graduated", examRelevance: "core",
    purpose: "Kubernetes-native delivery tools: Argo CD (GitOps), Argo Rollouts (canary/blue-green), Argo Workflows, Argo Events.", url: "https://argoproj.github.io/" },
  { name: "Flux", category: "CI/CD & GitOps", maturity: "graduated", examRelevance: "core",
    purpose: "GitOps toolkit that continuously reconciles clusters from Git, Helm and OCI sources.", url: "https://fluxcd.io/" },
  { name: "Jenkins", category: "CI/CD & GitOps", maturity: "non-cncf", examRelevance: "recognize",
    purpose: "Widely used automation server for CI/CD pipelines; hosted by the Continuous Delivery Foundation, not CNCF.", url: "https://www.jenkins.io/" },

  // Packaging
  { name: "Helm", category: "Packaging", maturity: "graduated", examRelevance: "core",
    purpose: "Package manager for Kubernetes: templated charts, versioned releases, upgrades and rollbacks.", url: "https://helm.sh/" },
  { name: "Harbor", category: "Packaging", maturity: "graduated", examRelevance: "recognize",
    purpose: "Container and OCI artifact registry with RBAC, vulnerability scanning and replication.", url: "https://goharbor.io/" },

  // Security & Policy
  { name: "Open Policy Agent (OPA)", category: "Security & Policy", maturity: "graduated", examRelevance: "recognize",
    purpose: "General-purpose policy engine (Rego); enforces Kubernetes admission policy via Gatekeeper.", url: "https://www.openpolicyagent.org/" },
  { name: "Kyverno", category: "Security & Policy", maturity: "graduated", examRelevance: "recognize",
    purpose: "Kubernetes-native policy engine with YAML policies that validate, mutate and generate resources.", url: "https://kyverno.io/" },
  { name: "Falco", category: "Security & Policy", maturity: "graduated", examRelevance: "recognize",
    purpose: "Runtime threat detection that alerts on suspicious syscalls and Kubernetes activity.", url: "https://falco.org/" },
  { name: "cert-manager", category: "Security & Policy", maturity: "graduated", examRelevance: "recognize",
    purpose: "Automates issuing and renewing X.509/TLS certificates in Kubernetes (e.g. from ACME/Let's Encrypt).", url: "https://cert-manager.io/" },
  { name: "SPIFFE", category: "Security & Policy", maturity: "graduated", examRelevance: "optional",
    purpose: "Standard for cryptographic workload identity (SPIFFE IDs and SVIDs); SPIRE is its reference implementation.", url: "https://spiffe.io/" },

  // Serverless & Scaling
  { name: "KEDA", category: "Serverless & Scaling", maturity: "graduated", examRelevance: "recognize",
    purpose: "Event-driven autoscaling from queues, streams and other sources, including scale to zero.", url: "https://keda.sh/" },
  { name: "Knative", category: "Serverless & Scaling", maturity: "graduated", examRelevance: "recognize",
    purpose: "Serverless platform on Kubernetes: request-driven autoscaling to zero (Serving) and event routing (Eventing).", url: "https://knative.dev/" },
  { name: "CloudEvents", category: "Serverless & Scaling", maturity: "graduated", examRelevance: "optional",
    purpose: "Specification for describing event data in a common format across services and platforms.", url: "https://cloudevents.io/" },
  { name: "Dapr", category: "Serverless & Scaling", maturity: "graduated", examRelevance: "optional",
    purpose: "Distributed application runtime offering building-block APIs (state, pub/sub, service invocation) via a sidecar.", url: "https://dapr.io/" },

  // Platform / Developer Experience
  { name: "Backstage", category: "Platform/Developer Experience", maturity: "incubating", examRelevance: "recognize",
    purpose: "Framework for internal developer portals: software catalog, templates and TechDocs.", url: "https://backstage.io/" },
  { name: "Crossplane", category: "Platform/Developer Experience", maturity: "graduated", examRelevance: "recognize",
    purpose: "Control plane framework that provisions and composes cloud infrastructure through Kubernetes CRDs.", url: "https://www.crossplane.io/" },

  // Database / KV
  { name: "etcd", category: "Database/KV", maturity: "graduated", examRelevance: "core",
    purpose: "Consistent distributed key-value store (Raft) that holds all Kubernetes cluster state.", url: "https://etcd.io/" },
  { name: "TiKV", category: "Database/KV", maturity: "graduated", examRelevance: "optional",
    purpose: "Distributed transactional key-value database built on Raft.", url: "https://tikv.org/" },
];
