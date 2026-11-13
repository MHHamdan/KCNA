import type { YamlChallenge } from '../types';

export const yamlChallenges: YamlChallenge[] = [
  {
    id: 'yaml-selector-mismatch',
    title: 'Fix a Deployment whose selector matches nothing',
    objective: 'kf-core',
    lessonId: 'replicasets-and-deployments',
    kind: 'fix',
    difficulty: 1,
    instructions:
      'The API server rejects this Deployment with `selector does not match template labels`. Make the Pod template labels and the selector agree. Keep the selector as `app: web` and the replica count at 3.',
    starter: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: nginx
        image: nginx:1.27
        ports:
        - containerPort: 80
`,
    checks: [
      { path: 'kind', op: 'equals', value: 'Deployment', message: 'kind must stay Deployment.' },
      { path: 'spec.selector.matchLabels.app', op: 'equals', value: 'web', message: 'Keep the selector as app: web.' },
      { path: 'spec.template.metadata.labels.app', op: 'equals', value: 'web', message: 'The Pod template must carry the label app: web so the selector can find its Pods.' },
      { op: 'selectorMatchesTemplate', message: 'Every key/value in spec.selector.matchLabels must also appear in spec.template.metadata.labels.' },
      { path: 'spec.replicas', op: 'equals', value: 3, message: 'replicas should stay at 3.' },
    ],
    solution: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: nginx
        image: nginx:1.27
        ports:
        - containerPort: 80
`,
    explanation:
      'A Deployment finds "its" Pods only through `spec.selector`. For `apps/v1` the selector is required, immutable after creation, and must match the template labels — otherwise the controller would create Pods it could never count, and keep creating more. The template may carry **extra** labels; it just must include every selector label.',
  },
  {
    id: 'yaml-missing-image',
    title: 'Add the missing container image',
    objective: 'kf-containerization',
    lessonId: 'pods',
    kind: 'fix',
    difficulty: 1,
    instructions:
      'This Pod is rejected with `spec.containers[0].image: Required value`. Add the image `busybox:1.36` to the container. Use a pinned tag, not `latest`.',
    starter: `apiVersion: v1
kind: Pod
metadata:
  name: sleeper
  labels:
    app: sleeper
spec:
  containers:
  - name: main
    command: ["sh", "-c", "echo started; sleep 3600"]
`,
    checks: [
      { path: 'kind', op: 'equals', value: 'Pod', message: 'kind must stay Pod.' },
      { path: 'spec.containers[0].name', op: 'equals', value: 'main', message: 'Keep the container name main.' },
      { path: 'spec.containers[0].image', op: 'exists', message: 'The container has no image field — every container needs an image.' },
      { path: 'spec.containers[0].image', op: 'equals', value: 'busybox:1.36', message: 'Use exactly busybox:1.36 (a pinned tag, not latest or an untagged name).' },
    ],
    solution: `apiVersion: v1
kind: Pod
metadata:
  name: sleeper
  labels:
    app: sleeper
spec:
  containers:
  - name: main
    image: busybox:1.36
    command: ["sh", "-c", "echo started; sleep 3600"]
`,
    explanation:
      '`image` is the one required field of a container besides `name`. Pinning a tag (or better, a digest like `busybox@sha256:...`) makes deployments reproducible; an untagged image means `:latest`, which also changes the default `imagePullPolicy` to `Always`.',
  },
  {
    id: 'yaml-resources',
    title: 'Set resource requests and limits',
    objective: 'kf-scheduling',
    lessonId: 'resources-requests-limits',
    kind: 'complete',
    difficulty: 2,
    instructions:
      'Give the `api` container these resources:\n\n- requests: `cpu: 250m`, `memory: 128Mi`\n- limits: `memory: 256Mi`\n\nDo not set a CPU limit (CPU over-use is throttled, not killed, so many teams omit it).',
    starter: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 2
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
        image: nginx:1.27
        resources: {}
`,
    checks: [
      { path: 'spec.template.spec.containers[0].resources.requests.cpu', op: 'equals', value: '250m', message: 'requests.cpu should be 250m (a quarter of a CPU core).' },
      { path: 'spec.template.spec.containers[0].resources.requests.memory', op: 'equals', value: '128Mi', message: 'requests.memory should be 128Mi.' },
      { path: 'spec.template.spec.containers[0].resources.limits.memory', op: 'equals', value: '256Mi', message: 'limits.memory should be 256Mi — exceeding it gets the container OOMKilled.' },
      { path: 'spec.template.spec.containers[0].resources.limits.cpu', op: 'absent', message: 'The task asks for no CPU limit.' },
      { op: 'selectorMatchesTemplate', message: 'Do not break the selector: template labels must still include app: api.' },
    ],
    solution: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 2
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
        image: nginx:1.27
        resources:
          requests:
            cpu: 250m
            memory: 128Mi
          limits:
            memory: 256Mi
`,
    explanation:
      '**Requests** are what the scheduler reserves when choosing a node; **limits** are enforced at runtime by the kubelet and kernel cgroups. Memory over the limit → OOMKilled; CPU over a limit → throttled. Because requests are set but do not equal limits, this Pod gets the **Burstable** QoS class.',
  },
  {
    id: 'yaml-readiness-probe',
    title: 'Add a readiness probe',
    objective: 'co-troubleshooting',
    lessonId: 'health-probes',
    kind: 'complete',
    difficulty: 2,
    instructions:
      'The app listens on port 8080 and returns 200 on `/ready` only after it has loaded its cache. Add a **readiness** probe to the container: HTTP GET `/ready` on port `8080`, checked every `5` seconds, with an initial delay of `3` seconds.',
    starter: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: catalog
spec:
  replicas: 2
  selector:
    matchLabels:
      app: catalog
  template:
    metadata:
      labels:
        app: catalog
    spec:
      containers:
      - name: catalog
        image: registry.example.com/shop/catalog:2.4.1
        ports:
        - containerPort: 8080
`,
    checks: [
      { path: 'spec.template.spec.containers[0].readinessProbe', op: 'exists', message: 'Add a readinessProbe to the container (not a livenessProbe).' },
      { path: 'spec.template.spec.containers[0].readinessProbe.httpGet.path', op: 'equals', value: '/ready', message: 'The probe should use httpGet with path /ready.' },
      { path: 'spec.template.spec.containers[0].readinessProbe.httpGet.port', op: 'equals', value: 8080, message: 'The probe should hit port 8080, where the app listens.' },
      { path: 'spec.template.spec.containers[0].readinessProbe.periodSeconds', op: 'equals', value: 5, message: 'periodSeconds should be 5.' },
      { path: 'spec.template.spec.containers[0].readinessProbe.initialDelaySeconds', op: 'equals', value: 3, message: 'initialDelaySeconds should be 3.' },
    ],
    solution: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: catalog
spec:
  replicas: 2
  selector:
    matchLabels:
      app: catalog
  template:
    metadata:
      labels:
        app: catalog
    spec:
      containers:
      - name: catalog
        image: registry.example.com/shop/catalog:2.4.1
        ports:
        - containerPort: 8080
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 3
          periodSeconds: 5
`,
    explanation:
      'A failing **readiness** probe removes the Pod from Service endpoints but does **not** restart it — exactly right for "still warming up". A failing **liveness** probe restarts the container, which would be wrong here and could cause a restart loop while the cache loads. For very slow starts, a `startupProbe` holds off the other probes.',
  },
  {
    id: 'yaml-service-targetport',
    title: 'Fix a Service that points at the wrong port',
    objective: 'co-networking',
    lessonId: 'services',
    kind: 'fix',
    difficulty: 2,
    instructions:
      'The `api` Pods (label `app: api`) run a container that listens on **8080**. Clients should keep calling the Service on port **80**. Requests currently fail with "connection refused". Fix the Service.',
    starter: `apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
  - name: http
    port: 80
    targetPort: 80
`,
    checks: [
      { path: 'kind', op: 'equals', value: 'Service', message: 'kind must stay Service.' },
      { path: 'spec.selector.app', op: 'equals', value: 'api', message: 'The selector must stay app: api.' },
      { path: 'spec.ports[0].port', op: 'equals', value: 80, message: 'Clients call port 80 — keep spec.ports[0].port at 80.' },
      { path: 'spec.ports[0].targetPort', op: 'equals', value: 8080, message: 'targetPort is the port on the Pod. The container listens on 8080, so targetPort must be 8080.' },
    ],
    solution: `apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
  - name: http
    port: 80
    targetPort: 8080
`,
    explanation:
      '`port` is what clients connect to on the Service\'s ClusterIP; `targetPort` is where traffic is forwarded on each Pod. Endpoints still exist here (the selector is fine), so the symptom is "connection refused" rather than "no endpoints". `targetPort` can also be a **named** container port (e.g. `http`), which survives port changes in the Pod spec.',
  },
  {
    id: 'yaml-pvc',
    title: 'Write a PersistentVolumeClaim',
    objective: 'co-storage',
    lessonId: 'persistent-volumes-and-csi',
    kind: 'complete',
    difficulty: 2,
    instructions:
      'Complete the claim so a single-node database can mount it read-write: access mode `ReadWriteOnce`, `5Gi` of storage, StorageClass `standard`.',
    starter: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: db-data
spec:
  resources:
    requests: {}
`,
    checks: [
      { path: 'kind', op: 'equals', value: 'PersistentVolumeClaim', message: 'kind must be PersistentVolumeClaim.' },
      { path: 'spec.accessModes[0]', op: 'equals', value: 'ReadWriteOnce', message: 'spec.accessModes is a list; its first entry should be ReadWriteOnce.' },
      { path: 'spec.resources.requests.storage', op: 'equals', value: '5Gi', message: 'Request 5Gi under spec.resources.requests.storage.' },
      { path: 'spec.storageClassName', op: 'equals', value: 'standard', message: 'Set spec.storageClassName: standard so the right provisioner handles the claim.' },
    ],
    solution: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: db-data
spec:
  accessModes:
  - ReadWriteOnce
  storageClassName: standard
  resources:
    requests:
      storage: 5Gi
`,
    explanation:
      'A PVC is a **request** for storage; the StorageClass\'s provisioner creates a matching PersistentVolume (dynamic provisioning) and binds it. `ReadWriteOnce` means mountable read-write by one **node** at a time (`ReadWriteOncePod` restricts it to a single Pod). Without a matching class or PV, the claim stays `Pending`.',
  },
  {
    id: 'yaml-envfrom-configmap',
    title: 'Load all keys of a ConfigMap as environment variables',
    objective: 'kf-core',
    lessonId: 'configmaps-and-secrets',
    kind: 'fix',
    difficulty: 2,
    instructions:
      'The author tried to import every key of ConfigMap `app-config` as environment variables, but used a field that does not exist. Fix the `envFrom` entry so it references the ConfigMap correctly.',
    starter: `apiVersion: v1
kind: Pod
metadata:
  name: shop-ui
spec:
  containers:
  - name: ui
    image: nginx:1.27
    envFrom:
    - configMap:
        name: app-config
`,
    checks: [
      { path: 'spec.containers[0].envFrom[0].configMap', op: 'absent', message: 'envFrom entries do not have a configMap field — that name belongs to volumes.' },
      { path: 'spec.containers[0].envFrom[0].configMapRef.name', op: 'equals', value: 'app-config', message: 'Use envFrom[0].configMapRef.name: app-config.' },
      { path: 'spec.containers[0].image', op: 'equals', value: 'nginx:1.27', message: 'Keep the image nginx:1.27.' },
    ],
    solution: `apiVersion: v1
kind: Pod
metadata:
  name: shop-ui
spec:
  containers:
  - name: ui
    image: nginx:1.27
    envFrom:
    - configMapRef:
        name: app-config
`,
    explanation:
      'In `envFrom` you use `configMapRef` / `secretRef`; in `env[].valueFrom` you use `configMapKeyRef` / `secretKeyRef`; in `volumes` you use `configMap` / `secret`. Environment variables are read once at container start — editing the ConfigMap later does not change them until the Pod restarts (mounted volumes, by contrast, are refreshed eventually).',
  },
  {
    id: 'yaml-networkpolicy',
    title: 'Allow only the API to reach the database',
    objective: 'co-security',
    lessonId: 'network-policies',
    kind: 'complete',
    difficulty: 3,
    instructions:
      'Complete the NetworkPolicy so that Pods labelled `app: db` accept **ingress** only from Pods labelled `app: api` in the same namespace, on TCP port `5432`.',
    starter: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-allow-api
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  ingress: []
`,
    checks: [
      { path: 'kind', op: 'equals', value: 'NetworkPolicy', message: 'kind must be NetworkPolicy.' },
      { path: 'spec.podSelector.matchLabels.app', op: 'equals', value: 'db', message: 'spec.podSelector selects the Pods the policy protects — it should match app: db, not every Pod ({}).' },
      { path: 'spec.policyTypes[0]', op: 'equals', value: 'Ingress', message: 'policyTypes should contain Ingress.' },
      { path: 'spec.ingress[0].from[0].podSelector.matchLabels.app', op: 'equals', value: 'api', message: 'The allowed source is ingress[0].from[0].podSelector with app: api.' },
      { path: 'spec.ingress[0].ports[0].port', op: 'equals', value: 5432, message: 'Restrict the rule to port 5432 via ingress[0].ports[0].port.' },
      { path: 'spec.ingress[0].ports[0].protocol', op: 'oneOf', value: ['TCP'], message: 'Use protocol TCP for PostgreSQL.' },
    ],
    solution: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-allow-api
spec:
  podSelector:
    matchLabels:
      app: db
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: api
    ports:
    - protocol: TCP
      port: 5432
`,
    explanation:
      'Once any policy selects a Pod for Ingress, that Pod becomes **default-deny** for ingress except what some policy allows. A `podSelector` inside `from` (without a `namespaceSelector`) means "Pods in this policy\'s namespace". NetworkPolicy is only enforced if the CNI plugin supports it (e.g. Calico, Cilium) — otherwise it is silently ignored.',
  },
];
