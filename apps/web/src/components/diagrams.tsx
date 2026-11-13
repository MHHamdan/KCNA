import type { DiagramId } from '@kcna/content';
import { DiagramSvg, StepPlayer, type DiagramSpec, type DStep } from './StepDiagram';

// ---------------- Cluster architecture ----------------

export const CLUSTER: DiagramSpec = {
  width: 900,
  height: 470,
  nodes: [
    { id: 'user', label: 'kubectl / CI', sub: 'client', x: 20, y: 30, w: 130, h: 50, kind: 'ext' },
    { id: 'cp', label: 'Control plane', x: 190, y: 10, w: 690, h: 165, kind: 'group' },
    { id: 'api', label: 'kube-apiserver', sub: 'front door, validates', x: 210, y: 45, w: 160, h: 56, kind: 'control' },
    { id: 'etcd', label: 'etcd', sub: 'cluster state (Raft)', x: 210, y: 112, w: 160, h: 50, kind: 'store' },
    { id: 'sched', label: 'kube-scheduler', sub: 'assigns Pods → nodes', x: 400, y: 45, w: 150, h: 56, kind: 'control' },
    { id: 'cm', label: 'controller-manager', sub: 'reconciliation loops', x: 570, y: 45, w: 150, h: 56, kind: 'control' },
    { id: 'ccm', label: 'cloud-controller', sub: 'LBs, routes (optional)', x: 740, y: 45, w: 125, h: 56, kind: 'control' },
    { id: 'n1', label: 'Worker node 1', x: 20, y: 215, w: 420, h: 240, kind: 'group' },
    { id: 'kubelet1', label: 'kubelet', sub: 'node agent', x: 40, y: 250, w: 120, h: 50, kind: 'node' },
    { id: 'proxy1', label: 'kube-proxy', sub: 'Service rules', x: 175, y: 250, w: 120, h: 50, kind: 'net' },
    { id: 'cri1', label: 'container runtime', sub: 'containerd / CRI-O', x: 310, y: 250, w: 120, h: 50, kind: 'node' },
    { id: 'podA', label: 'Pod web-1', sub: 'nginx', x: 40, y: 330, w: 120, h: 50, kind: 'pod' },
    { id: 'podB', label: 'Pod web-2', sub: 'nginx', x: 175, y: 330, w: 120, h: 50, kind: 'pod' },
    { id: 'cni1', label: 'CNI plugin', sub: 'Pod networking', x: 40, y: 395, w: 390, h: 44, kind: 'net' },
    { id: 'n2', label: 'Worker node 2', x: 460, y: 215, w: 420, h: 240, kind: 'group' },
    { id: 'kubelet2', label: 'kubelet', sub: 'node agent', x: 480, y: 250, w: 120, h: 50, kind: 'node' },
    { id: 'proxy2', label: 'kube-proxy', sub: 'Service rules', x: 615, y: 250, w: 120, h: 50, kind: 'net' },
    { id: 'cri2', label: 'container runtime', sub: 'containerd / CRI-O', x: 750, y: 250, w: 120, h: 50, kind: 'node' },
    { id: 'podC', label: 'Pod web-3', sub: 'nginx', x: 480, y: 330, w: 120, h: 50, kind: 'pod' },
    { id: 'cni2', label: 'CNI plugin', sub: 'Pod networking', x: 480, y: 395, w: 390, h: 44, kind: 'net' },
  ],
  edges: [
    { from: 'user', to: 'api' },
    { from: 'api', to: 'etcd' },
    { from: 'sched', to: 'api' },
    { from: 'cm', to: 'api' },
    { from: 'kubelet1', to: 'api' },
    { from: 'kubelet2', to: 'api' },
  ],
};

