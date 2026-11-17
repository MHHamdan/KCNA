import type { Question, Reference } from '../types';

const R = {
  objects: { title: 'Objects in Kubernetes', url: 'https://kubernetes.io/docs/concepts/overview/working-with-objects/' },
  apiOverview: { title: 'The Kubernetes API', url: 'https://kubernetes.io/docs/concepts/overview/kubernetes-api/' },
  apiConcepts: { title: 'Kubernetes API Concepts', url: 'https://kubernetes.io/docs/reference/using-api/api-concepts/' },
  deprecation: { title: 'Deprecated API Migration Guide', url: 'https://kubernetes.io/docs/reference/using-api/deprecation-guide/' },
  objectMgmt: {
    title: 'Kubernetes Object Management',
    url: 'https://kubernetes.io/docs/concepts/overview/working-with-objects/object-management/',
  },
  declarative: {
    title: 'Declarative Management of Kubernetes Objects Using Configuration Files',
    url: 'https://kubernetes.io/docs/tasks/manage-kubernetes-objects/declarative-config/',
  },
  ssa: { title: 'Server-Side Apply', url: 'https://kubernetes.io/docs/reference/using-api/server-side-apply/' },
  owners: {
    title: 'Owners and Dependents',
    url: 'https://kubernetes.io/docs/concepts/overview/working-with-objects/owners-dependents/',
  },
  gc: { title: 'Garbage Collection', url: 'https://kubernetes.io/docs/concepts/architecture/garbage-collection/' },
  finalizers: { title: 'Finalizers', url: 'https://kubernetes.io/docs/concepts/overview/working-with-objects/finalizers/' },
  annotations: {
    title: 'Annotations',
    url: 'https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations/',
  },
  labels: {
    title: 'Labels and Selectors',
    url: 'https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/',
  },
  namespaces: { title: 'Namespaces', url: 'https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/' },
  pods: { title: 'Pods', url: 'https://kubernetes.io/docs/concepts/workloads/pods/' },
  podLifecycle: { title: 'Pod Lifecycle', url: 'https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/' },
  initContainers: { title: 'Init Containers', url: 'https://kubernetes.io/docs/concepts/workloads/pods/init-containers/' },
  downwardApi: { title: 'Downward API', url: 'https://kubernetes.io/docs/concepts/workloads/pods/downward-api/' },
  staticPods: { title: 'Create static Pods', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/static-pod/' },
  deployment: { title: 'Deployments', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/' },
  job: { title: 'Jobs', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/job/' },
  kubeconfig: {
    title: 'Organizing Cluster Access Using kubeconfig Files',
    url: 'https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/',
  },
  kubectl: { title: 'Command line tool (kubectl)', url: 'https://kubernetes.io/docs/reference/kubectl/' },
  crd: {
    title: 'Custom Resources',
    url: 'https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/',
  },
  skew: { title: 'Version Skew Policy', url: 'https://kubernetes.io/releases/version-skew-policy/' },
  etcd: {
    title: 'Operating etcd clusters for Kubernetes',
    url: 'https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/',
  },
  drain: { title: 'Safely Drain a Node', url: 'https://kubernetes.io/docs/tasks/administer-cluster/safely-drain-node/' },
  scheduler: { title: 'Kubernetes Scheduler', url: 'https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/' },
  schedulerConfig: { title: 'Scheduler Configuration', url: 'https://kubernetes.io/docs/reference/scheduling/config/' },
  multipleSchedulers: {
    title: 'Configure Multiple Schedulers',
    url: 'https://kubernetes.io/docs/tasks/extend-kubernetes/configure-multiple-schedulers/',
  },
  assignPod: {
    title: 'Assigning Pods to Nodes',
    url: 'https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/',
  },
  topologySpread: {
    title: 'Pod Topology Spread Constraints',
    url: 'https://kubernetes.io/docs/concepts/scheduling-eviction/topology-spread-constraints/',
  },
  taints: {
    title: 'Taints and Tolerations',
    url: 'https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/',
  },
  priority: {
    title: 'Pod Priority and Preemption',
    url: 'https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/',
  },
  images: { title: 'Images', url: 'https://kubernetes.io/docs/concepts/containers/images/' },
  privateRegistry: {
    title: 'Pull an Image from a Private Registry',
    url: 'https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/',
  },
  cri: { title: 'Container Runtime Interface (CRI)', url: 'https://kubernetes.io/docs/concepts/architecture/cri/' },
  crictl: {
    title: 'Debugging Kubernetes nodes with crictl',
    url: 'https://kubernetes.io/docs/tasks/debug/debug-cluster/crictl/',
  },
  runtimes: {
    title: 'Container Runtimes',
    url: 'https://kubernetes.io/docs/setup/production-environment/container-runtimes/',
  },
  oci: { title: 'Open Container Initiative', url: 'https://opencontainers.org/' },
  multiStage: { title: 'Docker docs: Multi-stage builds', url: 'https://docs.docker.com/build/building/multi-stage/' },
  cncfProjects: { title: 'CNCF Projects', url: 'https://www.cncf.io/projects/' },
} satisfies Record<string, Reference>;

export const questionsFundamentals2: Question[] = [
  // ---------------------------------------------------------------- kf-core
  {
    id: 'q-kf-core-101',
    domain: 'fundamentals',
    objective: 'kf-core',
    lessonId: 'yaml-for-kubernetes',
    difficulty: 1,
    type: 'multi',
    prompt: 'A reviewer is checking the first two lines of several manifests. Select TWO combinations that are valid.',
    choices: [
      '`apiVersion: apps/v1` with `kind: Deployment`',
      '`apiVersion: core/v1` with `kind: Pod`',
      '`apiVersion: v1` with `kind: Service`',
      '`apiVersion: v1` with `kind: Deployment`',
    ],
    answer: [0, 2],
    explanation:
      '`apiVersion` is `<group>/<version>`. Deployments live in the `apps` group, so `apps/v1`. Pods, Services, ConfigMaps and other original objects belong to the **core** (legacy) group, which is written with no group name at all: just `v1`.',
    choiceRationale: [
      'Correct: Deployment is served by the `apps` API group at version `v1`.',
      'The core group has an empty name; it is written `v1`, never `core/v1`.',
      'Correct: Service is in the core group, so its apiVersion is simply `v1`.',
      'Deployment is not in the core group; there is no `Deployment` kind in core `v1`, so the request fails.',
    ],
    references: [R.apiOverview, R.objects],
    tags: ['api-groups', 'apiVersion', 'manifests'],
  },
  {
    id: 'q-kf-core-102',
    domain: 'fundamentals',
    objective: 'kf-core',
    lessonId: 'declarative-reconciliation',
    difficulty: 1,
    type: 'single',
    prompt: `A developer created a Deployment with \`kubectl create -f web.yaml\`. They change the image tag in the file and run the same command again:

\`\`\`
$ kubectl create -f web.yaml
Error from server (AlreadyExists): error when creating "web.yaml": deployments.apps "web" already exists
\`\`\`

What should they run to update the live object from the file?`,
    choices: [
      '`kubectl create -f web.yaml --overwrite`',
      '`kubectl apply -f web.yaml`',
      '`kubectl run web -f web.yaml`',
      '`kubectl get -f web.yaml --update`',
    ],
    answer: [1],
    explanation:
      '`kubectl create` is an imperative "make this new object" command and fails if the object exists. `kubectl apply` is declarative: it creates the object if missing and otherwise patches it to match the file, so it can be run repeatedly.',
    choiceRationale: [
      '`kubectl create` has no option that turns it into an update of an existing object.',
      'Correct: `apply` compares the file with the live object and patches the differences.',
      '`kubectl run` creates a single Pod from flags; it does not update a Deployment from a file.',
      '`kubectl get` only reads objects and has no `--update` flag.',
    ],
    references: [R.objectMgmt, R.declarative],
    tags: ['kubectl-apply', 'kubectl-create', 'declarative'],
  },
  {
    id: 'q-kf-core-103',
    domain: 'fundamentals',
    objective: 'kf-core',
    lessonId: 'declarative-reconciliation',
    difficulty: 3,
    type: 'single',
    prompt: `A CI job switches to server-side apply and fails:

\`\`\`
$ kubectl apply --server-side -f web.yaml
error: Apply failed with 1 conflict: conflict with "kubectl-edit" using apps/v1: .spec.replicas
\`\`\`

What does this error tell you?`,
    choices: [
      'The manifest is invalid because `spec.replicas` cannot be set with server-side apply',
      'Another user is currently holding a lock on the Deployment and the job must retry later',
      'A different field manager last set `spec.replicas` to another value; the job can drop the field from its manifest or take ownership with `--force-conflicts`',
      'The API server does not support server-side apply for the `apps/v1` group',
    ],
    answer: [2],
    explanation:
      'Server-side apply tracks which **field manager** owns each field (`metadata.managedFields`). Here someone used `kubectl edit`, so the `kubectl-edit` manager owns `.spec.replicas` with a different value. Rather than silently overwrite it, the server reports a conflict. Options: stop managing that field (remove it from the manifest), or force ownership with `--force-conflicts`.',
    choiceRationale: [
      '`spec.replicas` is a normal field and can be applied server-side; the issue is ownership, not validity.',
      'Kubernetes does not lock objects; it uses field ownership and resourceVersion checks instead.',
      'Correct: the conflict names the other manager and the contested field.',
      'Server-side apply works for all built-in groups including `apps/v1`; the error message itself names a field conflict.',
    ],
    references: [R.ssa],
    tags: ['server-side-apply', 'field-managers', 'declarative'],
  },
  {
    id: 'q-kf-core-104',
    domain: 'fundamentals',
    objective: 'kf-core',
    lessonId: 'replicasets-and-deployments',
    difficulty: 2,
    type: 'single',
    prompt:
      'An operator wants to remove the Deployment object `web` but keep its current Pods serving traffic for a migration. They run `kubectl delete deployment web --cascade=orphan`. What happens?',
    choices: [
      'The Deployment, its ReplicaSet and its Pods are all deleted in the background',
      'The command is rejected because a Deployment with running Pods cannot be deleted',
      'The Deployment is deleted and the Pods are deleted, but the ReplicaSet is kept',
      "The Deployment is deleted; its ReplicaSet and Pods remain, and the Deployment is removed from the ReplicaSet's `ownerReferences`",
    ],
    answer: [3],
    explanation:
      'Dependents point to their owner through `metadata.ownerReferences` (Pod → ReplicaSet → Deployment). By default, deleting an owner lets the garbage collector delete its dependents too (background cascading deletion). With `--cascade=orphan` the owner is deleted and the dependents are left in place as orphans.',
    choiceRationale: [
      'That is the default background cascade; `--cascade=orphan` explicitly disables it.',
      'Deleting a Deployment with running Pods is always allowed.',
      'Orphaning applies to all dependents of the deleted owner; Pods are not deleted while the ReplicaSet is kept.',
      'Correct: the ReplicaSet (still owning its Pods) survives without an owner.',
    ],
    references: [R.owners, R.gc],
    tags: ['owner-references', 'garbage-collection', 'cascading-deletion'],
  },
  {
    id: 'q-kf-core-105',
    domain: 'fundamentals',
    objective: 'kf-core',
    lessonId: 'namespaces-labels-selectors',
    difficulty: 1,
    type: 'single',
    prompt:
      'A release pipeline wants to record the Git commit SHA, build URL and on-call contact on each Deployment. No selector or Service will ever filter on this data. Where should it go?',
    choices: [
      '`metadata.annotations`',
      '`metadata.labels`',
      '`spec.selector.matchLabels`',
      'A ConfigMap mounted into every Pod',
    ],
    answer: [0],
    explanation:
      'Annotations hold arbitrary non-identifying metadata for tools and humans; they cannot be used in selectors. Labels are for identifying attributes that you select and group by, and their values have strict length/character limits.',
    choiceRationale: [
      'Correct: annotations are designed for descriptive metadata such as build info and contacts.',
      'Labels are meant for selection; putting non-identifying data there adds noise and hits label value limits.',
      'The selector decides which Pods the Deployment manages; changing it here would break the Deployment, and the selector is immutable after creation.',
      'A ConfigMap is application configuration, not metadata attached to the Deployment object.',
    ],
    references: [R.annotations, R.labels],
    tags: ['annotations', 'labels', 'metadata'],
  },
  {
    id: 'q-kf-core-106',
    domain: 'fundamentals',
    objective: 'kf-core',
    lessonId: 'namespaces-labels-selectors',
    difficulty: 3,
    type: 'single',
    prompt: `A namespace contains these Pods:

\`\`\`
$ kubectl get pods --show-labels
NAME   READY   STATUS    RESTARTS   AGE   LABELS
a      1/1     Running   0          3h    env=prod,tier=web
b      1/1     Running   0          3h    env=staging,tier=cache
c      1/1     Running   0          3h    env=dev,tier=web
d      1/1     Running   0          3h    env=prod
\`\`\`

Which Pods does \`kubectl get pods -l 'env in (prod,staging),tier!=cache'\` return?`,
    choices: ['`a` only', '`a` and `d`', '`a`, `b` and `d`', '`a` and `c`'],
    answer: [1],
    explanation:
      'Comma-separated requirements are ANDed. `env in (prod,staging)` keeps `a`, `b` and `d`. `tier!=cache` then removes `b`. A Pod with no `tier` label at all, like `d`, also satisfies `tier!=cache`, because inequality matches objects that lack the key.',
    choiceRationale: [
      '`d` is missed here: `!=` also matches Pods that do not have the `tier` label.',
      'Correct: `a` and `d` satisfy both requirements.',
      '`b` has `tier=cache`, which the second requirement excludes.',
      '`c` has `env=dev`, which is not in the set `(prod,staging)`.',
    ],
    references: [R.labels],
    tags: ['label-selectors', 'set-based-selectors'],
  },
  {
    id: 'q-kf-core-107',
    domain: 'fundamentals',
    objective: 'kf-core',
    lessonId: 'pods',
    difficulty: 2,
    type: 'single',
    prompt: `A Pod defines two init containers (\`wait-for-db\`, \`migrate\`) and one app container. You see:

\`\`\`
$ kubectl get pod api-0
NAME    READY   STATUS     RESTARTS   AGE
api-0   0/1     Init:1/2   0          4m
\`\`\`

What is the state of the Pod?`,
    choices: [
      'One app container is running and the second is still starting',
      '`wait-for-db` has completed and `migrate` has not finished yet, so the app container has not started',
      'Both init containers failed once and the Pod is being retried',
      'The init containers are running in parallel and one of them has finished',
    ],
    answer: [1],
    explanation:
      '`Init:N/M` means N of M init containers have completed successfully. Init containers run one at a time in order, and app containers start only after all of them succeed. Here the first finished and the second (`migrate`) is still running or waiting.',
    choiceRationale: [
      'The status refers to init containers, and the Pod has only one app container.',
      'Correct: 1 of 2 init containers completed; the app is blocked until `migrate` succeeds.',
      'RESTARTS is 0 and the status would show an error such as `Init:Error` or `Init:CrashLoopBackOff` after failures.',
      'Regular init containers never run in parallel; they run sequentially.',
    ],
    references: [R.initContainers, R.podLifecycle],
    tags: ['init-containers', 'pod-status'],
  },
  {
    id: 'q-kf-core-108',
    domain: 'fundamentals',
    objective: 'kf-core',
    lessonId: 'pods',
    difficulty: 2,
    type: 'multi',
    prompt:
      'A dashboard reads `status.phase` from the Pod API. Select TWO values that can actually appear in that field.',
    choices: ['`Succeeded`', '`CrashLoopBackOff`', '`Pending`', '`Terminating`'],
    answer: [0, 2],
    explanation:
      'The Pod phase is a coarse summary with five values: `Pending`, `Running`, `Succeeded`, `Failed`, `Unknown`. Strings like `CrashLoopBackOff` are container **state reasons** (for example `waiting.reason`), and `Terminating` is what kubectl prints when a Pod has a deletion timestamp; neither is a phase.',
    choiceRationale: [
      'Correct: all containers terminated successfully and will not restart.',
      'This is a reason on a waiting container; the Pod phase is usually still `Running` meanwhile.',
      'Correct: the Pod is accepted but not all containers are running yet (scheduling, image pulls, init containers).',
      'kubectl displays `Terminating` in the STATUS column, but it is not a value of `status.phase`.',
    ],
    references: [R.podLifecycle],
    tags: ['pod-phase', 'container-states'],
  },
  {
    id: 'q-kf-core-109',
    domain: 'fundamentals',
    objective: 'kf-core',
    lessonId: 'pods',
    difficulty: 2,
    type: 'single',
    prompt:
      'A single-container Pod has `restartPolicy: Never`. Its process exits with code 1. What does the Pod do?',
    choices: [
      'The kubelet restarts the container with exponential back-off',
      'The Pod stays in phase `Running` until someone deletes it',
      'The container is not restarted and the Pod phase becomes `Failed`',
      'The Pod is rescheduled onto a different node',
    ],
    answer: [2],
    explanation:
      '`restartPolicy` (`Always`, `OnFailure`, `Never`) tells the kubelet whether to restart containers in place. With `Never`, a terminated container stays terminated; if it exited non-zero, the Pod phase becomes `Failed`. Pods are never moved to another node; a controller would have to create a new Pod.',
    choiceRationale: [
      'Back-off restarts happen with `Always` or `OnFailure`, not `Never`.',
      'Once all containers have terminated, the Pod leaves `Running`.',
      'Correct: no restart, and a non-zero exit makes the phase `Failed`.',
      'A Pod is bound to one node for its lifetime; it is never rescheduled.',
    ],
    references: [R.podLifecycle],
    tags: ['restart-policy', 'pod-phase'],
  },
  {
    id: 'q-kf-core-110',
    domain: 'fundamentals',
    objective: 'kf-core',
    lessonId: 'pods',
    difficulty: 2,
    type: 'single',
    prompt:
      'An application must log its own Pod name and namespace at startup. The team does not want to give it API credentials. Which approach fits?',
    choices: [
      'Mount the node\'s `/etc/hostname` with a `hostPath` volume',
      'Read the values from a ConfigMap that a script regenerates for every Pod',
      'Call the API server from the container with the default ServiceAccount token',
      'Use the Downward API: env vars with `valueFrom.fieldRef` pointing to `metadata.name` and `metadata.namespace`',
    ],
    answer: [3],
    explanation:
      'The Downward API exposes Pod and container fields (name, namespace, labels, annotations, resource limits, node name and more) to the container through environment variables or a `downwardAPI` volume, without the app talking to the API server.',
    choiceRationale: [
      'That is the node\'s hostname, not the Pod name, and `hostPath` is a poor practice for apps.',
      'A shared ConfigMap cannot hold a different value for each Pod without fragile external tooling.',
      'This works but requires API credentials and RBAC, which the team explicitly wants to avoid.',
      'Correct: the kubelet injects the fields directly into the container.',
    ],
    references: [R.downwardApi],
    tags: ['downward-api', 'env-vars'],
  },
  {
    id: 'q-kf-core-111',
    domain: 'fundamentals',
    objective: 'kf-core',
    lessonId: 'node-components',
    difficulty: 3,
    type: 'single',
    prompt: `On a kubeadm cluster an engineer tries to remove the API server Pod, but it comes straight back:

\`\`\`
$ kubectl -n kube-system delete pod kube-apiserver-cp1
pod "kube-apiserver-cp1" deleted
$ kubectl -n kube-system get pod kube-apiserver-cp1
NAME                 READY   STATUS    RESTARTS   AGE
kube-apiserver-cp1   1/1     Running   0          3s
\`\`\`

Why?`,
    choices: [
      'It is a static Pod: the kubelet on `cp1` runs it from a manifest file on disk, and the API object is only a mirror that the kubelet recreates',
      'A Deployment in `kube-system` owns the Pod and its ReplicaSet recreated it',
      'The API server refuses to delete itself and silently ignores the request',
      'A DaemonSet controller recreated the Pod because it runs on a control-plane node',
    ],
    answer: [0],
    explanation:
      'Static Pods are defined by files in the kubelet\'s manifest directory (kubeadm uses `/etc/kubernetes/manifests`). The kubelet runs them directly and publishes a read-only **mirror Pod** to the API, suffixed with the node name. Deleting the mirror does not stop the static Pod; to remove it you remove the manifest file on the node.',
    choiceRationale: [
      'Correct: the `-cp1` suffix is the node name of a mirror Pod, and the kubelet re-creates the mirror.',
      'kubeadm does not run control-plane components as a Deployment, and the AGE/RESTARTS pattern fits a mirror Pod.',
      'The delete succeeded (the output says so); the object was simply recreated.',
      'kubeadm runs the API server as a static Pod, not through a DaemonSet.',
    ],
    references: [R.staticPods],
    tags: ['static-pods', 'mirror-pods', 'kubelet'],
  },
  {
    id: 'q-kf-core-112',
    domain: 'fundamentals',
    objective: 'kf-core',
    lessonId: 'pods',
    difficulty: 2,
    type: 'single',
    prompt:
      'A payment service handles SIGTERM correctly but needs about 45 seconds to finish in-flight requests. During rollouts, logs show it is cut off mid-request. No grace period is set in the Pod spec. What is the most direct fix?',
    choices: [
      'Add a `preStop` hook that sleeps 45 seconds',
      'Set `terminationGracePeriodSeconds: 60` in the Pod spec',
      'Change `restartPolicy` to `Never`',
      'Lower the readiness probe\'s `periodSeconds`',
    ],
    answer: [1],
    explanation:
      'The default grace period is 30 seconds. After it expires the kubelet sends SIGKILL. Raising `terminationGracePeriodSeconds` above the drain time gives the process room to finish. A `preStop` hook runs inside the same grace period, so it would not extend the 30-second budget.',
    choiceRationale: [
      'The preStop hook time counts against the grace period; with the 30-second default the container is still killed.',
      'Correct: this extends the time between SIGTERM and SIGKILL.',
      'Restart policy controls restarts after exit, not shutdown timing.',
      'Probe frequency does not change how long the kubelet waits before SIGKILL.',
    ],
    references: [R.podLifecycle],
    tags: ['termination', 'grace-period', 'graceful-shutdown'],
  },
  {
    id: 'q-kf-core-113',
    domain: 'fundamentals',
    objective: 'kf-core',
    lessonId: 'declarative-reconciliation',
    difficulty: 2,
    type: 'single',
    prompt:
      'During an incident an on-call engineer runs `kubectl scale deployment web --replicas=8`. The next morning a pipeline runs `kubectl apply -f web.yaml`, and the file still contains `replicas: 3`. What is the replica count afterwards?',
    choices: [
      '8, because imperative changes always take precedence over files',
      '11, because apply adds the file\'s replicas to the live count',
      '3, because apply makes the live object match the fields declared in the file',
      'The apply fails with a conflict until the engineer reverts the scale',
    ],
    answer: [2],
    explanation:
      'Declarative management makes the file the source of truth for the fields it contains. Applying the manifest sets `spec.replicas` back to 3, silently undoing the imperative change. This is why teams either commit emergency changes back to Git or leave `replicas` out of the manifest when an autoscaler manages it.',
    choiceRationale: [
      'There is no precedence for imperative changes; the last write to the field wins.',
      'Replica counts are replaced, not summed.',
      'Correct: the declared value of 3 is re-applied.',
      'Client-side `kubectl apply` patches the field without a conflict error.',
    ],
    references: [R.declarative, R.objectMgmt],
    tags: ['declarative', 'imperative', 'drift'],
  },
  {
    id: 'q-kf-core-114',
    domain: 'fundamentals',
    objective: 'kf-core',
    lessonId: 'replicasets-and-deployments',
    difficulty: 1,
    type: 'single',
    prompt: `After three image updates to the \`web\` Deployment, an engineer sees:

\`\`\`
$ kubectl get rs -l app=web
NAME             DESIRED   CURRENT   READY   AGE
web-5d8f7c9b4    0         0         0       3d
web-6b7f9d8c5    0         0         0       2d
web-7c9d6f5b8    0         0         0       1d
web-84b6c7d9f    3         3         3       2h
\`\`\`

Why are the old ReplicaSets still there?`,
    choices: [
      'The garbage collector failed and they should be deleted manually',
      'Each one still runs hidden Pods for the old image',
      'They belong to other Deployments that share the label',
      'The Deployment keeps them, scaled to 0, as revision history so it can roll back',
    ],
    answer: [3],
    explanation:
      'Each change to the Pod template creates a new ReplicaSet. The Deployment scales old ones to 0 but keeps them (up to `revisionHistoryLimit`, default 10) so `kubectl rollout undo` can scale an older one back up.',
    choiceRationale: [
      'This is expected behavior, not a garbage collection failure.',
      'DESIRED and CURRENT are 0, so they run no Pods.',
      'The hash-suffixed names and rollout timeline match one Deployment\'s revisions.',
      'Correct: old ReplicaSets are the rollout history.',
    ],
    references: [R.deployment],
    tags: ['deployments', 'replicasets', 'revision-history'],
  },
  {
    id: 'q-kf-core-115',
    domain: 'fundamentals',
    objective: 'kf-core',
    lessonId: 'jobs-and-cronjobs',
    difficulty: 1,
    type: 'single',
    prompt:
      'A data-import Job keeps failing. After several retries it stops creating Pods and its condition shows `BackoffLimitExceeded`. Which Job field controls how many retries are allowed?',
    choices: ['`spec.backoffLimit`', '`spec.completions`', '`spec.parallelism`', '`spec.activeDeadlineSeconds`'],
    answer: [0],
    explanation:
      '`spec.backoffLimit` (default 6) sets how many retries the Job controller makes before marking the Job failed. `completions` and `parallelism` control how many successes are needed and how many Pods run at once; `activeDeadlineSeconds` caps total runtime.',
    choiceRationale: [
      'Correct: exceeding `backoffLimit` produces the `BackoffLimitExceeded` reason.',
      '`completions` is the number of successful Pods required, not a retry limit.',
      '`parallelism` is how many Pods may run concurrently.',
      'This is a time limit; exceeding it produces `DeadlineExceeded`, not `BackoffLimitExceeded`.',
    ],
    references: [R.job],
    tags: ['jobs', 'backoff-limit'],
  },
  {
    id: 'q-kf-core-116',
    domain: 'fundamentals',
    objective: 'kf-core',
    lessonId: 'api-server-and-etcd',
    difficulty: 2,
    type: 'single',
    prompt: `Two scripts read the same Deployment, change it, and send an update at almost the same moment. The second one gets:

\`\`\`
Error from server (Conflict): Operation cannot be fulfilled on deployments.apps "web": the object has been modified; please apply your changes to the latest version and try again
\`\`\`

What mechanism caused this?`,
    choices: [
      'An admission webhook rejected the second request as a duplicate',
      'Optimistic concurrency: the update carried an outdated `metadata.resourceVersion`, so the API server refused it',
      'etcd was temporarily unavailable and the update was dropped',
      'RBAC allows only one write per object per second',
    ],
    answer: [1],
    explanation:
      'Every object has a `resourceVersion` that changes on each write. An update based on an older version is rejected with HTTP 409 Conflict, so no write silently overwrites another. The client should re-read the object and retry.',
    choiceRationale: [
      'Admission rejections mention the webhook or policy, not "the object has been modified".',
      'Correct: the API server compares resourceVersion and rejects stale writes.',
      'An etcd outage produces server errors or timeouts, not a 409 Conflict.',
      'RBAC decides who may act, not how often; it returns 403 Forbidden.',
    ],
    references: [R.apiConcepts],
    tags: ['resource-version', 'optimistic-concurrency', 'api-server'],
  },

  // ---------------------------------------------------------------- kf-admin
  {
    id: 'q-kf-admin-101',
    domain: 'fundamentals',
    objective: 'kf-admin',
    lessonId: 'kubectl-and-cluster-administration',
    difficulty: 2,
    type: 'single',
    prompt: `A team copies an old Deployment manifest from a blog post into a current cluster:

\`\`\`
$ kubectl apply -f web.yaml
error: resource mapping not found for name: "web" namespace: "" from "web.yaml": no matches for kind "Deployment" in version "extensions/v1beta1"
\`\`\`

What is the fix?`,
    choices: [
      'Install a CRD that defines `Deployment` in `extensions/v1beta1`',
      'Run the command with `--validate=false`',
      'Change `apiVersion` to `apps/v1` (and add the now-required `spec.selector` if missing)',
      'Create the `extensions` namespace first',
    ],
    answer: [2],
    explanation:
      'Kubernetes API versions move through alpha and beta to stable, and deprecated versions are eventually removed. Deployments under `extensions/v1beta1` were removed long ago; the stable home is `apps/v1`, which also requires an explicit `spec.selector`.',
    choiceRationale: [
      'Recreating a removed built-in API with a CRD is not a supported fix and would not bring back the Deployment controller behavior for it.',
      'Client-side validation is not the problem; the server does not serve that group/version at all.',
      'Correct: migrate the manifest to the stable API version.',
      '`extensions` is an API group, not a namespace.',
    ],
    references: [R.deprecation, R.apiOverview],
    tags: ['api-versions', 'deprecation', 'api-groups'],
  },
  {
    id: 'q-kf-admin-102',
    domain: 'fundamentals',
    objective: 'kf-admin',
    lessonId: 'kubectl-and-cluster-administration',
    difficulty: 2,
    type: 'single',
    prompt: `An engineer checks their kubeconfig:

\`\`\`
$ kubectl config get-contexts
CURRENT   NAME   CLUSTER     AUTHINFO    NAMESPACE
          dev    dev-east    dev-admin   team-a
*         prod   prod-west   prod-ro     payments
\`\`\`

Which cluster, identity and namespace does a plain \`kubectl get pods\` use?`,
    choices: [
      'Cluster `dev-east`, user `dev-admin`, namespace `team-a`',
      'Cluster `prod-west`, user `prod-ro`, namespace `default`',
      'Cluster `prod-west`, user `prod-ro`, namespace `payments`',
      'Every listed cluster, merged into one result',
    ],
    answer: [2],
    explanation:
      'A context bundles a cluster, a user (AUTHINFO) and an optional default namespace. The `*` marks the current context, so kubectl talks to `prod-west` as `prod-ro` and, with no `-n` flag, uses the context\'s namespace `payments`.',
    choiceRationale: [
      'That is the `dev` context, which is not marked current.',
      'The context sets `payments` as its namespace, so `default` is not used.',
      'Correct: all three values come from the current context.',
      'kubectl talks to one cluster per command, chosen by the current context.',
    ],
    references: [R.kubeconfig],
    tags: ['kubeconfig', 'contexts', 'namespaces'],
  },
  {
    id: 'q-kf-admin-103',
    domain: 'fundamentals',
    objective: 'kf-admin',
    lessonId: 'kubectl-and-cluster-administration',
    difficulty: 1,
    type: 'single',
    prompt:
      'A developer is tired of typing `-n checkout` on every command. Which command makes `checkout` the default namespace for the current kubeconfig context?',
    choices: [
      '`kubectl config set-context --current --namespace=checkout`',
      '`kubectl create namespace checkout --default`',
      '`kubectl config use-context checkout`',
      '`kubectl namespace set checkout`',
    ],
    answer: [0],
    explanation:
      '`kubectl config set-context --current --namespace=<ns>` writes the namespace into the current context in kubeconfig. It changes only the client default; nothing changes in the cluster.',
    choiceRationale: [
      'Correct: it updates the namespace field of the active context.',
      '`create namespace` creates the object; there is no `--default` flag.',
      '`use-context` switches to a context named `checkout`, which is not a namespace.',
      'There is no `kubectl namespace` subcommand.',
    ],
    references: [R.kubeconfig, R.namespaces],
    tags: ['kubeconfig', 'contexts', 'namespaces'],
  },
  {
    id: 'q-kf-admin-104',
    domain: 'fundamentals',
    objective: 'kf-admin',
    lessonId: 'kubectl-and-cluster-administration',
    difficulty: 3,
    type: 'single',
    prompt: `A team uninstalled a backup operator but left one of its custom resources behind. Deleting it hangs:

\`\`\`
$ kubectl get backup nightly -o yaml
apiVersion: example.com/v1
kind: Backup
metadata:
  name: nightly
  deletionTimestamp: "2026-11-16T09:12:40Z"
  finalizers:
  - example.com/cleanup-snapshots
...
\`\`\`

Why is the object not gone?`,
    choices: [
      'The CRD was deleted first, so the API server cannot parse the object',
      'Deletion was accepted, but the object stays until its finalizer is removed, and the controller that would do that no longer runs',
      'The object is waiting for the garbage collector to delete its owner',
      'The `deletionTimestamp` is in the future, so deletion is scheduled for later',
    ],
    answer: [1],
    explanation:
      'A finalizer is a key in `metadata.finalizers` that tells the API server to hold an object after deletion is requested. The server sets `deletionTimestamp` and waits until every finalizer is removed, normally by the controller once cleanup is done. With the operator gone, nobody removes it. The proper fix is to restore the operator or confirm the external cleanup by hand before removing the finalizer.',
    choiceRationale: [
      'The object is still readable as `kind: Backup`, so the CRD is still installed.',
      'Correct: a pending finalizer with no controller left to clear it blocks deletion.',
      'Garbage collection deletes dependents of a deleted owner; the output shows a finalizer, not an owner reference.',
      'The timestamp records when deletion was requested; it is not a schedule.',
    ],
    references: [R.finalizers, R.crd],
    tags: ['finalizers', 'crds', 'operators', 'deletion'],
  },
  {
    id: 'q-kf-admin-105',
    domain: 'fundamentals',
    objective: 'kf-admin',
    lessonId: 'namespaces-labels-selectors',
    difficulty: 2,
    type: 'multi',
    prompt:
      'An admin runs `kubectl delete namespace team-a`. Select TWO objects that are NOT deleted as a result.',
    choices: [
      'A ClusterRole named `team-a-reader`',
      'A RoleBinding in `team-a`',
      'The Node `worker-3` that runs most of `team-a`\'s Pods',
      'A Secret in `team-a`',
    ],
    answer: [0, 2],
    explanation:
      'Deleting a namespace deletes every namespaced object inside it. Cluster-scoped objects such as Nodes, ClusterRoles, ClusterRoleBindings, PersistentVolumes and StorageClasses do not live in any namespace, so they are untouched, even if their names or uses relate to that namespace.',
    choiceRationale: [
      'Correct: ClusterRoles are cluster-scoped; the name containing `team-a` is irrelevant.',
      'RoleBindings are namespaced and are deleted with the namespace.',
      'Correct: Nodes are cluster-scoped; only the Pods on it in `team-a` are deleted.',
      'Secrets are namespaced and are deleted with the namespace.',
    ],
    references: [R.namespaces],
    tags: ['namespaces', 'cluster-scoped', 'namespaced'],
  },
  {
    id: 'q-kf-admin-106',
    domain: 'fundamentals',
    objective: 'kf-admin',
    lessonId: 'api-server-and-etcd',
    difficulty: 2,
    type: 'single',
    prompt:
      'Before a risky control-plane change, an operator wants a backup from which every Deployment, Secret, RBAC rule and other API object can be restored. What should they back up?',
    choices: [
      'The kubelet logs from every node',
      'The container images in the registry',
      'The `/var/lib/containerd` directory on each worker node',
      'An etcd snapshot, for example taken with `etcdctl snapshot save`',
    ],
    answer: [3],
    explanation:
      'etcd is the cluster\'s source of truth: all API objects are stored there and only kube-apiserver talks to it. A snapshot of etcd (plus the cluster\'s certificates and configuration) is what lets you restore cluster state.',
    choiceRationale: [
      'Logs record what happened; they cannot recreate objects.',
      'Images are the application artifacts, not the cluster\'s object definitions.',
      'This holds runtime data such as image layers and container state on a node, not API objects.',
      'Correct: etcd holds every API object, so its snapshot captures cluster state.',
    ],
    references: [R.etcd],
    tags: ['etcd', 'backup', 'disaster-recovery'],
  },
  {
    id: 'q-kf-admin-107',
    domain: 'fundamentals',
    objective: 'kf-admin',
    lessonId: 'kubectl-and-cluster-administration',
    difficulty: 2,
    type: 'multi',
    prompt:
      'The cluster\'s kube-apiserver runs v1.32. According to the version skew policy, select TWO kubectl client versions that are supported against it.',
    choices: ['v1.29', 'v1.31', 'v1.33', 'v1.35'],
    answer: [1, 2],
    explanation:
      'kubectl is supported within one minor version (older or newer) of kube-apiserver. Against v1.32 that means v1.31, v1.32 and v1.33. This is different from the kubelet rule, which allows older kubelets but never newer ones.',
    choiceRationale: [
      'Three minor versions older is outside the ±1 window for kubectl.',
      'Correct: one minor version older is supported.',
      'Correct: one minor version newer is supported for kubectl.',
      'Three minor versions newer is outside the window.',
    ],
    references: [R.skew],
    tags: ['version-skew', 'kubectl', 'upgrades'],
  },
  {
    id: 'q-kf-admin-108',
    domain: 'fundamentals',
    objective: 'kf-admin',
    lessonId: 'kubectl-and-cluster-administration',
    difficulty: 1,
    type: 'single',
    prompt:
      'To prepare `worker-2` for a kubelet upgrade, an operator runs `kubectl cordon worker-2`. An hour later its Pods are all still running there. Why?',
    choices: [
      'The cordon failed because DaemonSet Pods are present',
      'Cordon only marks the node unschedulable for new Pods; evicting the existing Pods needs `kubectl drain`',
      'Pods are evicted only after the default 5-minute toleration expires, so a scheduler bug is likely',
      'The operator also has to restart the kubelet before eviction starts',
    ],
    answer: [1],
    explanation:
      '`kubectl cordon` sets the node unschedulable so no new Pods land there. `kubectl drain` cordons the node and then evicts its Pods (respecting PodDisruptionBudgets), which is the usual step before node maintenance. `kubectl uncordon` re-enables scheduling afterwards.',
    choiceRationale: [
      'DaemonSet Pods affect `drain` (which needs `--ignore-daemonsets`), not `cordon`.',
      'Correct: cordon does not evict anything.',
      'Cordoning does not start any eviction timer; nothing is supposed to be evicted.',
      'Restarting the kubelet does not evict Pods; eviction is done by `drain`.',
    ],
    references: [R.drain],
    tags: ['cordon', 'drain', 'node-maintenance', 'upgrades'],
  },

  // ---------------------------------------------------------------- kf-scheduling
  {
    id: 'q-kf-scheduling-101',
    domain: 'fundamentals',
    objective: 'kf-scheduling',
    lessonId: 'scheduling-placement',
    difficulty: 2,
    type: 'single',
    prompt:
      'A Pod has `preferredDuringSchedulingIgnoredDuringExecution` node affinity for `zone=eu-1a` with weight 80. No node currently carries that label, but other nodes have free capacity. What happens?',
    choices: [
      'The Pod stays Pending until a node with `zone=eu-1a` appears',
      'The scheduler adds the label to the best node',
      'The Pod is rejected at admission',
      'The Pod is scheduled on another suitable node, because preferred rules only influence scoring',
    ],
    answer: [3],
    explanation:
      '`required...` node affinity is a filter: no match means Pending. `preferred...` affinity only adds weight during scoring, so the scheduler still places the Pod on the best remaining node. `IgnoredDuringExecution` means label changes later do not evict running Pods.',
    choiceRationale: [
      'That is the behavior of `requiredDuringSchedulingIgnoredDuringExecution`.',
      'The scheduler never modifies node labels.',
      'Admission does not check whether preferences can be met.',
      'Correct: preferences are soft and never block scheduling.',
    ],
    references: [R.assignPod],
    tags: ['node-affinity', 'required-vs-preferred'],
  },
  {
    id: 'q-kf-scheduling-102',
    domain: 'fundamentals',
    objective: 'kf-scheduling',
    lessonId: 'scheduling-placement',
    difficulty: 2,
    type: 'single',
    prompt:
      'A Deployment with 6 replicas must be spread evenly across three availability zones so that zone counts never differ by more than one, and new replicas should stay Pending rather than break that rule. Which configuration fits best?',
    choices: [
      'A `nodeSelector` with `topology.kubernetes.io/zone: all`',
      '`topologySpreadConstraints` with `topologyKey: topology.kubernetes.io/zone`, `maxSkew: 1`, `whenUnsatisfiable: DoNotSchedule`',
      'A taint on each zone\'s nodes and a matching toleration',
      'Three separate PriorityClasses, one per zone',
    ],
    answer: [1],
    explanation:
      'Topology spread constraints count matching Pods per topology domain (here, zones). `maxSkew: 1` limits the difference between the fullest and emptiest zone, and `DoNotSchedule` makes it a hard rule; `ScheduleAnyway` would turn it into a scoring preference.',
    choiceRationale: [
      'A nodeSelector filters nodes by one exact label value; it cannot balance counts across zones.',
      'Correct: this is exactly what topology spread constraints are for.',
      'Taints repel Pods from nodes; they do not balance Pods across zones.',
      'PriorityClass affects queue order and preemption, not placement across zones.',
    ],
    references: [R.topologySpread],
    tags: ['topology-spread', 'high-availability', 'zones'],
  },
  {
    id: 'q-kf-scheduling-103',
    domain: 'fundamentals',
    objective: 'kf-scheduling',
    lessonId: 'scheduling-placement',
    difficulty: 3,
    type: 'single',
    prompt: `Batch jobs should be scheduled before normal workloads when capacity frees up, but must never evict anything already running. A platform engineer writes:

\`\`\`yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: batch-high
value: 100000
preemptionPolicy: Never
\`\`\`

How do Pods using \`batch-high\` behave on a full cluster?`,
    choices: [
      'They sit ahead of lower-priority Pods in the scheduling queue but wait for free capacity instead of preempting other Pods',
      'They preempt lower-priority Pods because their value is high',
      'They are rejected because `preemptionPolicy: Never` requires `value: 0`',
      'They are scheduled with BestEffort QoS regardless of their requests',
    ],
    answer: [0],
    explanation:
      'Priority affects two things: order in the scheduling queue and the ability to preempt. `preemptionPolicy: Never` keeps the first and disables the second, so these Pods are tried first but only land when a node has room. The default policy is `PreemptLowerPriority`.',
    choiceRationale: [
      'Correct: high queue priority, no preemption.',
      'Preemption is exactly what `preemptionPolicy: Never` turns off.',
      'Any priority value can be combined with `Never`.',
      'QoS class comes from requests and limits, not from priority.',
    ],
    references: [R.priority],
    tags: ['priorityclass', 'preemption', 'scheduling-queue'],
  },
  {
    id: 'q-kf-scheduling-104',
    domain: 'fundamentals',
    objective: 'kf-scheduling',
    lessonId: 'scheduling-placement',
    difficulty: 2,
    type: 'single',
    prompt: `A Pod is Pending. Its events show:

\`\`\`
Warning  FailedScheduling  default-scheduler  0/4 nodes are available: 1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }, 3 node(s) didn't match Pod's node affinity/selector.
\`\`\`

The Pod spec contains \`nodeSelector: {disktype: ssd}\`. What is the most likely fix?`,
    choices: [
      'Add more CPU to the three worker nodes',
      'Add a toleration for the control-plane taint',
      'Label the intended worker node with `disktype=ssd`, or correct the selector to a label the workers actually have',
      'Restart kube-scheduler to clear its cache',
    ],
    answer: [2],
    explanation:
      'The scheduler filters nodes before scoring. The control-plane node is excluded by its taint, which is intended. The three workers are excluded because none matches the nodeSelector. Making a worker match (or fixing the selector) gives the Pod a feasible node.',
    choiceRationale: [
      'The message does not mention insufficient resources.',
      'That would let the Pod onto the control-plane node, which is not the intent, and it still needs `disktype=ssd` to match.',
      'Correct: no worker carries the required label.',
      'The scheduler is working and reporting a real constraint mismatch.',
    ],
    references: [R.scheduler, R.assignPod],
    tags: ['nodeselector', 'failed-scheduling', 'filtering'],
  },
  {
    id: 'q-kf-scheduling-105',
    domain: 'fundamentals',
    objective: 'kf-scheduling',
    lessonId: 'control-plane-controllers',
    difficulty: 3,
    type: 'single',
    prompt:
      'A Pod sets `spec.schedulerName: gpu-scheduler`, but no scheduler with that name (and no matching kube-scheduler profile) runs in the cluster. What happens?',
    choices: [
      'The default scheduler places the Pod after a timeout',
      'The API server rejects the Pod as invalid',
      'The kubelet on the first Ready node starts the Pod',
      'The Pod stays Pending with no scheduling events, because every scheduler ignores Pods addressed to another name',
    ],
    answer: [3],
    explanation:
      'Each scheduler (or each profile in a kube-scheduler configuration) only handles Pods whose `schedulerName` matches it; the default is `default-scheduler`. If nothing answers to `gpu-scheduler`, nobody binds the Pod and it remains Pending, typically without any FailedScheduling events.',
    choiceRationale: [
      'The default scheduler never takes over Pods addressed to another scheduler.',
      '`schedulerName` is a free-form string; the API server does not check that a scheduler exists.',
      'The kubelet only runs Pods already bound to its node.',
      'Correct: no matching scheduler means no binding and no events.',
    ],
    references: [R.multipleSchedulers, R.schedulerConfig],
    tags: ['scheduler-name', 'scheduler-profiles', 'pending'],
  },
  {
    id: 'q-kf-scheduling-106',
    domain: 'fundamentals',
    objective: 'kf-scheduling',
    lessonId: 'control-plane-controllers',
    difficulty: 1,
    type: 'single',
    prompt:
      'A debugging Pod is created with `spec.nodeName: worker-1` already filled in. What role does kube-scheduler play for this Pod?',
    choices: [
      'None: the Pod is already bound to `worker-1`, so the kubelet there runs it directly',
      'It verifies the choice and moves the Pod if `worker-1` is busy',
      'It treats `nodeName` as a preference and scores `worker-1` higher',
      'It rejects the Pod because only the scheduler may set `nodeName`',
    ],
    answer: [0],
    explanation:
      'The scheduler\'s job is to set `nodeName` for Pods that do not have one. If it is set at creation, the scheduler skips the Pod and the kubelet on that node tries to run it. That also bypasses scheduling checks: if the node lacks resources, the kubelet rejects the Pod.',
    choiceRationale: [
      'Correct: setting `nodeName` bypasses the scheduler.',
      'The scheduler never moves Pods once they are bound.',
      'Preferences are expressed with affinity; `nodeName` is a direct assignment.',
      'Users may set `nodeName` at creation time; it is valid.',
    ],
    references: [R.assignPod],
    tags: ['nodename', 'binding', 'scheduler'],
  },
  {
    id: 'q-kf-scheduling-107',
    domain: 'fundamentals',
    objective: 'kf-scheduling',
    lessonId: 'scheduling-placement',
    difficulty: 2,
    type: 'single',
    prompt:
      'Each `web` Pod must run on the same node as a `cache` Pod (label `app=cache`) to keep latency low. Which rule expresses this?',
    choices: [
      '`podAntiAffinity` with `labelSelector: app=cache` and `topologyKey: kubernetes.io/hostname`',
      '`nodeAffinity` requiring the label `app=cache` on the node',
      '`podAffinity` with `labelSelector: app=cache` and `topologyKey: kubernetes.io/hostname`',
      '`topologySpreadConstraints` with `maxSkew: 0`',
    ],
    answer: [2],
    explanation:
      'Inter-Pod affinity places a Pod relative to other Pods. `podAffinity` attracts it into the same topology domain as matching Pods; with `topologyKey: kubernetes.io/hostname` the domain is a single node. `podAntiAffinity` does the opposite.',
    choiceRationale: [
      'Anti-affinity would keep `web` away from nodes running `cache`.',
      '`app=cache` is a Pod label, not a node label, so node affinity would match nothing.',
      'Correct: Pod affinity with the hostname topology key co-locates them on one node.',
      'Spread constraints distribute Pods; `maxSkew` must also be at least 1.',
    ],
    references: [R.assignPod],
    tags: ['pod-affinity', 'co-location'],
  },
  {
    id: 'q-kf-scheduling-108',
    domain: 'fundamentals',
    objective: 'kf-scheduling',
    lessonId: 'scheduling-placement',
    difficulty: 2,
    type: 'multi',
    prompt:
      'An admin adds the taint `maintenance=true:NoExecute` to a node that is already running Pods. Select TWO accurate statements.',
    choices: [
      'Running Pods without a matching toleration are evicted from the node',
      'Running Pods are unaffected; the taint only applies to newly scheduled Pods',
      'A Pod that tolerates the taint with `tolerationSeconds: 300` may stay for 300 seconds and is then evicted',
      'The taint removes the node from the cluster until it is deleted',
    ],
    answer: [0, 2],
    explanation:
      '`NoSchedule` only blocks new placements. `NoExecute` also affects running Pods: those without a matching toleration are evicted, and those with a toleration that sets `tolerationSeconds` stay only that long. A toleration without `tolerationSeconds` lets the Pod stay indefinitely.',
    choiceRationale: [
      'Correct: NoExecute evicts running Pods that do not tolerate it.',
      'That describes `NoSchedule`, not `NoExecute`.',
      'Correct: `tolerationSeconds` bounds how long a tolerating Pod remains.',
      'Taints never remove the Node object; they only affect which Pods run there.',
    ],
    references: [R.taints],
    tags: ['taints', 'noexecute', 'eviction'],
  },

  // ---------------------------------------------------------------- kf-containerization
  {
    id: 'q-kf-containerization-101',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'container-images-and-oci',
    difficulty: 1,
    type: 'single',
    prompt: `A Go service image is 1.1 GB because it contains the compiler and build cache. A developer rewrites the Dockerfile:

\`\`\`
FROM golang:1.23 AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -o /out/api .

FROM gcr.io/distroless/static
COPY --from=build /out/api /api
ENTRYPOINT ["/api"]
\`\`\`

Why is the resulting image much smaller?`,
    choices: [
      'Distroless images compress layers more aggressively',
      'The `AS build` keyword strips debug symbols from the binary',
      'Docker automatically removes `golang` files after the build completes',
      'Only the final stage becomes the image; the toolchain stays in the discarded build stage and only the binary is copied over',
    ],
    answer: [3],
    explanation:
      'In a multi-stage build each `FROM` starts a new stage. The image you ship is the last stage, and `COPY --from=build` pulls just the needed artifact out of an earlier stage. Compilers, sources and caches never reach the final image, which also shrinks the attack surface.',
    choiceRationale: [
      'The base image is small because it contains little, not because of special compression.',
      '`AS` just names the stage; it does not change the binary.',
      'Nothing is removed automatically; files are simply never copied into the final stage.',
      'Correct: only the last stage plus copied artifacts make up the image.',
    ],
    references: [R.multiStage],
    tags: ['multi-stage-builds', 'dockerfile', 'image-size'],
  },
  {
    id: 'q-kf-containerization-102',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'container-images-and-oci',
    difficulty: 2,
    type: 'single',
    prompt:
      'Pods of the same Deployment, all using `image: registry.example.com/shop/api:2.4`, behave differently on different nodes. It turns out someone re-pushed the `2.4` tag with new code last week. How can the team guarantee every node runs byte-identical images?',
    choices: [
      'Set `imagePullPolicy: Never` on all containers',
      'Use a longer, more descriptive tag such as `2.4-final`',
      'Reference the image by digest, for example `registry.example.com/shop/api@sha256:<digest>`',
      'Restart the kubelet on every node to clear the image cache',
    ],
    answer: [2],
    explanation:
      'Tags are mutable pointers that can be moved to different content. A digest is a hash of the image manifest, so it always refers to exactly the same content. Pinning by digest makes deployments reproducible regardless of tag changes.',
    choiceRationale: [
      '`Never` uses whatever is already cached on each node, which is exactly what differs between nodes.',
      'Any tag, however descriptive, can be re-pushed.',
      'Correct: a digest is content-addressed and immutable.',
      'The kubelet restart does not clear images, and a fresh pull of a moved tag could still vary over time.',
    ],
    references: [R.images],
    tags: ['image-digest', 'tags', 'reproducibility'],
  },
  {
    id: 'q-kf-containerization-103',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'node-components',
    difficulty: 2,
    type: 'single',
    prompt:
      'On a containerd-based node, which component finally sets up the namespaces and cgroups and starts the container process when the kubelet asks for a container?',
    choices: [
      'kube-proxy, which prepares the network namespace and starts the process',
      'runc, the low-level OCI runtime that containerd invokes (through its shim) to create the container',
      'The kubelet itself, using the CRI as a library',
      'The container registry, which streams the running process to the node',
    ],
    answer: [1],
    explanation:
      'The chain is kubelet → CRI (gRPC) → containerd (high-level runtime: images, snapshots, lifecycle) → shim → runc. runc is the reference implementation of the OCI runtime spec and does the actual kernel work of creating namespaces and cgroups and exec-ing the process.',
    choiceRationale: [
      'kube-proxy programs Service routing; it does not start containers.',
      'Correct: runc is the low-level OCI runtime under containerd (and CRI-O).',
      'The CRI is an API the kubelet calls over gRPC; the kubelet does not create containers itself.',
      'Registries store and serve images; they never run containers.',
    ],
    references: [R.cri, R.oci],
    tags: ['runc', 'oci-runtime', 'containerd', 'cri'],
  },
  {
    id: 'q-kf-containerization-104',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'node-components',
    difficulty: 1,
    type: 'single',
    prompt:
      'An engineer SSHs into a node of a recent cluster to inspect containers, but `docker ps` reports that the command is not found. The node uses containerd. Which CLI is designed to inspect Pods and containers through the CRI?',
    choices: ['`crictl`', '`kubeadm`', '`etcdctl`', '`kube-proxy`'],
    answer: [0],
    explanation:
      '`crictl` talks to any CRI-compatible runtime (containerd, CRI-O) and offers commands such as `crictl ps`, `crictl pods`, `crictl images` and `crictl logs`. Docker is not required on Kubernetes nodes since dockershim was removed.',
    choiceRationale: [
      'Correct: crictl is the CRI debugging CLI for nodes.',
      'kubeadm bootstraps and upgrades clusters; it does not list containers.',
      'etcdctl manages etcd data, not containers.',
      'kube-proxy is a networking component, not a CLI for containers.',
    ],
    references: [R.crictl],
    tags: ['crictl', 'cri', 'node-debugging'],
  },
  {
    id: 'q-kf-containerization-105',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'container-images-and-oci',
    difficulty: 2,
    type: 'single',
    prompt: `A new Pod uses an image from the company's private registry:

\`\`\`
$ kubectl describe pod billing-6c9f7-2mz4q
...
  Warning  Failed  12s  kubelet  Failed to pull image "registry.corp.example/billing:3.1": failed to authorize: 401 Unauthorized
  Warning  Failed  12s  kubelet  Error: ErrImagePull
\`\`\`

The image and tag exist. What is the standard fix?`,
    choices: [
      'Set `imagePullPolicy: Always` so the kubelet retries with credentials',
      'Create a `docker-registry` type Secret with the registry credentials and reference it in the Pod\'s `imagePullSecrets` (or attach it to the Pod\'s ServiceAccount)',
      'Add the registry password to a ConfigMap mounted in the container',
      'Run the container as root so it can read the registry credentials',
    ],
    answer: [1],
    explanation:
      'The 401 shows the registry requires authentication. The kubelet pulls images using credentials from the Pod\'s `imagePullSecrets` (a Secret of type `kubernetes.io/dockerconfigjson`, created for example with `kubectl create secret docker-registry`). Adding the Secret to the ServiceAccount applies it to every Pod using that account.',
    choiceRationale: [
      'Pull policy controls when to pull, not how to authenticate.',
      'Correct: pull credentials are supplied through imagePullSecrets.',
      'The image is pulled by the kubelet before the container exists, so nothing mounted inside it can help.',
      'The container does not exist yet; its user has nothing to do with pulling.',
    ],
    references: [R.privateRegistry, R.images],
    tags: ['image-pull-secrets', 'private-registry', 'errimagepull'],
  },
  {
    id: 'q-kf-containerization-106',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'container-images-and-oci',
    difficulty: 1,
    type: 'single',
    prompt:
      'A manifest uses `image: ghcr.io/acme/payments:1.7.2`. Which reading of that reference is correct?',
    choices: [
      'Registry `acme`, repository `payments`, tag `ghcr.io`',
      'Registry `ghcr.io`, repository `acme/payments:1.7.2`, no tag (defaults to `latest`)',
      'Registry `docker.io`, repository `ghcr.io/acme/payments`, tag `1.7.2`',
      'Registry `ghcr.io`, repository `acme/payments`, tag `1.7.2`',
    ],
    answer: [3],
    explanation:
      'An image reference is `[registry/]repository[:tag][@digest]`. The first component is treated as a registry host when it contains a dot or port (or is `localhost`). Without a registry, runtimes default to Docker Hub, so `nginx` means `docker.io/library/nginx:latest`.',
    choiceRationale: [
      'The parts are shifted; the tag always comes after the last colon.',
      'The `:1.7.2` suffix is the tag, not part of the repository name.',
      '`ghcr.io` contains a dot, so it is the registry host, not part of a Docker Hub path.',
      'Correct: host, repository path, then tag.',
    ],
    references: [R.images],
    tags: ['image-reference', 'registry', 'tags'],
  },
  {
    id: 'q-kf-containerization-107',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'container-images-and-oci',
    difficulty: 3,
    type: 'single',
    prompt: `A Dockerfile needs a deploy key only while fetching dependencies:

\`\`\`
FROM alpine:3.20
COPY id_ed25519 /root/.ssh/id_ed25519
RUN apk add --no-cache git openssh && git clone git@git.example.com:acme/libs.git /libs
RUN rm /root/.ssh/id_ed25519
\`\`\`

The final container has no key file. Is the key safe if the image is pushed to a shared registry?`,
    choices: [
      'Yes, because the last layer deletes the file',
      'Yes, because registries strip files that were deleted in later layers',
      'No: the key is still stored in the layer created by `COPY`; use a build secret mount or a multi-stage build so it never lands in a shipped layer',
      'No, but only if the image is run with `--privileged`',
    ],
    answer: [2],
    explanation:
      'Image layers are additive. A later `rm` only adds a "whiteout" entry hiding the file from the merged filesystem; the earlier layer still contains the key and anyone who pulls the image can extract it. Secrets should come from BuildKit secret mounts (`RUN --mount=type=secret`) or live only in a discarded build stage.',
    choiceRationale: [
      'Deleting in a later layer hides the file but does not remove it from the earlier layer.',
      'Registries store layers as pushed; they do not rewrite content.',
      'Correct: the `COPY` layer still holds the key.',
      'The key can be extracted from the image layers without running a container at all.',
    ],
    references: [R.oci, R.multiStage],
    tags: ['image-layers', 'secrets-in-images', 'supply-chain'],
  },
  {
    id: 'q-kf-containerization-108',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'container-images-and-oci',
    difficulty: 1,
    type: 'multi',
    prompt: 'A team is choosing where to store and distribute its container images. Select TWO that are container image registries.',
    choices: ['Harbor', 'runc', 'Docker Hub', 'CoreDNS'],
    answer: [0, 2],
    explanation:
      'A registry stores images and serves them through the OCI distribution API. Harbor is a CNCF graduated, self-hostable registry; Docker Hub is a public hosted registry and the default for unqualified image names.',
    choiceRationale: [
      'Correct: Harbor is an open-source registry and a CNCF graduated project.',
      'runc is a low-level container runtime; it runs containers but stores no images for distribution.',
      'Correct: Docker Hub is a hosted public registry.',
      'CoreDNS provides cluster DNS, not image storage.',
    ],
    references: [R.images, R.cncfProjects],
    tags: ['registries', 'harbor', 'oci-distribution'],
  },
];
