import type { Question, Reference } from '../types';

const R = {
  service: { title: 'Kubernetes docs: Service', url: 'https://kubernetes.io/docs/concepts/services-networking/service/' },
  endpointSlices: { title: 'Kubernetes docs: EndpointSlices', url: 'https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/' },
  sourceIp: { title: 'Kubernetes tutorial: Using Source IP', url: 'https://kubernetes.io/docs/tutorials/services/source-ip/' },
  externalLb: { title: 'Kubernetes docs: Create an External Load Balancer', url: 'https://kubernetes.io/docs/tasks/access-application-cluster/create-external-load-balancer/' },
  dns: { title: 'Kubernetes docs: DNS for Services and Pods', url: 'https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/' },
  statefulSet: { title: 'Kubernetes docs: StatefulSets', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/' },
  netpol: { title: 'Kubernetes docs: Network Policies', url: 'https://kubernetes.io/docs/concepts/services-networking/network-policies/' },
  clusterNetworking: { title: 'Kubernetes docs: Cluster Networking', url: 'https://kubernetes.io/docs/concepts/cluster-administration/networking/' },
  components: { title: 'Kubernetes docs: Kubernetes Components', url: 'https://kubernetes.io/docs/concepts/overview/components/' },
  gateway: { title: 'Gateway API', url: 'https://gateway-api.sigs.k8s.io/' },
  rbac: { title: 'Kubernetes docs: Using RBAC Authorization', url: 'https://kubernetes.io/docs/reference/access-authn-authz/rbac/' },
  rbacGood: { title: 'Kubernetes docs: Role Based Access Control Good Practices', url: 'https://kubernetes.io/docs/concepts/security/rbac-good-practices/' },
  serviceAccounts: { title: 'Kubernetes docs: Service Accounts', url: 'https://kubernetes.io/docs/concepts/security/service-accounts/' },
  configureSa: { title: 'Kubernetes docs: Configure Service Accounts for Pods', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/' },
  securityContext: { title: 'Kubernetes docs: Configure a Security Context for a Pod or Container', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/security-context/' },
  pss: { title: 'Kubernetes docs: Pod Security Standards', url: 'https://kubernetes.io/docs/concepts/security/pod-security-standards/' },
  psa: { title: 'Kubernetes docs: Pod Security Admission', url: 'https://kubernetes.io/docs/concepts/security/pod-security-admission/' },
  admission: { title: 'Kubernetes docs: Admission Control in Kubernetes', url: 'https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/' },
  audit: { title: 'Kubernetes docs: Auditing', url: 'https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/' },
  verifySigned: { title: 'Kubernetes docs: Verify Signed Kubernetes Artifacts', url: 'https://kubernetes.io/docs/tasks/administer-cluster/verify-signed-artifacts/' },
  security: { title: 'Kubernetes docs: Security', url: 'https://kubernetes.io/docs/concepts/security/' },
  debugPods: { title: 'Kubernetes docs: Debug Pods', url: 'https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/' },
  debugService: { title: 'Kubernetes docs: Debug Services', url: 'https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/' },
  privateRegistry: { title: 'Kubernetes docs: Pull an Image from a Private Registry', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/' },
  images: { title: 'Kubernetes docs: Images', url: 'https://kubernetes.io/docs/concepts/containers/images/' },
  secret: { title: 'Kubernetes docs: Secrets', url: 'https://kubernetes.io/docs/concepts/configuration/secret/' },
  taints: { title: 'Kubernetes docs: Taints and Tolerations', url: 'https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/' },
  probes: { title: 'Kubernetes docs: Configure Liveness, Readiness and Startup Probes', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/' },
  nodes: { title: 'Kubernetes docs: Nodes', url: 'https://kubernetes.io/docs/concepts/architecture/nodes/' },
  kubectl: { title: 'Kubernetes docs: kubectl reference', url: 'https://kubernetes.io/docs/reference/kubectl/' },
  podLifecycle: { title: 'Kubernetes docs: Pod Lifecycle', url: 'https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/' },
  nodePressure: { title: 'Kubernetes docs: Node-pressure Eviction', url: 'https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/' },
  volumes: { title: 'Kubernetes docs: Volumes', url: 'https://kubernetes.io/docs/concepts/storage/volumes/' },
  pv: { title: 'Kubernetes docs: Persistent Volumes', url: 'https://kubernetes.io/docs/concepts/storage/persistent-volumes/' },
  storageClasses: { title: 'Kubernetes docs: Storage Classes', url: 'https://kubernetes.io/docs/concepts/storage/storage-classes/' },
  snapshots: { title: 'Kubernetes docs: Volume Snapshots', url: 'https://kubernetes.io/docs/concepts/storage/volume-snapshots/' },
  resources: { title: 'Kubernetes docs: Resource Management for Pods and Containers', url: 'https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/' },
} satisfies Record<string, Reference>;

export const questionsOrchestration2: Question[] = [
  // ───────────────────────── co-networking ─────────────────────────
  {
    id: 'q-co-networking-101',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'dns-and-coredns',
    difficulty: 2,
    type: 'single',
    prompt: `A StatefulSet is defined like this (cluster domain \`cluster.local\`):

\`\`\`yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: db
  namespace: data
spec:
  serviceName: db-hl     # headless Service (clusterIP: None)
  replicas: 3
  ...
\`\`\`

A client must always connect to the **first** replica, not to a random one. Which DNS name should it use?`,
    choices: [
      '`db-0.db-hl.data.svc.cluster.local`',
      '`db-hl.data.svc.cluster.local`',
      '`db.data.svc.cluster.local`',
      '`0.db.data.pod.cluster.local`',
    ],
    answer: [0],
    explanation:
      'A StatefulSet whose `serviceName` points at a headless Service gives each Pod a stable DNS record of the form `<pod-name>.<service-name>.<namespace>.svc.<cluster-domain>`. Pods are named `<statefulset>-<ordinal>`, so the first replica is `db-0`. The bare Service name returns the IPs of all ready replicas, so it cannot pin one.',
    choiceRationale: [
      'Correct: pod name `db-0`, then the headless Service, namespace, `svc` and the cluster domain.',
      'The headless Service name resolves to all ready replicas, not specifically to `db-0`.',
      'DNS records come from the Service named in `serviceName` (`db-hl`), not from the StatefulSet name.',
      'This is not a valid record format; per-Pod StatefulSet names live under the Service in the `svc` zone.',
    ],
    references: [R.statefulSet, R.dns],
    tags: ['dns', 'statefulset', 'headless'],
  },
  {
    id: 'q-co-networking-102',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'services',
    difficulty: 3,
    type: 'single',
    prompt: `An audit service behind a \`type: LoadBalancer\` Service logs node IPs instead of real client IPs. A teammate changes the Service:

\`\`\`yaml
spec:
  type: LoadBalancer
  externalTrafficPolicy: Local
\`\`\`

Which statement describes the result?`,
    choices: [
      'Client IPs are preserved, and traffic is still spread evenly across all nodes regardless of where Pods run',
      'Nothing changes, because `externalTrafficPolicy` only applies to ClusterIP Services',
      'Client source IPs are preserved, but only nodes running a ready backend Pod receive and serve the traffic',
      'Traffic is encrypted end to end between the load balancer and the Pod',
    ],
    answer: [2],
    explanation:
      'With the default `Cluster` policy, a node may forward external traffic to a Pod on another node, and the source IP is rewritten (SNAT) on that extra hop. `Local` keeps traffic on the node that received it, so the client IP survives, but nodes without a local endpoint do not serve the Service; the cloud load balancer health check takes them out of rotation. The trade-off is potentially uneven load across Pods.',
    choiceRationale: [
      'Local can make load uneven, because each node only sends to its own local Pods.',
      'The field applies to NodePort and LoadBalancer Services, which receive external traffic.',
      'Correct: no extra hop means no SNAT, but only nodes with a local ready endpoint handle traffic.',
      'The policy controls routing, not encryption.',
    ],
    references: [R.sourceIp, R.externalLb],
    tags: ['services', 'externaltrafficpolicy', 'source-ip'],
  },
  {
    id: 'q-co-networking-103',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'services',
    difficulty: 2,
    type: 'single',
    prompt: `You want in-cluster apps to reach a legacy database at \`192.168.50.10:5432\` (outside the cluster) through a normal Service name. You create:

\`\`\`yaml
apiVersion: v1
kind: Service
metadata:
  name: legacy-db
spec:
  ports:
  - port: 5432
\`\`\`

The Service has no \`selector\`. What else is needed for traffic to reach the database?`,
    choices: [
      'Nothing; Kubernetes discovers the external database automatically by port number',
      'An EndpointSlice labeled `kubernetes.io/service-name: legacy-db` that lists `192.168.50.10` and port 5432',
      'A NetworkPolicy allowing egress to `192.168.50.10`',
      'Changing the Service type to NodePort',
    ],
    answer: [1],
    explanation:
      'When a Service has no selector, the control plane does not create EndpointSlices for it, because there are no Pods to match. You supply the backends yourself with an EndpointSlice whose `kubernetes.io/service-name` label names the Service. kube-proxy then load-balances the ClusterIP to those addresses like any other Service.',
    choiceRationale: [
      'Without a selector, Kubernetes has nothing to discover; endpoints must be added manually.',
      'Correct: a manually managed EndpointSlice links the selector-less Service to the external address.',
      'NetworkPolicy restricts traffic; it does not tell the Service where its backends are.',
      'NodePort changes how the Service is exposed, not where it sends traffic.',
    ],
    references: [R.service, R.endpointSlices],
    tags: ['services', 'endpointslices', 'selectorless'],
  },
  {
    id: 'q-co-networking-104',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'network-policies',
    difficulty: 3,
    type: 'single',
    prompt: `A NetworkPolicy on the \`api\` Pods contains this ingress rule:

\`\`\`yaml
ingress:
- from:
  - namespaceSelector:
      matchLabels:
        team: web
    podSelector:
      matchLabels:
        role: frontend
\`\`\`

Which sources are allowed?`,
    choices: [
      'Any Pod in a namespace labeled `team: web`, plus any Pod labeled `role: frontend` in any namespace',
      'Only Pods labeled `role: frontend` in the policy\'s own namespace',
      'Every Pod in the cluster, because two selectors cancel each other out',
      'Only Pods labeled `role: frontend` that run in namespaces labeled `team: web`',
    ],
    answer: [3],
    explanation:
      'Here `namespaceSelector` and `podSelector` sit in the **same** list element (there is only one `-`), so they are combined with AND: the Pod must carry `role: frontend` and live in a namespace labeled `team: web`. If each selector had its own `-` entry, they would be two separate peers combined with OR. That single dash is a classic source of accidental over-permissive policies.',
    choiceRationale: [
      'That OR behavior would require two separate list entries, each starting with `-`.',
      'A `podSelector` alone would mean the policy\'s namespace, but here it is paired with a namespaceSelector.',
      'Selectors never cancel out; NetworkPolicy rules only ever add allowed traffic.',
      'Correct: both selectors in one peer entry must match (AND).',
    ],
    references: [R.netpol],
    tags: ['network-policies', 'selectors', 'yaml'],
  },
  {
    id: 'q-co-networking-105',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'network-policies',
    difficulty: 2,
    type: 'single',
    prompt: `After applying an egress default-deny policy in namespace \`shop\`, plus a rule allowing egress to the \`orders\` Pods on TCP 8080, the app logs:

\`\`\`text
dial tcp: lookup orders.shop.svc.cluster.local: i/o timeout
\`\`\`

What is missing?`,
    choices: [
      'An egress rule allowing UDP and TCP port 53 to the cluster DNS (CoreDNS) Pods in `kube-system`',
      'An ingress rule on the `shop` Pods allowing traffic from `orders`',
      'A restart of CoreDNS so it picks up the new policy',
      'A headless Service for `orders`',
    ],
    answer: [0],
    explanation:
      'Once egress is isolated, everything not explicitly allowed is blocked, including DNS lookups to CoreDNS. The error is a name-resolution timeout, not a connection refusal to `orders`. Add an egress rule to the DNS Pods (typically selected via the `kube-system` namespace and the `k8s-app: kube-dns` label) on port 53 UDP and TCP.',
    choiceRationale: [
      'Correct: the lookup itself times out, so DNS egress must be allowed.',
      'The failure is outbound name resolution, not inbound traffic to `shop`.',
      'CoreDNS is not the problem; the policy blocks packets before they reach it.',
      'A headless Service changes DNS answers but does not unblock the DNS query.',
    ],
    references: [R.netpol, R.dns],
    tags: ['network-policies', 'egress', 'dns'],
  },
  {
    id: 'q-co-networking-106',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'pod-networking-and-cni',
    difficulty: 3,
    type: 'multi',
    prompt: 'A cluster runs Cilium with its kube-proxy replacement enabled, so no kube-proxy DaemonSet is deployed. Which statements are accurate? (Select TWO.)',
    choices: [
      'ClusterIP Services stop working, because only kube-proxy can implement Service virtual IPs',
      'The CNI plugin itself now load-balances Service traffic to backend Pods (Cilium does this with eBPF)',
      'CoreDNS is no longer needed, because the CNI plugin answers Service name lookups',
      'Services and EndpointSlices are still the API objects that describe the load balancing; only the node-level implementation changed',
    ],
    answer: [1, 3],
    explanation:
      'A Service is an API abstraction; kube-proxy is just the default node-level implementation that turns Services and EndpointSlices into iptables, IPVS or nftables rules. Some CNI plugins, such as Cilium, can take over that job and program Service load balancing themselves (Cilium uses eBPF), watching the same Service and EndpointSlice objects. Nothing changes for workloads or manifests. Name resolution is a separate concern that cluster DNS (CoreDNS) still handles.',
    choiceRationale: [
      'kube-proxy is the default implementation, not the only one; a CNI can implement Service VIPs instead.',
      'Correct: with kube-proxy replacement, the network plugin handles Service load balancing.',
      'DNS is still served by CoreDNS; kube-proxy never answered DNS queries in the first place.',
      'Correct: the Service API is unchanged; only the data plane implementing it differs.',
    ],
    references: [R.clusterNetworking, R.service],
    tags: ['cni', 'kube-proxy', 'network-model'],
  },
  {
    id: 'q-co-networking-107',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'ingress-and-gateway-api',
    difficulty: 1,
    type: 'single',
    prompt:
      'In the Gateway API, which cluster-scoped resource is usually provided by the infrastructure provider and names the controller that implements Gateways (similar to IngressClass for Ingress)?',
    choices: ['HTTPRoute', 'ReferenceGrant', 'GatewayClass', 'Gateway'],
    answer: [2],
    explanation:
      'Gateway API splits responsibilities by role. The infrastructure provider supplies a **GatewayClass** that identifies the controller; cluster operators create **Gateways** (listeners) from that class; application developers attach **HTTPRoutes** and other routes to those Gateways. This role split is one of the main improvements over Ingress.',
    choiceRationale: [
      'HTTPRoute holds application routing rules and is owned by app developers.',
      'ReferenceGrant permits cross-namespace references; it does not name a controller.',
      'Correct: GatewayClass is the cluster-scoped template naming the implementing controller.',
      'A Gateway is an instance of a GatewayClass that defines listeners.',
    ],
    references: [R.gateway],
    tags: ['gateway-api', 'gatewayclass', 'roles'],
  },
  {
    id: 'q-co-networking-108',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'dns-and-coredns',
    difficulty: 2,
    type: 'single',
    prompt: `Inside a Pod in namespace \`shop\`:

\`\`\`text
$ cat /etc/resolv.conf
search shop.svc.cluster.local svc.cluster.local cluster.local
nameserver 10.96.0.10
options ndots:5
\`\`\`

Which statement is accurate?`,
    choices: [
      '`10.96.0.10` is the IP of the node the Pod runs on',
      '`10.96.0.10` is the ClusterIP of the cluster DNS Service, which fronts the CoreDNS Pods',
      'The search list means the Pod can only resolve names in namespace `shop`',
      'The kubelet resolves names itself and ignores this file',
    ],
    answer: [1],
    explanation:
      'With the default `dnsPolicy: ClusterFirst`, the kubelet writes a resolv.conf pointing at the cluster DNS Service (commonly named `kube-dns` for compatibility) and a search list starting with the Pod\'s own namespace. That is why `orders` resolves within `shop`, and `orders.billing` resolves via the `svc.cluster.local` suffix. A fully qualified name with a trailing dot skips the search list.',
    choiceRationale: [
      'The nameserver is a Service virtual IP, not the node address.',
      'Correct: the Pod queries CoreDNS through the DNS Service ClusterIP.',
      'Other namespaces are reachable by adding the namespace, e.g. `orders.billing`.',
      'The kubelet writes this file; the application\'s resolver uses it.',
    ],
    references: [R.dns],
    tags: ['dns', 'coredns', 'resolv-conf'],
  },
  {
    id: 'q-co-networking-109',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'network-policies',
    difficulty: 1,
    type: 'single',
    prompt:
      'A team applies a valid default-deny NetworkPolicy. `kubectl get networkpolicy` lists it, yet all traffic still flows. What is the most likely explanation?',
    choices: [
      'The cluster\'s network plugin does not implement NetworkPolicy',
      'NetworkPolicies take 24 hours to propagate',
      'NetworkPolicies only apply to Pods created by StatefulSets',
      'kube-proxy must be restarted to load new policies',
    ],
    answer: [0],
    explanation:
      'The API server stores NetworkPolicy objects, but enforcement is done by the network plugin. If the CNI does not support policies (for example, a basic overlay without a policy engine), the objects exist and have no effect. Calico and Cilium are common choices that do enforce them.',
    choiceRationale: [
      'Correct: without a policy-capable CNI, NetworkPolicy objects are accepted but not enforced.',
      'Enforcement is near-immediate on plugins that support it.',
      'Policies select Pods by labels, regardless of which controller created them.',
      'kube-proxy does not enforce NetworkPolicy.',
    ],
    references: [R.netpol, R.clusterNetworking],
    tags: ['network-policies', 'cni', 'enforcement'],
  },
  {
    id: 'q-co-networking-110',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'services',
    difficulty: 1,
    type: 'single',
    prompt:
      'Apps should reach a managed database through the in-cluster name `db`, which must resolve to the external hostname `prod-db.example.net`. No proxying or ClusterIP is needed. Which Service type fits?',
    choices: ['NodePort', 'LoadBalancer', 'Headless ClusterIP', 'ExternalName'],
    answer: [3],
    explanation:
      'An ExternalName Service returns a DNS CNAME record pointing at the configured external name. It has no selector, no ClusterIP, and kube-proxy does not handle it. It is a simple alias, so features like port remapping do not apply.',
    choiceRationale: [
      'NodePort exposes in-cluster Pods on node ports; it does not alias external names.',
      'LoadBalancer provisions an external load balancer for in-cluster Pods.',
      'Headless Services return Pod IPs of selected Pods, not an external hostname.',
      'Correct: ExternalName maps the Service name to an external DNS name via CNAME.',
    ],
    references: [R.service],
    tags: ['services', 'externalname', 'dns'],
  },

  // ───────────────────────── co-security ─────────────────────────
  {
    id: 'q-co-security-101',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'authentication-authorization-rbac',
    difficulty: 2,
    type: 'single',
    prompt: `A Role meant to let CI update Deployments in \`staging\`:

\`\`\`yaml
rules:
- apiGroups: [""]
  resources: ["deployments"]
  verbs: ["get", "list", "update", "patch"]
\`\`\`

It is bound correctly, but \`kubectl auth can-i update deployments -n staging --as=...\` returns \`no\`. Why?`,
    choices: [
      'Roles cannot grant `update`; only ClusterRoles can',
      'The `patch` verb conflicts with `update` and disables both',
      'The verbs must be written in upper case',
      'Deployments belong to the `apps` API group, so `apiGroups` must be `["apps"]`',
    ],
    answer: [3],
    explanation:
      'An RBAC rule matches a request only when the API group, resource and verb all match. The empty string `""` is the core group (Pods, Services, ConfigMaps, Secrets). Deployments are served from `apps/v1`, so this rule never matches them. `kubectl api-resources` shows each resource\'s group.',
    choiceRationale: [
      'Roles and ClusterRoles support the same verbs; the difference is scope.',
      'Verbs are additive and never conflict.',
      'Verbs are lower-case strings.',
      'Correct: `""` is the core group; Deployments live in `apps`.',
    ],
    references: [R.rbac],
    tags: ['rbac', 'apigroups', 'verbs'],
  },
  {
    id: 'q-co-security-102',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'authentication-authorization-rbac',
    difficulty: 2,
    type: 'single',
    prompt: `A platform team defines one ClusterRole \`app-operator\` and binds it like this:

\`\`\`yaml
kind: RoleBinding
metadata:
  name: alice-app-operator
  namespace: team-a
roleRef:
  kind: ClusterRole
  name: app-operator
  apiGroup: rbac.authorization.k8s.io
subjects:
- kind: User
  name: alice
  apiGroup: rbac.authorization.k8s.io
\`\`\`

What can \`alice\` do?`,
    choices: [
      'Everything in `app-operator`, across all namespaces',
      'Everything in `app-operator`, but only inside namespace `team-a`',
      'Nothing, because a RoleBinding cannot reference a ClusterRole',
      'Only cluster-scoped actions such as listing nodes',
    ],
    answer: [1],
    explanation:
      'A RoleBinding may reference a ClusterRole; the permissions are then granted only within the RoleBinding\'s namespace. This lets a team define a role once and reuse it per namespace. Cluster-wide access would need a ClusterRoleBinding, and cluster-scoped resources such as nodes cannot be granted through a RoleBinding at all.',
    choiceRationale: [
      'Cluster-wide grants require a ClusterRoleBinding.',
      'Correct: the RoleBinding scopes the ClusterRole\'s rules to `team-a`.',
      'Referencing a ClusterRole from a RoleBinding is a standard, supported pattern.',
      'Cluster-scoped resources cannot be granted via a namespaced RoleBinding.',
    ],
    references: [R.rbac, R.rbacGood],
    tags: ['rbac', 'clusterrole', 'rolebinding'],
  },
  {
    id: 'q-co-security-103',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'authentication-authorization-rbac',
    difficulty: 3,
    type: 'single',
    prompt: `A support engineer has a Role with \`get\` and \`list\` on \`pods\` in \`prod\`:

\`\`\`text
$ kubectl logs api-7f9c-2mzq8 -n prod
Error from server (Forbidden): pods "api-7f9c-2mzq8" is forbidden: User "sam" cannot get resource "pods/log" in API group "" in the namespace "prod"
\`\`\`

Which rule should be added?`,
    choices: [
      '`verbs: ["watch"]` on resource `pods`',
      '`verbs: ["logs"]` on resource `pods`',
      '`verbs: ["get"]` on resource `pods/log`',
      '`verbs: ["exec"]` on resource `pods`',
    ],
    answer: [2],
    explanation:
      'Logs are a **subresource** of Pods, and RBAC treats subresources separately: `pods/log` must be listed explicitly. Reading logs is a `get` on that subresource. The error message names the exact resource and verb, which is the quickest way to write the missing rule.',
    choiceRationale: [
      'Watch on pods streams Pod object changes, not container logs.',
      'There is no `logs` verb in RBAC.',
      'Correct: reading logs is `get` on the `pods/log` subresource.',
      'There is no `exec` verb; exec access is granted on the separate `pods/exec` subresource, and it is not needed for logs.',
    ],
    references: [R.rbac],
    tags: ['rbac', 'subresources', 'logs'],
  },
  {
    id: 'q-co-security-104',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'authentication-authorization-rbac',
    difficulty: 1,
    type: 'single',
    prompt:
      'A static web server Pod never calls the Kubernetes API. Which setting reduces its attack surface by keeping an API credential out of the container?',
    choices: [
      '`automountServiceAccountToken: false` on the Pod or its ServiceAccount',
      '`hostNetwork: false`',
      '`imagePullPolicy: Always`',
      '`restartPolicy: Never`',
    ],
    answer: [0],
    explanation:
      'By default a ServiceAccount token is mounted into each Pod. If an attacker compromises a container that does not need API access, that token is a free credential. Setting `automountServiceAccountToken: false` (Pod-level wins over the ServiceAccount setting) removes it.',
    choiceRationale: [
      'Correct: no token is mounted, so a compromise yields no API credential.',
      'This is already the default and is unrelated to API tokens.',
      'Pull policy affects image freshness, not credentials.',
      'Restart behavior has nothing to do with API credentials.',
    ],
    references: [R.configureSa, R.serviceAccounts],
    tags: ['serviceaccounts', 'tokens', 'least-privilege'],
  },
  {
    id: 'q-co-security-105',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'authentication-authorization-rbac',
    difficulty: 3,
    type: 'multi',
    prompt:
      'In current Kubernetes, which statements about the ServiceAccount token that the kubelet mounts into a Pod are accurate? (Select TWO.)',
    choices: [
      'It is a long-lived token stored in an automatically created Secret',
      'It is time-limited and bound to an audience, and the kubelet rotates it before expiry',
      'It is delivered through a projected volume and becomes invalid once the Pod is deleted',
      'It is the same token for every Pod in the cluster',
    ],
    answer: [1, 2],
    explanation:
      'Since the TokenRequest API became the default, Pods get **bound** tokens: short-lived, audience-scoped, tied to the Pod object, and refreshed by the kubelet through a projected volume. Since 1.24, Kubernetes no longer auto-creates long-lived token Secrets for ServiceAccounts. Leaked bound tokens therefore stop working on expiry or when the Pod goes away.',
    choiceRationale: [
      'Auto-generated Secret-based tokens are legacy and no longer created by default.',
      'Correct: bound tokens expire, carry an audience and are rotated by the kubelet.',
      'Correct: the token is projected into the Pod and is bound to that Pod\'s lifetime.',
      'Tokens identify a specific ServiceAccount and are bound to a specific Pod.',
    ],
    references: [R.serviceAccounts, R.configureSa],
    tags: ['serviceaccounts', 'bound-tokens', 'projected-volume'],
  },
  {
    id: 'q-co-security-106',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'pod-security-and-least-privilege',
    difficulty: 2,
    type: 'single',
    prompt: `You harden a Pod:

\`\`\`yaml
securityContext:
  runAsNonRoot: true
\`\`\`

The image does not set a \`USER\`, so it defaults to root. Afterwards:

\`\`\`text
$ kubectl get pod web
NAME   READY   STATUS                       RESTARTS   AGE
web    0/1     CreateContainerConfigError   0          40s
\`\`\`

What is the right fix?`,
    choices: [
      'Remove `runAsNonRoot` because it is incompatible with most images',
      'Add `privileged: true` so the container can start',
      'Set `runAsUser` to a non-zero UID (or rebuild the image with a non-root `USER`)',
      'Change the Pod\'s `restartPolicy` to `OnFailure`',
    ],
    answer: [2],
    explanation:
      '`runAsNonRoot: true` makes the kubelet refuse to start a container that would run as UID 0, which surfaces as `CreateContainerConfigError` with a message about the image running as root. The fix keeps the safeguard and supplies a non-root identity, either in the Pod spec or in the image. Removing the check undoes the hardening.',
    choiceRationale: [
      'Removing the check reintroduces root execution instead of fixing the identity.',
      'Privileged mode greatly expands privilege and does not satisfy runAsNonRoot.',
      'Correct: give the container a non-root UID so the check passes.',
      'Restart policy has no effect on a security check that blocks container creation.',
    ],
    references: [R.securityContext],
    tags: ['securitycontext', 'runasnonroot', 'least-privilege'],
  },
  {
    id: 'q-co-security-107',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'pod-security-and-least-privilege',
    difficulty: 2,
    type: 'single',
    prompt: `A namespace is labeled:

\`\`\`yaml
metadata:
  labels:
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/warn: restricted
\`\`\`

A developer creates a Pod that meets Baseline but does not drop all capabilities (which Restricted requires). What happens?`,
    choices: [
      'The Pod is rejected by the `enforce` mode',
      'The Pod is created, and the client receives a warning about the Restricted violation',
      'The Pod is created silently, and the violation is only visible in node logs',
      'The Pod is created but its containers are started without any capabilities',
    ],
    answer: [1],
    explanation:
      'Pod Security Admission evaluates each mode independently. `enforce: baseline` admits the Pod because it satisfies Baseline. `warn: restricted` returns a user-facing warning listing what would fail under Restricted. This combination is a common way to prepare teams for a stricter level before enforcing it.',
    choiceRationale: [
      'Enforce is set to Baseline, which this Pod satisfies.',
      'Correct: admitted under Baseline, warned about Restricted.',
      'Warn mode shows the warning to the client (e.g. kubectl), not only in logs.',
      'Admission does not modify the Pod; it only admits, warns, or rejects.',
    ],
    references: [R.psa, R.pss],
    tags: ['pod-security-admission', 'namespace-labels', 'pss'],
  },
  {
    id: 'q-co-security-108',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'pod-security-and-least-privilege',
    difficulty: 1,
    type: 'single',
    prompt: 'At which point in an API request does admission control (mutating and validating admission) run?',
    choices: [
      'Before authentication, to filter anonymous traffic',
      'After the object is stored in etcd, to clean up invalid data',
      'Only on the node, when the kubelet starts a container',
      'After authentication and authorization, and before the object is persisted to etcd',
    ],
    answer: [3],
    explanation:
      'The API server processes a write as authentication, then authorization, then mutating admission, schema validation, validating admission, and finally persistence in etcd. Admission can modify or reject a request that the caller is otherwise allowed to make. Pod Security Admission and policy engines such as Kyverno or OPA Gatekeeper act at this stage.',
    choiceRationale: [
      'The caller must be identified first; admission runs later.',
      'Admission prevents invalid objects from being stored; it runs before persistence.',
      'Admission is an API server stage, not a kubelet step.',
      'Correct: authn, then authz, then admission, then etcd.',
    ],
    references: [R.admission],
    tags: ['admission', 'api-server', 'request-flow'],
  },
  {
    id: 'q-co-security-109',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'pod-security-and-least-privilege',
    difficulty: 1,
    type: 'single',
    prompt:
      'A team already scans images for known CVEs. What additional assurance does verifying an image signature (for example, with Sigstore cosign) provide?',
    choices: [
      'It proves the image was produced by a trusted publisher and has not been altered since signing',
      'It proves the image contains no vulnerabilities',
      'It compresses the image so it pulls faster',
      'It encrypts the image layers in the registry',
    ],
    answer: [0],
    explanation:
      'Scanning and signing answer different questions. A scanner reports known vulnerabilities in an image\'s packages. A signature check confirms **who** built the image and that its content (by digest) is unchanged. Admission policies can require both before a Pod is allowed to run.',
    choiceRationale: [
      'Correct: signatures establish provenance and integrity.',
      'A signed image can still contain vulnerabilities; that is what scanning detects.',
      'Signing does not change image size or transfer speed.',
      'A signature is attached metadata, not encryption of the content.',
    ],
    references: [R.verifySigned, R.security],
    tags: ['supply-chain', 'image-signing', 'scanning'],
  },
  {
    id: 'q-co-security-110',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'authentication-authorization-rbac',
    difficulty: 2,
    type: 'single',
    prompt:
      'After an incident, security needs to know which identity deleted a ConfigMap in `prod` and when. Which Kubernetes feature records this, if enabled?',
    choices: [
      'Container logs of the affected Pods',
      'Kubernetes Events, which are kept indefinitely',
      'API server audit logging, configured by an audit policy',
      'The kubelet journal on each worker node',
    ],
    answer: [2],
    explanation:
      'Audit logging is done by kube-apiserver. It records requests with the user, verb, resource, namespace and timestamp, at a detail level chosen by the audit policy (`None`, `Metadata`, `Request`, `RequestResponse`). Events are short-lived (about an hour by default) and do not reliably record who made API changes.',
    choiceRationale: [
      'Application logs know nothing about API calls made against the cluster.',
      'Events expire quickly and are not an access record.',
      'Correct: the API server audit log records who did what and when.',
      'ConfigMap deletion is an API server operation, not a kubelet action.',
    ],
    references: [R.audit],
    tags: ['audit', 'api-server', 'forensics'],
  },

  // ───────────────────────── co-troubleshooting ─────────────────────────
  {
    id: 'q-co-troubleshooting-101',
    domain: 'orchestration',
    objective: 'co-troubleshooting',
    lessonId: 'troubleshooting-workloads',
    difficulty: 2,
    type: 'single',
    prompt: `A new Deployment pulls from a private registry:

\`\`\`text
$ kubectl describe pod billing-58c7d9-wq4tn | tail -4
  Normal   Pulling  50s  kubelet  Pulling image "registry.corp.example/billing:1.8.0"
  Warning  Failed   49s  kubelet  Failed to pull image "registry.corp.example/billing:1.8.0": ... pull access denied, repository does not exist or may require authorization: authorization failed
  Warning  Failed   49s  kubelet  Error: ErrImagePull
  Normal   BackOff  20s  kubelet  Back-off pulling image "registry.corp.example/billing:1.8.0"
\`\`\`

The tag exists in the registry. What is the most likely fix?`,
    choices: [
      'Set `imagePullPolicy: Never` so the kubelet stops retrying',
      'Create a docker-registry Secret with the registry credentials and reference it in `imagePullSecrets`',
      'Increase the Pod\'s memory limit',
      'Switch the image reference to the `latest` tag',
    ],
    answer: [1],
    explanation:
      '`ErrImagePull` is the failed attempt and `ImagePullBackOff` is the kubelet waiting before retrying. The message says "authorization failed" and the tag exists, so the node has no credentials for this registry. Reference a registry credential Secret through `imagePullSecrets` on the Pod or its ServiceAccount.',
    choiceRationale: [
      '`Never` only uses a locally present image; it would fail because the image is not on the node.',
      'Correct: the pull is denied for lack of credentials.',
      'Memory has nothing to do with pulling images.',
      'A different tag still needs the same registry credentials.',
    ],
    references: [R.privateRegistry, R.images],
    tags: ['imagepullbackoff', 'errimagepull', 'imagepullsecrets'],
  },
  {
    id: 'q-co-troubleshooting-102',
    domain: 'orchestration',
    objective: 'co-troubleshooting',
    lessonId: 'troubleshooting-workloads',
    difficulty: 1,
    type: 'single',
    prompt: `\`\`\`text
$ kubectl get pod orders-6d4b9-zt7k2
NAME                 READY   STATUS                       RESTARTS   AGE
orders-6d4b9-zt7k2   0/1     CreateContainerConfigError   0          2m

$ kubectl describe pod orders-6d4b9-zt7k2 | tail -1
  Warning  Failed  10s (x12 over 2m)  kubelet  Error: secret "orders-db" not found
\`\`\`

What should you check first?`,
    choices: [
      'Whether Secret `orders-db` exists in the same namespace as the Pod, with the expected name',
      'Whether the image tag is spelled correctly',
      'Whether the node has enough CPU',
      'Whether the readiness probe path is correct',
    ],
    answer: [0],
    explanation:
      '`CreateContainerConfigError` means the kubelet could not assemble the container\'s configuration, typically because a referenced ConfigMap, Secret or key is missing. Secrets are namespaced, so a Secret created in another namespace does not count. The container never started, so there are no logs to read.',
    choiceRationale: [
      'Correct: the event names the missing Secret; it must exist in the Pod\'s namespace.',
      'Image problems show as ErrImagePull or ImagePullBackOff.',
      'CPU shortages cause scheduling failures (Pending), not this status.',
      'Probes only run after the container has started.',
    ],
    references: [R.debugPods, R.secret],
    tags: ['createcontainerconfigerror', 'secrets', 'troubleshooting'],
  },
  {
    id: 'q-co-troubleshooting-103',
    domain: 'orchestration',
    objective: 'co-troubleshooting',
    lessonId: 'scheduling-placement',
    difficulty: 1,
    type: 'single',
    prompt: `A GPU inference Pod stays Pending:

\`\`\`text
Events:
  Warning  FailedScheduling  30s  default-scheduler  0/4 nodes are available: 1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }, 3 node(s) had untolerated taint {dedicated: gpu}.
\`\`\`

The three tainted workers are the GPU nodes intended for this Pod. What is the right fix?`,
    choices: [
      'Delete and recreate the Pod until the scheduler picks a node',
      'Remove the taint from the control-plane node',
      'Raise the Pod\'s priority so it preempts other Pods',
      'Add a toleration for `dedicated=gpu` (with the matching effect) to the Pod spec',
    ],
    answer: [3],
    explanation:
      'Taints repel Pods that do not tolerate them. The GPU nodes are deliberately tainted so only GPU workloads land there, so the intended Pod needs a matching toleration. To also force it onto those nodes, combine the toleration with a nodeSelector or node affinity, because a toleration only permits placement.',
    choiceRationale: [
      'The scheduler is deterministic about taints; recreating the Pod changes nothing.',
      'Opening the control plane to workloads is not the intent and is poor practice.',
      'Preemption evicts lower-priority Pods; it does not bypass taints.',
      'Correct: a matching toleration lets the Pod be scheduled on the GPU nodes.',
    ],
    references: [R.taints],
    tags: ['pending', 'taints', 'tolerations'],
  },
  {
    id: 'q-co-troubleshooting-104',
    domain: 'orchestration',
    objective: 'co-troubleshooting',
    lessonId: 'health-probes',
    difficulty: 2,
    type: 'single',
    prompt: `After a release, the \`catalog\` Service returns errors from every client:

\`\`\`text
$ kubectl get pods -l app=catalog
NAME                       READY   STATUS    RESTARTS   AGE
catalog-74f9b6d8c-4kd2p    0/1     Running   0          6m
catalog-74f9b6d8c-r8m5w    0/1     Running   0          6m

$ kubectl describe pod catalog-74f9b6d8c-4kd2p | tail -1
  Warning  Unhealthy  5s (x70 over 6m)  kubelet  Readiness probe failed: HTTP probe failed with statuscode: 404
\`\`\`

Which statement best explains the situation?`,
    choices: [
      'The containers are crash-looping, so the kubelet keeps restarting them',
      'The Service selector no longer matches the Pods',
      'The readiness probe path returns 404, so no Pod is Ready and the Service has no ready endpoints',
      'The node is out of memory and the Pods are being evicted',
    ],
    answer: [2],
    explanation:
      'The Pods are Running with 0 restarts but 0/1 Ready, and the events show readiness probe failures with HTTP 404. Not-ready Pods are excluded from Service load balancing, so the Service has no backends. The new release probably moved or renamed the health endpoint; fix the probe `path` or the app route.',
    choiceRationale: [
      'Restart count is 0, and readiness failures never trigger restarts.',
      'The Pods carry `app=catalog`; the evidence points to readiness, not labels.',
      'Correct: failing readiness removes every Pod from the Service\'s ready endpoints.',
      'Evicted Pods would not show as Running.',
    ],
    references: [R.probes, R.debugService],
    tags: ['readiness', 'endpoints', 'services'],
  },
  {
    id: 'q-co-troubleshooting-105',
    domain: 'orchestration',
    objective: 'co-troubleshooting',
    lessonId: 'troubleshooting-workloads',
    difficulty: 2,
    type: 'single',
    prompt: `\`\`\`text
$ kubectl get nodes
NAME       STATUS     ROLES           AGE   VERSION
cp-1       Ready      control-plane   40d   v1.31.2
worker-2   NotReady   <none>          40d   v1.31.2

$ kubectl describe node worker-2 | grep -A1 Ready
  Ready   Unknown   ...   NodeStatusUnknown   Kubelet stopped posting node status.
\`\`\`

What does this most likely indicate, and what happens to its Pods by default?`,
    choices: [
      'The kubelet on worker-2 is down or the node is unreachable; after a grace period (about 5 minutes by default) its Pods are evicted and controllers such as ReplicaSets recreate them elsewhere',
      'The CNI plugin was never installed; Pods on worker-2 are deleted immediately',
      'worker-2 is being upgraded by the scheduler; its Pods are paused until it returns',
      'etcd has lost the node object; the Pods are already running on cp-1',
    ],
    answer: [0],
    explanation:
      'A Ready condition of `Unknown` with "Kubelet stopped posting node status" means the control plane has stopped hearing from the kubelet, because of a crashed kubelet, a powered-off machine or a network partition. The node controller adds the `node.kubernetes.io/unreachable` taint, and Pods tolerate it for 300 seconds by default before being evicted. Next, check the kubelet service and connectivity on the node itself.',
    choiceRationale: [
      'Correct: missing heartbeats mark the node Unknown, and Pods are evicted after the default toleration period.',
      'A missing CNI shows a NetworkPluginNotReady message, and Pods are not deleted immediately.',
      'The scheduler does not upgrade nodes.',
      'The node object still exists; Pods do not move until eviction and rescheduling.',
    ],
    references: [R.nodes, R.taints],
    tags: ['node-notready', 'kubelet', 'eviction'],
  },
  {
    id: 'q-co-troubleshooting-106',
    domain: 'orchestration',
    objective: 'co-troubleshooting',
    lessonId: 'troubleshooting-workloads',
    difficulty: 2,
    type: 'single',
    prompt:
      'Output from `kubectl get events -n shop` is hard to follow because the events do not appear in time order. Which command lists them sorted by creation time?',
    choices: [
      '`kubectl get events -n shop --watch`',
      '`kubectl describe events -n shop`',
      '`kubectl logs events -n shop`',
      '`kubectl get events -n shop --sort-by=.metadata.creationTimestamp`',
    ],
    answer: [3],
    explanation:
      '`kubectl get events` does not guarantee chronological order. `--sort-by` takes a JSONPath expression, and sorting by `.metadata.creationTimestamp` gives a timeline that is much easier to reason about. Events are also short-lived (about an hour by default), so collect them early in an investigation.',
    choiceRationale: [
      '`--watch` streams new events but does not order existing ones.',
      'describe prints event objects without producing a sorted timeline.',
      '`kubectl logs` reads container output; events are API objects.',
      'Correct: `--sort-by` with a JSONPath field sorts the list.',
    ],
    references: [R.kubectl, R.debugPods],
    tags: ['events', 'kubectl', 'sort-by'],
  },
  {
    id: 'q-co-troubleshooting-107',
    domain: 'orchestration',
    objective: 'co-troubleshooting',
    lessonId: 'troubleshooting-workloads',
    difficulty: 2,
    type: 'multi',
    prompt:
      'For which of these Pod statuses has the application container **never** run, so `kubectl logs` has nothing useful and `kubectl describe` events are the main evidence? (Select TWO.)',
    choices: [
      '`ImagePullBackOff`',
      '`CrashLoopBackOff`',
      '`CreateContainerConfigError`',
      '`OOMKilled` (as the last termination reason)',
    ],
    answer: [0, 2],
    explanation:
      'ImagePullBackOff means the image never arrived, and CreateContainerConfigError means the container could not be configured (for example, a missing Secret), so neither container started. CrashLoopBackOff and OOMKilled both mean the container ran and then exited, so `kubectl logs --previous` often shows the cause.',
    choiceRationale: [
      'Correct: no image, so no container and no logs.',
      'The container started and exited; previous logs usually help.',
      'Correct: the container is never created, so there are no logs.',
      'The process ran until the kernel killed it; it may have produced logs.',
    ],
    references: [R.debugPods, R.podLifecycle],
    tags: ['troubleshooting', 'statuses', 'logs'],
  },
  {
    id: 'q-co-troubleshooting-108',
    domain: 'orchestration',
    objective: 'co-troubleshooting',
    lessonId: 'resources-requests-limits',
    difficulty: 3,
    type: 'single',
    prompt: `Several Pods on one node failed at once:

\`\`\`text
$ kubectl get pods -o wide | grep worker-3
report-5b7d-9xk2l   0/1   Evicted   0   12m   <none>   worker-3
cache-8c2f-pq7m4    0/1   Evicted   0   12m   <none>   worker-3

$ kubectl describe pod report-5b7d-9xk2l | grep -A1 Message
Message:  The node was low on resource: memory. ...

$ kubectl describe node worker-3 | grep MemoryPressure
  MemoryPressure   True   ...   KubeletHasInsufficientMemory   kubelet has insufficient memory available
\`\`\`

The evicted Pods had no resource requests. What happened, and what is the best preventive change?`,
    choices: [
      'The scheduler preempted them for higher-priority Pods; add a PriorityClass to every Pod',
      'The kernel OOM-killed one container; raise its memory limit',
      'The API server deleted them for exceeding a ResourceQuota; delete the quota',
      'The kubelet performed node-pressure eviction, picking Pods using more than they requested first; set realistic memory requests (and limits) so the scheduler does not overcommit the node',
    ],
    answer: [3],
    explanation:
      'When node memory falls below an eviction threshold, the kubelet sets MemoryPressure and evicts Pods to protect the node. Pods using more than their requests, such as BestEffort Pods with no requests, are ranked first. The Pods show `Evicted`, not `OOMKilled`, which distinguishes kubelet eviction from a kernel OOM kill. Setting requests lets the scheduler place Pods where memory actually exists.',
    choiceRationale: [
      'Preemption is a scheduling action, and its message would mention preemption, not node memory pressure.',
      'A kernel OOM kill shows `OOMKilled` with exit code 137 and restarts the container; these Pods were evicted.',
      'ResourceQuota is checked at admission and rejects new objects; it never evicts running Pods.',
      'Correct: MemoryPressure plus Evicted status points to kubelet node-pressure eviction.',
    ],
    references: [R.nodePressure, R.resources],
    tags: ['eviction', 'memorypressure', 'qos'],
  },

  // ───────────────────────── co-storage ─────────────────────────
  {
    id: 'q-co-storage-101',
    domain: 'orchestration',
    objective: 'co-storage',
    lessonId: 'persistent-volumes-and-csi',
    difficulty: 2,
    type: 'single',
    prompt: `You create a PVC but no Pod uses it yet:

\`\`\`text
$ kubectl get pvc reports
NAME      STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   AGE
reports   Pending                                      zonal-ssd      3m

$ kubectl describe pvc reports | tail -1
  Normal  WaitForFirstConsumer  10s (x14 over 3m)  persistentvolume-controller  waiting for first consumer to be created before binding
\`\`\`

What is going on?`,
    choices: [
      'The CSI driver has crashed and must be reinstalled',
      'The StorageClass uses `volumeBindingMode: WaitForFirstConsumer`, so provisioning waits until a Pod using the claim is scheduled',
      'The requested capacity is larger than any available disk',
      'PVCs always stay Pending until an administrator approves them',
    ],
    answer: [1],
    explanation:
      'With `WaitForFirstConsumer`, binding and provisioning are delayed until a Pod that uses the PVC is scheduled. The volume can then be created in the same zone or topology as the chosen node, which avoids a disk in zone A attached to a Pod in zone B. The `Normal` event shows this is expected behavior, not a fault.',
    choiceRationale: [
      'A crashed driver would produce warning events such as ProvisioningFailed, not this Normal event.',
      'Correct: the claim waits for a consumer Pod by design.',
      'Capacity problems show up as provisioning errors, not WaitForFirstConsumer.',
      'Kubernetes has no manual approval step for PVCs.',
    ],
    references: [R.storageClasses, R.pv],
    tags: ['pvc', 'volumebindingmode', 'topology'],
  },
  {
    id: 'q-co-storage-102',
    domain: 'orchestration',
    objective: 'co-storage',
    lessonId: 'persistent-volumes-and-csi',
    difficulty: 2,
    type: 'single',
    prompt:
      'A database PVC of 20Gi is nearly full. Its StorageClass has `allowVolumeExpansion: true`, and the CSI driver supports resizing. How do you grow it to 50Gi?',
    choices: [
      'Edit the PVC and raise `spec.resources.requests.storage` to `50Gi`',
      'Delete the PVC and create a new 50Gi one with the same name; the data carries over',
      'Edit the StorageClass and set its default size to 50Gi',
      'Scale the database StatefulSet to 0 and back to 1',
    ],
    answer: [0],
    explanation:
      'Volume expansion is requested by increasing the size on the existing PVC. The CSI driver resizes the backing volume, and the filesystem is grown, often online, depending on the driver. Shrinking a PVC is not supported, and deleting the claim may delete the data under the `Delete` reclaim policy.',
    choiceRationale: [
      'Correct: raising the request on the PVC triggers expansion.',
      'Deleting the claim can destroy the volume; a new claim gets a fresh, empty volume.',
      'StorageClasses have no default-size field, and editing one does not affect existing claims.',
      'Restarting the workload does not change the claim\'s size.',
    ],
    references: [R.pv, R.storageClasses],
    tags: ['pvc', 'expansion', 'allowvolumeexpansion'],
  },
  {
    id: 'q-co-storage-103',
    domain: 'orchestration',
    objective: 'co-storage',
    lessonId: 'persistent-volumes-and-csi',
    difficulty: 2,
    type: 'single',
    prompt: `A Deployment with 2 replicas mounts one PVC:

\`\`\`yaml
kind: PersistentVolumeClaim
spec:
  accessModes: ["ReadWriteOncePod"]
  resources:
    requests:
      storage: 5Gi
\`\`\`

The first Pod runs; the second stays Pending even on the same node. Why?`,
    choices: [
      'ReadWriteOncePod volumes can only be used by DaemonSets',
      'The second Pod needs its own StorageClass',
      'ReadWriteOncePod allows only a single Pod in the whole cluster to use the volume',
      'Two Pods on one node always require ReadWriteMany',
    ],
    answer: [2],
    explanation:
      '`ReadWriteOncePod` (CSI volumes only) guarantees that just one Pod uses the volume at a time. `ReadWriteOnce` is per node, so two Pods on the same node could share it. For several replicas that each need storage, use a StatefulSet with `volumeClaimTemplates`; for real shared access, use ReadWriteMany on a backend that supports it.',
    choiceRationale: [
      'The access mode is not tied to any workload type.',
      'Both Pods reference the same PVC; a StorageClass is irrelevant to sharing.',
      'Correct: RWOP limits use to exactly one Pod.',
      'Two Pods on one node can share a ReadWriteOnce volume.',
    ],
    references: [R.pv],
    tags: ['access-modes', 'readwriteoncepod', 'pvc'],
  },
  {
    id: 'q-co-storage-104',
    domain: 'orchestration',
    objective: 'co-storage',
    lessonId: 'persistent-volumes-and-csi',
    difficulty: 2,
    type: 'multi',
    prompt: `A StatefulSet named \`kafka\` has 3 replicas and this template:

\`\`\`yaml
volumeClaimTemplates:
- metadata:
    name: data
  spec:
    accessModes: ["ReadWriteOnce"]
    resources:
      requests:
        storage: 100Gi
\`\`\`

Which statements are accurate with default settings? (Select TWO.)`,
    choices: [
      'Each replica gets its own PVC, named `data-kafka-0`, `data-kafka-1` and `data-kafka-2`',
      'All three replicas share one 100Gi PVC named `data`',
      'Scaling the StatefulSet down to 1 keeps the PVCs of the removed replicas, so their data returns if you scale back up',
      'Deleting a Pod such as `kafka-1` also deletes its PVC',
    ],
    answer: [0, 2],
    explanation:
      'volumeClaimTemplates stamp out one PVC per ordinal, named `<template>-<statefulset>-<ordinal>`, and each Pod reattaches to its own claim when recreated. By default (`persistentVolumeClaimRetentionPolicy` set to Retain), PVCs are kept when the StatefulSet is scaled down or deleted, which protects data. Cleanup is a deliberate manual step.',
    choiceRationale: [
      'Correct: one claim per replica, named after the template, StatefulSet and ordinal.',
      'The template exists precisely so replicas do not share one claim.',
      'Correct: the default retention policy keeps the claims on scale-down.',
      'A recreated `kafka-1` reattaches to `data-kafka-1`; the claim is not deleted.',
    ],
    references: [R.statefulSet, R.pv],
    tags: ['statefulset', 'volumeclaimtemplates', 'pvc'],
  },
  {
    id: 'q-co-storage-105',
    domain: 'orchestration',
    objective: 'co-storage',
    lessonId: 'persistent-volumes-and-csi',
    difficulty: 3,
    type: 'single',
    prompt:
      'Before a risky schema migration, you want a point-in-time copy of a CSI-backed PVC, and the ability to start a new PVC from it. Which approach matches the Kubernetes snapshot API?',
    choices: [
      'Set the PV reclaim policy to Retain; that creates a snapshot automatically',
      'Use `kubectl cp` to copy the volume into a ConfigMap',
      'Create a VolumeSnapshot of the PVC (using a VolumeSnapshotClass), then create a new PVC whose `dataSource` references that snapshot',
      'Annotate the PVC with `snapshot: true`, and the kubelet copies it to etcd',
    ],
    answer: [2],
    explanation:
      'Volume snapshots use the VolumeSnapshot, VolumeSnapshotContent and VolumeSnapshotClass APIs. They need a CSI driver that supports snapshots, plus the snapshot controller (often installed separately by the distribution). To restore, create a PVC with `dataSource` pointing at the VolumeSnapshot, and the driver provisions a volume pre-filled with that data.',
    choiceRationale: [
      'Retain only keeps the PV after its claim is deleted; it does not make snapshots.',
      'ConfigMaps are limited to about 1 MiB and are not a backup mechanism.',
      'Correct: snapshot via VolumeSnapshot, restore via PVC `dataSource`.',
      'No such annotation exists, and volume data is never stored in etcd.',
    ],
    references: [R.snapshots],
    tags: ['csi', 'volumesnapshot', 'backup'],
  },
  {
    id: 'q-co-storage-106',
    domain: 'orchestration',
    objective: 'co-storage',
    lessonId: 'volumes',
    difficulty: 3,
    type: 'single',
    prompt: `A container with a \`512Mi\` memory limit uses this scratch volume and writes about 400Mi of temporary files to it:

\`\`\`yaml
volumes:
- name: scratch
  emptyDir:
    medium: Memory
\`\`\`

Shortly after, the container is OOMKilled even though the process heap is small. Why?`,
    choices: [
      'emptyDir volumes are always capped at 100Mi',
      'An in-memory emptyDir is a tmpfs, and the files written to it count toward the container\'s memory usage',
      'The volume is stored in etcd, which ran out of space',
      'The kubelet copies emptyDir contents to every container, doubling memory usage',
    ],
    answer: [1],
    explanation:
      '`medium: Memory` backs the emptyDir with tmpfs (RAM). It is fast, but files written there are charged as memory, so 400Mi of files plus the process can exceed a 512Mi limit. Use a disk-backed emptyDir for large scratch data, set a `sizeLimit`, or raise the memory limit accordingly. tmpfs contents are also lost on node reboot.',
    choiceRationale: [
      'There is no fixed 100Mi default cap; `sizeLimit` is optional.',
      'Correct: tmpfs-backed files consume memory and count toward the limit.',
      'Volume data never lives in etcd.',
      'The volume is mounted (shared), not copied per container.',
    ],
    references: [R.volumes, R.resources],
    tags: ['emptydir', 'tmpfs', 'oomkilled'],
  },
  {
    id: 'q-co-storage-107',
    domain: 'orchestration',
    objective: 'co-storage',
    lessonId: 'persistent-volumes-and-csi',
    difficulty: 1,
    type: 'single',
    prompt:
      'A PVC does not set `storageClassName` at all, yet it gets dynamically provisioned storage. Where did the class come from?',
    choices: [
      'The scheduler chose the fastest class available',
      'The kubelet created a hostPath volume instead',
      'The PVC copied the class of the most recently created PV',
      'The cluster has a default StorageClass (annotated `storageclass.kubernetes.io/is-default-class: "true"`) that is applied to such claims',
    ],
    answer: [3],
    explanation:
      'When a PVC omits `storageClassName`, the DefaultStorageClass admission plugin assigns the cluster\'s default StorageClass. Explicitly setting `storageClassName: ""` instead opts out of dynamic provisioning and binds only to pre-created PVs without a class. Many distributions and kind/minikube install a default class.',
    choiceRationale: [
      'The scheduler places Pods; it does not choose StorageClasses.',
      'The kubelet does not substitute hostPath for a PVC.',
      'PVCs do not inherit classes from other PVs.',
      'Correct: the default StorageClass fills in an omitted class.',
    ],
    references: [R.storageClasses, R.pv],
    tags: ['storageclass', 'default', 'dynamic-provisioning'],
  },
  {
    id: 'q-co-storage-108',
    domain: 'orchestration',
    objective: 'co-storage',
    lessonId: 'volumes',
    difficulty: 1,
    type: 'single',
    prompt:
      'A Deployment\'s Pod mounts a PVC at `/data`. The Pod is deleted and the Deployment creates a replacement that references the same PVC. What does the new Pod find in `/data`?',
    choices: [
      'The files written by the previous Pod, because the PVC and its volume exist independently of any Pod',
      'An empty directory, because volumes are recreated with every Pod',
      'Only files that were also baked into the container image',
      'Nothing, because the PVC is deleted along with the Pod',
    ],
    answer: [0],
    explanation:
      'Persistent volumes have a lifecycle separate from Pods: the claim stays bound to its volume until the PVC itself is deleted. A replacement Pod that mounts the same claim sees the existing data. That is the key difference from ephemeral volumes such as emptyDir, which are removed with the Pod.',
    choiceRationale: [
      'Correct: the PVC outlives the Pod, so the data persists.',
      'That describes emptyDir, not a PersistentVolumeClaim.',
      'The mounted volume hides the image\'s content at that path; data comes from the volume.',
      'Deleting a Pod never deletes the PVCs it references.',
    ],
    references: [R.pv, R.volumes],
    tags: ['pvc', 'persistence', 'lifecycle'],
  },
];