export const COMPONENT_INFO: Record<string, { title: string; what: string; failure: string; lessonId: string }> = {
  api: { title: 'kube-apiserver', what: 'The only component that talks to etcd. Every request (kubectl, controllers, kubelets) goes through it: authentication → authorization (RBAC) → admission control → validation → persisted in etcd. It also serves watches that let other components react to changes.', failure: 'If it is down, running Pods keep running, but nothing can be created, changed or observed through the API.', lessonId: 'api-server-and-etcd' },
  etcd: { title: 'etcd', what: 'A consistent, distributed key-value store (Raft consensus) holding all cluster state: objects, desired state and status. Usually run as 3 or 5 members so a majority (quorum) survives failures.', failure: 'Losing quorum makes the API read-only or unavailable; losing data without a backup loses the cluster state.', lessonId: 'api-server-and-etcd' },
  sched: { title: 'kube-scheduler', what: 'Watches for Pods with no nodeName, filters nodes that cannot run them (resources, taints, affinity, selectors), scores the rest and binds the Pod to the best node. It does not start containers.', failure: 'New Pods stay Pending; existing Pods are unaffected.', lessonId: 'control-plane-controllers' },
  cm: { title: 'kube-controller-manager', what: 'Runs the built-in controllers (Deployment, ReplicaSet, Node, Job, EndpointSlice, ServiceAccount…). Each is a control loop: observe actual state, compare with desired state, act to close the gap.', failure: 'Self-healing stops: deleted Pods are not replaced, rollouts stall, endpoints are not updated.', lessonId: 'control-plane-controllers' },
  ccm: { title: 'cloud-controller-manager', what: 'Optional. Integrates with a cloud provider: provisions load balancers for Services of type LoadBalancer, sets routes, and labels/removes nodes based on cloud instance state.', failure: 'LoadBalancer Services stay <pending> and cloud node lifecycle stops being tracked.', lessonId: 'control-plane-controllers' },
  kubelet1: { title: 'kubelet', what: 'The agent on every node. Watches the API for Pods bound to its node, asks the container runtime (via CRI) to start them, runs probes, mounts volumes and reports Pod and node status back.', failure: 'The node goes NotReady; after a timeout its Pods are evicted and recreated elsewhere by their controllers.', lessonId: 'node-components' },
  proxy1: { title: 'kube-proxy', what: 'Programs node networking rules (iptables, IPVS or nftables) so traffic to a Service ClusterIP is load-balanced to healthy Pod endpoints. Some CNIs (e.g. Cilium) can replace it.', failure: 'Service virtual IPs stop routing on that node; direct Pod IPs still work.', lessonId: 'services' },
  cri1: { title: 'Container runtime', what: 'Pulls images and runs containers through the Container Runtime Interface (CRI). containerd and CRI-O are the common choices; Docker Engine is no longer used directly since dockershim was removed in 1.24.', failure: 'No new containers can start on the node.', lessonId: 'node-components' },
  cni1: { title: 'CNI plugin', what: 'Gives each Pod an IP and connects Pods across nodes without NAT (the Kubernetes network model). Calico, Cilium and Flannel are examples; NetworkPolicy enforcement depends on the plugin.', failure: 'Pods get stuck ContainerCreating or cannot reach each other.', lessonId: 'pod-networking-and-cni' },
  podA: { title: 'Pod', what: 'The smallest deployable unit: one or more containers sharing a network namespace (one IP) and volumes. Pods are disposable; controllers replace them rather than repair them.', failure: 'A crashing container is restarted in place by the kubelet; a lost Pod is replaced by its controller.', lessonId: 'pods' },
  user: { title: 'Clients', what: 'kubectl, CI pipelines and GitOps agents all talk to the kube-apiserver over HTTPS using credentials from a kubeconfig or a ServiceAccount token.', failure: '—', lessonId: 'kubectl-and-cluster-administration' },
};
for (const [alias, base] of [
  ['kubelet2', 'kubelet1'],
  ['proxy2', 'proxy1'],
  ['cri2', 'cri1'],
  ['cni2', 'cni1'],
  ['podB', 'podA'],
  ['podC', 'podA'],
])
  COMPONENT_INFO[alias] = COMPONENT_INFO[base];

