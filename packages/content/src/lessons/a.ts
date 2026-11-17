import type { Lesson } from '../types';

export const lessonsA: Lesson[] = [
  // ───────────────────────────── Stage 0 · Foundations ─────────────────────────────
  {
    id: 'linux-essentials',
    title: 'Linux essentials for containers',
    stage: 0,
    order: 1,
    objectives: ['kf-containerization'],
    scope: 'foundation',
    estMinutes: 20,
    summary:
      'A container is an ordinary Linux process wrapped in kernel namespaces (what it can see), cgroups (what it can use) and its own root filesystem. Signals decide how it stops.',
    what: `Containers are not a kernel feature of their own. They are a **combination of Linux kernel features** applied to a normal process:

- **Processes** – every running program has a PID, a parent, a user ID and open files. A container's main process is just a process on the host.
- **Namespaces** – give a process its own private *view* of a system resource: process IDs, network stack, mount points, hostname, IPC and users.
- **cgroups (control groups)** – limit and account for what a group of processes may *consume*: CPU time, memory, PIDs, I/O.
- **Root filesystem** – the process sees a directory tree (unpacked from an image) as its \`/\`, instead of the host's.
- **Signals** – asynchronous notifications like \`SIGTERM\` (please stop) and \`SIGKILL\` (stop now, cannot be caught) that the runtime and Kubernetes use to shut containers down.`,
    why: `Kubernetes settings map almost one-to-one onto these primitives. A memory **limit** becomes a cgroup memory limit; exceeding it gets the process killed by the kernel (\`OOMKilled\`). Pods sharing \`localhost\` works because the containers in a Pod share one **network namespace**. A graceful shutdown works only if your process handles \`SIGTERM\`.

When you debug a container you are debugging a Linux process. Knowing that removes most of the "magic".`,
    problem: `Before containers, running two applications on one server meant they shared everything: the same PID space, the same ports, the same \`/etc\`, the same library versions. One runaway process could eat all memory and take the neighbours down. The options were to buy another machine or run a full virtual machine per app.

Namespaces and cgroups solve this cheaply: each app gets an isolated view and a resource budget, while all apps still share one kernel.`,
    how: `What a runtime such as runc does when it starts a container, step by step:

- **Prepare the filesystem.** Image layers are stacked (usually with an overlay filesystem) into one directory that will become the container's root.
- **Create namespaces.** The runtime asks the kernel (via \`clone\`/\`unshare\`) for new PID, mount, network, UTS (hostname), IPC and optionally user namespaces. Inside the new PID namespace the first process sees itself as **PID 1**.
- **Place the process in a cgroup.** The runtime writes limits such as \`memory.max\` and \`cpu.max\` (cgroup v2) for that cgroup. The kernel enforces them: CPU over the limit is **throttled**; memory over the limit triggers the **OOM killer**.
- **Switch the root.** The process's root is changed to the prepared directory (\`pivot_root\`), so the host filesystem is invisible.
- **Drop privileges.** Linux capabilities are reduced, and seccomp/AppArmor/SELinux profiles may restrict system calls.
- **Exec the entrypoint.** The image's command replaces the runtime's setup code. From here on it is just your program.
- **Stop.** To stop it, the runtime sends \`SIGTERM\` to PID 1, waits, then sends \`SIGKILL\`. In Kubernetes the wait is the Pod's \`terminationGracePeriodSeconds\` (default 30).`,
    components: [
      { name: 'Namespaces', description: 'Isolate what a process can **see**: `pid`, `net`, `mnt`, `uts`, `ipc`, `user`, `cgroup` (and `time` on newer kernels).' },
      { name: 'cgroups', description: 'Limit and meter what a process can **use**: CPU, memory, PIDs, block I/O. Modern distributions use the unified cgroup v2 hierarchy.' },
      { name: 'Root filesystem / overlayfs', description: 'Read-only image layers plus a thin writable layer, merged into one view that becomes the container\'s `/`.' },
      { name: 'PID 1', description: 'The first process in a PID namespace. It receives signals from the runtime and must reap zombie children; the kernel does not apply default signal actions to it, so an unhandled `SIGTERM` is simply ignored.' },
      { name: 'Signals', description: '`SIGTERM` (15) asks for graceful shutdown and can be handled; `SIGKILL` (9) is enforced by the kernel and cannot be caught.' },
      { name: 'Capabilities & seccomp', description: 'Split root privileges into small units (e.g. `NET_BIND_SERVICE`) and filter which syscalls are allowed.' },
    ],
    misconceptions: [
      {
        myth: 'A container has its own kernel.',
        reality: 'All containers on a host share the **host kernel**. Only the view (namespaces) and budget (cgroups) differ. That is why a Linux container cannot run natively on a Windows kernel and why a kernel exploit affects every container on the node.',
      },
      {
        myth: 'A CPU limit kills the container when exceeded, just like memory.',
        reality: 'CPU is **compressible**: exceeding the limit causes **throttling** (the process waits). Memory is **incompressible**: exceeding the limit causes the kernel OOM killer to terminate a process, which Kubernetes reports as `OOMKilled`.',
      },
      {
        myth: 'root inside a container is harmless because it is "inside".',
        reality: 'Without user namespaces, UID 0 in the container is UID 0 on the host, only constrained by capabilities, seccomp and the other layers. Escaping the namespace gives host root. That is why running as non-root is a security baseline.',
      },
    ],
    example: {
      title: 'See that a container is just a process',
      description: `On a Linux host with Docker (or any runtime), start a container and look at it from both sides. The same process has two PIDs: one inside its PID namespace and one on the host.`,
      language: 'bash',
      code: `# start a long-running container
docker run -d --name demo --memory 64m busybox sleep 3600

# inside: the process believes it is PID 1
docker exec demo ps
# PID   USER     TIME  COMMAND
#     1 root      0:00 sleep 3600

# outside: the same sleep is an ordinary host process
ps -ef | grep "sleep 3600"

# compare namespaces of the host shell and the container process
HOSTPID=$(docker inspect -f '{{.State.Pid}}' demo)
sudo ls -l /proc/$HOSTPID/ns/      # net, pid, mnt ... differ from /proc/self/ns/

# graceful stop: SIGTERM, then SIGKILL after the timeout
docker stop -t 10 demo`,
    },
    exercise: {
      prompt: `A Pod's container is configured with \`limits.memory: 128Mi\` and \`limits.cpu: 500m\`. Under load it uses 300m CPU and grows to 140Mi of memory. Describe what the kernel does for each resource, and what Kubernetes will report.`,
      solution: `CPU at 300m is under the 500m limit, so nothing happens. (Above 500m it would be throttled, never killed.)

Memory at 140Mi exceeds the 128Mi cgroup limit. The kernel's OOM killer terminates the process in that cgroup. The kubelet reports the container's last state as **Terminated** with reason \`OOMKilled\` (exit code 137 = 128 + signal 9), and the container is restarted according to the Pod's \`restartPolicy\`. Repeated failures produce \`CrashLoopBackOff\`.`,
    },
    faq: [
      {
        q: 'Why does my container take exactly 30 seconds to stop?',
        a: 'Your process probably ignores `SIGTERM` (common when a shell script is PID 1 and does not forward signals). Kubernetes waits `terminationGracePeriodSeconds` (default 30) and then sends `SIGKILL`. Handle `SIGTERM` in the app, or use `exec` in the entrypoint script so the app itself becomes PID 1.',
      },
      {
        q: 'Do I need to memorize every namespace type for the KCNA?',
        a: 'No. Know the concept: namespaces isolate what a process sees, cgroups limit what it uses, and containers share the host kernel. Recognizing `net` and `pid` namespaces helps explain why containers in a Pod share `localhost`.',
      },
      {
        q: 'Are Linux namespaces the same as Kubernetes namespaces?',
        a: 'No. A Kubernetes Namespace is an API-level grouping of objects (names, RBAC, quotas). It has nothing to do with kernel namespaces, which isolate processes on one host.',
      },
    ],
    keyTerms: ['process', 'PID 1', 'Linux namespace', 'cgroup', 'OOM killer', 'SIGTERM', 'SIGKILL', 'capabilities'],
    deeper: `Exit code 137 means "killed by signal 9" (128 + 9); 143 means \`SIGTERM\` (128 + 15). Tiny init processes such as \`tini\` exist solely to forward signals and reap zombies when your app is not written to be PID 1. Kubernetes can also share a single PID namespace across a Pod's containers with \`shareProcessNamespace: true\`. User namespaces for Pods (\`hostUsers: false\`) map container root to an unprivileged host UID; check its feature state for your cluster version before relying on it.`,
    references: [
      { title: 'namespaces(7) – Linux manual page', url: 'https://man7.org/linux/man-pages/man7/namespaces.7.html' },
      { title: 'cgroups(7) – Linux manual page', url: 'https://man7.org/linux/man-pages/man7/cgroups.7.html' },
      { title: 'Pod lifecycle – termination of Pods', url: 'https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/' },
    ],
  },

  {
    id: 'networking-fundamentals',
    title: 'Networking fundamentals',
    stage: 0,
    order: 2,
    objectives: ['co-networking'],
    scope: 'foundation',
    estMinutes: 25,
    summary:
      'IP addresses identify hosts, ports identify processes, TCP and UDP carry data, DNS turns names into addresses, NAT rewrites addresses at boundaries, and load balancers spread traffic across backends.',
    what: `Kubernetes networking is built from a handful of classic ideas:

- **IP address and CIDR** – \`10.244.1.17\` identifies an interface; \`10.244.0.0/16\` describes a range (the first 16 bits are the network part).
- **Port** – a 16-bit number (0–65535) that identifies which process on a host gets a connection. An endpoint is \`IP:port\`.
- **TCP vs UDP** – TCP is connection-oriented, ordered and retransmits lost data. UDP sends independent datagrams with no delivery guarantee but less overhead (DNS queries usually use UDP).
- **DNS** – a distributed directory mapping names to records: \`A\` (IPv4), \`AAAA\` (IPv6), \`CNAME\` (alias), \`SRV\` (service + port).
- **HTTP** – an application-layer (L7) request/response protocol with methods (\`GET\`, \`POST\`), paths, headers and status codes.
- **NAT** – rewriting source (SNAT) or destination (DNAT) addresses as packets cross a boundary.
- **Load balancing** – distributing connections or requests over several backends, at L4 (IP/port) or L7 (HTTP paths, headers).`,
    why: `Every Kubernetes networking object is one of these ideas wearing a new name. A **Service** is a stable virtual IP plus DNAT and L4 load balancing. **CoreDNS** is DNS. An **Ingress** or **Gateway** is an L7 HTTP load balancer. A **NodePort** is "open this port on every node". **NetworkPolicy** is a firewall on IPs and ports.

If you can trace a plain \`curl\` across a network, you can trace a request into a cluster.`,
    problem: `Applications need to find and talk to each other while the machines underneath change. Hard-coding \`192.168.1.20:8080\` breaks the moment that server is replaced. DNS gives stable names, load balancers give one entry point for many replicas, and NAT lets many private addresses share fewer public ones. Kubernetes leans on exactly these tools because its backends (Pods) are replaced constantly.`,
    how: `Trace what happens when you run \`curl http://shop.example.com/cart\`:

- **Resolve the name.** The client asks its configured resolver (see \`/etc/resolv.conf\`) for the \`A\` record of \`shop.example.com\`. The answer, say \`203.0.113.10\`, is cached for the record's TTL.
- **Pick a source port.** The OS picks an ephemeral source port, e.g. \`54012\`. The connection is identified by the 5-tuple: protocol, source IP, source port, destination IP, destination port (80).
- **Route the packet.** The host checks its routing table; the destination is not local, so the packet goes to the default gateway.
- **NAT at the edge.** A home or cloud router rewrites the private source IP to a public one (**SNAT**) and remembers the mapping so replies come back.
- **TCP handshake.** \`SYN\` → \`SYN-ACK\` → \`ACK\` establishes the connection.
- **Load balancer.** \`203.0.113.10\` is a load balancer. An L4 balancer picks a backend by IP/port and forwards the connection (often using **DNAT**). An L7 balancer terminates the connection, reads the HTTP request, and can route \`/cart\` to a different backend pool than \`/search\`.
- **HTTP exchange.** The backend receives \`GET /cart\`, returns \`200 OK\` (or \`404\`, \`503\`...), and the reply follows the NAT mappings back to the client.`,
    components: [
      { name: 'IP & CIDR', description: 'Addresses and ranges. Private ranges such as `10.0.0.0/8`, `172.16.0.0/12` and `192.168.0.0/16` are not routable on the internet.' },
      { name: 'Ports & sockets', description: 'Ports below 1024 are privileged on Linux. Only one process can listen on a given IP:port at a time.' },
      { name: 'DNS resolver', description: 'Turns names into records. Search domains in `/etc/resolv.conf` let short names like `db` expand to longer ones; Kubernetes uses this heavily.' },
      { name: 'NAT (SNAT/DNAT)', description: 'Rewrites source or destination addresses. kube-proxy uses DNAT to send Service traffic to a Pod IP.' },
      { name: 'L4 vs L7 load balancer', description: 'L4 sees only IPs, ports and protocol; L7 understands HTTP and can route by host, path or header.' },
    ],
    misconceptions: [
      {
        myth: 'DNS is only for websites on the internet.',
        reality: 'Internal service discovery is DNS too. Inside Kubernetes, `my-svc.my-namespace.svc.cluster.local` is answered by the cluster DNS server (CoreDNS).',
      },
      {
        myth: 'UDP is "unreliable" so nothing important uses it.',
        reality: 'UDP simply leaves reliability to the application. DNS, many VPNs, video streaming and HTTP/3 (QUIC) all run on UDP.',
      },
      {
        myth: 'A load balancer always understands HTTP.',
        reality: 'Only L7 balancers do. An L4 balancer (like a Kubernetes Service of type `LoadBalancer` in most clouds) forwards TCP/UDP connections without looking at paths or headers.',
      },
    ],
    example: {
      title: 'Inspecting each layer from a shell',
      description: 'These standard tools show the layers in order: name resolution, routing, and the HTTP exchange.',
      language: 'bash',
      code: `# DNS: which IP does the name resolve to?
dig +short example.com A
nslookup example.com

# Routing: which interface and gateway would be used?
ip route get 1.1.1.1

# Listening sockets on this host (which process owns which port)
ss -tlnp

# HTTP: verbose output shows the TCP connect, request headers and status code
curl -v http://example.com/`,
    },
    exercise: {
      prompt: `Three Pods run the same web app at \`10.244.1.5:8080\`, \`10.244.2.9:8080\` and \`10.244.3.4:8080\`. Clients should use one stable address and should not care when Pods are replaced. Using only the vocabulary of this lesson, describe the pieces you would need.`,
      solution: `- A **stable virtual IP** (and port) that clients connect to.
- A **DNS name** that resolves to that virtual IP, so clients use a name rather than an address.
- **DNAT + L4 load balancing** that rewrites each new connection's destination from the virtual IP to one of the healthy backend \`IP:8080\` endpoints.
- A way to **update the backend list** whenever Pods come and go.

That is exactly what a Kubernetes Service (ClusterIP), CoreDNS, kube-proxy and EndpointSlices provide together.`,
    },
    faq: [
      {
        q: 'What is the difference between a port and a protocol?',
        a: 'The protocol (TCP or UDP) decides how data is carried; the port decides which process receives it. `53/UDP` and `53/TCP` are different sockets, which is why Kubernetes Service ports declare a `protocol` field (default TCP).',
      },
      {
        q: 'Why does /etc/resolv.conf matter in Kubernetes?',
        a: 'The kubelet writes a `resolv.conf` into each Pod pointing at the cluster DNS Service and adding search domains like `<namespace>.svc.cluster.local`. That is how a Pod can reach another Service by its short name.',
      },
      {
        q: 'Is NAT the same as a firewall?',
        a: 'No. NAT rewrites addresses; a firewall allows or drops traffic. They often run on the same box (and both use Linux netfilter), but they are separate functions.',
      },
    ],
    keyTerms: ['CIDR', 'port', 'TCP', 'UDP', 'DNS A record', 'SNAT/DNAT', 'L4 load balancer', 'L7 load balancer'],
    deeper: `Linux implements NAT and packet filtering in the kernel's netfilter framework, programmed by \`iptables\` or the newer \`nftables\`. kube-proxy writes such rules to implement Services. Some CNI plugins (e.g. Cilium) replace this path with eBPF programs attached in the kernel, which avoids long rule chains in very large clusters.`,
    references: [
      { title: 'Kubernetes – Services, Load Balancing, and Networking', url: 'https://kubernetes.io/docs/concepts/services-networking/' },
      { title: 'MDN – An overview of HTTP', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview' },
    ],
  },

  {
    id: 'virtualization-and-containers',
    title: 'Virtual machines vs containers',
    stage: 0,
    order: 3,
    objectives: ['kf-containerization'],
    scope: 'kcna',
    estMinutes: 15,
    summary:
      'A VM virtualizes hardware and runs its own kernel; a container virtualizes the operating system view and shares the host kernel. That one difference explains their size, speed and isolation trade-offs.',
    what: `Think of a building.

A **virtual machine** is a detached house: its own foundation, plumbing and walls. A **hypervisor** carves physical hardware into virtual hardware, and every VM boots a full **guest operating system with its own kernel**.

A **container** is an apartment in a block: private rooms and a front door, but shared foundation and plumbing. Containers share the **host kernel** and get isolation from kernel features (namespaces, cgroups), not from virtual hardware.

- **Type 1 hypervisor** – runs directly on hardware (e.g. KVM, Xen, ESXi, Hyper-V). Used by cloud providers.
- **Type 2 hypervisor** – runs as an application on a host OS (e.g. VirtualBox). Common on laptops.
- **Container runtime** – sets up namespaces, cgroups and the root filesystem and starts a process (e.g. containerd + runc).`,
    why: `The KCNA expects you to explain why the industry moved application packaging to containers and where VMs still fit. In practice they are combined: almost every managed Kubernetes cluster runs its **nodes as VMs**, and containers inside them. VMs give strong tenant isolation between customers; containers give fast, dense, portable packaging of apps.`,
    problem: `VMs solved "one app per physical server" waste, but each VM still carries a whole OS: gigabytes of disk, a boot sequence measured in tens of seconds, its own patching. Teams that wanted to deploy many small services dozens of times a day found that too heavy. They also suffered "works on my machine" bugs because the app's dependencies were not packaged with it.

Containers package the app with its userland dependencies, start in well under a second (no kernel to boot), and pack many workloads onto one host.`,
    how: `Compare how each one starts an nginx web server:

- **VM:** the hypervisor allocates virtual CPUs, RAM and disks → virtual firmware runs → the guest kernel boots → init system starts services → nginx starts. Isolation boundary: **virtual hardware**. A guest kernel bug stays inside the VM.
- **Container:** the runtime unpacks the image layers → creates namespaces and a cgroup → switches the root filesystem → execs \`nginx\` as a process on the host kernel. Isolation boundary: **kernel features**. A host kernel bug can affect every container.

Middle ground exists for untrusted workloads:

- **Sandboxed runtimes** such as **gVisor** (a user-space kernel that intercepts syscalls) and **Kata Containers** (each Pod in a lightweight VM) keep the container workflow but add a stronger boundary. Kubernetes selects them per Pod with a **RuntimeClass**.`,
    components: [
      { name: 'Hypervisor', description: 'Software that presents virtual hardware to guest OSes. Type 1 runs on bare metal; type 2 runs on top of a host OS.' },
      { name: 'Guest OS / kernel', description: 'Each VM boots its own kernel, so VMs can run different OS families (Linux and Windows) side by side.' },
      { name: 'Container runtime', description: 'Creates isolated processes on the shared host kernel; e.g. containerd or CRI-O with runc underneath.' },
      { name: 'Sandboxed runtime', description: 'gVisor or Kata Containers: container interface, VM-like isolation, some performance cost.' },
    ],
    misconceptions: [
      {
        myth: 'Containers are just lightweight VMs.',
        reality: 'They are a different mechanism. A VM emulates hardware and boots a kernel; a container is an isolated **process** on an already-running kernel. That is why there is no "boot" when a container starts.',
      },
      {
        myth: 'Kubernetes replaces virtual machines.',
        reality: 'Kubernetes schedules containers onto **nodes**, and nodes are very often VMs. The layers are complementary.',
      },
      {
        myth: 'A Linux container image runs on any OS.',
        reality: 'Because the kernel is shared, a Linux image needs a Linux kernel. Docker Desktop on macOS or Windows quietly runs a small Linux VM to provide one. Windows containers likewise need a Windows host.',
      },
    ],
    example: {
      title: 'Side-by-side comparison',
      description: 'Typical, order-of-magnitude characteristics. Exact numbers vary by workload and platform.',
      language: 'text',
      code: `                    Virtual machine            Container
Isolation boundary  virtual hardware           kernel namespaces + cgroups
Kernel              own guest kernel           shared host kernel
Typical size        gigabytes (full OS)        megabytes (app + userland libs)
Start time          seconds to minutes         milliseconds to seconds
Density per host    tens                       hundreds
Mixed OS families   yes (Linux + Windows)      no (must match host kernel)
Typical use         tenant isolation, nodes    packaging and running apps`,
    },
    exercise: {
      prompt: `A SaaS company runs code uploaded by untrusted customers. They want container-style packaging and Kubernetes scheduling, but are worried that one customer could exploit a kernel bug to reach another customer's workload. What options does this lesson give them?`,
      solution: `- Run those Pods with a **sandboxed runtime** (gVisor or Kata Containers) selected through a **RuntimeClass**, adding a boundary beyond the shared kernel.
- Or give each customer **separate nodes (VMs)** or even separate clusters, so the hypervisor is the boundary between tenants.

Plain containers alone share the host kernel, so they are a weaker boundary for hostile multi-tenancy.`,
    },
    faq: [
      {
        q: 'If containers share the kernel, how can an Alpine container run on an Ubuntu host?',
        a: 'Distributions differ in **userland** (libraries, package manager, shell), not in the kernel interface. The Alpine image brings its own userland files; it only borrows the Ubuntu host\'s Linux kernel.',
      },
      {
        q: 'Are containers secure enough for production?',
        a: 'Yes for most workloads, when combined with good practices: non-root users, dropped capabilities, seccomp, read-only root filesystems and Pod Security Admission. For hostile multi-tenant code, add sandboxed runtimes or VM boundaries.',
      },
      {
        q: 'What is RuntimeClass on the exam?',
        a: 'Know it exists: a Kubernetes object that lets a Pod choose which runtime configuration (for example a gVisor or Kata handler) the node should use, via `spec.runtimeClassName`.',
      },
    ],
    keyTerms: ['hypervisor', 'virtual machine', 'guest kernel', 'container', 'shared kernel', 'gVisor', 'Kata Containers', 'RuntimeClass'],
    deeper: `Hardware virtualization extensions (Intel VT-x, AMD-V) make type 1 hypervisors fast. MicroVM projects such as Firecracker shrink the VM to the essentials so it boots in a fraction of a second; serverless platforms use them to get VM isolation with near-container speed.`,
    references: [
      { title: 'Kubernetes – Containers', url: 'https://kubernetes.io/docs/concepts/containers/' },
      { title: 'Kubernetes – Runtime Class', url: 'https://kubernetes.io/docs/concepts/containers/runtime-class/' },
    ],
  },

  {
    id: 'container-images-and-oci',
    title: 'Container images, OCI and registries',
    stage: 0,
    order: 4,
    objectives: ['kf-containerization'],
    scope: 'kcna',
    estMinutes: 25,
    summary:
      'An image is a stack of read-only filesystem layers plus a config, described by a manifest and addressed by content digests. The OCI specifications standardize image format, runtime behaviour and registry distribution so any compliant tool can build, push, pull and run it.',
    what: `A **container image** is a portable, read-only template for a container. Concretely it is:

- a set of **layers** – compressed tarballs, each holding the filesystem changes of one build step;
- an **image config** – JSON with the default command, environment, working directory, user and the ordered list of layer digests;
- a **manifest** – JSON that points to the config and the layers by **digest** (\`sha256:...\`). An **image index** can point to several manifests, one per platform (e.g. \`linux/amd64\`, \`linux/arm64\`).

**Docker** popularized this format and the \`Dockerfile\` build recipe. The **Open Container Initiative (OCI)**, a Linux Foundation project, now standardizes it in three specs:

- **Image spec** – the manifest, config and layer formats.
- **Runtime spec** – how to run an unpacked "bundle" (filesystem + \`config.json\`); \`runc\` is the reference implementation.
- **Distribution spec** – the HTTP API registries use for push and pull.`,
    why: `Kubernetes never builds images; it only **pulls** them by reference and asks a runtime to run them. Because of OCI, an image built with Docker, Buildah, kaniko or BuildKit runs on containerd or CRI-O and can live in any compliant registry (Docker Hub, GHCR, Harbor, cloud registries). That is also why removing dockershim in Kubernetes 1.24 did **not** break Docker-built images.

Tags vs digests is a frequent exam and production topic: it decides whether a rollout is reproducible.`,
    problem: `"It works on my machine" usually means the machine had a library, a config file or a runtime version the server did not. Images freeze the userland into an artifact you can version and ship. Layering then fixes the next problem: shipping a 500 MB file for every one-line change would be wasteful, so only changed layers are rebuilt, pushed and pulled.`,
    how: `Trace a build and a pull:

- **Build.** \`FROM\` starts from the base image's layers; each filesystem-changing instruction (\`COPY\`, \`RUN\`, \`ADD\`) adds a new layer. Metadata instructions (\`CMD\`, \`ENV\`, \`EXPOSE\`, \`USER\`) only change the config.
- **Cache.** If an instruction and its inputs are unchanged, the builder reuses the cached layer. A change invalidates that layer **and every layer after it** – so put rarely-changing steps (installing dependencies) before frequently-changing ones (copying source).
- **Hash.** Every layer and the config get a SHA-256 **digest** of their content. The manifest lists these digests; the manifest's own digest identifies the whole image.
- **Push.** The client uploads blobs the registry does not already have, then uploads the manifest under a **tag** such as \`v1.4.2\`.
- **Pull.** The node resolves the tag to a manifest digest, downloads only missing layers, and verifies every blob against its digest.
- **Run.** The runtime stacks the read-only layers with overlayfs and adds a thin **writable container layer** on top. Files written there disappear with the container.`,
    components: [
      { name: 'Layer', description: 'Read-only, content-addressed tarball of filesystem changes. Shared between images that use the same base.' },
      { name: 'Manifest / image index', description: 'Manifest lists config + layers for one platform; an index (multi-arch "manifest list") picks the right manifest for the node\'s OS/CPU.' },
      { name: 'Tag', description: 'Human-friendly, **mutable** pointer like `nginx:1.27` or `latest`. Can be moved to a different image at any time.' },
      { name: 'Digest', description: '**Immutable** content hash like `nginx@sha256:...`. The same digest always means exactly the same bytes.' },
      { name: 'Registry', description: 'Server implementing the OCI distribution API, organized into repositories. Public or private (credentials via `imagePullSecrets`).' },
      { name: 'OCI runtime (runc)', description: 'Low-level runtime that takes an unpacked bundle and creates the container process with namespaces and cgroups.' },
    ],
    misconceptions: [
      {
        myth: 'Kubernetes needs Docker installed on every node.',
        reality: 'Since 1.24 the kubelet talks only to CRI runtimes such as **containerd** or **CRI-O**. Docker-built images are OCI images, so they still run unchanged.',
      },
      {
        myth: 'The tag `latest` means the newest version.',
        reality: '`latest` is just the default tag name when none is given. It points wherever someone last pushed it. In Kubernetes, `:latest` (or no tag) also makes the default `imagePullPolicy` `Always`.',
      },
      {
        myth: 'Deleting a file in a later Dockerfile step makes the image smaller.',
        reality: 'Earlier layers are immutable; the deletion is only a "whiteout" marker in a new layer. The bytes still ship. Clean up in the **same** `RUN` step, or use a multi-stage build.',
      },
    ],
    example: {
      title: 'A cache-friendly, multi-stage Dockerfile',
      description: `Dependencies are copied and installed before the source code, so a code-only change reuses the dependency layer. The final stage copies only the built binary into a small base, leaving compilers behind.`,
      language: 'text',
      code: `# ---- build stage ----
FROM golang:1.23 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download            # cached until go.mod/go.sum change
COPY . .
RUN CGO_ENABLED=0 go build -o /out/app ./cmd/app

# ---- runtime stage ----
FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/app /app
USER nonroot
ENTRYPOINT ["/app"]

# Build, tag and push; then deploy by digest for reproducibility:
#   docker build -t registry.example.com/shop/app:1.4.2 .
#   docker push registry.example.com/shop/app:1.4.2
#   image: registry.example.com/shop/app@sha256:<digest printed by push>`,
    },
    exercise: {
      prompt: `Your Deployment uses \`image: shop/api:prod\`. Someone re-pushes the \`prod\` tag with a broken build. Two nodes already have the old image cached; a third node pulls fresh. Explain what happens and how to prevent it.`,
      solution: `With an explicit non-\`latest\` tag, the default \`imagePullPolicy\` is \`IfNotPresent\`. The two nodes reuse their cached (old) image; the new node pulls the moved tag and gets the broken build. The same Deployment now runs **two different images**.

Prevent it by deploying **immutable references**: a unique tag per build (e.g. a version or commit SHA) that is never re-pushed, or better, pin the **digest** (\`shop/api@sha256:...\`). Many registries can also enforce tag immutability.`,
    },
    faq: [
      {
        q: 'Is a Dockerfile part of the OCI standard?',
        a: 'No. OCI standardizes the **resulting** image, the runtime bundle and the registry API. The Dockerfile is just one popular build recipe; Buildpacks or other tools can produce OCI images without one.',
      },
      {
        q: 'What is the difference between containerd and runc?',
        a: '**containerd** is a high-level runtime: it pulls images, manages storage and snapshots, and exposes the CRI to the kubelet. **runc** is the low-level OCI runtime that containerd invokes to actually create each container process.',
      },
      {
        q: 'How does a node pull from a private registry?',
        a: 'Create a Secret of type `kubernetes.io/dockerconfigjson` and reference it in the Pod\'s `imagePullSecrets` (directly or through the ServiceAccount). Some clouds also provide node-level credential plugins.',
      },
    ],
    keyTerms: ['image layer', 'manifest', 'digest', 'tag', 'registry', 'OCI image spec', 'OCI runtime spec', 'OCI distribution spec'],
    deeper: `Because OCI registries store arbitrary content-addressed blobs, they now hold more than images: Helm charts, signatures and SBOMs (OCI "artifacts" and the \`subject\`/referrers mechanism). Supply-chain tools such as Sigstore cosign attach signatures to an image digest this way, so a signature can never silently follow a moved tag.`,
    references: [
      { title: 'Open Container Initiative', url: 'https://opencontainers.org/' },
      { title: 'Kubernetes – Images', url: 'https://kubernetes.io/docs/concepts/containers/images/' },
      { title: 'Kubernetes – Container Runtime Interface', url: 'https://kubernetes.io/docs/concepts/architecture/cri/' },
    ],
    diagram: 'container-layers',
  },

  {
    id: 'yaml-for-kubernetes',
    title: 'YAML for Kubernetes manifests',
    stage: 0,
    order: 5,
    objectives: ['kf-core'],
    scope: 'foundation',
    estMinutes: 20,
    summary:
      'YAML expresses maps, lists and scalars through indentation. Every Kubernetes manifest uses the same top-level shape: apiVersion, kind, metadata, spec – and the cluster writes back status.',
    what: `**YAML** is a human-friendly data format (a superset of JSON). Kubernetes reads it, converts it to JSON, and sends it to the API server. You only need three building blocks:

- **Mapping** (key: value) – \`name: web\`
- **Sequence** (list) – items start with \`- \`
- **Scalar** – strings, numbers, booleans, null

Indentation with **spaces** (never tabs) shows nesting. \`#\` starts a comment. \`---\` separates multiple documents in one file.

Every Kubernetes object has the same skeleton:

- \`apiVersion\` – API group and version, e.g. \`v1\` (core group) or \`apps/v1\`
- \`kind\` – the type, e.g. \`Pod\`, \`Deployment\`
- \`metadata\` – \`name\`, \`namespace\`, \`labels\`, \`annotations\`
- \`spec\` – the **desired state** you write
- \`status\` – the **observed state** the cluster writes; you do not author it`,
    why: `Declarative Kubernetes is "write YAML, apply it". Most beginner errors are YAML errors, not Kubernetes errors: wrong indentation turns a field into a sibling of the field it belonged to, a missing \`-\` turns a list into a map, and an unquoted value becomes the wrong type. Reading YAML fluently is a prerequisite for every later lesson and for the exam's manifest-reading questions.`,
    problem: `Raw JSON is noisy to read and cannot hold comments; ad-hoc command flags cannot be reviewed or versioned. YAML gives a readable, diffable text form for API objects that can live in Git. The cost is that whitespace and typing rules are strict and sometimes surprising.`,
    how: `Read any manifest in this order:

- **Find the type.** \`apiVersion\` + \`kind\` tell you which schema applies. \`kubectl explain <kind>.<field>\` shows that schema.
- **Find the identity.** \`metadata.name\` (+ \`namespace\`) identifies the object; labels are for selection, annotations for extra notes.
- **Walk the spec by indentation.** Children are indented further than their parent. Items at the same indentation are siblings.
- **Spot lists.** A \`- \` begins a new list item; every key indented under it belongs to that item. \`containers:\` is always a list, even with one container.
- **Check scalar types.** \`8080\` is a number, \`"8080"\` a string, \`true\` a boolean. Fields typed as strings (like env \`value\`) need quotes around numbers or booleans.
- **Submit.** \`kubectl apply -f file.yaml\` parses the YAML, validates it against the schema on the server, and stores it.`,
    components: [
      { name: 'apiVersion', description: '`<group>/<version>` such as `apps/v1`, or just `v1` for the core group (Pods, Services, ConfigMaps).' },
      { name: 'kind', description: 'Object type, CamelCase: `Pod`, `Deployment`, `Service`.' },
      { name: 'metadata', description: 'Identity and tags: `name`, `namespace`, `labels`, `annotations`. The server adds `uid`, `resourceVersion`, `creationTimestamp`.' },
      { name: 'spec', description: 'Desired state; structure depends on `kind`.' },
      { name: 'status', description: 'Observed state written by controllers and the kubelet. Ignored if you include it in `apply`.' },
    ],
    misconceptions: [
      {
        myth: 'Tabs and spaces are interchangeable in YAML.',
        reality: 'Tabs are **not allowed** for indentation. Use spaces (2 per level is the Kubernetes convention).',
      },
      {
        myth: 'Every value is a string, so quoting does not matter.',
        reality: 'YAML infers types. `value: 8080` in an env var is a number and the API rejects it because the field must be a string; write `value: "8080"`. Words like `yes`, `no`, `on`, `true` can also be read as booleans.',
      },
      {
        myth: 'You should copy the `status` section when saving a manifest.',
        reality: '`status` is owned by the cluster. Strip it (and server fields like `uid`, `resourceVersion`) from manifests you keep in Git.',
      },
    ],
    example: {
      title: 'Spot the three bugs',
      description: `This Pod manifest is broken in three ways: the \`env\` value is an unquoted number, \`image\` is indented as a sibling of \`containers\` instead of inside the list item, and \`ports\` is a map where a list is required. The corrected version follows.`,
      language: 'yaml',
      code: `# BROKEN
apiVersion: v1
kind: Pod
metadata:
  name: web
spec:
  containers:
  - name: web
  image: nginx:1.27          # wrong level: belongs to the container item
    ports:
      containerPort: 80      # must be a list item
    env:
    - name: PORT
      value: 8080            # must be a string
---
# FIXED
apiVersion: v1
kind: Pod
metadata:
  name: web
  labels:
    app: web
spec:
  containers:
  - name: web
    image: nginx:1.27
    ports:
    - containerPort: 80
    env:
    - name: PORT
      value: "8080"`,
    },
    exercise: {
      prompt: `Without running anything, answer: in the FIXED manifest above, (1) how many containers are defined, (2) what is the full field path to the container port, and (3) which API group does \`v1\` refer to?`,
      solution: `(1) One container – \`containers\` is a list with a single \`- name: web\` item.

(2) \`spec.containers[0].ports[0].containerPort\`.

(3) The **core** (legacy) API group, which has no group name – hence just \`v1\` rather than \`<group>/v1\`.`,
    },
    faq: [
      {
        q: 'How do I find which fields a kind supports?',
        a: 'Use `kubectl explain`, e.g. `kubectl explain pod.spec.containers` or add `--recursive` for the whole tree. It reads the schema from your cluster, so it matches your version.',
      },
      {
        q: 'Can I write manifests in JSON instead?',
        a: 'Yes. kubectl accepts JSON, and `kubectl get <resource> <name> -o json` prints objects that way. YAML is the convention because it is easier to read and comment.',
      },
      {
        q: 'Where do apiVersion values like apps/v1 come from?',
        a: 'From the API groups your cluster serves. `kubectl api-resources` lists each resource with its group/version and whether it is namespaced.',
      },
    ],
    keyTerms: ['mapping', 'sequence', 'scalar', 'apiVersion', 'kind', 'metadata', 'spec', 'status'],
    deeper: `Kubernetes converts YAML to JSON before validation, so anything YAML can express beyond JSON (anchors \`&\`/\`*\`, merge keys) is resolved client-side and never reaches the API server. Block scalars \`|\` (keep newlines) and \`>\` (fold lines) are handy for embedding scripts or config files in ConfigMaps.`,
    references: [
      { title: 'Kubernetes – Objects in Kubernetes', url: 'https://kubernetes.io/docs/concepts/overview/working-with-objects/' },
      { title: 'YAML 1.2.2 specification', url: 'https://yaml.org/spec/1.2.2/' },
      { title: 'kubectl reference', url: 'https://kubernetes.io/docs/reference/kubectl/' },
    ],
  },

  {
    id: 'distributed-systems-basics',
    title: 'Distributed systems basics',
    stage: 0,
    order: 6,
    objectives: ['cna-ecosystem'],
    scope: 'foundation',
    estMinutes: 20,
    summary:
      'In a distributed system, networks drop messages and machines die. Kubernetes copes with consensus (Raft in etcd), idempotent operations, retries, and eventual consistency driven by control loops.',
    what: `A **distributed system** is several computers cooperating over a network so that they appear as one service. Four ideas carry most of the weight:

- **Partial failure** – some parts fail while others keep running; a slow node and a dead node can look identical.
- **Consensus** – getting a group of machines to agree on one value (or one ordered log) despite failures. **Raft** does this with an elected leader and a **majority quorum**.
- **Idempotency** – an operation that has the same effect whether it is applied once or many times ("set replicas to 3" vs "add 1 replica"). Idempotent operations make retries safe.
- **Eventual consistency** – the system may be temporarily out of sync but converges to the correct state if no new changes arrive.`,
    why: `A Kubernetes cluster *is* a distributed system. etcd uses Raft, so you must run an odd number of members and keep a majority alive. Controllers converge **eventually** – a new Deployment is not "done" when \`kubectl apply\` returns. Rolling updates, retries and self-healing only work because operations are expressed as idempotent desired state. These ideas explain dozens of exam answers that otherwise look arbitrary.`,
    problem: `Three short failure stories:

- **The double charge.** A payment request times out; the client retries; both requests actually succeeded. The fix: an **idempotency key** so the second request is recognized and ignored.
- **The split brain.** A network splits two database servers; each thinks the other is dead and both accept writes. The fix: require a **majority quorum** – at most one side can have a majority, so only it may write.
- **The stale read.** A cache still shows a deleted item for a few seconds. Often acceptable – that is **eventual consistency** – as long as the system converges.`,
    how: `How Raft (used by etcd) keeps one consistent log:

- **Roles.** Each member is a **follower**, **candidate** or **leader**. Normally there is exactly one leader.
- **Election.** If a follower hears no heartbeat within a randomized timeout, it becomes a candidate, increments the **term**, and asks for votes. A candidate with votes from a **majority** becomes leader.
- **Replication.** All writes go to the leader, which appends them to its log and sends them to followers.
- **Commit.** Once a **majority** has stored the entry, it is committed and applied; the client gets success.
- **Fault tolerance.** With *n* members, quorum is ⌊n/2⌋+1. Three members tolerate one failure; five tolerate two. Four members still tolerate only one, which is why odd sizes are recommended.
- **Losing quorum.** If a majority is unreachable, the cluster refuses writes rather than risk divergence – it chooses **consistency over availability** during the partition (the CAP trade-off).`,
    components: [
      { name: 'Raft leader', description: 'Single member that orders all writes; re-elected automatically if it fails.' },
      { name: 'Quorum', description: 'A majority of members, ⌊n/2⌋+1. Needed both to elect a leader and to commit a write.' },
      { name: 'Idempotent operation', description: 'Safe to repeat. Declarative "make it look like this" requests are naturally idempotent.' },
      { name: 'Optimistic concurrency', description: 'Writers include the version they read; the write fails if someone changed it meanwhile. Kubernetes uses `metadata.resourceVersion` for this.' },
      { name: 'Eventual consistency', description: 'Components converge to the desired state over time instead of all at once.' },
    ],
    misconceptions: [
      {
        myth: 'More etcd members always means more resilience.',
        reality: 'Fault tolerance only increases at odd sizes (3 → 1 failure, 5 → 2). Every extra member also adds replication latency to every write. 3 or 5 is typical.',
      },
      {
        myth: 'If an API call succeeded, the change is already in effect everywhere.',
        reality: 'A successful `kubectl apply` means the desired state was **stored in etcd**. Scheduling, image pulls and container starts happen afterwards, asynchronously.',
      },
      {
        myth: 'Retries are always safe.',
        reality: 'Only for **idempotent** operations. Retrying a non-idempotent "increment" or "charge" can apply it twice.',
      },
    ],
    example: {
      title: 'Optimistic concurrency in Kubernetes',
      description: `Every object carries a \`resourceVersion\`. If two clients read version 4812 and both try to update, the first update wins and the second gets an HTTP **409 Conflict**; it must re-read and retry. Nothing is locked, and no update is silently lost.`,
      language: 'bash',
      code: `kubectl get deployment web -o jsonpath='{.metadata.resourceVersion}'
# 4812

# client A and client B both edit based on 4812
# A's update is accepted -> resourceVersion becomes 4830
# B's update still claims 4812 -> rejected:
#   Error from server (Conflict): Operation cannot be fulfilled on
#   deployments.apps "web": the object has been modified;
#   please apply your changes to the latest version and try again`,
    },
    exercise: {
      prompt: `An etcd cluster has 5 members spread across 3 zones as 2 + 2 + 1. Zone A (2 members) goes offline. Can the cluster still accept writes? What if zone B also fails?`,
      solution: `Quorum for 5 members is 3. After zone A fails, 3 members remain (zone B: 2, zone C: 1) – still a majority, so the cluster elects a leader if needed and keeps accepting writes.

If zone B also fails, only 1 member remains. It cannot form a majority, so the cluster **stops accepting writes** (reads of possibly-stale data aside) until quorum is restored. Running Pods keep running – the kubelets just cannot get new instructions.`,
    },
    faq: [
      {
        q: 'What is the difference between level-triggered and edge-triggered?',
        a: 'Edge-triggered logic reacts to **events** ("a Pod was deleted"); if an event is missed, the system is wrong forever. Level-triggered logic looks at the **current state** each time ("are there 3 Pods?"). Kubernetes controllers are level-triggered, which makes them robust to missed events and restarts.',
      },
      {
        q: 'Does the KCNA test the Raft algorithm in detail?',
        a: 'No. Know that etcd uses Raft-based consensus, needs a majority quorum, and is usually run with an odd number of members (3 or 5).',
      },
      {
        q: 'Is Kubernetes "eventually consistent" in its storage?',
        a: 'etcd itself is strongly consistent (linearizable writes via Raft). The **cluster as a whole** – Pods, endpoints, DNS – is eventually consistent, because many independent controllers converge the actual state towards the stored desired state.',
      },
    ],
    keyTerms: ['partial failure', 'consensus', 'Raft', 'quorum', 'idempotency', 'eventual consistency', 'CAP theorem', 'resourceVersion'],
    deeper: `The CAP theorem says that during a network partition a system must choose between consistency and availability. etcd chooses consistency (a minority partition rejects writes). Many caches and DNS systems choose availability and accept stale answers. The "fallacies of distributed computing" (the network is reliable, latency is zero, ...) are a useful checklist when designing cloud-native services.`,
    references: [
      { title: 'The Raft consensus algorithm', url: 'https://raft.github.io/' },
      { title: 'etcd documentation', url: 'https://etcd.io/docs/' },
      { title: 'Kubernetes – Controllers', url: 'https://kubernetes.io/docs/concepts/architecture/controller/' },
    ],
  },

  // ───────────────────────────── Stage 1 · Architecture ─────────────────────────────
  {
    id: 'cluster-architecture',
    title: 'Cluster architecture: control plane and nodes',
    stage: 1,
    order: 1,
    objectives: ['kf-core'],
    scope: 'kcna',
    estMinutes: 20,
    summary:
      'A Kubernetes cluster is a control plane that stores and decides, plus worker nodes that run containers. Every component talks through the API server; only the API server talks to etcd.',
    what: `A **cluster** has two halves.

The **control plane** is the brain. It stores the desired state and makes decisions:

- **kube-apiserver** – the front door; every read and write goes through it.
- **etcd** – consistent key-value store holding all cluster data.
- **kube-scheduler** – picks a node for each new Pod.
- **kube-controller-manager** – runs the built-in control loops (Deployments, ReplicaSets, Nodes, Jobs...).
- **cloud-controller-manager** – optional; integrates with a cloud provider (load balancers, node lifecycle, routes).

**Worker nodes** are the muscle. Each one runs:

- **kubelet** – the node agent that makes the containers for its Pods actually run.
- **container runtime** – containerd or CRI-O, behind the CRI.
- **kube-proxy** – programs node networking for Services (optional with some CNI plugins).

Cluster **add-ons** such as CoreDNS and a CNI network plugin run on top, usually as Pods themselves.`,
    why: `The KCNA's largest domain starts here: you will be asked which component does what, which component stores state, and what happens when one fails. The picture also explains the design principle that runs through all of Kubernetes: components are **decoupled** and communicate only through the API, so each can be replaced, scaled or restarted independently.`,
    problem: `Running containers by hand on many servers raises questions no single machine can answer: which server has room? What happens when a server dies at 3 a.m.? Who notices that only 2 of 3 copies are running? Kubernetes centralizes the **record of what should exist** and distributes the **work of making it so** to small, specialized components and node agents.`,
    how: `Think of it as a company:

- **etcd** is the filing cabinet: the only place the truth is written down.
- **kube-apiserver** is the front desk. Nobody opens the cabinet directly; everyone files and reads through the desk, which checks identity and permissions.
- **Controllers** are department managers who keep reading the files and issuing work orders: "the Deployment wants 3 Pods, I see 2, file one more Pod".
- **kube-scheduler** is the dispatcher who assigns each new Pod to a node by writing the node's name onto it.
- **kubelets** are site supervisors on each node. Each watches the front desk for Pods assigned to its node, gets them running through the container runtime, and reports status back.
- **kube-proxy** on each node maintains the routing so traffic for a Service reaches one of its Pods.

Important consequences:

- **Hub and spoke.** Components coordinate by **watching** and writing through the API server rather than calling each other. Only the API server talks to etcd.
- **Running Pods survive control-plane outages.** If the control plane is down, existing containers keep running; you just cannot change anything, and failed Pods are not replaced.
- **High availability** means running several API servers behind a load balancer, an odd number of etcd members, and leader election for the scheduler and controller manager (one active instance each).`,
    components: [
      { name: 'kube-apiserver', description: 'REST front end and the only component that reads/writes etcd. Horizontally scalable.' },
      { name: 'etcd', description: 'Raft-replicated key-value store; the cluster\'s single source of truth. Back it up.' },
      { name: 'kube-scheduler', description: 'Assigns unscheduled Pods to nodes; does not start containers itself.' },
      { name: 'kube-controller-manager', description: 'One binary running many controllers (Deployment, ReplicaSet, Node, Job, EndpointSlice, ServiceAccount...).' },
      { name: 'kubelet', description: 'Node agent: registers the node, runs Pods assigned to it via the CRI, executes probes, reports status.' },
      { name: 'kube-proxy', description: 'Implements Service virtual IPs on each node using iptables, IPVS or nftables rules.' },
    ],
    misconceptions: [
      {
        myth: 'The scheduler starts containers on the chosen node.',
        reality: 'The scheduler only **records the decision** (it binds the Pod, setting `spec.nodeName`). The kubelet on that node notices and starts the containers.',
      },
      {
        myth: 'If the control plane goes down, all applications stop.',
        reality: 'Running containers keep running and kube-proxy rules stay in place. What stops is change: no new scheduling, no self-healing, no `kubectl` operations.',
      },
      {
        myth: 'The kubelet runs only on worker nodes.',
        reality: 'In kubeadm-style clusters the control-plane machines also run a kubelet, which starts the control-plane components as **static Pods** from manifest files on disk.',
      },
    ],
    example: {
      title: 'Look at the architecture of a running cluster',
      description: 'In a kubeadm or kind cluster the control-plane components are visible as Pods in `kube-system`. In managed services (EKS, GKE, AKS) the control plane is hidden and you see only nodes and add-ons.',
      language: 'bash',
      code: `kubectl get nodes -o wide
# NAME                 STATUS   ROLES           VERSION
# kind-control-plane   Ready    control-plane   v1.31.0
# kind-worker          Ready    <none>          v1.31.0

kubectl get pods -n kube-system
# etcd-kind-control-plane                      1/1  Running
# kube-apiserver-kind-control-plane            1/1  Running
# kube-controller-manager-kind-control-plane   1/1  Running
# kube-scheduler-kind-control-plane            1/1  Running
# kube-proxy-7xk2p                             1/1  Running
# coredns-6f6b679f8f-9q2lw                     1/1  Running

kubectl cluster-info`,
    },
    exercise: {
      prompt: `For each event, name the component that reacts first: (a) a user runs \`kubectl apply\`; (b) a new Pod object exists with no node assigned; (c) a Pod has been assigned to \`node-3\`; (d) a ReplicaSet wants 3 Pods but only 2 exist; (e) the cluster needs a cloud load balancer for a Service.`,
      solution: `(a) **kube-apiserver** – authenticates, authorizes, admits and stores the object in etcd.

(b) **kube-scheduler** – selects a node and binds the Pod.

(c) The **kubelet on node-3** – asks the container runtime (via CRI) to start the containers.

(d) The **ReplicaSet controller** in kube-controller-manager – creates one more Pod object.

(e) The service controller in the **cloud-controller-manager** – provisions the load balancer through the cloud API.`,
    },
    faq: [
      {
        q: 'How many control-plane nodes should production have?',
        a: 'Commonly **3** (with stacked etcd, matching an odd etcd member count) so one can fail. Managed Kubernetes services run and scale the control plane for you.',
      },
      {
        q: 'Is CoreDNS part of the control plane?',
        a: 'It is a **cluster add-on**, not one of the core control-plane components, but nearly every cluster runs it because Service discovery depends on DNS.',
      },
      {
        q: 'Can I run my own Pods on control-plane nodes?',
        a: 'Control-plane nodes are normally **tainted** (`node-role.kubernetes.io/control-plane:NoSchedule`) so ordinary Pods avoid them. Single-node test clusters often remove that taint.',
      },
    ],
    keyTerms: ['control plane', 'worker node', 'kube-apiserver', 'etcd', 'kube-scheduler', 'kube-controller-manager', 'kubelet', 'kube-proxy'],
    deeper: `Nodes send heartbeats by renewing **Lease** objects in the \`kube-node-lease\` namespace; the node controller marks a node \`NotReady\`/\`Unknown\` when leases stop and, after a grace period, Pods on it are evicted via taints. etcd can be **stacked** (on the control-plane nodes) or **external** (its own machines), trading simplicity against failure isolation.`,
    references: [
      { title: 'Kubernetes Components', url: 'https://kubernetes.io/docs/concepts/overview/components/' },
      { title: 'Cluster Architecture', url: 'https://kubernetes.io/docs/concepts/architecture/' },
    ],
    diagram: 'cluster-architecture',
  },

  {
    id: 'api-server-and-etcd',
    title: 'The API server and etcd',
    stage: 1,
    order: 2,
    objectives: ['kf-core'],
    scope: 'kcna',
    estMinutes: 25,
    summary:
      'Every request to Kubernetes passes through the API server: authentication, authorization, mutating admission, validation, validating admission, then persistence in etcd. Clients then learn about changes through watches.',
    what: `**kube-apiserver** exposes the Kubernetes API as RESTful HTTP resources such as \`/api/v1/namespaces/default/pods\` and \`/apis/apps/v1/namespaces/default/deployments\`. kubectl, controllers, the scheduler, kubelets and your own tools are all just clients of it.

**etcd** is a distributed, strongly consistent key-value store. The API server serializes every object and stores it under keys (by default with the prefix \`/registry/\`). etcd is the **single source of truth**: if it is not in etcd, the cluster does not know about it.

The API server is the **only** component that talks to etcd. Everything else goes through the API server, which enforces security and validation consistently.`,
    why: `Exam questions love the request chain ("which step rejects a request with an invalid token?", "where would a policy that injects a sidecar run?"). Operationally, etcd is the one stateful thing whose loss destroys the cluster's memory – which is why backing it up is a core admin task.`,
    problem: `If every component wrote directly to the database, each would need to re-implement authentication, permission checks, schema validation and defaults, and one buggy component could corrupt everything. Centralizing access in one API server gives one place for security policy, one place for validation, and one consistent change feed that every client can watch.`,
    how: `Follow \`kubectl apply -f deploy.yaml\` through the API server:

- **Transport.** kubectl reads kubeconfig and sends an HTTPS request with credentials (client certificate, bearer token, or OIDC token).
- **Authentication (who are you?).** Authenticator modules identify the user or ServiceAccount. Failure → \`401 Unauthorized\`.
- **Authorization (may you do this?).** Usually **RBAC** (with the Node authorizer for kubelets) checks verb + resource + namespace. Denied → \`403 Forbidden\`.
- **Mutating admission.** Admission controllers and mutating webhooks may **change** the object – e.g. set defaults, inject a sidecar, add a default StorageClass.
- **Schema validation.** The object is checked against the API schema (field types, required fields).
- **Validating admission.** Controllers, webhooks and ValidatingAdmissionPolicies may **reject** the object – e.g. Pod Security Admission, ResourceQuota. They cannot modify it.
- **Persist.** The object is written to etcd; \`resourceVersion\` is updated. The client gets \`200\`/\`201\`.
- **Notify.** Every client **watching** that resource type receives an event (ADDED/MODIFIED/DELETED) – this is how the Deployment controller learns it has work to do.`,
    components: [
      { name: 'Authentication', description: 'Identifies the caller: X.509 client certs, bearer/ServiceAccount tokens, OIDC. Kubernetes has no User objects; users are external identities.' },
      { name: 'Authorization', description: 'Decides allow/deny, typically via RBAC and the Node authorizer. Default is deny.' },
      { name: 'Admission control', description: 'Mutating phase (may modify) then validating phase (may only reject). Built-in plugins plus webhooks and CEL-based ValidatingAdmissionPolicy.' },
      { name: 'Watch', description: 'Long-lived request that streams changes after a given `resourceVersion`; the basis of every controller.' },
      { name: 'etcd', description: 'Raft-replicated key-value store holding all API objects. Run 3 or 5 members; take regular snapshots.' },
    ],
    misconceptions: [
      {
        myth: 'The scheduler and controllers read etcd directly for speed.',
        reality: 'Only the API server reads and writes etcd. Other components use the API (with local caches fed by watches) – which keeps security and validation in one place.',
      },
      {
        myth: 'Admission controllers run before authorization.',
        reality: 'Order is **authentication → authorization → mutating admission → schema validation → validating admission → etcd**. Admission only sees requests that are already authenticated and authorized.',
      },
      {
        myth: 'Secrets in etcd are encrypted by default.',
        reality: 'By default Secrets are stored **base64-encoded, not encrypted**. Encryption at rest must be configured on the API server (an EncryptionConfiguration, optionally with a KMS provider).',
      },
    ],
    example: {
      title: 'Watching the API, and backing up etcd',
      description: `\`--watch\` uses the same streaming mechanism controllers use. The etcd snapshot command is what an administrator runs on a control-plane node (certificate paths vary per installation).`,
      language: 'bash',
      code: `# Stream changes to Pods in the current namespace (a client-side watch)
kubectl get pods --watch

# See raw API paths and the request chain at high verbosity
kubectl get deployments -v=6
# ... GET https://127.0.0.1:6443/apis/apps/v1/namespaces/default/deployments 200 OK

# Ask the API server what you are allowed to do (authorization check)
kubectl auth can-i create deployments --namespace default

# On a control-plane node: snapshot etcd
ETCDCTL_API=3 etcdctl snapshot save /backup/etcd.db \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key`,
    },
    exercise: {
      prompt: `For each outcome, name the stage of the request chain responsible: (a) \`error: You must be logged in to the server (Unauthorized)\`; (b) a Pod created without a ServiceAccount ends up with \`serviceAccountName: default\`; (c) a privileged Pod is rejected in a namespace labelled \`pod-security.kubernetes.io/enforce: restricted\`; (d) \`User "dev" cannot delete resource "pods"\`.`,
      solution: `(a) **Authentication** – the credentials were missing or invalid (401).

(b) **Mutating admission** – the ServiceAccount admission plugin defaults the field.

(c) **Validating admission** – Pod Security Admission enforces the Pod Security Standards.

(d) **Authorization** – RBAC found no rule granting \`delete\` on \`pods\` (403).`,
    },
    faq: [
      {
        q: 'What happens to the cluster if etcd loses all its data?',
        a: 'The cluster forgets every object: Deployments, Services, Secrets, RBAC. Containers already running keep going for a while, but nothing can be managed or recovered without restoring an etcd **snapshot**.',
      },
      {
        q: 'Why do some API paths start with /api and others with /apis?',
        a: '`/api/v1` is the **core** (legacy) group: Pods, Services, ConfigMaps, Secrets, Namespaces. Named groups live under `/apis/<group>/<version>`, e.g. `/apis/apps/v1` for Deployments.',
      },
      {
        q: 'Can I extend the API?',
        a: 'Yes. **CustomResourceDefinitions** add new resource types that the API server stores in etcd like built-ins; aggregated API servers are the less common alternative. Operators build on CRDs.',
      },
    ],
    keyTerms: ['kube-apiserver', 'etcd', 'authentication', 'authorization', 'admission controller', 'mutating webhook', 'watch', 'API group'],
    deeper: `To avoid hammering the API server, clients use **informers**: one list + watch per resource type, a local in-memory cache, and event handlers that enqueue work. The API server also has its own watch cache in front of etcd. **API Priority and Fairness** queues requests by priority so a noisy client cannot starve system components.`,
    references: [
      { title: 'Controlling Access to the Kubernetes API', url: 'https://kubernetes.io/docs/concepts/security/controlling-access/' },
      { title: 'Admission Control in Kubernetes', url: 'https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/' },
      { title: 'etcd documentation', url: 'https://etcd.io/docs/' },
    ],
    diagram: 'request-flow',
  },

  {
    id: 'control-plane-controllers',
    title: 'Scheduler and controller managers',
    stage: 1,
    order: 3,
    objectives: ['kf-core', 'kf-scheduling'],
    scope: 'kcna',
    estMinutes: 20,
    summary:
      'kube-scheduler decides where each Pod runs by filtering and scoring nodes. kube-controller-manager runs the built-in control loops. cloud-controller-manager holds the loops that need a cloud provider API.',
    what: `Three control-plane programs make decisions; none of them runs containers.

- **kube-scheduler** watches for Pods with no \`spec.nodeName\` and picks the best node for each.
- **kube-controller-manager** is one process bundling many independent **controllers**, each a loop that watches some resources and nudges the cluster towards their spec: ReplicaSet, Deployment, StatefulSet, DaemonSet, Job, CronJob, Node, Namespace, EndpointSlice, ServiceAccount, garbage collector, and more.
- **cloud-controller-manager** (CCM) contains the controllers that must call a cloud provider: the **node** controller (match nodes to cloud instances, remove deleted ones), **route** controller (configure cloud routes for Pod networks) and **service** controller (create cloud load balancers for \`type: LoadBalancer\`).`,
    why: `KCNA asks you to distinguish these clearly: "which component chooses the node?", "which component creates replacement Pods?", "what provisions a cloud load balancer?". Scheduling concepts (resources, taints, affinity) are their own objective, and they all plug into the filter-and-score process described here.`,
    problem: `Separating decisions into small loops makes each one simple and replaceable. One giant "cluster manager" would be hard to extend and a single bug would stall everything. Splitting cloud logic into the CCM let Kubernetes remove provider-specific code from the core and lets each provider release its integration independently.`,
    how: `Follow a single Pod from creation to placement:

- **A controller creates the Pod.** The ReplicaSet controller sees 2 Pods but wants 3, so it creates a Pod object from its template. The Pod has no node yet; it is \`Pending\`.
- **The scheduler queues it.** The scheduler's watch delivers the unscheduled Pod; it enters a priority-ordered **scheduling queue**.
- **Filtering.** The scheduler removes nodes that cannot run the Pod: not enough unreserved CPU/memory for the Pod's **requests**, a **taint** the Pod does not tolerate, a mismatched **nodeSelector** or required **node affinity**, port conflicts, volume topology constraints.
- **Scoring.** Remaining nodes are ranked by plugins – e.g. spreading Pods across nodes/zones, preferring nodes that already have the image, balancing resource use, preferred affinities.
- **Binding.** The highest-scoring node wins (ties broken randomly). The scheduler writes a **Binding**, which sets \`spec.nodeName\`.
- **Unschedulable?** If no node passes filtering, the Pod stays \`Pending\` with a \`FailedScheduling\` event explaining why (e.g. \`0/3 nodes are available: 3 Insufficient cpu\`). Higher-priority Pods may trigger **preemption** of lower-priority ones.
- **Hand-off.** The kubelet on the chosen node takes over.`,
    components: [
      { name: 'kube-scheduler', description: 'Filter → score → bind. Considers requests (not actual usage), taints/tolerations, affinity, topology spread.' },
      { name: 'kube-controller-manager', description: 'Runs built-in controllers in one binary; one active instance via leader election.' },
      { name: 'cloud-controller-manager', description: 'Node, route and service controllers that talk to the cloud provider API. Absent on bare metal unless a provider integration is installed.' },
      { name: 'Leader election', description: 'Multiple replicas of scheduler/controller managers run for HA, but only the lease holder acts.' },
    ],
    misconceptions: [
      {
        myth: 'The scheduler places Pods based on current CPU usage.',
        reality: 'Filtering uses resource **requests** compared to node allocatable minus other Pods\' requests. A node can look idle in metrics and still be "full" for scheduling.',
      },
      {
        myth: 'The scheduler moves Pods to better nodes later.',
        reality: 'Scheduling happens **once** per Pod. A bound Pod is never moved; to "move" it, it must be deleted and a new Pod scheduled. (The separate Descheduler project can evict Pods to trigger this.)',
      },
      {
        myth: 'kube-controller-manager is a single controller.',
        reality: 'It is a **process** containing dozens of independent controllers, each with its own loop.',
      },
    ],
    example: {
      title: 'Reading a scheduling failure',
      description: `The scheduler explains filter failures in events. Here, no node had enough CPU for the Pod's requests, and one node was excluded by a taint.`,
      language: 'bash',
      code: `kubectl describe pod api-7c9d5b7f6-xq2lp
# ...
# Status:  Pending
# Events:
#   Type     Reason            From               Message
#   Warning  FailedScheduling  default-scheduler  0/3 nodes are available:
#     1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: },
#     2 Insufficient cpu. preemption: 0/3 nodes are available:
#     1 Preemption is not helpful for scheduling,
#     2 No preemption victims found for incoming pod.`,
    },
    exercise: {
      prompt: `A Pod requests \`cpu: 2\`. Node A has 4 allocatable CPUs with Pods requesting 3; node B has 8 allocatable CPUs with Pods requesting 5 but carries the taint \`gpu=true:NoSchedule\`; node C has 4 allocatable CPUs with Pods requesting 1. The Pod has no tolerations. Which nodes pass filtering, and where does it go?`,
      solution: `- Node A: 4 − 3 = 1 CPU free < 2 → **filtered out**.
- Node B: 3 CPUs free, but the Pod does not tolerate \`gpu=true:NoSchedule\` → **filtered out**.
- Node C: 4 − 1 = 3 CPUs free ≥ 2 → **passes**.

Only node C is feasible, so the Pod is bound to node C (scoring is trivial with one candidate).`,
    },
    faq: [
      {
        q: 'Can I run more than one scheduler?',
        a: 'Yes. A Pod can choose one with `spec.schedulerName`; Pods without it use `default-scheduler`.',
      },
      {
        q: 'Who sets a Node to NotReady?',
        a: 'The **node lifecycle controller** in kube-controller-manager, when the kubelet stops renewing its heartbeat. After a timeout, taints cause Pods on that node to be evicted so their controllers replace them elsewhere.',
      },
      {
        q: 'What if I bypass the scheduler by setting nodeName myself?',
        a: 'Setting `spec.nodeName` in the manifest skips scheduling entirely; the named node\'s kubelet just tries to run it. Filtering (resources, taints) is not checked, so the Pod may be rejected by that kubelet.',
      },
    ],
    keyTerms: ['kube-scheduler', 'filtering', 'scoring', 'binding', 'kube-controller-manager', 'cloud-controller-manager', 'leader election', 'FailedScheduling'],
    deeper: `The scheduler is built on the **scheduling framework**: extension points (PreFilter, Filter, Score, Reserve, Permit, Bind...) where plugins hook in, configured through scheduler profiles. Custom schedulers for batch/AI workloads (e.g. gang scheduling) plug in this way or run alongside the default scheduler.`,
    references: [
      { title: 'Kubernetes Scheduler', url: 'https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/' },
      { title: 'Controllers', url: 'https://kubernetes.io/docs/concepts/architecture/controller/' },
      { title: 'Cloud Controller Manager', url: 'https://kubernetes.io/docs/concepts/architecture/cloud-controller/' },
    ],
  },

  {
    id: 'node-components',
    title: 'Node components: kubelet, runtime, kube-proxy',
    stage: 1,
    order: 4,
    objectives: ['kf-core', 'kf-containerization'],
    scope: 'kcna',
    estMinutes: 20,
    summary:
      'On each node the kubelet turns Pod specs into running containers by calling a container runtime through the CRI (containerd or CRI-O, which call runc). kube-proxy programs Service routing.',
    what: `Look at the cluster from a single node's point of view:

- **kubelet** – the node's agent. It registers the node with the API server, watches for Pods bound to it, makes their containers run, mounts volumes, runs probes, and reports Pod and node status.
- **Container Runtime Interface (CRI)** – a gRPC API between the kubelet and the runtime. Any runtime implementing it works.
- **High-level runtime** – **containerd** or **CRI-O**: pulls images, manages storage, creates the Pod sandbox and containers.
- **Low-level OCI runtime** – usually **runc** (alternatives: crun, gVisor's runsc, Kata). Creates the actual namespaced, cgrouped process.
- **kube-proxy** – watches Services and EndpointSlices and programs rules (iptables, IPVS, or nftables in newer versions) so a Service IP reaches a backend Pod. Some CNI plugins replace it entirely.
- **CNI plugin** – called by the runtime to give each Pod sandbox a network interface and IP.`,
    why: `The 1.24 **dockershim removal** made "Kubernetes runtime" a common exam topic: the kubelet only speaks CRI, and Docker Engine does not implement CRI natively. Knowing the chain kubelet → CRI → containerd/CRI-O → runc also tells you where to look when a Pod is stuck in \`ContainerCreating\` or \`ImagePullBackOff\`.`,
    problem: `Early Kubernetes hard-coded Docker support into the kubelet (dockershim). Every new runtime needed kubelet changes, and the extra Docker daemon layer added complexity. The CRI defined a stable plug-in boundary, so the kubelet stays the same while runtimes evolve independently – the same "define an interface" pattern as CNI for networking and CSI for storage.`,
    how: `What the kubelet does when a Pod is bound to its node:

- **Observe.** Its watch on the API server delivers a Pod with \`spec.nodeName\` equal to this node.
- **Admit.** It checks node-level conditions (enough resources, no node pressure that blocks admission).
- **Prepare volumes.** ConfigMaps, Secrets, emptyDirs and persistent volumes are attached and mounted; the kubelet waits for this before starting the Pod.
- **Create the sandbox.** CRI \`RunPodSandbox\`: the runtime creates the Pod's shared namespaces (notably the network namespace, held by a tiny "pause" container in containerd/CRI-O). The **CNI plugin** attaches a network interface and assigns the Pod IP.
- **Pull images.** CRI \`PullImage\` according to \`imagePullPolicy\`.
- **Start containers.** Init containers run first, one by one, to completion; then the app containers start via CRI \`CreateContainer\`/\`StartContainer\`. The runtime hands an OCI bundle to runc, which creates the process.
- **Supervise.** The kubelet runs liveness/readiness/startup probes, restarts failed containers per \`restartPolicy\` (with exponential back-off), and reports status (\`Running\`, \`Ready\`, restart counts) to the API server.
- **Heartbeat.** It updates the node's Lease and status so the control plane knows the node is alive.`,
    components: [
      { name: 'kubelet', description: 'Node agent; the only component that actually causes containers to start on a node. Also runs **static Pods** from local manifest files.' },
      { name: 'CRI', description: 'gRPC interface (RuntimeService + ImageService) between kubelet and runtime.' },
      { name: 'containerd', description: 'CNCF graduated high-level runtime with a built-in CRI plugin; default in many distributions and managed services.' },
      { name: 'CRI-O', description: 'Lightweight runtime built specifically for the Kubernetes CRI; a CNCF project used e.g. by OpenShift.' },
      { name: 'runc', description: 'Reference OCI runtime that creates container processes from bundles.' },
      { name: 'kube-proxy', description: 'Per-node Service implementation; typically a DaemonSet. Does not proxy traffic in user space in modern modes – it programs the kernel.' },
    ],
    misconceptions: [
      {
        myth: 'After dockershim removal, images built with Docker no longer work.',
        reality: 'Docker builds standard OCI images; containerd and CRI-O run them unchanged. Only using **Docker Engine as the node runtime** was affected (it now needs the external cri-dockerd adapter).',
      },
      {
        myth: 'kube-proxy carries all Service traffic through itself.',
        reality: 'In iptables/IPVS/nftables modes kube-proxy only **writes kernel rules**; packets are redirected by the kernel. kube-proxy can be down briefly without breaking existing rules.',
      },
      {
        myth: 'The kubelet manages any container on the node.',
        reality: 'The kubelet manages containers for **Pods** (from the API server or static manifests). Containers started directly with a runtime CLI are invisible to Kubernetes.',
      },
    ],
    example: {
      title: 'Inspecting the node layer',
      description: `\`crictl\` is the CRI debugging CLI; it talks to the same socket the kubelet uses, so it shows exactly what the kubelet sees. Run it on a node (e.g. \`docker exec -it kind-worker bash\` in kind).`,
      language: 'bash',
      code: `# Which runtime does each node use?
kubectl get nodes -o wide
# NAME          ...  CONTAINER-RUNTIME
# kind-worker   ...  containerd://1.7.18

# On the node: list Pod sandboxes and containers through the CRI
crictl pods
crictl ps
crictl images

# kubelet logs on a systemd-based node
journalctl -u kubelet --since "10 min ago"`,
    },
    exercise: {
      prompt: `A Pod is stuck in \`ContainerCreating\` for several minutes. List which node-level component could be responsible at each step of the kubelet's start-up sequence, and one concrete thing that could go wrong for each.`,
      solution: `- **Sandbox / CNI:** the CNI plugin is missing or failing → events like \`failed to setup network for sandbox\`.
- **Volumes (kubelet):** a referenced ConfigMap/Secret does not exist, or a persistent volume cannot attach/mount → \`FailedMount\` events.
- **Image pull (runtime):** pull is slow or failing → usually shown as \`ErrImagePull\`/\`ImagePullBackOff\` rather than \`ContainerCreating\`.
- **Runtime itself:** containerd/CRI-O is unhealthy → kubelet logs show CRI errors and the node may go \`NotReady\`.

\`kubectl describe pod\` (events) is the first place to look; kubelet logs on the node are the next.`,
    },
    faq: [
      {
        q: 'Is Docker still useful with Kubernetes?',
        a: 'Yes – for **building** images and local development. It is just not the recommended node runtime. Tools like kind even run whole Kubernetes nodes inside Docker containers.',
      },
      {
        q: 'What is the pause container?',
        a: 'A tiny container that holds the Pod\'s shared namespaces (especially the network namespace) so app containers can restart without losing the Pod IP. It is an implementation detail of runtimes like containerd and CRI-O.',
      },
      {
        q: 'Do I always need kube-proxy?',
        a: 'Most clusters run it. Some CNI plugins (Cilium in kube-proxy replacement mode, for example) implement Services with eBPF instead, so kube-proxy is not deployed.',
      },
    ],
    keyTerms: ['kubelet', 'CRI', 'containerd', 'CRI-O', 'runc', 'kube-proxy', 'dockershim', 'static Pod'],
    deeper: `Static Pods are how kubeadm runs the control plane: the kubelet reads manifests from a directory (commonly \`/etc/kubernetes/manifests\`) and creates the Pods without any API server involvement, then publishes read-only "mirror Pods" to the API. The kubelet also enforces node-pressure **eviction** when memory or disk runs low, evicting Pods by QoS class and usage.`,
    references: [
      { title: 'Kubernetes Components', url: 'https://kubernetes.io/docs/concepts/overview/components/' },
      { title: 'Container Runtime Interface (CRI)', url: 'https://kubernetes.io/docs/concepts/architecture/cri/' },
      { title: 'Container Runtimes', url: 'https://kubernetes.io/docs/setup/production-environment/container-runtimes/' },
    ],
  },

  {
    id: 'declarative-reconciliation',
    title: 'Desired state and reconciliation',
    stage: 1,
    order: 5,
    objectives: ['kf-core'],
    scope: 'kcna',
    estMinutes: 20,
    summary:
      'You declare what should exist; controllers repeatedly observe actual state, compare it with desired state, and act to close the gap. kubectl apply is the declarative way to submit desired state.',
    what: `**Desired state** is what you write in an object's \`spec\` ("3 replicas of image v2"). **Actual state** is what is really running, reported in \`status\`. A **controller** is a loop that never stops trying to make actual match desired. This pattern is called **reconciliation**.

Two ways to talk to Kubernetes:

- **Imperative** – tell it *what to do*: \`kubectl create deployment\`, \`kubectl scale --replicas=5\`, \`kubectl delete pod\`. Fast for experiments; nothing records why.
- **Declarative** – tell it *what you want*: keep manifests in files (ideally Git) and run \`kubectl apply -f\`. Kubernetes works out the changes.`,
    why: `Reconciliation is the single most important idea in Kubernetes: it explains self-healing, rolling updates, scaling, GitOps and operators. Exam questions often describe a symptom ("I deleted a Pod and it came back") whose answer is "a controller reconciled it".`,
    problem: `Scripts that execute steps ("start 3 containers") work only if the world is exactly as the script expected and nothing changes afterwards. Servers crash, someone deletes something by hand, a step fails half-way. A declarative system does not care how you got here – it compares where you are with where you should be and corrects the difference, every time.`,
    how: `A thermostat is the classic analogy: you set 21 °C (desired), it measures 19 °C (actual), it turns on the heat (act), and it keeps checking. A Kubernetes controller does the same:

- **Observe.** Watch the relevant objects through the API server (e.g. a ReplicaSet and the Pods it owns).
- **Compare.** Desired: \`spec.replicas: 3\`. Actual: 2 Pods match the selector.
- **Act.** Make the smallest change that moves towards desired: create 1 Pod. Never "start from scratch".
- **Report.** Update \`status\` (e.g. \`readyReplicas\`) so others can observe progress.
- **Repeat.** Triggered by watch events **and** periodic resyncs. Because the logic is based on current state (level-triggered), a missed event or a controller restart does no harm.

How \`kubectl apply\` fits in:

- On the first apply, the object is created. kubectl records what you applied (client-side: in the \`kubectl.kubernetes.io/last-applied-configuration\` annotation; server-side apply: as **managed fields** per field manager).
- On later applies, kubectl computes a **three-way merge** of your file, the last-applied state and the live object, and sends a patch. Fields you removed from the file are removed; fields set by others (e.g. an autoscaler) are left alone.
- \`kubectl diff -f\` shows what an apply would change before you run it.`,
    components: [
      { name: 'spec', description: 'Desired state, written by users or higher-level controllers.' },
      { name: 'status', description: 'Observed state, written by controllers and kubelets.' },
      { name: 'Controller / control loop', description: 'Observe → compare → act → repeat. Each controller owns one concern.' },
      { name: 'kubectl apply', description: 'Declarative create-or-update from files using a merge of file, last-applied and live state.' },
      { name: 'Operator', description: 'A custom controller (usually with CRDs) that encodes operational knowledge for an application, e.g. a database.' },
    ],
    misconceptions: [
      {
        myth: 'Declarative means kubectl never changes anything until I re-apply.',
        reality: 'Controllers act continuously. If a Pod dies, a replacement appears without any new apply – the desired state is still stored.',
      },
      {
        myth: '`kubectl apply` and `kubectl create` are interchangeable.',
        reality: '`create` fails if the object exists (`AlreadyExists`). `apply` creates **or** updates and tracks what you manage. Mixing them on the same object is a common source of surprises.',
      },
      {
        myth: 'Fixing a running Pod by hand is a permanent fix.',
        reality: 'If the Pod is owned by a controller, the next replacement Pod comes from the **template**. Manual changes to live objects (`kubectl edit`) also drift from what is in Git and may be overwritten by the next apply or a GitOps sync.',
      },
    ],
    example: {
      title: 'Watch a control loop heal',
      description: 'Delete a Pod owned by a Deployment and the ReplicaSet controller restores the count. Then change the desired state declaratively and preview it first.',
      language: 'bash',
      code: `kubectl apply -f web-deployment.yaml          # replicas: 3
kubectl get pods -l app=web
# web-5d8f7c6b9-2kq4x  Running
# web-5d8f7c6b9-8hz7m  Running
# web-5d8f7c6b9-tw9pd  Running

kubectl delete pod web-5d8f7c6b9-2kq4x
kubectl get pods -l app=web
# web-5d8f7c6b9-8hz7m  Running
# web-5d8f7c6b9-tw9pd  Running
# web-5d8f7c6b9-x7n2c  ContainerCreating    <- replacement

# change replicas: 3 -> 5 in the file, then:
kubectl diff -f web-deployment.yaml          # preview the change
kubectl apply -f web-deployment.yaml`,
    },
    exercise: {
      prompt: `A teammate runs \`kubectl scale deployment web --replicas=10\` during an incident. The manifest in Git says \`replicas: 3\`, and a GitOps tool applies Git every few minutes. What happens next, and what should they have done instead?`,
      solution: `The imperative scale changes the live desired state to 10, and the controller creates 7 Pods. On the next sync the GitOps tool re-applies Git, setting \`replicas\` back to **3**, and the extra Pods are removed – possibly mid-incident.

Better: change \`replicas\` in Git (so the declared state is the real intent), or let a HorizontalPodAutoscaler own the replica count and remove \`replicas\` from the manifest so the two do not fight.`,
    },
    faq: [
      {
        q: 'If everything is declarative, why does kubectl have imperative commands?',
        a: 'They are convenient for learning, debugging and generating starter YAML (`kubectl create deployment web --image=nginx --dry-run=client -o yaml`). For anything long-lived, store manifests and apply them.',
      },
      {
        q: 'What is server-side apply?',
        a: '`kubectl apply --server-side` performs the merge on the API server and records which **field manager** owns each field, reporting conflicts when two managers set the same field. It is the alternative to the last-applied annotation used by client-side apply, which remains the kubectl default.',
      },
      {
        q: 'How fast does reconciliation happen?',
        a: 'Usually within seconds, because controllers react to watch events. But it is asynchronous: `apply` returning success means the desired state was stored, not that it is achieved. Use `kubectl rollout status` or `kubectl get -w` to watch convergence.',
      },
    ],
    keyTerms: ['desired state', 'actual state', 'reconciliation', 'control loop', 'declarative', 'imperative', 'kubectl apply', 'operator'],
    deeper: `Controllers are written as a work queue fed by informers: events only enqueue an object key, and a worker re-reads the latest state before acting. This is why controllers are idempotent and tolerate duplicate or out-of-order events. The same pattern scales out to GitOps: Argo CD and Flux are reconcilers whose "desired state" lives in Git instead of etcd.`,
    references: [
      { title: 'Controllers', url: 'https://kubernetes.io/docs/concepts/architecture/controller/' },
      { title: 'Declarative Management of Kubernetes Objects Using Configuration Files', url: 'https://kubernetes.io/docs/tasks/manage-kubernetes-objects/declarative-config/' },
      { title: 'Kubernetes Object Management', url: 'https://kubernetes.io/docs/concepts/overview/working-with-objects/object-management/' },
    ],
    diagram: 'reconciliation-loop',
  },

  // ───────────────────────────── Stage 2 · Workloads ─────────────────────────────
  {
    id: 'pods',
    title: 'Pods',
    stage: 2,
    order: 1,
    objectives: ['kf-core'],
    scope: 'kcna',
    estMinutes: 25,
    summary:
      'A Pod is the smallest deployable unit: one or more containers that share a network namespace and volumes and are always scheduled together. Pods are disposable; controllers recreate them.',
    what: `A **Pod** wraps one or more containers that must live together:

- They are **scheduled onto the same node** as a unit.
- They share one **network namespace**: one Pod IP, one port space; containers talk over \`localhost\`.
- They can share **volumes** declared at Pod level.
- They share a lifecycle: the Pod is created, runs, and is deleted as one object.

Container roles inside a Pod:

- **App containers** – the main workload; started together, run in parallel.
- **Init containers** – run **one at a time, to completion**, before app containers start (wait for a dependency, run a migration, fetch config).
- **Sidecar containers** – helpers that run alongside the app for the Pod's whole life (log shipping, proxies). Native sidecars are declared as init containers with \`restartPolicy: Always\` (stable since Kubernetes 1.33): they start before the app containers, keep running, and are stopped after them.`,
    why: `Everything that runs in Kubernetes runs in a Pod – Deployments, Jobs, StatefulSets all create Pods. Pod phases, restart policies and container states are exactly what you see in \`kubectl get pods\` when something is wrong, and they come up repeatedly on the exam.`,
    problem: `Some processes are tightly coupled: a web server and the agent that ships its logs, or an app and its local proxy. Putting them in one container breaks "one process per container" and couples their images and releases. Putting them in separate, independently scheduled units loses \`localhost\` and shared files. The Pod is the middle ground: separate images, shared context.`,
    how: `Follow the Pod lifecycle as a state machine.

**Pod phase** (\`status.phase\`) – a coarse summary:

- \`Pending\` – accepted, but not all containers are running yet: waiting to be scheduled, pulling images, or running init containers.
- \`Running\` – bound to a node, all containers created, at least one running (or starting/restarting).
- \`Succeeded\` – all containers exited 0 and will not restart.
- \`Failed\` – all containers terminated and at least one failed (non-zero exit or killed) and will not restart.
- \`Unknown\` – the node cannot be reached, so status cannot be obtained.

**Container state** (per container) – \`Waiting\` (with a reason such as \`ContainerCreating\`, \`ImagePullBackOff\`, \`CrashLoopBackOff\`), \`Running\`, or \`Terminated\` (with exit code and reason such as \`Completed\`, \`Error\`, \`OOMKilled\`).

**restartPolicy** (Pod-level, applies to app containers): \`Always\` (default; required for Deployments), \`OnFailure\` (restart only on non-zero exit; common for Jobs), \`Never\`. Restarts happen **in place on the same node** with exponential back-off (10s, 20s, 40s ... capped at 5 minutes) – that back-off is what \`CrashLoopBackOff\` means.

**Termination:** on delete, the Pod is marked terminating, removed from Service endpoints, any \`preStop\` hook runs, containers get \`SIGTERM\`, and after \`terminationGracePeriodSeconds\` (default 30) the remaining ones get \`SIGKILL\`.`,
    components: [
      { name: 'Pod IP / network namespace', description: 'One IP per Pod, shared by all its containers. Two containers in a Pod cannot both listen on the same port.' },
      { name: 'Init containers', description: 'Sequential, run-to-completion setup steps. If one fails, the kubelet retries it (per restartPolicy) and app containers do not start.' },
      { name: 'Sidecar containers', description: 'Init containers with `restartPolicy: Always`; run for the Pod\'s lifetime and do not block Job completion.' },
      { name: 'restartPolicy', description: '`Always` | `OnFailure` | `Never`, set once for the whole Pod.' },
      { name: 'Phase vs conditions', description: 'Phase is a summary; conditions (`PodScheduled`, `Initialized`, `ContainersReady`, `Ready`) give detail. `Ready` controls Service traffic.' },
    ],
    misconceptions: [
      {
        myth: '`CrashLoopBackOff` is a Pod phase.',
        reality: 'It is a **container waiting reason**: the container keeps crashing and the kubelet is backing off before the next restart. The Pod phase is usually still `Running`.',
      },
      {
        myth: 'A Pod that crashes gets rescheduled to another node.',
        reality: 'Containers are restarted **in place** by the kubelet. A Pod is never moved; only a controller can create a **new** Pod (with a new name and IP) elsewhere – for example after the Pod is deleted or its node fails.',
      },
      {
        myth: 'Each container in a Pod gets its own IP.',
        reality: 'The **Pod** gets one IP. Containers inside share it and distinguish themselves by port.',
      },
    ],
    example: {
      title: 'Init container, native sidecar and app in one Pod',
      description: `The init container waits for the \`db\` Service to resolve. The sidecar (an init container with \`restartPolicy: Always\`) tails the app's log file from a shared \`emptyDir\` volume and keeps running alongside the app.`,
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: shop
  labels:
    app: shop
spec:
  restartPolicy: Always
  volumes:
  - name: logs
    emptyDir: {}
  initContainers:
  - name: wait-for-db
    image: busybox:1.36
    command: ["sh", "-c", "until nslookup db; do echo waiting; sleep 2; done"]
  - name: log-shipper              # native sidecar
    image: busybox:1.36
    restartPolicy: Always
    command: ["sh", "-c", "tail -F /var/log/app/app.log"]
    volumeMounts:
    - name: logs
      mountPath: /var/log/app
  containers:
  - name: app
    image: registry.example.com/shop/app:1.4.2
    ports:
    - containerPort: 8080
    volumeMounts:
    - name: logs
      mountPath: /var/log/app`,
    },
    exercise: {
      prompt: `Predict \`kubectl get pod\` output for each case: (a) the \`db\` Service in the example does not exist yet; (b) the app container exits with code 1 every few seconds; (c) the app container finishes with exit code 0 (restartPolicy \`Always\`).`,
      solution: `(a) The first init container never completes. STATUS shows \`Init:0/2\`, phase \`Pending\`; the app container never starts.

(b) The kubelet restarts it with growing back-off. STATUS alternates between \`Error\` and \`CrashLoopBackOff\`, the RESTARTS count climbs, phase stays \`Running\`.

(c) With \`Always\`, even a clean exit triggers a restart, so you again see RESTARTS increasing (and eventually \`CrashLoopBackOff\`). A run-to-completion task belongs in a **Job** with \`OnFailure\` or \`Never\`.`,
    },
    faq: [
      {
        q: 'When should I put two containers in one Pod?',
        a: 'Only when they must share lifecycle, network or files – a sidecar proxy, log shipper or config reloader. If they could scale independently (a web app and its database), use separate Pods.',
      },
      {
        q: 'Should I create Pods directly?',
        a: 'Rarely. A bare Pod is not recreated if it is deleted or its node fails. Use a controller – Deployment, StatefulSet, DaemonSet or Job – that manages Pods from a template. Note that `kubectl run` creates only a single bare Pod.',
      },
      {
        q: 'Can I change a running Pod\'s spec?',
        a: 'Mostly no – most Pod spec fields are immutable (image is a notable exception). In practice you change the controller\'s template and let it replace Pods.',
      },
      {
        q: 'What is the difference between Running and Ready?',
        a: '`Running` means the containers are started. `Ready` means readiness probes pass and the Pod should receive Service traffic. A Pod can be Running but not Ready.',
      },
    ],
    keyTerms: ['Pod', 'init container', 'sidecar container', 'Pod phase', 'container state', 'restartPolicy', 'CrashLoopBackOff', 'terminationGracePeriodSeconds'],
    deeper: `**Ephemeral containers** can be added to a running Pod for debugging (\`kubectl debug\`); they cannot be restarted and have no ports or probes. **Static Pods** are created by a kubelet from local files rather than the API. The **Pod overhead** and **Pod-level resources** features let the scheduler account for sandbox costs or set budgets for the whole Pod – check feature states for your version.`,
    references: [
      { title: 'Pods', url: 'https://kubernetes.io/docs/concepts/workloads/pods/' },
      { title: 'Pod Lifecycle', url: 'https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/' },
      { title: 'Sidecar Containers', url: 'https://kubernetes.io/docs/concepts/workloads/pods/sidecar-containers/' },
    ],
  },

  {
    id: 'replicasets-and-deployments',
    title: 'ReplicaSets and Deployments',
    stage: 2,
    order: 2,
    objectives: ['kf-core'],
    scope: 'kcna',
    estMinutes: 25,
    summary:
      'A ReplicaSet keeps N identical Pods running. A Deployment manages ReplicaSets to add rolling updates and rollbacks. Ownership links the three levels, and garbage collection cleans up children.',
    what: `Two controllers stacked on top of each other:

- **ReplicaSet** – ensures that a specified number of Pods matching its **selector** exist. It creates Pods from its **Pod template** when there are too few and deletes some when there are too many. It does not know about versions.
- **Deployment** – the object you normally write for stateless apps. It owns ReplicaSets: one per version of the Pod template. Changing the template creates a new ReplicaSet and gradually shifts Pods to it (**rolling update**); old ReplicaSets are kept (scaled to 0) to allow **rollback**.

The chain is **Deployment → ReplicaSet → Pods**, linked by \`metadata.ownerReferences\` on each child.`,
    why: `Deployments are the default way to run stateless workloads, and most exam workload questions touch them: scaling, self-healing, update strategy, rollback, and "who created this Pod?". Understanding the ReplicaSet layer explains the odd Pod names (\`web-5d8f7c6b9-x7n2c\`) and what happens during a rollout.`,
    problem: `Running one Pod is fragile. Running N Pods by hand means noticing failures and replacing them yourself. And updating N Pods by deleting them all and creating new ones causes downtime and gives no way back if the new version is broken. ReplicaSets solve "keep N", Deployments solve "change versions safely".`,
    how: `Run an experiment in your head (or on a cluster):

- **Create.** You apply a Deployment \`web\` with \`replicas: 3\` and image \`nginx:1.26\`. The Deployment controller creates ReplicaSet \`web-<hash>\` (the hash comes from the Pod template and is also added as a \`pod-template-hash\` label). The ReplicaSet controller creates 3 Pods.
- **Break something.** Delete a Pod. The **ReplicaSet** controller (not the Deployment controller) sees 2 < 3 and creates one more.
- **Scale.** \`kubectl scale deployment web --replicas=5\` – the Deployment updates its current ReplicaSet's replica count; no new ReplicaSet is created because the template did not change.
- **Update.** Change the image to \`nginx:1.27\`. The template hash changes, so a **new ReplicaSet** is created. With the default **RollingUpdate** strategy (\`maxSurge: 25%\`, \`maxUnavailable: 25%\`), the controller scales the new one up and the old one down step by step, waiting for new Pods to become Ready.
- **Roll back.** \`kubectl rollout undo deployment/web\` points the Deployment back at the previous template; the old ReplicaSet is scaled up again. How many old ReplicaSets are kept is set by \`revisionHistoryLimit\` (default 10).
- **Delete.** Deleting the Deployment triggers **cascading deletion**: the garbage collector follows ownerReferences and removes the ReplicaSets and Pods.

The **Recreate** strategy is the alternative: scale old Pods to zero first, then create new ones (downtime, but never two versions at once).`,
    components: [
      { name: 'Pod template', description: '`spec.template` – the blueprint for every Pod. Any change to it triggers a rollout.' },
      { name: 'Selector', description: '`spec.selector` must match the template\'s labels; immutable for `apps/v1` Deployments after creation.' },
      { name: 'ReplicaSet', description: 'Keeps the replica count for one template version. Rarely created directly.' },
      { name: 'Rolling update parameters', description: '`maxSurge` (extra Pods allowed above desired) and `maxUnavailable` (Pods allowed below desired); both default to 25%.' },
      { name: 'ownerReferences & garbage collection', description: 'Children point to their owner; deleting the owner removes dependents (cascading deletion) unless orphaning is requested.' },
    ],
    misconceptions: [
      {
        myth: 'Scaling a Deployment creates a new revision.',
        reality: 'Only changes to `spec.template` create a new ReplicaSet/revision. Changing `replicas` adjusts the existing ReplicaSet.',
      },
      {
        myth: 'You should edit the ReplicaSet to change the image.',
        reality: 'The Deployment owns the ReplicaSet and will revert or ignore such changes. Always change the **Deployment**; for a bare ReplicaSet, an edited template only affects Pods created later.',
      },
      {
        myth: 'Rollback restores the previous number of replicas too.',
        reality: '`rollout undo` restores the previous **Pod template**. The replica count is not part of the revision.',
      },
    ],
    example: {
      title: 'A Deployment with an explicit rolling update strategy',
      description: `With 4 replicas, \`maxSurge: 1\` and \`maxUnavailable: 0\`, the rollout never drops below 4 ready Pods and runs at most 5 Pods at a time – zero-downtime at the cost of one extra Pod of capacity.`,
      language: 'yaml',
      code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  labels:
    app: web
spec:
  replicas: 4
  revisionHistoryLimit: 5
  selector:
    matchLabels:
      app: web
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: web          # must match spec.selector
    spec:
      containers:
      - name: web
        image: nginx:1.27
        ports:
        - containerPort: 80
# kubectl set image deployment/web web=nginx:1.28
# kubectl rollout status deployment/web
# kubectl rollout history deployment/web
# kubectl rollout undo deployment/web --to-revision=2`,
    },
    exercise: {
      prompt: `You have Deployment \`api\` with 10 replicas and default rolling update settings. You change the image. (a) What is the maximum number of Pods that may exist during the rollout? (b) The minimum number that must be available? (c) Afterwards, how many ReplicaSets does \`kubectl get rs\` show for \`api\`, and with what replica counts?`,
      solution: `(a) \`maxSurge\` 25% of 10 = 2.5, rounded **up** → 3, so up to **13** Pods.

(b) \`maxUnavailable\` 25% of 10 = 2.5, rounded **down** → 2, so at least **8** available.

(c) **Two** ReplicaSets: the new one with 10 replicas and the old one scaled to **0** (kept for rollback, within \`revisionHistoryLimit\`).`,
    },
    faq: [
      {
        q: 'Why are Pod names like web-5d8f7c6b9-x7n2c?',
        a: '`web` is the Deployment, `5d8f7c6b9` is the ReplicaSet\'s Pod template hash, and `x7n2c` is a random suffix for the individual Pod. It lets you see at a glance which version a Pod belongs to.',
      },
      {
        q: 'How do I find out who owns a Pod?',
        a: 'Look at `metadata.ownerReferences` (`kubectl get pod <name> -o yaml`) or the `Controlled By:` line in `kubectl describe pod`.',
      },
      {
        q: 'When would I use a ReplicaSet directly?',
        a: 'Almost never. Deployments give you everything a ReplicaSet does plus updates and rollbacks. Use StatefulSets for stable identity and DaemonSets for one-Pod-per-node instead.',
      },
    ],
    keyTerms: ['ReplicaSet', 'Deployment', 'Pod template', 'RollingUpdate', 'Recreate', 'maxSurge', 'maxUnavailable', 'ownerReferences'],
    deeper: `\`kubectl rollout pause\` lets you batch several template changes into one rollout. \`progressDeadlineSeconds\` (default 600) marks a rollout as failed (\`ProgressDeadlineExceeded\`) if it stops making progress – it reports, but does not roll back automatically. Garbage collection supports **foreground**, **background** (default) and **orphan** propagation policies, e.g. \`kubectl delete deployment web --cascade=orphan\` keeps the ReplicaSets and Pods.`,
    references: [
      { title: 'Deployments', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/' },
      { title: 'ReplicaSet', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/' },
      { title: 'Garbage Collection', url: 'https://kubernetes.io/docs/concepts/architecture/garbage-collection/' },
    ],
    diagram: 'deployment-hierarchy',
  },

  {
    id: 'namespaces-labels-selectors',
    title: 'Namespaces, labels, selectors and annotations',
    stage: 2,
    order: 3,
    objectives: ['kf-core', 'kf-admin'],
    scope: 'kcna',
    estMinutes: 20,
    summary:
      'Namespaces partition names, permissions and quotas. Labels are queryable key/value tags; selectors are the queries that wire Services, Deployments and policies to Pods. Annotations hold non-identifying metadata.',
    what: `Think of the cluster as a database and these as its organizing tools.

- **Namespace** – a scope for names. Two Deployments called \`web\` can coexist in \`team-a\` and \`team-b\`. Namespaces are also the unit for RBAC Roles, ResourceQuotas, LimitRanges, and (by label) Pod Security Admission. Default ones: \`default\`, \`kube-system\`, \`kube-public\`, \`kube-node-lease\`.
- **Labels** – key/value pairs in \`metadata.labels\` that **identify** objects: \`app: web\`, \`tier: frontend\`, \`env: prod\`. Keys may have a DNS prefix (\`app.kubernetes.io/name\`); the name part is at most 63 characters.
- **Selectors** – queries over labels. **Equality-based**: \`app=web\`, \`env!=prod\`. **Set-based**: \`env in (staging,prod)\`, \`tier notin (cache)\`, \`release\` (key exists), \`!release\` (key absent).
- **Annotations** – key/value pairs in \`metadata.annotations\` for **non-identifying** data: build info, contact, tool configuration. Values can be large; they cannot be selected on.`,
    why: `Labels and selectors are the glue of Kubernetes. Objects are not linked by name but by **label queries**: a Service finds its Pods by selector, a Deployment's ReplicaSet counts Pods by selector, NetworkPolicies and affinity rules select Pods by label. When a Service has no endpoints, a label mismatch is the first suspect. Namespaces are the first tool for multi-team clusters.`,
    problem: `In a cluster with thousands of objects you need to answer "show me all production frontend Pods" and "let team A manage only its own things". Folder-like hierarchies cannot express overlapping views (a Pod is both "frontend" and "prod" and "v2"). Free-form labels with a query language can, and namespaces add hard naming and permission boundaries where you need them.`,
    how: `How a selector connects objects, step by step, using a Service:

- **Label the Pods.** The Deployment template sets \`labels: {app: web, tier: frontend}\` on every Pod it creates.
- **Write the query.** The Service declares \`selector: {app: web}\`. Services support only equality-based selectors (all listed pairs must match).
- **Controller evaluates it.** The EndpointSlice controller lists Pods **in the Service's namespace** that carry \`app=web\` and writes their IPs into EndpointSlices, marking each endpoint ready or not; only ready endpoints receive traffic.
- **Labels change → membership changes.** Remove the \`app=web\` label from one Pod and it drops out of the Service (and out of the ReplicaSet's count, so the ReplicaSet creates a replacement – a handy trick for debugging a Pod in isolation).
- **Namespace boundary.** Selectors in Services, ReplicaSets and Deployments only match objects in the same namespace. Cross-namespace access uses DNS names like \`web.team-a.svc.cluster.local\`.

Note that not everything is namespaced: **Nodes, PersistentVolumes, StorageClasses, Namespaces, ClusterRoles** and CRDs are cluster-scoped. \`kubectl api-resources --namespaced=false\` lists them.`,
    components: [
      { name: 'Namespace', description: 'Scope for names and for RBAC, quotas and policies. Not a network or security boundary by itself.' },
      { name: 'Label', description: 'Identifying key/value pair; indexed and selectable. Recommended keys: `app.kubernetes.io/name`, `/instance`, `/version`, `/component`, `/part-of`, `/managed-by`.' },
      { name: 'Equality-based selector', description: '`=`, `==`, `!=`. Used by Services and `matchLabels`.' },
      { name: 'Set-based selector', description: '`in`, `notin`, exists, does-not-exist. Used by `matchExpressions` (Deployments, Jobs, affinity) and kubectl `-l`.' },
      { name: 'Annotation', description: 'Non-identifying metadata for tools and humans; not selectable.' },
    ],
    misconceptions: [
      {
        myth: 'Namespaces isolate network traffic between teams.',
        reality: 'By default every Pod can reach every other Pod across namespaces. Isolation needs **NetworkPolicies** (and a CNI that enforces them); permission isolation needs **RBAC**.',
      },
      {
        myth: 'Annotations and labels are interchangeable.',
        reality: 'Only labels can be used in selectors. Annotations are for data you want to attach but never query, e.g. a git commit or a tool setting.',
      },
      {
        myth: 'A Service can select Pods in any namespace by label.',
        reality: 'A Service selector only matches Pods in **its own namespace**.',
      },
    ],
    example: {
      title: 'Querying with labels and working across namespaces',
      description: 'Common label and namespace operations with kubectl.',
      language: 'bash',
      code: `kubectl create namespace team-a
kubectl config set-context --current --namespace=team-a   # change default namespace

kubectl get pods --show-labels
kubectl get pods -l app=web                          # equality-based
kubectl get pods -l 'env in (staging,prod),tier!=cache'   # set-based + equality
kubectl get pods -l '!canary'                        # label key absent
kubectl get pods -A -l app=web                       # all namespaces

kubectl label pod web-5d8f7c6b9-x7n2c env=prod       # add a label
kubectl label pod web-5d8f7c6b9-x7n2c env=staging --overwrite
kubectl label pod web-5d8f7c6b9-x7n2c env-           # remove a label
kubectl annotate deployment web owner="team-a@example.com"

kubectl api-resources --namespaced=false             # cluster-scoped kinds`,
    },
    exercise: {
      prompt: `A Service in namespace \`shop\` has \`selector: {app: cart, tier: backend}\`. Pods: (1) \`app=cart, tier=backend\` in \`shop\`; (2) \`app=cart\` in \`shop\`; (3) \`app=cart, tier=backend, version=v2\` in \`shop\`; (4) \`app=cart, tier=backend\` in \`default\`. Which Pods become endpoints (assume all are Ready)?`,
      solution: `**Pods 1 and 3.** A selector requires **all** its pairs to match; extra labels on the Pod (\`version=v2\`) do not matter.

Pod 2 lacks \`tier=backend\`. Pod 4 matches the labels but is in another namespace, and Service selectors only match within the Service's own namespace.`,
    },
    faq: [
      {
        q: 'Does deleting a namespace delete everything inside it?',
        a: 'Yes – all namespaced objects in it are deleted. The namespace sits in `Terminating` until that finishes. Cluster-scoped objects (e.g. PersistentVolumes) are not inside namespaces and follow their own rules.',
      },
      {
        q: 'Should I use namespaces for environments like dev and prod?',
        a: 'It works for small setups, but many organizations put production in a **separate cluster** for stronger isolation. Namespaces are the usual unit for teams or applications within a cluster.',
      },
      {
        q: 'Can I change a Deployment\'s selector later?',
        a: 'No – in `apps/v1` the selector is immutable. Create a new Deployment instead. You *can* add labels to the template, as long as the selector still matches.',
      },
    ],
    keyTerms: ['namespace', 'label', 'label selector', 'matchLabels', 'matchExpressions', 'annotation', 'cluster-scoped', 'namespaced'],
    deeper: `Field selectors (\`--field-selector status.phase=Running\`) filter on a small set of built-in fields, not on arbitrary spec values. Hierarchical namespaces and virtual clusters (e.g. vcluster) are ecosystem projects for stronger multi-tenancy than plain namespaces provide.`,
    references: [
      { title: 'Labels and Selectors', url: 'https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/' },
      { title: 'Namespaces', url: 'https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/' },
      { title: 'Annotations', url: 'https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations/' },
    ],
  },
];
