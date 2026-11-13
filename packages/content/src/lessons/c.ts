import type { Lesson } from '../types';

export const lessonsC: Lesson[] = [
  // ───────────────────────────── Stage 5 ─────────────────────────────
  {
    id: 'pod-security-and-least-privilege',
    title: 'Pod Security and Least Privilege',
    stage: 5,
    order: 2,
    objectives: ['co-security'],
    scope: 'kcna',
    estMinutes: 25,
    summary:
      'Harden what a container is allowed to do with securityContext, enforce cluster-wide baselines with Pod Security Standards and Pod Security Admission, and keep images trustworthy.',
    what: `RBAC decides **who may call the API**. Pod security decides **what a running container may do to the node it lands on**. They are separate layers, and you need both.

Three tools cover this lesson:

- **securityContext** — fields on a Pod or container spec that set the Linux identity and privileges of the process: user/group IDs, Linux capabilities, read-only root filesystem, privilege escalation, seccomp profile.
- **Pod Security Standards (PSS)** — three named policy levels defined by the Kubernetes project: \`privileged\`, \`baseline\` and \`restricted\`.
- **Pod Security Admission (PSA)** — the built-in admission controller that checks Pods against a PSS level, configured per namespace with labels. It replaced **PodSecurityPolicy**, which was removed in Kubernetes 1.25.

Add supply-chain basics on top: where images come from, whether they are scanned, and whether you run exactly the bytes you tested.`,
    why: `A container is just a process with namespaces and cgroups around it. If it runs as root with extra capabilities, or mounts the host filesystem, a single application bug can turn into control of the whole node — and from the node, often the whole cluster (kubelet credentials, other Pods' Secrets).

**Least privilege** shrinks the blast radius: if the process is compromised, the attacker gets a non-root user with no capabilities, a read-only filesystem and a syscall filter. Most applications need none of the defaults they get, so removing them is cheap insurance.`,
    problem: `Out of the box, Kubernetes is permissive. A Pod with no securityContext runs as whatever user the image specifies (often root), with the runtime's default capability set, and nothing stops a manifest from asking for \`privileged: true\`, \`hostNetwork: true\` or a \`hostPath\` mount of \`/\`.

Relying on every team to remember the right fields does not scale. You need a **cluster-side guardrail** that rejects dangerous Pods no matter who submits them — that is what Pod Security Admission provides.`,
    how: `Follow a Pod create request through the security layers:

- **1. Authentication and RBAC** — the API server confirms the caller may create Pods in that namespace.
- **2. Pod Security Admission** — the admission controller reads the namespace labels, e.g. \`pod-security.kubernetes.io/enforce: restricted\`. It compares the Pod spec against that level. In \`enforce\` mode a violation rejects the request; \`warn\` returns a warning to the client; \`audit\` records it in the audit log. You can set all three modes on one namespace with different levels.
- **3. Other admission policies (optional)** — ValidatingAdmissionPolicy or webhooks such as OPA Gatekeeper or Kyverno can enforce rules PSS does not cover (allowed registries, required labels).
- **4. Scheduling and kubelet** — the kubelet passes the securityContext to the container runtime, which starts the process with the requested UID, capabilities, seccomp profile and filesystem flags.
- **5. Runtime** — the kernel enforces it. A process that tries to escalate, write to a read-only root filesystem or call a blocked syscall fails.

PSA checks Pods, but the error usually surfaces on the **controller**: a Deployment is accepted, yet its ReplicaSet cannot create Pods, and the reason shows up in the ReplicaSet's events.`,
    components: [
      { name: 'securityContext', description: 'Pod-level (`spec.securityContext`) and container-level (`containers[].securityContext`) settings. Container-level values override Pod-level ones for the same field.' },
      { name: 'Pod Security Standards', description: '`privileged` (unrestricted), `baseline` (blocks known privilege escalations such as hostNetwork, hostPath, privileged containers) and `restricted` (baseline plus hardening: non-root, drop ALL capabilities, no privilege escalation, seccomp).' },
      { name: 'Pod Security Admission', description: 'Built-in admission controller (stable since 1.25). Configured with namespace labels `pod-security.kubernetes.io/<mode>: <level>` where mode is `enforce`, `audit` or `warn`.' },
      { name: 'Linux capabilities', description: 'Root\'s powers split into units such as `NET_ADMIN` or `SYS_ADMIN`. Least privilege means `drop: ["ALL"]` and add back only what is needed.' },
      { name: 'seccomp', description: 'A kernel syscall filter. `seccompProfile.type: RuntimeDefault` applies the container runtime\'s default profile, which blocks rarely needed, risky syscalls.' },
      { name: 'Image supply chain', description: 'Trusted registries, vulnerability scanning in CI, pinning images by digest, signing images and verifying signatures at admission.' },
    ],
    misconceptions: [
      { myth: 'RBAC already makes my Pods secure.', reality: 'RBAC controls API access. It says nothing about whether the container process runs as root or can mount the host filesystem. That is the job of securityContext and Pod Security Admission.' },
      { myth: 'PodSecurityPolicy is how you enforce Pod security.', reality: 'PodSecurityPolicy was deprecated in 1.21 and **removed in 1.25**. The built-in replacement is Pod Security Admission with the Pod Security Standards.' },
      { myth: 'Containers are isolated, so running as root inside one is harmless.', reality: 'Without user namespaces, UID 0 in the container is UID 0 on the host kernel. Combined with a capability, a hostPath mount or a kernel bug, that becomes host root.' },
      { myth: 'A pinned tag like `nginx:1.27` always gives the same image.', reality: 'Tags are mutable pointers and can be re-pushed. Only a digest (`nginx@sha256:...`) identifies exact image content.' },
    ],
    example: {
      title: 'A namespace enforcing restricted, and a Pod that passes it',
      description: `The namespace enforces \`restricted\` and also warns on it, so \`kubectl apply\` prints a warning before rejection becomes a surprise. The Pod sets every field the restricted level requires. The image is assumed to listen on an unprivileged port such as 8080.`,
      language: 'yaml',
      code: `apiVersion: v1
kind: Namespace
metadata:
  name: payments
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/warn: restricted
---
apiVersion: v1
kind: Pod
metadata:
  name: api
  namespace: payments
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 10001
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: api
      image: registry.example.com/payments/api@sha256:<digest>
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop: ["ALL"]`,
    },
    exercise: {
      prompt: `A Deployment in a namespace labelled \`pod-security.kubernetes.io/enforce: baseline\` contains a container with \`securityContext.privileged: true\`. \`kubectl apply\` succeeds, yet \`kubectl get pods\` shows nothing for it.

Explain what happened, where you would see the error, and two ways to resolve it.`,
      solution: `The Deployment object itself is not a Pod, so it is admitted. Its ReplicaSet then tries to create Pods, and **Pod Security Admission rejects each one** because privileged containers violate \`baseline\`.

The error appears in the ReplicaSet's events: \`kubectl describe rs <name>\` shows a \`FailedCreate\` event mentioning the violated policy.

Fixes, in order of preference:

- Remove \`privileged: true\` and grant only the specific capability or setting the app truly needs (if baseline allows it).
- If the workload genuinely needs privilege (for example a node-level agent), run it in a dedicated namespace labelled \`privileged\`, tightly restricted by RBAC.`,
    },
    faq: [
      { q: 'Which PSS level should I start with?', a: 'Use `restricted` for ordinary application namespaces and `baseline` where a workload needs something restricted forbids. Reserve `privileged` for system namespaces running node agents (CNI, storage, monitoring daemons).' },
      { q: 'How can I roll out restricted without breaking existing apps?', a: 'Label the namespace with `warn` and `audit` set to `restricted` while `enforce` stays at a looser level. Fix the warnings, then raise `enforce`. You can also run `kubectl label --dry-run=server` on the namespace to see which existing Pods would violate a level.' },
      { q: 'Does PSA check Deployments?', a: 'Enforcement applies to Pods. For workload resources, `warn` and `audit` also evaluate the Pod template so you get early feedback, but the actual rejection happens when the controller creates Pods.' },
    ],
    keyTerms: ['securityContext', 'Pod Security Standards', 'Pod Security Admission', 'least privilege', 'runAsNonRoot', 'Linux capabilities', 'seccomp', 'image digest'],
    deeper: `PSA is deliberately simple: three fixed levels, namespace granularity. Organisations needing custom rules (only images from our registry, every Pod must have resource limits) add **ValidatingAdmissionPolicy** (CEL expressions evaluated in the API server, stable since 1.30) or a policy engine webhook such as OPA Gatekeeper or Kyverno.

On the supply-chain side, the common building blocks are an **SBOM** (a list of what is inside the image), **signatures** (for example with Sigstore's cosign) verified by an admission policy, and **runtime detection** with a tool such as Falco, which watches syscalls for suspicious behaviour after the container has started.`,
    references: [
      { title: 'Pod Security Standards', url: 'https://kubernetes.io/docs/concepts/security/pod-security-standards/' },
      { title: 'Pod Security Admission', url: 'https://kubernetes.io/docs/concepts/security/pod-security-admission/' },
      { title: 'Configure a Security Context for a Pod or Container', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/security-context/' },
    ],
  },
  {
    id: 'kubectl-and-cluster-administration',
    title: 'kubectl and Cluster Administration',
    stage: 5,
    order: 3,
    objectives: ['kf-admin'],
    scope: 'kcna',
    estMinutes: 30,
    summary:
      'How kubectl finds and talks to a cluster through kubeconfig, the core verbs, how clusters are built and upgraded with kubeadm and version-skew rules, how the API is versioned, and how CRDs and operators extend it.',
    what: `**kubectl** is a client for the Kubernetes API. Every command becomes one or more HTTPS requests to kube-apiserver; kubectl has no special back door. Anything kubectl does, a CI job, Helm or a controller can do with the same API.

Cluster administration around it covers:

- **kubeconfig** — the file that tells kubectl which clusters exist, which credentials to use and which pairing (context) is active.
- **Cluster lifecycle** — creating clusters (for example with **kubeadm**), upgrading them one minor version at a time, and respecting **version skew** rules between components.
- **The API surface** — API groups and versions, and extending it with **CustomResourceDefinitions (CRDs)** and **operators**.`,
    why: `Almost every KCNA topic is reached through kubectl, so fluency is a multiplier. Equally, misunderstanding kubeconfig is how people run \`kubectl delete\` against production while thinking they are in staging.

Knowing the API's structure (groups, versions, CRDs) explains why \`apiVersion: apps/v1\` is required on a Deployment, why some features say "beta", and how tools like Argo CD or cert-manager add new resource types that kubectl handles as if they were built in.`,
    problem: `An administrator works with several clusters, several identities and many namespaces. Without a structured way to switch between them, commands go to the wrong place. Clusters also cannot be frozen: Kubernetes ships roughly three minor releases a year and each minor version is supported for about a year, so upgrades are routine, and they must not break running components that are temporarily on different versions.`,
    how: `Trace \`kubectl get pods -n shop\`:

- **1. Load kubeconfig.** kubectl reads \`--kubeconfig\` if given, else the \`KUBECONFIG\` environment variable, else \`~/.kube/config\`.
- **2. Pick the context.** \`current-context\` names a **context**, which ties together a **cluster** (API server URL and CA certificate), a **user** (client certificate, token or exec plugin) and optionally a default **namespace**. \`-n shop\` overrides the namespace.
- **3. Discover the API.** kubectl maps \`pods\` to the core group, version \`v1\`, using API discovery (cached locally).
- **4. Send the request.** \`GET /api/v1/namespaces/shop/pods\` over TLS with your credentials.
- **5. Server side.** The API server authenticates, authorizes (RBAC), and for reads returns objects from etcd. For writes, admission runs too.
- **6. Format.** kubectl prints a table, or YAML/JSON with \`-o yaml\` / \`-o json\`.

**API paths** reveal the grouping: core resources live under \`/api/v1\`; everything else under \`/apis/<group>/<version>\`, e.g. \`/apis/apps/v1\` for Deployments. Versions progress **alpha** (\`v1alpha1\`, off by default, may change or vanish), **beta** (\`v1beta1\`, more stable; new beta APIs are off by default) and **stable/GA** (\`v1\`).

**Upgrades with kubeadm**: upgrade the control plane first (\`kubeadm upgrade plan\`, then \`kubeadm upgrade apply\`), then each node in turn (drain, upgrade kubeadm/kubelet, uncordon). Skip no minor versions. Version skew rules allow the kubelet to be older than the API server (up to three minor versions) but **never newer**, and kubectl to be within one minor version of the API server, older or newer.`,
    components: [
      { name: 'kubeconfig', description: 'YAML file with `clusters`, `users`, `contexts` and `current-context`. Managed with `kubectl config get-contexts`, `current-context`, `use-context` and `view`.' },
      { name: 'kubectl verbs', description: 'Read: `get`, `describe`, `logs`, `explain`, `api-resources`. Write declaratively: `apply -f`. Write imperatively: `create`, `run`, `expose`, `scale`, `set image`, `label`, `delete`. Operate: `rollout`, `drain`, `cordon`, `uncordon`.' },
      { name: 'kubeadm', description: 'Upstream tool that bootstraps a cluster (`kubeadm init`, `kubeadm join`) and upgrades it (`kubeadm upgrade`). It does not provision machines or install a CNI plugin.' },
      { name: 'API groups and versions', description: 'Core group (`v1`: Pods, Services, ConfigMaps) and named groups (`apps/v1`, `batch/v1`, `networking.k8s.io/v1`, `rbac.authorization.k8s.io/v1`).' },
      { name: 'CustomResourceDefinition', description: 'Registers a new resource type with the API server. Instances (custom resources) are stored in etcd and served like built-in objects, but nothing acts on them until a controller does.' },
      { name: 'Operator', description: 'A custom controller plus CRDs that encodes operational knowledge for one application (e.g. a database): it watches custom resources and reconciles real infrastructure toward them.' },
    ],
    misconceptions: [
      { myth: '`kubectl config use-context` changes something in the cluster.', reality: 'It only edits your local kubeconfig file. The cluster is unaware of contexts.' },
      { myth: 'Creating a CRD gives you a working feature.', reality: 'A CRD only teaches the API server to store and validate a new type. Behaviour comes from a controller (often an operator) that watches those objects.' },
      { myth: 'You can upgrade directly from 1.29 to 1.32 if you are careful.', reality: 'Control-plane upgrades go one minor version at a time: 1.29 → 1.30 → 1.31 → 1.32.' },
      { myth: 'A newer kubelet on a node is fine as long as it is close.', reality: 'The kubelet must not be newer than kube-apiserver. Upgrade the control plane first, then nodes.' },
    ],
    example: {
      title: 'Orienting yourself in an unfamiliar cluster',
      description: 'A safe, read-only sequence to run before touching anything: confirm where you are, what the server supports, and how a field is defined.',
      language: 'bash',
      code: `# Where am I pointed?
kubectl config get-contexts
kubectl config current-context

# Switch, and make "staging" the default namespace for this context
kubectl config use-context staging-cluster
kubectl config set-context --current --namespace=staging

# What does this API server offer?
kubectl version
kubectl api-resources          # every resource type, its short name, group, namespaced?
kubectl api-versions           # every group/version served

# How is a field defined? (docs from the server's own schema)
kubectl explain deployment.spec.strategy

# Custom resources show up like built-ins
kubectl get crds`,
    },
    exercise: {
      prompt: `Your kubeconfig has contexts \`dev\` and \`prod\`. A colleague says "I ran \`kubectl delete deploy web\` and it deleted prod's web, but I was sure I was on dev." Give the two commands that would have prevented this, and one habit that makes it less likely.`,
      solution: `- \`kubectl config current-context\` before any destructive command shows which context is active.
- \`kubectl --context dev delete deploy web\` targets a context explicitly for one command, ignoring \`current-context\`.

Habits: keep production credentials in a separate kubeconfig file selected via \`KUBECONFIG\` only when needed, show the current context in your shell prompt, and use \`--dry-run=server\` or \`kubectl diff\` before changes. RBAC that denies delete to day-to-day identities in prod is the cluster-side safety net.`,
    },
    faq: [
      { q: 'Is kubectl apply the same as kubectl create?', a: '`create` is imperative: it fails if the object exists. `apply` is declarative: it creates or updates the object to match the file and tracks what you previously applied, so it is the right verb for manifests kept in Git.' },
      { q: 'Do I need kubeadm for the exam?', a: 'Know what it is for (bootstrapping and upgrading a conformant cluster) and the upgrade order. Managed services (EKS, GKE, AKS) and local tools (kind, minikube) are other ways to get a cluster.' },
      { q: 'What is the difference between an operator and a Helm chart?', a: 'A Helm chart installs manifests once per install/upgrade. An operator keeps running and continuously reconciles, handling day-2 tasks such as backups, failover or version upgrades of the application it manages.' },
    ],
    keyTerms: ['kubeconfig', 'context', 'API group', 'kubeadm', 'version skew', 'CustomResourceDefinition', 'operator', 'kubectl explain'],
    deeper: `API deprecation follows a published policy: once an API version is GA, it is not removed within the same major version, and beta versions get a deprecation period of several releases before removal. When an API version is removed (as happened to \`extensions/v1beta1\` Ingress in 1.22), old manifests fail to apply and must be migrated.

Server-side apply (\`kubectl apply --server-side\`) moves field-ownership tracking into the API server via \`managedFields\`, so several actors (you, an HPA, an operator) can own different fields of one object without overwriting each other.`,
    references: [
      { title: 'kubectl reference', url: 'https://kubernetes.io/docs/reference/kubectl/' },
      { title: 'Version Skew Policy', url: 'https://kubernetes.io/releases/version-skew-policy/' },
      { title: 'Custom Resources', url: 'https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/' },
    ],
  },
  {
    id: 'troubleshooting-workloads',
    title: 'Troubleshooting Workloads',
    stage: 5,
    order: 4,
    objectives: ['co-troubleshooting'],
    scope: 'kcna',
    estMinutes: 30,
    summary:
      'A repeatable method for diagnosing broken Pods: read the status, describe, check events and logs, and map the common states (Pending, ImagePullBackOff, CrashLoopBackOff, OOMKilled, not Ready) to their causes.',
    what: `Troubleshooting in Kubernetes is mostly **reading what the cluster already told you**. Every controller, the scheduler and the kubelet write their decisions into object status and into **Events**. Your job is to know where to look and how to interpret the common failure states.

This lesson is organised as a field guide: one symptom, the place to look, the usual causes.`,
    why: `Most incidents in a Kubernetes environment show up first as "the Pod is not running" or "the Service returns errors". The faster you map a symptom to the right layer — scheduling, image, process, probe, network — the less time you spend guessing. KCNA questions about troubleshooting nearly always test exactly this mapping.`,
    problem: `A failure can sit in many places: the scheduler could not place the Pod, the kubelet could not pull the image, the process exits immediately, the kernel killed it for memory, a probe fails, or a Service selector matches nothing. The status column alone (\`Pending\`, \`CrashLoopBackOff\`) is a clue, not a diagnosis.`,
    how: `Work outside-in, from cheapest signal to most detailed:

- **1. \`kubectl get pods -o wide\`** — status, restarts, READY count, node. Many restarts plus \`CrashLoopBackOff\` points at the process; \`Pending\` points at scheduling or volumes; \`0/1 READY\` but \`Running\` points at a readiness probe.
- **2. \`kubectl describe pod <name>\`** — container state and **last state** (with exit code and reason such as \`OOMKilled\` or \`Error\`), conditions, and the **Events** section at the bottom.
- **3. \`kubectl get events\`** (optionally \`--sort-by=.metadata.creationTimestamp\`) — namespace-wide view, useful when the Pod never got created (look at ReplicaSet events too). Events are retained only for a limited time (one hour by default).
- **4. \`kubectl logs <pod>\`** — application output. Add \`--previous\` to see the crashed instance's logs and \`-c <container>\` for multi-container Pods.
- **5. Check the surroundings** — Service selector vs Pod labels (\`kubectl get endpointslices\`), referenced ConfigMaps/Secrets/PVCs exist, node health (\`kubectl get nodes\`, \`kubectl describe node\`).

The symptom map:

- **Pending** — scheduler event \`FailedScheduling\`: insufficient CPU/memory for the requests, nodeSelector/affinity matches no node, untolerated taint, or an unbound PVC.
- **ErrImagePull / ImagePullBackOff** — wrong image name or tag, private registry without \`imagePullSecrets\`, or registry unreachable. Kubelet retries with increasing back-off.
- **CrashLoopBackOff** — the container starts and exits repeatedly; kubelet waits longer between restarts. Read \`logs --previous\` and the exit code. Common: bad config, missing env var or file, wrong command, failing liveness probe.
- **OOMKilled** (exit code 137) — the container exceeded its memory limit; raise the limit or fix the leak.
- **CreateContainerConfigError** — a referenced ConfigMap or Secret (or key) does not exist.
- **Running but not Ready** — readiness probe failing; the Pod is removed from Service endpoints.`,
    components: [
      { name: 'Pod status and conditions', description: '`phase` (Pending, Running, Succeeded, Failed, Unknown), container states (Waiting, Running, Terminated) with reasons, and conditions such as `PodScheduled` and `Ready`.' },
      { name: 'Events', description: 'Short-lived records emitted by components: scheduler (`FailedScheduling`), kubelet (`Pulling`, `BackOff`, `Unhealthy`), controllers (`FailedCreate`). Shown at the end of `kubectl describe`.' },
      { name: 'Container logs', description: 'stdout/stderr captured by the runtime and served by the kubelet. `--previous` returns the last terminated instance.' },
      { name: 'Exit codes', description: '`0` success, `1` generic app error, `137` = killed by SIGKILL (often OOMKilled), `143` = SIGTERM (graceful stop).' },
      { name: 'Node view', description: '`kubectl describe node` shows conditions (MemoryPressure, DiskPressure, Ready), taints, and allocated requests versus allocatable capacity.' },
    ],
    misconceptions: [
      { myth: 'CrashLoopBackOff is a Kubernetes bug or a special kind of error.', reality: 'It is a waiting state: the container keeps exiting and the kubelet backs off between restarts. The real cause is in the logs of the previous instance or a failing liveness probe.' },
      { myth: 'A Pending Pod means the image is still downloading.', reality: 'Image pulls happen after scheduling, while the Pod already has a node. A Pod stuck in Pending usually has not been scheduled; check for `FailedScheduling` events.' },
      { myth: 'Scheduling is based on what Pods actually use.', reality: 'The scheduler compares **requests** to node allocatable capacity. A node can be nearly idle and still have no room if its requests are fully booked.' },
    ],
    example: {
      title: 'Diagnosing a CrashLoopBackOff end to end',
      description: 'The restart count and back-off point at the process, `describe` gives the exit code, and the previous container\'s logs give the cause.',
      language: 'text',
      code: `$ kubectl get pods
NAME                     READY   STATUS             RESTARTS      AGE
api-6f9c7d8b5d-q2xkp     0/1     CrashLoopBackOff   5 (40s ago)   4m

$ kubectl describe pod api-6f9c7d8b5d-q2xkp
...
    State:          Waiting
      Reason:       CrashLoopBackOff
    Last State:     Terminated
      Reason:       Error
      Exit Code:    1
...
Events:
  Normal   Pulled   3m    kubelet  Container image "shop/api:2.3.0" already present on machine
  Warning  BackOff  20s   kubelet  Back-off restarting failed container api in pod api-6f9c7d8b5d-q2xkp

$ kubectl logs api-6f9c7d8b5d-q2xkp --previous
FATAL: environment variable DATABASE_URL is not set

# Cause: missing configuration. Fix the Deployment's env / envFrom and re-apply.`,
    },
    exercise: {
      prompt: `For each symptom, name the first command you would run and the most likely cause:

- a) Pod \`Pending\` for 10 minutes; describe shows \`0/3 nodes are available: 3 Insufficient memory\`.
- b) Pod \`Running\`, READY \`0/1\`, Service returns 503.
- c) Last state \`Terminated\`, reason \`OOMKilled\`.`,
      solution: `- a) Already found via \`kubectl describe pod\`. The memory **request** exceeds free allocatable memory on every node. Lower the request, free capacity, or add nodes (a Cluster Autoscaler would do this automatically).
- b) \`kubectl describe pod\` — look for \`Unhealthy\` events from a failing **readiness probe**. Not-ready Pods are removed from the Service's endpoints, so the Service has no backends. Check \`kubectl get endpointslices\` to confirm.
- c) \`kubectl describe pod\` confirms exit code 137. The container hit its **memory limit**; raise the limit to match real usage or fix the leak, then check \`kubectl top pod\` if metrics-server is installed.`,
    },
    faq: [
      { q: 'Why do I get no logs from a crashing container?', a: 'The current instance may not have written anything yet. Use `kubectl logs <pod> --previous` to read the instance that crashed. If both are empty, the process may fail before logging: check the command/args and the exit code in `describe`.' },
      { q: 'Where are events for a Pod that was never created?', a: 'On its controller. `kubectl describe replicaset <name>` (or `describe deployment`) shows `FailedCreate` events, for example from a quota or Pod Security Admission rejection.' },
      { q: 'How long are events kept?', a: 'Only briefly — the API server default is one hour. For history, ship events and logs to an external system.' },
    ],
    keyTerms: ['kubectl describe', 'Events', 'Pending', 'ImagePullBackOff', 'CrashLoopBackOff', 'OOMKilled', 'exit code 137', 'FailedScheduling'],
    deeper: `Network problems need a different toolkit: test DNS from inside the cluster (\`nslookup my-svc.my-ns.svc.cluster.local\` from a debug Pod), compare a Service's \`selector\` with Pod labels, check that \`targetPort\` matches the container port, and remember that a NetworkPolicy selecting a Pod denies all traffic not explicitly allowed in that direction.

For node-level failures (\`NotReady\`), the usual suspects are the kubelet service, the container runtime, disk pressure or a broken CNI plugin, investigated on the node itself (for example with \`journalctl -u kubelet\`).`,
    references: [
      { title: 'Debug Pods', url: 'https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/' },
      { title: 'Troubleshooting Applications', url: 'https://kubernetes.io/docs/tasks/debug/debug-application/' },
      { title: 'Pod Lifecycle', url: 'https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/' },
    ],
  },
  // ───────────────────────────── Stage 6 ─────────────────────────────
  {
    id: 'cicd-and-gitops',
    title: 'CI/CD and GitOps',
    stage: 6,
    order: 1,
    objectives: ['cad-delivery'],
    scope: 'kcna',
    estMinutes: 25,
    summary:
      'Continuous integration builds and tests every change; continuous delivery/deployment gets it to environments. GitOps makes Git the source of truth and lets an in-cluster agent such as Argo CD or Flux pull and reconcile it.',
    what: `**Continuous Integration (CI)** merges small changes frequently and validates each one automatically: build, unit tests, linting, image build, vulnerability scan, push to a registry.

**Continuous Delivery** keeps every validated change in a releasable state, with a final (possibly manual) approval. **Continuous Deployment** removes the manual step: every change that passes the pipeline goes to production.

**GitOps** is a way of doing the deployment half. The desired state of the system lives declaratively in Git, and a software agent running next to the system continuously pulls that state and reconciles reality toward it. The OpenGitOps project (under the CNCF) captures it as four principles:

- **Declarative** — the system's desired state is expressed declaratively.
- **Versioned and immutable** — desired state is stored so that it is versioned and retains complete history (Git is the usual choice).
- **Pulled automatically** — agents pull the desired state from the source.
- **Continuously reconciled** — agents observe actual state and act to converge it on desired state.`,
    why: `Kubernetes is already a reconciliation engine for objects inside the cluster. GitOps extends the same idea one level up: from "Git says X" to "the cluster has X". You get an audit trail for free (every change is a commit with an author and review), rollback is \`git revert\`, and **drift** — someone running \`kubectl edit\` by hand — is detected and corrected.`,
    problem: `A classic push pipeline ends with a CI job running \`kubectl apply\` against the cluster. That works, but:

- the CI system needs **write credentials for every cluster**, a juicy target;
- after the job finishes nobody watches for drift; manual changes silently persist;
- the "real" state is whatever ran last, not something you can read in one place.

GitOps inverts the direction: the cluster pulls, so cluster credentials stay inside the cluster.`,
    how: `Follow one change through a GitOps setup with two repositories, one for application code and one for configuration:

- **1. Developer opens a pull request** in the app repo. CI runs tests and builds an image, tagging it (for example with the commit SHA) and pushing it to the registry.
- **2. Config change.** CI (or an image-automation tool) opens a PR in the config repo updating the image reference in a manifest, Helm values file or Kustomize overlay. Humans review and merge.
- **3. Agent detects the change.** Argo CD or Flux, running in the cluster, polls the repo (or receives a webhook) and sees a new commit.
- **4. Render and compare.** The agent renders manifests (plain YAML, Kustomize or Helm) and diffs them against the live objects.
- **5. Sync.** It applies the difference through the Kubernetes API. Deployments then roll out as usual.
- **6. Keep watching.** If someone changes a live object by hand, the agent reports it as **OutOfSync** and, with automatic self-heal enabled, reverts it to what Git says.

Rollback is a revert commit in the config repo; the agent syncs it like any other change.`,
    components: [
      { name: 'CI pipeline', description: 'Build, test, scan, package. Runs in tools such as GitHub Actions, GitLab CI, Jenkins or Tekton. Its output is an immutable artifact: a container image.' },
      { name: 'Container registry', description: 'Stores the images CI produces; the deployment references them by tag or digest.' },
      { name: 'Config repository', description: 'Declarative desired state per environment: manifests, Helm values, Kustomize overlays.' },
      { name: 'Argo CD', description: 'CNCF graduated GitOps tool. An `Application` resource points at a repo path and a destination cluster/namespace; a web UI shows sync and health status.' },
      { name: 'Flux', description: 'CNCF graduated GitOps toolkit of controllers: `GitRepository` sources plus `Kustomization` and `HelmRelease` resources that reconcile them.' },
    ],
    misconceptions: [
      { myth: 'GitOps means storing YAML in Git.', reality: 'Storing YAML in Git is version control. GitOps also requires an agent that **pulls automatically** and **continuously reconciles**, correcting drift.' },
      { myth: 'Continuous Delivery and Continuous Deployment are the same thing.', reality: 'Delivery keeps every change deployable but may require a manual release decision. Deployment releases every passing change automatically.' },
      { myth: 'With GitOps you no longer need CI.', reality: 'GitOps handles deploying desired state. You still need CI to test code and build the images that the desired state references.' },
    ],
    example: {
      title: 'An Argo CD Application with automatic sync',
      description: 'This custom resource tells Argo CD to keep the `shop` namespace in sync with the `envs/prod` path of the config repo, prune objects deleted from Git, and undo manual drift.',
      language: 'yaml',
      code: `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: shop-prod
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://git.example.com/platform/shop-config.git
    targetRevision: main
    path: envs/prod
  destination:
    server: https://kubernetes.default.svc
    namespace: shop
  syncPolicy:
    automated:
      prune: true
      selfHeal: true`,
    },
    diagram: 'gitops-flow',
    exercise: {
      prompt: `An engineer runs \`kubectl scale deploy web --replicas=10\` during an incident in a cluster managed by Argo CD with \`selfHeal: true\`. Git says \`replicas: 3\`. What happens, and what is the GitOps-correct way to scale?`,
      solution: `Argo CD detects that the live Deployment differs from Git (**OutOfSync**) and, because self-heal is on, re-applies \`replicas: 3\` shortly afterwards. The manual change is undone.

The GitOps way is to change \`replicas\` in the config repo and merge it, so the change is reviewed, recorded and reconciled. If load varies, use a HorizontalPodAutoscaler and leave \`replicas\` out of the Git-managed manifest (or tell the tool to ignore that field) so the HPA and GitOps do not fight.`,
    },
    faq: [
      { q: 'Push or pull — which is GitOps?', a: 'OpenGitOps requires the desired state to be **pulled automatically** by an agent. A pipeline that pushes with `kubectl apply` can deploy from Git, but it is a push-based CD pipeline, not GitOps by that definition.' },
      { q: 'Argo CD or Flux?', a: 'Both are CNCF graduated and implement the same principles. Argo CD is application-centric with a rich UI; Flux is a set of composable controllers driven by CRDs. For KCNA, recognise both as GitOps tools.' },
      { q: 'Where do Secrets go if everything is in Git?', a: 'Never commit plain Secrets. Common patterns are encrypting them before commit (e.g. Sealed Secrets or SOPS) or referencing an external secret store via an operator such as External Secrets.' },
    ],
    keyTerms: ['continuous integration', 'continuous delivery', 'continuous deployment', 'GitOps', 'OpenGitOps', 'drift', 'Argo CD', 'Flux'],
    deeper: `Large organisations often run one Argo CD or Flux instance per cluster (simple, isolated) or a central one managing many clusters (single pane of glass, but a high-value target). Progressive-delivery tools integrate with GitOps: Argo Rollouts and Flagger replace a Deployment's simple rolling update with metric-driven canary or blue/green steps, still triggered by a Git change.`,
    references: [
      { title: 'OpenGitOps principles', url: 'https://opengitops.dev/' },
      { title: 'Argo CD documentation', url: 'https://argo-cd.readthedocs.io/' },
      { title: 'Flux documentation', url: 'https://fluxcd.io/flux/' },
    ],
  },
  {
    id: 'helm-and-kustomize',
    title: 'Helm and Kustomize',
    stage: 6,
    order: 2,
    objectives: ['cad-delivery'],
    scope: 'kcna',
    estMinutes: 25,
    summary:
      'Two ways to manage many similar manifests: Helm packages templated charts with releases and rollback; Kustomize layers patches over plain YAML and is built into kubectl.',
    what: `Both tools answer the same question — **how do I deploy almost the same YAML to dev, staging and prod without copy-pasting it?** — with opposite philosophies.

- **Helm** is a **package manager**. A **chart** is a directory of Go-templated manifests plus a \`values.yaml\` of defaults. Installing a chart with your values creates a **release**, which Helm tracks with numbered revisions you can upgrade and roll back. Charts are shared through repositories and OCI registries.
- **Kustomize** is a **template-free overlay** tool. You keep a **base** of ordinary, valid YAML and write **overlays** that patch it (change replicas, image tags, add labels, generate ConfigMaps). It is built into kubectl: \`kubectl apply -k <dir>\`.`,
    why: `Real applications ship as dozens of objects (Deployment, Service, ConfigMap, ServiceAccount, RBAC, Ingress...). Hand-maintaining a copy per environment guarantees drift between them. Templating or patching keeps one definition and states only the differences.

Helm also solved distribution: installing a third-party product such as an ingress controller or Prometheus stack is usually \`helm install\` with a few values.`,
    problem: `Think of a cookie recipe. Helm turns the recipe into a **form with blanks** ("{{ sugar }} grams of sugar") and you fill in a values sheet. Kustomize keeps the **original recipe intact** and clips **sticky notes** onto it ("for prod: double the batch").

Forms are flexible but you cannot bake from a blank form — you must render it first. Sticky notes keep the base readable, but you can only change what a note can express.`,
    how: `**Helm, step by step** (\`helm install web ./chart -f prod-values.yaml\`):

- **1.** Merge values: chart defaults in \`values.yaml\`, then each \`-f\` file, then \`--set\` overrides.
- **2.** Render every file in \`templates/\` with those values (Go templates plus helper functions).
- **3.** Send the rendered objects to the API server.
- **4.** Record the release (name, revision, rendered manifest, values) — by default in a Secret in the release's namespace.
- **5.** \`helm upgrade\` repeats this as revision 2; \`helm rollback web 1\` re-applies revision 1's stored manifest.

Helm 3 and later talk to the API server directly with your kubeconfig credentials. The old in-cluster **Tiller** component of Helm 2 is gone.

**Kustomize, step by step** (\`kubectl apply -k overlays/prod\`):

- **1.** Read \`overlays/prod/kustomization.yaml\`, which lists \`resources\` (e.g. \`../../base\`).
- **2.** Load the base's plain YAML.
- **3.** Apply transformations: \`namePrefix\`, \`labels\`, \`images\` (tag changes), \`replicas\`, and strategic-merge or JSON patches.
- **4.** Run generators such as \`configMapGenerator\`, which appends a content hash to the name so a config change rolls the Pods.
- **5.** Output the final YAML (view it with \`kubectl kustomize overlays/prod\`) and apply it. There is no release record; the cluster objects are the state.`,
    components: [
      { name: 'Chart', description: '`Chart.yaml` (metadata, version), `values.yaml` (defaults), `templates/` (Go-templated manifests), optional dependencies on other charts.' },
      { name: 'Release', description: 'One installed instance of a chart with a name and a revision history. The same chart can be installed many times under different release names.' },
      { name: 'Repository / OCI registry', description: 'Where charts are published: classic HTTP chart repositories (`helm repo add`) or OCI registries (`oci://...`).' },
      { name: 'kustomization.yaml', description: 'Declares resources, patches, transformers and generators for one directory.' },
      { name: 'Base and overlays', description: 'Base = shared plain manifests. Overlay = an environment-specific directory that references the base and patches it.' },
    ],
    misconceptions: [
      { myth: 'Helm runs a server component in the cluster.', reality: 'Only Helm 2 had Tiller. Helm 3+ is a client that uses your kubeconfig and RBAC permissions.' },
      { myth: 'Kustomize needs to be installed separately.', reality: 'A version of Kustomize is embedded in kubectl (`kubectl apply -k`, `kubectl kustomize`). A standalone binary exists for newer features.' },
      { myth: 'You must pick one.', reality: 'They combine. Teams commonly render a third-party Helm chart and patch the result with Kustomize, and both Argo CD and Flux support either.' },
    ],
    example: {
      title: 'The same change, both ways',
      description: 'Goal: run 5 replicas of version 2.4.1 in prod. With Helm you override values; with Kustomize you patch a base.',
      language: 'bash',
      code: `# ---- Helm ----
helm repo add example https://charts.example.com
helm install web example/web --namespace web --create-namespace \\
  --set replicaCount=5
helm list -n web
helm upgrade web example/web -n web -f prod-values.yaml
helm history web -n web
helm rollback web 1 -n web
helm template web example/web -f prod-values.yaml   # render locally, apply nothing

# ---- Kustomize ----
# overlays/prod/kustomization.yaml:
#   resources:
#     - ../../base
#   replicas:
#     - name: web
#       count: 5
#   images:
#     - name: shop/web
#       newTag: "2.4.1"
kubectl kustomize overlays/prod        # preview the rendered YAML
kubectl apply -k overlays/prod`,
    },
    exercise: {
      prompt: `You upgraded a Helm release \`api\` from revision 3 to 4 and error rates rose. Write the commands to (a) see the revisions and (b) go back to revision 3. Then explain how you would achieve the same rollback if the app were deployed with Kustomize via GitOps.`,
      solution: `- a) \`helm history api -n <namespace>\`
- b) \`helm rollback api 3 -n <namespace>\` — this creates a **new** revision 5 whose content equals revision 3.

Kustomize keeps no release history; the history is in Git. Revert the commit that changed the overlay (\`git revert <sha>\`), merge it, and let the GitOps agent sync. (Without GitOps, re-apply the previous overlay with \`kubectl apply -k\`.)`,
    },
    faq: [
      { q: 'Which should a beginner learn first?', a: 'Learn to read and apply Kustomize overlays because it is plain YAML, and learn to install, upgrade and roll back third-party Helm charts because most vendors ship that way. Writing your own complex chart templates can come later.' },
      { q: 'Is `helm template` the same as `helm install`?', a: 'No. `helm template` only renders YAML locally; it does not contact the cluster or create a release.' },
      { q: 'How do I see what a Kustomize overlay will produce?', a: '`kubectl kustomize <dir>` prints the final YAML. `kubectl diff -k <dir>` compares it with the live cluster.' },
    ],
    keyTerms: ['Helm chart', 'values.yaml', 'release', 'helm rollback', 'Kustomize', 'base and overlay', 'patch', 'configMapGenerator'],
    deeper: `Helm hooks (annotations such as \`helm.sh/hook: pre-upgrade\`) run Jobs at points in the release lifecycle, e.g. a database migration before an upgrade. Chart dependencies let an umbrella chart pull in sub-charts. Kustomize \`components\` allow reusable optional features (e.g. "enable TLS") that several overlays can opt into.`,
    references: [
      { title: 'Helm documentation', url: 'https://helm.sh/docs/' },
      { title: 'Declarative Management of Kubernetes Objects Using Kustomize', url: 'https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/' },
      { title: 'Kustomize', url: 'https://kustomize.io/' },
    ],
  },
  {
    id: 'rollouts-and-deployment-strategies',
    title: 'Rollouts and Deployment Strategies',
    stage: 6,
    order: 3,
    objectives: ['cad-delivery'],
    scope: 'kcna',
    estMinutes: 25,
    summary:
      'How a Deployment replaces Pods (RollingUpdate with maxSurge/maxUnavailable, or Recreate), how to watch and undo a rollout, and how blue/green and canary releases reduce risk.',
    what: `A **rollout** is the process of moving a workload from one version to another. Kubernetes Deployments provide two built-in strategies:

- **RollingUpdate** (default) — gradually replace old Pods with new ones, keeping the app available.
- **Recreate** — delete all old Pods, then create new ones. Accepts downtime; used when two versions must never run at once (e.g. incompatible schema or a single-writer volume).

Two higher-level release patterns are built from Kubernetes primitives (or tools on top):

- **Blue/green** — run the full new version (green) next to the old (blue), test it, then switch all traffic at once.
- **Canary** — send a small share of real traffic to the new version, watch metrics, and increase gradually.`,
    why: `Most production incidents are triggered by a change. A rollout strategy decides **how many users are exposed to a bad version and for how long**. Rolling updates give zero-downtime deploys for free; canaries cap exposure to a few percent; blue/green makes rollback a single switch.`,
    problem: `Replacing every Pod at once means downtime and, if the new version is broken, a complete outage. Replacing them one at a time is safe but slow. You need knobs for the speed/safety trade-off, a way to tell when a rollout is stuck, and a quick undo.`,
    how: `Trace a RollingUpdate after \`kubectl set image deploy/web web=shop/web:2.0\` with \`replicas: 4\`, \`maxSurge: 1\`, \`maxUnavailable: 0\`:

- **1.** Changing the Pod template creates a **new ReplicaSet** (new \`pod-template-hash\`). The old ReplicaSet still has 4 Pods.
- **2.** \`maxSurge: 1\` allows 5 Pods total, so the controller scales the new ReplicaSet to 1.
- **3.** \`maxUnavailable: 0\` means it must wait until that Pod is **Ready** (readiness probe passing, plus \`minReadySeconds\` if set).
- **4.** Then it scales the old ReplicaSet to 3 and the new one to 2, and repeats until new = 4, old = 0.
- **5.** The old ReplicaSet is kept at 0 replicas as **revision history** (up to \`revisionHistoryLimit\`, default 10).
- **6.** If progress stalls for \`progressDeadlineSeconds\` (default 600), the Deployment's \`Progressing\` condition becomes false with reason \`ProgressDeadlineExceeded\`. Kubernetes does **not** roll back automatically.

\`kubectl rollout undo\` scales the previous ReplicaSet back up in the same rolling way. Both \`maxSurge\` and \`maxUnavailable\` default to **25%**; they accept absolute numbers or percentages, and cannot both be 0.

**Blue/green with plain Kubernetes**: two Deployments with labels \`version: blue\` and \`version: green\`, one Service whose selector includes \`version\`. Switching the Service selector moves all traffic.

**Canary with plain Kubernetes**: two Deployments sharing the label the Service selects on; traffic splits roughly by replica ratio (9 stable + 1 canary ≈ 10%). Precise percentages, header-based routing and automated metric analysis need a Gateway API/ingress implementation that supports weights, a service mesh, or tools such as Argo Rollouts or Flagger.`,
    components: [
      { name: 'strategy.type', description: '`RollingUpdate` (default) or `Recreate`.' },
      { name: 'maxSurge / maxUnavailable', description: 'How many Pods above desired may exist during the update, and how many below desired may be unavailable. Default 25% each.' },
      { name: 'Readiness gate of progress', description: 'The rollout advances only as new Pods become Ready, which makes readiness probes part of safe delivery.' },
      { name: 'kubectl rollout', description: '`status`, `history`, `undo [--to-revision=N]`, `pause`, `resume`, `restart`.' },
      { name: 'Progressive delivery tools', description: 'Argo Rollouts and Flagger automate canary/blue-green steps and roll back based on metrics.' },
    ],
    misconceptions: [
      { myth: 'Kubernetes automatically rolls back a failed Deployment.', reality: 'It marks the rollout as failed (`ProgressDeadlineExceeded`) and stops. Undo is manual (`kubectl rollout undo`) or done by a progressive-delivery tool.' },
      { myth: 'Changing `replicas` triggers a rollout.', reality: 'Only changes to the Pod template (`spec.template`) create a new ReplicaSet and revision. Scaling just resizes the current ReplicaSet.' },
      { myth: 'A canary means a special Kubernetes object.', reality: 'There is no built-in Canary kind. It is a pattern built from Deployments, Services and traffic routing (or CRDs from tools like Argo Rollouts).' },
    ],
    example: {
      title: 'A cautious rolling update, then a rollback',
      description: 'This Deployment never drops below 4 ready Pods and waits 10 seconds after readiness before counting a Pod as available.',
      language: 'yaml',
      code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 4
  minReadySeconds: 10
  revisionHistoryLimit: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: shop/web:2.0
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
# kubectl rollout status deploy/web
# kubectl rollout history deploy/web
# kubectl rollout undo deploy/web --to-revision=3`,
    },
    exercise: {
      prompt: `A Deployment has \`replicas: 10\` and default strategy settings. During a rollout, what is the maximum total number of Pods, and the minimum number that must stay available? Then: the new image has a bug that makes its readiness probe fail. What does the rollout do?`,
      solution: `Defaults are 25% each. \`maxSurge\` 25% of 10 = 2.5, **rounded up** to 3, so up to 13 Pods. \`maxUnavailable\` 25% of 10 = 2.5, **rounded down** to 2, so at least 8 must be available.

With a failing readiness probe the new Pods never become Ready, so the controller cannot remove more old Pods than \`maxUnavailable\` allows. The rollout stalls with most old Pods still serving. After \`progressDeadlineSeconds\` it is reported as failed. Fix with \`kubectl rollout undo deploy/<name>\`. This is why readiness probes protect rollouts.`,
    },
    faq: [
      { q: 'What does `kubectl rollout restart` do?', a: 'It adds a timestamp annotation to the Pod template, which counts as a template change, so all Pods are replaced via a normal rolling update with the same image. Useful to pick up changed ConfigMaps consumed as env vars.' },
      { q: 'Blue/green or canary?', a: 'Blue/green needs double capacity briefly but gives instant, all-at-once switch and rollback. Canary uses less extra capacity and limits blast radius, but needs good metrics and traffic control to be meaningful.' },
      { q: 'Does a StatefulSet roll out the same way?', a: 'Similar idea, different mechanics: StatefulSets update Pods one at a time in reverse ordinal order by default (`RollingUpdate`), or only when Pods are deleted (`OnDelete`).' },
    ],
    keyTerms: ['RollingUpdate', 'Recreate', 'maxSurge', 'maxUnavailable', 'revision history', 'kubectl rollout undo', 'blue/green', 'canary'],
    deeper: `Feature flags decouple deploy from release: the code ships dark and is switched on per user group, which complements canaries. Argo Rollouts' \`Rollout\` CRD replaces the Deployment and adds steps such as "set weight 20%, pause, run an analysis querying Prometheus, continue or abort". Flagger works alongside an existing Deployment and drives traffic shifting through a mesh or ingress.`,
    references: [
      { title: 'Deployments', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/' },
      { title: 'Performing a Rolling Update (tutorial)', url: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/update/update-intro/' },
    ],
  },
  {
    id: 'debugging-applications',
    title: 'Debugging Applications',
    stage: 6,
    order: 4,
    objectives: ['cad-debugging'],
    scope: 'kcna',
    estMinutes: 25,
    summary:
      'Hands-on tools for looking inside running workloads: logs (including --previous), exec, port-forward, and kubectl debug with ephemeral containers, node debugging and Pod copies.',
    what: `Troubleshooting (previous stage) asked **"why isn't it running?"** Debugging asks **"it runs, but behaves wrongly — what is it actually doing?"** That means getting inside: reading its output, running commands in its environment, sending it requests directly, and attaching tools that the image does not contain.

The toolkit, from least to most invasive:

- \`kubectl logs\` — read output.
- \`kubectl port-forward\` — talk to it from your laptop, bypassing Services and Ingress.
- \`kubectl exec\` — run a command in an existing container.
- \`kubectl debug\` — add an **ephemeral container** to a running Pod, create a modified copy of a Pod, or open a shell on a node.`,
    why: `Production images are increasingly minimal or **distroless**: no shell, no \`curl\`, no package manager. That is good for security and size, but \`kubectl exec -- sh\` fails. Ephemeral containers solve this by bringing your tools in temporarily without rebuilding or restarting the app.

Knowing which tool isolates which layer also halves debugging time: if \`port-forward\` to the Pod works but the Service URL does not, the bug is in networking, not the app.`,
    problem: `Imagine a scenario: the \`checkout\` service returns HTTP 500 for some requests. Pods are Running and Ready. The image is distroless. Logs say only "upstream error". You need to see the app's view of DNS and the network, and call it directly — without restarting the Pod, which would destroy the state you are trying to observe.`,
    how: `Work through the scenario with escalating tools:

- **1. Logs.** \`kubectl logs deploy/checkout -c app --since=15m\` shows recent output from one Pod of the Deployment. \`-f\` follows; \`--previous\` shows the last crashed instance; \`-l app=checkout\` reads from several Pods.
- **2. Bypass the network layers.** \`kubectl port-forward pod/checkout-7c9f-abcde 8080:8080\` tunnels through the API server and kubelet to the Pod. \`curl localhost:8080/pay\` now hits the app directly. If it fails here too, the problem is in the app or its dependencies.
- **3. Try exec.** \`kubectl exec -it checkout-7c9f-abcde -c app -- sh\` fails: the image has no shell.
- **4. Attach an ephemeral container.** \`kubectl debug -it checkout-7c9f-abcde --image=busybox:1.36 --target=app\` adds a temporary container to the running Pod. It shares the Pod's network namespace (same IP, same localhost) and, with \`--target\`, the app container's process namespace so you can see its processes. Now \`nslookup payments\` and \`wget -qO- http://payments/health\` show the dependency is unreachable.
- **5. Escalate if needed.** \`kubectl debug checkout-7c9f-abcde -it --copy-to=checkout-debug --image=busybox:1.36 --share-processes\` makes a copy of the Pod with an extra debug container, leaving the original untouched. \`kubectl debug node/worker-2 -it --image=busybox:1.36\` starts a Pod on that node with the node's root filesystem mounted at \`/host\`.

Ephemeral containers (stable since 1.25) cannot be removed or restarted once added, have no ports, probes or resource guarantees, and disappear when the Pod is deleted.`,
    components: [
      { name: 'kubectl logs', description: 'Reads container stdout/stderr. Key flags: `-c`, `-f`, `--previous`, `--since`, `--tail`, `-l`.' },
      { name: 'kubectl exec', description: 'Runs a process inside an existing container (`-it ... -- sh`). Needs the binary to exist in the image.' },
      { name: 'kubectl port-forward', description: 'Forwards a local port to a Pod (or to a Pod behind a Service or Deployment). For debugging only; not a way to expose apps.' },
      { name: 'Ephemeral container', description: 'A temporary container injected into a running Pod via `kubectl debug`, for tools the app image lacks.' },
      { name: 'kubectl debug --copy-to / node/', description: 'Debug a copy of a Pod (optionally changing image or command) or open a privileged-style session on a node.' },
    ],
    misconceptions: [
      { myth: 'To debug, add curl to the production image and redeploy.', reality: 'That changes what you are debugging and bloats the image. Use an ephemeral container with the tools you need.' },
      { myth: '`kubectl port-forward` is a way to expose a service to users.', reality: 'It is a temporary tunnel for one client through the API server. Use a Service, Ingress or Gateway to expose apps.' },
      { myth: '`kubectl logs` shows logs of a deleted Pod.', reality: 'Logs live with the container on the node. Once the Pod is gone, so are its logs unless a log pipeline shipped them elsewhere. `--previous` only covers the prior container instance of a still-existing Pod.' },
    ],
    example: {
      title: 'Debugging a distroless container',
      description: 'Exec fails because there is no shell; an ephemeral busybox container sharing the target\'s process namespace gives you one.',
      language: 'bash',
      code: `$ kubectl exec -it checkout-7c9f-abcde -- sh
error: ... exec: "sh": executable file not found in $PATH

$ kubectl debug -it checkout-7c9f-abcde --image=busybox:1.36 --target=app
Defaulting debug container name to debugger-x7k2p.
/ # ps                       # see the app's processes (shared PID namespace)
/ # nslookup payments        # DNS as the Pod sees it
/ # wget -qO- -T 3 http://payments:8080/health
wget: download timed out     # dependency unreachable -> check its Service / NetworkPolicy

# Copy the Pod to experiment without touching the original
$ kubectl debug checkout-7c9f-abcde -it --copy-to=checkout-debug \\
    --image=busybox:1.36 --share-processes`,
    },
    exercise: {
      prompt: `A web app works via \`kubectl port-forward svc/web 8080:80\` but returns 404 through the Ingress. Separately, a Pod restarted twice and its current logs look clean. Which layer does each observation point to, and what command reveals the cause of the restarts?`,
      solution: `- Port-forward to the Service works, so the app and the Service are fine. The 404 comes from the **Ingress layer**: wrong host or path rule, wrong backend service name/port, or a different ingress class. Check \`kubectl describe ingress\`.
- The current instance is healthy; the crash happened in the previous one. \`kubectl logs <pod> --previous\` shows its output, and \`kubectl describe pod\` shows the last state's reason and exit code.`,
    },
    faq: [
      { q: 'Does kubectl debug restart my Pod?', a: 'Adding an ephemeral container does not restart the Pod. `--copy-to` creates a separate new Pod and leaves the original as is.' },
      { q: 'Why does my ephemeral container not see the app\'s processes?', a: 'By default containers in a Pod have separate PID namespaces. Use `--target=<container>` so the debug container joins that container\'s process namespace (requires runtime support), or `--share-processes` with `--copy-to`.' },
      { q: 'Can I use these tools if Pod Security Admission enforces restricted?', a: 'Ephemeral containers are also checked against the namespace\'s policy, so a debug image running as root may be rejected. `kubectl debug` offers `--profile` options (such as `restricted`) to generate a compliant container.' },
    ],
    keyTerms: ['kubectl logs --previous', 'kubectl exec', 'kubectl port-forward', 'kubectl debug', 'ephemeral container', 'distroless image', 'process namespace sharing'],
    deeper: `Beyond kubectl, application debugging in production leans on observability: distributed traces show which hop of a request failed, and structured logs with a trace ID let you jump from a trace to the exact log lines. Tools such as Telepresence or mirrord route cluster traffic to a process on your laptop so you can attach a local debugger.`,
    references: [
      { title: 'Debug Running Pods', url: 'https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/' },
      { title: 'Ephemeral Containers', url: 'https://kubernetes.io/docs/concepts/workloads/pods/ephemeral-containers/' },
      { title: 'kubectl reference', url: 'https://kubernetes.io/docs/reference/kubectl/' },
    ],
  },
  // ───────────────────────────── Stage 7 ─────────────────────────────
  {
    id: 'cloud-native-principles',
    title: 'Cloud Native Principles',
    stage: 7,
    order: 1,
    objectives: ['cna-ecosystem'],
    scope: 'kcna',
    estMinutes: 20,
    summary:
      'What "cloud native" means according to the CNCF, and the ideas behind it: microservices, containers, declarative APIs, immutable infrastructure, the twelve-factor app and treating servers as cattle rather than pets.',
    what: `The CNCF's definition, paraphrased: cloud native technologies let organisations build and run **scalable** applications in modern, dynamic environments such as public, private and hybrid clouds. **Containers, service meshes, microservices, immutable infrastructure and declarative APIs** exemplify the approach. These techniques enable **loosely coupled** systems that are **resilient, manageable and observable**, and combined with robust **automation** they let engineers make high-impact changes frequently and predictably with minimal toil.

Note what is missing: "cloud native" does not mean "runs in a public cloud". An on-premises Kubernetes cluster running containerised microservices with GitOps is cloud native; a monolith lifted unchanged onto a cloud VM is not.`,
    why: `Every other KCNA topic is an instance of these principles. Deployments embody immutable infrastructure and declarative APIs; Services and DNS embody loose coupling; probes and ReplicaSets embody resilience; Prometheus and OpenTelemetry embody observability. Understanding the principles lets you answer "why would you choose X?" questions rather than memorising feature lists.`,
    problem: `Traditional operations treat servers as **pets**: named, hand-configured, nursed back to health when sick. Over time each one accumulates undocumented changes (configuration drift) and becomes impossible to reproduce. Large monoliths add a second bottleneck: one team's change requires redeploying everything, so releases are rare, big and risky.`,
    how: `Contrast two ways of running the same online shop:

- **Packaging.** Pet style: install packages on long-lived VMs by hand or script. Cloud native: build an **immutable container image** once; the same artifact runs in every environment.
- **Change.** Pet style: SSH in and patch in place. Cloud native: build a new image and **replace** instances (immutable infrastructure). Nothing is modified after deployment.
- **Failure.** Pet style: page a human to fix the server. Cloud native: instances are **cattle** — identical and disposable — so a controller deletes and recreates them automatically.
- **Structure.** Pet style: one monolith. Cloud native: **microservices** — small services owned by small teams, communicating over the network via APIs, deployed and scaled independently.
- **Operation.** Pet style: runbooks and tickets. Cloud native: **declarative APIs** plus **automation** — you state desired state and controllers converge on it.
- **Visibility.** Pet style: log in and look. Cloud native: built-in **observability** (metrics, logs, traces) collected centrally.

The **twelve-factor app** methodology captures app-level habits that make this work. The ones most relevant to Kubernetes:

- **Config** in the environment, not the code (ConfigMaps, Secrets, env vars).
- **Backing services** (databases, queues) as attached resources addressed by URL.
- **Processes** are stateless; state lives in backing services. This makes horizontal scaling and replacement safe.
- **Disposability**: fast startup and graceful shutdown on SIGTERM.
- **Dev/prod parity**: same image everywhere.
- **Logs** as event streams written to stdout, collected by the platform.`,
    components: [
      { name: 'Microservices', description: 'Independently deployable services with their own data and lifecycle. Trade-off: network calls, distributed failure and more operational complexity.' },
      { name: 'Containers', description: 'The packaging unit: portable, immutable, fast to start, with isolated dependencies.' },
      { name: 'Declarative APIs', description: 'You describe the end state; controllers handle the steps. Kubernetes is the canonical example.' },
      { name: 'Immutable infrastructure', description: 'Never patch a running instance; replace it with a new one built from a versioned artifact.' },
      { name: 'Automation and CI/CD', description: 'Repeatable pipelines and reconcilers instead of manual steps, enabling frequent, low-risk changes.' },
      { name: 'Observability', description: 'Designing systems so their internal state can be inferred from emitted telemetry.' },
    ],
    misconceptions: [
      { myth: 'Cloud native means running on AWS, Azure or Google Cloud.', reality: 'It describes how applications are built and operated. It applies equally to on-premises, edge and hybrid environments.' },
      { myth: 'Microservices are always better than a monolith.', reality: 'They trade code coupling for distributed-systems complexity. A small team with a simple product may be better off with a well-structured monolith.' },
      { myth: 'Containerising an app makes it cloud native.', reality: 'A stateful, slow-starting app that writes logs to local files and needs manual config inside the container gains little. The design principles matter more than the packaging.' },
    ],
    example: {
      title: 'Twelve-factor habits expressed in a Pod spec',
      description: 'Config comes from the environment, the backing service is a URL, the process is stateless, and a shutdown grace period gives it time to finish requests on SIGTERM.',
      language: 'yaml',
      code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: orders
spec:
  replicas: 3                      # stateless -> scale horizontally
  selector:
    matchLabels: { app: orders }
  template:
    metadata:
      labels: { app: orders }
    spec:
      terminationGracePeriodSeconds: 30   # disposability: graceful shutdown
      containers:
        - name: orders
          image: shop/orders:1.8.2         # same immutable image in every env
          envFrom:
            - configMapRef: { name: orders-config }   # config in the environment
          env:
            - name: DATABASE_URL                       # backing service as a resource
              valueFrom:
                secretKeyRef: { name: orders-db, key: url }
          # logs: the app writes to stdout; the platform collects them`,
    },
    exercise: {
      prompt: `A team's app stores uploaded files on the container's local disk and reads its database password from a file baked into the image. Name the twelve-factor principles violated and what to change on Kubernetes.`,
      solution: `- Local file storage violates **stateless processes** (and disposability): the files vanish when the Pod is replaced and are not shared across replicas. Store them in a backing service such as object storage, or at minimum a PersistentVolume.
- A password baked into the image violates **config in the environment** (and is a security problem: everyone with the image has the secret, and changing it requires a rebuild). Provide it via a Secret as an env var or mounted file.`,
    },
    faq: [
      { q: 'Is Kubernetes required to be cloud native?', a: 'No, but it is the most common foundation because it directly implements declarative APIs, self-healing and automated rollouts. Serverless platforms and other orchestrators can also support cloud native designs.' },
      { q: 'What is the difference between pets and cattle in Kubernetes terms?', a: 'Pods managed by a Deployment are cattle: any one can be deleted and replaced. Even StatefulSet Pods, which keep stable names and storage, are recreated automatically rather than hand-repaired.' },
      { q: 'Do I need to memorise all twelve factors?', a: 'Know the idea and the factors that map to Kubernetes features: config, backing services, stateless processes, disposability, dev/prod parity and logs as streams.' },
    ],
    keyTerms: ['cloud native', 'microservices', 'immutable infrastructure', 'declarative API', 'pets vs cattle', 'twelve-factor app', 'loose coupling', 'resilience'],
    deeper: `Microservices create their own problems: retries amplifying outages, cascading failures, and data consistency across service boundaries. Patterns such as timeouts with budgets, circuit breakers, idempotent APIs, bulkheads and event-driven communication (with eventual consistency) address them, and several are implemented by service meshes rather than in each application.`,
    references: [
      { title: 'CNCF Cloud Native Definition', url: 'https://github.com/cncf/toc/blob/main/DEFINITION.md' },
      { title: 'The Twelve-Factor App', url: 'https://12factor.net/' },
      { title: 'CNCF Glossary', url: 'https://glossary.cncf.io/' },
    ],
  },
  {
    id: 'autoscaling-and-serverless',
    title: 'Autoscaling and Serverless',
    stage: 7,
    order: 2,
    objectives: ['cna-ecosystem'],
    scope: 'kcna',
    estMinutes: 25,
    summary:
      'The three autoscaling dimensions (more Pods with HPA, bigger Pods with VPA, more nodes with Cluster Autoscaler), event-driven scaling with KEDA, and serverless platforms such as Knative that scale to zero.',
    what: `Autoscaling adjusts capacity to demand automatically. In Kubernetes it happens on three axes:

- **Horizontal Pod Autoscaler (HPA)** — changes the **number of replicas** of a Deployment, StatefulSet or other scalable resource. Built in (\`autoscaling/v2\`).
- **Vertical Pod Autoscaler (VPA)** — recommends or changes **CPU/memory requests** of Pods. An add-on, not part of core Kubernetes.
- **Cluster Autoscaler** — adds **nodes** when Pods are Pending for lack of capacity, and removes underused nodes. Karpenter is an alternative node autoscaler.

**Serverless** takes this to the extreme: developers deploy functions or containers, and the platform handles servers and scaling entirely, often **down to zero** instances when idle, billing per use. On Kubernetes, **Knative** provides serverless containers and **KEDA** provides event-driven scaling (including to zero) for ordinary Deployments.`,
    why: `Static capacity is either wasteful (provisioned for peak) or fragile (provisioned for average). Autoscaling is how the cloud native promise of "elastic" is delivered, and it directly controls cost. It also connects other topics: HPA needs metrics, and Cluster Autoscaler is triggered by the scheduler's \`Pending\` state.`,
    problem: `Picture a ticketing site at 09:59 before a concert sale opens. Traffic will rise 20x in a minute and drop an hour later. Overnight it is nearly idle. Fixed replicas and fixed nodes cannot match that curve, and a human cannot react fast enough.`,
    how: `Walk through the spike with all three autoscalers:

- **1. Metrics.** **metrics-server** collects CPU/memory usage from kubelets and serves it via the Resource Metrics API. (Custom or external metrics need an adapter, e.g. for Prometheus.)
- **2. HPA loop.** Every 15 seconds by default, the HPA controller computes \`desiredReplicas = ceil(currentReplicas × currentMetric / targetMetric)\`. With 4 replicas at 90% CPU and a target of 60%: ceil(4 × 90/60) = 6. Utilisation is measured **relative to the Pods' CPU requests**, so requests must be set.
- **3. Scheduling.** The 2 new Pods need room. If no node has enough unrequested capacity, they stay **Pending**.
- **4. Cluster Autoscaler** sees unschedulable Pods, simulates whether a new node from a node group would fit them, and asks the cloud provider for one. Minutes later the node joins and the Pods schedule.
- **5. Scale down.** When load drops, HPA reduces replicas (a stabilisation window, 5 minutes by default for scale-down, prevents flapping). Cluster Autoscaler later drains and removes nodes that stay underutilised.
- **6. VPA**, used separately, watches actual usage over time and sets better requests — typically in recommendation mode, or applied by recreating Pods. Avoid letting HPA and VPA act on the **same CPU/memory metric** for one workload; they fight.

For event-driven work, **KEDA** reads a source such as a queue length or Kafka lag, scales a Deployment between 0 and N (it manages an HPA under the hood for 1→N), and **Knative Serving** routes requests through an activator so a revision can scale to zero and back on the first request (the **cold start**).`,
    components: [
      { name: 'HorizontalPodAutoscaler', description: 'Built-in API object (`autoscaling/v2`) targeting a scalable resource with min/max replicas and metric targets (resource, Pods, object, external).' },
      { name: 'metrics-server', description: 'Lightweight cluster add-on supplying CPU/memory for HPA and `kubectl top`. Not a monitoring system; it keeps no history.' },
      { name: 'Vertical Pod Autoscaler', description: 'Add-on that right-sizes container requests based on observed usage.' },
      { name: 'Cluster Autoscaler / Karpenter', description: 'Node-level scaling triggered by unschedulable Pods and underused nodes.' },
      { name: 'KEDA', description: 'Kubernetes Event-Driven Autoscaling: scalers for queues, streams, databases, cron and more; supports scale to zero. CNCF graduated.' },
      { name: 'Knative', description: 'Serverless layer on Kubernetes: Serving (request-driven autoscaling, scale to zero, revisions and traffic splitting) and Eventing.' },
    ],
    misconceptions: [
      { myth: 'HPA adds nodes when the cluster is full.', reality: 'HPA only changes replica counts. If new Pods do not fit, they are Pending until a node autoscaler (or a human) adds capacity.' },
      { myth: 'HPA works without resource requests.', reality: 'CPU utilisation targets are percentages of the request. Without a request the HPA cannot compute utilisation for that metric.' },
      { myth: 'Serverless means there are no servers.', reality: 'Servers still exist; the platform operator manages them, and you are abstracted from provisioning and scaling.' },
      { myth: 'The standard HPA can scale a Deployment to zero.', reality: 'HPA keeps at least `minReplicas` (1 or more by default). Scale-to-zero is provided by KEDA or Knative.' },
    ],
    example: {
      title: 'An HPA targeting 60% CPU',
      description: 'Keeps 2–10 replicas of `web` and aims for average CPU usage at 60% of requests. The Deployment\'s containers must declare CPU requests, and metrics-server must be installed.',
      language: 'yaml',
      code: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
# Imperative equivalent:
#   kubectl autoscale deployment web --cpu-percent=60 --min=2 --max=10
# Watch it:
#   kubectl get hpa web --watch`,
    },
    exercise: {
      prompt: `An HPA targets 50% CPU, min 2, max 8. Current: 3 replicas averaging 100% of their CPU request. (a) How many replicas will it request? (b) Two of the new Pods are Pending with \`Insufficient cpu\`. Which component fixes that, and how?`,
      solution: `- a) ceil(3 × 100/50) = **6** replicas, which is within the 2–8 bounds.
- b) A **node autoscaler** (Cluster Autoscaler or Karpenter). It notices unschedulable Pods, determines that a new node would fit them, and provisions one from the cloud provider. Once the node is Ready the scheduler places the Pods. Without a node autoscaler they stay Pending.`,
    },
    faq: [
      { q: 'Why is my HPA showing `<unknown>` for targets?', a: 'Usually metrics-server is not installed or not working, or the target containers have no CPU requests. `kubectl describe hpa` shows the exact condition.' },
      { q: 'What is a cold start?', a: 'The latency of the first request after scaling from zero: the platform must schedule a Pod, pull the image if needed and start the process. It is the price of paying nothing while idle.' },
      { q: 'Is FaaS the same as serverless?', a: 'Function-as-a-Service is one form of serverless where you deploy individual functions. Serverless containers (e.g. Knative) apply the same operational model to whole container images.' },
    ],
    keyTerms: ['HorizontalPodAutoscaler', 'Vertical Pod Autoscaler', 'Cluster Autoscaler', 'metrics-server', 'KEDA', 'Knative', 'scale to zero', 'cold start'],
    deeper: `The HPA's \`behavior\` field tunes scaling speed: policies such as "add at most 4 Pods or 100% per 15 seconds" and separate stabilisation windows for scale-up and scale-down. Kubernetes has also added **in-place Pod resource resize**, letting requests and limits change without recreating the Pod, which makes vertical scaling less disruptive; check the feature's status for your cluster version before relying on it.`,
    references: [
      { title: 'Horizontal Pod Autoscaling', url: 'https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/' },
      { title: 'Autoscaling Workloads', url: 'https://kubernetes.io/docs/concepts/workloads/autoscaling/' },
      { title: 'CNCF Projects', url: 'https://www.cncf.io/projects/' },
    ],
  },
  {
    id: 'observability-fundamentals',
    title: 'Observability Fundamentals',
    stage: 7,
    order: 3,
    objectives: ['cna-observability'],
    scope: 'kcna',
    estMinutes: 25,
    summary:
      'Metrics, logs and traces — what each signal answers, how OpenTelemetry standardises collecting them, and how SLIs, SLOs and SLAs turn telemetry into reliability targets.',
    what: `**Observability** is the ability to understand a system's internal state from the data it emits, including for failures you did not predict. **Monitoring** is watching known indicators and alerting on them. Monitoring answers "is it broken?"; observability helps answer "why?".

The three main signals:

- **Metrics** — numeric measurements over time, cheap to store and aggregate: request rate, error count, latency percentiles, CPU usage.
- **Logs** — timestamped records of discrete events, rich in detail: "payment 8812 declined: card expired".
- **Traces** — the path of one request across services, made of **spans** (one per operation) sharing a **trace ID**, with timing for each hop.

**OpenTelemetry (OTel)** is the CNCF project that standardises how applications produce and export this telemetry: APIs and SDKs for many languages, automatic instrumentation, a wire protocol (**OTLP**) and the **OpenTelemetry Collector**. It is vendor-neutral: instrument once, send anywhere.`,
    why: `In a monolith you can attach a debugger. In a system of 40 microservices, one user click touches a dozen processes on different nodes that may already have been replaced. Without telemetry collected centrally, a failure is invisible or impossible to locate. Observability is a design requirement of cloud native systems, not an add-on.`,
    problem: `Each signal alone has blind spots:

- Metrics tell you **that** the error rate jumped at 14:02, but not which requests or why.
- Logs have the details, but across 200 Pods you do not know which lines belong to the failing request.
- Traces show **where** the latency is, but sampling means not every request is kept, and they are expensive to store at full volume.

The fix is to correlate: an alert fires on a metric, you open an exemplar trace from that time window, find the slow span, and jump to the logs carrying that trace ID.`,
    how: `Follow telemetry from a checkout request through an OpenTelemetry-based pipeline:

- **1. Instrumentation.** The app uses the OTel SDK (or auto-instrumentation). Incoming HTTP requests start a span; outgoing calls create child spans and inject **trace context** into HTTP headers (W3C Trace Context), so the next service continues the same trace.
- **2. Emit.** The SDK records spans, increments metrics such as \`http.server.request.duration\`, and attaches the trace ID to log records.
- **3. Export.** Data goes over **OTLP** to an **OpenTelemetry Collector**, usually deployed as a DaemonSet (agent per node) and/or a central Deployment (gateway).
- **4. Process.** Collector **pipelines** run receivers → processors (batching, sampling, adding Kubernetes metadata like Pod and namespace, dropping sensitive attributes) → exporters.
- **5. Store and query.** Exporters send metrics to e.g. Prometheus, traces to e.g. Jaeger, logs to e.g. Loki or Elasticsearch, or everything to a commercial backend. Switching backends means changing Collector config, not application code.
- **6. Act.** Dashboards and alerts are built on **SLIs** and **SLOs**.

Reliability vocabulary:

- **SLI** (Service Level Indicator) — a measured quantity, e.g. "fraction of requests served successfully in under 300 ms".
- **SLO** (Service Level Objective) — the internal target for an SLI over a window, e.g. "99.9% over 30 days". The remaining 0.1% is the **error budget**.
- **SLA** (Service Level Agreement) — a contract with customers with consequences (credits, penalties) if missed. SLAs are usually looser than SLOs.`,
    components: [
      { name: 'Metrics', description: 'Aggregatable numbers with labels/attributes. Best for alerting and trends. Low cost per data point; watch label cardinality.' },
      { name: 'Logs', description: 'Event records. In Kubernetes, apps write to stdout/stderr; a node agent (e.g. Fluent Bit, Fluentd, the OTel Collector) ships them to a backend.' },
      { name: 'Traces and spans', description: 'A trace is a tree of spans for one request; context propagation carries the trace ID between services.' },
      { name: 'OpenTelemetry SDKs and APIs', description: 'Language libraries to produce telemetry, plus auto-instrumentation for common frameworks.' },
      { name: 'OpenTelemetry Collector', description: 'Vendor-neutral agent/gateway with receivers, processors and exporters.' },
      { name: 'SLI / SLO / SLA', description: 'Indicator (what you measure), objective (internal target), agreement (external contract).' },
    ],
    misconceptions: [
      { myth: 'Observability is just having dashboards.', reality: 'Dashboards show questions someone anticipated. Observability means the data is rich and correlated enough to investigate new questions after the fact.' },
      { myth: 'OpenTelemetry is a monitoring backend that stores and displays data.', reality: 'OTel produces, processes and exports telemetry. Storage, querying and visualisation are done by backends such as Prometheus, Jaeger or commercial tools.' },
      { myth: 'An SLO of 100% is the goal.', reality: '100% is unattainable and freezes change. An SLO below 100% defines an error budget that teams can spend on releases and experiments.' },
    ],
    example: {
      title: 'A minimal OpenTelemetry Collector pipeline',
      description: 'Receives OTLP from applications, batches and enriches it with Kubernetes metadata, then sends traces to a Jaeger backend over OTLP and exposes metrics for Prometheus to scrape. Component names follow the Collector Contrib distribution.',
      language: 'yaml',
      code: `receivers:
  otlp:
    protocols:
      grpc: {}
      http: {}
processors:
  k8sattributes: {}      # add pod, namespace, node names
  batch: {}
exporters:
  otlp/jaeger:
    endpoint: jaeger-collector.observability:4317
    tls:
      insecure: true
  prometheus:
    endpoint: 0.0.0.0:8889
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [k8sattributes, batch]
      exporters: [otlp/jaeger]
    metrics:
      receivers: [otlp]
      processors: [k8sattributes, batch]
      exporters: [prometheus]`,
    },
    diagram: 'observability-pillars',
    exercise: {
      prompt: `Users report the checkout is "sometimes slow". For each question, say which signal answers it best: (a) Did p99 latency rise, and since when? (b) Which downstream service adds the delay? (c) What exact error did the payment provider return for order 4411?

Then write one SLI and an SLO for checkout.`,
      solution: `- a) **Metrics** — a latency histogram graphed over time.
- b) **Traces** — span durations show which hop is slow.
- c) **Logs** — the detailed event record, found quickly via the trace ID or order ID.

Example SLI: proportion of checkout requests that return a non-5xx response within 500 ms. SLO: 99.5% of checkout requests meet that SLI over a rolling 28 days, giving an error budget of 0.5%.`,
    },
    faq: [
      { q: 'Are there only three pillars?', a: 'Metrics, logs and traces are the classic three. **Profiles** (continuous CPU/memory profiling) are increasingly treated as a fourth signal, and OpenTelemetry has been adding support for them.' },
      { q: 'Where do Kubernetes Events fit?', a: 'They are short-lived cluster events (scheduling, pulls, probe failures). Collectors can ship them to a log backend so they outlive the API server\'s retention period.' },
      { q: 'What is sampling and why is it needed?', a: 'Keeping only a fraction of traces to control cost. Head sampling decides at the start of a request; tail sampling decides after it completes, so it can keep all errors and slow requests.' },
    ],
    keyTerms: ['observability', 'metrics', 'logs', 'traces', 'span', 'OpenTelemetry', 'OTLP', 'SLI / SLO / SLA'],
    deeper: `Two practical pitfalls: **cardinality** — adding a label like user ID to a metric creates a time series per user and can overwhelm a metrics backend; put such detail in logs or traces instead. And **alerting on symptoms, not causes** — page on SLO burn rate ("we will exhaust the monthly error budget in 6 hours") rather than on every high-CPU node, which reduces alert fatigue.`,
    references: [
      { title: 'OpenTelemetry documentation', url: 'https://opentelemetry.io/docs/' },
      { title: 'Prometheus overview', url: 'https://prometheus.io/docs/introduction/overview/' },
      { title: 'Kubernetes logging architecture', url: 'https://kubernetes.io/docs/concepts/cluster-administration/logging/' },
    ],
  },
  {
    id: 'prometheus-and-monitoring',
    title: 'Prometheus and Monitoring',
    stage: 7,
    order: 4,
    objectives: ['cna-observability'],
    scope: 'kcna',
    estMinutes: 25,
    summary:
      'How Prometheus collects metrics by scraping (pull model), how exporters and service discovery feed it, the four metric types, basic PromQL, and how Alertmanager and Grafana complete the monitoring stack.',
    what: `**Prometheus** is an open-source monitoring system and time-series database. It was the second project to join the CNCF after Kubernetes and the second to graduate, and it is the de facto standard for metrics in Kubernetes environments.

Its defining choices:

- **Pull model** — Prometheus scrapes HTTP endpoints (conventionally \`/metrics\`) on a schedule, rather than waiting for apps to push data to it.
- **Dimensional data model** — every time series is a metric name plus key/value **labels**: \`http_requests_total{method="GET", code="500", pod="api-7c9f"}\`.
- **PromQL** — a query language for selecting and aggregating those series.
- **Local TSDB** — a single Prometheus server stores data on its own disk; long-term or global storage is delegated to other systems.`,
    why: `Metrics are the signal you alert on, and Kubernetes components themselves (API server, kubelet, etcd, CoreDNS) expose Prometheus-format metrics. Learning Prometheus vocabulary — scrape, target, exporter, label, PromQL, Alertmanager — covers most of what KCNA asks about monitoring.`,
    problem: `In a cluster, monitoring targets come and go every minute as Pods are created and rescheduled. A static list of hosts to monitor would be stale immediately, and asking thousands of short-lived Pods to know where to push data creates its own configuration problem. Prometheus's answer: **service discovery plus pull**. It asks the Kubernetes API what exists, then scrapes it.`,
    how: `Trace a metric from code to a page on someone's phone:

- **1. Expose.** The app uses a Prometheus client library to keep counters in memory and serve them as text on \`/metrics\`. Software you cannot modify (Linux hosts, databases) gets an **exporter**: a sidecar or separate process translating its stats into the format, e.g. **node_exporter** for machine metrics.
- **2. Discover.** Prometheus's Kubernetes service discovery watches the API for Pods, Services, Endpoints/EndpointSlices or Nodes. Relabelling rules choose which ones to scrape and turn their metadata into labels. (The Prometheus Operator lets you declare this with \`ServiceMonitor\` and \`PodMonitor\` custom resources.)
- **3. Scrape.** Every scrape interval (commonly 15–60 s) Prometheus GETs each target's \`/metrics\` and appends samples to its TSDB. The synthetic series \`up\` is 1 for a successful scrape and 0 for a failed one.
- **4. Evaluate rules.** **Recording rules** precompute expensive queries; **alerting rules** are PromQL expressions with a \`for\` duration. When an expression stays true that long, the alert fires.
- **5. Alertmanager** receives firing alerts and **deduplicates**, **groups** (one notification for 50 failing Pods), **routes** by labels (team=payments → that team's channel), applies **silences** and **inhibition**, then notifies via email, chat or paging tools.
- **6. Visualise.** **Grafana** (a separate, non-CNCF open-source project) queries Prometheus with PromQL for dashboards.

Short-lived batch jobs that end before a scrape can push to a **Pushgateway**, which Prometheus then scrapes — an exception to pull, not the norm.`,
    components: [
      { name: 'Prometheus server', description: 'Discovers targets, scrapes them, stores samples in its TSDB, evaluates rules and serves PromQL queries.' },
      { name: 'Exporters', description: 'Adapters that expose metrics for third-party systems: node_exporter (hosts), kube-state-metrics (state of Kubernetes objects), database exporters and more.' },
      { name: 'Metric types', description: '**Counter** (only goes up, resets on restart: requests served), **Gauge** (up and down: memory in use, queue length), **Histogram** (bucketed observations: request durations), **Summary** (client-side quantiles).' },
      { name: 'PromQL', description: 'Selectors with label matchers, range vectors like `[5m]`, functions like `rate()` and `histogram_quantile()`, and aggregations like `sum by (label)`.' },
      { name: 'Alertmanager', description: 'Handles alerts from Prometheus: dedup, grouping, routing, silences, inhibition, notification.' },
      { name: 'Grafana', description: 'Dashboarding tool commonly paired with Prometheus. Not part of Prometheus and not a CNCF project.' },
    ],
    misconceptions: [
      { myth: 'Applications push metrics to Prometheus.', reality: 'Prometheus pulls (scrapes). Push is only used through the Pushgateway for short-lived jobs, or via other components like an OpenTelemetry Collector that Prometheus scrapes or that uses remote write.' },
      { myth: 'Prometheus is built for logs and long-term storage.', reality: 'It stores numeric time series only, on a local disk with limited retention. Logs go to log systems; long-term/global metric storage uses projects such as Thanos or Cortex via remote write.' },
      { myth: 'Graphing a counter directly shows the request rate.', reality: 'A raw counter is an ever-increasing total. Use `rate(counter[5m])` to get per-second rate; it also handles counter resets.' },
      { myth: 'metrics-server is a lightweight Prometheus.', reality: 'metrics-server only provides current CPU/memory for autoscaling and `kubectl top`. It has no history, no query language and no alerting.' },
    ],
    example: {
      title: 'Four PromQL queries every learner should be able to read',
      description: 'From the raw exposition format to rates, aggregation and percentiles, plus an alerting rule.',
      language: 'text',
      code: `# What a target exposes on /metrics
# TYPE http_requests_total counter
http_requests_total{method="GET",code="200"} 10234
http_requests_total{method="GET",code="500"} 17

# 1. Is every target up?            -> 0 means the scrape failed
up{job="api"}

# 2. Requests per second, per status code, over the last 5 minutes
sum by (code) (rate(http_requests_total{job="api"}[5m]))

# 3. Error ratio
sum(rate(http_requests_total{job="api",code=~"5.."}[5m]))
  / sum(rate(http_requests_total{job="api"}[5m]))

# 4. 95th percentile latency from a histogram
histogram_quantile(0.95,
  sum by (le) (rate(http_request_duration_seconds_bucket{job="api"}[5m])))

# Alerting rule (in a rules file)
groups:
  - name: api
    rules:
      - alert: HighErrorRate
        expr: sum(rate(http_requests_total{job="api",code=~"5.."}[5m])) / sum(rate(http_requests_total{job="api"}[5m])) > 0.05
        for: 10m
        labels: { severity: page }`,
    },
    exercise: {
      prompt: `Classify each as counter, gauge or histogram: (a) bytes of memory in use, (b) total jobs processed, (c) request durations you want p50/p99 for. Then explain why \`rate()\` should be applied to (b) but not to (a).`,
      solution: `- a) **Gauge** — it goes up and down.
- b) **Counter** — it only increases (until the process restarts).
- c) **Histogram** — buckets of observations, queried with \`histogram_quantile()\`.

\`rate()\` computes the per-second increase of a counter over a window and compensates for resets, turning "total processed" into "processed per second". A gauge's value is already meaningful on its own; to see how it changes use functions like \`deriv()\` or aggregation such as \`avg_over_time()\`, not \`rate()\`.`,
    },
    faq: [
      { q: 'What is kube-state-metrics and how is it different from metrics-server?', a: 'kube-state-metrics exposes the **state of Kubernetes objects** (desired vs available replicas, Pod phase, restarts) for Prometheus to scrape. metrics-server reports **resource usage** (CPU/memory) for autoscaling. Different questions, different tools.' },
      { q: 'How does Prometheus scale?', a: 'A single server scales vertically and you can shard by job. For high availability run two identical servers; for global views and long retention, add Thanos or Cortex-style systems that receive data via remote write or read from object storage.' },
      { q: 'Do I need to know PromQL in depth for KCNA?', a: 'No. Recognise selectors, labels, `rate()` over counters, `sum by`, and what Alertmanager does. Deeper PromQL is for operational roles.' },
    ],
    keyTerms: ['Prometheus', 'pull model', 'scrape', 'exporter', 'PromQL', 'counter vs gauge', 'Alertmanager', 'Grafana'],
    deeper: `The **Prometheus Operator** (often installed via the kube-prometheus-stack Helm chart) manages Prometheus and Alertmanager with CRDs: \`Prometheus\`, \`Alertmanager\`, \`ServiceMonitor\`, \`PodMonitor\` and \`PrometheusRule\`. Teams then add monitoring for their app by creating a ServiceMonitor next to their Service rather than editing a central config file. Prometheus can also ingest OTLP metrics directly in recent versions, which helps OpenTelemetry-instrumented apps.`,
    references: [
      { title: 'Prometheus overview', url: 'https://prometheus.io/docs/introduction/overview/' },
      { title: 'Querying Prometheus (PromQL basics)', url: 'https://prometheus.io/docs/prometheus/latest/querying/basics/' },
      { title: 'Alertmanager', url: 'https://prometheus.io/docs/alerting/latest/alertmanager/' },
    ],
  },
  {
    id: 'service-mesh-and-envoy',
    title: 'Service Mesh and Envoy',
    stage: 7,
    order: 5,
    objectives: ['cna-ecosystem'],
    scope: 'kcna',
    estMinutes: 25,
    summary:
      'A service mesh moves service-to-service concerns (mTLS, retries, traffic splitting, telemetry) out of application code into proxies controlled by a central control plane. Covers Envoy, Istio, Linkerd and sidecarless (ambient) designs.',
    what: `A **service mesh** is an infrastructure layer that handles communication **between services** (east-west traffic). It has two parts:

- **Data plane** — proxies that sit in the path of every request between services and actually move the bytes. Traditionally one **sidecar proxy** per Pod.
- **Control plane** — a central component that configures all proxies: routing rules, security policy, certificates.

**Envoy** is a high-performance L7 proxy and the data plane of many meshes (Istio among them) and of many gateways. **Istio** and **Linkerd** are the best-known meshes; both are CNCF graduated, as is Envoy. Linkerd uses its own lightweight Rust proxy rather than Envoy.`,
    why: `In a microservice system, every service needs the same networking features: encryption, service identity, retries with timeouts, circuit breaking, gradual traffic shifting, and golden-signal metrics. Implementing them in each language's libraries means inconsistent behaviour and coupling every team to the platform's release cycle. A mesh provides them **uniformly, without code changes**.`,
    problem: `Analogy: in an office without a mailroom, every employee must know how to encrypt letters, verify senders, retry failed deliveries and log what they sent — and each does it slightly differently. A mesh installs a **mailroom clerk at every desk** (the sidecar). Employees hand over plain letters; the clerks encrypt, verify, retry and keep records, all following rules issued by **head office** (the control plane).

The cost: a clerk at every desk takes space and adds a little delay. That cost motivated sidecarless designs.`,
    how: `Trace a call from \`frontend\` to \`orders\` in a sidecar mesh:

- **1. Injection.** When the namespace is enabled for the mesh, a mutating admission webhook adds a proxy container (and traffic-redirect setup) to each new Pod.
- **2. Interception.** The app calls \`http://orders\` as usual. iptables rules (or a CNI plugin) redirect the outbound connection to the local sidecar.
- **3. Routing.** The sidecar applies rules pushed by the control plane, e.g. 90% to \`orders\` v1 and 10% to v2, a 2-second timeout, up to 3 retries.
- **4. mTLS.** The client sidecar opens a **mutual TLS** connection to the server's sidecar. Both present certificates issued by the mesh's certificate authority that encode **workload identity** (based on the ServiceAccount). Traffic is encrypted and each side knows who the other is.
- **5. Authorization.** The server-side proxy checks policy: is \`frontend\`'s identity allowed to call \`POST /orders\`?
- **6. Delivery and telemetry.** The request reaches the \`orders\` container over localhost. Both proxies record metrics (requests, errors, latency) and can emit trace spans — giving uniform observability for free, though apps must still forward trace headers for traces to connect.

**Sidecarless / ambient** designs split this up: in Istio's **ambient mode**, a per-node proxy (**ztunnel**) provides mTLS and L4 features for all Pods on the node, and optional **waypoint proxies** (Envoy-based) are deployed only where L7 features are needed. This lowers per-Pod resource cost and avoids restarting Pods to inject sidecars.`,
    components: [
      { name: 'Data plane', description: 'Proxies on the request path: per-Pod sidecars, or per-node and per-namespace/service proxies in ambient-style designs.' },
      { name: 'Control plane', description: 'Distributes configuration and certificates to proxies (e.g. Istio\'s `istiod`). Not on the request path.' },
      { name: 'Envoy', description: 'CNCF graduated L4/L7 proxy configured dynamically through its xDS APIs. Used by Istio and by many API gateways and ingress controllers.' },
      { name: 'Mutual TLS (mTLS)', description: 'Both client and server authenticate with certificates, giving encryption in transit plus service identity for authorization.' },
      { name: 'Traffic management', description: 'Retries, timeouts, circuit breaking, weighted splits for canaries, traffic mirroring and fault injection.' },
      { name: 'Istio / Linkerd', description: 'Istio: feature-rich, Envoy-based, sidecar or ambient modes. Linkerd: focused on simplicity, with its own Rust micro-proxy.' },
    ],
    misconceptions: [
      { myth: 'A service mesh replaces Kubernetes Services and the CNI.', reality: 'The mesh builds on them. Pods still get IPs from the CNI plugin, and Services/DNS still name the destinations; the mesh adds L7 behaviour and security on top.' },
      { myth: 'mTLS in a mesh is the same as a NetworkPolicy.', reality: 'NetworkPolicy filters by IP/port/labels at L3/L4 and is enforced by the CNI. Mesh authorization uses cryptographic identity and can match L7 attributes such as HTTP paths. They complement each other.' },
      { myth: 'Every cluster should run a service mesh.', reality: 'A mesh adds components, resource overhead and operational complexity. It pays off when you need uniform mTLS, fine-grained traffic control or consistent telemetry across many services.' },
    ],
    example: {
      title: 'A 90/10 canary and strict mTLS in Istio',
      description: 'Istio custom resources: a VirtualService splits traffic between subsets (defined by a DestinationRule, not shown), and a PeerAuthentication requires mTLS for all workloads in the namespace.',
      language: 'yaml',
      code: `apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: orders
  namespace: shop
spec:
  hosts:
    - orders
  http:
    - route:
        - destination: { host: orders, subset: v1 }
          weight: 90
        - destination: { host: orders, subset: v2 }
          weight: 10
      timeout: 2s
      retries:
        attempts: 3
---
apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata:
  name: default
  namespace: shop
spec:
  mtls:
    mode: STRICT`,
    },
    exercise: {
      prompt: `Your security team requires that all traffic between services is encrypted and that only \`frontend\` may call \`payments\`. A teammate proposes adding TLS libraries to all 30 services and IP allow-lists. Describe how a service mesh would meet both requirements instead, and one cost of doing so.`,
      solution: `- **Encryption**: enable mesh-wide **strict mTLS**. Proxies encrypt every connection automatically; certificates are issued and rotated by the mesh CA — no app changes.
- **Only frontend → payments**: write an authorization policy on \`payments\` allowing only the **workload identity** of \`frontend\` (derived from its ServiceAccount). Identities survive Pod rescheduling, unlike IP allow-lists, which break as Pod IPs change.

Costs: extra CPU/memory for proxies (per Pod with sidecars), a small latency increase per hop, and a new control plane to operate and upgrade.`,
    },
    faq: [
      { q: 'Is Envoy a service mesh?', a: 'No. Envoy is a proxy. A mesh is many proxies plus a control plane that configures them. Istio uses Envoy as its data plane.' },
      { q: 'How does the Gateway API relate to service meshes?', a: 'Gateway API was designed for ingress, but its GAMMA initiative extends routes such as `HTTPRoute` to east-west mesh traffic, giving meshes a common, vendor-neutral configuration API.' },
      { q: 'Do apps need changes to join a mesh?', a: 'Usually not for mTLS, retries or metrics. For distributed traces to connect across hops, apps must still propagate trace headers from incoming to outgoing requests.' },
    ],
    keyTerms: ['service mesh', 'data plane', 'control plane', 'sidecar proxy', 'Envoy', 'mTLS', 'Istio ambient mode', 'Linkerd'],
    deeper: `Envoy is configured through **xDS** discovery APIs (listeners, routes, clusters, endpoints, secrets), which is what lets a control plane update thousands of proxies without restarts. Some CNI-based approaches (for example Cilium's) implement parts of mesh functionality using eBPF in the kernel combined with a per-node Envoy, another variation of the sidecarless idea.`,
    references: [
      { title: 'Envoy documentation', url: 'https://www.envoyproxy.io/docs' },
      { title: 'Istio documentation', url: 'https://istio.io/latest/docs/' },
      { title: 'Linkerd', url: 'https://linkerd.io/' },
    ],
  },
  {
    id: 'cncf-community-and-governance',
    title: 'CNCF Community and Governance',
    stage: 7,
    order: 6,
    objectives: ['cna-community'],
    scope: 'kcna',
    estMinutes: 20,
    summary:
      'How the cloud native ecosystem is organised: the CNCF under the Linux Foundation, the TOC and project maturity levels, how Kubernetes itself is governed through SIGs and KEPs, the open standards (OCI, CRI, CNI, CSI) that keep it pluggable, and the roles people play.',
    what: `The **Cloud Native Computing Foundation (CNCF)** is a vendor-neutral foundation, part of the **Linux Foundation**, founded in 2015 with Kubernetes (contributed by Google) as its first project. It hosts open-source projects, runs events such as KubeCon + CloudNativeCon, and offers certifications including KCNA, CKA, CKAD and CKS.

Key structures:

- **Governing Board** — handles budget, marketing and business matters.
- **Technical Oversight Committee (TOC)** — the technical authority: defines the cloud native vision, accepts projects and votes on maturity changes. It is supported by **Technical Advisory Groups (TAGs)** focused on areas such as security or observability.
- **Projects** — each has its own maintainers and governance. The CNCF owns trademarks and provides neutral infrastructure; it does not run projects day to day.`,
    why: `KCNA's "Cloud Native Community and Collaboration" competency tests whether you understand how this ecosystem works — who decides, how mature a project is, and why standards matter. Practically, project maturity is a signal when choosing tools, and knowing how Kubernetes evolves (KEPs, SIGs, release cycle) explains why features move from alpha to GA over several releases.`,
    problem: `Thousands of contributors from competing companies build shared infrastructure. Without neutral governance, one vendor could steer a project for its own benefit, and users could not trust its long-term direction. Without **open standards**, every runtime, network plugin and storage driver would need custom integration with every orchestrator.`,
    how: `**A project's path through the CNCF:**

- **1. Sandbox** — entry level for early-stage projects. Low bar; experimentation encouraged. Not a statement of production readiness.
- **2. Incubating** — the project shows production use by multiple adopters, a healthy contributor base and sound governance. Requires TOC due diligence and vote.
- **3. Graduated** — highest level: broad adoption, committers from multiple organisations, a completed independent security audit, and adoption of the CNCF Code of Conduct. Kubernetes, Prometheus, Envoy, containerd, CoreDNS, etcd, Helm, Argo, Flux, Istio and Linkerd are examples.
- Projects can also be **archived** when no longer active.

**How Kubernetes itself evolves:**

- Work is organised into **Special Interest Groups (SIGs)** owning areas (SIG Network, SIG Storage, SIG Node, SIG Auth...), plus temporary **Working Groups**. A **Steering Committee** oversees project governance.
- Significant changes are proposed as a **Kubernetes Enhancement Proposal (KEP)** in the \`kubernetes/enhancements\` repository, describing motivation, design, test plan and graduation criteria.
- Features progress **alpha → beta → stable** across releases, typically behind **feature gates** until GA. Kubernetes ships about **three minor releases per year**.

**Open standards that make it pluggable:**

- **OCI** (Open Container Initiative, a Linux Foundation project) — image, runtime and distribution specifications.
- **CRI** — Container Runtime Interface between kubelet and runtimes (containerd, CRI-O).
- **CNI** — Container Network Interface for network plugins (Calico, Cilium, Flannel).
- **CSI** — Container Storage Interface for storage drivers.`,
    components: [
      { name: 'CNCF / Linux Foundation', description: 'Vendor-neutral home for cloud native projects; owns trademarks, funds infrastructure, runs events and certifications.' },
      { name: 'TOC and TAGs', description: 'Technical Oversight Committee decides project acceptance and maturity; Technical Advisory Groups provide domain expertise and guidance.' },
      { name: 'Maturity levels', description: 'Sandbox → Incubating → Graduated (and Archived). A signal of adoption and governance, not a guarantee of fit.' },
      { name: 'SIGs and KEPs', description: 'Kubernetes\' units of ownership and its design-proposal process for significant changes.' },
      { name: 'Open standards', description: 'OCI, CRI, CNI and CSI decouple Kubernetes from specific runtimes, networks and storage.' },
      { name: 'Roles', description: 'Developers, DevOps engineers, **Site Reliability Engineers** (apply software engineering to operations, own SLOs and error budgets), **platform engineers** (build internal developer platforms as self-service products), security engineers, maintainers and contributors.' },
    ],
    misconceptions: [
      { myth: 'The CNCF develops Kubernetes and decides its features.', reality: 'Features are designed and built by the Kubernetes community through SIGs and KEPs. The CNCF provides neutral governance, funding and infrastructure.' },
      { myth: 'Sandbox means a project is endorsed for production.', reality: 'Sandbox is an early-stage entry point. Maturity grows to Incubating and Graduated as adoption and governance are demonstrated.' },
      { myth: 'Graduated projects are finished and stop changing.', reality: 'Graduation reflects maturity of adoption and governance. Graduated projects continue active development and releases.' },
      { myth: 'Only employees of big vendors can contribute.', reality: 'Anyone can contribute: docs, issue triage, tests, code reviews, SIG meetings. Most SIG meetings are public and recorded.' },
    ],
    example: {
      title: 'Matching projects to standards and maturity',
      description: 'A quick mental map of interfaces and the well-known graduated projects that implement or surround them.',
      language: 'text',
      code: `Interface / area    Defined by          Example implementations (CNCF graduated unless noted)
-----------------   -----------------   -----------------------------------------------------
Image & runtime     OCI specs           containerd, CRI-O (both implement CRI as well)
Kubelet -> runtime  CRI (Kubernetes)    containerd, CRI-O
Pod networking      CNI                 Cilium, Calico (non-CNCF), Flannel (non-CNCF)
Storage             CSI                 Cloud provider drivers, Rook-Ceph
Cluster DNS         —                   CoreDNS
Cluster state       —                   etcd
Metrics             —                   Prometheus
Service proxy/mesh  —                   Envoy, Istio, Linkerd
Packaging/GitOps    —                   Helm, Argo, Flux`,
    },
    exercise: {
      prompt: `A team wants a new Kubernetes API field. Describe the path from idea to a stable feature, naming the groups and documents involved.`,
      solution: `- Discuss the idea with the owning **SIG** (e.g. SIG Apps for workload APIs) at a SIG meeting or on its channels.
- Write a **KEP** in \`kubernetes/enhancements\` covering motivation, design, alternatives, test plan and graduation criteria; get it reviewed and approved by the SIG (and API reviewers).
- Implement it as **alpha**, usually behind a feature gate disabled by default, in a release.
- After feedback and meeting criteria, promote to **beta**, then **stable (GA)** in later releases, where the feature gate is eventually removed. This usually spans several releases.`,
    },
    faq: [
      { q: 'How do I check a project\'s maturity?', a: 'Use the CNCF projects page or the CNCF Landscape. Maturity changes over time, so check the current status rather than memorising old lists.' },
      { q: 'What is the difference between DevOps, SRE and platform engineering?', a: 'DevOps is a culture of shared ownership between development and operations. SRE is a concrete practice of running services with software engineering, SLOs and error budgets. Platform engineering builds internal self-service platforms so product teams can ship without becoming infrastructure experts.' },
      { q: 'Is the Open Container Initiative part of the CNCF?', a: 'No. OCI is a separate Linux Foundation project. The CNCF projects (containerd, CRI-O, Kubernetes) implement its specifications.' },
    ],
    keyTerms: ['CNCF', 'Linux Foundation', 'Technical Oversight Committee', 'sandbox / incubating / graduated', 'SIG', 'KEP', 'OCI / CRI / CNI / CSI', 'platform engineering'],
    deeper: `The **CNCF Landscape** maps thousands of cloud native projects and products, CNCF-hosted or not, by category; the CNCF **Trail Map** historically suggested an adoption order (containers → CI/CD → orchestration → observability → service mesh...). Kubernetes conformance is a separate programme: vendors run the conformance test suite to become **Certified Kubernetes**, which guarantees the same core APIs behave consistently across distributions.`,
    references: [
      { title: 'CNCF projects', url: 'https://www.cncf.io/projects/' },
      { title: 'CNCF TOC repository', url: 'https://github.com/cncf/toc' },
      { title: 'Kubernetes community (SIGs)', url: 'https://github.com/kubernetes/community' },
    ],
  },
];
