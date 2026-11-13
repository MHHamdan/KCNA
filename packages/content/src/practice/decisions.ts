import type { DecisionGame } from '../types';

export const decisionGames: DecisionGame[] = [
  {
    id: 'dg-log-agent-every-node',
    objective: 'kf-core',
    scenario:
      'You need a log-collection agent that reads container log files from **every node** in the cluster, including nodes added later by the autoscaler.',
    options: ['Deployment with replicas equal to the node count', 'DaemonSet', 'StatefulSet', 'CronJob that runs every minute'],
    answer: 1,
    explanation:
      'A **DaemonSet** runs one Pod per (matching) node and automatically adds a Pod when a node joins. A Deployment with N replicas neither guarantees one-per-node nor tracks node count. StatefulSets give stable identity, not per-node placement. A CronJob is for scheduled, finite work.',
  },
  {
    id: 'dg-database-stable-identity',
    objective: 'kf-core',
    scenario:
      'You are running a 3-member replicated database in the cluster. Each member needs a **stable network name** (member-0, member-1, member-2) and its **own persistent volume** that follows it if the Pod is rescheduled.',
    options: ['Deployment with a shared PVC', 'DaemonSet with hostPath volumes', 'StatefulSet with volumeClaimTemplates and a headless Service', 'Three bare Pods'],
    answer: 2,
    explanation:
      'A **StatefulSet** gives ordinal Pod names, ordered rollout, and one PVC per replica from `volumeClaimTemplates`; a **headless** Service gives each Pod a stable DNS record. A Deployment\'s Pods are interchangeable and would share one claim. hostPath ties data to a node. Bare Pods are not recreated if they disappear.',
  },
  {
    id: 'dg-nightly-report',
    objective: 'kf-core',
    scenario:
      'A report must be generated **every night at 02:00**. The process runs for about 10 minutes and should be retried if it fails.',
    options: ['Deployment with a sleep loop in the container', 'CronJob', 'Job', 'DaemonSet'],
    answer: 1,
    explanation:
      'A **CronJob** creates a **Job** on a cron schedule; the Job runs Pods to completion and retries failures up to `backoffLimit`. A plain Job runs once, not on a schedule. A Deployment expects long-running processes and would restart a finished container forever.',
  },
  {
    id: 'dg-internal-service-type',
    objective: 'co-networking',
    scenario:
      'The `inventory` API must be reachable **only from other Pods inside the cluster** under a stable name. Nothing outside the cluster should reach it.',
    options: ['ClusterIP Service', 'NodePort Service', 'LoadBalancer Service', 'ExternalName Service'],
    answer: 0,
    explanation:
      '**ClusterIP** (the default type) gives a virtual IP and DNS name reachable only inside the cluster. NodePort and LoadBalancer both expose the Service outside the cluster. ExternalName just returns a CNAME to an external hostname and has no Pod backends.',
  },
  {
    id: 'dg-ingress-vs-lb',
    objective: 'co-networking',
    scenario:
      'You run 12 HTTP microservices that must be exposed on the internet as `shop.example.com/cart`, `/catalog`, `/account`... with TLS. The cloud provider charges per load balancer.',
    options: [
      'One LoadBalancer Service per microservice',
      'A single Ingress controller (or Gateway API implementation) with HTTP path routing rules, behind one load balancer',
      'NodePort Services and publish node IPs in DNS',
      'Run kubectl port-forward on a bastion host',
    ],
    answer: 1,
    explanation:
      'L7 routing by host and path with TLS termination is exactly what **Ingress** — and its successor, the **Gateway API** — is for. One controller behind one load balancer serves all routes. A LoadBalancer per Service multiplies cost and gives no path routing. NodePorts expose node IPs and high ports; port-forward is a debugging tool.',
  },
  {
    id: 'dg-configmap-vs-secret',
    objective: 'co-security',
    scenario:
      'An app needs a feature-flag file (non-sensitive) and a third-party API token. You want to keep both out of the container image.',
    options: [
      'Put both in a ConfigMap',
      'Put both in a Secret',
      'Feature flags in a ConfigMap, API token in a Secret (with RBAC restricting Secret reads)',
      'Bake the token into the image and the flags into a ConfigMap',
    ],
    answer: 2,
    explanation:
      'Use **ConfigMaps** for non-sensitive config and **Secrets** for credentials so you can grant access to them separately. Remember Secrets are only base64-encoded by default — protect them with RBAC, encryption at rest, or an external secret manager. Baking credentials into images leaks them to anyone who can pull the image.',
  },
  {
    id: 'dg-dynamic-storage',
    objective: 'co-storage',
    scenario:
      'Teams create many databases per week. Each needs its own disk, and platform engineers do not want to create PersistentVolumes by hand.',
    options: [
      'Pre-create 100 PersistentVolumes manually',
      'Use emptyDir volumes',
      'Define a StorageClass backed by a CSI driver; teams create PVCs and volumes are provisioned dynamically',
      'Use hostPath on a dedicated node',
    ],
    answer: 2,
    explanation:
      'A **StorageClass** names a provisioner (typically a CSI driver); every PVC referencing it gets a new PV created on demand — **dynamic provisioning**. Static PVs do not scale. `emptyDir` is deleted with the Pod. hostPath ties data to one node and is a security risk.',
  },
  {
    id: 'dg-autoscale-traffic',
    objective: 'cna-ecosystem',
    scenario:
      'A stateless web API sees 10x traffic at lunchtime. You want the **number of Pods** to follow CPU usage automatically.',
    options: ['Vertical Pod Autoscaler', 'Horizontal Pod Autoscaler', 'Cluster Autoscaler', 'A PodDisruptionBudget'],
    answer: 1,
    explanation:
      'The **HPA** changes `replicas` based on metrics such as CPU utilization relative to requests (needs metrics-server or a custom metrics adapter). VPA changes per-Pod requests, not count. Cluster Autoscaler adds **nodes** when Pods cannot be scheduled — often used together with HPA. A PDB limits voluntary disruptions.',
  },
  {
    id: 'dg-network-isolation',
    objective: 'co-security',
    scenario:
      'Security requires that only the `payments-api` Pods can open connections to the `payments-db` Pods. All other in-cluster traffic to the database must be blocked.',
    options: [
      'A NetworkPolicy selecting payments-db that allows ingress only from Pods labelled as payments-api (with a CNI that enforces policies)',
      'Put the database in its own namespace — namespaces block traffic by default',
      'An RBAC Role that denies other Pods',
      'Change the database Service to ClusterIP',
    ],
    answer: 0,
    explanation:
      'By default all Pods can talk to all Pods. **NetworkPolicies** restrict L3/L4 traffic by Pod/namespace selectors, but only if the CNI plugin enforces them (e.g. Calico, Cilium). Namespaces are not a network boundary. RBAC controls access to the **Kubernetes API**, not Pod-to-Pod traffic. ClusterIP is already internal-only.',
  },
  {
    id: 'dg-rbac-scope',
    objective: 'co-security',
    scenario:
      'A CI pipeline\'s ServiceAccount must be able to update Deployments in the `team-a` namespace **only**.',
    options: [
      'ClusterRole + ClusterRoleBinding',
      'Role in team-a + RoleBinding in team-a',
      'Add the ServiceAccount to the system:masters group',
      'Give it the cluster-admin ClusterRole via a RoleBinding in kube-system',
    ],
    answer: 1,
    explanation:
      'A **Role** grants permissions within one namespace and a **RoleBinding** grants it to a subject in that namespace — least privilege. (A RoleBinding can also reference a ClusterRole to reuse its rules, still limited to that namespace.) A ClusterRoleBinding grants cluster-wide; `system:masters` bypasses authorization entirely.',
  },
  {
    id: 'dg-gitops-tool',
    objective: 'cad-delivery',
    scenario:
      'You want the cluster to **continuously pull** its desired state from a Git repository, detect drift, and show sync status in a web UI — instead of CI pushing with `kubectl apply`.',
    options: ['Argo CD', 'Helm alone', 'Prometheus', 'kubectl apply in a nightly cron'],
    answer: 0,
    explanation:
      '**Argo CD** (like Flux, both CNCF graduated) is a GitOps controller: it runs in the cluster, pulls from Git, reconciles continuously and reports drift; it also has a web UI. Helm is a package manager/templating tool, not a reconciler. Prometheus is monitoring. A nightly apply is push-based and blind to drift in between.',
  },
  {
    id: 'dg-observability-signal',
    objective: 'cna-observability',
    scenario:
      'Users report checkout is slow, but only sometimes. A request passes through 6 microservices and you need to find **which hop** adds the latency.',
    options: ['Metrics: average CPU per service', 'Logs: grep each service separately', 'Distributed traces (e.g. instrumented with OpenTelemetry)', 'kubectl get events'],
    answer: 2,
    explanation:
      'A **trace** follows one request across services as a tree of spans with timings, showing exactly which hop is slow. Metrics show aggregate trends (useful to detect the problem, e.g. p99 latency), logs show per-service detail but are hard to correlate without a trace ID. Events describe cluster object changes, not request latency.',
  },
];
