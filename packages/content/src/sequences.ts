// Ordering puzzles: the learner drags shuffled steps back into the correct sequence.
// `steps` is always stored in the CORRECT order; the UI is responsible for shuffling.

import type { InfraTopicId, ObjectiveId } from './types';

export interface SequencePuzzle {
  id: string;
  track: 'kcna' | 'infra';
  objective: ObjectiveId | InfraTopicId;
  lessonId: string;
  title: string;
  prompt: string;
  steps: string[];
  explanation: string;
}

export const sequencePuzzles: SequencePuzzle[] = [
  // ───────────────────────────── KCNA ─────────────────────────────
  {
    id: 'seq-apply-to-running-pod',
    track: 'kcna',
    objective: 'kf-core',
    lessonId: 'api-server-and-etcd',
    title: 'From kubectl apply to a running Pod',
    prompt: 'You run `kubectl apply -f deployment.yaml`. Put these steps in the order they happen.',
    steps: [
      'kubectl sends the Deployment manifest to the kube-apiserver over HTTPS',
      'The API server authenticates the caller and authorizes the request (e.g. RBAC)',
      'Admission controllers mutate and validate the Deployment object',
      'The Deployment is persisted to etcd',
      'The Deployment controller creates a ReplicaSet, and the ReplicaSet controller creates the Pods',
      'The scheduler binds each new, unassigned Pod to a suitable node',
      'The kubelet on that node starts the containers through the CRI runtime',
    ],
    explanation:
      'Every write goes through the API server pipeline (**authn → authz → admission**) before it is stored in **etcd**. Controllers then react to the stored object: the Deployment controller creates a ReplicaSet, whose controller creates Pods with no `nodeName`. The **scheduler** fills in the node, and only then does that node\'s **kubelet** ask the container runtime to start containers.',
  },
  {
    id: 'seq-rolling-update',
    track: 'kcna',
    objective: 'cad-delivery',
    lessonId: 'rollouts-and-deployment-strategies',
    title: 'Rolling update of a Deployment',
    prompt: 'A Deployment uses `RollingUpdate` with `maxSurge: 1` and `maxUnavailable: 0`. Order the rollout steps.',
    steps: [
      'The Pod template is changed, e.g. a new image tag is applied',
      'The Deployment controller creates a new ReplicaSet for the new template hash',
      'The new ReplicaSet is scaled up by one Pod, using the surge allowance',
      'The new Pod passes its readiness probe and counts as available',
      'The old ReplicaSet is scaled down by one Pod',
      'The new ReplicaSet holds all replicas; the old one sits at 0, kept for rollback',
    ],
    explanation:
      'Only a change to the **Pod template** triggers a rollout, and each distinct template gets its own ReplicaSet. With `maxUnavailable: 0` the controller must add a **ready** new Pod before it may remove an old one, so capacity never drops. The scale-up/scale-down cycle repeats until the old ReplicaSet reaches 0; it is retained so `kubectl rollout undo` can scale it back up.',
  },
  {
    id: 'seq-crashloop-backoff',
    track: 'kcna',
    objective: 'co-troubleshooting',
    lessonId: 'troubleshooting-workloads',
    title: 'Container crash and CrashLoopBackOff',
    prompt: 'A container in a Deployment-managed Pod keeps crashing. Order what the kubelet does.',
    steps: [
      'The container\'s main process exits with a non-zero exit code',
      'The kubelet detects the exit and records the container state as Terminated',
      'Per restartPolicy: Always, the kubelet waits an exponential back-off; status shows CrashLoopBackOff',
      'The back-off expires and the kubelet restarts the container in the same Pod; restartCount increments',
      'The container stays up for 10 minutes and the kubelet resets the back-off timer',
    ],
    explanation:
      'Restarts are done **in place by the kubelet** on the same node; the Pod is not rescheduled. Between restarts the kubelet applies an exponential back-off (10s, 20s, 40s, … capped at 5 minutes), which is what `CrashLoopBackOff` means. The back-off resets only after the container runs successfully for 10 minutes; use `kubectl logs --previous` to see why it died.',
  },
  {
    id: 'seq-service-dns-path',
    track: 'kcna',
    objective: 'co-networking',
    lessonId: 'dns-and-coredns',
    title: 'Calling a Service by name',
    prompt: 'A Pod in namespace `prod` calls `http://my-svc:8080`. Order the steps until the packet reaches a backend Pod.',
    steps: [
      'The app\'s resolver reads /etc/resolv.conf: the kube-dns ClusterIP plus namespace search domains',
      'The resolver sends a query for my-svc.prod.svc.cluster.local to the kube-dns Service IP',
      'kube-proxy rules on the node DNAT the DNS query to a CoreDNS Pod',
      'CoreDNS answers with the ClusterIP of my-svc from its watch of the Kubernetes API',
      'The app opens a TCP connection to the ClusterIP on port 8080',
      'kube-proxy rules DNAT the connection to one ready backend Pod IP from the EndpointSlices',
      'The packet is routed over the CNI Pod network to the chosen backend Pod',
    ],
    explanation:
      'The kubelet writes `/etc/resolv.conf` so short names are expanded with search domains like `prod.svc.cluster.local`. Both the DNS query (to the **kube-dns** Service) and the app traffic (to **my-svc**) hit virtual ClusterIPs that **kube-proxy** translates into real Pod IPs. CoreDNS only returns the ClusterIP; load balancing across ready endpoints happens per connection in kube-proxy\'s rules.',
  },
  {
    id: 'seq-pvc-dynamic-provisioning',
    track: 'kcna',
    objective: 'co-storage',
    lessonId: 'persistent-volumes-and-csi',
    title: 'Dynamic provisioning with CSI',
    prompt: 'The StorageClass uses `volumeBindingMode: WaitForFirstConsumer`. Order the steps from PVC to mounted volume.',
    steps: [
      'A PersistentVolumeClaim referencing the StorageClass is created and stays Pending',
      'A Pod that uses the claim is created and the scheduler selects a node for it',
      'The CSI external-provisioner calls the driver\'s CreateVolume in that node\'s topology',
      'A PersistentVolume is created and bound to the PVC',
      'The volume is attached to the selected node (ControllerPublishVolume)',
      'The kubelet stages and mounts the volume into the Pod\'s directory via the CSI node plugin',
      'The containers start with the volume mounted at their mountPath',
    ],
    explanation:
      '`WaitForFirstConsumer` delays provisioning until a Pod needs the claim, so the disk is created in the **zone of the chosen node** instead of a random one. The provisioner creates the backing disk and a **PV**, which is bound 1:1 to the PVC. Attach (controller side) must happen before the kubelet can stage/publish the mount (node side), and containers only start once their volumes are mounted.',
  },
  {
    id: 'seq-api-request-chain',
    track: 'kcna',
    objective: 'co-security',
    lessonId: 'authentication-authorization-rbac',
    title: 'API request authorization chain',
    prompt: 'A ServiceAccount creates a Pod. Order the stages its request passes through in the API server.',
    steps: [
      'The client sends the request over TLS with its bearer token',
      'Authentication identifies the user (system:serviceaccount:ns:name) and its groups',
      'RBAC authorization checks Role/ClusterRole bindings for a rule allowing create on pods',
      'Mutating admission controllers and webhooks may modify the object',
      'The object is validated against its schema',
      'Validating admission (webhooks, ValidatingAdmissionPolicy) accepts or rejects the object',
      'The object is persisted to etcd and a 201 Created response is returned',
    ],
    explanation:
      'Kubernetes must know **who** you are (authentication) before deciding **what** you may do (authorization); RBAC is purely additive, so a single matching allow rule suffices. Admission runs only after authorization, with **mutating** before **validating** so validators see the final object. A rejection at any stage means nothing is written to etcd.',
  },
  {
    id: 'seq-pod-termination',
    track: 'kcna',
    objective: 'kf-core',
    lessonId: 'pods',
    title: 'Graceful Pod termination',
    prompt: 'A Pod with a `preStop` hook is deleted. Order the termination steps (assume the app ignores SIGTERM).',
    steps: [
      'The API server sets deletionTimestamp and the grace period (default 30s); the Pod shows Terminating',
      'The kubelet runs the container\'s preStop hook',
      'The container runtime sends SIGTERM to the main process of each container',
      'The grace period expires with the process still running',
      'The runtime sends SIGKILL and the kubelet confirms termination, so the Pod object is removed',
    ],
    explanation:
      'Deletion is a two-phase process: the API marks the Pod, then the **kubelet** carries out the shutdown. The `preStop` hook runs **before** SIGTERM and its time counts against `terminationGracePeriodSeconds`. If the process has not exited when the grace period ends, it is force-killed with **SIGKILL**.',
  },
  {
    id: 'seq-node-failure',
    track: 'kcna',
    objective: 'kf-scheduling',
    lessonId: 'control-plane-controllers',
    title: 'Node failure and rescheduling',
    prompt: 'A worker node running Deployment Pods loses power. Order what the control plane does.',
    steps: [
      'The node\'s kubelet stops renewing its Lease and posting status',
      'After the node monitor grace period, the node lifecycle controller sets Ready to Unknown',
      'The controller taints the node with node.kubernetes.io/unreachable:NoExecute',
      'The Pods\' default 300s toleration for that taint expires and they are evicted',
      'The ReplicaSet controller sees too few replicas and creates replacement Pods',
      'The scheduler places the replacement Pods on healthy nodes',
    ],
    explanation:
      'Node health is inferred from **heartbeats** (Lease objects), so detection takes the grace period. **Taint-based eviction** then gives Pods their `tolerationSeconds` (300s by default) before they are deleted. Only then does the ReplicaSet controller notice missing replicas and create new Pods for the **scheduler** to place, which is why recovery from a dead node takes minutes, not seconds.',
  },
  {
    id: 'seq-helm-upgrade-rollback',
    track: 'kcna',
    objective: 'cad-delivery',
    lessonId: 'helm-and-kustomize',
    title: 'Helm upgrade and rollback',
    prompt: 'You upgrade release `web` from revision 1 and it misbehaves. Order the steps.',
    steps: [
      'helm upgrade merges values and renders the chart templates into manifests',
      'pre-upgrade hooks run',
      'Helm applies the changed resources to the cluster through the API server',
      'post-upgrade hooks run; revision 2 is recorded as deployed and revision 1 as superseded',
      'The new version misbehaves and you run helm rollback web 1',
      'Helm re-applies revision 1\'s stored manifest and records it as revision 3',
    ],
    explanation:
      'Helm renders templates **client-side**, then applies them, with hooks bracketing the change. Each release revision is stored in the cluster (as a Secret by default), which is what makes **rollback** possible. A rollback never rewrites history: it creates a **new** revision whose content equals the old one.',
  },
  {
    id: 'seq-gitops-reconcile',
    track: 'kcna',
    objective: 'cad-delivery',
    lessonId: 'cicd-and-gitops',
    title: 'GitOps reconcile loop',
    prompt: 'A team uses Argo CD or Flux. Order the steps from code change to synced cluster.',
    steps: [
      'CI builds, tests and pushes a new container image to the registry',
      'The image tag is updated in the config repository via a reviewed pull request',
      'The in-cluster GitOps agent detects the new commit by polling or webhook',
      'The agent renders the manifests (plain YAML, Kustomize or Helm) into desired state',
      'The agent diffs desired state against live cluster state and reports OutOfSync',
      'The agent applies the difference to the API server',
      'Resources become healthy and the application reports Synced and Healthy',
    ],
    explanation:
      'In GitOps, **Git is the source of truth** and CI never pushes to the cluster; it only produces an artifact and a config change. An agent **inside** the cluster pulls the new desired state, compares it with what is running, and converges the two. The same diff loop also detects and reverts manual drift.',
  },
  {
    id: 'seq-pod-startup-probes',
    track: 'kcna',
    objective: 'kf-core',
    lessonId: 'health-probes',
    title: 'Pod startup to receiving traffic',
    prompt: 'A Pod has two init containers, an app container with startup and readiness probes, and is behind a Service. Order the steps.',
    steps: [
      'The scheduler binds the Pod to a node',
      'The kubelet creates the Pod sandbox and the CNI plugin assigns a Pod IP',
      'Init containers run one at a time, each exiting successfully before the next starts',
      'The app container is started',
      'The startupProbe succeeds, enabling liveness and readiness checks',
      'The readinessProbe succeeds and the Pod\'s Ready condition becomes True',
      'The Pod IP is marked ready in the Service\'s EndpointSlice and starts receiving traffic',
    ],
    explanation:
      'The sandbox and network come first because every container shares the Pod\'s network namespace. Regular **init containers** run sequentially to completion before any app container starts. Liveness and readiness probes are held off until the **startupProbe** passes, and only a **Ready** Pod is published as a ready endpoint for the Service.',
  },
  {
    id: 'seq-hpa-scale-up',
    track: 'kcna',
    objective: 'cna-ecosystem',
    lessonId: 'autoscaling-and-serverless',
    title: 'HPA scale-up loop',
    prompt: 'An HPA targets 60% average CPU on a Deployment and traffic spikes. Order the scale-up steps.',
    steps: [
      'Traffic rises and the Pods\' CPU usage climbs above the target',
      'metrics-server scrapes the higher usage from kubelets and exposes it via the Metrics API',
      'The HPA controller reads the metrics and computes desiredReplicas from the usage-to-target ratio',
      'The HPA updates the replicas field through the Deployment\'s scale subresource',
      'The Deployment controller scales its ReplicaSet, which creates new Pods for the scheduler to place',
      'The new Pods become Ready, join the Service and average CPU falls toward the target',
    ],
    explanation:
      'The HPA is a control loop (every 15s by default) that compares **observed** metrics with the **target**: `desired = ceil(current × currentMetric / target)`. metrics-server scrapes continuously, so the HPA always acts on slightly delayed data. It only changes the `replicas` count; the usual Deployment → ReplicaSet → scheduler chain creates the Pods. CPU utilization is measured against **requests**, so Pods without CPU requests cannot be scaled on CPU.',
  },

  // ───────────────────────────── Infra ─────────────────────────────
  {
    id: 'seq-https-connection',
    track: 'infra',
    objective: 'net-fundamentals',
    lessonId: 'infra-net-fundamentals',
    title: 'Opening an HTTPS connection',
    prompt: 'A browser loads `https://api.example.com/` over HTTP/1.1 or HTTP/2 with TLS 1.3 (no cached state). Order the steps.',
    steps: [
      'The client resolves api.example.com to an IP address via DNS',
      'The TCP three-way handshake completes: SYN, SYN-ACK, ACK',
      'The client sends ClientHello with SNI, supported ciphers and a key share',
      'The server sends ServerHello and key share, then encrypted Certificate, CertificateVerify and Finished',
      'The client validates the certificate chain and hostname, then sends its Finished',
      'The client sends the encrypted HTTP request',
      'The server returns the encrypted HTTP response',
    ],
    explanation:
      'You need an **IP** before you can open a **TCP** connection, and a TCP connection before TLS can run over it. TLS 1.3 completes in **one round trip**: key shares travel in the first flight, so everything after ServerHello is already encrypted. The HTTP request is only sent once the client has authenticated the server and finished the handshake.',
  },
  {
    id: 'seq-dns-recursive',
    track: 'infra',
    objective: 'net-fundamentals',
    lessonId: 'infra-net-fundamentals',
    title: 'Recursive DNS resolution',
    prompt: 'Nothing is cached anywhere for `www.example.com`. Order the resolution steps.',
    steps: [
      'The stub resolver on the host sends a recursive query to its configured recursive resolver',
      'The recursive resolver queries a root name server',
      'The root server refers the resolver to the .com TLD name servers',
      'The .com TLD server refers the resolver to example.com\'s authoritative name servers',
      'The authoritative server returns the A/AAAA record with its TTL',
      'The recursive resolver caches the answer for the TTL and returns it to the stub resolver',
    ],
    explanation:
      'The stub asks one **recursive** resolver to do all the work, and that resolver walks the hierarchy **iteratively**: root → TLD → authoritative, following referrals. Only the authoritative server holds the actual record. Caching by **TTL** at the resolver is why later lookups are fast and why DNS changes propagate slowly.',
  },
  {
    id: 'seq-incident-lifecycle',
    track: 'infra',
    objective: 'rel-incidents',
    lessonId: 'infra-rel-incidents',
    title: 'Incident response lifecycle',
    prompt: 'Checkout error rates spike in production. Order the incident response steps.',
    steps: [
      'A symptom-based SLO burn-rate alert fires and pages the on-call engineer',
      'On-call acknowledges, assesses user impact and declares an incident with a severity',
      'An incident commander is assigned, roles are set and a dedicated channel is opened',
      'The team mitigates impact, e.g. rolls back the suspect deploy, before finding root cause',
      'Metrics confirm recovery, the incident is resolved and stakeholders are notified',
      'A blameless postmortem is written and its action items are tracked',
    ],
    explanation:
      'Detection should come from **user-facing symptoms**, and declaring early with a severity unlocks the right response. A single **incident commander** coordinates while others work. **Mitigate first**: restoring service beats understanding the cause, which is investigated afterwards in the postmortem.',
  },
  {
    id: 'seq-blameless-postmortem',
    track: 'infra',
    objective: 'rel-incidents',
    lessonId: 'infra-rel-incidents',
    title: 'Blameless postmortem process',
    prompt: 'A SEV-2 incident has just been resolved. Order the postmortem steps.',
    steps: [
      'A postmortem owner is assigned for the resolved incident',
      'The owner builds a timestamped timeline from alerts, chat logs and deploy history',
      'The team analyses contributing factors and why defences failed, focusing on systems not people',
      'Action items are proposed with owners, priorities and due dates',
      'A review meeting with stakeholders validates the findings and action items',
      'The postmortem is published widely and action items are tracked to completion',
    ],
    explanation:
      'Analysis needs facts, so the **timeline** comes before any conclusions. Looking at **contributing factors** rather than a single culprit keeps it blameless and surfaces systemic fixes. Actions are reviewed before publishing, and a postmortem only pays off when its action items actually ship.',
  },
  {
    id: 'seq-envelope-encryption',
    track: 'infra',
    objective: 'sec-data',
    lessonId: 'infra-sec-data',
    title: 'Envelope encryption with KMS',
    prompt: 'A service encrypts a large file with a KMS key and later reads it back. Order the steps.',
    steps: [
      'The app calls KMS GenerateDataKey for its key-encryption key (KEK)',
      'KMS returns a plaintext data key (DEK) and the same DEK encrypted under the KEK',
      'The app encrypts the file locally with the plaintext DEK and discards the DEK from memory',
      'The ciphertext is stored together with the wrapped (encrypted) DEK',
      'On read, the app sends the wrapped DEK to KMS Decrypt',
      'KMS checks the caller\'s permissions and returns the plaintext DEK',
      'The app decrypts the file locally and discards the plaintext DEK again',
    ],
    explanation:
      'The **KEK never leaves KMS**; only small data keys cross the wire, so bulk data is encrypted locally at full speed. Storing the **wrapped DEK** next to the ciphertext means anyone reading the data still needs KMS permission to unwrap it. Disabling the KEK or revoking access to it therefore cuts off all of that data without touching the stored ciphertext.',
  },
  {
    id: 'seq-terraform-plan-apply',
    track: 'infra',
    objective: 'auto-iac',
    lessonId: 'infra-auto-iac',
    title: 'Terraform plan and apply with remote state',
    prompt: 'A team uses Terraform with a remote backend that supports locking. Order the steps of a change.',
    steps: [
      'terraform init configures the remote backend and downloads providers and modules',
      'terraform plan -out=tfplan refreshes real resources and saves the proposed diff',
      'A reviewer approves the saved plan, e.g. in the pull request',
      'terraform apply tfplan acquires the state lock in the backend',
      'Terraform calls provider APIs to create, update or destroy resources in dependency order',
      'The new state is written to the remote backend',
      'The state lock is released',
    ],
    explanation:
      '`init` must run first because plan and apply need the backend and providers. Applying a **saved plan** guarantees what was reviewed is exactly what runs. The **lock** is held for the whole apply so no concurrent run can write conflicting state, and it is only released after the updated state is persisted.',
  },
  {
    id: 'seq-canary-rollback',
    track: 'infra',
    objective: 'auto-delivery',
    lessonId: 'infra-auto-delivery',
    title: 'Canary release with automated rollback',
    prompt: 'A progressive delivery controller runs a canary that turns out to be bad. Order the steps.',
    steps: [
      'The new version is deployed as a canary alongside the stable version',
      'A small slice of traffic, e.g. 5%, is routed to the canary',
      'Automated analysis compares canary error rate and latency with the stable baseline',
      'The canary\'s error rate breaches the configured threshold',
      'The controller aborts the rollout and routes all traffic back to stable',
      'The canary is scaled down, the release is marked failed and the team is alerted',
    ],
    explanation:
      'A canary limits **blast radius**: only a small slice of users sees the new version while it is measured. Comparing against a **baseline** turns rollback into an objective, automated decision. Traffic is shifted back **before** cleanup so users recover as fast as possible.',
  },
  {
    id: 'seq-transactional-outbox',
    track: 'infra',
    objective: 'dist-messaging',
    lessonId: 'infra-dist-messaging',
    title: 'Transactional outbox',
    prompt: 'An order service must save an order and publish an `OrderCreated` event reliably. Order the steps.',
    steps: [
      'The service begins a database transaction',
      'It inserts the order row and an OrderCreated row into the outbox table',
      'The transaction commits, making both rows durable atomically',
      'A relay (poller or CDC such as Debezium) reads the new outbox row',
      'The relay publishes to the broker and, once the broker acks, marks the row sent or advances its offset',
      'Consumers process the event idempotently, de-duplicating by event ID',
    ],
    explanation:
      'Writing the event in the **same transaction** as the business data removes the dual-write problem: either both exist or neither does. The relay publishes **after** commit and records progress **after** publishing, so a crash causes a re-send, never a loss. That makes delivery **at-least-once**, which is why consumers must be idempotent.',
  },
  {
    id: 'seq-expand-contract-migration',
    track: 'infra',
    objective: 'data-databases',
    lessonId: 'infra-data-databases',
    title: 'Zero-downtime column rename (expand/contract)',
    prompt: 'You need to replace column `fullname` with `display_name` without downtime. Order the steps.',
    steps: [
      'Add the new display_name column as nullable, without touching the old column',
      'Deploy app code that writes to both fullname and display_name',
      'Backfill display_name for existing rows in small batches',
      'Switch reads to display_name and verify the data matches',
      'Deploy app code that no longer writes fullname',
      'Drop the fullname column',
    ],
    explanation:
      'The **expand** step is backward compatible, so old and new app versions can run side by side during a rolling deploy. **Dual writes** must start before the backfill, otherwise rows written during the backfill would be missed. The **contract** step (dropping the column) happens only once no running code reads or writes it.',
  },
  {
    id: 'seq-system-design-interview',
    track: 'infra',
    objective: 'craft-system-design',
    lessonId: 'infra-craft-system-design',
    title: 'System design interview flow',
    prompt: 'You have 45 minutes to design a URL shortener. Order how a strong candidate structures the session.',
    steps: [
      'Clarify functional and non-functional requirements and scope',
      'Estimate scale: QPS, read/write ratio, storage and bandwidth',
      'Propose a high-level design: core API, data model, main components and data flow',
      'Deep-dive into the hardest components, e.g. ID generation, caching and sharding',
      'Discuss trade-offs, bottlenecks and failure modes, and how you would evolve the design',
    ],
    explanation:
      'Requirements and **numbers** drive every later choice, so they come first. The **high-level design** (API, data model, components) gives a working end-to-end answer and tells you where the **deep dives** are worth spending time. Closing on **trade-offs and failure modes** shows senior judgement rather than a single happy-path design.',
  },
  {
    id: 'seq-circuit-breaker',
    track: 'infra',
    objective: 'dist-patterns',
    lessonId: 'infra-dist-patterns',
    title: 'Circuit breaker state transitions',
    prompt: 'A downstream dependency fails and later recovers. Order the circuit breaker\'s behaviour.',
    steps: [
      'In the Closed state, calls pass through and failures are counted',
      'The failure rate exceeds the threshold and the breaker trips to Open',
      'While Open, calls fail fast without contacting the dependency',
      'The reset timeout elapses and the breaker moves to Half-open',
      'A limited number of trial requests are allowed through',
      'The trial requests succeed and the breaker returns to Closed with counters reset',
    ],
    explanation:
      'The breaker starts **Closed** and only trips to **Open** after enough failures. Open fails fast to protect both the caller and the struggling dependency. After a cool-down, **Half-open** probes with a few requests: success closes the circuit, while a failure would send it straight back to Open.',
  },
  {
    id: 'seq-multi-region-failover',
    track: 'infra',
    objective: 'rel-resilience',
    lessonId: 'infra-rel-resilience',
    title: 'Multi-region failover runbook',
    prompt: 'An active-passive service loses its primary region. Order the runbook steps.',
    steps: [
      'Health checks and SLO burn across several signals confirm a regional failure; an incident is declared',
      'The incident commander decides to fail over after checking replication lag against the RPO',
      'Writes in the primary region are fenced off to prevent split-brain',
      'The database replica in the secondary region is promoted to primary',
      'Global DNS or the global load balancer shifts traffic to the secondary region',
      'SLIs are verified as recovered in the secondary region and status is communicated',
      'Once repaired, the old primary is resynced from the new primary before any failback',
    ],
    explanation:
      'Failover is a deliberate decision: confirm the failure and know how much data (**RPO**) you may lose. **Fencing** the old primary before promotion guarantees there is only one writer. Traffic moves only after the new primary can accept writes, and failback requires a full **resync** because the old region\'s data is now stale.',
  },
];