export const SEQUENCES: Record<string, { title: string; steps: DStep[] }> = {
  apply: {
    title: 'kubectl apply a Deployment (3 replicas)',
    steps: [
      { title: 'Request reaches the API server', text: 'kubectl sends the Deployment manifest over HTTPS. The API server authenticates the caller, authorizes the verb with RBAC, runs admission controllers (which may mutate or reject), and validates the object.', highlight: ['user', 'api'], edges: [{ from: 'user', to: 'api', label: 'POST Deployment' }] },
      { title: 'Desired state is stored', text: 'The validated object is written to etcd. Nothing is running yet — Kubernetes has only recorded what you want. kubectl returns "deployment.apps/web created".', highlight: ['api', 'etcd'], edges: [{ from: 'api', to: 'etcd', label: 'persist' }] },
      { title: 'Deployment controller reacts', text: 'The Deployment controller (in kube-controller-manager) is watching Deployments. It sees one with no matching ReplicaSet and creates a ReplicaSet for this Pod template.', highlight: ['cm', 'api'], edges: [{ from: 'cm', to: 'api', label: 'create ReplicaSet' }] },
      { title: 'ReplicaSet controller creates Pods', text: 'The ReplicaSet controller sees 0 of 3 Pods and creates 3 Pod objects. They exist in the API but have no node yet (spec.nodeName is empty) — they are Pending.', highlight: ['cm', 'api'], edges: [{ from: 'cm', to: 'api', label: 'create 3 Pods' }] },
      { title: 'Scheduler binds Pods to nodes', text: 'The scheduler watches for unscheduled Pods, filters nodes that fit (resources, taints, affinity), scores them, and writes a binding for each Pod. It never starts containers itself.', highlight: ['sched', 'api'], edges: [{ from: 'sched', to: 'api', label: 'bind Pod → node' }] },
      { title: 'kubelets start the containers', text: 'Each kubelet watches for Pods bound to its node, then asks the container runtime via CRI to pull the image and start containers. The CNI plugin gives each Pod an IP.', highlight: ['kubelet1', 'kubelet2', 'cri1', 'cri2', 'cni1', 'cni2'], edges: [{ from: 'api', to: 'kubelet1', label: 'watch' }, { from: 'kubelet1', to: 'cri1', label: 'CRI: run' }, { from: 'kubelet2', to: 'cri2', label: 'CRI: run' }] },
      { title: 'Status flows back', text: 'kubelets report Pod status (Running, Ready) to the API server, which stores it in etcd. Controllers see 3/3 ready and do nothing more — desired state equals actual state.', highlight: ['podA', 'podB', 'podC', 'kubelet1', 'kubelet2', 'api'], edges: [{ from: 'kubelet1', to: 'api', label: 'status' }, { from: 'kubelet2', to: 'api', label: 'status' }] },
    ],
  },
  nodefail: {
    title: 'A worker node fails',
    steps: [
      { title: 'Heartbeats stop', text: 'Node 2 loses power. Its kubelet stops renewing its Lease and posting node status to the API server.', highlight: ['kubelet2', 'n2'], edges: [] },
      { title: 'Node controller marks it NotReady', text: 'The node lifecycle controller notices the missing heartbeats (after the grace period) and sets the node condition to NotReady / Unknown, and taints it so nothing new is scheduled there.', highlight: ['cm', 'api'], edges: [{ from: 'cm', to: 'api', label: 'Node NotReady' }] },
      { title: 'Pods on the node are evicted', text: 'After the eviction timeout (via the not-ready/unreachable taints, 5 minutes by default) the Pods on that node are marked for deletion.', highlight: ['cm', 'podC'], edges: [{ from: 'cm', to: 'api', label: 'evict Pods' }] },
      { title: 'ReplicaSet sees a gap', text: 'The ReplicaSet controller now counts 2 of 3 desired Pods and creates a replacement Pod object. This is reconciliation: observe → compare → act.', highlight: ['cm', 'api'], edges: [{ from: 'cm', to: 'api', label: 'create Pod' }] },
      { title: 'Scheduled onto a healthy node', text: 'The scheduler skips the tainted node and binds the new Pod to node 1; its kubelet starts it. A bare Pod with no controller would not have been replaced.', highlight: ['sched', 'kubelet1', 'cri1'], edges: [{ from: 'sched', to: 'api', label: 'bind → node 1' }, { from: 'kubelet1', to: 'cri1', label: 'run' }] },
    ],
  },
  crash: {
    title: 'A container crashes (restart vs replacement)',
    steps: [
      { title: 'The process exits', text: 'The nginx process in Pod web-1 crashes with exit code 1. The Pod object still exists and is still bound to node 1.', highlight: ['podA'], edges: [] },
      { title: 'kubelet restarts the container in place', text: 'With restartPolicy: Always (the default for Deployments), the kubelet restarts the container inside the same Pod — same Pod name, same IP. The RESTARTS counter increases. No controller or scheduler is involved.', highlight: ['kubelet1', 'cri1', 'podA'], edges: [{ from: 'kubelet1', to: 'cri1', label: 'restart container' }] },
      { title: 'Repeated crashes → CrashLoopBackOff', text: 'If it keeps crashing, the kubelet waits with exponential back-off (10s, 20s, 40s… capped at 5 min). The status shows CrashLoopBackOff. Use kubectl logs --previous to see why the last attempt died.', highlight: ['kubelet1', 'podA', 'api'], edges: [{ from: 'kubelet1', to: 'api', label: 'CrashLoopBackOff' }] },
      { title: 'When is a Pod replaced instead?', text: 'Only when the Pod object itself goes away — deleted, evicted, or its node is lost. Then the ReplicaSet controller creates a new Pod (new name, new IP) and the scheduler places it.', highlight: ['cm', 'sched'], edges: [{ from: 'cm', to: 'api', label: 'replace Pod' }] },
    ],
  },
};

