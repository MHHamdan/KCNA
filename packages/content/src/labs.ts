import type { Lab } from './types';

const KIND = { title: 'kind quick start', url: 'https://kind.sigs.k8s.io/docs/user/quick-start/' };
const KUBECTL = { title: 'kubectl reference', url: 'https://kubernetes.io/docs/reference/kubectl/' };

const KIND_PREREQS = [
  'Docker (or Podman) running locally',
  'kind v0.24+ installed (https://kind.sigs.k8s.io/)',
  'kubectl within one minor version of the cluster',
];

const CREATE_CLUSTER = 'kind create cluster --name kcna';
const DELETE_CLUSTER = 'kind delete cluster --name kcna';

const CLUSTER_TASK = {
  title: 'Start (or reuse) the lab cluster',
  instructions:
    'Create a single-node kind cluster called `kcna`. If it already exists from a previous lab, `kind create` will fail with "node(s) already exist" — just switch to its context instead.',
  commands: [CREATE_CLUSTER, 'kubectl config use-context kind-kcna', 'kubectl get nodes'],
  expected: `NAME                 STATUS   ROLES           AGE   VERSION
kcna-control-plane   Ready    control-plane   40s   v1.3x.x`,
  hint: 'If the node shows `NotReady`, wait 20–30 seconds: the CNI (kindnet) is still starting.',
};

