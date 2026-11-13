import type { TroubleshootingScenario } from '../types';

const K8S_DEBUG_PODS = { title: 'Debug Pods (Kubernetes docs)', url: 'https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/' };
const K8S_DEBUG = { title: 'Monitoring, Logging, and Debugging (Kubernetes docs)', url: 'https://kubernetes.io/docs/tasks/debug/' };

export const troubleshootingScenarios: TroubleshootingScenario[] = [
  {
    id: 'ts-crashloopbackoff',
    title: 'The worker that keeps dying',
    objective: 'co-troubleshooting',
    lessonId: 'troubleshooting-workloads',
    difficulty: 1,
    symptom:
      'A new `report-worker` Deployment was rolled out 15 minutes ago. Its Pod never becomes ready and the restart counter keeps climbing.',
    evidence: [
      {
        command: 'kubectl get pods -l app=report-worker',
        output: `NAME                             READY   STATUS             RESTARTS      AGE
report-worker-7c6d9b8f5d-qk2pl   0/1     CrashLoopBackOff   7 (2m ago)    15m`,
      },
    ],
    stages: [
      {
        phase: 'hypothesis',
        question: 'What does `CrashLoopBackOff` tell you about where the problem is?',
        options: [
          { text: 'The container starts, then its process exits; the kubelet is backing off between restarts.', correct: true, feedback: 'Right. The image was pulled and the Pod was scheduled — the failure is in what happens after the process starts.' },
          { text: 'The scheduler cannot find a node for the Pod.', correct: false, feedback: 'A scheduling failure shows `Pending` with a `FailedScheduling` event; this Pod has already restarted 7 times on a node.' },
          { text: 'The node cannot download the container image.', correct: false, feedback: 'That would be `ErrImagePull` / `ImagePullBackOff`. A container must have an image before it can crash.' },
        ],
      },
      {
        phase: 'investigation',
        question: 'Which command is most likely to show the actual error message from the crashed process?',
        options: [
          { text: 'kubectl logs report-worker-7c6d9b8f5d-qk2pl --previous', correct: true, feedback: 'Yes. `--previous` returns output from the last terminated instance, which is where the crash message lives.' },
          { text: 'kubectl get nodes', correct: false, feedback: 'Node health is not the issue — the Pod is running on a node and restarting there.' },
          { text: 'kubectl get svc', correct: false, feedback: 'Services route traffic to Pods; they cannot make a container exit.' },
        ],
        reveal: {
          command: 'kubectl logs report-worker-7c6d9b8f5d-qk2pl --previous',
          output: `2026-11-12T09:14:03Z INFO  starting report-worker v3.2.0
2026-11-12T09:14:03Z ERROR open /etc/report/templates.yaml: no such file or directory
2026-11-12T09:14:03Z FATAL cannot load templates, exiting`,
        },
      },
      {
        phase: 'evidence',
        question: 'The log says `/etc/report/templates.yaml` does not exist. What is the most useful next piece of evidence?',
        options: [
          { text: 'The Pod spec\'s volumes and volumeMounts (e.g. kubectl describe pod or get deploy -o yaml).', correct: true, feedback: 'Correct. A missing config file inside a container usually means a volume was not mounted, or mounted at a different path.' },
          { text: 'The node\'s CPU usage via kubectl top nodes.', correct: false, feedback: 'Resource pressure does not delete files from a container\'s filesystem.' },
          { text: 'The cluster\'s CoreDNS logs.', correct: false, feedback: 'DNS is not involved in reading a local file path.' },
        ],
        reveal: {
          command: 'kubectl describe pod report-worker-7c6d9b8f5d-qk2pl | grep -A3 Mounts',
          output: `    Mounts:
      /etc/reports from templates (ro)
      /var/run/secrets/kubernetes.io/serviceaccount from kube-api-access-8vwpz (ro)`,
        },
      },
      {
        phase: 'solution',
        question: 'The ConfigMap is mounted at `/etc/reports`, but the app reads `/etc/report`. What is the correct fix?',
        options: [
          { text: 'Fix the mountPath in the Deployment\'s Pod template to /etc/report and let it roll out.', correct: true, feedback: 'Yes. Change desired state in the Deployment; the controller replaces the Pods with the corrected template.' },
          { text: 'kubectl exec into the Pod and create the file by hand.', correct: false, feedback: 'The container is restarting, and any manual change is lost on the next restart or reschedule. Fix the spec instead.' },
          { text: 'Delete the Pod so it restarts cleanly.', correct: false, feedback: 'The ReplicaSet recreates it from the same broken template, so it crashes the same way.' },
        ],
      },
    ],
    takeaway:
      '`CrashLoopBackOff` is a symptom, not a cause. Go straight to `kubectl logs --previous` and the `Last State` / `Exit Code` in `kubectl describe pod`, then fix the **template** in the owning controller.',
    references: [K8S_DEBUG_PODS, { title: 'Pod lifecycle', url: 'https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/' }],
  },
  {
    id: 'ts-imagepullbackoff',
    title: 'The image that never arrives',
    objective: 'co-troubleshooting',
    lessonId: 'troubleshooting-workloads',
    difficulty: 1,
    symptom:
      'A developer bumped the `checkout` image in CI. The new Pod has been stuck for 10 minutes; the old Pods are still serving.',
    evidence: [
      {
        command: 'kubectl get pods -l app=checkout',
        output: `NAME                        READY   STATUS             RESTARTS   AGE
checkout-58d9f7c6b4-7hjwt   1/1     Running            0          3d
checkout-58d9f7c6b4-n2c8x   1/1     Running            0          3d
checkout-6b7f9d8c5-x9vmq    0/1     ImagePullBackOff   0          10m`,
      },
    ],
    stages: [
      {
        phase: 'hypothesis',
        question: 'Which explanations fit `ImagePullBackOff`?',
        options: [
          { text: 'The image reference is wrong, the tag does not exist, or the registry needs credentials the node does not have.', correct: true, feedback: 'Right — the kubelet asked the runtime to pull the image and the pull failed repeatedly.' },
          { text: 'The application inside the image crashes on startup.', correct: false, feedback: 'The container never started; an app crash would be `CrashLoopBackOff`.' },
          { text: 'The Pod is waiting for a node with enough memory.', correct: false, feedback: 'Scheduling problems show `Pending`. This Pod is already assigned to a node, which is trying to pull.' },
        ],
      },
      {
        phase: 'investigation',
        question: 'Where will you find the exact pull error?',
        options: [
          { text: 'The Events section of kubectl describe pod checkout-6b7f9d8c5-x9vmq', correct: true, feedback: 'Yes. The kubelet records `Failed to pull image` events with the registry\'s error message.' },
          { text: 'kubectl logs checkout-6b7f9d8c5-x9vmq', correct: false, feedback: 'There are no logs — the container never ran. kubectl will say the container is waiting to start.' },
          { text: 'kubectl get endpoints checkout', correct: false, feedback: 'Endpoints tell you which Pods receive traffic, not why an image pull failed.' },
        ],
        reveal: {
          command: 'kubectl describe pod checkout-6b7f9d8c5-x9vmq | tail -6',
          output: `Events:
  Type     Reason   Age                  From     Message
  ----     ------   ----                 ----     -------
  Warning  Failed   9m (x4 over 10m)     kubelet  Failed to pull image "registry.example.com/shop/checkout:1.9.0-rc": rpc error: code = NotFound desc = failed to pull and unpack image "registry.example.com/shop/checkout:1.9.0-rc": registry.example.com/shop/checkout:1.9.0-rc: not found
  Warning  Failed   9m (x4 over 10m)     kubelet  Error: ErrImagePull
  Normal   BackOff  30s (x42 over 10m)   kubelet  Back-off pulling image "registry.example.com/shop/checkout:1.9.0-rc"`,
        },
      },
      {
        phase: 'evidence',
        question: 'What does `not found` (rather than `unauthorized` or `403`) point to?',
        options: [
          { text: 'The tag 1.9.0-rc does not exist in that repository.', correct: true, feedback: 'Correct. The registry answered; it just has no such manifest. An auth problem would say unauthorized/denied.' },
          { text: 'The node has no network connectivity.', correct: false, feedback: 'With no connectivity you would see a timeout or DNS error, not a `NotFound` answer from the registry.' },
          { text: 'An imagePullSecret is missing.', correct: false, feedback: 'Missing credentials typically produce `unauthorized` or `authentication required`.' },
        ],
        reveal: {
          command: 'kubectl get deploy checkout -o jsonpath=\'{.spec.template.spec.containers[0].image}\'',
          output: `registry.example.com/shop/checkout:1.9.0-rc`,
        },
      },
      {
        phase: 'solution',
        question: 'CI actually published `1.9.0`. What do you do?',
        options: [
          { text: 'Correct the image tag in the Deployment (or its source in Git) to 1.9.0.', correct: true, feedback: 'Yes. The rollout continues with the corrected template and the stuck Pod is replaced.' },
          { text: 'Add imagePullPolicy: Never.', correct: false, feedback: 'That forbids pulling entirely; the image is not on the node, so it would fail with `ErrImageNeverPull`.' },
          { text: 'Scale the Deployment to 0 and back.', correct: false, feedback: 'The template still references the wrong tag, so the new Pods fail the same way.' },
        ],
      },
    ],
    takeaway:
      'For image problems, read the kubelet events: `not found` = wrong name/tag, `unauthorized` = credentials (`imagePullSecrets`), timeouts = network/registry reachability. Note the rolling update kept the old Pods serving — that is `maxUnavailable` protecting you.',
    references: [K8S_DEBUG_PODS, { title: 'Images', url: 'https://kubernetes.io/docs/concepts/containers/images/' }],
  },
  {
    id: 'ts-pending-pod',
    title: 'The Pod nobody will host',
    objective: 'kf-scheduling',
    lessonId: 'scheduling-placement',
    difficulty: 2,
    symptom:
      'A data team deployed a `trainer` Pod requesting a lot of memory. It has been `Pending` for 20 minutes and nothing is in its logs.',
    evidence: [
      {
        command: 'kubectl get pod trainer -o wide',
        output: `NAME      READY   STATUS    RESTARTS   AGE   IP       NODE     NOMINATED NODE   READINESS GATES
trainer   0/1     Pending   0          20m   <none>   <none>   <none>           <none>`,
      },
    ],
    stages: [
      {
        phase: 'hypothesis',
        question: '`Pending` with no node assigned. Which component has not done its job yet?',
        options: [
          { text: 'kube-scheduler — it has not found a node that passes all filters.', correct: true, feedback: 'Right. NODE is `<none>`, so the Pod was never bound to a node.' },
          { text: 'The kubelet — it failed to start the container.', correct: false, feedback: 'The kubelet only acts after the Pod is bound to its node. No node is assigned here.' },
          { text: 'kube-proxy — it has not created Service rules.', correct: false, feedback: 'kube-proxy handles Service traffic and has nothing to do with placing Pods.' },
        ],
      },
      {
        phase: 'investigation',
        question: 'How do you get the scheduler\'s reason?',
        options: [
          { text: 'kubectl describe pod trainer and read the FailedScheduling event.', correct: true, feedback: 'Yes. The scheduler explains per-node why each was rejected.' },
          { text: 'kubectl logs trainer', correct: false, feedback: 'No container has run, so there are no logs.' },
          { text: 'kubectl rollout status pod/trainer', correct: false, feedback: '`rollout` works on Deployments, DaemonSets and StatefulSets, not bare Pods.' },
        ],
        reveal: {
          command: 'kubectl describe pod trainer | tail -4',
          output: `Events:
  Type     Reason            Age                 From               Message
  ----     ------            ----                ----               -------
  Warning  FailedScheduling  2m (x5 over 20m)    default-scheduler  0/3 nodes are available: 1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }, 2 Insufficient memory. preemption: 0/3 nodes are available: 1 Preemption is not helpful for scheduling, 2 No preemption victims found for incoming pod.`,
        },
      },
      {
        phase: 'evidence',
        question: 'How do you read `1 node(s) had untolerated taint ... , 2 Insufficient memory`?',
        options: [
          { text: 'The control-plane node is tainted against workloads, and both workers lack enough unreserved memory for the Pod\'s request.', correct: true, feedback: 'Correct. Every node is ruled out, each for a stated reason.' },
          { text: 'The Pod is using more memory than its limit.', correct: false, feedback: 'Scheduling compares **requests** to node allocatable capacity. The Pod is not running, so it is using nothing.' },
          { text: 'Two nodes are NotReady.', correct: false, feedback: 'NotReady nodes would show a `not-ready` taint/condition message. These are Ready but full.' },
        ],
        reveal: {
          command: 'kubectl describe node kcna-worker | grep -A6 "Allocated resources"',
          output: `Allocated resources:
  (Total limits may be over 100 percent, i.e., overcommitted.)
  Resource           Requests      Limits
  --------           --------      ------
  cpu                850m (21%)    1 (25%)
  memory             5800Mi (74%)  6Gi (78%)`,
        },
      },
      {
        phase: 'solution',
        question: 'The Pod requests `memory: 12Gi` and each worker has about 7.6Gi allocatable. What is a correct fix?',
        options: [
          { text: 'Lower the request to what the job really needs, or add a node large enough (e.g. via Cluster Autoscaler).', correct: true, feedback: 'Yes. Either shrink the request to fit, or add capacity. Both make a node pass the filter.' },
          { text: 'Add a toleration for the control-plane taint.', correct: false, feedback: 'The control-plane node is not big enough either, and running heavy workloads there risks the control plane.' },
          { text: 'Remove the memory limit.', correct: false, feedback: 'The scheduler filters on **requests**, not limits. The 12Gi request still cannot fit anywhere.' },
        ],
      },
    ],
    takeaway:
      '`Pending` + no node = scheduling. `kubectl describe pod` gives the `FailedScheduling` reason per node: insufficient resources (requests vs allocatable), taints without tolerations, nodeSelector/affinity mismatches, or unbound PVCs.',
    references: [
      { title: 'Scheduling, Preemption and Eviction', url: 'https://kubernetes.io/docs/concepts/scheduling-eviction/' },
      { title: 'Taints and Tolerations', url: 'https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/' },
    ],
  },
  {
    id: 'ts-service-no-endpoints',
    title: 'The Service that routes to nowhere',
    objective: 'co-networking',
    lessonId: 'services',
    difficulty: 2,
    symptom:
      'The `orders` Pods are all `Running` and `1/1` Ready, but other services get "connection refused" or timeouts when calling `http://orders`.',
    evidence: [
      {
        command: 'kubectl get svc orders',
        output: `NAME     TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
orders   ClusterIP   10.96.73.204   <none>        80/TCP    1h`,
      },
      {
        command: 'kubectl get pods -l app=orders',
        output: `NAME                      READY   STATUS    RESTARTS   AGE
orders-7f8c9d6b5f-6tq2m   1/1     Running   0          1h
orders-7f8c9d6b5f-zx4wd   1/1     Running   0          1h`,
      },
    ],
    stages: [
      {
        phase: 'hypothesis',
        question: 'Pods are healthy and the Service exists. What should you suspect first?',
        options: [
          { text: 'The Service is not connected to the Pods — its selector or port does not match them.', correct: true, feedback: 'Right. A Service only forwards to Pods its selector matches, on its targetPort.' },
          { text: 'The ClusterIP range is exhausted.', correct: false, feedback: 'The Service already has a ClusterIP, so allocation succeeded.' },
          { text: 'The container image is wrong.', correct: false, feedback: 'The Pods are Running and Ready, so the image is fine.' },
        ],
      },
      {
        phase: 'investigation',
        question: 'Which command shows whether the Service has backends?',
        options: [
          { text: 'kubectl get endpoints orders (or the EndpointSlices for the Service)', correct: true, feedback: 'Yes. The endpoint list is exactly where the Service would send traffic.' },
          { text: 'kubectl get nodes -o wide', correct: false, feedback: 'Node addresses do not tell you whether the Service matched any Pods.' },
          { text: 'kubectl logs deploy/orders', correct: false, feedback: 'The app logs will be quiet — the requests never reach it.' },
        ],
        reveal: {
          command: 'kubectl get endpoints orders',
          output: `NAME     ENDPOINTS   AGE
orders   <none>      1h`,
        },
      },
      {
        phase: 'evidence',
        question: 'Endpoints are `<none>`. What do you compare next?',
        options: [
          { text: 'The Service\'s selector against the Pods\' labels.', correct: true, feedback: 'Correct. No ready Pod matched the selector, so nothing was added to the endpoints.' },
          { text: 'The Service\'s creation time against the Pods\'.', correct: false, feedback: 'Order does not matter — the EndpointSlice controller continuously reconciles matches.' },
          { text: 'The node\'s kernel version.', correct: false, feedback: 'Matching is done in the control plane via labels, not on nodes.' },
        ],
        reveal: {
          command: 'kubectl get svc orders -o jsonpath=\'{.spec.selector}\'; echo; kubectl get pods -l app=orders --show-labels',
          output: `{"app":"order"}
NAME                      READY   STATUS    RESTARTS   AGE   LABELS
orders-7f8c9d6b5f-6tq2m   1/1     Running   0          1h    app=orders,pod-template-hash=7f8c9d6b5f
orders-7f8c9d6b5f-zx4wd   1/1     Running   0          1h    app=orders,pod-template-hash=7f8c9d6b5f`,
        },
      },
      {
        phase: 'solution',
        question: 'The Service selects `app=order`; the Pods are labelled `app=orders`. Best fix?',
        options: [
          { text: 'Correct the Service selector to app: orders.', correct: true, feedback: 'Yes. Endpoints populate within seconds and traffic flows.' },
          { text: 'Relabel the running Pods with kubectl label.', correct: false, feedback: 'New Pods from the Deployment would still lack the label. Fix the selector (or the template) at the source.' },
          { text: 'Change the Service type to NodePort.', correct: false, feedback: 'NodePort uses the same selector — it would have no endpoints either.' },
        ],
      },
    ],
    takeaway:
      'When a Service "does nothing", check endpoints first. `<none>` means selector/label mismatch or no Ready Pods; endpoints present but connection refused usually means a wrong `targetPort`.',
    references: [
      { title: 'Debug Services', url: 'https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/' },
      { title: 'Service', url: 'https://kubernetes.io/docs/concepts/services-networking/service/' },
    ],
  },
  {
    id: 'ts-missing-configmap',
    title: 'The config that was never created',
    objective: 'co-troubleshooting',
    lessonId: 'configmaps-and-secrets',
    difficulty: 2,
    symptom:
      'A `notifier` Deployment was applied to a fresh `staging` namespace. Its Pod never starts and shows an unusual status.',
    evidence: [
      {
        command: 'kubectl get pods -n staging',
        output: `NAME                        READY   STATUS                       RESTARTS   AGE
notifier-6d5b8c7f9c-4wq8z   0/1     CreateContainerConfigError   0          4m`,
      },
    ],
    stages: [
      {
        phase: 'hypothesis',
        question: 'What does `CreateContainerConfigError` suggest?',
        options: [
          { text: 'The kubelet cannot build the container\'s configuration — often a referenced ConfigMap or Secret (or key) is missing.', correct: true, feedback: 'Right. The image is fine, but the kubelet cannot assemble env vars or files the container needs.' },
          { text: 'The image has an invalid entrypoint.', correct: false, feedback: 'A bad entrypoint fails when the container starts (`RunContainerError` or `CrashLoopBackOff`), not while building config.' },
          { text: 'The scheduler rejected the Pod.', correct: false, feedback: 'The Pod has a status from the kubelet, so it was already scheduled.' },
        ],
      },
      {
        phase: 'investigation',
        question: 'Where do you look?',
        options: [
          { text: 'kubectl describe pod notifier-6d5b8c7f9c-4wq8z -n staging (Events)', correct: true, feedback: 'Yes. The kubelet names the missing object in the event.' },
          { text: 'kubectl logs notifier-6d5b8c7f9c-4wq8z -n staging --previous', correct: false, feedback: 'The container was never created, so there is no previous instance with logs.' },
          { text: 'kubectl get events -n kube-system', correct: false, feedback: 'The relevant events are in the Pod\'s own namespace, `staging`.' },
        ],
        reveal: {
          command: 'kubectl describe pod notifier-6d5b8c7f9c-4wq8z -n staging | tail -2',
          output: `  Warning  Failed     12s (x20 over 4m)  kubelet            Error: configmap "notifier-config" not found`,
        },
      },
      {
        phase: 'evidence',
        question: 'How do you confirm the ConfigMap is really missing in this namespace?',
        options: [
          { text: 'kubectl get configmaps -n staging', correct: true, feedback: 'Correct. ConfigMaps are namespaced — a Pod can only reference ones in its own namespace.' },
          { text: 'kubectl get configmaps -n default', correct: false, feedback: 'Even if it exists in `default`, a Pod in `staging` cannot use it.' },
          { text: 'kubectl get nodes', correct: false, feedback: 'ConfigMaps are API objects stored in etcd, not on nodes.' },
        ],
        reveal: {
          command: 'kubectl get configmaps -n staging',
          output: `NAME               DATA   AGE
kube-root-ca.crt   1      6m`,
        },
      },
      {
        phase: 'solution',
        question: 'What is the right fix?',
        options: [
          { text: 'Create notifier-config in staging (ideally from the same source as other environments). The kubelet retries and the container starts.', correct: true, feedback: 'Yes. No Pod restart is needed; the kubelet keeps retrying until the reference resolves.' },
          { text: 'Mark the reference optional: true and move on.', correct: false, feedback: 'That hides the problem — the app would start without its config and probably fail later in a less obvious way.' },
          { text: 'Copy the ConfigMap into kube-system.', correct: false, feedback: 'Wrong namespace. References never cross namespaces.' },
        ],
      },
    ],
    takeaway:
      '`CreateContainerConfigError` = a missing ConfigMap/Secret, or a missing **key** in one. Check the event, then check the object exists in the **same namespace**. Order your applies (or use Helm/Kustomize/GitOps) so config lands before workloads.',
    references: [K8S_DEBUG_PODS, { title: 'ConfigMaps', url: 'https://kubernetes.io/docs/concepts/configuration/configmap/' }],
  },
  {
    id: 'ts-pvc-pending',
    title: 'The claim nobody answers',
    objective: 'co-storage',
    lessonId: 'persistent-volumes-and-csi',
    difficulty: 3,
    symptom:
      'A `postgres` StatefulSet was copied from a cloud cluster into an on-prem cluster. Its Pod is `Pending` and so is its PersistentVolumeClaim.',
    evidence: [
      {
        command: 'kubectl get pvc',
        output: `NAME              STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
data-postgres-0   Pending                                      fast-ssd       <unset>                 8m`,
      },
    ],
    stages: [
      {
        phase: 'hypothesis',
        question: 'Why might a PVC stay `Pending`?',
        options: [
          { text: 'No PV matches it and no provisioner is creating one — e.g. the StorageClass does not exist here.', correct: true, feedback: 'Right. A PVC binds to an existing matching PV or one created by its StorageClass\'s provisioner.' },
          { text: 'The Pod using it is in CrashLoopBackOff.', correct: false, feedback: 'Cause and effect are reversed: the Pod is Pending *because* its claim is unbound.' },
          { text: 'etcd is out of disk space.', correct: false, feedback: 'Then you could not create the PVC at all; the API write succeeded.' },
        ],
      },
      {
        phase: 'investigation',
        question: 'What do you run to see why it is not binding?',
        options: [
          { text: 'kubectl describe pvc data-postgres-0', correct: true, feedback: 'Yes. The PV controller and provisioners post events on the claim.' },
          { text: 'kubectl logs postgres-0', correct: false, feedback: 'The Pod has not started — no logs exist.' },
          { text: 'kubectl get pv -A', correct: false, feedback: 'PersistentVolumes are cluster-scoped; `-A` is meaningless for them, and the list alone does not say why binding failed.' },
        ],
        reveal: {
          command: 'kubectl describe pvc data-postgres-0 | tail -3',
          output: `  Type     Reason              Age                 From                         Message
  ----     ------              ----                ----                         -------
  Warning  ProvisioningFailed  12s (x34 over 8m)   persistentvolume-controller  storageclass.storage.k8s.io "fast-ssd" not found`,
        },
      },
      {
        phase: 'evidence',
        question: 'Which StorageClasses does this cluster actually offer?',
        options: [
          { text: 'kubectl get storageclass', correct: true, feedback: 'Correct. StorageClasses are cluster-scoped; the `(default)` marker shows the default class.' },
          { text: 'kubectl get csidrivers -n default', correct: false, feedback: 'CSIDrivers are cluster-scoped and list drivers, not the classes you can request.' },
          { text: 'kubectl describe node', correct: false, feedback: 'Nodes do not list StorageClasses.' },
        ],
        reveal: {
          command: 'kubectl get storageclass',
          output: `NAME                 PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
standard (default)   rancher.io/local-path   Delete          WaitForFirstConsumer   false                  40d`,
        },
      },
      {
        phase: 'solution',
        question: 'What is the right fix?',
        options: [
          { text: 'Use storageClassName: standard (or create an equivalent fast-ssd class) in the StatefulSet\'s volumeClaimTemplates, then recreate the PVC.', correct: true, feedback: 'Yes. Most PVC spec fields are immutable, so delete the Pending claim and let the StatefulSet recreate it from the fixed template.' },
          { text: 'Edit the PVC to add more storage.', correct: false, feedback: 'The size is not the problem; there is no provisioner for the requested class.' },
          { text: 'Change the access mode to ReadWriteMany.', correct: false, feedback: 'RWX is even harder to satisfy, and the class still would not exist.' },
        ],
      },
    ],
    takeaway:
      'StorageClass names are cluster-specific. `kubectl describe pvc` tells you whether the class is missing, no PV matches (size/access mode/class), or binding is waiting for a consumer (`WaitForFirstConsumer` is normal until a Pod uses the claim).',
    references: [
      { title: 'Persistent Volumes', url: 'https://kubernetes.io/docs/concepts/storage/persistent-volumes/' },
      { title: 'Storage Classes', url: 'https://kubernetes.io/docs/concepts/storage/storage-classes/' },
    ],
  },
  {
    id: 'ts-readiness-failing',
    title: 'Running, but not Ready',
    objective: 'co-troubleshooting',
    lessonId: 'health-probes',
    difficulty: 2,
    symptom:
      'After a release, the `search` Service intermittently returns 503 from the Ingress. The Pods show `Running` with zero restarts.',
    evidence: [
      {
        command: 'kubectl get pods -l app=search',
        output: `NAME                      READY   STATUS    RESTARTS   AGE
search-5b9c8d7f6c-2rlkp   0/1     Running   0          12m
search-5b9c8d7f6c-mf8tz   0/1     Running   0          12m`,
      },
    ],
    stages: [
      {
        phase: 'hypothesis',
        question: '`Running` but `0/1` Ready, no restarts. What is going on?',
        options: [
          { text: 'The readiness probe is failing; the containers run but are not considered ready to receive traffic.', correct: true, feedback: 'Right. Readiness failures do not restart containers — liveness failures do.' },
          { text: 'The liveness probe is failing.', correct: false, feedback: 'A failing liveness probe causes restarts; RESTARTS is 0.' },
          { text: 'The Pods are still being scheduled.', correct: false, feedback: 'They are Running on nodes, so scheduling is done.' },
        ],
      },
      {
        phase: 'investigation',
        question: 'What does this mean for the Service?',
        options: [
          { text: 'Not-ready Pods are excluded from the Service\'s ready endpoints, so there is nothing healthy to route to.', correct: true, feedback: 'Correct — that is why the Ingress returns 503.' },
          { text: 'The Service load-balances to them anyway.', correct: false, feedback: 'Readiness exists precisely to keep not-ready Pods out of rotation.' },
          { text: 'The Service is deleted automatically.', correct: false, feedback: 'The Service stays; only its endpoint list changes.' },
        ],
        reveal: {
          command: 'kubectl get endpoints search',
          output: `NAME     ENDPOINTS   AGE
search   <none>      30d`,
        },
      },
      {
        phase: 'evidence',
        question: 'How do you see why the probe fails?',
        options: [
          { text: 'kubectl describe pod search-5b9c8d7f6c-2rlkp — look for Unhealthy events and the probe config.', correct: true, feedback: 'Yes. The kubelet logs each probe failure as an `Unhealthy` event with the reason.' },
          { text: 'kubectl get svc search -o yaml', correct: false, feedback: 'The Service does not define or report probe results.' },
          { text: 'kubectl top pods', correct: false, feedback: 'Resource usage does not say what the probe returned.' },
        ],
        reveal: {
          command: 'kubectl describe pod search-5b9c8d7f6c-2rlkp | grep -E "Readiness|Unhealthy"',
          output: `    Readiness:      http-get http://:8080/healthz delay=0s timeout=1s period=10s #success=1 #failure=3
  Warning  Unhealthy  8s (x70 over 12m)  kubelet  Readiness probe failed: HTTP probe failed with statuscode: 404`,
        },
      },
      {
        phase: 'solution',
        question: 'The release notes say the health endpoint moved to `/ready`. Fix?',
        options: [
          { text: 'Update readinessProbe.httpGet.path to /ready in the Deployment.', correct: true, feedback: 'Yes. New Pods pass readiness, join the endpoints, and the rollout completes.' },
          { text: 'Remove the readiness probe.', correct: false, feedback: 'That would send traffic to Pods before they are truly ready and hide future problems.' },
          { text: 'Increase failureThreshold to 100.', correct: false, feedback: 'A 404 never turns into a 200 by waiting; the probe still fails, just more slowly.' },
        ],
      },
    ],
    takeaway:
      '`0/1 Running` with no restarts = readiness failing. The Pod is alive but out of the Service\'s endpoints. Read the `Unhealthy` events, and keep probe paths in sync with the app.',
    references: [
      { title: 'Configure Liveness, Readiness and Startup Probes', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/' },
      K8S_DEBUG,
    ],
  },
  {
    id: 'ts-oomkilled',
    title: 'Killed without a stack trace',
    objective: 'kf-scheduling',
    lessonId: 'resources-requests-limits',
    difficulty: 2,
    symptom:
      'The `image-resizer` Pod restarts every few minutes under load. Its logs end abruptly with no error message.',
    evidence: [
      {
        command: 'kubectl get pods -l app=image-resizer',
        output: `NAME                             READY   STATUS      RESTARTS      AGE
image-resizer-7d4c9f8b6d-gq5xk   0/1     OOMKilled   4 (30s ago)   22m`,
      },
    ],
    stages: [
      {
        phase: 'hypothesis',
        question: 'What does `OOMKilled` mean?',
        options: [
          { text: 'The container used more memory than its limit and the kernel\'s OOM killer terminated it.', correct: true, feedback: 'Right. The process gets SIGKILL — no chance to log an error, hence the abrupt logs.' },
          { text: 'The node ran out of disk space.', correct: false, feedback: 'Disk pressure leads to eviction (`Evicted`), not OOMKilled.' },
          { text: 'The image is too large to pull.', correct: false, feedback: 'Image size affects pull time, not runtime memory kills.' },
        ],
      },
      {
        phase: 'investigation',
        question: 'Where do you confirm it and see the configured limit?',
        options: [
          { text: 'kubectl describe pod — Last State: Terminated, Reason: OOMKilled, Exit Code: 137, plus the Limits section.', correct: true, feedback: 'Yes. Exit code 137 = 128 + 9 (SIGKILL).' },
          { text: 'kubectl get events -n kube-system', correct: false, feedback: 'The relevant state is on the Pod in its own namespace.' },
          { text: 'kubectl logs --previous', correct: false, feedback: 'Useful context, but the logs just stop — they cannot show the kill reason or the limit.' },
        ],
        reveal: {
          command: 'kubectl describe pod image-resizer-7d4c9f8b6d-gq5xk | grep -A12 "Last State"',
          output: `    Last State:     Terminated
      Reason:       OOMKilled
      Exit Code:    137
      Started:      Thu, 12 Nov 2026 10:02:11 +0000
      Finished:     Thu, 12 Nov 2026 10:05:47 +0000
    Ready:          False
    Restart Count:  4
    Limits:
      memory:  256Mi
    Requests:
      cpu:     100m
      memory:  128Mi`,
        },
      },
      {
        phase: 'evidence',
        question: 'How do you check how much memory the app actually needs under load?',
        options: [
          { text: 'kubectl top pod (requires metrics-server) while it handles load, or your Prometheus memory metrics.', correct: true, feedback: 'Correct. Measure real usage before choosing a new limit.' },
          { text: 'kubectl get pod -o wide', correct: false, feedback: 'That shows IP and node, not memory usage.' },
          { text: 'kubectl describe node and read the node\'s total memory.', correct: false, feedback: 'Node capacity does not tell you what this container uses.' },
        ],
        reveal: {
          command: 'kubectl top pod -l app=image-resizer',
          output: `NAME                             CPU(cores)   MEMORY(bytes)
image-resizer-7d4c9f8b6d-gq5xk   410m         249Mi`,
        },
      },
      {
        phase: 'solution',
        question: 'Typical peak is ~400Mi when resizing large images. Best fix?',
        options: [
          { text: 'Raise the memory limit (e.g. 512Mi) and the request to a realistic baseline in the Deployment; investigate leaks if usage keeps growing.', correct: true, feedback: 'Yes. Right-size requests/limits from measurements so the scheduler reserves enough and the kernel does not kill normal peaks.' },
          { text: 'Raise the CPU limit.', correct: false, feedback: 'CPU limits cause throttling, not OOM kills. Memory is the constrained resource.' },
          { text: 'Set restartPolicy: Never.', correct: false, feedback: 'Deployments only allow `Always`, and refusing to restart would not stop the kill anyway.' },
        ],
      },
    ],
    takeaway:
      'OOMKilled / exit 137 = memory limit exceeded. Memory is **incompressible** (kill), CPU is **compressible** (throttle). Size limits from measured peaks, and remember requests drive scheduling while limits drive enforcement.',
    references: [
      { title: 'Resource Management for Pods and Containers', url: 'https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/' },
      K8S_DEBUG_PODS,
    ],
  },

  {
    id: 'ts-hpa-not-scaling',
    title: 'The autoscaler that never scales',
    objective: 'cna-ecosystem',
    lessonId: 'autoscaling-and-serverless',
    difficulty: 2,
    symptom:
      'A HorizontalPodAutoscaler targets 60% CPU for the `api` Deployment. A load test drives traffic up, response times climb, but the Deployment stays at 2 replicas.',
    evidence: [
      {
        command: 'kubectl get hpa api',
        output: `NAME   REFERENCE        TARGETS              MINPODS   MAXPODS   REPLICAS   AGE
api    Deployment/api   cpu: <unknown>/60%   2         10        2          20m`,
      },
    ],
    stages: [
      {
        phase: 'hypothesis',
        question: 'The TARGETS column shows `<unknown>`. What does that suggest?',
        options: [
          { text: 'The HPA cannot read current CPU usage, so it cannot compute a desired replica count.', correct: true, feedback: 'Right. Without a current value the HPA has nothing to compare against the 60% target.' },
          { text: 'The Deployment has reached maxReplicas.', correct: false, feedback: 'maxReplicas is 10 and there are only 2 replicas, so the ceiling is not the problem.' },
          { text: 'The scheduler has no room for new Pods.', correct: false, feedback: 'That would show as Pending Pods after the HPA scales up. Here the HPA never asks for more replicas.' },
        ],
      },
      {
        phase: 'investigation',
        question: 'Where does the HPA get CPU usage from for a `cpu` resource target?',
        options: [
          { text: 'The resource metrics API (metrics.k8s.io), usually served by metrics-server.', correct: true, feedback: 'Correct. Resource-based HPA reads the metrics API, which metrics-server normally provides.' },
          { text: 'Directly from the container runtime on each node.', correct: false, feedback: 'The HPA controller talks to aggregated metrics APIs, not to runtimes.' },
          { text: 'From the Deployment status field.', correct: false, feedback: 'Deployment status has replica counts, not CPU usage.' },
        ],
        reveal: {
          command: 'kubectl top pods -l app=api',
          output: 'error: Metrics API not available',
        },
      },
      {
        phase: 'evidence',
        question: 'The metrics API is unavailable. What else must be true for a CPU-utilisation target to work, even once metrics exist?',
        options: [
          { text: 'The containers must declare CPU requests, because utilisation is measured as a percentage of the request.', correct: true, feedback: 'Exactly. With no CPU request there is no denominator for "60%".' },
          { text: 'The Pods must run as root.', correct: false, feedback: 'Security context has nothing to do with metrics collection.' },
          { text: 'The Service must be of type LoadBalancer.', correct: false, feedback: 'Service type does not affect how the HPA measures CPU.' },
        ],
        reveal: {
          command: "kubectl get deploy api -o jsonpath='{.spec.template.spec.containers[0].resources}'",
          output: '{"requests":{"cpu":"200m","memory":"128Mi"}}',
        },
      },
      {
        phase: 'solution',
        question: 'CPU requests are set. What fixes the problem?',
        options: [
          { text: 'Install (or repair) metrics-server so the resource metrics API is served; the HPA then sees usage and scales.', correct: true, feedback: 'Yes. Once `kubectl top pods` works, the TARGETS column shows a real value and the HPA reacts.' },
          { text: 'Raise maxReplicas to 50.', correct: false, feedback: 'The HPA is not hitting its ceiling; it simply has no data.' },
          { text: 'Delete the HPA and scale manually forever.', correct: false, feedback: 'That works around the symptom but abandons autoscaling instead of fixing the missing metrics pipeline.' },
        ],
      },
    ],
    takeaway:
      'Resource-based autoscaling needs two things: a working metrics pipeline (metrics-server or another provider of metrics.k8s.io) and resource requests on the containers. `<unknown>` in `kubectl get hpa` is the classic sign of the first one missing.',
    references: [{ title: 'Horizontal Pod Autoscaling', url: 'https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/' }],
  },
  {
    id: 'ts-latency-observability',
    title: 'Checkout is slow — find the culprit',
    objective: 'cna-observability',
    lessonId: 'observability-fundamentals',
    difficulty: 2,
    symptom:
      'An SLO alert fires: 99th percentile checkout latency is 2.8s against a 500ms objective. All Pods are Running and Ready, and nothing has restarted.',
    evidence: [
      {
        command: 'kubectl get pods -n shop',
        output: `NAME                        READY   STATUS    RESTARTS   AGE
checkout-6d8f7c9b4-2xk8q    1/1     Running   0          3d
payments-5b9c6d7f8-p7wqz    1/1     Running   0          3d
inventory-7f6b5c4d9-lm2rt   1/1     Running   0          2h`,
      },
    ],
    stages: [
      {
        phase: 'hypothesis',
        question: 'Pods look healthy. What is the best first hypothesis?',
        options: [
          { text: 'One of the services in the request path is slow; the problem is latency, not availability.', correct: true, feedback: 'Right. Ready Pods only prove health checks pass; they say nothing about how fast requests are served.' },
          { text: 'The cluster DNS is down.', correct: false, feedback: 'A DNS outage would cause errors and failed lookups across many services, not slow-but-successful checkouts.' },
          { text: 'The Pods are being OOMKilled.', correct: false, feedback: 'OOMKills would show as restarts; there are none.' },
        ],
      },
      {
        phase: 'investigation',
        question: 'Which signal tells you where the 2.8 seconds is spent inside one slow checkout request?',
        options: [
          { text: 'A distributed trace of a slow request, broken into spans per service.', correct: true, feedback: 'Yes. Traces attribute time to each hop, which metrics and logs alone cannot do for a single request.' },
          { text: 'The total request counter for checkout.', correct: false, feedback: 'A counter shows volume, not where latency comes from.' },
          { text: 'kubectl get events -n shop', correct: false, feedback: 'Events describe object lifecycle changes such as scheduling, not request timing.' },
        ],
        reveal: {
          command: 'trace 4f9a… (from the tracing backend)',
          output: `checkout  POST /checkout          2.81s
├─ payments  POST /authorize       0.12s
└─ inventory GET /reserve          2.61s
   └─ inventory → postgres query   2.58s`,
        },
      },
      {
        phase: 'evidence',
        question: 'The trace points at inventory’s database query. What evidence explains why it started now?',
        options: [
          { text: 'Inventory’s logs and metrics around its deployment 2 hours ago (e.g. slow-query logs, query latency histograms).', correct: true, feedback: 'Good: the inventory Pod is only 2h old, which lines up with a recent change. Logs give the detail behind the slow span.' },
          { text: 'The node’s kernel version.', correct: false, feedback: 'Nothing points at the node; only one service’s queries are slow.' },
          { text: 'The payments service’s logs.', correct: false, feedback: 'Payments took only 0.12s in the trace.' },
        ],
        reveal: {
          command: 'kubectl logs deploy/inventory -n shop | grep -i slow | tail -2',
          output: `WARN slow query 2571ms: SELECT * FROM stock WHERE sku = $1 (seq scan on stock)
WARN slow query 2602ms: SELECT * FROM stock WHERE sku = $1 (seq scan on stock)`,
        },
      },
      {
        phase: 'solution',
        question: 'What is the most appropriate fix?',
        options: [
          { text: 'Roll back the inventory release (or restore the dropped index it introduced), then verify latency recovers against the SLO.', correct: true, feedback: 'Yes. Fix the cause the evidence points to, and confirm with the same metric that alerted.' },
          { text: 'Scale checkout to 20 replicas.', correct: false, feedback: 'More checkout Pods will not make inventory’s database query faster.' },
          { text: 'Raise the SLO target to 3 seconds.', correct: false, feedback: 'That hides the regression instead of fixing it.' },
        ],
      },
    ],
    takeaway:
      'Use the three signals together: metrics (and SLO alerts) tell you something is wrong, traces tell you where, and logs tell you why. Healthy, Ready Pods do not mean a fast service.',
    references: [{ title: 'OpenTelemetry documentation', url: 'https://opentelemetry.io/docs/' }, { title: 'Prometheus overview', url: 'https://prometheus.io/docs/introduction/overview/' }],
  },
];