// ---------------- Networking ----------------

export const NETWORK: DiagramSpec = {
  width: 900,
  height: 420,
  nodes: [
    { id: 'client', label: 'External client', sub: 'browser', x: 20, y: 40, w: 140, h: 50, kind: 'ext' },
    { id: 'lb', label: 'Cloud load balancer', sub: 'type: LoadBalancer', x: 200, y: 40, w: 160, h: 50, kind: 'ext' },
    { id: 'cluster', label: 'Cluster', x: 180, y: 115, w: 700, h: 295, kind: 'group' },
    { id: 'ingress', label: 'Ingress controller', sub: 'routes by host/path', x: 200, y: 150, w: 160, h: 56, kind: 'net' },
    { id: 'svc', label: 'Service "web"', sub: 'ClusterIP 10.96.0.20', x: 420, y: 150, w: 170, h: 56, kind: 'net' },
    { id: 'dns', label: 'CoreDNS', sub: 'web.shop.svc.cluster.local', x: 650, y: 150, w: 210, h: 56, kind: 'control' },
    { id: 'eps', label: 'EndpointSlice', sub: 'ready Pod IPs', x: 420, y: 240, w: 170, h: 44, kind: 'obj' },
    { id: 'proxy', label: 'kube-proxy rules', sub: 'on every node', x: 200, y: 240, w: 160, h: 44, kind: 'net' },
    { id: 'p1', label: 'Pod web-1', sub: '10.244.1.5:8080', x: 200, y: 320, w: 150, h: 50, kind: 'pod' },
    { id: 'p2', label: 'Pod web-2', sub: '10.244.2.7:8080', x: 380, y: 320, w: 150, h: 50, kind: 'pod' },
    { id: 'p3', label: 'Pod web-3', sub: 'not Ready', x: 560, y: 320, w: 130, h: 50, kind: 'pod' },
    { id: 'frontend', label: 'Pod frontend', sub: 'caller', x: 720, y: 320, w: 140, h: 50, kind: 'pod' },
  ],
  edges: [
    { from: 'svc', to: 'eps' },
    { from: 'eps', to: 'p1' },
    { from: 'eps', to: 'p2' },
  ],
};