export const labs: Lab[] = [
  // ───────────────────────────── FULL LABS ─────────────────────────────
  {
    id: 'lab-kind-cluster-explore',
    title: 'Create a kind cluster and explore its components',
    objectives: ['kf-core', 'kf-admin'],
    scope: 'kcna',
    status: 'full',
    environment: 'kind',
    estMinutes: 30,
    objective:
      'Stand up a local Kubernetes cluster with kind and identify every control-plane and node component you will be asked about on the exam: kube-apiserver, etcd, kube-scheduler, kube-controller-manager, kubelet, kube-proxy, CoreDNS and the container runtime.',
    prerequisites: KIND_PREREQS,
    architecture:
      'kind ("Kubernetes in Docker") runs each Kubernetes **node as a Docker container**. Inside the `kcna-control-plane` container, systemd runs **containerd** and the **kubelet**; the kubelet starts the control-plane components as **static Pods** from manifests in `/etc/kubernetes/manifests`. kube-proxy and the kindnet CNI agent run as DaemonSets, CoreDNS as a Deployment.\n\n```\nhost ── docker ── kcna-control-plane (container)\n                   ├─ containerd + kubelet (systemd)\n                   └─ Pods: kube-apiserver, etcd, scheduler, controller-manager,\n                            kube-proxy, kindnet, coredns, local-path-provisioner\n```',
    tasks: [
      {
        title: 'Create the cluster',
        instructions:
          'Create a cluster named `kcna`. kind writes a kubeconfig entry and switches your current context to `kind-kcna`.',
        commands: [CREATE_CLUSTER, 'kubectl config current-context', 'kubectl cluster-info'],
        expected: `Creating cluster "kcna" ...
...
Set kubectl context to "kind-kcna"
...
kind-kcna
Kubernetes control plane is running at https://127.0.0.1:<port>
CoreDNS is running at https://127.0.0.1:<port>/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy`,
        hint: 'If image download is slow, the first run can take a few minutes. Subsequent clusters reuse the cached `kindest/node` image.',
      },
      {
        title: 'Look at the node — from Kubernetes and from Docker',
        instructions:
          'List nodes with extra columns, then confirm the node is really a Docker container. Note the container runtime column.',
        commands: ['kubectl get nodes -o wide', 'docker ps --filter name=kcna'],
        expected: `NAME                 STATUS   ROLES           AGE   VERSION   INTERNAL-IP   EXTERNAL-IP   OS-IMAGE   KERNEL-VERSION   CONTAINER-RUNTIME
kcna-control-plane   Ready    control-plane   2m    v1.3x.x   172.18.0.2    <none>        Debian ... ...              containerd://2.x.x`,
        hint: '`CONTAINER-RUNTIME` shows containerd: Kubernetes talks to it through the CRI. Docker is only used by kind to host the node, not by the kubelet.',
      },
      {
        title: 'Find the control-plane components',
        instructions:
          'List the Pods in `kube-system` with the node they run on. Identify which are static Pods (their names end with the node name).',
        commands: ['kubectl get pods -n kube-system -o wide'],
        expected: `coredns-...                                 1/1   Running
etcd-kcna-control-plane                     1/1   Running
kindnet-...                                 1/1   Running
kube-apiserver-kcna-control-plane           1/1   Running
kube-controller-manager-kcna-control-plane  1/1   Running
kube-proxy-...                              1/1   Running
kube-scheduler-kcna-control-plane           1/1   Running`,
        hint: 'Static Pods are managed by the kubelet directly from files, so their names get the node name as suffix.',
      },
      {
        title: 'Peek inside the node',
        instructions:
          'Open the static Pod manifest directory and list running containers with `crictl`, the CRI command-line client shipped in the kind node image.',
        commands: [
          'docker exec kcna-control-plane ls /etc/kubernetes/manifests',
          'docker exec kcna-control-plane crictl ps',
        ],
        expected: `etcd.yaml
kube-apiserver.yaml
kube-controller-manager.yaml
kube-scheduler.yaml`,
        hint: 'Editing a file in `/etc/kubernetes/manifests` makes the kubelet recreate that component — this is how kubeadm-style clusters run the control plane.',
      },
      {
        title: 'Discover the API',
        instructions:
          'List the resource types the API server knows, separate namespaced and cluster-scoped ones, and use `kubectl explain` to read field docs offline.',
        commands: [
          'kubectl api-resources | head -20',
          'kubectl api-resources --namespaced=false',
          'kubectl explain pod.spec.containers.image',
          'kubectl get --raw=\'/readyz?verbose\' | tail -3',
        ],
        expected: `NAME          SHORTNAMES   APIVERSION   NAMESPACED   KIND
bindings                   v1           true         Binding
componentstatuses   cs     v1           false        ComponentStatus
configmaps          cm     v1           true         ConfigMap
...
readyz check passed`,
        hint: 'The SHORTNAMES column is where aliases like `po`, `svc`, `deploy` come from.',
      },
      {
        title: 'Namespaces and the default context',
        instructions: 'List namespaces and check which namespace your context uses by default.',
        commands: ['kubectl get namespaces', 'kubectl config get-contexts'],
        expected: `NAME                 STATUS   AGE
default              Active   5m
kube-node-lease      Active   5m
kube-public          Active   5m
kube-system          Active   5m
local-path-storage   Active   5m`,
        hint: 'An empty NAMESPACE column in `get-contexts` means `default`.',
      },
    ],
    validation: [
      { description: 'Node is Ready', command: "kubectl get nodes -o jsonpath='{.items[0].status.conditions[?(@.type==\"Ready\")].status}'", expected: 'True' },
      { description: 'API server is healthy', command: "kubectl get --raw='/readyz'", expected: 'ok' },
      { description: 'CoreDNS is running', command: 'kubectl get deployment coredns -n kube-system', expected: 'READY 2/2' },
    ],
    troubleshooting: [
      { symptom: 'kind create cluster fails with "Cannot connect to the Docker daemon"', fix: 'Start Docker (or Docker Desktop) and make sure your user can run `docker ps` without sudo.' },
      { symptom: 'ERROR: failed to create cluster: node(s) already exist for a cluster with the name "kcna"', fix: 'Reuse it (`kubectl config use-context kind-kcna`) or delete it first with `kind delete cluster --name kcna`.' },
      { symptom: 'kubectl: "The connection to the server localhost:8080 was refused"', fix: 'Your kubeconfig has no current context. Run `kubectl config use-context kind-kcna` or `kind export kubeconfig --name kcna`.' },
    ],
    cleanup: [DELETE_CLUSTER],
    references: [KIND, { title: 'Kubernetes Components', url: 'https://kubernetes.io/docs/concepts/overview/components/' }, KUBECTL],
  },
  {
    id: 'lab-pods-deployments',
    title: 'Pods and Deployments: deploy, scale, self-heal',
    objectives: ['kf-core'],
    scope: 'kcna',
    status: 'full',
    environment: 'kind',
    estMinutes: 35,
    objective:
      'See the difference between a bare Pod and a Deployment-managed Pod, scale a Deployment, and watch the ReplicaSet controller replace a deleted Pod — reconciliation in action.',
    prerequisites: [...KIND_PREREQS, 'Completed lab-kind-cluster-explore (or equivalent kubectl basics)'],
    architecture:
      'A **Deployment** owns a **ReplicaSet**, which owns **Pods**. Each controller compares desired state (`spec.replicas`) to actual state and acts on the difference. A bare Pod has no controller — when it is deleted, nothing recreates it.\n\n```\nDeployment web ──owns──> ReplicaSet web-<hash> ──owns──> Pod web-<hash>-<id> (x N)\n```',
    tasks: [
      CLUSTER_TASK,
      {
        title: 'Run a bare Pod and delete it',
        instructions:
          '`kubectl run` creates a single Pod with no controller. Delete it and confirm nothing brings it back.',
        commands: [
          'kubectl run solo --image=nginx:1.27',
          'kubectl get pod solo -o wide',
          'kubectl delete pod solo',
          'kubectl get pods',
        ],
        expected: `pod/solo created
...
pod "solo" deleted
No resources found in default namespace.`,
        hint: 'Wait until `solo` is `Running` before deleting so you see the whole lifecycle.',
      },
      {
        title: 'Create a Deployment',
        instructions: 'Create a Deployment with 3 replicas and look at all three layers of objects it creates.',
        commands: [
          'kubectl create deployment web --image=nginx:1.27 --replicas=3',
          'kubectl rollout status deployment/web',
          'kubectl get deployments,replicasets,pods -l app=web',
        ],
        expected: `NAME                  READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/web   3/3     3            3           20s

NAME                             DESIRED   CURRENT   READY   AGE
replicaset.apps/web-<hash>       3         3         3       20s

NAME                  READY   STATUS    RESTARTS   AGE
pod/web-<hash>-xxxxx  1/1     Running   0          20s
...`,
        hint: '`kubectl create deployment` labels everything `app=web` automatically, which is why `-l app=web` works.',
      },
      {
        title: 'Inspect ownership',
        instructions: 'Each Pod records its owner in `metadata.ownerReferences`. Print the owner kind and name of every web Pod.',
        commands: [
          "kubectl get pods -l app=web -o custom-columns=NAME:.metadata.name,OWNER_KIND:.metadata.ownerReferences[0].kind,OWNER:.metadata.ownerReferences[0].name",
        ],
        expected: `NAME                OWNER_KIND   OWNER
web-<hash>-xxxxx    ReplicaSet   web-<hash>
...`,
      },
      {
        title: 'Scale up and down',
        instructions: 'Scale to 5 replicas, then back to 2. Watch which Pods are removed.',
        commands: [
          'kubectl scale deployment web --replicas=5',
          'kubectl get pods -l app=web',
          'kubectl scale deployment web --replicas=2',
          'kubectl get pods -l app=web',
        ],
        expected: `deployment.apps/web scaled
... 5 Pods Running ...
deployment.apps/web scaled
... 2 Pods Running (others Terminating briefly) ...`,
        hint: 'Scaling only changes the replica count, so no new ReplicaSet is created — the pod-template-hash stays the same.',
      },
      {
        title: 'Self-healing',
        instructions:
          'Start a watch in a second terminal, then delete one Pod in the first. The ReplicaSet notices actual (1) ≠ desired (2) and creates a replacement within seconds.',
        commands: [
          'kubectl get pods -l app=web -w',
          "kubectl delete pod $(kubectl get pods -l app=web -o jsonpath='{.items[0].metadata.name}')",
        ],
        expected: `web-<hash>-aaaaa   1/1   Terminating         0   3m
web-<hash>-ccccc   0/1   Pending             0   0s
web-<hash>-ccccc   0/1   ContainerCreating   0   0s
web-<hash>-ccccc   1/1   Running             0   2s`,
        hint: 'Stop the watch with Ctrl+C. The replacement has a new name and IP — that is why clients should use a Service, not Pod IPs.',
      },
      {
        title: 'From imperative to declarative',
        instructions:
          'Generate the YAML that `kubectl create` would send, without creating anything, then apply an edited version declaratively.',
        commands: [
          'kubectl create deployment api --image=nginx:1.27-alpine --replicas=2 --dry-run=client -o yaml > api.yaml',
          'cat api.yaml',
          'kubectl apply -f api.yaml',
          'kubectl get deployment api',
        ],
        expected: `deployment.apps/api created
NAME   READY   UP-TO-DATE   AVAILABLE   AGE
api    2/2     2            2           10s`,
        hint: 'Edit `replicas` in `api.yaml` and run `kubectl apply -f api.yaml` again — apply computes the difference and patches only what changed.',
      },
    ],
    validation: [
      { description: 'web has 2 ready replicas', command: "kubectl get deployment web -o jsonpath='{.status.readyReplicas}'", expected: '2' },
      { description: 'api has 2 ready replicas', command: "kubectl get deployment api -o jsonpath='{.status.readyReplicas}'", expected: '2' },
      { description: 'Bare Pod is gone for good', command: 'kubectl get pod solo', expected: 'Error from server (NotFound): pods "solo" not found' },
    ],
    troubleshooting: [
      { symptom: 'Pods stuck in ContainerCreating for a long time', fix: 'The node is pulling the image. Check `kubectl describe pod <name>` events; on slow networks wait, or pre-load the image with `kind load docker-image nginx:1.27 --name kcna` after `docker pull nginx:1.27`.' },
      { symptom: 'error: failed to create deployment: deployments.apps "web" already exists', fix: 'You ran the lab before. Delete it with `kubectl delete deployment web` or continue with the existing one.' },
      { symptom: 'Deleting a Pod "does nothing" — it comes back', fix: 'That is the point: delete or scale the **Deployment** to remove Pods permanently.' },
    ],
    cleanup: ['kubectl delete deployment web api', 'rm -f api.yaml', DELETE_CLUSTER],
    references: [
      { title: 'Deployments', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/' },
      { title: 'Pods', url: 'https://kubernetes.io/docs/concepts/workloads/pods/' },
      KIND,
    ],
  },
  {
    id: 'lab-services-dns',
    title: 'Services and DNS',
    objectives: ['co-networking'],
    scope: 'kcna',
    status: 'full',
    environment: 'kind',
    estMinutes: 35,
    objective:
      'Give a set of Pods a stable virtual IP and DNS name with a ClusterIP Service, resolve it from another Pod, watch endpoints follow scaling, and understand how NodePort behaves on kind.',
    prerequisites: [...KIND_PREREQS, 'Completed lab-pods-deployments'],
    architecture:
      'A **Service** selects Pods by label; the EndpointSlice controller keeps the list of ready Pod IPs; **kube-proxy** on each node programs rules so traffic to the ClusterIP is spread across those IPs. **CoreDNS** answers `<service>.<namespace>.svc.cluster.local` with the ClusterIP.\n\n```\nclient Pod ──DNS──> CoreDNS: web.default.svc.cluster.local = 10.96.x.x\nclient Pod ──TCP 10.96.x.x:80──> kube-proxy rules ──> one of the web Pod IPs:80\n```',
    tasks: [
      CLUSTER_TASK,
      {
        title: 'Deploy backends',
        instructions: 'Create a 2-replica nginx Deployment and note the Pod IPs.',
        commands: [
          'kubectl create deployment web --image=nginx:1.27 --replicas=2',
          'kubectl rollout status deployment/web',
          'kubectl get pods -l app=web -o wide',
        ],
        expected: `NAME               READY   STATUS    RESTARTS   AGE   IP           NODE
web-<hash>-xxxxx   1/1     Running   0          15s   10.244.0.5   kcna-control-plane
web-<hash>-yyyyy   1/1     Running   0          15s   10.244.0.6   kcna-control-plane`,
      },
      {
        title: 'Create a ClusterIP Service',
        instructions: 'Expose the Deployment on port 80 and confirm that the Service found both Pods.',
        commands: [
          'kubectl expose deployment web --port=80',
          'kubectl get service web',
          'kubectl get endpointslices -l kubernetes.io/service-name=web',
        ],
        expected: `NAME   TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
web    ClusterIP   10.96.x.x      <none>        80/TCP    5s

NAME        ADDRESSTYPE   PORTS   ENDPOINTS               AGE
web-xxxxx   IPv4          80      10.244.0.5,10.244.0.6   5s`,
        hint: 'No `--type` means ClusterIP, the default.',
      },
      {
        title: 'Resolve and call the Service from a Pod',
        instructions:
          'Start a throwaway busybox Pod, look at its DNS config, resolve the Service name and fetch the nginx page. `--rm` deletes the Pod when the command ends.',
        commands: [
          "kubectl run dns-test --rm -it --restart=Never --image=busybox:1.36 -- sh -c 'cat /etc/resolv.conf; nslookup web.default.svc.cluster.local; wget -qO- http://web | head -4'",
        ],
        expected: `search default.svc.cluster.local svc.cluster.local cluster.local
nameserver 10.96.0.10
...
Name:	web.default.svc.cluster.local
Address: 10.96.x.x
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>`,
        hint: 'The short name `web` works because of the `search` list in resolv.conf. From another namespace you would need `web.default`.',
      },
      {
        title: 'Endpoints follow the Pods',
        instructions: 'Scale to 4 and check the EndpointSlice again, then scale to 0 and check once more.',
        commands: [
          'kubectl scale deployment web --replicas=4',
          'kubectl rollout status deployment/web',
          'kubectl get endpointslices -l kubernetes.io/service-name=web',
          'kubectl scale deployment web --replicas=0',
          'kubectl get endpointslices -l kubernetes.io/service-name=web',
          'kubectl scale deployment web --replicas=2',
        ],
        expected: `web-xxxxx   IPv4   80   10.244.0.5,10.244.0.6,10.244.0.7 + 1 more...
...
web-xxxxx   IPv4   <unset>   <unset>   ...`,
        hint: 'With zero endpoints the Service still exists and keeps its ClusterIP — but connections to it fail.',
      },
      {
        title: 'NodePort on kind',
        instructions:
          'Create a second Service of type NodePort. On kind, nodes are Docker containers, so the NodePort is opened **inside the node container**. On Linux the node IP (Docker bridge) is reachable from the host; on macOS/Windows it is not, and `kubectl port-forward` is the portable way in. (To publish NodePorts on localhost, kind needs `extraPortMappings` in a cluster config at creation time.)',
        commands: [
          'kubectl expose deployment web --name=web-np --type=NodePort --port=80',
          "NODE_PORT=$(kubectl get service web-np -o jsonpath='{.spec.ports[0].nodePort}'); echo $NODE_PORT",
          "NODE_IP=$(kubectl get node kcna-control-plane -o jsonpath='{.status.addresses[?(@.type==\"InternalIP\")].address}'); echo $NODE_IP",
          'curl -s --retry 5 --retry-connrefused http://$NODE_IP:$NODE_PORT | head -4   # Linux hosts only',
          'kubectl port-forward service/web 8080:80   # any OS; then in another terminal: curl -s localhost:8080 | head -4',
        ],
        expected: `3xxxx
172.18.0.2
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>`,
        hint: 'NodePorts are allocated from 30000–32767 by default. Stop port-forward with Ctrl+C.',
      },
    ],
    validation: [
      { description: 'Service web is ClusterIP', command: "kubectl get service web -o jsonpath='{.spec.type}'", expected: 'ClusterIP' },
      { description: 'Service web has 2 endpoints', command: "kubectl get endpointslices -l kubernetes.io/service-name=web -o jsonpath='{range .items[*].endpoints[*]}{.addresses[0]}{\"\\n\"}{end}'", expected: 'two Pod IPs, one per line' },
      { description: 'DNS resolves the Service', command: "kubectl run dns-check --rm -it --restart=Never --image=busybox:1.36 -- nslookup web.default.svc.cluster.local", expected: 'Address: 10.96.x.x (the ClusterIP)' },
    ],
    troubleshooting: [
      { symptom: 'nslookup prints "server can\'t find web.default.svc.cluster.local"', fix: 'Check CoreDNS is running: `kubectl get pods -n kube-system -l k8s-app=kube-dns`. Check the Service exists in `default` and you typed the namespace correctly.' },
      { symptom: 'wget: "Connection refused" or hangs', fix: 'Look at endpoints: if empty, the selector does not match (or Pods are not Ready); if present, check the `targetPort` matches the container port.' },
      { symptom: 'error: pod "dns-test" already exists', fix: 'A previous run was interrupted. `kubectl delete pod dns-test` and run again.' },
      { symptom: 'curl to NODE_IP:NODE_PORT times out on macOS/Windows', fix: 'Expected: the Docker network is inside a VM. Use `kubectl port-forward`, or recreate the cluster with `extraPortMappings`.' },
    ],
    cleanup: ['kubectl delete service web web-np', 'kubectl delete deployment web', DELETE_CLUSTER],
    references: [
      { title: 'Service', url: 'https://kubernetes.io/docs/concepts/services-networking/service/' },
      { title: 'DNS for Services and Pods', url: 'https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/' },
      KIND,
    ],
  },
  {
    id: 'lab-configmaps-secrets',
    title: 'ConfigMaps and Secrets as env vars and files',
    objectives: ['kf-core', 'co-security'],
    scope: 'kcna',
    status: 'full',
    environment: 'kind',
    estMinutes: 30,
    objective:
      'Externalize configuration: create a ConfigMap and a Secret, inject them into a Pod as environment variables and as mounted files, and observe which form picks up later changes.',
    prerequisites: [...KIND_PREREQS, 'Completed lab-pods-deployments'],
    architecture:
      'ConfigMaps and Secrets are namespaced API objects stored in etcd. The **kubelet** reads them when it starts a container: env vars are resolved **once at container start**; mounted volumes are files the kubelet keeps in sync (eventually) with the object.',
    tasks: [
      CLUSTER_TASK,
      {
        title: 'Create a ConfigMap and a Secret',
        instructions: 'Create both imperatively from literals and inspect them.',
        commands: [
          'kubectl create configmap app-config --from-literal=APP_COLOR=blue --from-literal=APP_MODE=demo',
          "kubectl create secret generic app-secret --from-literal=DB_PASSWORD='s3cr3t-pass'",
          'kubectl get configmap app-config -o yaml',
          'kubectl get secret app-secret -o yaml',
        ],
        expected: `data:
  APP_COLOR: blue
  APP_MODE: demo
...
data:
  DB_PASSWORD: czNjcjN0LXBhc3M=
type: Opaque`,
        hint: 'The Secret value is base64, not encrypted. Decode it with `base64 -d`.',
      },
      {
        title: 'Decode the Secret',
        instructions: 'Prove that anyone with `get secrets` permission can read the value.',
        commands: ["kubectl get secret app-secret -o jsonpath='{.data.DB_PASSWORD}' | base64 -d; echo"],
        expected: `s3cr3t-pass`,
      },
      {
        title: 'Consume them in a Pod',
        instructions:
          'Apply a Pod that loads every ConfigMap key with `envFrom`, a single Secret key with `secretKeyRef`, and also mounts the ConfigMap as files under `/etc/config`.',
        commands: [
          `kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: cfg-demo
spec:
  containers:
  - name: app
    image: busybox:1.36
    command: ["sh", "-c", "sleep 3600"]
    envFrom:
    - configMapRef:
        name: app-config
    env:
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: app-secret
          key: DB_PASSWORD
    volumeMounts:
    - name: config
      mountPath: /etc/config
      readOnly: true
  volumes:
  - name: config
    configMap:
      name: app-config
EOF`,
          'kubectl wait --for=condition=Ready pod/cfg-demo --timeout=60s',
        ],
        expected: `pod/cfg-demo created
pod/cfg-demo condition met`,
      },
      {
        title: 'Check what the container sees',
        instructions: 'Print the env vars and the mounted files.',
        commands: [
          "kubectl exec cfg-demo -- sh -c 'env | grep -E \"APP_|DB_\"'",
          'kubectl exec cfg-demo -- ls /etc/config',
          'kubectl exec cfg-demo -- cat /etc/config/APP_COLOR',
        ],
        expected: `APP_COLOR=blue
APP_MODE=demo
DB_PASSWORD=s3cr3t-pass
APP_COLOR
APP_MODE
blue`,
        hint: 'Each ConfigMap key becomes one file named after the key.',
      },
      {
        title: 'Change the ConfigMap',
        instructions:
          'Update `APP_COLOR` to `green` declaratively (generate YAML and pipe it to apply). After a short delay (typically under a minute or two) the **file** updates, but the **env var** keeps the old value until the container restarts.',
        commands: [
          'kubectl create configmap app-config --from-literal=APP_COLOR=green --from-literal=APP_MODE=demo --dry-run=client -o yaml | kubectl apply -f -',
          'kubectl exec cfg-demo -- cat /etc/config/APP_COLOR',
          'kubectl exec cfg-demo -- printenv APP_COLOR',
        ],
        expected: `configmap/app-config configured
green      # (file — may take a little while; re-run until it changes)
blue       # (env var — unchanged)`,
        hint: 'A `Warning: resource configmaps/app-config is missing the kubectl.kubernetes.io/last-applied-configuration annotation` is expected the first time you `apply` an object created with `create`.',
      },
    ],
    validation: [
      { description: 'Env var injected from ConfigMap', command: 'kubectl exec cfg-demo -- printenv APP_MODE', expected: 'demo' },
      { description: 'Secret injected as env var', command: 'kubectl exec cfg-demo -- printenv DB_PASSWORD', expected: 's3cr3t-pass' },
      { description: 'Mounted file reflects the update', command: 'kubectl exec cfg-demo -- cat /etc/config/APP_COLOR', expected: 'green' },
    ],
    troubleshooting: [
      { symptom: 'Pod shows CreateContainerConfigError', fix: 'A referenced ConfigMap/Secret or key does not exist in the Pod\'s namespace. `kubectl describe pod cfg-demo` names it; create it and the kubelet retries automatically.' },
      { symptom: 'The mounted file never changes', fix: 'Wait a bit longer (kubelet sync period plus cache TTL). Note that volumes mounted with `subPath` never receive updates.' },
      { symptom: 'error: no such key in the base64 output / garbled value', fix: 'Use the jsonpath `{.data.DB_PASSWORD}` exactly and pipe through `base64 -d`; `--from-literal` values with shell special characters need single quotes.' },
    ],
    cleanup: ['kubectl delete pod cfg-demo', 'kubectl delete configmap app-config', 'kubectl delete secret app-secret', DELETE_CLUSTER],
    references: [
      { title: 'ConfigMaps', url: 'https://kubernetes.io/docs/concepts/configuration/configmap/' },
      { title: 'Secrets', url: 'https://kubernetes.io/docs/concepts/configuration/secret/' },
    ],
  },
  {
    id: 'lab-rolling-update-rollback',
    title: 'Rolling updates, rollout history and rollback',
    objectives: ['cad-delivery', 'kf-core'],
    scope: 'kcna',
    status: 'full',
    environment: 'kind',
    estMinutes: 35,
    objective:
      'Ship a new image with zero downtime, record why each revision exists, push a broken release and see how the rolling update limits the damage, then roll back.',
    prerequisites: [...KIND_PREREQS, 'Completed lab-pods-deployments'],
    architecture:
      'Changing a Deployment\'s Pod template creates a **new ReplicaSet**. The Deployment controller scales the new one up and the old one down in steps bounded by `maxSurge` (extra Pods allowed) and `maxUnavailable` (Pods allowed to be missing). Old ReplicaSets are kept at 0 replicas as **revision history** — that is what makes `rollout undo` instant.',
    tasks: [
      CLUSTER_TASK,
      {
        title: 'Deploy version 1',
        instructions: 'Create a 4-replica Deployment and record a change cause.',
        commands: [
          'kubectl create deployment web --image=nginx:1.27 --replicas=4',
          'kubectl rollout status deployment/web',
          'kubectl annotate deployment web kubernetes.io/change-cause="initial release nginx:1.27"',
        ],
        expected: `deployment.apps/web created
deployment "web" successfully rolled out
deployment.apps/web annotated`,
        hint: '`kubectl create deployment` names the container after the image — here `nginx`. You need that name for `set image`.',
      },
      {
        title: 'Roll out version 2',
        instructions: 'Switch to the alpine variant, watch the rollout, and update the change cause.',
        commands: [
          'kubectl set image deployment/web nginx=nginx:1.27-alpine',
          'kubectl rollout status deployment/web',
          'kubectl annotate deployment web kubernetes.io/change-cause="switch to nginx:1.27-alpine" --overwrite',
          'kubectl get replicasets -l app=web',
        ],
        expected: `deployment.apps/web image updated
Waiting for deployment "web" rollout to finish: 2 out of 4 new replicas have been updated...
...
deployment "web" successfully rolled out
NAME             DESIRED   CURRENT   READY   AGE
web-<hash-1>     0         0         0       3m
web-<hash-2>     4         4         4       30s`,
        hint: 'The old ReplicaSet is scaled to 0, not deleted.',
      },
      {
        title: 'Read the history',
        instructions: 'List revisions and inspect the template of one of them.',
        commands: ['kubectl rollout history deployment/web', 'kubectl rollout history deployment/web --revision=1'],
        expected: `REVISION  CHANGE-CAUSE
1         initial release nginx:1.27
2         switch to nginx:1.27-alpine
...
    Image:	nginx:1.27`,
      },
      {
        title: 'Ship a broken release',
        instructions:
          'Deploy a tag that does not exist. `rollout status` with a timeout fails; the Pods show why. Notice that most old Pods keep running — `maxUnavailable` (25% of 4 = 1) caps how many can be taken down.',
        commands: [
          'kubectl set image deployment/web nginx=nginx:does-not-exist',
          'kubectl rollout status deployment/web --timeout=60s',
          'kubectl get pods -l app=web',
        ],
        expected: `error: timed out waiting for the condition
NAME               READY   STATUS             RESTARTS   AGE
web-<hash-2>-aaa   1/1     Running            0          4m
web-<hash-2>-bbb   1/1     Running            0          4m
web-<hash-2>-ccc   1/1     Running            0          4m
web-<hash-3>-xxx   0/1     ImagePullBackOff   0          60s
web-<hash-3>-yyy   0/1     ErrImagePull       0          60s`,
        hint: 'Without a timeout, `rollout status` waits until `progressDeadlineSeconds` (default 600s) marks the rollout as failed.',
      },
      {
        title: 'Roll back',
        instructions: 'Undo to the previous revision, then jump explicitly to revision 1.',
        commands: [
          'kubectl rollout undo deployment/web',
          'kubectl rollout status deployment/web',
          "kubectl get deployment web -o jsonpath='{.spec.template.spec.containers[0].image}'; echo",
          'kubectl rollout undo deployment/web --to-revision=1',
          'kubectl rollout status deployment/web',
          'kubectl rollout history deployment/web',
        ],
        expected: `deployment.apps/web rolled back
deployment "web" successfully rolled out
nginx:1.27-alpine
deployment.apps/web rolled back
...
REVISION  CHANGE-CAUSE
3         ...
4         switch to nginx:1.27-alpine
5         initial release nginx:1.27`,
        hint: 'A rollback re-uses an old template, which then gets a **new** revision number — the old number disappears from the list.',
      },
      {
        title: 'Tune the strategy',
        instructions: 'Make rollouts never drop below the desired count by setting `maxUnavailable: 0` and `maxSurge: 1`, then trigger a restart rollout.',
        commands: [
          'kubectl patch deployment web -p \'{"spec":{"strategy":{"rollingUpdate":{"maxSurge":1,"maxUnavailable":0}}}}\'',
          'kubectl rollout restart deployment/web',
          'kubectl rollout status deployment/web',
        ],
        expected: `deployment.apps/web patched
deployment.apps/web restarted
deployment "web" successfully rolled out`,
        hint: '`rollout restart` changes a template annotation (`kubectl.kubernetes.io/restartedAt`), forcing new Pods with the same image.',
      },
    ],
    validation: [
      { description: 'Deployment is back on a working image', command: "kubectl get deployment web -o jsonpath='{.spec.template.spec.containers[0].image}'", expected: 'nginx:1.27' },
      { description: 'All replicas ready', command: "kubectl get deployment web -o jsonpath='{.status.readyReplicas}'", expected: '4' },
      { description: 'Strategy tuned', command: "kubectl get deployment web -o jsonpath='{.spec.strategy.rollingUpdate.maxUnavailable}'", expected: '0' },
    ],
    troubleshooting: [
      { symptom: 'error: unable to find container named "web"', fix: 'The container is named after the image (`nginx`). Check with `kubectl get deployment web -o jsonpath=\'{.spec.template.spec.containers[*].name}\'`.' },
      { symptom: 'CHANGE-CAUSE shows <none>', fix: 'Annotate the Deployment with `kubernetes.io/change-cause` after each change (the old `--record` flag is deprecated).' },
      { symptom: 'rollout undo says "skipped rollback (current template already matches revision N)"', fix: 'You are already on that template. Check `kubectl rollout history` and pick a different `--to-revision`.' },
    ],
    cleanup: ['kubectl delete deployment web', DELETE_CLUSTER],
    references: [
      { title: 'Deployments — rolling back', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/' },
      { title: 'Performing a Rolling Update (tutorial)', url: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/update/update-intro/' },
    ],
  },
  {
    id: 'lab-troubleshoot-broken-workloads',
    title: 'Troubleshoot broken workloads',
    objectives: ['co-troubleshooting', 'cad-debugging'],
    scope: 'kcna',
    status: 'full',
    environment: 'kind',
    estMinutes: 40,
    objective:
      'Apply three intentionally broken workloads and diagnose each with the standard loop: `get` (what state?) → `describe` (which events?) → `logs` (what did the app say?) → fix the spec.',
    prerequisites: [...KIND_PREREQS, 'Completed lab-pods-deployments'],
    architecture:
      'Each failure stops at a different component: **ImagePullBackOff** — the kubelet/runtime cannot pull the image; **CrashLoopBackOff** — the container starts and its process exits; **Pending** — the scheduler finds no node that fits. Knowing which component is stuck tells you where to look.',
    tasks: [
      CLUSTER_TASK,
      {
        title: 'Apply the broken workloads',
        instructions: 'Create a namespace and apply all three manifests.',
        commands: [
          'kubectl create namespace broken',
          `kubectl apply -n broken -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bad-image
spec:
  replicas: 1
  selector:
    matchLabels:
      app: bad-image
  template:
    metadata:
      labels:
        app: bad-image
    spec:
      containers:
      - name: nginx
        image: nginx:1.27-doesnotexist
EOF`,
          `kubectl apply -n broken -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crasher
spec:
  replicas: 1
  selector:
    matchLabels:
      app: crasher
  template:
    metadata:
      labels:
        app: crasher
    spec:
      containers:
      - name: app
        image: busybox:1.36
        command: ["sh", "-c", "echo starting; test -n \\"$DB_HOST\\" || { echo 'FATAL: DB_HOST not set'; exit 1; }; echo connected to $DB_HOST; sleep 3600"]
EOF`,
          `kubectl apply -n broken -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: too-big
spec:
  containers:
  - name: app
    image: nginx:1.27
    resources:
      requests:
        cpu: "64"
        memory: 1Gi
EOF`,
          'kubectl get pods -n broken',
        ],
        expected: `NAME                         READY   STATUS             RESTARTS      AGE
bad-image-<hash>-xxxxx       0/1     ImagePullBackOff   0             45s
crasher-<hash>-yyyyy         0/1     CrashLoopBackOff   2 (20s ago)   45s
too-big                      0/1     Pending            0             45s`,
        hint: 'Statuses change over the first minute (ErrImagePull → ImagePullBackOff, Error → CrashLoopBackOff). Re-run `get pods` until they settle.',
      },
      {
        title: 'Diagnose ImagePullBackOff',
        instructions: 'Read the kubelet events for the bad-image Pod. Then fix the image tag on the Deployment.',
        commands: [
          'kubectl describe pod -n broken -l app=bad-image | tail -8',
          'kubectl set image deployment/bad-image -n broken nginx=nginx:1.27',
          'kubectl rollout status deployment/bad-image -n broken',
        ],
        expected: `Warning  Failed     ...  kubelet  Failed to pull image "nginx:1.27-doesnotexist": ... not found
Warning  Failed     ...  kubelet  Error: ErrImagePull
Normal   BackOff    ...  kubelet  Back-off pulling image "nginx:1.27-doesnotexist"
...
deployment "bad-image" successfully rolled out`,
        hint: '`not found` = wrong tag/name; `unauthorized` / `denied` = credentials (imagePullSecrets).',
      },
      {
        title: 'Diagnose CrashLoopBackOff',
        instructions:
          'Check the last termination state and the logs of the previous instance, then fix the Deployment by adding the missing env var. `--previous` only works once the container has crashed at least once, so first wait until RESTARTS is 1 or more (the first command does that for you).',
        commands: [
          "until [ \"$(kubectl get pods -n broken -l app=crasher -o jsonpath='{.items[0].status.containerStatuses[0].restartCount}')\" -ge 1 ] 2>/dev/null; do sleep 3; done; kubectl get pods -n broken -l app=crasher",
          'kubectl describe pod -n broken -l app=crasher | grep -A5 "Last State"',
          'kubectl logs -n broken deployment/crasher --previous',
          'kubectl set env deployment/crasher -n broken DB_HOST=db.example.internal',
          'kubectl rollout status deployment/crasher -n broken',
          'kubectl logs -n broken deployment/crasher',
        ],
        expected: `    Last State:     Terminated
      Reason:       Error
      Exit Code:    1
...
starting
FATAL: DB_HOST not set
...
deployment "crasher" successfully rolled out
starting
connected to db.example.internal`,
        hint: '`kubectl logs deployment/<name>` picks one of its Pods for you. `kubectl set env` changes the Pod template, so it triggers a normal rolling update.',
      },
      {
        title: 'Diagnose Pending',
        instructions:
          'The Pod requests 64 CPUs — more than the node has. Read the scheduler event, compare with the node\'s allocatable CPU, then recreate the Pod with a sane request (most Pod spec fields, including resources, cannot be edited in place).',
        commands: [
          'kubectl describe pod too-big -n broken | tail -4',
          "kubectl get node kcna-control-plane -o jsonpath='{.status.allocatable.cpu}'; echo",
          'kubectl delete pod too-big -n broken',
          `kubectl apply -n broken -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: too-big
spec:
  containers:
  - name: app
    image: nginx:1.27
    resources:
      requests:
        cpu: 100m
        memory: 64Mi
EOF`,
          'kubectl get pod too-big -n broken',
        ],
        expected: `Warning  FailedScheduling  ...  default-scheduler  0/1 nodes are available: 1 Insufficient cpu. preemption: 0/1 nodes are available: 1 No preemption victims found for incoming pod.
8
pod "too-big" deleted
pod/too-big created
NAME      READY   STATUS    RESTARTS   AGE
too-big   1/1     Running   0          5s`,
        hint: 'Your allocatable CPU equals the number of CPUs Docker gives the kind node, so the number will differ.',
      },
      {
        title: 'Use events as a timeline',
        instructions: 'List everything that happened in the namespace, oldest first.',
        commands: ['kubectl get events -n broken --sort-by=.metadata.creationTimestamp'],
        expected: `LAST SEEN   TYPE      REASON             OBJECT                      MESSAGE
...         Warning   FailedScheduling   pod/too-big                 0/1 nodes are available: 1 Insufficient cpu...
...         Warning   Failed             pod/bad-image-...           Failed to pull image "nginx:1.27-doesnotexist"...
...         Warning   BackOff            pod/crasher-...             Back-off restarting failed container app ...`,
        hint: 'Events are kept for a limited time (1 hour by default) — capture them early when investigating.',
      },
    ],
    validation: [
      { description: 'All workloads healthy', command: 'kubectl get pods -n broken', expected: 'every Pod 1/1 Running' },
      { description: 'bad-image uses a real tag', command: "kubectl get deployment bad-image -n broken -o jsonpath='{.spec.template.spec.containers[0].image}'", expected: 'nginx:1.27' },
      { description: 'crasher has DB_HOST set', command: "kubectl get deployment crasher -n broken -o jsonpath='{.spec.template.spec.containers[0].env[0].name}'", expected: 'DB_HOST' },
    ],
    troubleshooting: [
      { symptom: 'too-big is Running right away', fix: 'Your Docker host exposes 64+ CPUs to the node. Raise the request (e.g. `cpu: "512"`) to force the Pending state.' },
      { symptom: 'kubectl logs --previous: "previous terminated container not found"', fix: 'The container has not restarted yet. Wait for `RESTARTS` ≥ 1 and try again.' },
      { symptom: 'The Pod "too-big" is invalid: spec: Forbidden: pod updates may not change fields other than ...', fix: 'Pod resources are (mostly) immutable. Delete and recreate the Pod — or better, run it from a Deployment so you can change the template.' },
    ],
    cleanup: ['kubectl delete namespace broken', DELETE_CLUSTER],
    references: [
      { title: 'Debug Pods', url: 'https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/' },
      { title: 'Debug Running Pods', url: 'https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/' },
      KUBECTL,
    ],
  },

  // ──────────────────────────── DESIGN LABS ────────────────────────────
  {
    id: 'lab-storage-pvc',
    title: 'Persistent storage with PVCs on kind',
    objectives: ['co-storage'],
    scope: 'kcna',
    status: 'design',
    environment: 'kind',
    estMinutes: 30,
    objective:
      'Use kind\'s built-in local-path provisioner to dynamically provision a volume through a PVC, write data, delete the Pod, and prove the data survives.',
    prerequisites: [...KIND_PREREQS, 'Completed lab-pods-deployments'],
    architecture:
      'kind ships a default StorageClass `standard` backed by `rancher.io/local-path`, with `volumeBindingMode: WaitForFirstConsumer` — the PV is created only when a Pod using the claim is scheduled. Data lives in a directory on the node container.',
    tasks: [
      CLUSTER_TASK,
      {
        title: 'Inspect the StorageClass',
        instructions: 'Find the default class, its provisioner and binding mode.',
        commands: ['kubectl get storageclass', 'kubectl get pods -n local-path-storage'],
        expected: `NAME                 PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ...
standard (default)   rancher.io/local-path   Delete          WaitForFirstConsumer   ...`,
      },
      {
        title: 'Create a claim',
        instructions: 'Create a 1Gi RWO claim. It stays `Pending` until a Pod uses it — that is expected here.',
        commands: [
          `kubectl apply -f - <<'EOF'
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 1Gi
EOF`,
          'kubectl get pvc data',
          'kubectl describe pvc data | tail -2',
        ],
        expected: `data   Pending   ...   standard
... WaitForFirstConsumer  waiting for first consumer to be created before binding`,
      },
      {
        title: 'Mount it and write data',
        instructions: 'Run a Pod that mounts the claim; the PV is provisioned and bound.',
        commands: [
          `kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: writer
spec:
  containers:
  - name: app
    image: busybox:1.36
    command: ["sh", "-c", "date >> /data/log.txt; sleep 3600"]
    volumeMounts:
    - name: data
      mountPath: /data
  volumes:
  - name: data
    persistentVolumeClaim:
      claimName: data
EOF`,
          'kubectl wait --for=condition=Ready pod/writer --timeout=90s',
          'kubectl get pvc,pv',
        ],
        expected: `persistentvolumeclaim/data   Bound   pvc-...   1Gi   RWO   standard
persistentvolume/pvc-...     1Gi     RWO   Delete   Bound   default/data   standard`,
      },
      {
        title: 'Prove persistence',
        instructions: 'Delete the Pod, recreate it with the same manifest (re-run the previous apply), and read the file — it now has two lines.',
        commands: ['kubectl delete pod writer', 'kubectl exec writer -- cat /data/log.txt   # after re-applying the writer Pod'],
        expected: `Thu Nov 12 10:00:01 UTC 2026
Thu Nov 12 10:02:37 UTC 2026`,
      },
    ],
    validation: [
      { description: 'Claim is bound', command: "kubectl get pvc data -o jsonpath='{.status.phase}'", expected: 'Bound' },
      { description: 'Data survived Pod recreation', command: 'kubectl exec writer -- wc -l /data/log.txt', expected: '2 /data/log.txt' },
    ],
    troubleshooting: [
      { symptom: 'PVC Pending even after the Pod exists', fix: '`kubectl describe pvc data` and check the local-path-provisioner Pod logs in `local-path-storage`.' },
      { symptom: 'Deleting the PVC also deleted the data', fix: 'Expected with `reclaimPolicy: Delete`. Use a class with `Retain` for data you must keep.' },
    ],
    cleanup: ['kubectl delete pod writer', 'kubectl delete pvc data', DELETE_CLUSTER],
    references: [
      { title: 'Persistent Volumes', url: 'https://kubernetes.io/docs/concepts/storage/persistent-volumes/' },
      { title: 'Storage Classes', url: 'https://kubernetes.io/docs/concepts/storage/storage-classes/' },
    ],
  },
  {
    id: 'lab-rbac-serviceaccounts',
    title: 'RBAC and ServiceAccounts with kubectl auth can-i',
    objectives: ['co-security'],
    scope: 'kcna',
    status: 'design',
    environment: 'kind',
    estMinutes: 25,
    objective:
      'Create a ServiceAccount with least-privilege read access to Deployments in one namespace, and verify permissions with `kubectl auth can-i` and impersonation.',
    prerequisites: [...KIND_PREREQS],
    architecture:
      'Subjects (users, groups, ServiceAccounts) get permissions only through bindings. **Role/RoleBinding** are namespaced; **ClusterRole/ClusterRoleBinding** are cluster-wide. RBAC is additive — there are no deny rules.',
    tasks: [
      CLUSTER_TASK,
      {
        title: 'Create the identity and the role',
        instructions: 'Namespace, ServiceAccount, read-only Role for Deployments, and a RoleBinding.',
        commands: [
          'kubectl create namespace dev',
          'kubectl create serviceaccount ci -n dev',
          'kubectl create role deploy-reader --verb=get,list,watch --resource=deployments -n dev',
          'kubectl create rolebinding ci-deploy-reader --role=deploy-reader --serviceaccount=dev:ci -n dev',
        ],
      },
      {
        title: 'Check permissions',
        instructions: 'Impersonate the ServiceAccount and ask the API server what it may do.',
        commands: [
          'kubectl auth can-i list deployments -n dev --as=system:serviceaccount:dev:ci',
          'kubectl auth can-i delete deployments -n dev --as=system:serviceaccount:dev:ci',
          'kubectl auth can-i list deployments -n default --as=system:serviceaccount:dev:ci',
          'kubectl auth can-i --list -n dev --as=system:serviceaccount:dev:ci',
        ],
        expected: `yes
no
no`,
        hint: 'You can impersonate because the kind admin user is cluster-admin.',
      },
      {
        title: 'Reuse a ClusterRole in one namespace',
        instructions: 'Bind the built-in `view` ClusterRole with a RoleBinding — the rules apply only inside `dev`.',
        commands: [
          'kubectl create rolebinding ci-view --clusterrole=view --serviceaccount=dev:ci -n dev',
          'kubectl auth can-i list pods -n dev --as=system:serviceaccount:dev:ci',
          'kubectl auth can-i list pods -n kube-system --as=system:serviceaccount:dev:ci',
        ],
        expected: `yes
no`,
      },
    ],
    validation: [
      { description: 'SA can read Deployments in dev', command: 'kubectl auth can-i get deployments -n dev --as=system:serviceaccount:dev:ci', expected: 'yes' },
      { description: 'SA cannot delete', command: 'kubectl auth can-i delete deployments -n dev --as=system:serviceaccount:dev:ci', expected: 'no' },
    ],
    troubleshooting: [
      { symptom: 'can-i says "no" although you created the binding', fix: 'Check the namespace of the RoleBinding and the exact subject string `system:serviceaccount:<ns>:<name>`.' },
    ],
    cleanup: ['kubectl delete namespace dev', DELETE_CLUSTER],
    references: [
      { title: 'Using RBAC Authorization', url: 'https://kubernetes.io/docs/reference/access-authn-authz/rbac/' },
      { title: 'RBAC good practices', url: 'https://kubernetes.io/docs/concepts/security/rbac-good-practices/' },
    ],
  },
  {
    id: 'lab-network-policies',
    title: 'NetworkPolicies: default deny and allow-lists',
    objectives: ['co-networking', 'co-security'],
    scope: 'kcna',
    status: 'design',
    environment: 'kind',
    estMinutes: 35,
    objective:
      'Show that Pod-to-Pod traffic is open by default, apply a default-deny ingress policy, then allow only labelled clients.',
    prerequisites: [...KIND_PREREQS, 'Completed lab-services-dns'],
    architecture:
      'NetworkPolicies are enforced by the **CNI plugin**, not by the API server. Recent kind releases ship kindnet with NetworkPolicy support — **verify** with the default-deny test below. If traffic is not blocked, recreate the cluster with `networking.disableDefaultCNI: true` in a kind config and install a policy-capable CNI such as Calico or Cilium following its kind guide.',
    tasks: [
      CLUSTER_TASK,
      {
        title: 'Baseline: everything can talk',
        instructions: 'Deploy a server and confirm an unlabelled client can reach it.',
        commands: [
          'kubectl create deployment web --image=nginx:1.27',
          'kubectl expose deployment web --port=80',
          'kubectl rollout status deployment/web',
          "kubectl run client --rm -it --restart=Never --image=busybox:1.36 -- wget -qO- -T 3 http://web | head -4",
        ],
        expected: `<title>Welcome to nginx!</title>`,
      },
      {
        title: 'Default deny ingress',
        instructions: 'Select all Pods in the namespace for Ingress with no allow rules.',
        commands: [
          `kubectl apply -f - <<'EOF'
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
spec:
  podSelector: {}
  policyTypes:
  - Ingress
EOF`,
          "kubectl run client --rm -it --restart=Never --image=busybox:1.36 -- wget -qO- -T 3 http://web",
        ],
        expected: `wget: download timed out`,
        hint: 'If the page still loads, your CNI is not enforcing policies — see the architecture note.',
      },
      {
        title: 'Allow labelled clients',
        instructions: 'Allow ingress to `app=web` only from Pods labelled `access=web`.',
        commands: [
          `kubectl apply -f - <<'EOF'
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: web-allow-clients
spec:
  podSelector:
    matchLabels:
      app: web
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          access: web
    ports:
    - protocol: TCP
      port: 80
EOF`,
          "kubectl run client --rm -it --restart=Never --labels=access=web --image=busybox:1.36 -- wget -qO- -T 3 http://web | head -4",
        ],
        expected: `<title>Welcome to nginx!</title>`,
      },
    ],
    validation: [
      { description: 'Unlabelled client is blocked', command: 'kubectl run v1 --rm -it --restart=Never --image=busybox:1.36 -- wget -qO- -T 3 http://web', expected: 'download timed out' },
      { description: 'Labelled client is allowed', command: 'kubectl run v2 --rm -it --restart=Never --labels=access=web --image=busybox:1.36 -- wget -qO- -T 3 http://web', expected: 'nginx welcome page HTML' },
    ],
    troubleshooting: [
      { symptom: 'Policies have no effect', fix: 'The CNI does not enforce NetworkPolicy. Upgrade kind or use Calico/Cilium with `disableDefaultCNI: true`.' },
      { symptom: 'DNS lookups fail after adding egress policies', fix: 'An egress default-deny also blocks DNS. Allow UDP/TCP 53 to the CoreDNS Pods in `kube-system`.' },
    ],
    cleanup: ['kubectl delete networkpolicy default-deny-ingress web-allow-clients', 'kubectl delete service,deployment web', DELETE_CLUSTER],
    references: [
      { title: 'Network Policies', url: 'https://kubernetes.io/docs/concepts/services-networking/network-policies/' },
      KIND,
    ],
  },
  {
    id: 'lab-helm-basics',
    title: 'Helm: install, upgrade, rollback',
    objectives: ['cad-delivery'],
    scope: 'kcna',
    status: 'design',
    environment: 'kind',
    estMinutes: 30,
    objective:
      'Package an app as a Helm chart, install it as a release, upgrade it with new values, and roll back — without needing any external chart repository.',
    prerequisites: [...KIND_PREREQS, 'Helm v3 installed (https://helm.sh/docs/intro/install/)'],
    architecture:
      'A **chart** is a package of templates plus `values.yaml`. Installing it creates a **release**; every install/upgrade/rollback creates a new **revision**, stored as a Secret in the release namespace. Helm renders templates client-side and sends plain manifests to the API server.',
    tasks: [
      CLUSTER_TASK,
      {
        title: 'Scaffold and render a chart',
        instructions: '`helm create` generates a working nginx chart. Render it locally to see the YAML it produces.',
        commands: ['helm create demo', 'helm template demo ./demo | head -40', 'helm lint ./demo'],
        expected: `==> Linting ./demo
1 chart(s) linted, 0 chart(s) failed`,
      },
      {
        title: 'Install and upgrade',
        instructions: 'Install, then upgrade to 3 replicas via `--set`.',
        commands: [
          'helm install demo ./demo',
          'kubectl get deployment demo',
          'helm upgrade demo ./demo --set replicaCount=3',
          'helm history demo',
        ],
        expected: `REVISION  UPDATED  STATUS      CHART        APP VERSION  DESCRIPTION
1         ...      superseded  demo-0.1.0   1.16.0       Install complete
2         ...      deployed    demo-0.1.0   1.16.0       Upgrade complete`,
      },
      {
        title: 'Roll back',
        instructions: 'Return to revision 1 and confirm replicas.',
        commands: ['helm rollback demo 1', 'helm history demo', 'kubectl get deployment demo'],
        expected: `Rollback was a success! Happy Helming!
...
3         ...      deployed    demo-0.1.0   1.16.0       Rollback to 1`,
      },
    ],
    validation: [
      { description: 'Release deployed', command: 'helm status demo', expected: 'STATUS: deployed' },
      { description: 'Back at 1 replica', command: "kubectl get deployment demo -o jsonpath='{.spec.replicas}'", expected: '1' },
    ],
    troubleshooting: [
      { symptom: 'Error: INSTALLATION FAILED: cannot re-use a name that is still in use', fix: 'A release `demo` already exists. Use `helm upgrade --install demo ./demo` or uninstall it first.' },
    ],
    cleanup: ['helm uninstall demo', 'rm -rf demo', DELETE_CLUSTER],
    references: [
      { title: 'Helm docs', url: 'https://helm.sh/docs/' },
      { title: 'Helm quickstart', url: 'https://helm.sh/docs/intro/quickstart/' },
    ],
  },
  {
    id: 'lab-jobs-cronjobs',
    title: 'Jobs and CronJobs',
    objectives: ['kf-core'],
    scope: 'kcna',
    status: 'design',
    environment: 'kind',
    estMinutes: 25,
    objective: 'Run finite work to completion with a Job, schedule recurring work with a CronJob, and trigger a CronJob manually.',
    prerequisites: [...KIND_PREREQS],
    architecture:
      'A **Job** creates Pods until the requested number of completions succeed, retrying failures up to `backoffLimit` (default 6). A **CronJob** creates a Job on each schedule tick. Job Pods use `restartPolicy: OnFailure` or `Never` — never `Always`.',
    tasks: [
      CLUSTER_TASK,
      {
        title: 'Run a Job',
        instructions: 'Create a Job, wait for completion and read its output.',
        commands: [
          "kubectl create job hello --image=busybox:1.36 -- sh -c 'echo working; sleep 5; echo done'",
          'kubectl wait --for=condition=complete job/hello --timeout=90s',
          'kubectl get job hello',
          'kubectl logs job/hello',
        ],
        expected: `NAME    STATUS     COMPLETIONS   DURATION   AGE
hello   Complete   1/1           8s         15s
working
done`,
      },
      {
        title: 'Schedule a CronJob',
        instructions: 'Run every minute; watch Jobs appear. Then trigger one immediately from the CronJob template.',
        commands: [
          "kubectl create cronjob tick --image=busybox:1.36 --schedule='*/1 * * * *' -- date",
          'kubectl get cronjob tick',
          'kubectl get jobs -w',
          'kubectl create job tick-manual --from=cronjob/tick',
        ],
        expected: `NAME   SCHEDULE      TIMEZONE   SUSPEND   ACTIVE   LAST SCHEDULE   AGE
tick   */1 * * * *   <none>     False     0        <none>          5s`,
        hint: 'By default only the last 3 successful and 1 failed Jobs are kept (`successfulJobsHistoryLimit` / `failedJobsHistoryLimit`).',
      },
    ],
    validation: [
      { description: 'Job completed', command: "kubectl get job hello -o jsonpath='{.status.succeeded}'", expected: '1' },
      { description: 'CronJob has run', command: "kubectl get cronjob tick -o jsonpath='{.status.lastScheduleTime}'", expected: 'a timestamp' },
    ],
    troubleshooting: [
      { symptom: 'Job never completes and keeps creating Pods', fix: 'The command exits non-zero. Check `kubectl logs` of a failed Pod; the Job gives up after `backoffLimit` retries.' },
    ],
    cleanup: ['kubectl delete cronjob tick', 'kubectl delete job hello tick-manual', DELETE_CLUSTER],
    references: [
      { title: 'Jobs', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/job/' },
      { title: 'CronJob', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/' },
    ],
  },
  {
    id: 'lab-probes-resources-qos',
    title: 'Probes, resource requests/limits and QoS classes',
    objectives: ['kf-scheduling', 'co-troubleshooting'],
    scope: 'kcna',
    status: 'design',
    environment: 'kind',
    estMinutes: 35,
    objective:
      'Watch a liveness probe restart a container, see a readiness probe remove a Pod from a Service, and observe how requests/limits decide a Pod\'s QoS class.',
    prerequisites: [...KIND_PREREQS, 'Completed lab-services-dns'],
    architecture:
      'The **kubelet** runs probes. Liveness failure → container restart; readiness failure → removed from endpoints; startup probe → delays the others. QoS: **Guaranteed** (requests = limits for CPU and memory in every container), **Burstable** (some requests/limits), **BestEffort** (none) — BestEffort Pods are evicted first under node pressure.',
    tasks: [
      CLUSTER_TASK,
      {
        title: 'Liveness probe restarts',
        instructions: 'The container deletes its health file after 30s; the exec probe starts failing and the kubelet restarts it.',
        commands: [
          `kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: liveness-demo
spec:
  containers:
  - name: app
    image: busybox:1.36
    command: ["sh", "-c", "touch /tmp/healthy; sleep 30; rm -f /tmp/healthy; sleep 600"]
    livenessProbe:
      exec:
        command: ["cat", "/tmp/healthy"]
      initialDelaySeconds: 5
      periodSeconds: 5
EOF`,
          'kubectl get pod liveness-demo -w',
          'kubectl describe pod liveness-demo | grep -E "Unhealthy|Killing"',
        ],
        expected: `liveness-demo   1/1   Running   1 (2s ago)   75s
... Liveness probe failed: cat: can't open '/tmp/healthy': No such file or directory
... Container app failed liveness probe, will be restarted`,
      },
      {
        title: 'QoS classes',
        instructions: 'Create three Pods with different resource settings and read their QoS class.',
        commands: [
          'kubectl run besteffort --image=nginx:1.27',
          `kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: guaranteed
spec:
  containers:
  - name: app
    image: nginx:1.27
    resources:
      requests: {cpu: 100m, memory: 64Mi}
      limits: {cpu: 100m, memory: 64Mi}
EOF`,
          `kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: burstable
spec:
  containers:
  - name: app
    image: nginx:1.27
    resources:
      requests: {cpu: 50m, memory: 32Mi}
      limits: {memory: 128Mi}
EOF`,
          "kubectl get pods besteffort guaranteed burstable -o custom-columns=NAME:.metadata.name,QOS:.status.qosClass",
        ],
        expected: `NAME         QOS
besteffort   BestEffort
guaranteed   Guaranteed
burstable    Burstable`,
      },
    ],
    validation: [
      { description: 'Liveness Pod has restarted', command: "kubectl get pod liveness-demo -o jsonpath='{.status.containerStatuses[0].restartCount}'", expected: '>= 1' },
      { description: 'Guaranteed QoS assigned', command: "kubectl get pod guaranteed -o jsonpath='{.status.qosClass}'", expected: 'Guaranteed' },
    ],
    troubleshooting: [
      { symptom: 'Restarts never happen', fix: 'Wait at least 30s + 3 failed probes (failureThreshold 3 × periodSeconds 5).' },
    ],
    cleanup: ['kubectl delete pod liveness-demo besteffort guaranteed burstable', DELETE_CLUSTER],
    references: [
      { title: 'Configure Liveness, Readiness and Startup Probes', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/' },
      { title: 'Pod Quality of Service Classes', url: 'https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/' },
    ],
  },
  {
    id: 'lab-hpa-metrics-server',
    title: 'Horizontal Pod Autoscaling with metrics-server',
    objectives: ['cna-ecosystem', 'kf-scheduling'],
    scope: 'kcna',
    status: 'design',
    environment: 'kind',
    estMinutes: 35,
    objective: 'Install metrics-server, create an HPA targeting CPU utilization, generate load and watch replicas scale out and back in.',
    prerequisites: [...KIND_PREREQS, 'Completed lab-services-dns'],
    architecture:
      'metrics-server scrapes kubelet resource metrics and serves the `metrics.k8s.io` API (used by `kubectl top` and the HPA). The HPA controller compares observed CPU usage to **requests** and adjusts `replicas`. kind kubelets use self-signed serving certs, so metrics-server needs `--kubelet-insecure-tls` (lab only).',
    tasks: [
      CLUSTER_TASK,
      {
        title: 'Install metrics-server',
        instructions: 'Apply the release manifest and add the insecure-TLS flag for kind.',
        commands: [
          'kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml',
          'kubectl patch deployment metrics-server -n kube-system --type=json -p \'[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]\'',
          'kubectl rollout status deployment/metrics-server -n kube-system',
          'kubectl top nodes',
        ],
        expected: `NAME                 CPU(cores)   CPU(%)   MEMORY(bytes)   MEMORY(%)
kcna-control-plane   150m         1%       700Mi           9%`,
        hint: '`kubectl top` may say "metrics not available yet" for the first minute.',
      },
      {
        title: 'Deploy and autoscale',
        instructions: 'Create a Deployment with a small CPU request and an `autoscaling/v2` HPA targeting 50% CPU.',
        commands: [
          'kubectl create deployment web --image=nginx:1.27',
          'kubectl set resources deployment web --requests=cpu=50m',
          'kubectl expose deployment web --port=80',
          `kubectl apply -f - <<'EOF'
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web
  minReplicas: 1
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50
EOF`,
          'kubectl get hpa web',
        ],
      },
      {
        title: 'Generate load',
        instructions: 'Run a busy client and watch the HPA. Delete the client and watch it scale down (after the default 5-minute stabilization window).',
        commands: [
          "kubectl run load --image=busybox:1.36 --restart=Never -- sh -c 'while true; do wget -q -O- http://web >/dev/null; done'",
          'kubectl get hpa web -w',
          'kubectl delete pod load',
        ],
        expected: `NAME   REFERENCE        TARGETS         MINPODS   MAXPODS   REPLICAS
web    Deployment/web   cpu: 180%/50%   1         5         4`,
      },
    ],
    validation: [
      { description: 'HPA scaled out under load', command: "kubectl get hpa web -o jsonpath='{.status.currentReplicas}'", expected: '> 1 while load runs' },
    ],
    troubleshooting: [
      { symptom: 'TARGETS shows <unknown>/50%', fix: 'metrics-server is not ready, or the Deployment has no CPU **request** — utilization is a percentage of the request.' },
    ],
    cleanup: ['kubectl delete hpa web', 'kubectl delete service,deployment web', 'kubectl delete pod load --ignore-not-found', DELETE_CLUSTER],
    references: [
      { title: 'Horizontal Pod Autoscaling', url: 'https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/' },
      { title: 'HPA walkthrough', url: 'https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale-walkthrough/' },
    ],
  },
  {
    id: 'lab-prometheus-stack',
    title: 'Monitoring with kube-prometheus-stack',
    objectives: ['cna-observability'],
    scope: 'beyond',
    status: 'design',
    environment: 'kind',
    estMinutes: 45,
    objective:
      'Install Prometheus, Alertmanager and Grafana with the community Helm chart, run a few PromQL queries and open a prebuilt dashboard. KCNA only expects you to understand the concepts (pull model, exporters, PromQL, Alertmanager) — operating the stack is beyond the exam.',
    prerequisites: [...KIND_PREREQS, 'Helm v3 installed', 'At least 4 GB RAM available to Docker'],
    architecture:
      'The chart installs the **Prometheus Operator**, which manages Prometheus and Alertmanager via CRDs (`ServiceMonitor`, `PrometheusRule`), plus **node-exporter** (DaemonSet), **kube-state-metrics** and **Grafana**. Prometheus **pulls** (scrapes) `/metrics` endpoints on an interval.',
    tasks: [
      CLUSTER_TASK,
      {
        title: 'Install the chart',
        instructions: 'Add the repository and install into a `monitoring` namespace.',
        commands: [
          'helm repo add prometheus-community https://prometheus-community.github.io/helm-charts',
          'helm repo update',
          'helm install kps prometheus-community/kube-prometheus-stack -n monitoring --create-namespace',
          'kubectl get pods -n monitoring',
          'kubectl get svc -n monitoring',
        ],
        hint: 'Service names are derived from the release name; read them from `kubectl get svc -n monitoring` before port-forwarding.',
      },
      {
        title: 'Query Prometheus',
        instructions: 'Port-forward to the Prometheus Service, open http://localhost:9090 and try `up`, then `sum by (namespace) (kube_pod_info)`.',
        commands: ['kubectl port-forward -n monitoring svc/kps-kube-prometheus-stack-prometheus 9090:9090'],
      },
      {
        title: 'Open Grafana',
        instructions: 'Read the generated admin password, port-forward and browse the "Kubernetes / Compute Resources" dashboards.',
        commands: [
          "kubectl get secret kps-grafana -n monitoring -o jsonpath='{.data.admin-password}' | base64 -d; echo",
          'kubectl port-forward -n monitoring svc/kps-grafana 3000:80',
        ],
      },
    ],
    validation: [
      { description: 'Prometheus Pod running', command: 'kubectl get pods -n monitoring -l app.kubernetes.io/name=prometheus', expected: '2/2 Running' },
    ],
    troubleshooting: [
      { symptom: 'Pods Pending or OOMKilled', fix: 'Give Docker more memory; the full stack needs a few GB.' },
      { symptom: 'Some control-plane targets are down (etcd, scheduler, controller-manager)', fix: 'Expected on kind: those components bind to localhost on the node. Ignore for this lab.' },
    ],
    cleanup: ['helm uninstall kps -n monitoring', 'kubectl delete namespace monitoring', DELETE_CLUSTER],
    references: [
      { title: 'Prometheus overview', url: 'https://prometheus.io/docs/introduction/overview/' },
      { title: 'Helm docs', url: 'https://helm.sh/docs/' },
    ],
  },
  {
    id: 'lab-gitops-argocd',
    title: 'GitOps with Argo CD on kind',
    objectives: ['cad-delivery'],
    scope: 'beyond',
    status: 'design',
    environment: 'kind',
    estMinutes: 45,
    objective:
      'Install Argo CD, point an Application at a public Git repository, and watch the controller sync and self-heal. KCNA asks for GitOps principles and tool recognition; running Argo CD is beyond the exam.',
    prerequisites: [...KIND_PREREQS],
    architecture:
      'Argo CD runs **inside** the cluster and **pulls** desired state from Git. An `Application` CR maps a repo path to a destination namespace. With automated sync + self-heal, manual drift in the cluster is reverted to what Git says.',
    tasks: [
      CLUSTER_TASK,
      {
        title: 'Install Argo CD',
        instructions: 'Apply the upstream install manifest and wait for the server.',
        commands: [
          'kubectl create namespace argocd',
          'kubectl apply -n argocd --server-side -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml',
          'kubectl rollout status deployment/argocd-server -n argocd',
          "kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath='{.data.password}' | base64 -d; echo",
          'kubectl port-forward svc/argocd-server -n argocd 8080:443',
        ],
        hint: 'Log in at https://localhost:8080 as `admin` (accept the self-signed certificate).',
      },
      {
        title: 'Create an Application',
        instructions: 'Sync the public guestbook example with automated sync and self-heal.',
        commands: [
          `kubectl apply -f - <<'EOF'
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: guestbook
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: HEAD
    path: guestbook
  destination:
    server: https://kubernetes.default.svc
    namespace: guestbook
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
EOF`,
          'kubectl get applications -n argocd',
        ],
        expected: `NAME        SYNC STATUS   HEALTH STATUS
guestbook   Synced        Healthy`,
      },
      {
        title: 'Watch self-heal',
        instructions: 'Scale the Deployment by hand; Argo CD reverts it to the replica count in Git.',
        commands: ['kubectl scale deployment guestbook-ui -n guestbook --replicas=3', 'kubectl get deployment guestbook-ui -n guestbook -w'],
      },
    ],
    validation: [
      { description: 'Application synced', command: "kubectl get application guestbook -n argocd -o jsonpath='{.status.sync.status}'", expected: 'Synced' },
    ],
    troubleshooting: [
      { symptom: 'CRD apply error "metadata.annotations: Too long"', fix: 'Use server-side apply (`--server-side`) as shown; client-side apply stores the whole object in an annotation.' },
    ],
    cleanup: ['kubectl delete application guestbook -n argocd', 'kubectl delete namespace argocd guestbook', DELETE_CLUSTER],
    references: [
      { title: 'Argo CD documentation', url: 'https://argo-cd.readthedocs.io/' },
      { title: 'OpenGitOps / CNCF projects', url: 'https://www.cncf.io/projects/' },
    ],
  },
];
