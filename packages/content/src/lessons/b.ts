import type { Lesson } from '../types';

export const lessonsB: Lesson[] = [
  // ───────────────────────────── Stage 2 · Workloads ─────────────────────────────
  {
    id: 'jobs-and-cronjobs',
    title: 'Jobs and CronJobs',
    stage: 2,
    order: 4,
    objectives: ['kf-core'],
    scope: 'kcna',
    estMinutes: 18,
    summary:
      'Jobs run Pods until a task finishes successfully; CronJobs create Jobs on a schedule. They are the workload controllers for work that is supposed to end.',
    what: `A **Job** is a controller that creates one or more Pods and keeps creating replacements until a specified number of them **complete successfully** (exit code 0). Then it stops. The Job object stays around as a record of the run.

A **CronJob** is a controller one level higher: on a cron schedule (for example \`0 2 * * *\` = every day at 02:00) it creates a new Job from a \`jobTemplate\`. The chain is CronJob → Job → Pod, the same "controller owns controller" pattern you saw with Deployment → ReplicaSet → Pod.`,
    why: `A Deployment assumes its Pods should run forever: if a Pod exits, the ReplicaSet replaces it. That is exactly wrong for a database migration, a report generator or a batch image resize. Those tasks should run, finish, and **stay finished**.

Jobs give batch work the same self-healing as long-running services: if the node dies halfway through, the Job controller notices the missing Pod and starts another, but once the work succeeds nothing gets restarted.`,
    problem: `Imagine running a nightly backup with a plain Pod. If the node reboots at 02:05, the Pod is gone and nothing retries it. If you wrap it in a Deployment instead, the backup "succeeds", exits, and is immediately started again in an endless loop.

Before Kubernetes, the usual answer was a crontab on one specific server: a single point of failure that nobody remembered to migrate. CronJob moves the schedule into the cluster, where it survives the loss of any single machine.`,
    how: `Follow one run of a CronJob from schedule to cleanup:

- The **CronJob controller** (part of kube-controller-manager) checks schedules. When a schedule time arrives, it creates a **Job** object from \`spec.jobTemplate\`.
- If the previous Job is still running, \`concurrencyPolicy\` decides: \`Allow\` (default, run both), \`Forbid\` (skip this run) or \`Replace\` (cancel the old one, start the new one).
- The **Job controller** sees the new Job and creates Pods from its Pod template. \`parallelism\` caps how many run at once; \`completions\` says how many must succeed (both default to 1).
- Each Pod's \`restartPolicy\` must be \`Never\` or \`OnFailure\` — \`Always\` is rejected for Jobs. With \`OnFailure\` the kubelet restarts the failed container in place; with \`Never\` the Job controller creates a fresh Pod.
- Failures are counted against \`backoffLimit\` (default 6), with exponential back-off between retries. When the limit is exceeded the Job is marked **Failed**. \`activeDeadlineSeconds\` puts a hard wall-clock limit on the whole Job.
- When enough Pods succeed, the Job gets a **Complete** condition. Its Pods are left in \`Completed\` status so you can still read their logs.
- Cleanup: the CronJob keeps the last \`successfulJobsHistoryLimit\` (default 3) and \`failedJobsHistoryLimit\` (default 1) Jobs. A plain Job can clean itself up with \`ttlSecondsAfterFinished\`.`,
    components: [
      { name: 'Job', description: 'Runs Pods until `completions` successes are recorded, retrying failures up to `backoffLimit`.' },
      { name: 'CronJob', description: 'Creates a Job from `jobTemplate` each time `schedule` (standard 5-field cron syntax) fires.' },
      { name: 'completions / parallelism', description: 'How many successful Pods are needed in total, and how many may run at the same time.' },
      { name: 'backoffLimit', description: 'Number of retries before the Job is marked Failed (default 6).' },
      { name: 'concurrencyPolicy', description: 'CronJob behaviour when the previous run is still active: `Allow`, `Forbid` or `Replace`.' },
      { name: 'ttlSecondsAfterFinished', description: 'Lets the TTL controller delete a finished Job (and its Pods) after N seconds.' },
    ],
    misconceptions: [
      {
        myth: 'A Job can use restartPolicy: Always like any other Pod.',
        reality: `No. The API server rejects a Job whose Pod template uses \`Always\`. Only \`Never\` and \`OnFailure\` make sense for work that is meant to finish.`,
      },
      {
        myth: 'The Completed Pods of a finished Job are still running and using resources.',
        reality: `A \`Completed\` Pod has exited and uses no CPU or memory. It is kept only so you can read logs and status. Remove it with \`ttlSecondsAfterFinished\` or history limits when you no longer need it.`,
      },
      {
        myth: 'A CronJob guarantees exactly one run per schedule tick.',
        reality: `CronJobs are approximately once. A run can be skipped (controller down, \`Forbid\` policy, missed \`startingDeadlineSeconds\`) or, rarely, happen twice. Batch tasks should be **idempotent** — safe to run again.`,
      },
    ],
    example: {
      title: 'A nightly report CronJob',
      description: `Runs at 02:30 every day, never overlaps with itself, retries twice, and keeps only a short history. Trigger it manually for testing with \`kubectl create job report-manual --from=cronjob/nightly-report\`.`,
      language: 'yaml',
      code: `apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-report
spec:
  schedule: "30 2 * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      backoffLimit: 2
      activeDeadlineSeconds: 600
      template:
        spec:
          restartPolicy: Never
          containers:
            - name: report
              image: busybox:1.36
              command: ["sh", "-c", "echo generating report; sleep 5"]`,
    },
    exercise: {
      prompt: `You need to process 12 files. Each Pod handles one file, and you want at most 3 Pods running at the same time. Which two Job fields do you set, and to what values? What happens if one Pod crashes?`,
      solution: `Set \`completions: 12\` and \`parallelism: 3\`. The Job controller keeps up to 3 Pods running until 12 have succeeded.

If a Pod crashes, the failure counts against \`backoffLimit\`. With \`restartPolicy: Never\` the controller creates a replacement Pod after a back-off delay; with \`OnFailure\` the container is restarted in the same Pod. Once failures exceed \`backoffLimit\`, the whole Job is marked Failed.`,
    },
    faq: [
      {
        q: 'Which API group are Jobs and CronJobs in?',
        a: `Both are in \`batch/v1\`. CronJob graduated to \`batch/v1\` (GA) in Kubernetes 1.21.`,
      },
      {
        q: 'What time zone does a CronJob schedule use?',
        a: `By default, the time zone of the kube-controller-manager. You can set \`spec.timeZone\` (for example \`"Europe/Berlin"\`) to make it explicit.`,
      },
      {
        q: 'How do I see why a Job failed?',
        a: `\`kubectl describe job <name>\` shows conditions and events; then \`kubectl logs\` on one of its Pods (they carry the label \`job-name=<name>\`) shows the application output.`,
      },
    ],
    keyTerms: ['Job', 'CronJob', 'completions', 'parallelism', 'backoffLimit', 'concurrencyPolicy', 'ttlSecondsAfterFinished', 'idempotency'],
    deeper: `**Indexed Jobs** (\`completionMode: Indexed\`) give each Pod a stable index (exposed as the \`JOB_COMPLETION_INDEX\` environment variable), so Pod 0 processes shard 0, and so on — the basis for static work partitioning. A **podFailurePolicy** lets a Job fail fast on non-retryable exit codes or ignore Pod disruptions (such as preemption) instead of burning \`backoffLimit\`. Jobs can also be suspended with \`spec.suspend: true\`, which queueing systems such as Kueue use to admit batch work only when capacity is available.`,
    references: [
      { title: 'Kubernetes docs: Jobs', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/job/' },
      { title: 'Kubernetes docs: CronJob', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/' },
    ],
  },
  {
    id: 'daemonsets-and-statefulsets',
    title: 'DaemonSets and StatefulSets',
    stage: 2,
    order: 5,
    objectives: ['kf-core'],
    scope: 'kcna',
    estMinutes: 20,
    summary:
      'DaemonSets run one Pod per eligible node for node-level agents; StatefulSets give Pods stable names, ordered rollout and their own persistent volumes for stateful apps.',
    what: `Both are workload controllers that exist because a Deployment's assumption — "all replicas are identical and interchangeable" — does not always hold.

A **DaemonSet** ensures that **every eligible node runs exactly one copy** of a Pod. You do not set a replica count; the number of nodes is the replica count. Add a node and a Pod appears on it; remove the node and the Pod is garbage-collected.

A **StatefulSet** manages Pods that each have a **persistent identity**: a stable ordinal name (\`db-0\`, \`db-1\`, \`db-2\`), a stable DNS name via a headless Service, and **its own PersistentVolumeClaim** that follows that name across rescheduling.`,
    why: `Think of a Deployment as a taxi rank: any car will do. A DaemonSet is a security guard posted at **every** building entrance. A StatefulSet is a numbered seat in a parliament: seat 2 is always seat 2, keeps its own desk drawer (volume), and members are sworn in in order.

Log shippers (Fluent Bit), node metrics exporters, CNI agents and kube-proxy itself need to be on every node — that is the DaemonSet case. Databases, message brokers and consensus systems (PostgreSQL replicas, Kafka, etcd, ZooKeeper) need peers to find each other by name and keep their data — that is the StatefulSet case.`,
    problem: `Try running a three-node database with a Deployment. Pods get random names like \`db-7c9d4-xk2lp\`; when one is replaced, its name and IP change, so the other members no longer recognise it. Worse, all replicas mount the same PVC — or none — so members cannot each keep their own data, and a replacement may start with an empty disk.

Try running a log agent with a Deployment of 5 replicas on 5 nodes. The scheduler may place two on one node and none on another, and when you scale the cluster to 8 nodes, three nodes are silently uncovered.`,
    how: `**DaemonSet, step by step:**

- The DaemonSet controller lists nodes and checks which ones match the Pod template's \`nodeSelector\`/affinity and tolerate the node's taints.
- For each eligible node without a Pod, it creates one with node affinity pinning it to that node; the default scheduler then binds it there.
- It automatically adds tolerations for conditions such as \`not-ready\` and \`unreachable\`, so node agents keep running on unhealthy nodes. To run on control-plane nodes you must add a toleration for the control-plane taint yourself.
- Updates use \`RollingUpdate\` (default) or \`OnDelete\`.

**StatefulSet, step by step (default \`OrderedReady\` policy):**

- \`spec.serviceName\` points at a **headless Service** (\`clusterIP: None\`) that gives each Pod a DNS name: \`db-0.db.<namespace>.svc.cluster.local\`.
- The controller creates \`db-0\`, waits until it is Running and Ready, then creates \`db-1\`, and so on.
- For each Pod it creates a PVC from \`volumeClaimTemplates\`, named \`<template>-<pod>\` (e.g. \`data-db-0\`). If \`db-1\` is rescheduled to another node, it re-attaches to \`data-db-1\`.
- Scaling down removes the highest ordinal first. Rolling updates also go from the highest ordinal down.
- PVCs are **kept** by default when Pods are deleted or the StatefulSet is scaled down — data safety over tidiness.`,
    components: [
      { name: 'DaemonSet', description: 'One Pod per eligible node; replica count follows the node count.' },
      { name: 'StatefulSet', description: 'Ordered, uniquely named Pods with stable network identity and per-Pod storage.' },
      { name: 'Headless Service', description: 'A Service with `clusterIP: None`; DNS returns individual Pod records instead of one virtual IP. Required by `serviceName`.' },
      { name: 'volumeClaimTemplates', description: 'PVC template stamped out once per StatefulSet Pod (`data-db-0`, `data-db-1` …).' },
      { name: 'podManagementPolicy', description: '`OrderedReady` (default, one at a time) or `Parallel` (create/delete all at once).' },
    ],
    misconceptions: [
      {
        myth: 'A StatefulSet makes your application highly available and replicates its data.',
        reality: `It only provides identity, ordering and per-Pod storage. Replication, leader election and failover are the **application's** job (or an operator's). Three StatefulSet Pods running a non-clustered database are three unrelated databases.`,
      },
      {
        myth: 'DaemonSet Pods always run on every node, including control-plane nodes.',
        reality: `Only on nodes they are eligible for. Control-plane nodes usually carry the \`node-role.kubernetes.io/control-plane:NoSchedule\` taint, so you must add a matching toleration to cover them. A \`nodeSelector\` can restrict a DaemonSet to a subset (e.g. only GPU nodes).`,
      },
      {
        myth: 'Deleting a StatefulSet deletes its data.',
        reality: `By default the PVCs created from \`volumeClaimTemplates\` remain. You delete them explicitly (or configure a retention policy) when you really want the data gone.`,
      },
    ],
    example: {
      title: 'A minimal StatefulSet with its headless Service',
      description: `Each Pod gets its own 1 GiB volume and a predictable DNS name. Watch the ordered start with \`kubectl get pods -l app=db -w\`: \`db-0\` becomes Ready before \`db-1\` is created.`,
      language: 'yaml',
      code: `apiVersion: v1
kind: Service
metadata:
  name: db
spec:
  clusterIP: None
  selector:
    app: db
  ports:
    - port: 5432
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: db
spec:
  serviceName: db
  replicas: 3
  selector:
    matchLabels:
      app: db
  template:
    metadata:
      labels:
        app: db
    spec:
      containers:
        - name: postgres
          image: postgres:16
          env:
            - name: POSTGRES_PASSWORD
              value: example-only
            - name: PGDATA            # subdirectory: a fresh volume may contain lost+found
              value: /var/lib/postgresql/data/pgdata
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 1Gi`,
    },
    exercise: {
      prompt: `For each workload, pick Deployment, DaemonSet or StatefulSet: (a) a Prometheus node exporter, (b) a stateless REST API, (c) a 3-member etcd cluster, (d) a CNI agent such as Cilium's, (e) a Redis cache whose data can be lost on restart.`,
      solution: `(a) **DaemonSet** — it reads per-node metrics, so one per node. (b) **Deployment** — interchangeable replicas. (c) **StatefulSet** — members need stable names to form a quorum and keep their own data. (d) **DaemonSet** — networking must be configured on every node. (e) **Deployment** — if no data must survive and no peer identity is needed, a StatefulSet adds complexity for nothing.`,
    },
    faq: [
      {
        q: 'Why must the headless Service exist before the StatefulSet is useful?',
        a: `The per-Pod DNS records (\`db-0.db...\`) are published by the cluster DNS based on that Service. Without it, Pods still start but peers cannot reach each other by stable name.`,
      },
      {
        q: 'Can I scale a DaemonSet with kubectl scale?',
        a: `No. A DaemonSet has no \`replicas\` field. You change its footprint by adding or removing nodes, or by changing its node selector, affinity or tolerations.`,
      },
      {
        q: 'If db-1 crashes, does it come back as db-1?',
        a: `Yes. The StatefulSet controller recreates a Pod with the same name, the same DNS name and the same PVC (\`data-db-1\`). Its IP address may change, which is why peers should use DNS names rather than IPs.`,
      },
    ],
    keyTerms: ['DaemonSet', 'StatefulSet', 'headless Service', 'volumeClaimTemplates', 'ordinal index', 'stable network identity', 'podManagementPolicy'],
    deeper: `StatefulSets support \`updateStrategy.rollingUpdate.partition\`: only Pods with an ordinal **greater than or equal to** the partition are updated, which enables manual canaries of stateful systems. Newer releases add \`persistentVolumeClaimRetentionPolicy\` (\`whenDeleted\` / \`whenScaled\`: \`Retain\` or \`Delete\`) to control PVC cleanup. In production, most stateful systems are run through **operators** (CRD + controller) that encode replication and failover logic on top of StatefulSets.`,
    references: [
      { title: 'Kubernetes docs: DaemonSet', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/' },
      { title: 'Kubernetes docs: StatefulSets', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/' },
    ],
  },
  {
    id: 'resources-requests-limits',
    title: 'Resource Requests, Limits and QoS',
    stage: 2,
    order: 6,
    objectives: ['kf-scheduling'],
    scope: 'kcna',
    estMinutes: 22,
    summary:
      'Requests reserve capacity and drive scheduling; limits cap usage at runtime. Together they determine a Pod’s QoS class, and namespaces can enforce defaults and totals with LimitRange and ResourceQuota.',
    what: `Each container can declare two numbers per resource (mainly \`cpu\` and \`memory\`):

- A **request** is what the container is **guaranteed**. The scheduler uses requests — not actual usage — to decide whether a Pod fits on a node.
- A **limit** is the **maximum** the container may use. The kubelet and the container runtime enforce it through Linux cgroups.

CPU is measured in cores: \`1\` = one vCPU, \`250m\` = a quarter of one (m = millicores). Memory is measured in bytes with suffixes: \`128Mi\` (mebibytes, powers of 2) or \`128M\` (megabytes, powers of 10).`,
    why: `Without requests the scheduler is flying blind: it may pack twenty Pods onto a node that can really carry five, and they all slow down or crash together. Without limits one leaking container can starve every neighbour on the node — the classic "noisy neighbour".

Requests and limits are also how Kubernetes decides **who gets evicted first** when a node runs out of memory. Declaring them is how you tell the cluster which workloads matter.`,
    problem: `A team deploys a Java service with no requests or limits. In testing it is fine. In production, under load, its heap grows to 6 GiB on an 8 GiB node. The kernel's OOM killer starts killing processes; the kubelet starts evicting Pods to recover memory. Because the Java Pod and most of its neighbours declared nothing, they are all **BestEffort** — the first in line to be evicted — and an unrelated payment service goes down with it.

With a memory request of 2 GiB and limit of 3 GiB, the scheduler would have reserved space, and the runaway process would have been OOMKilled alone at 3 GiB.`,
    how: `Trace one Pod through its life:

- **Admission**: if the namespace has a **LimitRange**, missing requests/limits are filled in with defaults (and min/max are validated). If it has a **ResourceQuota**, the Pod is rejected when it would push the namespace total over the quota.
- **Scheduling**: the scheduler sums the requests of all containers and compares them with each node's **allocatable** capacity minus the requests already placed there. If no node fits, the Pod stays \`Pending\` with an event like \`0/3 nodes are available: 3 Insufficient cpu\`.
- **Runtime — CPU**: CPU is **compressible**. A container that hits its CPU limit is **throttled** (slowed down), never killed.
- **Runtime — memory**: memory is **not compressible**. A container that exceeds its memory limit is killed by the kernel; Kubernetes reports \`OOMKilled\` (exit code 137) and restarts it according to \`restartPolicy\`.
- **Node pressure**: if the whole node runs low on memory, the kubelet evicts Pods, generally **BestEffort** first, then **Burstable** Pods using more than their requests, and **Guaranteed** last.

The **QoS class** is computed automatically from the containers' settings:

- **Guaranteed** — every container has CPU and memory requests **equal** to limits.
- **Burstable** — at least one request or limit is set, but the Guaranteed rule is not met.
- **BestEffort** — no requests or limits on any container.`,
    components: [
      { name: 'requests', description: 'Reserved amount; used by the scheduler for placement and by the kubelet for eviction ranking.' },
      { name: 'limits', description: 'Hard ceiling enforced via cgroups: CPU throttling, memory OOM kill.' },
      { name: 'QoS class', description: 'Guaranteed, Burstable or BestEffort — derived from requests/limits, visible in `status.qosClass`.' },
      { name: 'LimitRange', description: 'Per-namespace policy that sets default requests/limits and min/max per container or Pod.' },
      { name: 'ResourceQuota', description: 'Per-namespace cap on the **sum** of requests/limits and on object counts (Pods, Services, PVCs …).' },
    ],
    misconceptions: [
      {
        myth: 'The scheduler places Pods based on how much CPU and memory nodes are actually using.',
        reality: `The default scheduler uses **requests**, not live usage. A node that is 90% idle can still be "full" if Pods on it have requested all its allocatable capacity.`,
      },
      {
        myth: 'A container that exceeds its CPU limit is killed.',
        reality: `CPU over-use is **throttled**. Only memory over-use leads to an OOM kill. If your app is slow but never restarts, suspect CPU throttling.`,
      },
      {
        myth: 'If I set only a limit, the request is zero.',
        reality: `If a limit is set and the request is omitted, the request **defaults to the limit**. A container with only limits for both CPU and memory therefore ends up Guaranteed.`,
      },
    ],
    example: {
      title: 'A Burstable container, and how to check it',
      description: `Requests differ from limits, so this Pod is **Burstable**. After applying, confirm with \`kubectl get pod api -o jsonpath='{.status.qosClass}'\` and see live usage with \`kubectl top pod api\` (requires metrics-server).`,
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: api
spec:
  containers:
    - name: api
      image: nginx:1.27
      resources:
        requests:
          cpu: 250m
          memory: 128Mi
        limits:
          cpu: 500m
          memory: 256Mi`,
    },
    exercise: {
      prompt: `Classify each Pod's QoS class. Pod A: one container, requests cpu 1 / memory 1Gi, limits cpu 1 / memory 1Gi. Pod B: two containers; the first like Pod A, the second with no resources at all. Pod C: one container with limits cpu 500m / memory 512Mi and no requests. Pod D: no resources anywhere.`,
      solution: `**A: Guaranteed** — requests equal limits for both CPU and memory.

**B: Burstable** — Guaranteed requires *every* container to meet the rule; the second container breaks it, but something is set, so it is not BestEffort.

**C: Guaranteed** — omitted requests default to the limits, so requests equal limits.

**D: BestEffort** — nothing is declared; first to be evicted under memory pressure.`,
    },
    faq: [
      {
        q: 'Should I always set a CPU limit?',
        a: `It is debated. Memory limits are widely recommended because memory cannot be reclaimed. CPU limits can cause throttling even when the node has idle CPU, so some teams set CPU requests but no CPU limit. For the exam, know what each does; for production, measure.`,
      },
      {
        q: 'What does OOMKilled with exit code 137 mean?',
        a: `137 = 128 + 9: the process received SIGKILL. With reason \`OOMKilled\`, the container exceeded its memory limit (or the node ran out of memory). Raise the limit or fix the leak.`,
      },
      {
        q: 'What is the difference between LimitRange and ResourceQuota?',
        a: `LimitRange works **per container/Pod** (defaults and bounds for one object). ResourceQuota works **per namespace in aggregate** (the total of all objects). They are often used together: once a quota on CPU/memory exists, every Pod must declare those values, and a LimitRange supplies defaults so Pods are not rejected.`,
      },
    ],
    keyTerms: ['requests', 'limits', 'QoS class', 'Guaranteed / Burstable / BestEffort', 'CPU throttling', 'OOMKilled', 'LimitRange', 'ResourceQuota'],
    deeper: `Node **allocatable** = capacity minus \`kube-reserved\`, \`system-reserved\` and eviction thresholds, so Pods can never request the whole machine. Beyond CPU and memory you can request \`ephemeral-storage\`, hugepages and **extended resources** such as \`nvidia.com/gpu\` advertised by device plugins. Recent releases also add **in-place Pod resize**, which changes container resources without recreating the Pod — check the feature state for your cluster version before relying on it.`,
    references: [
      { title: 'Kubernetes docs: Resource Management for Pods and Containers', url: 'https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/' },
      { title: 'Kubernetes docs: Resource Quotas', url: 'https://kubernetes.io/docs/concepts/policy/resource-quotas/' },
      { title: 'Kubernetes docs: Limit Ranges', url: 'https://kubernetes.io/docs/concepts/policy/limit-range/' },
    ],
  },
  {
    id: 'health-probes',
    title: 'Health Probes: Liveness, Readiness, Startup',
    stage: 2,
    order: 7,
    objectives: ['kf-core', 'co-troubleshooting'],
    scope: 'kcna',
    estMinutes: 18,
    summary:
      'Probes let the kubelet ask a container “are you alive?”, “can you take traffic?” and “have you finished starting?”. Each answer triggers a different action: restart, remove from load balancing, or wait.',
    what: `A **probe** is a periodic check the **kubelet** runs against a container. There are three kinds, and the exam loves to test which action each one triggers:

- **Liveness probe** — "Is the process stuck?" Failure → the kubelet **restarts the container**.
- **Readiness probe** — "Should this Pod receive traffic right now?" Failure → the Pod is marked **not Ready** and removed from Service endpoints. **No restart.**
- **Startup probe** — "Has the app finished booting?" While it has not yet succeeded, liveness and readiness probes are **not run**. If it never succeeds within its budget, the container is restarted.`,
    why: `A container whose process is running is not necessarily healthy. A web server can deadlock and still hold its port; an app can be up but waiting for its database. By default Kubernetes only knows "process running or not". Probes let the application tell the platform what "healthy" really means, so self-healing and load balancing act on the right signal.`,
    problem: `Here is a failure story worth remembering. A team adds a liveness probe that calls \`/health\`, and \`/health\` checks the database. One afternoon the database is slow for 30 seconds. Every replica's liveness probe fails at once, the kubelet restarts **every** Pod, the restarted Pods hammer the recovering database with fresh connections, and a 30-second blip becomes a 15-minute outage.

The fix: dependency checks belong in the **readiness** probe (stop sending traffic, but do not restart). The liveness probe should only check whether **this process** is able to make progress.`,
    how: `Trace the kubelet's loop for a container with all three probes:

- Container starts. If \`initialDelaySeconds\` is set, wait that long.
- **Startup phase**: run the startup probe every \`periodSeconds\`. Liveness and readiness are suspended. Success → move on. \`failureThreshold\` consecutive failures → restart the container.
- **Steady state**: run liveness and readiness probes independently, each on its own \`periodSeconds\` (default 10s), each with \`timeoutSeconds\` (default 1s).
- A probe "fails" after \`failureThreshold\` (default 3) consecutive failures, and "succeeds" after \`successThreshold\` (default 1) consecutive successes.
- Liveness failure → kill and restart the container (subject to the Pod's \`restartPolicy\`). Repeated restarts show up as \`CrashLoopBackOff\`.
- Readiness failure → the Pod's \`Ready\` condition becomes False; the EndpointSlice controller marks it not ready, so Services stop routing to it. When it passes again, traffic returns.

Each probe uses one **mechanism**:

- \`httpGet\` — success if HTTP status is 200–399.
- \`tcpSocket\` — success if a TCP connection opens.
- \`exec\` — runs a command in the container; success if exit code is 0.
- \`grpc\` — uses the standard gRPC health checking protocol.`,
    components: [
      { name: 'livenessProbe', description: 'Detects a stuck container; failure restarts it.' },
      { name: 'readinessProbe', description: 'Gates traffic; failure removes the Pod from Service endpoints without restarting it.' },
      { name: 'startupProbe', description: 'Protects slow-starting apps; holds off the other probes until it succeeds once.' },
      { name: 'Probe mechanisms', description: '`httpGet`, `tcpSocket`, `exec`, `grpc`.' },
      { name: 'Timing fields', description: '`initialDelaySeconds`, `periodSeconds`, `timeoutSeconds`, `failureThreshold`, `successThreshold`.' },
    ],
    misconceptions: [
      {
        myth: 'A failing readiness probe restarts the container.',
        reality: `Readiness never restarts anything. It only controls whether the Pod receives Service traffic. Restarts come from liveness (or startup) probe failures, or from the process exiting.`,
      },
      {
        myth: 'More probes checking more dependencies is always safer.',
        reality: `A liveness probe that depends on external systems turns a dependency outage into a cluster-wide restart storm. Keep liveness local and cheap.`,
      },
      {
        myth: 'Probes are executed by the control plane.',
        reality: `The **kubelet** on the Pod's node runs them. The control plane only sees the results through Pod status updates.`,
      },
    ],
    example: {
      title: 'Three probes on one container',
      description: `The startup probe gives the app up to 30 × 5 = 150 seconds to boot. After that, liveness checks a cheap local endpoint and readiness checks whether the app can actually serve.`,
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: shop
  labels:
    app: shop
spec:
  containers:
    - name: shop
      image: example.com/shop:2.3.1
      ports:
        - containerPort: 8080
      startupProbe:
        httpGet:
          path: /healthz
          port: 8080
        periodSeconds: 5
        failureThreshold: 30
      livenessProbe:
        httpGet:
          path: /healthz
          port: 8080
        periodSeconds: 10
        failureThreshold: 3
      readinessProbe:
        httpGet:
          path: /ready
          port: 8080
        periodSeconds: 5`,
    },
    exercise: {
      prompt: `A Pod shows \`READY 0/1\` and \`STATUS Running\` with \`RESTARTS 0\` for ten minutes. Another Pod shows \`RESTARTS 14\` and \`STATUS CrashLoopBackOff\`. For each, which probe (if any) is the likely culprit, and where do you look first?`,
      solution: `**First Pod**: running but never Ready and never restarted → the **readiness probe** is failing. Run \`kubectl describe pod\` and look for \`Readiness probe failed\` events, then check what the endpoint depends on.

**Second Pod**: repeated restarts → either the process keeps exiting by itself or the **liveness (or startup) probe** keeps failing. \`kubectl describe pod\` shows \`Liveness probe failed\` events if probes are the cause; \`kubectl logs --previous\` shows the output of the last crashed instance.`,
    },
    faq: [
      {
        q: 'Do I always need all three probes?',
        a: `No. Readiness is the most broadly useful for anything behind a Service. Add liveness only if your app can hang without exiting. Add startup when boot time is long or variable, instead of inflating \`initialDelaySeconds\`.`,
      },
      {
        q: 'What happens if I configure no probes?',
        a: `The container is considered live as long as its process runs, and ready as soon as it starts. Traffic may hit it before it can serve.`,
      },
      {
        q: 'Can liveness and readiness use the same endpoint?',
        a: `They can, but then a failure triggers both actions at the same threshold. Using separate endpoints (or a longer liveness \`failureThreshold\`) lets the Pod drop out of traffic first and be restarted only if it does not recover.`,
      },
    ],
    keyTerms: ['liveness probe', 'readiness probe', 'startup probe', 'kubelet', 'failureThreshold', 'CrashLoopBackOff', 'Ready condition'],
    deeper: `Readiness interacts with rollouts: a Deployment counts a new Pod as available only after it is Ready for \`minReadySeconds\`, so a broken readiness probe stalls a rolling update instead of taking the service down. Pods can also declare **readiness gates** (\`spec.readinessGates\`) so an external controller — for example a cloud load balancer controller — must set an extra condition before the Pod counts as Ready.`,
    references: [
      { title: 'Kubernetes docs: Liveness, Readiness and Startup Probes', url: 'https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/' },
      { title: 'Kubernetes task: Configure Liveness, Readiness and Startup Probes', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/' },
    ],
  },
  {
    id: 'scheduling-placement',
    title: 'Scheduling and Pod Placement',
    stage: 2,
    order: 8,
    objectives: ['kf-scheduling'],
    scope: 'kcna',
    estMinutes: 25,
    summary:
      'The kube-scheduler filters out nodes that cannot run a Pod, scores the rest, and binds the Pod to the winner. nodeSelector, affinity, taints/tolerations and priority let you steer that decision.',
    what: `**Scheduling** is the act of choosing a node for a Pod that has none (\`spec.nodeName\` is empty). The **kube-scheduler** does this and records the decision by creating a **Binding**; the kubelet on that node then starts the Pod. The scheduler never starts containers itself.

You influence the choice with a set of tools that differ in **who expresses the preference**:

- The **Pod** asks for nodes: \`nodeSelector\`, **node affinity**.
- The **Pod** asks to be near or away from other Pods: **pod affinity / anti-affinity**.
- The **node** pushes Pods away: **taints**, which only Pods with matching **tolerations** may ignore.
- Pods compete for space: **PriorityClass** and **preemption**.`,
    why: `Not all nodes are equal. Some have GPUs or fast SSDs, some sit in a different availability zone, some are reserved for a team or for the control plane. And not all Pods should be placed independently: replicas of one service should spread across zones, while a cache may want to sit next to its app. Placement rules turn these needs into declarations the scheduler can act on.`,
    problem: `Without placement rules, all three replicas of a critical API can land on the same node — they "spread" only by accident. When that node is drained for maintenance, the service goes down even though it had three replicas.

Conversely, without taints, an expensive GPU node fills up with ordinary web Pods, and the ML job that needs the GPU stays \`Pending\`.`,
    how: `The scheduling cycle for one Pod:

- **Queue**: new Pods without a node enter the scheduling queue, ordered by priority.
- **Filter** (predicates): drop every node that cannot run the Pod — insufficient allocatable CPU/memory for the Pod's requests, \`nodeSelector\` or required node affinity not matched, an untolerated \`NoSchedule\`/\`NoExecute\` taint, a required pod anti-affinity rule violated, a host port already in use, and so on.
- **Score** (priorities): rank the remaining nodes — e.g. preferred affinity, spreading replicas, balancing resource usage, whether the image is already present.
- **Bind**: pick the highest score and write the binding to the API server.
- **No feasible node?** The Pod stays \`Pending\` with an event such as \`0/4 nodes are available: 1 node(s) had untolerated taint ..., 3 Insufficient memory\`. If the Pod has a higher priority than some running Pods, the scheduler may **preempt** (evict) lower-priority Pods to make room.

The steering tools:

- **nodeSelector** — simplest: the node must have all these labels.
- **Node affinity** — expressive version: \`requiredDuringSchedulingIgnoredDuringExecution\` (hard filter) and \`preferredDuringSchedulingIgnoredDuringExecution\` (weighted score), with operators like \`In\`, \`NotIn\`, \`Exists\`.
- **Pod affinity / anti-affinity** — relative to other Pods' labels within a \`topologyKey\` such as \`kubernetes.io/hostname\` (same node) or \`topology.kubernetes.io/zone\` (same zone).
- **Taints and tolerations** — a taint is \`key=value:Effect\` on a node. Effects: \`NoSchedule\` (no new Pods without toleration), \`PreferNoSchedule\` (avoid if possible), \`NoExecute\` (also evicts running Pods that do not tolerate it).`,
    components: [
      { name: 'kube-scheduler', description: 'Control-plane component that filters, scores and binds unscheduled Pods.' },
      { name: 'nodeSelector', description: 'Hard requirement on node labels, exact key/value match.' },
      { name: 'Node affinity', description: 'Required or preferred rules on node labels with set-based operators.' },
      { name: 'Pod (anti-)affinity', description: 'Co-locate with or keep away from Pods matching a label selector, per topology domain.' },
      { name: 'Taints & tolerations', description: 'Node-side repulsion; a toleration permits (but does not force) placement on a tainted node.' },
      { name: 'PriorityClass', description: 'Gives Pods a priority value used for queue order and preemption.' },
    ],
    misconceptions: [
      {
        myth: 'A toleration makes a Pod run on the tainted node.',
        reality: `A toleration only **allows** it. To **attract** a Pod to dedicated nodes you combine a toleration (allowed in) with node affinity or \`nodeSelector\` (must go there).`,
      },
      {
        myth: '"IgnoredDuringExecution" means the rule is ignored.',
        reality: `It means the rule is checked **at scheduling time only**. If node labels change later, already-running Pods are not evicted. (\`NoExecute\` taints, by contrast, do evict.)`,
      },
      {
        myth: 'The scheduler starts the Pod on the chosen node.',
        reality: `The scheduler only writes the binding. The **kubelet** on that node sees a Pod assigned to it and starts the containers via the container runtime.`,
      },
    ],
    example: {
      title: 'Dedicating GPU nodes and spreading replicas',
      description: `First taint and label the GPU node so ordinary Pods stay off. Then the GPU workload both tolerates the taint and requires the label, and anti-affinity keeps its replicas on different nodes.`,
      language: 'yaml',
      code: `# kubectl taint nodes gpu-node-1 dedicated=gpu:NoSchedule
# kubectl label nodes gpu-node-1 accelerator=nvidia
# (repeat for gpu-node-2: the required anti-affinity needs one GPU node per replica)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: trainer
spec:
  replicas: 2
  selector:
    matchLabels:
      app: trainer
  template:
    metadata:
      labels:
        app: trainer
    spec:
      tolerations:
        - key: dedicated
          operator: Equal
          value: gpu
          effect: NoSchedule
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
              - matchExpressions:
                  - key: accelerator
                    operator: In
                    values: ["nvidia"]
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            - labelSelector:
                matchLabels:
                  app: trainer
              topologyKey: kubernetes.io/hostname
      containers:
        - name: trainer
          image: example.com/trainer:1.0`,
    },
    exercise: {
      prompt: `A Pod is \`Pending\`. \`kubectl describe pod\` shows: \`0/3 nodes are available: 1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }, 2 Insufficient cpu.\` Explain what the scheduler did and name two possible fixes.`,
      solution: `The **filter** phase eliminated all three nodes: the control-plane node because the Pod does not tolerate its \`NoSchedule\` taint, and both workers because the Pod's **CPU request** exceeds their remaining allocatable CPU. With zero feasible nodes there is nothing to score, so the Pod stays Pending.

Fixes: lower the Pod's CPU request if it is over-stated; free capacity (scale down other workloads or add nodes, e.g. via Cluster Autoscaler); or give the Pod a higher priority so it can preempt lower-priority Pods. Adding a control-plane toleration is possible but usually a bad idea for application workloads.`,
    },
    faq: [
      {
        q: 'What happens if I set spec.nodeName directly?',
        a: `The scheduler is bypassed entirely — the kubelet on that node just tries to run the Pod. Resource and taint checks by the scheduler are skipped, so this is rarely what you want.`,
      },
      {
        q: 'Why do my control-plane nodes run no application Pods?',
        a: `kubeadm-style clusters taint them with \`node-role.kubernetes.io/control-plane:NoSchedule\`. Only Pods that tolerate that taint (typically system DaemonSets) run there.`,
      },
      {
        q: 'Can I run more than one scheduler?',
        a: `Yes. A Pod chooses one with \`spec.schedulerName\`; the default is \`default-scheduler\`.`,
      },
    ],
    keyTerms: ['kube-scheduler', 'filtering and scoring', 'nodeSelector', 'node affinity', 'pod anti-affinity', 'taint', 'toleration', 'preemption'],
    deeper: `**topologySpreadConstraints** are a more direct way to spread Pods evenly across zones or nodes than anti-affinity, using \`maxSkew\` and \`whenUnsatisfiable\`. The scheduler itself is built on a **scheduling framework** of plugins (QueueSort, PreFilter, Filter, Score, Reserve, Permit, Bind …) configured through a \`KubeSchedulerConfiguration\`, which is how features like these are implemented and how custom placement logic is added without forking the scheduler.`,
    references: [
      { title: 'Kubernetes docs: Assigning Pods to Nodes', url: 'https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/' },
      { title: 'Kubernetes docs: Taints and Tolerations', url: 'https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/' },
      { title: 'Kubernetes docs: Scheduling, Preemption and Eviction', url: 'https://kubernetes.io/docs/concepts/scheduling-eviction/' },
    ],
  },
  // ───────────────────────────── Stage 3 · Networking ─────────────────────────────
  {
    id: 'pod-networking-and-cni',
    title: 'The Pod Network Model and CNI',
    stage: 3,
    order: 1,
    objectives: ['co-networking'],
    scope: 'kcna',
    estMinutes: 20,
    summary:
      'Kubernetes requires a flat network where every Pod has its own IP and can reach every other Pod without NAT. It does not implement that network itself — a CNI plugin such as Calico, Cilium or Flannel does.',
    what: `The **Kubernetes network model** is a short list of requirements, not an implementation:

- Every Pod gets its **own IP address**. Containers in the same Pod share it (and talk to each other over \`localhost\`).
- Every Pod can reach every other Pod, on any node, **without NAT** — the IP a Pod sees for itself is the IP others see.
- Agents on a node (such as the kubelet) can reach all Pods on that node.

The **Container Network Interface (CNI)** is a CNCF specification for plugins that set up this network. Kubernetes ships **no** Pod network of its own: a fresh cluster without a CNI plugin has nodes that stay \`NotReady\` and Pods that cannot start networking.`,
    why: `The "IP-per-Pod, no NAT" rule makes Pods behave like small VMs on a flat network. Applications can use normal ports without collisions (two Pods can both listen on 8080), service discovery can hand out real IPs, and network policies can match real source addresses.

Compare this with plain Docker on a single host, where containers sit behind NAT and you juggle host-port mappings like \`-p 8081:80\`, \`-p 8082:80\`. That model does not scale to thousands of containers across hundreds of machines.`,
    problem: `Making every Pod reachable from every node is genuinely hard: Pods come and go every second, each node needs a slice of addresses, and packets must find their way across a physical network that knows nothing about Pod IPs.

Every environment solves this differently — cloud VPC routing, BGP in a data centre, an overlay tunnel on a laptop. A pluggable interface lets Kubernetes stay neutral while each environment picks the right plugin.`,
    how: `Trace what happens when a Pod is created on a node:

- The kubelet asks the **container runtime** (containerd or CRI-O, via CRI) to create the **Pod sandbox**. The runtime creates a new **network namespace** for the Pod (held open by the small "pause" container).
- The runtime calls the configured **CNI plugin binary** (configured under \`/etc/cni/net.d/\`) with the operation \`ADD\`, the namespace path and the container ID.
- The plugin creates a virtual interface pair (a **veth pair**): one end becomes \`eth0\` inside the Pod, the other stays on the host. Its **IPAM** part allocates an IP from the node's Pod CIDR range.
- The plugin programs routes so traffic can reach this Pod: either by **routing** (e.g. Calico distributing routes via BGP, or cloud VPC routes) or by an **overlay** that wraps Pod packets in node-to-node packets (e.g. VXLAN in Flannel).
- The IP is returned to the runtime and reported in \`status.podIP\`. When the Pod is deleted, the runtime calls \`DEL\` to clean up.

Popular plugins to recognise:

- **Flannel** — simple overlay (VXLAN). Does **not** enforce NetworkPolicy by itself.
- **Calico** — routed networking (BGP) or overlay, with strong NetworkPolicy support.
- **Cilium** — built on **eBPF** in the Linux kernel; NetworkPolicy including L7, observability via Hubble, can replace kube-proxy.`,
    components: [
      { name: 'CNI specification', description: 'CNCF standard defining how a runtime calls network plugins (`ADD`, `DEL`, `CHECK`) and the JSON config format.' },
      { name: 'CNI plugin', description: 'Executable (often deployed as a DaemonSet that installs it) that wires Pods into the network.' },
      { name: 'IPAM', description: 'IP address management: hands out Pod IPs from a per-node or pooled range.' },
      { name: 'veth pair', description: 'Virtual cable connecting the Pod’s network namespace to the host.' },
      { name: 'Overlay vs routed', description: 'Overlay encapsulates Pod traffic between nodes (VXLAN, Geneve); routed mode makes Pod IPs routable on the underlying network.' },
    ],
    misconceptions: [
      {
        myth: 'kube-proxy gives Pods their IP addresses.',
        reality: `Pod IPs come from the **CNI plugin**. kube-proxy deals with **Service** virtual IPs, translating them to Pod IPs.`,
      },
      {
        myth: 'Every CNI plugin enforces NetworkPolicies.',
        reality: `NetworkPolicy objects are accepted by the API server regardless, but they only take effect if the CNI plugin implements them. Plain Flannel silently ignores them.`,
      },
      {
        myth: 'Containers in the same Pod each get their own IP.',
        reality: `All containers in a Pod share one network namespace and one IP. They reach each other on \`localhost\` and must not listen on the same port.`,
      },
    ],
    example: {
      title: 'Seeing the flat network',
      description: `Pod IPs are visible directly and reachable from other Pods on other nodes. Here a throwaway Pod fetches a page from another Pod by IP (the IP comes from the first command).`,
      language: 'bash',
      code: `kubectl get pods -o wide
# NAME          READY   STATUS    IP            NODE
# web-6d4b-abc  1/1     Running   10.244.1.12   worker-1
# web-6d4b-def  1/1     Running   10.244.2.7    worker-2

kubectl run tmp --rm -it --image=busybox:1.36 --restart=Never -- \\
  wget -qO- http://10.244.2.7:80

# Which CNI is installed? Usually a DaemonSet in kube-system:
kubectl get daemonsets -n kube-system`,
    },
    exercise: {
      prompt: `You create a new cluster with kubeadm. All nodes report \`NotReady\` and CoreDNS Pods are stuck in \`Pending\` or \`ContainerCreating\`. What is the most likely missing piece, and why does it affect CoreDNS but not the static control-plane Pods?`,
      solution: `**No CNI plugin is installed.** The kubelet reports the node NotReady because the container runtime's network is not ready, and ordinary Pods like CoreDNS cannot get a Pod network.

The control-plane Pods (kube-apiserver, etcd …) run with \`hostNetwork: true\`: they use the node's own network namespace, so they do not need CNI. Installing a plugin (e.g. applying the Calico, Cilium or Flannel manifests) makes nodes Ready and lets CoreDNS start.`,
    },
    faq: [
      {
        q: 'Is CNI only used by Kubernetes?',
        a: `No. CNI is a generic CNCF specification also used by other container platforms. Kubernetes uses it through the container runtime.`,
      },
      {
        q: 'Do Pod IPs stay the same when a Pod is recreated?',
        a: `Generally no. A replacement Pod gets a new IP. That is why clients use **Services** and DNS instead of Pod IPs.`,
      },
      {
        q: 'Can I run two CNI plugins?',
        a: `Normally one plugin owns the Pod network. Some setups chain plugins (for example a main plugin plus a bandwidth or port-mapping plugin), and meta-plugins such as Multus attach extra interfaces — that is beyond KCNA.`,
      },
    ],
    keyTerms: ['Kubernetes network model', 'CNI', 'IP-per-Pod', 'network namespace', 'veth pair', 'IPAM', 'overlay network', 'eBPF'],
    deeper: `Three address ranges coexist in a cluster: **node IPs** (the machines), the **Pod CIDR** (often split into a per-node range recorded in \`node.spec.podCIDR\`), and the **Service CIDR** (virtual IPs implemented by kube-proxy's forwarding rules, not assigned to any Pod). They must not overlap with each other or with networks the cluster needs to reach. Dual-stack (IPv4 + IPv6) clusters give each Pod one address of each family.`,
    references: [
      { title: 'Kubernetes docs: Cluster Networking', url: 'https://kubernetes.io/docs/concepts/cluster-administration/networking/' },
      { title: 'Kubernetes docs: Services, Load Balancing, and Networking', url: 'https://kubernetes.io/docs/concepts/services-networking/' },
      { title: 'CNI project on GitHub', url: 'https://github.com/containernetworking/cni' },
    ],
  },
  {
    id: 'services',
    title: 'Services and kube-proxy',
    stage: 3,
    order: 2,
    objectives: ['co-networking'],
    scope: 'kcna',
    estMinutes: 25,
    summary:
      'A Service gives a changing set of Pods one stable name and virtual IP. Its type decides who can reach it: ClusterIP (inside), NodePort (node ports), LoadBalancer (external LB) or ExternalName (DNS alias).',
    what: `A **Service** is a stable front door for a group of Pods selected by **labels**. Pods are ephemeral — they are replaced, rescheduled, scaled, and every replacement gets a new IP. The Service stays put: it has a fixed **virtual IP (ClusterIP)**, a DNS name, and a port, and it load-balances connections across whichever matching Pods are Ready right now.

Service **types** (the first three each build on the previous one):

- **ClusterIP** (default) — reachable only from inside the cluster.
- **NodePort** — also opens the same port (default range **30000–32767**) on **every node**.
- **LoadBalancer** — also asks the cloud provider (or a bare-metal implementation like MetalLB) for an external load balancer pointing at the node ports.
- **ExternalName** — no proxying at all; DNS returns a **CNAME** to an external hostname.

Plus a special case: a **headless** Service (\`clusterIP: None\`) gets no virtual IP; DNS returns the Pod IPs directly.`,
    why: `Without Services, every client would need to discover current Pod IPs itself and handle every restart. Services decouple **who provides** a function from **where it currently runs** — the core of service discovery in Kubernetes. They also give you a built-in, if basic, L4 load balancer.`,
    problem: `A frontend hard-codes the backend Pod IP \`10.244.2.7\`. The backend Deployment rolls out a new version; the new Pods have new IPs; the frontend fails with "connection refused". Then someone scales the backend to 5 replicas and the frontend keeps sending everything to one of them.

A Service named \`backend\` fixes both: clients call \`backend:8080\`, and the platform keeps the Pod list current.`,
    how: `Follow a request from a client Pod to \`backend:80\` (ClusterIP):

- The client resolves \`backend\` via cluster DNS and gets the Service's ClusterIP, e.g. \`10.96.40.12\`.
- Meanwhile the **EndpointSlice controller** has been watching Pods that match the Service's \`selector\` and recording their IPs, ports and readiness in **EndpointSlice** objects.
- **kube-proxy**, running on every node, watches Services and EndpointSlices and programs the node's packet-handling rules (iptables, IPVS or nftables mode).
- The client sends a packet to \`10.96.40.12:80\`. No Pod owns this IP. The node's rules match it and rewrite (**DNAT**) the destination to one Ready Pod, e.g. \`10.244.1.12:8080\` — the Service's \`targetPort\`.
- The packet travels over the Pod network to that Pod; the reply is translated back so the client sees it coming from the Service IP.

For **NodePort**, the same rules also match traffic arriving at \`<any-node-IP>:<nodePort>\`. For **LoadBalancer**, the cloud load balancer sends traffic to the node ports (or, in some implementations, directly to Pods).

Ports to keep straight: \`port\` = the Service's port; \`targetPort\` = the container's port (defaults to \`port\`); \`nodePort\` = the port on each node.`,
    components: [
      { name: 'Service', description: 'Stable virtual IP + DNS name + port for a label-selected set of Pods.' },
      { name: 'EndpointSlice', description: 'Scalable, sharded list of backend addresses and their readiness; successor to the older Endpoints API.' },
      { name: 'kube-proxy', description: 'Node agent that turns Services into packet-forwarding rules (iptables, IPVS or nftables). Some CNIs, like Cilium, can replace it.' },
      { name: 'ClusterIP / NodePort / LoadBalancer', description: 'Increasingly exposed Service types; each includes the capabilities of the previous one.' },
      { name: 'ExternalName', description: 'DNS-only alias (CNAME) to an external name; no selector, no proxying.' },
      { name: 'Headless Service', description: '`clusterIP: None`; DNS returns Pod IPs, used by StatefulSets and client-side load balancing.' },
    ],
    misconceptions: [
      {
        myth: 'You can ping a ClusterIP.',
        reality: `A ClusterIP is a virtual address that exists only in forwarding rules for the declared ports. ICMP ping usually fails even when the Service works. Test with the actual protocol, e.g. \`wget\` or \`curl\` to the port.`,
      },
      {
        myth: 'kube-proxy is a proxy that every request passes through.',
        reality: `In its normal modes kube-proxy only **programs kernel rules**; packets are forwarded by the kernel, not by the kube-proxy process. The name comes from an early userspace mode.`,
      },
      {
        myth: 'A Service sends traffic to all Pods that match its selector.',
        reality: `Only to **Ready** Pods. A Pod failing its readiness probe is marked not ready in the EndpointSlice and receives no new traffic.`,
      },
    ],
    example: {
      title: 'A ClusterIP Service in front of a Deployment',
      description: `The selector must match the Pod template labels, and \`targetPort\` must match the container port. Check the result with \`kubectl get endpointslices -l kubernetes.io/service-name=backend\` — an empty list of endpoints almost always means a selector or readiness problem.`,
      language: 'yaml',
      code: `apiVersion: v1
kind: Service
metadata:
  name: backend
spec:
  type: ClusterIP        # the default; may be omitted
  selector:
    app: backend
  ports:
    - name: http
      port: 80           # clients connect to backend:80
      targetPort: 8080   # container listens on 8080`,
    },
    exercise: {
      prompt: `A Service \`web\` of type NodePort shows \`80:31080/TCP\`. Its selector is \`app: web\`, but the Deployment's Pods are labelled \`app: website\`. List what works and what fails for (a) \`curl web\` from another Pod, (b) \`curl <nodeIP>:31080\` from outside, and say how you would detect the root cause quickly.`,
      solution: `Both **fail**: DNS resolves \`web\` and the node port is open, but the Service has **no endpoints**, so there is nowhere to forward traffic (typically "connection refused" or a timeout).

Detect it with \`kubectl get endpointslices -l kubernetes.io/service-name=web\` (or \`kubectl describe service web\`, which shows an empty \`Endpoints\` line) and compare \`kubectl get pods --show-labels\` with the Service selector. Fix the selector or the labels.`,
    },
    faq: [
      {
        q: 'Which Service type should I use to expose an HTTP app to the internet?',
        a: `Usually not one LoadBalancer per app. Use a ClusterIP Service behind an **Ingress** or **Gateway API** controller, which itself is exposed by one LoadBalancer and routes by host and path.`,
      },
      {
        q: 'Can a Service point at something outside the cluster?',
        a: `Yes: use \`ExternalName\` for a DNS alias, or create a Service **without a selector** and manage its EndpointSlices yourself to point at fixed IPs.`,
      },
      {
        q: 'What does kubectl expose do?',
        a: `It creates a Service for an existing resource, copying its selector — e.g. \`kubectl expose deployment backend --port=80 --target-port=8080\` creates a ClusterIP Service.`,
      },
    ],
    keyTerms: ['ClusterIP', 'NodePort', 'LoadBalancer', 'ExternalName', 'headless Service', 'EndpointSlice', 'kube-proxy', 'targetPort'],
    diagram: 'service-networking',
    deeper: `\`externalTrafficPolicy: Local\` makes NodePort/LoadBalancer traffic go only to Pods on the receiving node, which preserves the client source IP and avoids an extra hop at the cost of uneven balancing. \`internalTrafficPolicy\` and topology-aware routing similarly keep in-cluster traffic close to the client. \`sessionAffinity: ClientIP\` pins a client to one backend. For very large numbers of Services, the **nftables** mode (GA in 1.33) scales better than iptables; the older IPVS mode is no longer the recommended direction.`,
    references: [
      { title: 'Kubernetes docs: Service', url: 'https://kubernetes.io/docs/concepts/services-networking/service/' },
      { title: 'Kubernetes docs: EndpointSlices', url: 'https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/' },
      { title: 'Kubernetes docs: Virtual IPs and Service Proxies', url: 'https://kubernetes.io/docs/reference/networking/virtual-ips/' },
    ],
  },
  {
    id: 'dns-and-coredns',
    title: 'Cluster DNS and CoreDNS',
    stage: 3,
    order: 3,
    objectives: ['co-networking'],
    scope: 'kcna',
    estMinutes: 16,
    summary:
      'CoreDNS gives every Service (and some Pods) a predictable DNS name such as backend.shop.svc.cluster.local, and each Pod’s resolv.conf is set up so short names like backend just work.',
    what: `Kubernetes clusters run a DNS server — today almost always **CoreDNS**, a CNCF graduated project — as a Deployment in \`kube-system\`, exposed by a Service that is still named \`kube-dns\` for compatibility.

It answers queries for cluster names following a fixed pattern:

- Service: \`<service>.<namespace>.svc.<cluster-domain>\` → the ClusterIP (an A/AAAA record). The cluster domain is usually \`cluster.local\`.
- Headless Service: the same name → the IPs of all Ready Pods.
- StatefulSet Pod behind a headless Service: \`<pod>.<service>.<namespace>.svc.cluster.local\`, e.g. \`db-0.db.shop.svc.cluster.local\`.
- Named ports also get **SRV** records: \`_http._tcp.backend.shop.svc.cluster.local\`.

Anything outside the cluster domain is forwarded to upstream resolvers.`,
    why: `Services give stable IPs, but nobody wants to configure \`10.96.40.12\` in an app. DNS is the universal service-discovery protocol every language and library already speaks, so Kubernetes publishes Services in DNS and applications can say \`http://backend\`.`,
    problem: `Consider the question "why can my Pod reach \`backend\` but not \`backend\` in another namespace?" Answering it requires understanding search domains. Or "why are my external API lookups slow?" — that comes from the \`ndots\` setting. DNS issues are among the most common networking tickets in Kubernetes, and most come from not knowing how a short name expands.`,
    how: `Trace a lookup of \`backend\` from a Pod in namespace \`shop\`:

- When the kubelet creates the Pod (with the default \`dnsPolicy: ClusterFirst\`), it writes the Pod's \`/etc/resolv.conf\`:

\`\`\`text
nameserver 10.96.0.10
search shop.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
\`\`\`

- \`nameserver\` is the ClusterIP of the \`kube-dns\` Service, so queries are load-balanced across CoreDNS Pods.
- \`backend\` has fewer than 5 dots, so the resolver tries the **search list** in order: \`backend.shop.svc.cluster.local\` first. That matches, so CoreDNS returns the ClusterIP.
- To reach a Service in another namespace, use at least \`backend.payments\` (which expands to \`backend.payments.svc.cluster.local\`) or the full name.
- CoreDNS knows the answer because its **kubernetes plugin** watches Services and EndpointSlices through the API server and builds records in memory.
- For \`api.example.com\` (2 dots < 5), the resolver first tries the search domains (all NXDOMAIN), then the name as-is, which CoreDNS **forwards** upstream.

CoreDNS behaviour is configured by a **Corefile** stored in the \`coredns\` ConfigMap in \`kube-system\`.`,
    components: [
      { name: 'CoreDNS', description: 'Plugin-based DNS server; the default cluster DNS add-on (replaced kube-dns); CNCF graduated.' },
      { name: 'kube-dns Service', description: 'ClusterIP Service in `kube-system` fronting the CoreDNS Pods; its IP is the Pods’ nameserver.' },
      { name: 'Corefile', description: 'CoreDNS configuration (in the `coredns` ConfigMap): kubernetes plugin, forward, cache, etc.' },
      { name: 'resolv.conf search list', description: 'Lets short names expand to `<name>.<ns>.svc.cluster.local`.' },
      { name: 'dnsPolicy', description: '`ClusterFirst` (default), `Default` (inherit node resolver), `ClusterFirstWithHostNet`, `None` (use `dnsConfig`).' },
    ],
    misconceptions: [
      {
        myth: 'dnsPolicy: Default is the default DNS policy.',
        reality: `Confusingly, no. The default is \`ClusterFirst\`. \`Default\` means "inherit the node's resolver" and gives the Pod **no** cluster DNS.`,
      },
      {
        myth: 'A short Service name resolves across all namespaces.',
        reality: `A bare name only resolves within the Pod's **own** namespace (first search domain). Other namespaces need \`name.namespace\` or the FQDN.`,
      },
      {
        myth: 'Every Pod gets a DNS name based on its Pod name.',
        reality: `Stable per-Pod names exist for Pods behind a headless Service with \`hostname\`/\`subdomain\` set — which StatefulSets do automatically. Ordinary Deployment Pods are addressed through their Service name.`,
      },
    ],
    example: {
      title: 'Debugging name resolution from inside the cluster',
      description: `A temporary Pod lets you see exactly what an application Pod sees.`,
      language: 'bash',
      code: `kubectl run dnstest --rm -it --image=busybox:1.36 --restart=Never -n shop -- sh
# inside the Pod:
cat /etc/resolv.conf
nslookup backend                                # same namespace
nslookup backend.payments                       # other namespace
nslookup backend.payments.svc.cluster.local     # fully qualified
exit

# Is CoreDNS healthy?
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns`,
    },
    exercise: {
      prompt: `A Pod in namespace \`web\` calls \`http://orders:8080\` and gets "could not resolve host". The \`orders\` Service exists in namespace \`sales\` and has endpoints. Explain the failure and give two correct names the client could use.`,
      solution: `The short name expands only through the Pod's search list, starting with \`orders.web.svc.cluster.local\` — there is no \`orders\` Service in \`web\`, and the other search domains (\`orders.svc.cluster.local\`, \`orders.cluster.local\`) do not match a Service either.

Use \`orders.sales\` or the FQDN \`orders.sales.svc.cluster.local\` (port 8080 in both cases).`,
    },
    faq: [
      {
        q: 'Why is the CoreDNS Service called kube-dns?',
        a: `kube-dns was the previous DNS add-on. When CoreDNS replaced it, the Service name was kept so existing configuration (and the kubelet's \`clusterDNS\` setting) kept working.`,
      },
      {
        q: 'Does DNS give me load balancing?',
        a: `For a normal Service, DNS returns one ClusterIP and kube-proxy does the balancing. For a headless Service, DNS returns several Pod IPs and the client decides — which is not true load balancing if the client caches the first answer.`,
      },
    ],
    keyTerms: ['CoreDNS', 'kube-dns', 'cluster.local', 'FQDN', 'search domain', 'ndots', 'dnsPolicy', 'SRV record'],
    deeper: `\`ndots:5\` means names with fewer than five dots try the search list first, so external lookups can cost several extra queries. Workarounds include using a trailing dot (\`api.example.com.\`), lowering \`ndots\` via \`dnsConfig.options\`, or running **NodeLocal DNSCache**, a DaemonSet that caches DNS on every node to cut latency and conntrack pressure.`,
    references: [
      { title: 'Kubernetes docs: DNS for Services and Pods', url: 'https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/' },
      { title: 'Kubernetes task: Debugging DNS Resolution', url: 'https://kubernetes.io/docs/tasks/administer-cluster/dns-debugging-resolution/' },
      { title: 'CNCF projects', url: 'https://www.cncf.io/projects/' },
    ],
  },
  {
    id: 'ingress-and-gateway-api',
    title: 'Ingress and the Gateway API',
    stage: 3,
    order: 4,
    objectives: ['co-networking'],
    scope: 'kcna',
    estMinutes: 22,
    summary:
      'Ingress and Gateway API describe HTTP(S) routing from outside the cluster to Services by host and path. Both need a controller to do the work; Gateway API is the newer, role-oriented, more expressive successor.',
    what: `Both are **L7 (HTTP/HTTPS) routing APIs**: "send \`shop.example.com/api\` to Service \`api\`, everything else to Service \`web\`, terminate TLS with this certificate."

- **Ingress** (\`networking.k8s.io/v1\`) — one resource with rules (host, path → backend Service) and optional TLS. Stable, widely supported, but **feature-frozen**: no new features are being added, so controllers extend it with vendor-specific **annotations**.
- **Gateway API** (\`gateway.networking.k8s.io\`, GA since v1.0 in October 2023) — a family of resources split by role: **GatewayClass** (which implementation), **Gateway** (a listener: address, port, protocol, TLS), and **Routes** such as **HTTPRoute** (matching and forwarding rules). It is installed as **CRDs**, separately from core Kubernetes.

Neither does anything on its own. An **Ingress controller** or **Gateway API implementation** (e.g. Envoy Gateway, Istio, Cilium, NGINX Gateway Fabric, Traefik, cloud load balancer controllers) watches these objects and configures a real proxy.`,
    why: `A LoadBalancer Service per application is expensive (one cloud LB each) and only understands TCP/UDP ports. Real web traffic needs **host- and path-based routing**, TLS termination, redirects and traffic splitting — all behind **one** entry point.`,
    problem: `Ingress solved the single-entry-point problem, but its API was too small. Header matching, traffic weights, TCP/gRPC routing and cross-namespace delegation ended up in annotations that differ per controller, so a manifest written for one controller silently means nothing to another. And one Ingress object mixed concerns: the platform team's TLS/listener settings and the app team's routes lived in the same resource.

Gateway API fixes both: rich features are **portable fields**, and responsibilities are split across resources so infrastructure providers, cluster operators and app developers each own their part.`,
    how: `Trace a request to \`https://shop.example.com/api/orders\` through Gateway API:

- **Infrastructure provider** installs an implementation, which registers a **GatewayClass** (e.g. \`example-gateway-class\`).
- **Cluster operator** creates a **Gateway** in namespace \`infra\` referencing that class: listener on port 443, HTTPS, hostname \`*.example.com\`, certificate from a Secret, and \`allowedRoutes\` saying which namespaces may attach routes.
- The controller sees the Gateway and provisions/configures a data-plane proxy, usually exposed through a LoadBalancer Service with a public IP.
- **App developer** in namespace \`shop\` creates an **HTTPRoute** with \`parentRefs\` pointing at that Gateway: host \`shop.example.com\`, path prefix \`/api\` → Service \`api\` port 8080.
- The client's request hits the load balancer → proxy. The proxy terminates TLS, matches host and path, and forwards to a Ready Pod behind Service \`api\`.

With **Ingress** the same flow is collapsed: an Ingress controller (itself a Deployment exposed by a LoadBalancer Service) watches **Ingress** objects whose \`ingressClassName\` matches it, and turns each rule (\`host\`, \`path\`, \`pathType\` of \`Prefix\`/\`Exact\`/\`ImplementationSpecific\`, backend Service) into proxy configuration.`,
    components: [
      { name: 'Ingress', description: 'Single resource for HTTP(S) host/path routing and TLS; stable and frozen.' },
      { name: 'Ingress controller / IngressClass', description: 'The software that implements Ingress; `ingressClassName` selects which controller handles an object.' },
      { name: 'GatewayClass', description: 'Cluster-scoped: names a Gateway implementation (like StorageClass for storage).' },
      { name: 'Gateway', description: 'An instance of a load balancer/proxy with listeners (port, protocol, hostname, TLS).' },
      { name: 'HTTPRoute (and GRPCRoute, …)', description: 'Routing rules that attach to a Gateway via `parentRefs`; support header matching, weights, redirects.' },
    ],
    misconceptions: [
      {
        myth: 'Creating an Ingress object exposes my app.',
        reality: `Without an Ingress controller running in the cluster, an Ingress is just stored data — nothing listens. The same is true for Gateway resources without an implementation.`,
      },
      {
        myth: 'Gateway API is a service mesh or an API gateway product.',
        reality: `It is a **Kubernetes API specification** (a set of CRDs). Many products implement it; some meshes also use it for east-west traffic, but the API itself is just the contract.`,
      },
      {
        myth: 'Ingress is deprecated and will be removed.',
        reality: `Ingress is **GA and frozen**, not deprecated. It remains supported; new capabilities go into Gateway API instead.`,
      },
    ],
    example: {
      title: 'The same routing as Ingress and as HTTPRoute',
      description: `Both send \`shop.example.com/api\` to Service \`api:8080\`. The HTTPRoute assumes a Gateway named \`public\` already exists in namespace \`infra\`.`,
      language: 'yaml',
      code: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
spec:
  ingressClassName: nginx
  tls:
    - hosts: ["shop.example.com"]
      secretName: shop-tls
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 8080
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: shop
spec:
  parentRefs:
    - name: public
      namespace: infra
  hostnames: ["shop.example.com"]
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /api
      backendRefs:
        - name: api
          port: 8080`,
    },
    exercise: {
      prompt: `You want to send 90% of traffic for \`/checkout\` to Service \`checkout-v1\` and 10% to \`checkout-v2\`, portably across implementations. Which API do you choose and which field makes it possible?`,
      solution: `**Gateway API.** An HTTPRoute rule can list several \`backendRefs\`, each with a \`weight\` (e.g. 90 and 10). Core Ingress has no standard traffic-splitting field; you would depend on controller-specific annotations.`,
    },
    faq: [
      {
        q: 'Does Ingress handle TCP or UDP traffic?',
        a: `Not in the standard API — Ingress is for HTTP and HTTPS. Gateway API adds \`GRPCRoute\` (Standard channel) for gRPC, plus \`TLSRoute\`, \`TCPRoute\` and \`UDPRoute\` for non-HTTP traffic — check each one's release channel and your implementation's support, as some have long been Experimental-only.`,
      },
      {
        q: 'Do I need to migrate from Ingress to Gateway API now?',
        a: `For the exam, know that Gateway API is the recommended future direction and is GA. In practice, Ingress keeps working; migration is driven by needing Gateway API features or by your controller's support plans.`,
      },
      {
        q: 'Where does TLS get terminated?',
        a: `At the proxy run by the controller, using a certificate stored in a Kubernetes Secret (type \`kubernetes.io/tls\`) referenced from the Ingress \`tls\` section or the Gateway listener.`,
      },
    ],
    keyTerms: ['Ingress', 'Ingress controller', 'IngressClass', 'Gateway API', 'GatewayClass', 'Gateway', 'HTTPRoute', 'TLS termination'],
    diagram: 'ingress-flow',
    deeper: `Gateway API ships in two release channels: **Standard** (stable resources such as GatewayClass, Gateway, HTTPRoute, GRPCRoute) and **Experimental**. **ReferenceGrant** controls cross-namespace references, for example a route in one namespace pointing at a Service in another. The **GAMMA** initiative extends Gateway API to service-mesh (east-west) traffic by attaching routes to Services instead of Gateways. Note also that the community **ingress-nginx** controller (\`kubernetes/ingress-nginx\`) has been retired: Kubernetes SIG Network announced it in November 2025, with best-effort maintenance ending in March 2026. That affects one controller, not the Ingress API — other Ingress controllers continue — but do not pick ingress-nginx for new clusters.`,
    references: [
      { title: 'Kubernetes docs: Ingress', url: 'https://kubernetes.io/docs/concepts/services-networking/ingress/' },
      { title: 'Kubernetes docs: Gateway API', url: 'https://kubernetes.io/docs/concepts/services-networking/gateway/' },
      { title: 'Gateway API project site', url: 'https://gateway-api.sigs.k8s.io/' },
    ],
  },
  {
    id: 'network-policies',
    title: 'NetworkPolicies',
    stage: 3,
    order: 5,
    objectives: ['co-networking', 'co-security'],
    scope: 'kcna',
    estMinutes: 20,
    summary:
      'By default every Pod can talk to every Pod. NetworkPolicies are namespaced, additive allow-lists for L3/L4 traffic, enforced by the CNI plugin, that let you move to “deny by default, allow what is needed”.',
    what: `A **NetworkPolicy** (\`networking.k8s.io/v1\`) is a namespaced object that selects Pods with a \`podSelector\` and declares which **ingress** (incoming) and/or **egress** (outgoing) connections they may have, by:

- \`podSelector\` — Pods in the same namespace with given labels;
- \`namespaceSelector\` — all Pods in namespaces with given labels;
- \`ipBlock\` — CIDR ranges (typically for traffic outside the cluster);
- \`ports\` — protocol and port.

Policies only **allow**. There is no "deny" rule. Denial comes from **isolation**: once any policy selects a Pod for a direction, everything in that direction not explicitly allowed by some policy is dropped.`,
    why: `The flat Pod network is convenient but means a compromised frontend Pod can open connections to your database, your metrics endpoints and every other namespace. NetworkPolicies give you **segmentation** — the Kubernetes version of firewall rules — and are a core part of defence in depth and zero-trust networking.`,
    problem: `Firewalls based on IP addresses do not work for Pods: IPs change every time a Pod restarts. NetworkPolicies select peers by **labels**, so "frontend may talk to backend on 8080" stays true no matter how often Pods are rescheduled.`,
    how: `Think of each Pod as having two gates, IN and OUT, both **open** by default. Evaluate a policy set like this:

- Find all policies in the Pod's namespace whose \`podSelector\` matches the Pod.
- If any of them lists \`Ingress\` in \`policyTypes\`, the IN gate becomes **isolated**: only connections matching at least one ingress rule of those policies are allowed. Same for \`Egress\` and the OUT gate.
- Allowed rules from all matching policies are **unioned** (additive). Order does not matter; there is no conflict.
- For a connection between two Pods to succeed, the source's egress **and** the destination's ingress must both allow it.
- Replies to an allowed connection are automatically permitted (policies are stateful).
- Enforcement is done by the **CNI plugin** (Calico, Cilium, etc.). The API server stores policies even if nothing enforces them.

Selector logic inside a single \`from\` entry matters:

- Two **separate list items** (\`- namespaceSelector\` and \`- podSelector\`) mean **OR**.
- \`namespaceSelector\` and \`podSelector\` in the **same** item mean **AND** (those Pods, in those namespaces).

Namespaces automatically carry the label \`kubernetes.io/metadata.name: <name>\`, which is handy for selecting a namespace by name.`,
    components: [
      { name: 'podSelector (spec)', description: 'Which Pods the policy applies to; `{}` selects all Pods in the namespace.' },
      { name: 'policyTypes', description: '`Ingress`, `Egress` or both — which directions become isolated.' },
      { name: 'ingress.from / egress.to', description: 'Allowed peers: podSelector, namespaceSelector, ipBlock.' },
      { name: 'ports', description: 'Allowed protocol/port pairs for the rule.' },
      { name: 'CNI enforcement', description: 'The network plugin translates policies into data-plane rules; without support they do nothing.' },
    ],
    misconceptions: [
      {
        myth: 'NetworkPolicy rules are evaluated in order, like a firewall with deny rules.',
        reality: `There is no order and no deny rule in the core API. Policies are additive allow-lists; isolation provides the default deny.`,
      },
      {
        myth: 'Creating a NetworkPolicy always changes traffic.',
        reality: `Only if the CNI plugin enforces policies. On a cluster using plain Flannel, a default-deny policy is accepted and silently has no effect.`,
      },
      {
        myth: 'A default-deny egress policy only blocks external traffic.',
        reality: `It blocks **all** egress, including DNS lookups to CoreDNS. Pods suddenly cannot resolve names. You must explicitly allow UDP/TCP port 53 to the DNS Pods.`,
      },
    ],
    example: {
      title: 'Default-deny plus one allowed path',
      description: `The first policy isolates every Pod in \`shop\` for ingress. The second re-opens exactly one path: Pods labelled \`app: frontend\` may reach \`app: backend\` on TCP 8080.`,
      language: 'yaml',
      code: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: shop
spec:
  podSelector: {}
  policyTypes: ["Ingress"]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: frontend-to-backend
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes: ["Ingress"]
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - protocol: TCP
          port: 8080`,
    },
    exercise: {
      prompt: `In the example above, a Pod labelled \`app: frontend\` in namespace \`web\` (not \`shop\`) tries to reach the backend. Is it allowed? How would you change the rule to allow frontends from namespace \`web\` only?`,
      solution: `**Not allowed.** A \`podSelector\` alone in a \`from\` entry only matches Pods in the **policy's own namespace** (\`shop\`).

Combine both selectors in **one** list item (AND):

\`\`\`yaml
- from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: web
      podSelector:
        matchLabels:
          app: frontend
\`\`\`

Writing them as two separate items (\`- namespaceSelector\` and \`- podSelector\`) would instead allow **any** Pod in \`web\` **or** frontends in \`shop\`.`,
    },
    faq: [
      {
        q: 'Do NetworkPolicies work at layer 7, e.g. HTTP paths?',
        a: `The core API is L3/L4 only (IPs, ports, protocols). Some CNIs (e.g. Cilium) and service meshes offer L7 policy through their own CRDs.`,
      },
      {
        q: 'Can a NetworkPolicy affect Pods in other namespaces?',
        a: `It only **selects** Pods in its own namespace. It can **mention** other namespaces as allowed peers via \`namespaceSelector\`.`,
      },
      {
        q: 'How do I test whether a policy works?',
        a: `Start a temporary Pod with the right labels in the right namespace and try to connect (e.g. \`wget\` with a short timeout). Verify that both allowed and denied paths behave as expected.`,
      },
    ],
    keyTerms: ['NetworkPolicy', 'podSelector', 'namespaceSelector', 'ipBlock', 'policyTypes', 'default deny', 'isolation', 'zero trust'],
    deeper: `Because core NetworkPolicy is namespaced and allow-only, cluster administrators who need guardrails that app teams cannot override use CNI-specific CRDs (Calico GlobalNetworkPolicy, CiliumClusterwideNetworkPolicy) or the out-of-tree SIG Network **network-policy-api** project (AdminNetworkPolicy and its successors; still alpha and evolving), which adds cluster scope, priorities and explicit Deny/Pass actions. \`ipBlock\` rules are also tricky for traffic that is NATed on the way in or out (e.g. through a LoadBalancer), since the source IP the Pod sees may differ from the client's.`,
    references: [
      { title: 'Kubernetes docs: Network Policies', url: 'https://kubernetes.io/docs/concepts/services-networking/network-policies/' },
      { title: 'Kubernetes task: Declare Network Policy', url: 'https://kubernetes.io/docs/tasks/administer-cluster/declare-network-policy/' },
    ],
  },
  // ─────────────────────── Stage 4 · Configuration & Storage ───────────────────────
  {
    id: 'configmaps-and-secrets',
    title: 'ConfigMaps and Secrets',
    stage: 4,
    order: 1,
    objectives: ['kf-core', 'co-security'],
    scope: 'kcna',
    estMinutes: 20,
    summary:
      'ConfigMaps hold non-sensitive configuration and Secrets hold sensitive values; both are injected into Pods as environment variables or files so the same image runs in every environment.',
    what: `**ConfigMap** and **Secret** are API objects that store key/value data separately from container images.

- A **ConfigMap** holds plain configuration: feature flags, URLs, whole config files.
- A **Secret** holds sensitive data: passwords, tokens, TLS keys. Values in \`data\` are **base64-encoded** — an encoding, not encryption. Secrets have a \`type\`, e.g. \`Opaque\` (generic), \`kubernetes.io/tls\`, \`kubernetes.io/dockerconfigjson\` (image pull credentials).

Both are namespaced, limited to **1 MiB**, and consumed by Pods in the same namespace in two ways: as **environment variables** or as **files in a mounted volume**.`,
    why: `The twelve-factor principle "store config in the environment" applies directly: build one immutable image, then run it in dev, staging and production with different configuration. Baking a database URL — or worse, a password — into an image means rebuilding for every environment and leaking the secret to everyone who can pull the image.

Separating Secrets from ConfigMaps also lets you apply **different access control**: many people may read ConfigMaps, very few should read Secrets.`,
    problem: `Compare two ways of getting configuration in. Option A: environment variables baked into the Dockerfile — every change is a new image build, and \`docker history\` reveals the password. Option B: values in the Pod spec directly — better, but the password now lives in your Git repository and in every \`kubectl get pod -o yaml\` output.

ConfigMaps and Secrets are Option C: the Pod **references** a named object, and the object's access can be controlled independently.`,
    how: `Walk through the life of a Secret used by a Pod:

- **Create**: \`kubectl create secret generic db --from-literal=password=s3cr3t\`. The API server stores it in **etcd**. By default it is stored unencrypted (just base64 in the API representation) unless the cluster admin configured **encryption at rest**.
- **Authorize**: only subjects whose RBAC allows \`get\` on \`secrets\` in that namespace can read it. Anyone who can create Pods in the namespace can also mount it, so Pod creation rights matter too.
- **Reference**: the Pod spec points at it via \`env.valueFrom.secretKeyRef\`, \`envFrom\`, or a \`secret\` volume.
- **Deliver**: the kubelet on the Pod's node fetches the Secret and either sets the env var at container start, or writes files into a **tmpfs** (in-memory) volume mounted into the container.
- **Update**: if you change the Secret, **mounted files** are refreshed by the kubelet after a short delay (not for \`subPath\` mounts). **Environment variables never change** in a running container — the Pod must be restarted (e.g. \`kubectl rollout restart deployment/app\`).

ConfigMaps follow exactly the same path, minus the tmpfs and the extra caution. Both can be marked \`immutable: true\`, which prevents accidental changes and reduces load on the API server.`,
    components: [
      { name: 'ConfigMap', description: 'Non-confidential key/value data or files; `data` (UTF-8) and `binaryData`.' },
      { name: 'Secret', description: 'Sensitive data, base64-encoded in `data`; `stringData` accepts plain text on write.' },
      { name: 'env / envFrom', description: 'Inject single keys (`configMapKeyRef`, `secretKeyRef`) or all keys as environment variables.' },
      { name: 'configMap / secret volumes', description: 'Expose keys as files; updated automatically when the object changes (except subPath).' },
      { name: 'Encryption at rest', description: 'API server option (EncryptionConfiguration, often with a KMS provider) that encrypts Secrets in etcd.' },
    ],
    misconceptions: [
      {
        myth: 'Secrets are encrypted, so they are safe to commit to Git.',
        reality: `\`echo czNjcjN0 | base64 -d\` prints \`s3cr3t\`. Base64 is reversible by anyone. Never commit raw Secret manifests; use tools such as Sealed Secrets, SOPS or External Secrets Operator.`,
      },
      {
        myth: 'Changing a ConfigMap immediately updates the app.',
        reality: `Env vars are fixed at container start. Mounted files update eventually, but the app must also re-read them. Many apps need a restart either way.`,
      },
      {
        myth: 'A Pod can use a Secret from any namespace.',
        reality: `Pods can only reference ConfigMaps and Secrets in their **own** namespace.`,
      },
    ],
    example: {
      title: 'One ConfigMap, one Secret, two injection styles',
      description: `Created imperatively, then consumed as an env var (the password) and as a mounted file (the config). \`kubectl get secret db -o yaml\` would show \`password: czNjcjN0\` — the base64 of \`s3cr3t\`.`,
      language: 'yaml',
      code: `# kubectl create configmap app-config --from-literal=LOG_LEVEL=info --from-file=app.properties
# kubectl create secret generic db --from-literal=password=s3cr3t
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
    - name: app
      image: example.com/app:1.4
      env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db
              key: password
      envFrom:
        - configMapRef:
            name: app-config      # every key becomes an env var
      volumeMounts:
        - name: config
          mountPath: /etc/app     # app.properties appears here as a file
          readOnly: true
  volumes:
    - name: config
      configMap:
        name: app-config`,
    },
    exercise: {
      prompt: `Your team rotates the database password by updating the Secret \`db\`. The app reads it from the env var \`DB_PASSWORD\`. After the rotation, the app still uses the old password. Why, and what are two ways to fix the process?`,
      solution: `Environment variables are set once when the container starts; updating the Secret does not change running containers.

Fixes: (1) restart the workload after rotation, e.g. \`kubectl rollout restart deployment/app\`; (2) mount the Secret as a **volume** and have the app re-read the file when it changes (the kubelet refreshes mounted Secrets), or use a pattern where the Secret name changes (e.g. a hash suffix generated by Kustomize) so the rollout happens automatically.`,
    },
    faq: [
      {
        q: 'What is the difference between data and stringData in a Secret?',
        a: `\`data\` values must be base64-encoded. \`stringData\` lets you write plain text for convenience; the API server encodes it into \`data\` on write. Reading back always shows \`data\`.`,
      },
      {
        q: 'Are Secrets any more secure than ConfigMaps, then?',
        a: `Somewhat: they can be encrypted at rest, are mounted on tmpfs rather than disk, are only sent to nodes running Pods that use them, and are typically guarded by stricter RBAC. But the protection comes from cluster configuration, not from base64.`,
      },
      {
        q: 'Can I store large files in a ConfigMap?',
        a: `No — the limit is 1 MiB per object, because it is stored in etcd. Use a volume or an object store for larger data.`,
      },
    ],
    keyTerms: ['ConfigMap', 'Secret', 'base64', 'encryption at rest', 'envFrom', 'secretKeyRef', 'immutable', 'tmpfs'],
    deeper: `Many production clusters avoid storing the source of truth for secrets in Kubernetes at all: the **Secrets Store CSI Driver** mounts secrets directly from a vault (HashiCorp Vault, cloud secret managers), and **External Secrets Operator** syncs them into Kubernetes Secrets. Encryption at rest with a **KMS v2** provider keeps the data-encryption keys outside the cluster. For least privilege, avoid granting \`list\` or \`watch\` on Secrets — both return full Secret contents, not just names.`,
    references: [
      { title: 'Kubernetes docs: ConfigMaps', url: 'https://kubernetes.io/docs/concepts/configuration/configmap/' },
      { title: 'Kubernetes docs: Secrets', url: 'https://kubernetes.io/docs/concepts/configuration/secret/' },
      { title: 'The Twelve-Factor App: Config', url: 'https://12factor.net/config' },
    ],
  },
  {
    id: 'volumes',
    title: 'Volumes: Ephemeral and Projected Storage',
    stage: 4,
    order: 2,
    objectives: ['co-storage'],
    scope: 'kcna',
    estMinutes: 18,
    summary:
      'A container’s filesystem is wiped on every restart. Volumes attach storage to the Pod instead, with lifetimes ranging from “as long as the Pod” (emptyDir) to “independent of any Pod” (persistent volumes).',
    what: `A container's root filesystem is a thin writable layer on top of its image. When the container restarts, that layer is **discarded** and the container starts fresh from the image.

A **volume** is a directory defined at the **Pod** level (\`spec.volumes\`) and mounted into one or more containers (\`volumeMounts\`). Its lifetime depends on its type:

- **Ephemeral volumes** live and die with the Pod: \`emptyDir\`, \`configMap\`, \`secret\`, \`downwardAPI\`, \`projected\`, and generic ephemeral volumes.
- **Persistent volumes** outlive Pods: a \`persistentVolumeClaim\` volume pointing at storage managed by the cluster (next lesson).
- **hostPath** mounts a path from the node itself — persistent on that node, but tied to it.`,
    why: `Two everyday needs drive volumes. First, **survive a container restart**: a cache or scratch file should not vanish because the liveness probe restarted the container. Second, **share files between containers** in the same Pod: a sidecar that ships logs written by the main container, or an init container that downloads content for the web server to serve.

Volumes are also the delivery mechanism for configuration files and credentials (ConfigMap, Secret, ServiceAccount token).`,
    problem: `A web Pod has two containers: \`nginx\` serves \`/usr/share/nginx/html\`, and a \`git-sync\` sidecar pulls new content every minute. Each container has its own isolated filesystem, so whatever the sidecar writes is invisible to nginx. An \`emptyDir\` mounted into both containers is the shared directory they need.`,
    how: `Step through the lifecycle of the volume types you must know:

- **emptyDir**: created empty by the kubelet when the Pod is assigned to a node. All containers that mount it see the same files. It **survives container restarts** but is **deleted when the Pod is removed** from the node. \`medium: Memory\` backs it with tmpfs (RAM, counted against memory limits); \`sizeLimit\` caps it.
- **configMap / secret**: the kubelet writes each key as a file; updates propagate to the mounted files after a delay (not for \`subPath\` mounts). Secret volumes use tmpfs.
- **downwardAPI**: exposes Pod metadata — labels, annotations, resource limits — as files.
- **projected**: combines several of the above (secret, configMap, downwardAPI, serviceAccountToken) into **one** directory. This is how every Pod receives its short-lived ServiceAccount token at \`/var/run/secrets/kubernetes.io/serviceaccount\`.
- **hostPath**: bind-mounts a node directory. Data stays on that node, so a Pod rescheduled elsewhere sees different data. It also gives access to the host filesystem — a serious security risk, generally reserved for system agents (log collectors, CNI, CSI node plugins).
- **persistentVolumeClaim**: references a PVC; the actual storage is attached by the storage system and lives independently of the Pod.

Mounting is always two-part: declare under \`spec.volumes\` (what), then reference by name under each container's \`volumeMounts\` (where).`,
    components: [
      { name: 'spec.volumes', description: 'Pod-level declaration of each volume and its source type.' },
      { name: 'volumeMounts', description: 'Per-container mount point (`mountPath`), optional `readOnly` and `subPath`.' },
      { name: 'emptyDir', description: 'Scratch space shared by containers in a Pod; lifetime = Pod.' },
      { name: 'projected', description: 'Merges secret, configMap, downwardAPI and serviceAccountToken sources into one mount.' },
      { name: 'hostPath', description: 'Mounts a node path; node-bound and security-sensitive.' },
    ],
    misconceptions: [
      {
        myth: 'emptyDir data is lost when the container crashes.',
        reality: `It survives **container** restarts. It is lost when the **Pod** is deleted or evicted, or when the Pod is rescheduled (which means a new Pod anyway).`,
      },
      {
        myth: 'hostPath is a fine way to persist database data.',
        reality: `It ties data to one node and breaks when the Pod moves; it also exposes the node filesystem. Use a PersistentVolumeClaim for durable application data.`,
      },
      {
        myth: 'A volume belongs to a container.',
        reality: `Volumes are declared on the **Pod**. Containers opt in by mounting them, possibly at different paths and with different read/write modes.`,
      },
    ],
    example: {
      title: 'Sharing files between two containers via emptyDir',
      description: `The writer appends the date every 5 seconds; the reader container sees the same file. Verify with \`kubectl logs shared -c reader\`.`,
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: shared
spec:
  volumes:
    - name: scratch
      emptyDir: {}
  containers:
    - name: writer
      image: busybox:1.36
      command: ["sh", "-c", "while true; do date >> /data/log.txt; sleep 5; done"]
      volumeMounts:
        - name: scratch
          mountPath: /data
    - name: reader
      image: busybox:1.36
      command: ["sh", "-c", "until [ -f /input/log.txt ]; do sleep 1; done; tail -f /input/log.txt"]
      volumeMounts:
        - name: scratch
          mountPath: /input
          readOnly: true`,
    },
    exercise: {
      prompt: `For each event, say whether data in an \`emptyDir\` volume survives: (a) the main container is OOMKilled and restarted; (b) \`kubectl delete pod\` and the Deployment creates a replacement; (c) the node is drained; (d) a \`kubectl rollout restart\` of the Deployment.`,
      solution: `(a) **Survives** — the Pod is the same, only the container restarted.

(b), (c), (d) **Lost** — each one produces a **new Pod** (new UID, new emptyDir). If data must survive these events, it belongs in a PersistentVolumeClaim or an external store.`,
    },
    faq: [
      {
        q: 'What is a generic ephemeral volume?',
        a: `A volume declared with \`ephemeral.volumeClaimTemplate\` inside the Pod: Kubernetes creates a PVC for the Pod and deletes it with the Pod. You get real provisioned storage (any StorageClass) with Pod lifetime.`,
      },
      {
        q: 'Why use subPath?',
        a: `To mount a single file or subdirectory from a volume without hiding the rest of the target directory. Downside: subPath mounts of ConfigMaps and Secrets do not receive updates.`,
      },
    ],
    keyTerms: ['volume', 'volumeMounts', 'emptyDir', 'hostPath', 'projected volume', 'downwardAPI', 'ephemeral volume', 'subPath'],
    deeper: `Historically, many storage backends were built into Kubernetes as **in-tree** volume plugins (e.g. \`awsElasticBlockStore\`, \`gcePersistentDisk\`). These have been migrated to **CSI** drivers, with the in-tree code redirected or removed, so new clusters should always use CSI-backed storage. The **image volume** source, which mounts the contents of an OCI image as a read-only volume, is a newer addition worth watching.`,
    references: [
      { title: 'Kubernetes docs: Volumes', url: 'https://kubernetes.io/docs/concepts/storage/volumes/' },
      { title: 'Kubernetes docs: Ephemeral Volumes', url: 'https://kubernetes.io/docs/concepts/storage/ephemeral-volumes/' },
      { title: 'Kubernetes docs: Projected Volumes', url: 'https://kubernetes.io/docs/concepts/storage/projected-volumes/' },
    ],
  },
  {
    id: 'persistent-volumes-and-csi',
    title: 'PersistentVolumes, Claims, StorageClasses and CSI',
    stage: 4,
    order: 3,
    objectives: ['co-storage'],
    scope: 'kcna',
    estMinutes: 25,
    summary:
      'A PersistentVolumeClaim is a request for storage; a PersistentVolume is the storage that fulfils it; a StorageClass lets that storage be created on demand by a CSI driver.',
    what: `Kubernetes separates **asking for storage** from **providing storage**, much like Pods ask for CPU without caring which node provides it.

- **PersistentVolume (PV)** — a cluster-scoped object representing a real piece of storage (a cloud disk, an NFS export, a SAN LUN), with a capacity, access modes and a reclaim policy.
- **PersistentVolumeClaim (PVC)** — a namespaced request: "I need 10Gi, ReadWriteOnce, of class \`fast\`". Pods mount the **claim**, never the PV directly.
- **StorageClass** — a template naming a **provisioner** (a CSI driver) plus parameters (disk type, IOPS). It enables **dynamic provisioning**: PVs are created automatically when claims appear.
- **CSI (Container Storage Interface)** — the standard plugin interface that lets any storage vendor ship a driver without changing Kubernetes code.`,
    why: `Developers should not need to know whether production uses AWS EBS, Ceph or NetApp; they should just ask for "10Gi of fast storage". Administrators should be able to change the backend without changing every application manifest. The PV/PVC split is that contract, and CSI is what makes the backend pluggable.`,
    problem: `Before dynamic provisioning, an administrator had to pre-create disks and PVs by hand and hope they matched future requests (**static provisioning**). Teams filed tickets and waited. Too-large disks sat unused; too-small ones blocked deployments. Storage drivers were compiled into Kubernetes itself, so supporting a new storage system meant changing and releasing Kubernetes.

StorageClasses with CSI drivers make storage self-service and vendor-neutral.`,
    how: `Trace dynamic provisioning for a claim named \`data\` in namespace \`shop\`:

- A developer creates the PVC: \`storageClassName: fast\`, \`accessModes: [ReadWriteOnce]\`, \`storage: 10Gi\`. If no class is named, the cluster's **default StorageClass** (marked with the annotation \`storageclass.kubernetes.io/is-default-class: "true"\`) is used.
- If the class has \`volumeBindingMode: WaitForFirstConsumer\`, nothing happens until a Pod using the claim is scheduled — so the disk is created in the **same zone** as the chosen node. With \`Immediate\`, provisioning starts right away. Until then the PVC is \`Pending\`.
- The CSI driver's **controller** component (with the \`external-provisioner\` sidecar) sees the claim and asks the storage backend to create a 10Gi volume.
- A **PV** object is created to represent the new disk and **bound** 1:1 to the claim. Both now show \`Bound\`.
- When the Pod starts on a node, the volume is **attached** to the node (for block devices) and the CSI driver's **node** component (a DaemonSet) **mounts** it into the Pod's directory.
- When the PVC is deleted, the PV's \`persistentVolumeReclaimPolicy\` decides: \`Delete\` (default for dynamically provisioned volumes) removes the backend disk; \`Retain\` keeps the PV and data for manual recovery, in state \`Released\`.

**Access modes** describe how a volume may be mounted:

- \`ReadWriteOnce\` (RWO) — read-write by a single **node**.
- \`ReadOnlyMany\` (ROX) — read-only by many nodes.
- \`ReadWriteMany\` (RWX) — read-write by many nodes (needs shared storage like NFS or CephFS).
- \`ReadWriteOncePod\` (RWOP) — read-write by a single **Pod**.`,
    components: [
      { name: 'PersistentVolume', description: 'Cluster-scoped representation of real storage; capacity, access modes, reclaim policy.' },
      { name: 'PersistentVolumeClaim', description: 'Namespaced request for storage, mounted by Pods; binds 1:1 to a PV.' },
      { name: 'StorageClass', description: 'Provisioner + parameters + reclaimPolicy + volumeBindingMode (+ allowVolumeExpansion).' },
      { name: 'CSI driver', description: 'Vendor plugin: a controller component (provision, attach, snapshot) and a node DaemonSet (mount).' },
      { name: 'Access modes', description: 'RWO, ROX, RWX, RWOP — capabilities the backend must support.' },
      { name: 'Reclaim policy', description: '`Delete` or `Retain` (`Recycle` is deprecated).' },
    ],
    misconceptions: [
      {
        myth: 'ReadWriteOnce means only one Pod can use the volume.',
        reality: `RWO restricts to one **node**; several Pods on that same node can mount it. Use \`ReadWriteOncePod\` when you need single-Pod access.`,
      },
      {
        myth: 'Deleting a Pod deletes its persistent data.',
        reality: `Pods mount claims; deleting the Pod leaves the PVC and PV untouched. Data is only at risk when the **PVC** is deleted and the reclaim policy is \`Delete\`.`,
      },
      {
        myth: 'Any storage class can provide ReadWriteMany.',
        reality: `Access modes are capabilities of the backend. A typical cloud block disk supports RWO only; RWX needs a shared filesystem. A claim asking for an unsupported mode stays Pending.`,
      },
    ],
    example: {
      title: 'A StorageClass, a claim, and a Pod that uses it',
      description: `The provisioner name depends on the CSI driver installed in your cluster (\`kubectl get storageclass\` shows what exists; \`kind\` and \`minikube\` ship a default class). Check binding with \`kubectl get pvc,pv\`.`,
      language: 'yaml',
      code: `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast
provisioner: ebs.csi.aws.com        # example CSI driver
parameters:
  type: gp3
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data
spec:
  storageClassName: fast
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 10Gi
---
apiVersion: v1
kind: Pod
metadata:
  name: db
spec:
  containers:
    - name: db
      image: postgres:16
      env:
        - name: POSTGRES_PASSWORD
          value: example-only
        - name: PGDATA                # subdirectory: a fresh disk may contain lost+found
          value: /var/lib/postgresql/data/pgdata
      volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: data`,
    },
    exercise: {
      prompt: `A PVC has been \`Pending\` for 10 minutes. List three distinct causes you would check, and the command that reveals which one it is.`,
      solution: `Run \`kubectl describe pvc <name>\` and read the **Events**. Typical causes:

- **WaitForFirstConsumer**: no Pod using the claim has been scheduled yet — this is expected, not an error.
- **No matching provisioner/class**: the named StorageClass does not exist, there is no default class, or the CSI driver is not installed or failing.
- **No PV can satisfy it** (static provisioning): no available PV with enough capacity, the right access mode and the same class.
- Also possible: the backend rejected the request (quota, unsupported access mode such as RWX on block storage).`,
    },
    faq: [
      {
        q: 'Can I make a PVC bigger later?',
        a: `Yes, if the StorageClass has \`allowVolumeExpansion: true\` and the CSI driver supports it: edit \`spec.resources.requests.storage\` upward. Shrinking is not supported.`,
      },
      {
        q: 'Is a PV namespaced?',
        a: `No. PVs and StorageClasses are cluster-scoped; PVCs are namespaced. That is what lets administrators manage storage while teams claim it in their namespaces.`,
      },
      {
        q: 'Who writes CSI drivers?',
        a: `Storage vendors and projects (cloud providers, Ceph via Rook, Portworx, Longhorn …). CSI is a cross-orchestrator standard, alongside CRI and CNI.`,
      },
    ],
    keyTerms: ['PersistentVolume', 'PersistentVolumeClaim', 'StorageClass', 'dynamic provisioning', 'CSI', 'access modes', 'reclaim policy', 'WaitForFirstConsumer'],
    diagram: 'storage-binding',
    deeper: `CSI also powers **VolumeSnapshots** (\`VolumeSnapshot\`, \`VolumeSnapshotClass\`, \`VolumeSnapshotContent\`, mirroring PVC/StorageClass/PV) and cloning a PVC from another via \`dataSource\`. A PV can be presented as a raw block device (\`volumeMode: Block\`) instead of a filesystem. The controller side of a CSI driver is typically a Deployment running the vendor plugin plus Kubernetes-maintained sidecars (external-provisioner, external-attacher, external-resizer, external-snapshotter).`,
    references: [
      { title: 'Kubernetes docs: Persistent Volumes', url: 'https://kubernetes.io/docs/concepts/storage/persistent-volumes/' },
      { title: 'Kubernetes docs: Storage Classes', url: 'https://kubernetes.io/docs/concepts/storage/storage-classes/' },
      { title: 'Kubernetes docs: Dynamic Volume Provisioning', url: 'https://kubernetes.io/docs/concepts/storage/dynamic-provisioning/' },
    ],
  },
  // ─────────────────────── Stage 5 · Security & Operations ───────────────────────
  {
    id: 'authentication-authorization-rbac',
    title: 'Authentication, Authorization and RBAC',
    stage: 5,
    order: 1,
    objectives: ['co-security'],
    scope: 'kcna',
    estMinutes: 25,
    summary:
      'Every API request is authenticated (who are you?), authorized (may you do this?) and admitted (is this request acceptable?). RBAC answers the second question with Roles, ClusterRoles and their bindings; ServiceAccounts give Pods an identity.',
    what: `Every call to the kube-apiserver — from \`kubectl\`, a controller or a Pod — passes three gates in order:

- **Authentication (authn)**: establishes the caller's identity — a **user** or **ServiceAccount**, plus **groups**.
- **Authorization (authz)**: decides whether that identity may perform this **verb** on this **resource** in this **namespace**.
- **Admission control**: may mutate or reject the object itself (covered in the API server lesson).

**RBAC** (Role-Based Access Control) is the standard authorizer. Its four objects:

- **Role** — a set of permissions within **one namespace**.
- **ClusterRole** — permissions that are cluster-wide or reusable across namespaces (also for cluster-scoped resources like nodes and PVs).
- **RoleBinding** — grants a Role or ClusterRole to subjects **within one namespace**.
- **ClusterRoleBinding** — grants a ClusterRole to subjects **across the whole cluster**.`,
    why: `A cluster is shared by people, CI systems, controllers and applications. Each should be able to do exactly what its job needs — the **principle of least privilege**. A CI pipeline that only deploys to \`staging\` should not be able to read Secrets in \`prod\`, and a compromised app Pod should not be able to create new Pods.`,
    problem: `A common anti-pattern: give the CI system a kubeconfig bound to \`cluster-admin\` "to make it work". Months later a leaked CI token gives an attacker full control of every namespace, every Secret and every node.

RBAC lets you replace that with a narrow, auditable grant: "\`deployments\`: get, list, update, patch — in namespace \`staging\` — for ServiceAccount \`ci-deployer\`".`,
    how: `Trace one request: ServiceAccount \`app\` in namespace \`shop\` runs \`GET /api/v1/namespaces/shop/pods\`.

- **Authenticate**: the Pod sends its **projected ServiceAccount token** (a short-lived, audience-bound JWT mounted at \`/var/run/secrets/kubernetes.io/serviceaccount/token\`). The API server validates it and identifies the caller as \`system:serviceaccount:shop:app\`, in groups \`system:serviceaccounts\` and \`system:serviceaccounts:shop\`. Humans usually authenticate with **X.509 client certificates** or **OIDC** tokens from an identity provider — Kubernetes has **no User object** and cannot create human users.
- **Build the attributes**: user, groups, verb \`list\` (a GET on a collection), resource \`pods\`, API group \`""\` (core), namespace \`shop\`.
- **Authorize**: the configured authorizers (commonly \`Node,RBAC\`) are asked in order. RBAC looks for any RoleBinding in \`shop\` or any ClusterRoleBinding whose subjects include this identity, and checks whether the referenced role has a **rule** matching apiGroup + resource + verb.
- RBAC is **additive and deny-by-default**: if no rule allows it, the answer is no (HTTP 403 Forbidden). There are no deny rules.
- If allowed, the request proceeds to admission and then to etcd.

A key pattern: a **RoleBinding can reference a ClusterRole**. The permissions then apply only inside the RoleBinding's namespace. This lets you define a role (like the built-in \`view\` or \`edit\`) once and grant it per namespace.`,
    components: [
      { name: 'Role / ClusterRole', description: 'Lists of rules: apiGroups + resources + verbs (get, list, watch, create, update, patch, delete …).' },
      { name: 'RoleBinding / ClusterRoleBinding', description: 'Attach a role to subjects: User, Group or ServiceAccount.' },
      { name: 'ServiceAccount', description: 'Namespaced identity for workloads; each namespace has a `default` one; tokens are short-lived and projected into Pods.' },
      { name: 'Authenticators', description: 'X.509 client certs, bearer tokens (ServiceAccount, OIDC), webhook token authentication.' },
      { name: 'Authorization modes', description: 'RBAC, Node (for kubelets), Webhook, ABAC; AlwaysAllow/AlwaysDeny for testing.' },
      { name: 'kubectl auth can-i', description: 'Asks the API server whether an action is allowed, optionally impersonating with `--as`.' },
    ],
    misconceptions: [
      {
        myth: 'You can create a user with kubectl create user.',
        reality: `There is no User resource. Users are asserted by an external authenticator (certificate CN, OIDC claim). RBAC simply refers to user and group **names**.`,
      },
      {
        myth: 'A RoleBinding to a ClusterRole grants cluster-wide access.',
        reality: `A RoleBinding always limits the grant to its own namespace, even when it references a ClusterRole. Only a **ClusterRoleBinding** grants cluster-wide.`,
      },
      {
        myth: 'RBAC can deny a specific action to a user who otherwise has broad access.',
        reality: `RBAC has no deny. Permissions are the union of all bindings. To restrict, remove or narrow the broad grant.`,
      },
    ],
    example: {
      title: 'A read-only Pod viewer for one ServiceAccount',
      description: `Grant the ServiceAccount \`monitor\` in \`shop\` permission to read Pods and their logs, then verify by impersonating it.`,
      language: 'yaml',
      code: `apiVersion: v1
kind: ServiceAccount
metadata:
  name: monitor
  namespace: shop
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: shop
rules:
  - apiGroups: [""]               # "" = core API group
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: monitor-reads-pods
  namespace: shop
subjects:
  - kind: ServiceAccount
    name: monitor
    namespace: shop
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
# Verify:
#   kubectl auth can-i list pods -n shop --as=system:serviceaccount:shop:monitor     -> yes
#   kubectl auth can-i delete pods -n shop --as=system:serviceaccount:shop:monitor   -> no
#   kubectl auth can-i list pods -n prod --as=system:serviceaccount:shop:monitor     -> no`,
    },
    exercise: {
      prompt: `Your platform team wants every team lead to have the built-in \`edit\` permissions, but only in their own team's namespace. Leads authenticate via OIDC and are in group \`team-a-leads\` (namespace \`team-a\`). Which objects do you create, and why not a ClusterRoleBinding?`,
      solution: `Create a **RoleBinding** in namespace \`team-a\` with subject \`kind: Group, name: team-a-leads\` and \`roleRef\` to the **ClusterRole** \`edit\`. Repeat per team namespace.

A ClusterRoleBinding to \`edit\` would grant those permissions in **every** namespace. Referencing the shared ClusterRole from a namespaced RoleBinding reuses one definition while scoping the grant.`,
    },
    faq: [
      {
        q: 'What identity does my Pod use if I do not set serviceAccountName?',
        a: `The \`default\` ServiceAccount of its namespace. It has no extra RBAC permissions by default, but its token is still mounted unless you set \`automountServiceAccountToken: false\`.`,
      },
      {
        q: 'Do ServiceAccounts still get a long-lived token Secret automatically?',
        a: `No. Since Kubernetes 1.24, token Secrets are no longer auto-generated. Pods receive short-lived projected tokens that the kubelet rotates; for other uses, \`kubectl create token <sa>\` issues a time-limited token.`,
      },
      {
        q: 'What is the Node authorizer for?',
        a: `It restricts each **kubelet** to reading only the Secrets, ConfigMaps and other objects related to Pods scheduled on its own node, limiting the damage if a node is compromised.`,
      },
    ],
    keyTerms: ['authentication', 'authorization', 'Role', 'ClusterRole', 'RoleBinding', 'ClusterRoleBinding', 'ServiceAccount', 'least privilege'],
    diagram: 'rbac-model',
    deeper: `RBAC has built-in **escalation prevention**: you cannot create or update a Role granting permissions you do not hold yourself, unless you have the \`escalate\` verb; similarly, \`bind\` controls who may bind roles. Watch out for permissions that are effectively admin: \`create\` on Pods (can mount any Secret or ServiceAccount in the namespace), \`impersonate\`, and write access to RoleBindings. **Aggregated ClusterRoles** (\`aggregationRule\`) let CRD authors add rules to \`view\`/\`edit\`/\`admin\` automatically. The group \`system:masters\` bypasses authorization entirely, so avoid issuing certificates for it.`,
    references: [
      { title: 'Kubernetes docs: Using RBAC Authorization', url: 'https://kubernetes.io/docs/reference/access-authn-authz/rbac/' },
      { title: 'Kubernetes docs: Authenticating', url: 'https://kubernetes.io/docs/reference/access-authn-authz/authentication/' },
      { title: 'Kubernetes docs: RBAC Good Practices', url: 'https://kubernetes.io/docs/concepts/security/rbac-good-practices/' },
    ],
  },
];