export const NETWORK_FLOWS: Record<string, { title: string; steps: DStep[] }> = {
  internal: {
    title: 'Pod → Service by DNS name',
    steps: [
      { title: 'DNS lookup', text: 'The frontend Pod calls http://web.shop. Its /etc/resolv.conf (set by the kubelet) points at CoreDNS, which answers with the Service ClusterIP 10.96.0.20 — not a Pod IP.', highlight: ['frontend', 'dns'], edges: [{ from: 'frontend', to: 'dns', label: 'A? web.shop' }] },
      { title: 'Packet to a virtual IP', text: 'The frontend sends to 10.96.0.20:80. No process owns that IP; it only exists as rules programmed by kube-proxy (or an eBPF dataplane) on every node.', highlight: ['frontend', 'proxy', 'svc'], edges: [{ from: 'frontend', to: 'proxy', label: '10.96.0.20:80' }] },
      { title: 'Endpoint selection', text: 'The Service selector (app: web) matches three Pods, but web-3 is failing its readiness probe, so only web-1 and web-2 are in the EndpointSlice.', highlight: ['svc', 'eps', 'p3'], edges: [{ from: 'svc', to: 'eps', label: 'selector app=web' }] },
      { title: 'DNAT to a ready Pod', text: 'The rules rewrite the destination to one ready endpoint (port 80 → targetPort 8080). The CNI network carries the packet to that Pod, even if it is on another node.', highlight: ['proxy', 'p2'], edges: [{ from: 'proxy', to: 'p2', label: '10.244.2.7:8080' }] },
    ],
  },
  ingress: {
    title: 'Internet → Ingress → Service → Pod',
    steps: [
      { title: 'Traffic enters the cluster', text: 'A client hits shop.example.com. A cloud load balancer (from a LoadBalancer Service) forwards to the Ingress controller Pods. Ingress itself is only a set of routing rules; the controller (e.g. NGINX, Traefik, Envoy-based) does the work.', highlight: ['client', 'lb', 'ingress'], edges: [{ from: 'client', to: 'lb', label: 'HTTPS' }, { from: 'lb', to: 'ingress', label: 'forward' }] },
      { title: 'Layer-7 routing', text: 'The controller matches host shop.example.com and path / to the backend Service "web", and can terminate TLS using a Secret referenced by the Ingress.', highlight: ['ingress', 'svc'], edges: [{ from: 'ingress', to: 'svc', label: 'host + path rule' }] },
      { title: 'To a ready Pod', text: 'Controllers usually read the EndpointSlices and send directly to ready Pod IPs, skipping the ClusterIP hop. Gateway API (Gateway + HTTPRoute) is the newer, role-oriented successor to Ingress.', highlight: ['svc', 'eps', 'p1'], edges: [{ from: 'ingress', to: 'p1', label: 'to Pod IP' }] },
    ],
  },
  nodeport: {
    title: 'NodePort exposure',
    steps: [
      { title: 'Every node opens the port', text: 'A NodePort Service allocates a port (30000–32767 by default) and kube-proxy opens it on every node, in addition to the ClusterIP.', highlight: ['proxy', 'svc'], edges: [] },
      { title: 'Client hits any node', text: 'A client connects to <any-node-IP>:31080. The rules forward to a ready endpoint, possibly on a different node (unless externalTrafficPolicy: Local).', highlight: ['client', 'proxy', 'p1'], edges: [{ from: 'client', to: 'proxy', label: 'node:31080' }, { from: 'proxy', to: 'p1', label: 'to endpoint' }] },
      { title: 'LoadBalancer builds on it', text: 'A LoadBalancer Service is a NodePort Service plus an external load balancer provisioned by the cloud controller that targets those node ports.', highlight: ['lb', 'proxy'], edges: [{ from: 'lb', to: 'proxy', label: 'to node ports' }] },
    ],
  },
};

// ---------------- Storage ----------------

export const STORAGE: DiagramSpec = {
  width: 900,
  height: 300,
  nodes: [
    { id: 'pod', label: 'Pod "db-0"', sub: 'volumeMounts /var/lib/data', x: 20, y: 120, w: 160, h: 60, kind: 'pod' },
    { id: 'pvc', label: 'PVC "data"', sub: '10Gi · RWO · class fast', x: 220, y: 120, w: 160, h: 60, kind: 'obj' },
    { id: 'pv', label: 'PersistentVolume', sub: 'pvc-3f2a… 10Gi', x: 420, y: 120, w: 160, h: 60, kind: 'store' },
    { id: 'sc', label: 'StorageClass "fast"', sub: 'provisioner + params', x: 420, y: 20, w: 160, h: 56, kind: 'control' },
    { id: 'csi', label: 'CSI driver', sub: 'controller + node plugin', x: 620, y: 20, w: 160, h: 56, kind: 'control' },
    { id: 'disk', label: 'Storage backend', sub: 'cloud disk / NFS / Ceph', x: 620, y: 120, w: 160, h: 60, kind: 'ext' },
    { id: 'kubelet', label: 'kubelet', sub: 'mounts into Pod', x: 220, y: 225, w: 160, h: 50, kind: 'node' },
  ],
  edges: [
    { from: 'pod', to: 'pvc' },
    { from: 'pvc', to: 'pv' },
    { from: 'pv', to: 'disk' },
  ],
};

