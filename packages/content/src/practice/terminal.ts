import type { TerminalChallenge } from '../types';

export const terminalChallenges: TerminalChallenge[] = [
  {
    id: 'term-explore-cluster',
    title: 'First look at a new cluster',
    objective: 'kf-core',
    lessonId: 'cluster-architecture',
    difficulty: 1,
    scenario:
      'You just received a kubeconfig for a small training cluster (one control-plane node, two workers). Before deploying anything, get oriented: which nodes exist, which namespaces exist, and what is already running.',
    steps: [
      {
        task: 'List the nodes in the cluster and check that they are all `Ready`.',
        expect: [{ verb: 'get', resource: 'nodes' }],
        output: `NAME                 STATUS   ROLES           AGE   VERSION
kcna-control-plane   Ready    control-plane   12d   v1.31.2
kcna-worker          Ready    <none>          12d   v1.31.2
kcna-worker2         Ready    <none>          12d   v1.31.2`,
        hint: 'Nodes are a cluster-scoped resource: kubectl get nodes',
        explanation:
          'Nodes are cluster-scoped, so no namespace is involved. `ROLES` is derived from the `node-role.kubernetes.io/...` labels; worker nodes usually show `<none>`. `Ready` means the kubelet is reporting healthy status to the API server.',
      },
      {
        task: 'List the namespaces in the cluster.',
        expect: [{ verb: 'get', resource: 'namespaces' }],
        output: `NAME                 STATUS   AGE
default              Active   12d
kube-node-lease      Active   12d
kube-public          Active   12d
kube-system          Active   12d
local-path-storage   Active   12d
shop                 Active   3d`,
        hint: 'Namespaces are also cluster-scoped. The short name is ns.',
        explanation:
          'Every cluster starts with `default`, `kube-system`, `kube-public` and `kube-node-lease`. `kube-node-lease` holds the Lease objects nodes use as heartbeats. Namespaces themselves are not namespaced.',
      },
      {
        task: 'List Pods across **all** namespaces to see what is already running.',
        expect: [{ verb: 'get', resource: 'pods', flags: { 'all-namespaces': '' } }],
        output: `NAMESPACE            NAME                                         READY   STATUS    RESTARTS   AGE
kube-system          coredns-7db6d8ff4d-4kz9p                     1/1     Running   0          12d
kube-system          coredns-7db6d8ff4d-qv7mt                     1/1     Running   0          12d
kube-system          etcd-kcna-control-plane                      1/1     Running   0          12d
kube-system          kindnet-6wq2d                                1/1     Running   0          12d
kube-system          kindnet-b8x4n                                1/1     Running   0          12d
kube-system          kindnet-lm2rc                                1/1     Running   0          12d
kube-system          kube-apiserver-kcna-control-plane            1/1     Running   0          12d
kube-system          kube-controller-manager-kcna-control-plane   1/1     Running   0          12d
kube-system          kube-proxy-5hzcj                             1/1     Running   0          12d
kube-system          kube-proxy-9tfqw                             1/1     Running   0          12d
kube-system          kube-proxy-xr7dk                             1/1     Running   0          12d
kube-system          kube-scheduler-kcna-control-plane            1/1     Running   0          12d
local-path-storage   local-path-provisioner-6f8956fb48-zw5vh      1/1     Running   0          12d
shop                 cart-5d7c9b6f4-hm2xq                         1/1     Running   0          3d`,
        hint: 'Use -A (or --all-namespaces) with kubectl get pods.',
        explanation:
          'Without `-A` kubectl only shows the current namespace (usually `default`). The control-plane components (`kube-apiserver`, `etcd`, `kube-scheduler`, `kube-controller-manager`) run here as static Pods on the control-plane node. `kube-proxy` and the CNI agent (`kindnet`) run once per node via DaemonSets.',
      },
      {
        task: 'Show the Pods in `kube-system` with extra columns so you can see **which node** each one runs on.',
        expect: [{ verb: 'get', resource: 'pods', namespace: 'kube-system', flags: { output: 'wide' } }],
        output: `NAME                                         READY   STATUS    RESTARTS   AGE   IP           NODE                 NOMINATED NODE   READINESS GATES
coredns-7db6d8ff4d-4kz9p                     1/1     Running   0          12d   10.244.0.3   kcna-control-plane   <none>           <none>
coredns-7db6d8ff4d-qv7mt                     1/1     Running   0          12d   10.244.0.2   kcna-control-plane   <none>           <none>
etcd-kcna-control-plane                      1/1     Running   0          12d   172.18.0.4   kcna-control-plane   <none>           <none>
kindnet-6wq2d                                1/1     Running   0          12d   172.18.0.4   kcna-control-plane   <none>           <none>
kindnet-b8x4n                                1/1     Running   0          12d   172.18.0.2   kcna-worker          <none>           <none>
kindnet-lm2rc                                1/1     Running   0          12d   172.18.0.3   kcna-worker2         <none>           <none>
kube-apiserver-kcna-control-plane            1/1     Running   0          12d   172.18.0.4   kcna-control-plane   <none>           <none>
kube-controller-manager-kcna-control-plane   1/1     Running   0          12d   172.18.0.4   kcna-control-plane   <none>           <none>
kube-proxy-5hzcj                             1/1     Running   0          12d   172.18.0.4   kcna-control-plane   <none>           <none>
kube-proxy-9tfqw                             1/1     Running   0          12d   172.18.0.2   kcna-worker          <none>           <none>
kube-proxy-xr7dk                             1/1     Running   0          12d   172.18.0.3   kcna-worker2         <none>           <none>
kube-scheduler-kcna-control-plane            1/1     Running   0          12d   172.18.0.4   kcna-control-plane   <none>           <none>`,
        hint: 'Combine -n kube-system with -o wide.',
        explanation:
          '`-o wide` adds the Pod IP and node. Notice that `kube-proxy` and `kindnet` use the **node IP** (they run with `hostNetwork: true`), while CoreDNS gets an address from the Pod CIDR (`10.244.x.x`).',
      },
    ],
  },
  {
    id: 'term-scale-deployment',
    title: 'Inspect and scale a Deployment',
    objective: 'kf-core',
    lessonId: 'replicasets-and-deployments',
    difficulty: 1,
    scenario:
      'A Deployment called `web` runs the storefront in the `default` namespace. Traffic is about to spike for a sale. Inspect it, then scale it from 3 to 5 replicas and confirm the new Pods.',
    steps: [
      {
        task: 'List the Deployments in the current namespace.',
        expect: [{ verb: 'get', resource: 'deployments' }],
        output: `NAME   READY   UP-TO-DATE   AVAILABLE   AGE
web    3/3     3            3            2d`,
        hint: 'kubectl get deployments (short name: deploy)',
        explanation:
          '`READY 3/3` = ready replicas / desired replicas. `UP-TO-DATE` counts replicas matching the current Pod template; `AVAILABLE` counts replicas that have been ready for at least `minReadySeconds`.',
      },
      {
        task: 'Describe the `web` Deployment to see its selector, strategy and Pod template.',
        expect: [{ verb: 'describe', resource: 'deployments', name: 'web' }],
        output: `Name:                   web
Namespace:              default
CreationTimestamp:      Mon, 09 Nov 2026 10:14:02 +0000
Labels:                 app=web
Selector:               app=web
Replicas:               3 desired | 3 updated | 3 total | 3 available | 0 unavailable
StrategyType:           RollingUpdate
MinReadySeconds:        0
RollingUpdateStrategy:  25% max unavailable, 25% max surge
Pod Template:
  Labels:  app=web
  Containers:
   nginx:
    Image:        nginx:1.27
    Port:         80/TCP
    Host Port:    0/TCP
    Environment:  <none>
    Mounts:       <none>
  Volumes:        <none>
Conditions:
  Type           Status  Reason
  ----           ------  ------
  Available      True    MinimumReplicasAvailable
  Progressing    True    NewReplicaSetAvailable
OldReplicaSets:  <none>
NewReplicaSet:   web-6c9f8d7b54 (3/3 replicas created)
Events:          <none>`,
        hint: 'kubectl describe deployment web',
        explanation:
          'The Deployment does not own Pods directly: it owns the ReplicaSet `web-6c9f8d7b54`, which owns the Pods. The default strategy is `RollingUpdate` with 25% max unavailable / 25% max surge.',
      },
      {
        task: 'Scale `web` to **5** replicas.',
        expect: [{ verb: 'scale', resource: 'deployments', name: 'web', flags: { replicas: '5' } }],
        output: `deployment.apps/web scaled`,
        hint: 'kubectl scale deployment web --replicas=5',
        explanation:
          '`kubectl scale` updates `spec.replicas`. The Deployment controller passes the new count to its ReplicaSet, and the ReplicaSet controller creates two more Pods. Note: if this Deployment is managed by GitOps or an HPA, an imperative scale will be overwritten.',
      },
      {
        task: 'List only the Pods that belong to `web` using its label selector.',
        expect: [{ verb: 'get', resource: 'pods', flags: { selector: 'app=web' } }],
        output: `NAME                   READY   STATUS    RESTARTS   AGE
web-6c9f8d7b54-2kxbz   1/1     Running   0          2d
web-6c9f8d7b54-8hq4n   1/1     Running   0          2d
web-6c9f8d7b54-tm7vd   1/1     Running   0          2d
web-6c9f8d7b54-pz5wr   1/1     Running   0          9s
web-6c9f8d7b54-r4lcj   1/1     Running   0          9s`,
        hint: 'Use -l app=web (the selector shown by describe).',
        explanation:
          'Pod names are `<replicaset-name>-<random suffix>`, and the ReplicaSet name is `<deployment>-<pod-template-hash>`. The two new Pods share the same template hash because only the replica count changed, not the template.',
      },
    ],
  },
  {
    id: 'term-crashloop',
    title: 'Diagnose a CrashLoopBackOff',
    objective: 'co-troubleshooting',
    lessonId: 'troubleshooting-workloads',
    difficulty: 2,
    scenario:
      'After a config change, users report the `api` service is down. The Deployment `api` in namespace `default` was updated ten minutes ago. Find out why its Pod keeps restarting.',
    steps: [
      {
        task: 'List the Pods and spot the unhealthy one.',
        expect: [{ verb: 'get', resource: 'pods' }],
        output: `NAME                   READY   STATUS             RESTARTS      AGE
api-5f7b8c9d6-x2kqp    0/1     CrashLoopBackOff   6 (42s ago)   9m48s
web-6c9f8d7b54-2kxbz   1/1     Running            0             2d`,
        hint: 'kubectl get pods',
        explanation:
          '`CrashLoopBackOff` is not a crash reason — it means the container keeps exiting and the kubelet is waiting an increasing back-off delay (up to 5 minutes) before restarting it again.',
      },
      {
        task: 'Describe the failing Pod `api-5f7b8c9d6-x2kqp` and look at the container state and events.',
        expect: [{ verb: 'describe', resource: 'pods', name: 'api-5f7b8c9d6-x2kqp' }],
        output: `Name:             api-5f7b8c9d6-x2kqp
Namespace:        default
Node:             kcna-worker2/172.18.0.3
Status:           Running
IP:               10.244.2.17
Controlled By:    ReplicaSet/api-5f7b8c9d6
Containers:
  api:
    Image:          busybox:1.36
    Command:
      sh
      -c
      test -n "$DATABASE_URL" || { echo "FATAL: DATABASE_URL is not set"; exit 1; }; sleep 3600
    State:          Waiting
      Reason:       CrashLoopBackOff
    Last State:     Terminated
      Reason:       Error
      Exit Code:    1
      Started:      Thu, 12 Nov 2026 09:31:05 +0000
      Finished:     Thu, 12 Nov 2026 09:31:05 +0000
    Ready:          False
    Restart Count:  6
Events:
  Type     Reason     Age                    From               Message
  ----     ------     ----                   ----               -------
  Normal   Scheduled  9m48s                  default-scheduler  Successfully assigned default/api-5f7b8c9d6-x2kqp to kcna-worker2
  Normal   Pulled     3m12s (x7 over 9m47s)  kubelet            Container image "busybox:1.36" already present on machine
  Normal   Created    3m12s (x7 over 9m47s)  kubelet            Created container api
  Normal   Started    3m12s (x7 over 9m47s)  kubelet            Started container api
  Warning  BackOff    42s (x41 over 9m45s)   kubelet            Back-off restarting failed container api in pod api-5f7b8c9d6-x2kqp_default(3b1f...)`,
        hint: 'kubectl describe pod <name>',
        explanation:
          'The image pulled and the container started, so this is not an image or scheduling problem. `Last State: Terminated, Exit Code: 1` says the **process itself** exited with an error right after starting. The next stop is the logs of that previous run.',
      },
      {
        task: 'Show the logs of the **previous** (crashed) container instance.',
        expect: [{ verb: 'logs', name: 'api-5f7b8c9d6-x2kqp', flags: { previous: '' } }],
        output: `FATAL: DATABASE_URL is not set`,
        hint: 'kubectl logs <pod> --previous (or -p)',
        explanation:
          'Plain `kubectl logs` shows the current container instance, which may have just restarted and printed nothing yet. `--previous` shows the output of the last terminated instance — usually where the real error is. Here the app requires `DATABASE_URL`, which the recent change removed from the Pod template.',
      },
      {
        task: 'Confirm the cause: print the Deployment `api` as YAML and check its container `env`.',
        expect: [{ verb: 'get', resource: 'deployments', name: 'api', flags: { output: 'yaml' } }],
        output: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
      - name: api
        image: busybox:1.36
        command: ["sh", "-c", "test -n \\"$DATABASE_URL\\" || { echo \\"FATAL: DATABASE_URL is not set\\"; exit 1; }; sleep 3600"]
        env:
        - name: LOG_LEVEL
          value: debug`,
        hint: 'kubectl get deployment api -o yaml',
        explanation:
          'Only `LOG_LEVEL` is set; `DATABASE_URL` is missing. Fix it in the Deployment (not the Pod — the ReplicaSet would just recreate the broken Pod), e.g. add the env var back or roll back with `kubectl rollout undo deployment/api`.',
      },
    ],
  },
  {
    id: 'term-expose-service',
    title: 'Expose a Deployment and check its endpoints',
    objective: 'co-networking',
    lessonId: 'services',
    difficulty: 2,
    scenario:
      'The `web` Deployment (3 nginx replicas, label `app=web`, container port 80) is running but nothing can reach it by a stable name. Create a ClusterIP Service for it and verify that the Service actually found the Pods.',
    steps: [
      {
        task: 'Expose the `web` Deployment as a Service on port **80**.',
        expect: [{ verb: 'expose', resource: 'deployments', name: 'web', flags: { port: '80' } }],
        output: `service/web exposed`,
        hint: 'kubectl expose deployment web --port=80',
        explanation:
          '`kubectl expose` copies the Deployment\'s selector (`app=web`) into a new Service. With no `--type`, the Service is `ClusterIP`. If `--target-port` is omitted it defaults to the same value as `--port`.',
      },
      {
        task: 'Show the new Service `web`.',
        expect: [{ verb: 'get', resource: 'services', name: 'web' }],
        output: `NAME   TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
web    ClusterIP   10.96.142.37   <none>        80/TCP    6s`,
        hint: 'kubectl get service web (short name: svc)',
        explanation:
          'The ClusterIP `10.96.142.37` is virtual: no interface owns it. kube-proxy programs rules on every node so traffic to it is load-balanced to the backing Pods. Inside the cluster the Service is also reachable as `web.default.svc.cluster.local`.',
      },
      {
        task: 'Check which Pod IPs the Service routes to.',
        expect: [
          { verb: 'get', resource: 'endpoints', name: 'web' },
          { verb: 'get', resource: 'endpointslices', flags: { selector: 'kubernetes.io/service-name=web' } },
          { verb: 'describe', resource: 'services', name: 'web' },
        ],
        output: `NAME   ENDPOINTS                                      AGE
web    10.244.1.12:80,10.244.1.13:80,10.244.2.9:80   6s`,
        hint: 'kubectl get endpoints web — or the EndpointSlices labelled kubernetes.io/service-name=web',
        explanation:
          'Three addresses = three ready Pods matched by the selector. An **empty** endpoints list is the classic sign of a selector/label mismatch or Pods that are not Ready. Modern clusters store this data in EndpointSlices; the legacy Endpoints API is still served for compatibility.',
      },
      {
        task: 'Verify the Pod IPs match: list the `app=web` Pods with wide output.',
        expect: [{ verb: 'get', resource: 'pods', flags: { selector: 'app=web', output: 'wide' } }],
        output: `NAME                   READY   STATUS    RESTARTS   AGE   IP            NODE           NOMINATED NODE   READINESS GATES
web-6c9f8d7b54-2kxbz   1/1     Running   0          2d    10.244.1.12   kcna-worker    <none>           <none>
web-6c9f8d7b54-8hq4n   1/1     Running   0          2d    10.244.1.13   kcna-worker    <none>           <none>
web-6c9f8d7b54-tm7vd   1/1     Running   0          2d    10.244.2.9    kcna-worker2   <none>           <none>`,
        hint: 'kubectl get pods -l app=web -o wide',
        explanation:
          'The Pod IPs match the endpoints exactly. The Service is a stable front; Pods can come and go and the endpoints list is updated automatically by the EndpointSlice controller.',
      },
    ],
  },
  {
    id: 'term-rollout-rollback',
    title: 'Rolling update and rollback',
    objective: 'cad-delivery',
    lessonId: 'rollouts-and-deployment-strategies',
    difficulty: 2,
    scenario:
      'The `web` Deployment runs `nginx:1.27` in container `nginx`. Ship `nginx:1.27-alpine`, watch the rollout, then practise rolling back as if the new version misbehaved.',
    steps: [
      {
        task: 'Update the image of container `nginx` in Deployment `web` to `nginx:1.27-alpine`.',
        expect: [{ verb: 'set', subcommand: 'image', resource: 'deployments', name: 'web' }],
        output: `deployment.apps/web image updated`,
        hint: 'kubectl set image deployment/web nginx=nginx:1.27-alpine',
        explanation:
          'Changing the Pod template creates a **new ReplicaSet** with a new pod-template-hash. The Deployment then scales the new ReplicaSet up and the old one down, respecting `maxSurge` and `maxUnavailable`.',
      },
      {
        task: 'Watch the rollout until it completes.',
        expect: [{ verb: 'rollout', subcommand: 'status', resource: 'deployments', name: 'web' }],
        output: `Waiting for deployment "web" rollout to finish: 1 out of 3 new replicas have been updated...
Waiting for deployment "web" rollout to finish: 2 out of 3 new replicas have been updated...
Waiting for deployment "web" rollout to finish: 1 old replicas are pending termination...
deployment "web" successfully rolled out`,
        hint: 'kubectl rollout status deployment/web',
        explanation:
          '`rollout status` blocks until the rollout finishes or fails, and exits non-zero on failure — which is why CI/CD pipelines use it as a gate after deploying.',
      },
      {
        task: 'Show the revision history of `web`.',
        expect: [{ verb: 'rollout', subcommand: 'history', resource: 'deployments', name: 'web' }],
        output: `deployment.apps/web
REVISION  CHANGE-CAUSE
1         <none>
2         <none>`,
        hint: 'kubectl rollout history deployment/web',
        explanation:
          'Each revision corresponds to a ReplicaSet the Deployment keeps around (up to `revisionHistoryLimit`, default 10). `CHANGE-CAUSE` is read from the `kubernetes.io/change-cause` annotation, which you can set yourself with `kubectl annotate`.',
      },
      {
        task: 'Roll `web` back to the previous revision.',
        expect: [
          { verb: 'rollout', subcommand: 'undo', resource: 'deployments', name: 'web' },
          { verb: 'rollout', subcommand: 'undo', resource: 'deployments', name: 'web', flags: { 'to-revision': '1' } },
        ],
        output: `deployment.apps/web rolled back`,
        hint: 'kubectl rollout undo deployment/web (optionally --to-revision=1)',
        explanation:
          'A rollback is just another rolling update: the old ReplicaSet\'s template is copied back and scaled up. The history now shows revisions 2 and 3 — revision 1 is renumbered to 3 because it became current again.',
      },
    ],
  },
  {
    id: 'term-labels-selectors',
    title: 'Find things with labels and selectors',
    objective: 'kf-core',
    lessonId: 'namespaces-labels-selectors',
    difficulty: 1,
    scenario:
      'The `shop` namespace contains Pods for several tiers of an online shop. You need to find the frontend Pods, tag one for debugging, and see how a Service picks its Pods.',
    steps: [
      {
        task: 'List all Pods in namespace `shop` together with their labels.',
        expect: [{ verb: 'get', resource: 'pods', namespace: 'shop', flags: { 'show-labels': '' } }],
        output: `NAME                        READY   STATUS    RESTARTS   AGE   LABELS
cart-5d7c9b6f4-hm2xq        1/1     Running   0          3d    app=cart,pod-template-hash=5d7c9b6f4,tier=backend
catalog-7b9d5c8f6-9wq2m     1/1     Running   0          3d    app=catalog,pod-template-hash=7b9d5c8f6,tier=backend
frontend-6d8f7c5b9-k4z7t    1/1     Running   0          3d    app=frontend,pod-template-hash=6d8f7c5b9,tier=frontend
frontend-6d8f7c5b9-v2hxn    1/1     Running   0          3d    app=frontend,pod-template-hash=6d8f7c5b9,tier=frontend
redis-0                     1/1     Running   0          3d    app=redis,apps.kubernetes.io/pod-index=0,controller-revision-hash=redis-7c8d9f6b5,statefulset.kubernetes.io/pod-name=redis-0,tier=cache`,
        hint: 'kubectl get pods -n shop --show-labels',
        explanation:
          'Labels are key/value pairs used for **selection**. Some are added automatically by controllers, such as `pod-template-hash` (Deployments) and `statefulset.kubernetes.io/pod-name` (StatefulSets).',
      },
      {
        task: 'List only the Pods in `shop` with label `tier=frontend`.',
        expect: [{ verb: 'get', resource: 'pods', namespace: 'shop', flags: { selector: 'tier=frontend' } }],
        output: `NAME                       READY   STATUS    RESTARTS   AGE
frontend-6d8f7c5b9-k4z7t   1/1     Running   0          3d
frontend-6d8f7c5b9-v2hxn   1/1     Running   0          3d`,
        hint: 'kubectl get pods -n shop -l tier=frontend',
        explanation:
          'This is the same equality-based selection that Services, ReplicaSets and NetworkPolicies use internally. Set-based selectors also exist, e.g. `-l \'tier in (frontend,cache)\'`.',
      },
      {
        task: 'Add the label `debug=true` to Pod `frontend-6d8f7c5b9-k4z7t` in `shop`.',
        expect: [{ verb: 'label', resource: 'pods', name: 'frontend-6d8f7c5b9-k4z7t', namespace: 'shop' }],
        output: `pod/frontend-6d8f7c5b9-k4z7t labeled`,
        hint: 'kubectl label pod frontend-6d8f7c5b9-k4z7t debug=true -n shop',
        explanation:
          'Adding a label does not affect the Pod\'s owner as long as the selector labels (`app=frontend`) are unchanged. Removing or changing a selector label would orphan the Pod — the ReplicaSet would create a replacement.',
      },
      {
        task: 'Show the Services in `shop` with wide output to see which selector each one uses.',
        expect: [{ verb: 'get', resource: 'services', namespace: 'shop', flags: { output: 'wide' } }],
        output: `NAME       TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE   SELECTOR
cart       ClusterIP   10.96.88.140    <none>        8080/TCP   3d    app=cart
catalog    ClusterIP   10.96.201.6     <none>        8080/TCP   3d    app=catalog
frontend   ClusterIP   10.96.17.233    <none>        80/TCP     3d    app=frontend
redis      ClusterIP   None            <none>        6379/TCP   3d    app=redis`,
        hint: 'kubectl get services -n shop -o wide',
        explanation:
          'The `SELECTOR` column is exactly what each Service matches against Pod labels. `redis` has `CLUSTER-IP None`: it is a **headless** Service, commonly paired with a StatefulSet so each Pod gets a stable DNS name.',
      },
    ],
  },
  {
    id: 'term-config-secrets',
    title: 'Inspect ConfigMaps and Secrets',
    objective: 'co-security',
    lessonId: 'configmaps-and-secrets',
    difficulty: 2,
    scenario:
      'The `cart` service in namespace `shop` reads settings from ConfigMap `cart-config` and credentials from Secret `cart-db`. A teammate asks what values the app actually receives.',
    steps: [
      {
        task: 'List the ConfigMaps in namespace `shop`.',
        expect: [{ verb: 'get', resource: 'configmaps', namespace: 'shop' }],
        output: `NAME               DATA   AGE
cart-config        3      3d
kube-root-ca.crt   1      3d`,
        hint: 'kubectl get configmaps -n shop (short name: cm)',
        explanation:
          '`DATA` is the number of keys. `kube-root-ca.crt` is published automatically into every namespace so Pods can verify the API server\'s certificate.',
      },
      {
        task: 'Show the keys and values of ConfigMap `cart-config`.',
        expect: [
          { verb: 'describe', resource: 'configmaps', name: 'cart-config', namespace: 'shop' },
          { verb: 'get', resource: 'configmaps', name: 'cart-config', namespace: 'shop', flags: { output: 'yaml' } },
        ],
        output: `Name:         cart-config
Namespace:    shop
Labels:       app=cart
Annotations:  <none>

Data
====
CACHE_TTL_SECONDS:
----
300
CURRENCY:
----
EUR
LOG_LEVEL:
----
info

BinaryData
====

Events:  <none>`,
        hint: 'kubectl describe configmap cart-config -n shop (or get ... -o yaml)',
        explanation:
          'ConfigMap values are plain text and fully visible. They are meant for non-sensitive configuration only.',
      },
      {
        task: 'Describe Secret `cart-db` in `shop`.',
        expect: [{ verb: 'describe', resource: 'secrets', name: 'cart-db', namespace: 'shop' }],
        output: `Name:         cart-db
Namespace:    shop
Labels:       app=cart
Annotations:  <none>

Type:  Opaque

Data
====
password:  15 bytes
username:  8 bytes`,
        hint: 'kubectl describe secret cart-db -n shop',
        explanation:
          '`describe` hides Secret values and only shows sizes. That is a convenience for screen-sharing, **not** a security boundary.',
      },
      {
        task: 'Print Secret `cart-db` as YAML to see how the data is stored.',
        expect: [{ verb: 'get', resource: 'secrets', name: 'cart-db', namespace: 'shop', flags: { output: 'yaml' } }],
        output: `apiVersion: v1
data:
  password: czNjcjN0LXBhc3N3MHJk
  username: Y2FydF9hcHA=
kind: Secret
metadata:
  labels:
    app: cart
  name: cart-db
  namespace: shop
type: Opaque`,
        hint: 'kubectl get secret cart-db -n shop -o yaml',
        explanation:
          'Values are **base64-encoded, not encrypted**: `echo Y2FydF9hcHA= | base64 -d` prints `cart_app`. Anyone allowed to `get` Secrets can read them, so restrict Secret access with RBAC and enable encryption at rest for etcd.',
      },
    ],
  },
];
