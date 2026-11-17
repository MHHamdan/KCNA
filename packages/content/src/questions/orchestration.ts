import type { Question, Reference } from '../types';

const R = {
  containers: { title: 'Kubernetes docs: Containers', url: 'https://kubernetes.io/docs/concepts/containers/' },
  images: { title: 'Kubernetes docs: Images', url: 'https://kubernetes.io/docs/concepts/containers/images/' },
  cri: { title: 'Kubernetes docs: Container Runtime Interface (CRI)', url: 'https://kubernetes.io/docs/concepts/architecture/cri/' },
  components: { title: 'Kubernetes docs: Kubernetes Components', url: 'https://kubernetes.io/docs/concepts/overview/components/' },
  dockershim: { title: 'Kubernetes docs: Migrating from dockershim', url: 'https://kubernetes.io/docs/tasks/administer-cluster/migrating-from-dockershim/' },
  cgroups: { title: 'Kubernetes docs: About cgroup v2', url: 'https://kubernetes.io/docs/concepts/architecture/cgroups/' },
  runtimeClass: { title: 'Kubernetes docs: Runtime Class', url: 'https://kubernetes.io/docs/concepts/containers/runtime-class/' },
  oci: { title: 'Open Container Initiative', url: 'https://opencontainers.org/' },
  glossary: { title: 'CNCF Cloud Native Glossary', url: 'https://glossary.cncf.io/' },
  podLifecycle: { title: 'Kubernetes docs: Pod Lifecycle', url: 'https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/' },
  networking: { title: 'Kubernetes docs: Services, Load Balancing, and Networking', url: 'https://kubernetes.io/docs/concepts/services-networking/' },
  clusterNetworking: { title: 'Kubernetes docs: Cluster Networking', url: 'https://kubernetes.io/docs/concepts/cluster-administration/networking/' },
  service: { title: 'Kubernetes docs: Service', url: 'https://kubernetes.io/docs/concepts/services-networking/service/' },
  dns: { title: 'Kubernetes docs: DNS for Services and Pods', url: 'https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/' },
  ingress: { title: 'Kubernetes docs: Ingress', url: 'https://kubernetes.io/docs/concepts/services-networking/ingress/' },
  ingressControllers: { title: 'Kubernetes docs: Ingress Controllers', url: 'https://kubernetes.io/docs/concepts/services-networking/ingress-controllers/' },
  gateway: { title: 'Gateway API', url: 'https://gateway-api.sigs.k8s.io/' },
  netpol: { title: 'Kubernetes docs: Network Policies', url: 'https://kubernetes.io/docs/concepts/services-networking/network-policies/' },
  rbac: { title: 'Kubernetes docs: Using RBAC Authorization', url: 'https://kubernetes.io/docs/reference/access-authn-authz/rbac/' },
  rbacGood: { title: 'Kubernetes docs: Role Based Access Control Good Practices', url: 'https://kubernetes.io/docs/concepts/security/rbac-good-practices/' },
  authn: { title: 'Kubernetes docs: Authenticating', url: 'https://kubernetes.io/docs/reference/access-authn-authz/authentication/' },
  serviceAccounts: { title: 'Kubernetes docs: Service Accounts', url: 'https://kubernetes.io/docs/concepts/security/service-accounts/' },
  pss: { title: 'Kubernetes docs: Pod Security Standards', url: 'https://kubernetes.io/docs/concepts/security/pod-security-standards/' },
  psa: { title: 'Kubernetes docs: Pod Security Admission', url: 'https://kubernetes.io/docs/concepts/security/pod-security-admission/' },
  securityContext: { title: 'Kubernetes docs: Configure a Security Context for a Pod or Container', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/security-context/' },
  secret: { title: 'Kubernetes docs: Secrets', url: 'https://kubernetes.io/docs/concepts/configuration/secret/' },
  secretsGood: { title: 'Kubernetes docs: Good practices for Kubernetes Secrets', url: 'https://kubernetes.io/docs/concepts/security/secrets-good-practices/' },
  encryptAtRest: { title: 'Kubernetes docs: Encrypting Confidential Data at Rest', url: 'https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/' },
  debugPods: { title: 'Kubernetes docs: Debug Pods', url: 'https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/' },
  debug: { title: 'Kubernetes docs: Monitoring, Logging, and Debugging', url: 'https://kubernetes.io/docs/tasks/debug/' },
  kubectl: { title: 'Kubernetes docs: kubectl reference', url: 'https://kubernetes.io/docs/reference/kubectl/' },
  resources: { title: 'Kubernetes docs: Resource Management for Pods and Containers', url: 'https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/' },
  taints: { title: 'Kubernetes docs: Taints and Tolerations', url: 'https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/' },
  probes: { title: 'Kubernetes docs: Configure Liveness, Readiness and Startup Probes', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/' },
  volumes: { title: 'Kubernetes docs: Volumes', url: 'https://kubernetes.io/docs/concepts/storage/volumes/' },
  pv: { title: 'Kubernetes docs: Persistent Volumes', url: 'https://kubernetes.io/docs/concepts/storage/persistent-volumes/' },
  storageClasses: { title: 'Kubernetes docs: Storage Classes', url: 'https://kubernetes.io/docs/concepts/storage/storage-classes/' },
  dynamicProvisioning: { title: 'Kubernetes docs: Dynamic Volume Provisioning', url: 'https://kubernetes.io/docs/concepts/storage/dynamic-provisioning/' },
} satisfies Record<string, Reference>;

export const questionsOrchestration: Question[] = [
  // ───────────────────────── kf-containerization (fundamentals) ─────────────────────────
  {
    id: 'q-kf-containerization-001',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'linux-essentials',
    difficulty: 1,
    type: 'single',
    prompt: 'Which Linux kernel feature does a container runtime use to cap how much CPU and memory a container may consume?',
    choices: ['Control groups (cgroups)', 'Namespaces', 'chroot', 'seccomp profiles'],
    answer: [0],
    explanation:
      'Control groups (cgroups) account for and limit resources such as CPU, memory and process counts. Namespaces control what a process can **see**, while cgroups control how much it can **use**. Kubernetes resource requests and limits are ultimately enforced through cgroups on the node.',
    choiceRationale: [
      'Correct: cgroups are the kernel mechanism that meters and limits CPU, memory and other resources.',
      'Namespaces isolate what a process can see (PIDs, mounts, network), not how much CPU or memory it may use.',
      'chroot only changes the apparent root directory of a process and has no resource accounting.',
      'seccomp filters which system calls a process may make; it does not limit CPU or memory.',
    ],
    references: [R.cgroups, R.containers],
    tags: ['cgroups', 'linux', 'resource-limits'],
  },
  {
    id: 'q-kf-containerization-002',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'linux-essentials',
    difficulty: 2,
    type: 'single',
    prompt:
      'Inside a running container, `ps aux` lists only the container\'s own processes, and the application shows up as PID 1. Which kernel feature produces this view?',
    choices: [
      'Linux capabilities being dropped by the runtime',
      'The pids cgroup controller assigned to the container',
      'A PID namespace created for the container',
      'The overlay filesystem mounted as the container root',
    ],
    answer: [2],
    explanation:
      'A PID namespace gives a group of processes its own process-ID numbering, so the first process inside it is PID 1 and processes outside are invisible. The pids cgroup controller only limits how many processes can exist; it does not hide anything. Namespaces are about visibility, cgroups about consumption.',
    choiceRationale: [
      'Dropping capabilities restricts privileged operations but does not change which processes are visible.',
      'The pids cgroup caps the number of processes; it does not renumber or hide them.',
      'Correct: a PID namespace isolates the process tree and restarts numbering at 1.',
      'The overlay filesystem shapes the file view, not the process list.',
    ],
    references: [R.glossary, R.containers],
    tags: ['namespaces', 'linux', 'isolation'],
  },
  {
    id: 'q-kf-containerization-003',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'linux-essentials',
    difficulty: 2,
    type: 'single',
    prompt:
      'You delete a Pod whose spec does not set `terminationGracePeriodSeconds`. What does the main process in its container receive?',
    choices: [
      'SIGHUP, followed by SIGTERM if the process is still running',
      'SIGKILL immediately, because containers are disposable',
      'SIGINT, followed by SIGQUIT after 10 seconds',
      'SIGTERM, followed by SIGKILL once the 30-second grace period expires',
    ],
    answer: [3],
    explanation:
      'Kubernetes asks the runtime to send the stop signal, which is SIGTERM unless the image defines a different STOPSIGNAL, so the application can shut down cleanly (finish requests, flush data). If the process is still running when the grace period ends (30 seconds by default), it is sent SIGKILL. Applications that ignore SIGTERM therefore always take the full grace period to stop.',
    choiceRationale: [
      'SIGHUP is conventionally a reload signal and is not part of Pod termination.',
      'SIGKILL is only the fallback after the grace period, not the first signal.',
      'Neither SIGINT nor SIGQUIT is used, and the default grace period is 30 seconds, not 10.',
      'Correct: graceful SIGTERM first, then SIGKILL after the default 30-second grace period.',
    ],
    references: [R.podLifecycle],
    tags: ['signals', 'pod-termination', 'linux'],
  },
  {
    id: 'q-kf-containerization-004',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'virtualization-and-containers',
    difficulty: 1,
    type: 'single',
    prompt: 'What is the most fundamental architectural difference between containers and virtual machines?',
    choices: [
      'Containers share the host kernel, while each VM runs its own guest kernel',
      'Containers need a hypervisor such as KVM, while VMs run directly on the kernel',
      'Containers always provide stronger isolation than VMs',
      'Containers bundle a full guest OS, which is why they start faster',
    ],
    answer: [0],
    explanation:
      'Containers are isolated processes on a shared host kernel, using namespaces and cgroups. A VM virtualizes hardware through a hypervisor and boots its own kernel. That is why containers start quickly and are lightweight, and also why their isolation boundary is weaker than a VM\'s.',
    choiceRationale: [
      'Correct: the shared kernel is the defining difference.',
      'This is reversed: VMs rely on a hypervisor, containers do not.',
      'VMs generally offer stronger isolation because they do not share a kernel.',
      'Containers do not ship a guest kernel; they start fast precisely because there is no OS to boot.',
    ],
    references: [R.glossary, R.containers],
    tags: ['containers', 'virtual-machines', 'isolation'],
  },
  {
    id: 'q-kf-containerization-005',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'virtualization-and-containers',
    difficulty: 2,
    type: 'single',
    prompt:
      'Why can a Linux container image not run natively on a Windows kernel without some form of Linux VM underneath?',
    choices: [
      'The OCI image format can only be unpacked on Linux file systems',
      'Container processes make system calls directly to the host kernel, so they need a compatible kernel',
      'Windows has no client that can pull images from an OCI registry',
      'Linux images are compressed with an algorithm that Windows cannot decompress',
    ],
    answer: [1],
    explanation:
      'A container is just a process on the host, so its binaries call the host kernel directly. Linux binaries expect Linux system calls; a Windows kernel does not provide them. Tools that run Linux containers on Windows or macOS do so inside a lightweight Linux VM.',
    choiceRationale: [
      'OCI images are tar archives plus JSON metadata and are not tied to a host file system.',
      'Correct: no guest kernel exists, so the host kernel must match the binaries.',
      'Registry clients exist on every major OS; pulling is not the problem.',
      'Image layers use standard compression such as gzip, which any OS can decompress.',
    ],
    references: [R.containers, R.oci],
    tags: ['containers', 'kernel', 'portability'],
  },
  {
    id: 'q-kf-containerization-006',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'virtualization-and-containers',
    difficulty: 3,
    type: 'multi',
    prompt: 'Which statements about container isolation are accurate? (Select TWO.)',
    choices: [
      'A kernel vulnerability can potentially affect every container on the same host',
      'Each container runs its own separate kernel instance',
      'Sandboxed runtimes such as gVisor or Kata Containers add an extra isolation layer between workloads and the host kernel',
      'A container can never be granted more privileges than an ordinary host process',
      'Namespaces protect a container from noisy neighbors exhausting CPU and memory',
    ],
    answer: [0, 2],
    explanation:
      'Because all containers on a node share one kernel, a kernel exploit can break out of the namespace boundary. Sandboxed runtimes, selectable in Kubernetes via RuntimeClass, add a user-space kernel (gVisor) or a lightweight VM (Kata) to strengthen that boundary. Resource fairness comes from cgroups, not namespaces.',
    choiceRationale: [
      'Correct: the shared kernel is a common attack surface for all containers on the host.',
      'Containers do not have their own kernel; that is what distinguishes them from VMs.',
      'Correct: gVisor and Kata Containers exist precisely to harden this boundary.',
      'Privileged containers and added capabilities can grant near-host-level power.',
      'Resource limits come from cgroups; namespaces only isolate visibility.',
    ],
    references: [R.runtimeClass, R.glossary],
    tags: ['isolation', 'security', 'runtimeclass'],
  },
  {
    id: 'q-kf-containerization-007',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'container-images-and-oci',
    difficulty: 1,
    type: 'single',
    prompt: 'In a reference such as `nginx@sha256:4c0f...`, what does the digest after the `@` represent?',
    choices: [
      'A mutable label such as v1.2 that can be re-pointed to a newer image',
      'The total compressed size of the image layers',
      'A cryptographic signature proving who built the image',
      'A content-addressable hash that identifies the exact image content',
    ],
    answer: [3],
    explanation:
      'A digest is a hash of the image manifest, so it always resolves to exactly the same content. Tags are human-friendly pointers that can be moved to different images over time. Pinning by digest gives reproducible deployments; signatures are a separate concern handled by tools such as Sigstore.',
    choiceRationale: [
      'That describes a tag, which is mutable; a digest is immutable.',
      'Size is recorded in the manifest, but the digest is not a size.',
      'A digest proves integrity of the content, not the identity of the builder.',
      'Correct: the digest is a content hash, so the same digest always means the same image.',
    ],
    references: [R.images, R.oci],
    tags: ['images', 'digests', 'oci'],
  },
  {
    id: 'q-kf-containerization-008',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'container-images-and-oci',
    difficulty: 2,
    type: 'single',
    prompt: `A Dockerfile is ordered like this:

\`\`\`text
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
CMD ["node", "server.js"]
\`\`\`

Why copy the dependency files and run \`npm ci\` before copying the rest of the source?`,
    choices: [
      'So that source-code edits do not invalidate the cached dependency-install layer',
      'Because COPY instructions must always precede RUN instructions',
      'Because it makes the final image contain fewer files',
      'Because the OCI image spec requires dependencies in the lowest layer',
    ],
    answer: [0],
    explanation:
      'Each instruction creates a layer, and a build cache entry is reused only if that instruction and everything before it are unchanged. Dependency manifests change rarely, so `npm ci` stays cached while frequent source edits only rebuild the final `COPY . .` layer. The resulting image has the same files either way; the gain is build speed.',
    choiceRationale: [
      'Correct: ordering from least to most frequently changed maximizes cache reuse.',
      'Dockerfiles have no such rule; RUN and COPY may appear in any order.',
      'Both orderings end up with the same files in the image.',
      'The OCI image spec does not dictate what content goes in which layer.',
    ],
    references: [R.images, R.oci],
    tags: ['dockerfile', 'layers', 'build-cache'],
  },
  {
    id: 'q-kf-containerization-009',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'container-images-and-oci',
    difficulty: 1,
    type: 'single',
    prompt: 'Which three specifications does the Open Container Initiative (OCI) maintain?',
    choices: [
      'Build, Ship, and Run specifications',
      'Container Runtime, Network, and Storage interfaces',
      'Runtime, Image, and Distribution specifications',
      'Image, Scheduling, and Registry specifications',
    ],
    answer: [2],
    explanation:
      'The OCI Runtime Spec defines how to run an unpacked container bundle, the Image Spec defines the image format, and the Distribution Spec defines the registry API for pushing and pulling. These standards let images built by one tool run on any compliant runtime. CRI, CNI and CSI are Kubernetes interfaces, not OCI specs.',
    choiceRationale: [
      '"Build, ship, run" is a marketing slogan, not a set of OCI specs.',
      'CRI, CNI and CSI are Kubernetes plugin interfaces, not OCI specifications.',
      'Correct: Runtime, Image and Distribution are the three OCI specs.',
      'Scheduling is an orchestrator concern and is not standardized by OCI.',
    ],
    references: [R.oci],
    tags: ['oci', 'standards', 'images'],
  },
  {
    id: 'q-kf-containerization-010',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'container-images-and-oci',
    difficulty: 2,
    type: 'single',
    prompt:
      'A container uses `image: registry.example.com/shop/api:latest` and does not set `imagePullPolicy`. Which pull policy does Kubernetes apply?',
    choices: ['Always', 'IfNotPresent', 'Never', 'OnFailure'],
    answer: [0],
    explanation:
      'When the tag is `:latest` or no tag is given, Kubernetes defaults `imagePullPolicy` to `Always`. For any other tag the default is `IfNotPresent`. Because `latest` is mutable, pinning a specific tag or digest is the recommended practice for production.',
    choiceRationale: [
      'Correct: a latest (or missing) tag defaults to Always.',
      'IfNotPresent is the default only for tags other than latest.',
      'Never is only used when explicitly set and requires the image to be pre-loaded on the node.',
      'OnFailure is a Pod restartPolicy value, not an image pull policy.',
    ],
    references: [R.images],
    tags: ['images', 'imagepullpolicy', 'tags'],
  },
  {
    id: 'q-kf-containerization-011',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'container-images-and-oci',
    difficulty: 3,
    type: 'single',
    prompt:
      'An application writes `/var/cache/report.tmp` inside its container (no volume mounted there). The container then crashes and the kubelet restarts it in the same Pod. What happens to the file?',
    choices: [
      'It survives, because writes go into the image\'s top read-only layer',
      'It is pushed to the registry as a new layer on the next pull',
      'It survives until the node reboots, because overlay data lives in RAM',
      'It is gone, because the new container starts with a fresh writable layer',
    ],
    answer: [3],
    explanation:
      'Image layers are read-only; each container gets its own thin writable layer on top. When the kubelet restarts a crashed container, it creates a new container from the image with a new, empty writable layer. Data that must survive restarts belongs in a volume such as emptyDir or a PersistentVolume.',
    choiceRationale: [
      'Image layers are read-only; writes go to a per-container writable layer.',
      'Nothing running in a container is automatically pushed to a registry.',
      'The writable layer is normally on disk, and it is discarded with the old container regardless.',
      'Correct: the restarted container gets a fresh writable layer, so the file is lost.',
    ],
    references: [R.images, R.volumes],
    tags: ['layers', 'ephemeral-storage', 'images'],
  },
  {
    id: 'q-kf-containerization-012',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'node-components',
    difficulty: 1,
    type: 'single',
    prompt: 'What is the Container Runtime Interface (CRI)?',
    choices: [
      'The plugin API the kubelet uses to talk to container runtimes such as containerd and CRI-O',
      'The plugin API that assigns IP addresses to Pods',
      'The protocol registries use to serve OCI images',
      'The plugin API used to attach and mount storage volumes',
    ],
    answer: [0],
    explanation:
      'CRI is a gRPC API between the kubelet and the container runtime. It lets Kubernetes work with any compliant runtime without runtime-specific code in the kubelet. Networking is handled by CNI and storage by CSI.',
    choiceRationale: [
      'Correct: CRI decouples the kubelet from specific runtimes.',
      'That is the Container Network Interface (CNI).',
      'That is the OCI Distribution Specification.',
      'That is the Container Storage Interface (CSI).',
    ],
    references: [R.cri, R.components],
    tags: ['cri', 'kubelet', 'runtimes'],
  },
  {
    id: 'q-kf-containerization-013',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'node-components',
    difficulty: 2,
    type: 'single',
    prompt: 'Which statement accurately describes container runtimes after dockershim was removed in Kubernetes 1.24?',
    choices: [
      'Images produced by `docker build` must be rebuilt before Kubernetes can run them',
      'The kubelet now starts container processes itself without any runtime',
      'Nodes use a CRI-compatible runtime such as containerd or CRI-O, and Docker-built images still run',
      'Docker Engine is still built into the kubelet but disabled by default',
    ],
    answer: [2],
    explanation:
      'Dockershim was the in-tree adapter that let the kubelet drive Docker Engine; it was removed in 1.24. Nodes now use a runtime that implements CRI directly, typically containerd or CRI-O. Images built with Docker are standard OCI images, so they run unchanged.',
    choiceRationale: [
      'Docker builds OCI-compatible images, which containerd and CRI-O run without changes.',
      'The kubelet always delegates to a container runtime through CRI.',
      'Correct: a CRI runtime is required, and existing images keep working.',
      'The dockershim code was removed from the kubelet entirely, not merely disabled.',
    ],
    references: [R.dockershim, R.cri],
    tags: ['dockershim', 'containerd', 'cri-o'],
  },
  {
    id: 'q-kf-containerization-014',
    domain: 'fundamentals',
    objective: 'kf-containerization',
    lessonId: 'node-components',
    difficulty: 2,
    type: 'multi',
    prompt: 'Which of these implement the CRI and can be used directly by the kubelet as the node\'s container runtime? (Select TWO.)',
    choices: ['containerd', 'runc', 'CRI-O', 'kube-proxy', 'Podman'],
    answer: [0, 2],
    explanation:
      'containerd and CRI-O are high-level runtimes that implement the CRI gRPC API. They in turn call a low-level OCI runtime such as runc to actually create the container processes. kube-proxy handles Service networking, and Podman is a standalone container tool rather than a CRI endpoint.',
    choiceRationale: [
      'Correct: containerd ships a CRI plugin and is the most common runtime.',
      'runc is a low-level OCI runtime invoked by containerd or CRI-O, not a CRI server.',
      'Correct: CRI-O was built specifically to implement CRI for Kubernetes.',
      'kube-proxy programs Service networking rules and does not run containers.',
      'Podman is a daemonless container CLI and does not serve the CRI API to the kubelet.',
    ],
    references: [R.cri, R.components],
    tags: ['cri', 'containerd', 'cri-o'],
  },

  // ───────────────────────── co-networking ─────────────────────────
  {
    id: 'q-co-networking-001',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'networking-fundamentals',
    difficulty: 1,
    type: 'single',
    prompt: 'Which transport protocol and port do ordinary DNS queries typically use?',
    choices: ['TCP port 80', 'UDP port 123', 'TCP port 443', 'UDP port 53'],
    answer: [3],
    explanation:
      'Standard DNS queries go over UDP port 53, falling back to TCP port 53 for large responses and zone transfers. In Kubernetes, the cluster DNS Service (CoreDNS) listens on port 53 for both protocols. Port 123 is NTP, and 80/443 are HTTP/HTTPS.',
    choiceRationale: [
      'TCP 80 is plain HTTP.',
      'UDP 123 is NTP, used for time synchronization.',
      'TCP 443 is HTTPS.',
      'Correct: DNS uses port 53, primarily over UDP.',
    ],
    references: [R.dns],
    tags: ['dns', 'ports', 'networking-basics'],
  },
  {
    id: 'q-co-networking-002',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'networking-fundamentals',
    difficulty: 2,
    type: 'single',
    prompt:
      'A Pod with IP `10.244.2.15` calls a public API. The API\'s access log shows the request arriving from the node\'s address, not the Pod IP. Which technique most likely explains this?',
    choices: [
      'Source NAT (masquerading) rewrote the source address to the node\'s IP',
      'The cluster DNS server rewrote the destination hostname',
      'A Layer 7 proxy terminated TLS and re-encrypted the request',
      'ARP replaced the Pod\'s MAC address with the default gateway\'s',
    ],
    answer: [0],
    explanation:
      'Pod IPs usually come from a private range that is not routable on the internet. For egress, the CNI plugin or node commonly applies source NAT (masquerade), so replies return to the node and are translated back to the Pod. Inside the cluster, by contrast, Pods talk to each other without NAT.',
    choiceRationale: [
      'Correct: SNAT/masquerading replaces the private source IP with the node\'s IP.',
      'DNS resolves names; it does not alter packet source addresses.',
      'No L7 proxy is implied, and TLS termination would not explain a node source IP by itself.',
      'ARP works on the local link and does not change the IP address seen by a remote server.',
    ],
    references: [R.clusterNetworking],
    tags: ['nat', 'egress', 'networking-basics'],
  },
  {
    id: 'q-co-networking-003',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'pod-networking-and-cni',
    difficulty: 1,
    type: 'single',
    prompt: 'Which statement reflects the Kubernetes network model?',
    choices: [
      'Pods on different nodes must use NodePort Services to reach each other',
      'Every Pod gets its own IP address and can reach every other Pod without NAT',
      'Each container in a Pod receives a different IP address',
      'Pod IPs are allocated by kube-proxy from the Service CIDR',
    ],
    answer: [1],
    explanation:
      'Kubernetes requires a flat network: each Pod has a unique cluster-wide IP and can talk to any other Pod directly, across nodes, without NAT. Containers in the same Pod share that IP and reach each other on localhost. A CNI plugin implements this model and assigns Pod IPs.',
    choiceRationale: [
      'Pods reach each other directly by Pod IP; Services are for stable access, not a requirement.',
      'Correct: one IP per Pod and NAT-free Pod-to-Pod communication.',
      'Containers in one Pod share a network namespace and therefore one IP.',
      'Pod IPs come from the CNI plugin\'s Pod CIDR; kube-proxy handles Service IPs.',
    ],
    references: [R.clusterNetworking, R.networking],
    tags: ['network-model', 'pods', 'cni'],
  },
  {
    id: 'q-co-networking-004',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'pod-networking-and-cni',
    difficulty: 2,
    type: 'single',
    prompt: `A freshly bootstrapped cluster shows this:

\`\`\`text
$ kubectl get nodes
NAME       STATUS     ROLES           AGE   VERSION
cp-1       NotReady   control-plane   6m    v1.31.2
worker-1   NotReady   <none>          4m    v1.31.2

$ kubectl describe node worker-1 | grep -i network
  Ready  False  ...  KubeletNotReady  container runtime network not ready: NetworkReady=false reason:NetworkPluginNotReady message:Network plugin returns error: cni plugin not initialized
\`\`\`

What is the most likely cause?`,
    choices: [
      'No Ingress controller has been deployed yet',
      'kube-proxy is running in IPVS mode instead of iptables mode',
      'No CNI plugin (for example Calico, Cilium, or Flannel) has been installed',
      'The cluster has no Service of type LoadBalancer',
    ],
    answer: [2],
    explanation:
      'Kubernetes does not ship a Pod network implementation; a CNI plugin must be installed after bootstrapping. Until one is present, the kubelet reports the network as not ready and nodes stay NotReady. Installing a CNI plugin such as Calico, Cilium or Flannel resolves it.',
    choiceRationale: [
      'Ingress controllers handle HTTP routing and do not affect node readiness.',
      'The kube-proxy mode affects Service routing, not whether the Pod network is initialized.',
      'Correct: the message explicitly says the CNI plugin is not initialized.',
      'LoadBalancer Services are optional and unrelated to node readiness.',
    ],
    references: [R.clusterNetworking],
    tags: ['cni', 'troubleshooting', 'node-notready'],
  },
  {
    id: 'q-co-networking-005',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'services',
    difficulty: 1,
    type: 'single',
    prompt: 'If a Service manifest omits `spec.type`, which type does Kubernetes create?',
    choices: ['NodePort', 'LoadBalancer', 'ClusterIP', 'ExternalName'],
    answer: [2],
    explanation:
      'ClusterIP is the default Service type. It gives the Service a stable virtual IP reachable only from inside the cluster. NodePort, LoadBalancer and ExternalName must be requested explicitly.',
    choiceRationale: [
      'NodePort must be set explicitly; it builds on top of a ClusterIP.',
      'LoadBalancer must be set explicitly and needs a cloud or bare-metal load balancer implementation.',
      'Correct: ClusterIP is the default.',
      'ExternalName must be set explicitly and maps the Service to a DNS name.',
    ],
    references: [R.service],
    tags: ['services', 'clusterip', 'defaults'],
  },
  {
    id: 'q-co-networking-006',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'services',
    difficulty: 2,
    type: 'single',
    prompt: `Requests to the \`web\` Service time out. You collect:

\`\`\`text
$ kubectl describe svc web
Name:              web
Namespace:         shop
Selector:          app=web
Type:              ClusterIP
IP:                10.96.41.7
Port:              http  80/TCP
TargetPort:        8080/TCP
Endpoints:         <none>

$ kubectl get pods -n shop --show-labels
NAME                   READY   STATUS    RESTARTS   AGE   LABELS
web-5d8f7c9b6-k2m4x    1/1     Running   0          20m   app=web-frontend,pod-template-hash=5d8f7c9b6
web-5d8f7c9b6-p9t7q    1/1     Running   0          20m   app=web-frontend,pod-template-hash=5d8f7c9b6
\`\`\`

What is the cause?`,
    choices: [
      'kube-proxy must be restarted after a Service is created',
      'ClusterIP Services only get endpoints once an Ingress points at them',
      'The targetPort must equal the Service port for endpoints to appear',
      'The Service selector does not match the labels on the Pods',
    ],
    answer: [3],
    explanation:
      'A Service routes only to ready Pods whose labels match its selector. Here the selector is `app=web` but the Pods carry `app=web-frontend`, so the EndpointSlice is empty. Fixing either the selector or the Pod template labels makes the endpoints appear.',
    choiceRationale: [
      'kube-proxy watches the API continuously; no restart is needed.',
      'Endpoints are populated from the selector, independent of any Ingress.',
      'port and targetPort may differ; that is the point of having both fields.',
      'Correct: `app=web` does not match `app=web-frontend`, so there are no endpoints.',
    ],
    references: [R.service, R.debug],
    tags: ['services', 'selectors', 'troubleshooting'],
  },
  {
    id: 'q-co-networking-007',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'services',
    difficulty: 2,
    type: 'single',
    prompt:
      'A StatefulSet uses a Service with `clusterIP: None`. What does a DNS lookup of that Service name return from inside the cluster?',
    choices: [
      'A single virtual IP that kube-proxy load-balances',
      'The IP addresses of the ready Pods selected by the Service',
      'The IP addresses of the nodes where the Pods run',
      'A CNAME pointing to an external load balancer',
    ],
    answer: [1],
    explanation:
      'Setting `clusterIP: None` creates a headless Service: no virtual IP is allocated and kube-proxy does not handle it. Cluster DNS instead returns A/AAAA records for the selected ready Pods. StatefulSets rely on this to give each Pod a stable DNS name.',
    choiceRationale: [
      'A headless Service has no virtual IP by definition.',
      'Correct: DNS returns the individual Pod IPs.',
      'Node IPs are only relevant for NodePort access, not headless DNS.',
      'CNAME records are returned for ExternalName Services, not headless ones.',
    ],
    references: [R.service, R.dns],
    tags: ['services', 'headless', 'dns'],
  },
  {
    id: 'q-co-networking-008',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'services',
    difficulty: 3,
    type: 'multi',
    prompt: 'Which statements about kube-proxy are accurate? (Select TWO.)',
    choices: [
      'It programs packet-forwarding rules on each node (for example iptables, IPVS, or nftables) so Service IPs reach backend Pods',
      'It assigns IP addresses to Pods when they start',
      'It watches Services and EndpointSlices through the API server',
      'It answers DNS queries that resolve Service names to IPs',
      'It runs only on control-plane nodes',
    ],
    answer: [0, 2],
    explanation:
      'kube-proxy runs on every node (typically as a DaemonSet), watches Services and EndpointSlices, and translates them into local forwarding rules. Pod IP assignment is the CNI plugin\'s job, and name resolution is handled by CoreDNS. Some CNI plugins can replace kube-proxy entirely, but its role stays the same conceptually.',
    choiceRationale: [
      'Correct: kube-proxy implements Service virtual IPs via node-level rules.',
      'Pod IPs are assigned by the CNI plugin.',
      'Correct: it reacts to Service and EndpointSlice changes from the API server.',
      'DNS is served by CoreDNS, not kube-proxy.',
      'kube-proxy runs on every node that hosts Pods, not just the control plane.',
    ],
    references: [R.service, R.components],
    tags: ['kube-proxy', 'services', 'endpointslices'],
  },
  {
    id: 'q-co-networking-009',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'dns-and-coredns',
    difficulty: 1,
    type: 'single',
    prompt:
      'With the default cluster domain, what is the fully qualified DNS name of a Service named `orders` in namespace `shop`?',
    choices: [
      'shop.orders.svc.cluster.local',
      'orders.svc.shop.cluster.local',
      'orders.shop.svc.cluster.local',
      'orders.shop.pod.cluster.local',
    ],
    answer: [2],
    explanation:
      'Service DNS names follow `<service>.<namespace>.svc.<cluster-domain>`, and the default cluster domain is `cluster.local`. CoreDNS serves these records automatically. Shorter forms such as `orders` or `orders.shop` work thanks to the Pod\'s DNS search list.',
    choiceRationale: [
      'The Service name comes first and the namespace second, not the reverse.',
      'The `svc` label follows the namespace, not the Service name.',
      'Correct: service, namespace, `svc`, then the cluster domain.',
      'The `pod` subdomain is used for Pod records, not Service records.',
    ],
    references: [R.dns],
    tags: ['dns', 'coredns', 'services'],
  },
  {
    id: 'q-co-networking-010',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'dns-and-coredns',
    difficulty: 2,
    type: 'single',
    prompt:
      'A Pod in namespace `billing` fails to reach `http://orders`, but `http://orders.shop` works. The `orders` Service lives in namespace `shop`. Why?',
    choices: [
      'CoreDNS is not running in the billing namespace',
      'A short name is resolved using the Pod\'s own namespace first, so `orders` is looked up in billing',
      'Services can only be reached from Pods in the same namespace',
      'The orders Service must be type NodePort to be reachable from other namespaces',
    ],
    answer: [1],
    explanation:
      'A Pod\'s `/etc/resolv.conf` contains search domains starting with `<its-namespace>.svc.cluster.local`. The bare name `orders` therefore expands to `orders.billing.svc.cluster.local`, which does not exist. Adding the namespace (`orders.shop`) or using the full name resolves the right Service.',
    choiceRationale: [
      'CoreDNS runs once for the cluster (in kube-system) and serves every namespace.',
      'Correct: the DNS search path prefers the client Pod\'s own namespace.',
      'Cross-namespace Service access works by default unless a NetworkPolicy blocks it.',
      'ClusterIP Services are reachable from any namespace; NodePort is about external access.',
    ],
    references: [R.dns],
    tags: ['dns', 'namespaces', 'troubleshooting'],
  },
  {
    id: 'q-co-networking-011',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'ingress-and-gateway-api',
    difficulty: 2,
    type: 'single',
    prompt: `You applied an Ingress twelve minutes ago, but no traffic reaches the backend:

\`\`\`text
$ kubectl get ingress -n shop
NAME   CLASS    HOSTS              ADDRESS   PORTS   AGE
shop   <none>   shop.example.com             80      12m
\`\`\`

What is the most likely reason?`,
    choices: [
      'Ingress objects only route to NodePort Services',
      'The Ingress must be created in the kube-system namespace',
      'Ingress requires a NetworkPolicy allowing port 80 first',
      'No Ingress controller is running to implement the Ingress',
    ],
    answer: [3],
    explanation:
      'An Ingress is only a set of routing rules; an Ingress controller (for example ingress-nginx, Traefik, or a cloud controller) must watch it and configure a proxy. Without a controller, nothing populates the ADDRESS column and no traffic is routed. Kubernetes does not ship a controller by default.',
    choiceRationale: [
      'Ingress backends are commonly ClusterIP Services.',
      'Ingresses live in the same namespace as the Services they route to.',
      'Without NetworkPolicies, all traffic is already allowed.',
      'Correct: the empty ADDRESS and no CLASS point to a missing controller.',
    ],
    references: [R.ingress, R.ingressControllers],
    tags: ['ingress', 'ingress-controller', 'troubleshooting'],
  },
  {
    id: 'q-co-networking-012',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'ingress-and-gateway-api',
    difficulty: 3,
    type: 'single',
    prompt:
      'In the Gateway API role model, which resource does a cluster operator create to define listeners (ports, protocols, TLS) that application teams then attach their HTTPRoutes to?',
    choices: ['GatewayClass', 'Gateway', 'HTTPRoute', 'IngressClass'],
    answer: [1],
    explanation:
      'Gateway API splits responsibilities: the infrastructure provider defines a GatewayClass, the cluster operator creates a Gateway with listeners, and application developers create Routes such as HTTPRoute that attach to that Gateway. This role separation is a key improvement over the single Ingress object.',
    choiceRationale: [
      'GatewayClass names the controller implementation; it does not define listeners.',
      'Correct: the Gateway declares listeners that Routes attach to.',
      'HTTPRoute holds the app team\'s routing rules and attaches to a Gateway.',
      'IngressClass belongs to the Ingress API, not Gateway API.',
    ],
    references: [R.gateway],
    tags: ['gateway-api', 'httproute', 'roles'],
  },
  {
    id: 'q-co-networking-013',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'network-policies',
    difficulty: 1,
    type: 'single',
    prompt: 'If no NetworkPolicy selects a Pod, what traffic is that Pod allowed to send and receive?',
    choices: [
      'All ingress and egress traffic is allowed',
      'All traffic is denied until a policy explicitly allows it',
      'Only traffic from Pods in the same namespace is allowed',
      'Only egress traffic is allowed; ingress is denied',
    ],
    answer: [0],
    explanation:
      'Pods are non-isolated by default: everything is allowed in both directions. A Pod becomes isolated for ingress or egress only when a NetworkPolicy selects it for that direction. That is why a "default deny" policy is a common first step.',
    choiceRationale: [
      'Correct: with no selecting policy, Pods accept and send all traffic.',
      'Default deny only applies after you create such a policy.',
      'There is no implicit namespace boundary for network traffic.',
      'Neither direction is restricted by default.',
    ],
    references: [R.netpol],
    tags: ['network-policies', 'defaults', 'isolation'],
  },
  {
    id: 'q-co-networking-014',
    domain: 'orchestration',
    objective: 'co-networking',
    lessonId: 'network-policies',
    difficulty: 3,
    type: 'single',
    prompt: `A cluster uses a CNI plugin that enforces NetworkPolicy. You apply:

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: lockdown
  namespace: payments
spec:
  podSelector: {}
  policyTypes:
  - Ingress
\`\`\`

What is the effect?`,
    choices: [
      'All traffic into and out of every Pod in payments is denied',
      'Nothing changes, because the policy contains no ingress rules',
      'All incoming traffic to every Pod in payments is denied; outgoing traffic is unaffected',
      'Only Pods without any labels in payments are isolated',
    ],
    answer: [2],
    explanation:
      'An empty `podSelector` selects every Pod in the namespace, and listing `Ingress` in `policyTypes` with no ingress rules means nothing is allowed in. Egress is not listed, so outbound traffic is unchanged. This is the standard default-deny-ingress pattern.',
    choiceRationale: [
      'Egress is only restricted if `Egress` appears in policyTypes.',
      'An isolating policy with no allow rules denies everything for that direction.',
      'Correct: default-deny ingress for all Pods in the namespace.',
      '`podSelector: {}` matches all Pods, labeled or not.',
    ],
    references: [R.netpol],
    tags: ['network-policies', 'default-deny', 'yaml'],
  },

  // ───────────────────────── co-security ─────────────────────────
  {
    id: 'q-co-security-001',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'authentication-authorization-rbac',
    difficulty: 1,
    type: 'single',
    prompt: 'What is the key difference between a Role and a ClusterRole?',
    choices: [
      'A Role is for human users, while a ClusterRole is for ServiceAccounts',
      'A Role grants permissions within one namespace; a ClusterRole is not namespaced and can cover cluster-scoped resources',
      'A ClusterRole can only be bound with a ClusterRoleBinding',
      'A Role can contain deny rules, while a ClusterRole cannot',
    ],
    answer: [1],
    explanation:
      'A Role lives in a namespace and grants access only there. A ClusterRole is cluster-wide and can grant access to cluster-scoped resources such as nodes, or be reused across namespaces. A ClusterRole can be bound with a RoleBinding to grant its permissions in a single namespace.',
    choiceRationale: [
      'Both kinds can be bound to users, groups or ServiceAccounts.',
      'Correct: scope is the difference.',
      'A RoleBinding may reference a ClusterRole to grant it within one namespace.',
      'RBAC has no deny rules at all; permissions are purely additive.',
    ],
    references: [R.rbac],
    tags: ['rbac', 'role', 'clusterrole'],
  },
  {
    id: 'q-co-security-002',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'authentication-authorization-rbac',
    difficulty: 2,
    type: 'single',
    prompt:
      'A user can delete Secrets in namespace `prod` through a RoleBinding to the `edit` ClusterRole. Security asks you to block that one action while keeping their other permissions. How do you achieve this with RBAC?',
    choices: [
      'Add a second Role containing a `deny` verb for secrets',
      'Create a NetworkPolicy that blocks the user from the API server',
      'Set `automountServiceAccountToken: false` in the namespace',
      'Replace the binding with a narrower Role that omits delete on secrets, since RBAC permissions are only additive',
    ],
    answer: [3],
    explanation:
      'RBAC rules can only grant permissions; there is no deny. To remove a permission, you must remove or narrow the binding that grants it, for example by binding a custom Role that lists only the needed verbs. Least privilege therefore starts with granting little, not subtracting later.',
    choiceRationale: [
      'RBAC has no deny verb; such a rule would grant nothing and remove nothing.',
      'NetworkPolicies control Pod traffic, not user API requests.',
      'That setting affects token mounting in Pods, not a human user\'s permissions.',
      'Correct: because RBAC is additive, you must narrow what is granted.',
    ],
    references: [R.rbac, R.rbacGood],
    tags: ['rbac', 'least-privilege', 'additive'],
  },
  {
    id: 'q-co-security-003',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'authentication-authorization-rbac',
    difficulty: 2,
    type: 'single',
    prompt: `The ServiceAccount \`deployer\` in namespace \`ci\` has a RoleBinding (in \`ci\`) to a Role \`pod-reader\` that allows get and list on pods. Yet:

\`\`\`text
$ kubectl auth can-i list pods --as=system:serviceaccount:ci:deployer -n staging
no
\`\`\`

Why?`,
    choices: [
      'ServiceAccounts can never list Pods; only users can',
      'The `pod-reader` Role must use the verb `watch` instead of `list`',
      'A RoleBinding only grants access in its own namespace, so nothing grants access in staging',
      'The `--as` flag ignores RoleBindings and only checks ClusterRoleBindings',
    ],
    answer: [2],
    explanation:
      'Roles and RoleBindings are namespaced; a binding in `ci` grants permissions only in `ci`. To allow the account in `staging`, create a RoleBinding in `staging` (pointing to a Role there or to a ClusterRole). `kubectl auth can-i` with `--as` is a convenient way to verify this.',
    choiceRationale: [
      'ServiceAccounts can be granted any permission through bindings.',
      'list is the correct verb for listing; watch is a separate verb.',
      'Correct: the grant exists only in the ci namespace.',
      'Impersonation evaluates all bindings, namespaced and cluster-wide.',
    ],
    references: [R.rbac, R.kubectl],
    tags: ['rbac', 'serviceaccounts', 'namespaces'],
  },
  {
    id: 'q-co-security-004',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'authentication-authorization-rbac',
    difficulty: 1,
    type: 'single',
    prompt: 'How does an application running in a Pod normally authenticate to the Kubernetes API server?',
    choices: [
      'With a ServiceAccount token that the kubelet projects into the Pod',
      'With the node\'s administrator kubeconfig copied into the container',
      'With a username and password stored in the container image',
      'With the kubelet\'s client certificate shared through the Pod network',
    ],
    answer: [0],
    explanation:
      'Every Pod runs as a ServiceAccount (`default` if none is set), and a short-lived token for it is mounted into the Pod. The API server authenticates the token and RBAC then authorizes what that ServiceAccount may do. Embedding credentials in images or reusing node credentials would break least privilege.',
    choiceRationale: [
      'Correct: Pods authenticate as their ServiceAccount via a projected token.',
      'Copying admin credentials into a container would be a serious security flaw.',
      'Credentials baked into images are insecure and not how Kubernetes works.',
      'The kubelet\'s credentials belong to the node identity and are not shared with Pods.',
    ],
    references: [R.serviceAccounts, R.authn],
    tags: ['serviceaccounts', 'authentication', 'tokens'],
  },
  {
    id: 'q-co-security-005',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'authentication-authorization-rbac',
    difficulty: 3,
    type: 'multi',
    prompt: 'Which statements about Kubernetes identities are accurate? (Select TWO.)',
    choices: [
      'Authorization runs before authentication for every API request',
      'There is no User object; normal users are identified by external means such as client certificates or OIDC tokens',
      'Every RoleBinding must reference a ClusterRole',
      'ServiceAccounts are namespaced objects created and managed through the Kubernetes API',
      'Tokens issued to Pods through the TokenRequest API never expire',
    ],
    answer: [1, 3],
    explanation:
      'Kubernetes does not store human users; it trusts identities asserted by authenticators such as X.509 certificates or OIDC. ServiceAccounts, in contrast, are real namespaced API objects intended for workloads. Requests flow through authentication, then authorization, then admission control.',
    choiceRationale: [
      'The order is authentication first, then authorization.',
      'Correct: users come from external identity sources, not a Kubernetes object.',
      'A RoleBinding may reference either a Role or a ClusterRole.',
      'Correct: ServiceAccounts are namespaced API resources.',
      'TokenRequest tokens are time-bound and bound to the Pod, so they expire.',
    ],
    references: [R.authn, R.serviceAccounts],
    tags: ['authentication', 'serviceaccounts', 'users'],
  },
  {
    id: 'q-co-security-006',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'pod-security-and-least-privilege',
    difficulty: 1,
    type: 'single',
    prompt: 'PodSecurityPolicy was removed in Kubernetes 1.25. What is the built-in replacement?',
    choices: [
      'NetworkPolicy objects applied per namespace',
      'A ClusterRole named `psp` bound to every ServiceAccount',
      'Pod Security Admission, which enforces the Pod Security Standards per namespace',
      'SecurityContextConstraints objects',
    ],
    answer: [2],
    explanation:
      'Pod Security Admission is a built-in admission controller that applies the Pod Security Standards (Privileged, Baseline, Restricted) based on namespace labels. It is simpler than PodSecurityPolicy and has no per-Pod policy objects. Teams needing finer rules add policy engines such as Kyverno or OPA Gatekeeper.',
    choiceRationale: [
      'NetworkPolicies control traffic, not Pod security settings.',
      'No such built-in ClusterRole exists; RBAC was only how PSPs were authorized.',
      'Correct: Pod Security Admission is the in-tree successor.',
      'SecurityContextConstraints are an OpenShift feature, not upstream Kubernetes.',
    ],
    references: [R.psa, R.pss],
    tags: ['pod-security-admission', 'psp', 'admission'],
  },
  {
    id: 'q-co-security-007',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'pod-security-and-least-privilege',
    difficulty: 1,
    type: 'single',
    prompt: 'What are the three policy levels defined by the Pod Security Standards?',
    choices: [
      'Privileged, Baseline, and Restricted',
      'Enforce, Audit, and Warn',
      'Low, Medium, and High',
      'Open, Default, and Locked',
    ],
    answer: [0],
    explanation:
      'Privileged is unrestricted, Baseline blocks known privilege escalations, and Restricted applies current hardening best practices. Enforce, Audit and Warn are the Pod Security Admission **modes** that decide what happens when a Pod violates a level. Mixing up levels and modes is a common mistake.',
    choiceRationale: [
      'Correct: Privileged, Baseline, Restricted.',
      'These are the admission modes, not the policy levels.',
      'These are not names used by the Pod Security Standards.',
      'These are not names used by the Pod Security Standards.',
    ],
    references: [R.pss, R.psa],
    tags: ['pod-security-standards', 'levels', 'admission'],
  },
  {
    id: 'q-co-security-008',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'pod-security-and-least-privilege',
    difficulty: 2,
    type: 'single',
    prompt: `The namespace is labeled \`pod-security.kubernetes.io/enforce: restricted\`. Creating a Pod fails:

\`\`\`text
Error from server (Forbidden): error when creating "web.yaml": pods "web" is forbidden:
violates PodSecurity "restricted:latest": allowPrivilegeEscalation != false
(container "web" must set securityContext.allowPrivilegeEscalation=false),
runAsNonRoot != true (pod or container "web" must set securityContext.runAsNonRoot=true)
\`\`\`

Which change addresses these violations?`,
    choices: [
      'Set `privileged: true` so the admission controller trusts the container',
      'Bind the Pod\'s ServiceAccount to the `cluster-admin` ClusterRole',
      'Create a PodSecurityPolicy that allows the Pod',
      'Set `allowPrivilegeEscalation: false` and `runAsNonRoot: true` in the securityContext',
    ],
    answer: [3],
    explanation:
      'Pod Security Admission checks the Pod spec itself, so the fix is to harden the securityContext as the message describes. The image must also actually run as a non-root user for `runAsNonRoot` to succeed at runtime. RBAC permissions do not exempt a Pod from Pod Security Standards.',
    choiceRationale: [
      'Privileged containers are forbidden by both Baseline and Restricted.',
      'RBAC controls API access; it does not change how Pod specs are evaluated.',
      'PodSecurityPolicy was removed in 1.25 and no longer exists.',
      'Correct: these two settings satisfy exactly the reported violations.',
    ],
    references: [R.pss, R.securityContext],
    tags: ['pod-security-admission', 'securitycontext', 'troubleshooting'],
  },
  {
    id: 'q-co-security-009',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'pod-security-and-least-privilege',
    difficulty: 2,
    type: 'multi',
    prompt: 'Which Pod spec settings move a workload toward least privilege? (Select TWO.)',
    choices: [
      '`readOnlyRootFilesystem: true` in the container securityContext',
      '`privileged: true` in the container securityContext',
      '`capabilities: { drop: ["ALL"] }` in the container securityContext',
      '`hostNetwork: true` in the Pod spec',
      '`runAsUser: 0` in the Pod securityContext',
    ],
    answer: [0, 2],
    explanation:
      'A read-only root filesystem stops attackers from modifying binaries or dropping tools, and dropping all capabilities removes kernel privileges the app rarely needs. Privileged mode, host networking and running as UID 0 all expand what a compromised container can do. Add back only the specific capabilities an app genuinely requires.',
    choiceRationale: [
      'Correct: prevents writes to the container\'s root filesystem.',
      'Privileged mode grants almost full access to the host.',
      'Correct: removes every Linux capability; add back only the ones the app needs.',
      'Host networking exposes the node\'s network stack to the Pod.',
      'UID 0 is root, which increases the impact of a compromise.',
    ],
    references: [R.securityContext, R.pss],
    tags: ['securitycontext', 'least-privilege', 'capabilities'],
  },
  {
    id: 'q-co-security-010',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'configmaps-and-secrets',
    difficulty: 2,
    type: 'multi',
    prompt:
      'By default, Secret values are only base64-encoded in the API and are stored unencrypted in etcd. Which measures actually improve their protection? (Select TWO.)',
    choices: [
      'Base64-encode each value a second time before creating the Secret',
      'Enable encryption at rest for Secrets on the API server',
      'Move the values into a ConfigMap so they are hidden from `kubectl get`',
      'Restrict get, list, and watch on Secrets with least-privilege RBAC',
    ],
    answer: [1, 3],
    explanation:
      'Base64 is an encoding, not encryption, so anyone who can read the object or etcd can recover the values. Encryption at rest protects etcd data and backups, and tight RBAC limits who can read Secrets via the API. External secret stores are a further option for sensitive environments.',
    choiceRationale: [
      'Double encoding is still trivially reversible and adds no security.',
      'Correct: encryption at rest protects Secret data stored in etcd.',
      'ConfigMaps are intended for non-sensitive data and are fully visible.',
      'Correct: RBAC controls who can read Secrets through the API.',
    ],
    references: [R.secretsGood, R.encryptAtRest],
    tags: ['secrets', 'encryption-at-rest', 'rbac'],
  },
  {
    id: 'q-co-security-011',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'configmaps-and-secrets',
    difficulty: 1,
    type: 'single',
    prompt: `A developer commits this Secret manifest to a shared Git repository, saying it is safe because the value is "encoded":

\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-creds
type: Opaque
data:
  password: czNjcjN0IQ==
\`\`\`

What is the problem?`,
    choices: [
      'None; base64 values can only be decoded by the API server',
      'The manifest is invalid because `data` values must be plaintext',
      'None; Kubernetes rotates the value automatically when it is applied',
      'Anyone with repository access can decode it with `base64 -d`, so it is effectively plaintext',
    ],
    answer: [3],
    explanation:
      'Base64 is a reversible encoding meant for transporting bytes, not for confidentiality. Committing this file exposes the password to everyone with repo access, including history forever. Use tools that encrypt secrets for Git or sync from an external secret manager instead.',
    choiceRationale: [
      'Any base64 tool decodes the value; no key is involved.',
      '`data` must be base64-encoded; plaintext belongs in `stringData`.',
      'Kubernetes never rotates Secret values on its own.',
      'Correct: base64 offers no confidentiality.',
    ],
    references: [R.secret, R.secretsGood],
    tags: ['secrets', 'base64', 'gitops'],
  },
  {
    id: 'q-co-security-012',
    domain: 'orchestration',
    objective: 'co-security',
    lessonId: 'configmaps-and-secrets',
    difficulty: 3,
    type: 'single',
    prompt:
      'A user has no `get` or `list` permission on Secrets in namespace `app`, but can create Pods there. Can they read the Secrets in `app`?',
    choices: [
      'No; RBAC on the secrets resource blocks every access path',
      'Yes; they can create a Pod that mounts the Secret and read it from inside the container',
      'Only if the Secret has type `kubernetes.io/basic-auth`',
      'Only if encryption at rest is disabled on the API server',
    ],
    answer: [1],
    explanation:
      'The ability to create Pods in a namespace implies indirect access to its Secrets, because a Pod can reference any Secret in its namespace as a volume or environment variable. Kubernetes security guidance calls this out explicitly. Treat Pod-creation rights as sensitive and isolate secrets by namespace.',
    choiceRationale: [
      'RBAC on secrets does not stop a Pod from mounting them.',
      'Correct: creating a Pod that consumes the Secret exposes its value.',
      'The Secret type does not affect whether a Pod can mount it.',
      'Encryption at rest protects etcd storage, not access through Pods.',
    ],
    references: [R.secretsGood, R.rbacGood],
    tags: ['secrets', 'rbac', 'privilege-escalation'],
  },

  // ───────────────────────── co-troubleshooting ─────────────────────────
  {
    id: 'q-co-troubleshooting-001',
    domain: 'orchestration',
    objective: 'co-troubleshooting',
    lessonId: 'troubleshooting-workloads',
    difficulty: 1,
    type: 'single',
    prompt: 'A Pod has been in `Pending` for several minutes. Which command is the best first step to find out why?',
    choices: [
      '`kubectl logs <pod>`',
      '`kubectl exec -it <pod> -- sh`',
      '`kubectl describe pod <pod>` and read the Events section',
      '`kubectl rollout undo deployment/<name>`',
    ],
    answer: [2],
    explanation:
      'A Pending Pod usually has not been scheduled or its containers have not started, so there are no logs and nothing to exec into. `kubectl describe pod` shows events such as FailedScheduling with the exact reason. Gather evidence before taking corrective actions like rollbacks.',
    choiceRationale: [
      'No container is running yet, so there are no logs to read.',
      'You cannot exec into a container that has not started.',
      'Correct: events explain scheduling and startup problems.',
      'Rolling back without evidence may not address the cause at all.',
    ],
    references: [R.debugPods],
    tags: ['pending', 'kubectl-describe', 'events'],
  },
  {
    id: 'q-co-troubleshooting-002',
    domain: 'orchestration',
    objective: 'co-troubleshooting',
    lessonId: 'troubleshooting-workloads',
    difficulty: 1,
    type: 'single',
    prompt: `A new release will not start:

\`\`\`text
$ kubectl get pods
NAME                  READY   STATUS             RESTARTS   AGE
api-6f9c8d7b5-q2xkz   0/1     ImagePullBackOff   0          4m

$ kubectl describe pod api-6f9c8d7b5-q2xkz | tail -3
  Warning  Failed   2m   kubelet  Failed to pull image "registry.example.com/api:v2.4.l": not found
  Warning  Failed   2m   kubelet  Error: ErrImagePull
  Normal   BackOff  1m   kubelet  Back-off pulling image "registry.example.com/api:v2.4.l"
\`\`\`

What is the most likely cause?`,
    choices: [
      'The image reference is wrong: the tag `v2.4.l` does not exist in the registry',
      'The container exceeded its memory limit during startup',
      'The liveness probe is failing and the kubelet keeps restarting it',
      'No node has enough free CPU to run the Pod',
    ],
    answer: [0],
    explanation:
      'ImagePullBackOff means the kubelet repeatedly failed to pull the image and is backing off between attempts. The event says "not found", and the tag `v2.4.l` looks like a typo for `v2.4.1`. Other common causes are a missing registry credential (imagePullSecrets) or an unreachable registry.',
    choiceRationale: [
      'Correct: the registry reports that this image reference does not exist.',
      'Memory problems show up as OOMKilled after the container has started.',
      'Probes run only after the container starts, which it never did.',
      'CPU shortages leave a Pod Pending with a FailedScheduling event.',
    ],
    references: [R.debugPods, R.images],
    tags: ['imagepullbackoff', 'images', 'events'],
  },
  {
    id: 'q-co-troubleshooting-003',
    domain: 'orchestration',
    objective: 'co-troubleshooting',
    lessonId: 'troubleshooting-workloads',
    difficulty: 2,
    type: 'single',
    prompt:
      'Pod `api-7d9c-xk2lp` is in `CrashLoopBackOff`. The current container instance exits too quickly to show useful output. Which command shows the logs of the instance that just crashed?',
    choices: [
      '`kubectl get pod api-7d9c-xk2lp -o wide`',
      '`kubectl top pod api-7d9c-xk2lp`',
      '`kubectl rollout status deployment/api`',
      '`kubectl logs api-7d9c-xk2lp --previous`',
    ],
    answer: [3],
    explanation:
      'CrashLoopBackOff means the container keeps exiting and the kubelet waits longer between restarts. `kubectl logs --previous` (or `-p`) prints the output of the last terminated instance, which usually contains the startup error. Pair it with `kubectl describe pod` to see the exit code.',
    choiceRationale: [
      'This shows node and IP placement, not application output.',
      'This shows resource usage and requires metrics-server; it has no logs.',
      'This reports rollout progress, not why a container crashed.',
      'Correct: `--previous` returns logs from the prior container instance.',
    ],
    references: [R.debugPods, R.kubectl],
    tags: ['crashloopbackoff', 'kubectl-logs', 'debugging'],
  },
  {
    id: 'q-co-troubleshooting-004',
    domain: 'orchestration',
    objective: 'co-troubleshooting',
    lessonId: 'troubleshooting-workloads',
    difficulty: 2,
    type: 'single',
    prompt: `A worker Pod keeps restarting. Part of \`kubectl describe pod\`:

\`\`\`text
    State:          Running
      Started:      Tue, 10 Nov 2026 09:14:02 +0000
    Last State:     Terminated
      Reason:       OOMKilled
      Exit Code:    137
    Restart Count:  6
    Limits:
      memory:  256Mi
\`\`\`

What is happening?`,
    choices: [
      'The image cannot be pulled, so the kubelet retries it',
      'The container exceeded its 256Mi memory limit and was killed',
      'The readiness probe failed, so the kubelet restarted the container',
      'The node ran out of disk space and evicted the Pod',
    ],
    answer: [1],
    explanation:
      'OOMKilled with exit code 137 (128 + SIGKILL) means the kernel killed the process for exceeding its memory cgroup limit. Fix it by raising the limit to match real usage or by reducing the application\'s memory consumption. Evictions and image problems look different in describe output.',
    choiceRationale: [
      'Pull failures show ErrImagePull or ImagePullBackOff, not a terminated container.',
      'Correct: OOMKilled means the memory limit was exceeded.',
      'Failing readiness probes never restart containers.',
      'A disk-pressure eviction marks the Pod as Failed with reason Evicted, not OOMKilled.',
    ],
    references: [R.resources, R.debugPods],
    tags: ['oomkilled', 'resource-limits', 'restarts'],
  },
  {
    id: 'q-co-troubleshooting-005',
    domain: 'orchestration',
    objective: 'co-troubleshooting',
    lessonId: 'troubleshooting-workloads',
    difficulty: 3,
    type: 'single',
    prompt: `A Pod stays Pending:

\`\`\`text
Events:
  Type     Reason            Age   From               Message
  Warning  FailedScheduling  45s   default-scheduler  0/3 nodes are available: 1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }, 2 Insufficient memory.
\`\`\`

Which action is the most appropriate fix?`,
    choices: [
      'Increase the container\'s memory limit',
      'Restart the kubelet on both worker nodes',
      'Lower the Pod\'s memory request or add nodes with more allocatable memory',
      'Remove the taint from both worker nodes',
    ],
    answer: [2],
    explanation:
      'The scheduler places Pods based on **requests**: both workers lack enough unreserved memory for this Pod\'s request, and the control-plane node is excluded by its taint. Reducing the request to a realistic value or adding capacity lets the Pod fit. Workloads normally should not be forced onto control-plane nodes.',
    choiceRationale: [
      'A higher limit does not help scheduling; it would not reduce the request.',
      'Restarting the kubelet does not free memory reserved by other Pods\' requests.',
      'Correct: scheduling depends on requests fitting allocatable memory.',
      'The workers are rejected for insufficient memory, not because of taints.',
    ],
    references: [R.resources, R.taints],
    tags: ['pending', 'scheduling', 'resource-requests'],
  },
  {
    id: 'q-co-troubleshooting-006',
    domain: 'orchestration',
    objective: 'co-troubleshooting',
    lessonId: 'health-probes',
    difficulty: 2,
    type: 'single',
    prompt: 'A container\'s readiness probe starts failing while its liveness probe keeps passing. What happens?',
    choices: [
      'The kubelet restarts the container',
      'The Pod is removed from Service endpoints, but the container keeps running',
      'The Pod is evicted and rescheduled on another node',
      'The owning Deployment automatically rolls back',
    ],
    answer: [1],
    explanation:
      'Readiness controls whether a Pod receives traffic: a failing readiness probe marks it not ready and removes it from Service endpoints. Only a failing liveness probe causes a restart. This lets an overloaded or warming-up Pod stop taking traffic without being killed.',
    choiceRationale: [
      'Restarts are triggered by liveness failures, not readiness failures.',
      'Correct: readiness only gates traffic.',
      'Probes never move Pods to other nodes.',
      'Deployments do not roll back automatically on probe failures.',
    ],
    references: [R.probes, R.podLifecycle],
    tags: ['readiness-probe', 'services', 'probes'],
  },
  {
    id: 'q-co-troubleshooting-007',
    domain: 'orchestration',
    objective: 'co-troubleshooting',
    lessonId: 'health-probes',
    difficulty: 3,
    type: 'single',
    prompt: `A Java service needs about 90 seconds to start. Its Pod never becomes ready and keeps restarting:

\`\`\`text
Events:
  Warning  Unhealthy  20s  kubelet  Liveness probe failed: Get "http://10.244.1.17:8080/healthz": dial tcp 10.244.1.17:8080: connect: connection refused
  Normal   Killing    20s  kubelet  Container app failed liveness probe, will be restarted
\`\`\`

What is the best fix?`,
    choices: [
      'Remove the readiness probe so traffic arrives sooner',
      'Set `restartPolicy: Never` in the Deployment\'s Pod template',
      'Increase the Deployment\'s replica count',
      'Add a startupProbe so liveness checks only begin after the app has started',
    ],
    answer: [3],
    explanation:
      'The liveness probe kills the container before it finishes starting, so it never gets the chance to become healthy. A startupProbe disables liveness and readiness checks until it succeeds, giving slow starters time without weakening ongoing liveness checks. A longer `initialDelaySeconds` also works but is less precise.',
    choiceRationale: [
      'Readiness is not what kills the container; liveness is.',
      'Deployments only allow `restartPolicy: Always`, and that would not fix the probe anyway.',
      'More replicas would all fail the same way.',
      'Correct: a startupProbe protects slow-starting containers from liveness kills.',
    ],
    references: [R.probes],
    tags: ['startup-probe', 'liveness-probe', 'restarts'],
  },
  {
    id: 'q-co-troubleshooting-008',
    domain: 'orchestration',
    objective: 'co-troubleshooting',
    lessonId: 'health-probes',
    difficulty: 1,
    type: 'multi',
    prompt: 'Which of the following are valid probe handler types in a Kubernetes container spec? (Select TWO.)',
    choices: ['httpGet', 'icmpPing', 'tcpSocket', 'dnsLookup'],
    answer: [0, 2],
    explanation:
      'Kubernetes probes support `exec`, `httpGet`, `tcpSocket` and `grpc` handlers. An HTTP status of 200–399 or a successful TCP connection counts as success. There is no built-in ICMP or DNS probe type.',
    choiceRationale: [
      'Correct: httpGet checks an HTTP endpoint.',
      'Kubernetes has no ICMP ping probe.',
      'Correct: tcpSocket checks that a port accepts connections.',
      'There is no DNS lookup probe handler.',
    ],
    references: [R.probes],
    tags: ['probes', 'httpget', 'tcpsocket'],
  },

  // ───────────────────────── co-storage ─────────────────────────
  {
    id: 'q-co-storage-001',
    domain: 'orchestration',
    objective: 'co-storage',
    lessonId: 'volumes',
    difficulty: 2,
    type: 'single',
    prompt: 'How long does the data in an `emptyDir` volume last?',
    choices: [
      'Until any container in the Pod restarts',
      'As long as the Pod exists on its node; it survives container restarts but is deleted with the Pod',
      'Until the PersistentVolumeClaim that backs it is deleted',
      'Indefinitely, because the data is stored in etcd',
    ],
    answer: [1],
    explanation:
      'An emptyDir is created when a Pod is assigned to a node and is removed when that Pod is removed. Container crashes and restarts do not clear it. It is useful for scratch space and for sharing files between containers, but not for durable data.',
    choiceRationale: [
      'emptyDir is tied to the Pod, so it outlives container restarts.',
      'Correct: Pod lifetime, not container lifetime.',
      'emptyDir is not backed by a PVC.',
      'Volume data is never stored in etcd.',
    ],
    references: [R.volumes],
    tags: ['emptydir', 'volumes', 'ephemeral'],
  },
  {
    id: 'q-co-storage-002',
    domain: 'orchestration',
    objective: 'co-storage',
    lessonId: 'volumes',
    difficulty: 2,
    type: 'single',
    prompt: 'Why is a `hostPath` volume generally discouraged for application workloads?',
    choices: [
      'It stores files in etcd and bloats the cluster database',
      'It only supports the ReadWriteMany access mode',
      'It requires installing a dedicated CSI driver',
      'It exposes the node\'s filesystem to the Pod and ties the data to a single node',
    ],
    answer: [3],
    explanation:
      'hostPath mounts a path from the node into the Pod, which can let a compromised container read or alter host files. The data also stays on that one node, so a rescheduled Pod will not find it. It is mainly for node-level system agents; the Baseline Pod Security Standard forbids it.',
    choiceRationale: [
      'hostPath data lives on the node\'s disk, not in etcd.',
      'Access modes apply to PersistentVolumes; hostPath has no such restriction.',
      'hostPath is built in and needs no CSI driver.',
      'Correct: security exposure and node affinity of data are the core problems.',
    ],
    references: [R.volumes, R.pss],
    tags: ['hostpath', 'volumes', 'security'],
  },
  {
    id: 'q-co-storage-003',
    domain: 'orchestration',
    objective: 'co-storage',
    lessonId: 'volumes',
    difficulty: 1,
    type: 'single',
    prompt:
      'A Pod has an app container that writes log files and a sidecar container that ships them. What is the simplest way for both containers to see the same files?',
    choices: [
      'Mount the same emptyDir volume into both containers',
      'Create a separate PersistentVolumeClaim for each container',
      'Have the app write to a ConfigMap that the sidecar reads',
      'Do nothing, because containers in a Pod share one root filesystem',
    ],
    answer: [0],
    explanation:
      'Containers in a Pod share network and volumes, but each has its own root filesystem. Declaring one emptyDir volume and mounting it into both containers gives them a shared directory for the Pod\'s lifetime. ConfigMaps are read-only configuration, not a data exchange channel.',
    choiceRationale: [
      'Correct: a shared emptyDir is the standard pattern.',
      'Two separate claims would give each container different storage.',
      'ConfigMaps are mounted read-only and are not meant for runtime data.',
      'Each container has its own root filesystem built from its own image.',
    ],
    references: [R.volumes],
    tags: ['emptydir', 'sidecar', 'volumes'],
  },
  {
    id: 'q-co-storage-004',
    domain: 'orchestration',
    objective: 'co-storage',
    lessonId: 'persistent-volumes-and-csi',
    difficulty: 1,
    type: 'single',
    prompt: 'What is the relationship between a PersistentVolume (PV) and a PersistentVolumeClaim (PVC)?',
    choices: [
      'A PV is a request for storage and a PVC is the actual disk',
      'They are two names for the same object in different API versions',
      'A PV represents actual storage in the cluster, and a PVC is a namespaced request that binds to a suitable PV',
      'A PVC is created by the kubelet when a Pod starts, and a PV is created by the user',
    ],
    answer: [2],
    explanation:
      'A PV is a cluster-scoped resource representing a piece of storage, provisioned by an admin or dynamically. A PVC is a namespaced request for a size and access mode; Kubernetes binds it to a matching PV. Pods reference the PVC, which keeps them independent of storage details.',
    choiceRationale: [
      'This reverses the roles of the two objects.',
      'They are distinct kinds with different purposes.',
      'Correct: PV is the supply, PVC is the demand.',
      'Users (or StatefulSet templates) create PVCs; the kubelet does not.',
    ],
    references: [R.pv],
    tags: ['pv', 'pvc', 'binding'],
  },
  {
    id: 'q-co-storage-005',
    domain: 'orchestration',
    objective: 'co-storage',
    lessonId: 'persistent-volumes-and-csi',
    difficulty: 2,
    type: 'single',
    prompt: 'What enables a PersistentVolume to be created automatically when a user creates a PVC?',
    choices: [
      'An administrator pre-creating a PV for every possible claim',
      'A StorageClass whose provisioner creates a matching PV on demand',
      'A hostPath volume declared in the Pod spec',
      'A ConfigMap that lists the available disks',
    ],
    answer: [1],
    explanation:
      'Dynamic provisioning uses a StorageClass: when a PVC references it (or the default class applies), the class\'s provisioner, usually a CSI driver, creates the backing volume and its PV. This removes the need for admins to pre-create volumes. Pre-created PVs are static provisioning.',
    choiceRationale: [
      'That is static provisioning, the opposite of automatic creation.',
      'Correct: StorageClasses drive dynamic provisioning.',
      'hostPath bypasses the PV/PVC system entirely.',
      'ConfigMaps hold configuration and have no role in provisioning.',
    ],
    references: [R.dynamicProvisioning, R.storageClasses],
    tags: ['storageclass', 'dynamic-provisioning', 'pvc'],
  },
  {
    id: 'q-co-storage-006',
    domain: 'orchestration',
    objective: 'co-storage',
    lessonId: 'persistent-volumes-and-csi',
    difficulty: 2,
    type: 'single',
    prompt: `A database Pod stays Pending. You check its claim:

\`\`\`text
$ kubectl get pvc data -n db
NAME   STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   AGE
data   Pending                                      fast-ssd       5m

$ kubectl describe pvc data -n db | tail -2
  Warning  ProvisioningFailed  12s (x21 over 5m)  persistentvolume-controller  storageclass.storage.k8s.io "fast-ssd" not found
\`\`\`

What should you do?`,
    choices: [
      'Increase the requested capacity so a larger disk is chosen',
      'Change the access mode to ReadWriteMany',
      'Create the `fast-ssd` StorageClass or point the PVC at an existing one',
      'Delete the Pod so the scheduler retries on another node',
    ],
    answer: [2],
    explanation:
      'The PVC names a StorageClass that does not exist, so nothing can provision a volume and the claim stays Pending. The Pod then cannot be scheduled because its claim is unbound. Fix the class name (`kubectl get storageclass` lists what exists) or create the class.',
    choiceRationale: [
      'Capacity is irrelevant when there is no provisioner to fulfil any request.',
      'Access mode is not the reported problem and many backends do not support RWX.',
      'Correct: the error says the StorageClass is missing.',
      'Rescheduling the Pod does not create the missing StorageClass.',
    ],
    references: [R.storageClasses, R.pv],
    tags: ['pvc', 'storageclass', 'troubleshooting'],
  },
  {
    id: 'q-co-storage-007',
    domain: 'orchestration',
    objective: 'co-storage',
    lessonId: 'persistent-volumes-and-csi',
    difficulty: 3,
    type: 'single',
    prompt: 'What does the `ReadWriteOnce` access mode on a PersistentVolume guarantee?',
    choices: [
      'Exactly one Pod in the whole cluster can mount the volume',
      'The volume can be written once and then becomes read-only',
      'Many nodes can mount it read-write, but only one at a time',
      'The volume can be mounted read-write by a single node, and Pods on that node can share it',
    ],
    answer: [3],
    explanation:
      'ReadWriteOnce restricts read-write mounting to one **node**, not one Pod, so several Pods on that node can use it together. If you need a single-Pod guarantee, use `ReadWriteOncePod`. Multi-node read-write access requires `ReadWriteMany` and a backend that supports it.',
    choiceRationale: [
      'That describes ReadWriteOncePod, not ReadWriteOnce.',
      'Access modes say nothing about write-once semantics.',
      'Multi-node access is ReadWriteMany or ReadOnlyMany.',
      'Correct: the limit is per node, not per Pod.',
    ],
    references: [R.pv],
    tags: ['access-modes', 'pv', 'readwriteonce'],
  },
  {
    id: 'q-co-storage-008',
    domain: 'orchestration',
    objective: 'co-storage',
    lessonId: 'persistent-volumes-and-csi',
    difficulty: 3,
    type: 'multi',
    prompt: 'Which statements about Kubernetes persistent storage are accurate? (Select TWO.)',
    choices: [
      'With reclaimPolicy `Retain`, a released PV is immediately bound to the next pending PVC',
      'With reclaimPolicy `Delete`, deleting the PVC also deletes the dynamically provisioned PV and its backing storage',
      'StorageClasses are namespaced, so each namespace needs its own',
      'In-tree volume plugins are the recommended way to add new storage backends',
      'CSI lets storage vendors ship drivers independently of the Kubernetes core code',
    ],
    answer: [1, 4],
    explanation:
      'Dynamically provisioned volumes default to the Delete reclaim policy, so removing the claim removes the storage. Retain keeps the PV and its data in a Released state until an admin cleans it up manually. CSI is the standard plugin interface; in-tree plugins have largely been migrated to CSI drivers.',
    choiceRationale: [
      'A Retained PV stays Released and must be reclaimed manually before reuse.',
      'Correct: Delete removes both the PV and the underlying volume.',
      'StorageClasses are cluster-scoped.',
      'New backends are added as CSI drivers; in-tree plugins are being phased out.',
      'Correct: CSI decouples storage drivers from the Kubernetes release cycle.',
    ],
    references: [R.pv, R.volumes],
    tags: ['reclaim-policy', 'csi', 'storageclass'],
  },
];