export const STORAGE_FLOWS: Record<string, { title: string; steps: DStep[] }> = {
  dynamic: {
    title: 'Dynamic provisioning',
    steps: [
      { title: 'Developer claims storage', text: 'The app team creates a PersistentVolumeClaim asking for 10Gi, ReadWriteOnce, storageClassName: fast. A PVC is a request — it does not say which disk.', highlight: ['pvc'], edges: [] },
      { title: 'StorageClass selects a provisioner', text: 'No existing PV matches, so the StorageClass "fast" tells Kubernetes which CSI provisioner and parameters (disk type, IOPS) to use.', highlight: ['pvc', 'sc'], edges: [{ from: 'pvc', to: 'sc', label: 'class: fast' }] },
      { title: 'CSI creates the real volume', text: 'The CSI controller plugin calls the storage backend API to create a 10Gi volume. With volumeBindingMode: WaitForFirstConsumer this waits until a Pod is scheduled, so the disk lands in the right zone.', highlight: ['sc', 'csi', 'disk'], edges: [{ from: 'sc', to: 'csi', label: 'CreateVolume' }, { from: 'csi', to: 'disk', label: 'provision' }] },
      { title: 'PV is created and bound', text: 'A PersistentVolume object representing that disk is created and bound one-to-one to the PVC. Status: Bound.', highlight: ['pv', 'pvc'], edges: [{ from: 'pvc', to: 'pv', label: 'Bound' }] },
      { title: 'kubelet mounts it into the Pod', text: 'When the Pod referencing the PVC starts, the CSI node plugin attaches and mounts the volume and the kubelet bind-mounts it at /var/lib/data. Data survives container restarts and Pod replacement.', highlight: ['pod', 'kubelet', 'pv'], edges: [{ from: 'kubelet', to: 'pod', label: 'mount' }] },
      { title: 'Deletion and reclaim policy', text: 'Delete the PVC and the reclaimPolicy decides the disk’s fate: Delete (default for dynamic PVs) removes it; Retain keeps it for manual recovery.', highlight: ['pvc', 'pv', 'disk'], edges: [] },
    ],
  },
  static: {
    title: 'Static provisioning',
    steps: [
      { title: 'Admin pre-creates a PV', text: 'A cluster admin creates a PersistentVolume pointing at an existing disk or NFS export, with capacity, accessModes and storageClassName.', highlight: ['pv', 'disk'], edges: [{ from: 'pv', to: 'disk', label: 'existing volume' }] },
      { title: 'PVC matches by requirements', text: 'A PVC is bound to a PV whose capacity, access modes and class satisfy it. If none matches, the PVC stays Pending.', highlight: ['pvc', 'pv'], edges: [{ from: 'pvc', to: 'pv', label: 'match + bind' }] },
      { title: 'Pod uses the claim', text: 'The Pod references only the PVC name — it never needs to know the storage backend. That separation is the point of PV/PVC.', highlight: ['pod', 'pvc'], edges: [{ from: 'pod', to: 'pvc', label: 'claimName: data' }] },
    ],
  },
};

// ---------------- Smaller lesson diagrams ----------------

const SIMPLE: Partial<Record<DiagramId, { spec: DiagramSpec; title: string; caption: string }>> = {
  'deployment-hierarchy': {
    title: 'Deployment → ReplicaSets → Pods',
    caption: 'A Deployment owns ReplicaSets (one per Pod-template revision); each ReplicaSet owns Pods. During a rolling update the new ReplicaSet scales up while the old one scales down; the old ReplicaSet is kept at 0 replicas for rollback.',
    spec: {
      width: 700,
      height: 260,
      nodes: [
        { id: 'd', label: 'Deployment web', sub: 'replicas: 3, strategy: RollingUpdate', x: 220, y: 10, w: 260, h: 56, kind: 'control' },
        { id: 'rs1', label: 'ReplicaSet web-7d9c', sub: 'revision 1 · image v1 · 0 Pods', x: 30, y: 110, w: 260, h: 56, kind: 'obj' },
        { id: 'rs2', label: 'ReplicaSet web-5f6b', sub: 'revision 2 · image v2 · 3 Pods', x: 410, y: 110, w: 260, h: 56, kind: 'obj' },
        { id: 'p1', label: 'Pod', sub: 'web-5f6b-a', x: 380, y: 200, w: 95, h: 46, kind: 'pod' },
        { id: 'p2', label: 'Pod', sub: 'web-5f6b-b', x: 492, y: 200, w: 95, h: 46, kind: 'pod' },
        { id: 'p3', label: 'Pod', sub: 'web-5f6b-c', x: 604, y: 200, w: 90, h: 46, kind: 'pod' },
      ],
      edges: [
        { from: 'd', to: 'rs1', label: 'owns' },
        { from: 'd', to: 'rs2', label: 'owns' },
        { from: 'rs2', to: 'p1' },
        { from: 'rs2', to: 'p2' },
        { from: 'rs2', to: 'p3' },
      ],
    },
  },
  'rbac-model': {
    title: 'RBAC: who can do what, where',
    caption: 'A RoleBinding grants the rules of a Role (namespaced) or ClusterRole to subjects within one namespace. A ClusterRoleBinding grants a ClusterRole across the whole cluster. RBAC is purely additive — there are no deny rules.',
    spec: {
      width: 760,
      height: 230,
      nodes: [
        { id: 'u', label: 'User / Group', sub: 'from authn (certs, OIDC)', x: 10, y: 20, w: 190, h: 52, kind: 'ext' },
        { id: 'sa', label: 'ServiceAccount', sub: 'identity for Pods', x: 10, y: 130, w: 190, h: 52, kind: 'pod' },
        { id: 'rb', label: 'RoleBinding', sub: 'namespace: shop', x: 280, y: 75, w: 180, h: 56, kind: 'obj' },
        { id: 'role', label: 'Role', sub: 'get, list, watch pods', x: 540, y: 20, w: 200, h: 52, kind: 'control' },
        { id: 'cr', label: 'ClusterRole', sub: 'reusable rule set', x: 540, y: 130, w: 200, h: 52, kind: 'control' },
      ],
      edges: [
        { from: 'u', to: 'rb', label: 'subject' },
        { from: 'sa', to: 'rb', label: 'subject' },
        { from: 'rb', to: 'role', label: 'roleRef' },
        { from: 'rb', to: 'cr', label: 'or roleRef' },
      ],
    },
  },
  'observability-pillars': {
    title: 'Metrics, logs and traces',
    caption: 'Metrics answer "is something wrong and how much?" (cheap aggregates, alerting). Logs answer "what happened in this component?" (discrete events). Traces answer "where did this request spend its time?" across services. OpenTelemetry standardises how all three are produced and exported.',
    spec: {
      width: 760,
      height: 230,
      nodes: [
        { id: 'app', label: 'Instrumented app', sub: 'OpenTelemetry SDK', x: 10, y: 85, w: 180, h: 56, kind: 'pod' },
        { id: 'col', label: 'OTel Collector', sub: 'receive · process · export', x: 250, y: 85, w: 190, h: 56, kind: 'net' },
        { id: 'm', label: 'Metrics', sub: 'Prometheus', x: 520, y: 10, w: 220, h: 50, kind: 'store' },
        { id: 'l', label: 'Logs', sub: 'Fluent Bit / Loki / OpenSearch', x: 520, y: 90, w: 220, h: 50, kind: 'store' },
        { id: 't', label: 'Traces', sub: 'Jaeger / Tempo', x: 520, y: 170, w: 220, h: 50, kind: 'store' },
      ],
      edges: [
        { from: 'app', to: 'col', label: 'OTLP' },
        { from: 'col', to: 'm' },
        { from: 'col', to: 'l' },
        { from: 'col', to: 't' },
      ],
    },
  },
  'gitops-flow': {
    title: 'GitOps: pull-based reconciliation',
    caption: 'CI builds and tests images and updates manifests in Git. A GitOps agent inside the cluster (Argo CD, Flux) pulls the desired state from Git and continuously reconciles the cluster to match — drift is detected and reverted. No CI system needs cluster-admin credentials.',
    spec: {
      width: 780,
      height: 200,
      nodes: [
        { id: 'dev', label: 'Developer', sub: 'pull request', x: 10, y: 20, w: 140, h: 50, kind: 'ext' },
        { id: 'ci', label: 'CI pipeline', sub: 'test · build · push image', x: 190, y: 20, w: 190, h: 50, kind: 'ext' },
        { id: 'git', label: 'Git repo', sub: 'manifests = desired state', x: 190, y: 125, w: 190, h: 54, kind: 'store' },
        { id: 'agent', label: 'GitOps agent', sub: 'Argo CD / Flux (in cluster)', x: 430, y: 125, w: 200, h: 54, kind: 'control' },
        { id: 'k8s', label: 'Cluster', sub: 'actual state', x: 660, y: 125, w: 110, h: 54, kind: 'node' },
      ],
      edges: [
        { from: 'dev', to: 'ci', label: 'push' },
        { from: 'ci', to: 'git', label: 'bump image tag' },
        { from: 'agent', to: 'git', label: 'pull' },
        { from: 'agent', to: 'k8s', label: 'reconcile' },
      ],
    },
  },
  'container-layers': {
    title: 'Image layers and the container layer',
    caption: 'An OCI image is an ordered stack of read-only, content-addressed layers plus a config. A running container adds one thin writable layer on top; it disappears with the container — persist data in volumes instead.',
    spec: {
      width: 640,
      height: 260,
      nodes: [
        { id: 'w', label: 'Writable container layer', sub: 'per container, ephemeral', x: 120, y: 10, w: 400, h: 44, kind: 'pod' },
        { id: 'l3', label: 'COPY app/ (layer 3)', sub: 'sha256:9c1…', x: 120, y: 70, w: 400, h: 40, kind: 'obj' },
        { id: 'l2', label: 'RUN apk add … (layer 2)', sub: 'sha256:41a…', x: 120, y: 120, w: 400, h: 40, kind: 'obj' },
        { id: 'l1', label: 'FROM alpine:3.20 (layer 1)', sub: 'sha256:7b2…', x: 120, y: 170, w: 400, h: 40, kind: 'obj' },
        { id: 'reg', label: 'Registry stores layers by digest; tags are mutable pointers', x: 60, y: 220, w: 520, h: 32, kind: 'store' },
      ],
    },
  },
  'reconciliation-loop': {
    title: 'The control loop',
    caption: 'Every controller repeats: observe actual state (via watches on the API), compare it with the desired state in the object spec, and act to close the difference. Level-triggered: it converges no matter how many events were missed.',
    spec: {
      width: 640,
      height: 240,
      nodes: [
        { id: 'desired', label: 'Desired state', sub: 'spec (in etcd)', x: 20, y: 20, w: 170, h: 52, kind: 'store' },
        { id: 'observe', label: 'Observe', sub: 'watch the API', x: 240, y: 20, w: 150, h: 52, kind: 'control' },
        { id: 'diff', label: 'Compare', sub: 'desired vs actual', x: 450, y: 95, w: 160, h: 52, kind: 'control' },
        { id: 'act', label: 'Act', sub: 'create / delete / update', x: 240, y: 170, w: 150, h: 52, kind: 'control' },
        { id: 'actual', label: 'Actual state', sub: 'status, running Pods', x: 20, y: 170, w: 170, h: 52, kind: 'node' },
      ],
      edges: [
        { from: 'observe', to: 'diff' },
        { from: 'diff', to: 'act' },
        { from: 'act', to: 'actual' },
        { from: 'actual', to: 'observe' },
        { from: 'desired', to: 'observe' },
      ],
    },
  },
};

/** Diagram shown inside a lesson. Interactive sequences reuse the explorers. */
export function LessonDiagram({ id }: { id: DiagramId }) {
  if (id === 'cluster-architecture' || id === 'request-flow')
    return <StepPlayer spec={CLUSTER} steps={SEQUENCES.apply.steps} title={SEQUENCES.apply.title} />;
  if (id === 'service-networking') return <StepPlayer spec={NETWORK} steps={NETWORK_FLOWS.internal.steps} title={NETWORK_FLOWS.internal.title} />;
  if (id === 'ingress-flow') return <StepPlayer spec={NETWORK} steps={NETWORK_FLOWS.ingress.steps} title={NETWORK_FLOWS.ingress.title} />;
  if (id === 'storage-binding') return <StepPlayer spec={STORAGE} steps={STORAGE_FLOWS.dynamic.steps} title={STORAGE_FLOWS.dynamic.title} />;
  const d = SIMPLE[id];
  if (!d) return null;
  return (
    <figure>
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2 dark:border-slate-800 dark:bg-ink-950/40">
        <DiagramSvg spec={d.spec} title={d.title} highlight={[]} activeEdges={d.spec.edges?.filter((e) => e.label)} />
      </div>
      <figcaption className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        <strong>{d.title}.</strong> {d.caption}
      </figcaption>
    </figure>
  );
}
