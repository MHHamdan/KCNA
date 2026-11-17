import type { InfraLesson } from '../types';

// Cloud Infrastructure senior track — stages 0–2 (Networking & Edge, Compute & Platforms, Storage & Data).

const netFundamentals: InfraLesson = {
  id: 'infra-net-fundamentals',
  title: 'Network fundamentals: from URL to bytes',
  stage: 0,
  order: 1,
  objectives: ['net-fundamentals'],
  scope: 'senior',
  estMinutes: 30,
  summary:
    'DNS, TCP, TLS 1.3 and HTTP/1.1–2–3 as one latency budget: what each round trip costs, how congestion control and head-of-line blocking shape throughput, and the kernel-level failure modes (TIME_WAIT, ephemeral ports, negative caching) that show up in production.',
  what: `Network fundamentals for infrastructure interviews is the ability to walk a request end to end and **price every step in round trips (RTTs)**. The layers that matter in practice are the TCP/IP ones: link, IP (routing, MTU), transport (TCP, UDP, QUIC on UDP), and application (DNS, TLS, HTTP). OSI is a vocabulary for talking about "L4" vs "L7"; nobody runs a seven-layer stack.

A senior engineer treats the network as a **latency and failure budget**: a cold HTTPS request to a server 80 ms away costs DNS + TCP handshake + TLS handshake + request before the first byte arrives, and every one of those can fail independently.`,
  why: `Most "the app is slow" and "random 5xx under load" incidents are network-shaped: a DNS TTL that kept clients on a dead IP, a connection pool that re-handshakes TLS on every request, ephemeral ports exhausted by a NAT, an HTTP/2 connection stalled by one lost packet. Interviewers use "what happens when you type a URL" precisely because it reveals whether you can reason across layers, quantify cost, and name the failure mode at each hop.`,
  problem: `Without a mental model of RTTs and congestion control, teams make predictable mistakes: they move a service to another region and are surprised that a chatty protocol with 6 sequential calls adds 6 × 70 ms; they raise bandwidth on a long-haul link and see no throughput change because the TCP window, not the pipe, is the limit; they set DNS TTLs to 1 day and cannot fail over; they open a new connection per request and burn CPU on handshakes while accumulating tens of thousands of sockets in TIME_WAIT.`,
  how: `Walk the request in order and count RTTs.

- **DNS resolution.** The stub resolver asks a recursive resolver (often local cache first). On a miss, the recursive walks root → TLD → authoritative, then caches each answer for its **TTL**. A NXDOMAIN is cached too (**negative caching**, bounded by the SOA minimum/negative TTL), so a record created right after a failed lookup can stay "missing" for minutes. Cached hit: ~0 RTT; cold: several RTTs to distant servers.
- **TCP handshake.** SYN → SYN-ACK → ACK costs **1 RTT** before data can be sent. Data then starts under **slow start**: the congestion window (cwnd) begins small (commonly 10 segments, ~14 KB) and roughly doubles per RTT until loss or the receiver window caps it. Short transfers therefore never reach link speed.
- **TLS 1.3.** Client sends key share in ClientHello; server replies with its share, certificate and Finished in one flight: **1 RTT** for a full handshake (TLS 1.2 needed 2). With a resumption ticket, **0-RTT** lets the client send early data with the first flight, but early data is **replayable** by an attacker, so only idempotent requests (GETs without side effects) should use it.
- **HTTP.** HTTP/1.1 allows one outstanding request per connection in practice, so browsers open ~6 connections per origin. **HTTP/2** multiplexes many streams over one TCP connection with header compression (HPACK), fixing application-level head-of-line (HOL) blocking, but a single lost TCP segment stalls **all** streams until retransmission: transport-level HOL blocking. **HTTP/3** runs over **QUIC** (UDP), which merges transport and TLS 1.3 handshakes into **1 RTT** (0-RTT on resumption), retransmits per stream so loss on one stream does not block others, and supports connection migration via connection IDs (survives a phone switching from Wi-Fi to cellular).
- **Throughput ceiling.** Max throughput of one TCP flow ≈ window / RTT. To fill a pipe you need window ≥ **bandwidth-delay product (BDP)** = bandwidth × RTT.
- **Teardown.** The side that closes first enters **TIME_WAIT** for 2×MSL (60 s on Linux) to absorb stray segments. A client making many short connections to the same destination IP:port can exhaust its **ephemeral port range** (Linux default 32768–60999, ~28k ports), and so can a NAT gateway translating many clients to one IP.`,
  components: [
    { name: 'Recursive resolver and TTLs', description: 'Caches positive answers for the record TTL and negative answers per the SOA. TTL is your failover speed limit: clients and intermediate resolvers may hold an answer for the full TTL, and some clients ignore TTLs entirely (long-lived JVM caches, connection pools pinned to an IP).' },
    { name: 'TCP congestion control', description: 'Slow start, congestion avoidance and loss recovery decide how fast a flow ramps. Loss-based algorithms (CUBIC, the Linux default) back off on loss; model-based BBR estimates bottleneck bandwidth and RTT and degrades less on lossy long paths.' },
    { name: 'TLS 1.3 handshake', description: 'One RTT full handshake, forward secrecy by default, encrypted certificate. Session resumption with PSK tickets enables 0-RTT early data with replay risk. Termination point (LB, sidecar, app) decides where plaintext exists.' },
    { name: 'HTTP/2 multiplexing', description: 'Many concurrent streams over one TCP connection; removes the need for domain sharding and multiple connections, but concentrates risk: one lossy connection stalls every stream, and long-lived connections defeat naive L4 load balancing.' },
    { name: 'QUIC / HTTP/3', description: 'UDP-based transport with built-in TLS 1.3, per-stream loss recovery, and connection IDs. Costs: more userspace CPU than kernel TCP, UDP sometimes blocked or rate-limited by middleboxes, so clients fall back to HTTP/2.' },
    { name: 'Socket lifecycle', description: 'Ephemeral ports, TIME_WAIT, keepalive and connection pooling. Reusing connections amortises TCP+TLS handshakes and avoids port exhaustion; idle timeouts must be aligned (client < LB < server) to avoid resets on reuse.' },
  ],
  misconceptions: [
    { myth: 'More bandwidth makes a single transfer faster.', reality: 'For a long-RTT path a single flow is bounded by window/RTT. A 64 KB window over 100 ms RTT caps at ~5 Mbit/s regardless of a 10 Gbit/s link. Fix the window (window scaling, buffer tuning), use parallel flows, or move closer.' },
    { myth: 'HTTP/2 eliminates head-of-line blocking.', reality: 'It removes HOL at the HTTP layer only. A lost TCP segment blocks all multiplexed streams until retransmitted, which can make HTTP/2 worse than several HTTP/1.1 connections on lossy networks. QUIC removes transport HOL.' },
    { myth: 'Setting a DNS TTL of 60 s means clients move within 60 s of a change.', reality: 'TTL is an upper bound that well-behaved resolvers honour. Client-side caches, connection reuse and resolvers that enforce minimum TTLs mean a long tail keeps hitting the old address. Plan for minutes and drain old endpoints rather than killing them.' },
    { myth: 'TIME_WAIT sockets are a leak to be killed with kernel tweaks.', reality: 'TIME_WAIT protects against delayed duplicate segments corrupting a new connection. The fix for exhaustion is connection reuse (pooling, keepalive) or more source IPs/ports, not disabling the safety mechanism.' },
  ],
  example: {
    title: 'Pricing a cold HTTPS request and a long-haul transfer',
    description: `Client in Frankfurt, origin in Virginia, RTT ~90 ms (order of magnitude). First request, nothing cached, HTTP/2 over TCP:

- DNS: resolver cache miss to authoritative, ~1 RTT to a distant authoritative (often less via anycast) ≈ 50–90 ms
- TCP handshake: 1 RTT = 90 ms
- TLS 1.3: 1 RTT = 90 ms
- Request/response: 1 RTT = 90 ms + server time

≈ **320–360 ms before first byte**, of which ~230–270 ms is connection setup (DNS + TCP + TLS). HTTP/3 merges TCP+TLS (saves 90 ms); a warm pooled connection skips both (saves 180 ms); a CDN edge 10 ms away cuts each handshake RTT to 10 ms. The BDP calculation below explains why a bulk copy over the same path underperforms.`,
    code: `# Bandwidth-delay product for a 1 Gbit/s path with 90 ms RTT
BDP = 1e9 bit/s * 0.090 s = 90e6 bit = ~11.25 MB in flight
# A flow limited to a 4 MB window:
throughput = 4 MB * 8 / 0.090 s = ~356 Mbit/s  (~36% of the link)

# Inspect on Linux
ss -ti dst 203.0.113.10        # cwnd, rtt, retrans per socket
sysctl net.ipv4.ip_local_port_range   # default 32768 60999
ss -tan state time-wait | wc -l       # TIME_WAIT count
dig +trace example.com          # walk root -> TLD -> authoritative
curl -w '%{time_namelookup} %{time_connect} %{time_appconnect} %{time_starttransfer}\\n' -o /dev/null -s https://example.com`,
    language: 'bash',
  },
  exercise: {
    prompt: `A service in one region calls a dependency in another region (RTT 70 ms) using a client library that opens a new HTTPS connection per call. It handles 2,000 calls/s from a single egress IP through a NAT, and p50 latency is ~220 ms. Estimate where the time goes, identify the scaling cliff, and propose fixes with expected impact.`,
    solution: `**Latency:** TCP (70) + TLS 1.3 (70) + request (70) ≈ 210 ms + server time, matching the 220 ms p50. Two-thirds is handshake.

**Cliff:** each call consumes a source port toward the same destination IP:port, and the closing side holds it in TIME_WAIT for ~60 s. 2,000/s × 60 s = **120,000** ports needed vs ~28k (Linux default range) or the NAT's per-destination port budget. Expect intermittent connect failures as load grows, worst at peaks.

**Fixes:**
- Connection pooling with keepalive (HTTP/2 multiplexing): p50 drops to ~70 ms + server time, handshake CPU largely disappears, ports in use drop to a few dozen.
- Align idle timeouts (client pool idle < NAT/LB idle) to avoid resets on reuse.
- If cross-region calls are frequent, cache or co-locate; batching N sequential calls into one saves (N−1) × 70 ms.
- As a stopgap, more NAT source IPs multiply the port budget; it does not fix latency.`,
  },
  faq: [
    { q: 'Should we enable TLS 0-RTT?', a: 'Only for idempotent, side-effect-free requests, and only where the server or edge enforces that policy. Early data can be replayed by an attacker who captures it, so a POST that charges a card must never be accepted as 0-RTT.' },
    { q: 'Why does a load balancer show uneven load with HTTP/2 or gRPC clients?', a: 'Clients multiplex all requests over a few long-lived connections, so an L4 balancer that distributes connections, not requests, pins traffic to whichever backends got those connections. Use L7 (per-request) balancing or client-side balancing, and cap connection age so connections rebalance.' },
    { q: 'What is MTU and why does it bite in cloud networks?', a: 'The largest packet a link carries without fragmentation (1500 bytes is the common Ethernet default; some cloud networks support larger jumbo frames internally). Tunnels and VPNs add headers, so if path MTU discovery is broken by filtered ICMP, large packets silently drop: small requests work, large responses hang.' },
  ],
  keyTerms: ['RTT', 'bandwidth-delay product', 'slow start', 'congestion window', 'TLS 1.3 1-RTT / 0-RTT', 'head-of-line blocking', 'QUIC', 'TIME_WAIT', 'ephemeral port exhaustion', 'negative caching'],
  deeper: `Staff-level nuance lives in the interactions. **Retries and slow start compound**: after a failover every client reconnects at once, every new connection starts at a small cwnd, and TLS handshakes spike CPU on the new target, so the "healthy" side browns out; connection rate limits and jittered reconnects matter as much as capacity. **Middleboxes ossify protocols**: QUIC encrypts most of its headers precisely so middleboxes cannot depend on them, which also means your own network team loses visibility they had with TCP. **Tail latency is dominated by loss**: a single retransmission timeout (minimum around 200 ms on Linux) dwarfs a 1 ms service time, so p99 on a lossy path is a network property, not an application one. Finally, **DNS is a control plane**: the resolver fleet is a shared dependency for everything, and resolver saturation or a misconfigured negative TTL can look like a total outage of unrelated services.`,
  interview: {
    seniorAnswer: `Frame it as a budget: "A cold HTTPS request costs DNS plus 1 RTT TCP, 1 RTT TLS 1.3, 1 RTT for the request; on HTTP/3 the first two merge." Then name the levers in order of impact: connection reuse, moving the edge closer, protocol upgrades. Call out the failure mode at each layer (DNS TTL and negative caching, slow start after failover, HOL blocking on lossy links, TIME_WAIT/port exhaustion through NAT) and quantify with BDP or port arithmetic. Close with how you would observe it: \`curl -w\` timing phases, \`ss -ti\` for cwnd/retransmits, resolver metrics.`,
    followUps: [
      { q: 'Why is HTTP/3 not universally faster?', a: 'Handshake savings and per-stream recovery help most on high-RTT or lossy mobile paths. On clean datacenter links the gain is small, userspace QUIC costs more CPU per byte than kernel TCP with offloads, and some networks block or throttle UDP, forcing fallback.' },
      { q: 'How would you fail over a service quickly using DNS?', a: 'Lower TTL well before the change (old TTL must expire first), use health-checked records, keep the old endpoint serving and drain it, and accept a long tail from clients that ignore TTL. For seconds-level failover prefer anycast or a load balancer VIP that does not change.' },
      { q: 'A transfer between regions gets 300 Mbit/s on a 10 Gbit/s link. Diagnose.', a: 'Compute BDP: at 80 ms, 10 Gbit/s needs ~100 MB in flight. Check socket buffers/window scaling, retransmits with `ss -ti`, and whether a single flow is used. Fix with larger buffers, parallel streams, or BBR on lossy paths.' },
      { q: 'What does TIME_WAIT protect against and who holds it?', a: 'The side that actively closes holds it for 2×MSL so delayed duplicates from an old connection with the same 4-tuple are not accepted by a new one. Make servers not close first where possible, and reuse connections on clients.' },
    ],
    redFlags: [
      'Reciting the OSI model without pricing any step in round trips',
      'Claiming HTTP/2 fully solves head-of-line blocking',
      'Treating DNS TTL as an exact failover time',
      'Proposing to disable TIME_WAIT or set tcp_tw_recycle as a fix',
      'Ignoring that 0-RTT data is replayable',
    ],
    numbers: [
      'Same-AZ RTT ~0.1–0.5 ms; cross-AZ ~1–2 ms; cross-continent ~70–150 ms (order of magnitude)',
      'TCP handshake 1 RTT; TLS 1.3 1 RTT (TLS 1.2: 2 RTT); QUIC combined 1 RTT; resumption 0-RTT',
      'Initial cwnd commonly 10 segments (~14 KB)',
      'Throughput ≈ window / RTT; BDP = bandwidth × RTT',
      'Linux ephemeral range 32768–60999 (~28k ports); TIME_WAIT 60 s',
    ],
  },
  references: [
    { title: 'High Performance Browser Networking (Ilya Grigorik)', url: 'https://hpbn.co/' },
    { title: 'RFC 8446: TLS 1.3', url: 'https://www.rfc-editor.org/rfc/rfc8446' },
    { title: 'RFC 9000: QUIC', url: 'https://www.rfc-editor.org/rfc/rfc9000' },
    { title: 'RFC 9293: Transmission Control Protocol', url: 'https://www.rfc-editor.org/rfc/rfc9293' },
  ],
};

const netCloud: InfraLesson = {
  id: 'infra-net-cloud',
  title: 'Cloud network design: VPCs, CIDR and hybrid connectivity',
  stage: 0,
  order: 2,
  objectives: ['net-cloud'],
  scope: 'senior',
  estMinutes: 35,
  summary:
    'Designing VPC/VNet address space for many accounts and regions without overlap, subnet tiers and route tables, NAT egress cost and AZ affinity, stateful vs stateless filtering, peering vs transit hubs, private endpoints, and VPN vs dedicated interconnect with hybrid DNS.',
  what: `A cloud virtual network (**VPC** on AWS and Google Cloud, **VNet** on Azure) is a software-defined private network: you choose an address space (from RFC 1918 ranges), carve it into subnets, attach route tables, and control traffic with stateful and stateless filters. Note a structural difference: AWS VPCs and Azure VNets are regional with subnets bound to an AZ (AWS) or spanning the region (Azure), while a Google Cloud VPC is global with regional subnets.

Cloud network design is the discipline of planning **address space, segmentation, egress, connectivity between networks, and connectivity to on-premises** so that the organisation can grow to hundreds of accounts and several regions without re-addressing.`,
  why: `Network topology is one of the hardest things to change later. Overlapping CIDRs block peering and hybrid routing forever (or force NAT-between-networks hacks); a single shared NAT gateway becomes both a cost line item and a cross-AZ failure dependency; a flat network turns a single compromised instance into an organisation-wide incident. Senior interviewers probe whether you design for growth, blast radius and cost on day one.`,
  problem: `Typical failure stories: two acquired companies both used \`10.0.0.0/16\` and cannot be connected; a team peered 40 VPCs in a mesh and now manages hundreds of peering connections and route entries; a data-heavy workload pulls terabytes from object storage through a NAT gateway and the per-GB processing charge exceeds the compute bill; an AZ outage takes down egress for all AZs because every private subnet routed through one NAT in the failed AZ.`,
  how: `Design top-down.

- **Allocate a supernet per region/environment**, managed centrally (an IPAM). Example: \`10.0.0.0/8\` split into \`/12\` per region, \`/16\` per account-environment, with ranges reserved for on-prem and future regions. Never reuse a range anywhere that might ever be routed together.
- **Subnet tiers per AZ**: public (route to internet gateway; only load balancers and NAT live here), private (default route to NAT for egress), and isolated/data (no internet route). Size subnets for peak IP consumption including container pod IPs, which can consume an IP per pod.
- **Egress via NAT**: one NAT gateway **per AZ**, and each AZ's private route table points to its own NAT. This keeps egress zonal (an AZ failure does not break others) and avoids cross-AZ data charges. NAT also has per-GB processing cost, so route high-volume traffic to provider services through **private/gateway endpoints** instead.
- **Filtering**: **security groups** (AWS) / NSGs (Azure) / firewall rules (GCP) are **stateful** — return traffic is automatically allowed — and attached to instances or interfaces; they can reference other groups, which scales better than IP lists. **NACLs** (AWS) are **stateless** subnet-level filters: you must allow return traffic on ephemeral ports explicitly, and rules are evaluated in number order.
- **Connecting networks**: **peering** is point-to-point and **non-transitive** (A–B and B–C does not give A–C), and needs non-overlapping CIDRs. Beyond a handful of networks, use a **hub**: AWS Transit Gateway, Azure Virtual WAN or hub VNet, Google Cloud Network Connectivity Center. Hubs give transitive routing, central inspection and route-table segmentation (prod cannot reach dev), at a per-GB processing cost.
- **Private access to services**: **private endpoints** (AWS PrivateLink, Azure Private Link, GCP Private Service Connect) expose a service as a private IP in your subnet, avoiding the internet, NAT, and the need for CIDR non-overlap with the provider.
- **Hybrid**: **site-to-site VPN** over the internet (quick, encrypted, throughput limited per tunnel and variable latency) vs **dedicated interconnect** (AWS Direct Connect, Azure ExpressRoute, Google Cloud Interconnect): private circuits with predictable latency and lower egress rates, but weeks to provision and needs redundant circuits in separate locations. Common pattern: interconnect primary, VPN backup, BGP for route exchange.
- **Hybrid DNS**: conditional forwarding both ways — cloud resolver endpoints forward \`corp.example\` to on-prem DNS, on-prem forwards cloud private zones to inbound resolver endpoints. Private endpoints usually depend on private DNS zones overriding the public name; getting this wrong sends traffic to the public endpoint.`,
  components: [
    { name: 'IPAM and CIDR plan', description: 'The central allocation of non-overlapping ranges per region, environment and account, including on-prem and future growth. Without it, every new connection is a negotiation.' },
    { name: 'Subnets and route tables', description: 'Route tables, not subnet names, make a subnet public or private. Longest-prefix match decides the next hop; a more specific route (e.g. to an inspection appliance) overrides the default.' },
    { name: 'NAT gateway', description: 'Managed source-NAT for outbound-only access. Zonal resource; deploy one per AZ. Charged per hour and per GB processed; has per-destination connection and port limits.' },
    { name: 'Security groups vs NACLs', description: 'Stateful, allow-only, instance-level and referencable by group vs stateless, ordered allow/deny, subnet-level. Use groups for intent, NACLs as a coarse guardrail (e.g. deny a known bad range).' },
    { name: 'Transit hub', description: 'A regional router connecting many VPCs and on-prem links with multiple route tables for segmentation. Replaces an N×(N−1)/2 peering mesh with N attachments.' },
    { name: 'Private endpoints and interconnects', description: 'Private endpoints map a provider or partner service to a private IP in your network; interconnects give dedicated, BGP-routed private circuits to on-prem.' },
  ],
  misconceptions: [
    { myth: 'A subnet is public because it is called public or because instances have public IPs.', reality: 'It is public only if its route table has a default route to an internet gateway. An instance with a public IP in a subnet without that route is unreachable from the internet.' },
    { myth: 'Peering three VPCs in a chain connects all of them.', reality: 'Peering is non-transitive; traffic will not be forwarded through the middle network. You need direct peering for each pair or a transit hub.' },
    { myth: 'One NAT gateway is enough for a multi-AZ deployment.', reality: 'It works until its AZ fails, then all private-subnet egress breaks, and meanwhile you pay cross-AZ data transfer for traffic from other AZs. One per AZ with zonal routing is the resilient pattern.' },
    { myth: 'Traffic to the cloud provider’s object storage from a private subnet stays on the private network automatically.', reality: 'Without a gateway or private endpoint it is routed via NAT to the public endpoint, incurring NAT processing charges. Add the endpoint and the matching route/DNS so it takes the private path.' },
  ],
  example: {
    title: 'CIDR plan for 3 regions × 3 environments with on-prem',
    description: `An organisation with on-prem in \`10.0.0.0/12\`, three regions, prod/staging/dev, and expected growth to ~50 accounts. Each workload account gets a \`/20\` (4,096 addresses) carved into per-AZ tiers; large Kubernetes accounts get a \`/18\` or use a secondary range for pods. Everything is non-overlapping, so any two networks can later be connected through the regional hub.`,
    code: `10.0.0.0/8            organisation supernet
  10.0.0.0/12         on-prem (reserved, never used in cloud)
  10.16.0.0/12        region A
    10.16.0.0/14      prod      (64 x /20 accounts)
    10.20.0.0/14      staging
    10.24.0.0/14      dev
    10.28.0.0/14      shared services / hub / reserved
  10.32.0.0/12        region B   (same layout)
  10.48.0.0/12        region C
  10.64.0.0/10        reserved for future regions / acquisitions

One /20 workload account, 3 AZs:
  public   10.16.0.0/24  10.16.1.0/24  10.16.2.0/24   (LBs, NAT)
  private  10.16.4.0/22  10.16.8.0/22  10.16.12.0/22  (app, ~1,000 IPs/AZ)
  data     10.16.3.0/26  10.16.3.64/26 10.16.3.128/26 (no internet route)

Route tables:
  private-az1: 0.0.0.0/0 -> nat-az1 ; 10.0.0.0/8 -> transit-hub ; storage prefix -> gateway endpoint
  data-az1:    10.0.0.0/8 -> transit-hub   (no default route)`,
    language: 'text',
  },
  exercise: {
    prompt: `A workload in private subnets across 3 AZs reads 50 TB/month from object storage in the same region and calls a SaaS API over the internet (2 TB/month). Today everything egresses through a single NAT gateway in AZ-a. Propose a design that improves resilience and cost, and estimate the saving assuming a NAT processing charge of ~$0.045/GB and cross-AZ transfer of ~$0.01/GB each direction (illustrative numbers; check your provider).`,
    solution: `**Current:** 52 TB through NAT ≈ 52,000 GB × $0.045 ≈ **$2,340/month** processing. Roughly two-thirds of traffic originates in AZ-b/c and crosses to AZ-a: ~35 TB × ~$0.02 (both directions) ≈ **$700/month**. AZ-a failure kills all egress.

**Proposed:**
- Gateway/private endpoint for object storage with routes in every private route table: 50 TB leaves the NAT path. Gateway-type endpoints for object storage on AWS carry no per-GB charge; interface endpoints have a smaller per-GB charge.
- One NAT per AZ, each AZ routing to its own NAT: remaining 2 TB ≈ $90/month processing plus three NAT hourly charges, no cross-AZ hop.

**Result:** from ~$3,000/month to ~$90 + NAT hourly fees, and an AZ failure now only affects that AZ's egress. Also verify the endpoint policy restricts access to your own buckets to avoid creating an exfiltration path.`,
  },
  faq: [
    { q: 'When should I use a transit hub instead of peering?', a: 'Once you have more than a handful of networks, need transitive routing to on-prem, central inspection, or route segmentation. Peering stays useful for a few high-volume pairs because it avoids hub per-GB processing charges.' },
    { q: 'VPN or dedicated interconnect?', a: 'VPN is days to set up, encrypted, but limited per-tunnel throughput and internet-variable latency. Interconnect gives predictable latency, higher bandwidth and usually cheaper egress, but takes weeks and needs two circuits in different facilities for resilience. Many run interconnect primary with VPN as backup.' },
    { q: 'How do I avoid running out of IPs with Kubernetes?', a: 'Plan pod IP consumption up front: CNIs that give pods VPC IPs consume subnet space fast. Use secondary CIDRs for pods, prefix delegation, or an overlay CNI, and size subnets for peak node count × pods per node.' },
  ],
  keyTerms: ['VPC / VNet', 'CIDR', 'RFC 1918', 'route table', 'NAT gateway', 'security group (stateful)', 'NACL (stateless)', 'non-transitive peering', 'transit hub', 'private endpoint', 'dedicated interconnect', 'conditional forwarding'],
  deeper: `At staff level the network is an **organisational interface**. Centralised IPAM and a hub-and-spoke topology owned by a platform team let application teams self-serve accounts with pre-allocated ranges. Decide early whether egress is centralised (an inspection VPC with firewalls behind the hub: one control point but a shared failure and cost domain) or distributed (NAT per account: simpler, harder to audit). **IPv6** sidesteps exhaustion and overlap but every component (security tooling, logging, on-prem) must support it; dual-stack is the realistic path. Another subtlety: **AZ names are not guaranteed consistent across accounts** on some providers (AWS can map the same AZ name to different physical zones in different accounts; zone IDs such as \`use1-az1\` are stable), which matters when you align NATs, endpoints and zonal services across accounts. Finally, private endpoints scale connectivity without routing, which makes them a good tool for multi-tenant SaaS and for connecting networks that already overlap.`,
  interview: {
    seniorAnswer: `Start from requirements: number of accounts and regions, on-prem connectivity, compliance boundaries, expected growth. Propose a central IPAM with non-overlapping supernets per region and environment, three subnet tiers per AZ, NAT per AZ, private endpoints for provider services, and a regional transit hub with separate route tables for prod and non-prod. For hybrid, dual interconnect circuits with VPN backup and BGP, plus bidirectional conditional DNS forwarding. Name the trade-offs explicitly: hub processing cost vs operational simplicity, centralised vs distributed egress, and the blast radius of shared components.`,
    followUps: [
      { q: 'Security group vs NACL: when do you use each?', a: 'Security groups for application intent: stateful, allow-only, can reference other groups so rules follow instances. NACLs as a coarse, stateless subnet guardrail, e.g. explicit denies; remember to allow ephemeral return ports.' },
      { q: 'Two networks overlap and must talk. Options?', a: 'Re-address one (best long-term), expose specific services via private endpoints (no routing needed), or NAT between them through an intermediate network. All but re-addressing add complexity and debugging pain.' },
      { q: 'How do you make private endpoints work with on-prem clients?', a: 'On-prem DNS conditionally forwards the service zone to an inbound cloud resolver endpoint, which resolves the name to the private endpoint IP via the private zone; routing to that IP goes over interconnect/VPN.' },
      { q: 'Where would you put egress inspection?', a: 'A central inspection network attached to the hub with route tables forcing 0.0.0.0/0 through firewalls deployed per AZ, keeping flows symmetric (same AZ in and out) so stateful firewalls see both directions.' },
    ],
    redFlags: [
      'Using 10.0.0.0/16 everywhere "because it is the default"',
      'Assuming peering is transitive',
      'A single NAT gateway for all AZs',
      'Confusing stateful security groups with stateless NACLs',
      'No plan for hybrid DNS when using private endpoints',
    ],
    numbers: [
      'RFC 1918: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16',
      'A /16 = 65,536 addresses; /20 = 4,096; /24 = 256 (providers reserve a few per subnet, 5 on AWS)',
      'Full peering mesh: N×(N−1)/2 links; hub: N attachments',
      'NAT and hub charges are per GB processed in addition to hourly; cross-AZ transfer is billed on most providers',
    ],
  },
  references: [
    { title: 'Amazon VPC User Guide: What is Amazon VPC?', url: 'https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html' },
    { title: 'RFC 1918: Address Allocation for Private Internets', url: 'https://www.rfc-editor.org/rfc/rfc1918' },
    { title: 'Google Cloud Architecture Center', url: 'https://cloud.google.com/architecture' },
    { title: 'Azure Well-Architected Framework', url: 'https://learn.microsoft.com/en-us/azure/well-architected/' },
  ],
};

const netEdge: InfraLesson = {
  id: 'infra-net-edge',
  title: 'Load balancing and the edge',
  stage: 0,
  order: 3,
  objectives: ['net-edge'],
  scope: 'senior',
  estMinutes: 30,
  summary:
    'L4 vs L7 load balancing, health checks and connection draining, session affinity, balancing algorithms, global traffic via anycast vs DNS-based GSLB, CDN cache keys and hit ratio, and WAF/DDoS layering.',
  what: `The edge is everything between a user and your service tier: global traffic steering (DNS or anycast), CDN and edge caches, WAF and DDoS protection, and regional load balancers that spread requests across healthy backends.

**L4 load balancers** forward TCP/UDP flows based on the 5-tuple without parsing payload: very high throughput, low latency, preserve the client connection end to end (or pass through TLS). **L7 load balancers** terminate the connection, parse HTTP/gRPC, and route per request on host, path, header or cookie; they can retry, rewrite, enforce auth and observe status codes, at the cost of more CPU and a TLS termination point.`,
  why: `The edge decides availability during the moments that matter: deploys, AZ failures, traffic spikes and attacks. Badly tuned health checks cause cascading ejection or route traffic into dead backends; missing draining turns every deploy into a burst of 502s; a low CDN hit ratio turns a viral spike into an origin outage; a DNS-only failover strategy leaves users stranded for the TTL tail.`,
  problem: `Common incidents: a health check that hits a deep \`/health\` endpoint which checks the database, so a DB blip marks every backend unhealthy and the LB has nowhere to send traffic; a cache key that includes a tracking query parameter, so the hit ratio collapses to near zero; sticky sessions pinning a hot tenant to one instance; gRPC traffic balanced at L4 so new pods receive no requests; a global failover that depends on clients re-resolving DNS.`,
  how: `Trace a request from the user inward.

- **Global steering.** Either **DNS-based GSLB** (the authoritative DNS returns region-specific IPs based on resolver location, latency or health; failover speed bounded by TTL and client caching) or **anycast** (the same IP announced via BGP from many edge locations; the internet routes users to the nearest, and withdrawing a route moves traffic in seconds to minutes without client cooperation). Global anycast L7 load balancers (e.g. Google Cloud's global external Application Load Balancer, AWS Global Accelerator for L4, Azure Front Door) combine anycast entry with backend selection.
- **DDoS and WAF.** Volumetric L3/L4 attacks are absorbed by provider scale at anycast edges (AWS Shield, Azure DDoS Protection, Google Cloud Armor). L7 attacks and exploits are handled by a **WAF**: managed rule sets (e.g. OWASP-style injection rules), rate limiting per key, bot controls. Put these before the origin and make the origin accept traffic only from the edge.
- **CDN.** The edge caches responses by a **cache key** (by default host + path + selected query params/headers). Hit ratio is the biggest lever: normalise the key (drop irrelevant params, avoid \`Vary: User-Agent\`), set \`Cache-Control\` with \`s-maxage\` and \`stale-while-revalidate\`, use an **origin shield** (mid-tier cache) to collapse misses from many PoPs into one origin request, and version static assets (\`app.3f9a.js\`) so they can be cached for a year.
- **Regional load balancer.** Algorithms: round robin, least outstanding requests (better for heterogeneous latency), consistent hashing (for cache affinity), and **power of two random choices** (pick two, send to the less loaded; near-optimal with little coordination). **Session affinity** by cookie or source IP helps stateful legacy apps but skews load and breaks on scale-in; prefer external session state.
- **Health checks.** Active checks (probe every N s, unhealthy after K failures) plus passive/outlier detection (eject backends returning 5xx). Make checks **shallow** for liveness of the instance; deep dependency checks should degrade, not eject everyone. Have a fail-open rule: if all backends are unhealthy, send to all rather than none.
- **Connection draining / deregistration delay.** On scale-in or deploy, stop sending new requests to a backend but let in-flight requests finish for a bounded time (e.g. 30–300 s), while the app stops accepting keepalive reuse. Align timeouts: client idle < LB idle < backend keepalive, otherwise the backend closes a connection the LB is about to reuse and you get intermittent 502s.`,
  components: [
    { name: 'L4 load balancer', description: 'Flow-level forwarding (5-tuple hashing), millions of connections, TLS pass-through possible, preserves source IP in many designs. Balances connections, not requests, so long-lived multiplexed connections skew load.' },
    { name: 'L7 load balancer / reverse proxy', description: 'Terminates TLS, routes per request, retries idempotent requests, adds headers (X-Forwarded-For), exposes per-route metrics. Becomes a policy point and a potential bottleneck.' },
    { name: 'Health checking and outlier detection', description: 'Active probes with thresholds plus passive ejection on errors. Tuning interval × threshold sets detection time; ejection caps prevent removing too many backends at once.' },
    { name: 'Global traffic management', description: 'DNS GSLB with health-checked, latency- or geo-based answers, or anycast VIPs. Anycast fails over without client action; DNS gives per-user control but obeys caching.' },
    { name: 'CDN and origin shield', description: 'Edge caches keyed by normalised request attributes; origin shield collapses concurrent misses. Hit ratio and TTL policy determine origin load and egress cost.' },
    { name: 'WAF and DDoS protection', description: 'Volumetric absorption at the provider edge, L7 filtering and rate limiting by IP, token or path. Rules need a count/monitor mode before blocking to avoid false positives.' },
  ],
  misconceptions: [
    { myth: 'Health checks should verify every dependency.', reality: 'A deep check that fails when a shared dependency fails marks all instances unhealthy simultaneously, turning partial degradation into a total outage. Check the instance itself; handle dependency failure with degraded responses and alerts.' },
    { myth: 'DNS failover is instant if the TTL is low.', reality: 'Resolvers and clients cache beyond TTL, and established connections never re-resolve. Expect a tail of minutes; use anycast or a stable VIP for fast failover and drain the old target.' },
    { myth: 'Sticky sessions are harmless.', reality: 'They defeat load balancing (hot users pin to hot instances), make scale-in lose sessions, and slow deploys. Externalise session state and use affinity only as a cache-locality optimisation.' },
    { myth: 'A CDN only helps static assets.', reality: 'Short TTLs (even 1–5 s) on popular dynamic responses with request collapsing can absorb massive read spikes; the CDN also terminates TLS near users and keeps warm connections to origin.' },
  ],
  example: {
    title: 'Draining and timeout alignment for zero-error deploys',
    description: `A service behind an L7 LB sees ~0.3% 502s during every deploy and a trickle at random times. Root causes: pods are killed immediately on termination, and the backend keepalive timeout (5 s) is shorter than the LB idle timeout (60 s), so the backend closes idle connections the LB then reuses. The fix aligns the chain and adds draining.`,
    code: `Timeout chain (must increase inward):
  client idle        < LB idle timeout     < backend keepalive
  e.g. 30 s          < 60 s                < 75 s

On termination (Kubernetes example):
  1. Pod marked terminating -> removed from endpoints (propagates in seconds)
  2. preStop hook: sleep 10s       # keep serving while LBs notice
  3. App stops accepting new conns, sends Connection: close / GOAWAY
  4. In-flight requests finish (bounded by terminationGracePeriodSeconds)
  5. LB deregistration delay: 30 s

Health check: GET /healthz (process-local), interval 5 s,
  unhealthy after 3 failures (~15 s detection), healthy after 2
Outlier ejection: 5 consecutive 5xx -> eject 30 s, max 20% of hosts ejected`,
    language: 'text',
  },
  exercise: {
    prompt: `A news site serves 200k requests/s at peak; 70% are article pages that change at most once a minute, 30% are personalised API calls. The CDN hit ratio is 40% and origin is struggling. The cache key includes the full query string and the \`Cookie\` header. Propose changes and estimate origin load before and after.`,
    solution: `**Before:** origin load = 200k × (1 − 0.40) = **120k req/s**.

**Changes:**
- Remove \`Cookie\` and marketing params (\`utm_*\`, \`fbclid\`) from the cache key for article pages; personalise via a separate API call or edge logic.
- \`Cache-Control: public, s-maxage=60, stale-while-revalidate=30\` on articles; enable request collapsing and an origin shield so each article misses once per TTL globally, not once per PoP.
- Leave personalised API calls uncached (or micro-cache with per-user keys if allowed).

**After:** article requests (140k/s) achieve ~98–99% hit ratio (misses only on expiry and the long tail) → ~2–3k req/s to origin; API 60k/s still reach origin. Total ≈ **62–63k req/s**, about half the original, with the remaining load being genuinely dynamic. Next step: reduce API load by caching per-user data briefly or splitting public fragments out.`,
  },
  faq: [
    { q: 'Should TLS terminate at the load balancer?', a: 'Usually at the L7 edge for routing, WAF and observability, then re-encrypt to backends if policy requires encryption in transit inside the network. Use L4 pass-through when the backend must hold the keys (e.g. mTLS with client certs end to end) and you only need connection distribution.' },
    { q: 'Anycast or DNS GSLB for multi-region?', a: 'Anycast for fast, client-independent failover and DDoS absorption; DNS for fine-grained per-region weighting, data residency steering and cheap setup. Many architectures use DNS to pick a region and anycast or regional VIPs within it.' },
    { q: 'How do I balance gRPC traffic?', a: 'gRPC uses long-lived HTTP/2 connections, so use an L7 balancer or service mesh that balances per request, or client-side balancing with a name resolver. Cap connection age (max connection age) so clients reconnect and spread over new backends.' },
  ],
  keyTerms: ['L4 vs L7', 'health check', 'outlier detection', 'connection draining', 'session affinity', 'least outstanding requests', 'power of two choices', 'anycast', 'GSLB', 'cache key', 'origin shield', 'WAF'],
  deeper: `The edge is where **retry amplification** is born: an L7 LB retrying on 5xx, plus client retries, plus SDK retries can multiply load 3–27× on a struggling backend; cap retries at one layer and use retry budgets. **Fail-open vs fail-closed** is a real design choice: a WAF or auth check that fails closed during its own outage takes the site down; one that fails open accepts risk. **Cross-zone load balancing** spreads evenly across AZs but adds cross-AZ latency and cost; disabling it improves zonal isolation but requires balanced capacity per AZ. For static stability, the edge should never need its control plane to keep serving: health checks and routes must keep working from cached config if the provider API is degraded. Finally, measure **origin offload** (bytes and requests) not just hit ratio: a high request hit ratio with a low byte hit ratio means large objects are missing.`,
  interview: {
    seniorAnswer: `Describe the path layer by layer: global entry (anycast or DNS GSLB) with DDoS protection, WAF and CDN with a normalised cache key and origin shield, regional L7 balancers with per-request algorithms, shallow health checks plus outlier detection, and draining aligned with timeouts. For each, state the failure mode it prevents and the one it introduces (deep checks cascading, sticky sessions skewing, DNS TTL tails, retry amplification). Quote detection time (interval × threshold), hit-ratio arithmetic for origin load, and the timeout ordering rule.`,
    followUps: [
      { q: 'All backends fail their health checks at once. What should the LB do?', a: 'Fail open: route to all backends, since a mass failure usually means the check or a shared dependency is broken, not every instance. Many proxies support a panic threshold for this.' },
      { q: 'How do you get zero-downtime deploys behind a load balancer?', a: 'Readiness gating before registration, deregistration delay plus a preStop pause before shutdown, graceful connection close (GOAWAY), idempotent retries at one layer, and aligned idle timeouts.' },
      { q: 'Why can least-connections be worse than round robin?', a: 'With multiple LB nodes each having partial views, or with new instances that look idle, everyone stampedes the newest/emptiest backend. Slow start for new backends and power-of-two choices mitigate.' },
      { q: 'How would you protect an origin from a cache miss storm when TTLs expire?', a: 'Request collapsing at edge and shield, stale-while-revalidate to serve stale while one fetch refreshes, and jittered TTLs so popular objects do not all expire together.' },
    ],
    redFlags: [
      'Health checks that call the database',
      'DNS as the only fast-failover mechanism',
      'No mention of draining or timeout alignment for deploys',
      'Using L4 balancing for gRPC and wondering why load is uneven',
      'WAF rules deployed straight to block mode',
    ],
    numbers: [
      'Detection time ≈ check interval × unhealthy threshold (e.g. 5 s × 3 = 15 s)',
      'Origin load = total requests × (1 − hit ratio): 90% → 99% hit ratio is a 10× origin reduction',
      'Deregistration/draining delay commonly 30–300 s',
      'Retries at 3 layers with 3 attempts each can amplify load up to 27×',
    ],
  },
  references: [
    { title: 'Google SRE book: Handling Overload', url: 'https://sre.google/sre-book/handling-overload/' },
    { title: 'Google SRE book: Addressing Cascading Failures', url: 'https://sre.google/sre-book/addressing-cascading-failures/' },
    { title: 'OWASP Top Ten', url: 'https://owasp.org/www-project-top-ten/' },
    { title: 'High Performance Browser Networking', url: 'https://hpbn.co/' },
  ],
};

const computeModels: InfraLesson = {
  id: 'infra-compute-models',
  title: 'Compute models: VMs, containers and serverless',
  stage: 1,
  order: 1,
  objectives: ['compute-models'],
  scope: 'senior',
  estMinutes: 30,
  summary:
    'Choosing between VMs, containers and functions by isolation, startup time, density, operational ownership and cost curve; instance families; spot/preemptible capacity and interruption handling; immutable infrastructure.',
  what: `Compute models are the units in which you rent CPU and memory, each moving the line of **who operates what**:

- **Virtual machines** (EC2, Azure VMs, Compute Engine): a full guest OS on a hypervisor. Hardware-virtualised isolation, you own the OS, patching and packing.
- **Containers** on an orchestrator (EKS/AKS/GKE, or ECS / Azure Container Apps / Cloud Run as managed container platforms): processes isolated by kernel namespaces and cgroups sharing the host kernel. Fast start, high density, image-based delivery.
- **Serverless functions** (Lambda, Azure Functions, Cloud Run functions): event-triggered code where the provider owns capacity, scaling to zero and billing per invocation and duration, often isolated in micro-VMs (e.g. Firecracker for Lambda).

Orthogonal choices: **instance family** (general, compute-, memory-, storage-optimised, accelerated, Arm vs x86) and **purchase model** (on-demand, commitments, spot/preemptible).`,
  why: `The compute model sets the cost curve, the latency floor, the security boundary and the operational load for years. Picking functions for a steady 5,000 req/s service can cost multiples of containers; picking VMs for spiky event processing pays for idle capacity; picking containers without a platform team creates an orchestration burden nobody owns. Interviewers expect you to choose by workload shape rather than fashion.`,
  problem: `Teams hit recurring traps: cold starts adding hundreds of milliseconds to a latency-sensitive API on functions; a multi-tenant container cluster where a kernel exploit crosses tenants because containers were treated as a hard security boundary; fleets of hand-patched "pet" VMs that drift until nobody can rebuild them; spot capacity used for stateful workloads with no interruption handling, losing work on every reclaim.`,
  how: `Decide along five axes.

- **Workload shape.** Steady, high utilisation favours VMs or containers on committed capacity. Spiky or low-duty-cycle event processing favours functions or scale-to-zero containers. Long-running (> 15 min), stateful, or needing special hardware (GPUs, local NVMe) favours VMs or containers.
- **Startup latency.** VM boot is tens of seconds to minutes (image size, init scripts). Container start is sub-second to seconds once the image is cached; image pull can dominate. Function cold start ranges from ~100 ms to seconds depending on runtime, package size and VPC attachment; mitigate with provisioned/minimum instances, smaller packages, and lazy initialisation.
- **Isolation.** VMs and micro-VMs give a hardware-virtualisation boundary. Plain containers share a kernel; for untrusted multi-tenant code use sandboxed runtimes (gVisor, Kata Containers) or separate nodes/VMs per tenant.
- **Operational ownership.** VMs: you patch OS, manage images, autoscaling groups. Containers: you (or a platform team) run the orchestrator, upgrades, networking. Functions: provider handles almost everything, but you accept limits (execution time, payload size, concurrency quotas) and less control over networking and runtime.
- **Cost curve.** Functions are cheapest at low and bursty utilisation and most expensive at sustained high utilisation; there is a crossover point (compute it). Containers improve VM economics by **bin packing**. **Spot/preemptible** capacity is typically ~60–90% cheaper than on-demand but can be reclaimed with short notice (about 2 minutes on AWS, ~30 s on Google Cloud and Azure); use it for stateless, checkpointed or fault-tolerant work, diversify across instance types and AZs, and handle the interruption signal by draining.

**Immutable infrastructure** applies to all three: never patch in place; build a new image (AMI/VM image or container image) through CI, roll it out, and destroy the old. This gives reproducibility, fast rollback (redeploy previous image) and eliminates drift.`,
  components: [
    { name: 'Hypervisor and micro-VMs', description: 'Hardware-assisted virtualisation for VMs; lightweight micro-VMs (Firecracker) give VM-grade isolation with ~100 ms-class boot, used by serverless platforms to isolate tenants.' },
    { name: 'Container runtime', description: 'Namespaces (pid, net, mount, user) for isolation and cgroups for resource limits, sharing the host kernel. OCI images give a portable, immutable artifact.' },
    { name: 'Function platform', description: 'Event sources, concurrency-based scaling, per-invocation billing, execution limits (e.g. Lambda max 15 minutes), cold vs warm execution environments, provisioned concurrency to pre-warm.' },
    { name: 'Instance families', description: 'Ratios of vCPU to memory, network bandwidth and local storage. Arm-based instances (Graviton, Ampere/Axion-class) often give better price-performance for recompilable workloads.' },
    { name: 'Spot / preemptible capacity', description: 'Spare capacity at deep discount with reclaim notice. Requires diversified pools, interruption handlers, checkpointing and an on-demand fallback.' },
    { name: 'Golden images and immutability', description: 'Pipelines that bake OS, agents and hardening into versioned images; deploy by replacement; config injected at boot or runtime rather than mutated by SSH.' },
  ],
  misconceptions: [
    { myth: 'Serverless is always cheaper.', reality: 'Per-request pricing wins at low or bursty utilisation. At sustained load, the per-GB-second premium usually exceeds the cost of right-sized containers or VMs, especially with commitments. Compute the crossover.' },
    { myth: 'Containers are a security boundary equivalent to VMs.', reality: 'They share the host kernel; a kernel or runtime escape crosses tenants. For hostile multi-tenancy use sandboxed runtimes, separate node pools or VMs per tenant.' },
    { myth: 'Spot instances are only for batch jobs.', reality: 'Stateless web tiers behind a load balancer, CI runners and Kubernetes worker pools run well on spot when capacity is diversified and interruption notices trigger draining, with an on-demand base for the minimum.' },
    { myth: 'Bigger instances are always more efficient.', reality: 'Large instances increase blast radius and reduce bin-packing flexibility; many small ones increase per-instance overhead. Choose sizes so that losing one is tolerable and packing stays efficient.' },
  ],
  example: {
    title: 'Function vs container crossover, worked',
    description: `An API averages 300 req/s, each using 512 MB for 120 ms. Illustrative prices (check your provider): functions at ~$0.0000167 per GB-second plus ~$0.20 per million requests; a container instance with 2 vCPU / 4 GB at ~$0.08/hour handling ~150 req/s each at target utilisation.`,
    code: `Requests/month  = 300 * 86,400 * 30            = ~777.6 M
GB-seconds      = 777.6 M * 0.5 GB * 0.12 s      = ~46.7 M GB-s
Function cost   = 46.7 M * 0.0000167 + 777.6 * 0.20
                = ~$780 + ~$156                  = ~$936 / month

Containers      = ceil(300 / 150) = 2, run 3 for N+1 redundancy
Container cost  = 3 * $0.08 * 730 h              = ~$175 / month

At 10 req/s average with bursts to 200:
Function cost   = ~$31 / month (scales to zero overnight)
Containers      = still >= 2 instances for HA   = ~$117 / month`,
    language: 'text',
  },
  exercise: {
    prompt: `You must host three workloads: (1) a thumbnail generator triggered by uploads, 50k/day with bursts of 2k/min; (2) a latency-sensitive checkout API at 1,500 req/s steady with p99 target 150 ms; (3) a nightly 6-hour ML feature job that can checkpoint every 10 minutes. Choose a compute model and purchase option for each, and name one failure mode you would design for.`,
    solution: `- **Thumbnails:** functions triggered by storage events (or scale-to-zero containers). Low duty cycle, bursty, short tasks. Failure mode: bursts exceeding concurrency quota or overwhelming a downstream; put a queue between the event and the function, set reserved concurrency, and make processing idempotent (events can be delivered more than once).
- **Checkout API:** containers on a managed orchestrator or autoscaling VMs, on-demand/committed base capacity, multi-AZ. Steady load makes functions expensive and cold starts threaten p99. Failure mode: scale-out lag during spikes; keep headroom (~30%) and pre-scale for known events.
- **ML job:** VMs or batch containers on **spot**, diversified across instance types and AZs, checkpointing to object storage. Interruption loses at most 10 minutes of work. Failure mode: no spot capacity at all; fall back to on-demand after a deadline so the job still finishes before morning.`,
  },
  faq: [
    { q: 'How do I reduce function cold starts?', a: 'Smaller deployment packages, lighter runtimes, initialising clients outside the handler and lazily, avoiding unnecessary VPC attachment where it adds latency, and provisioned/minimum instances for the latency-critical path. Measure p99 including cold starts, not just warm averages.' },
    { q: 'When do VMs still win over containers?', a: 'Licensed software tied to hosts, workloads needing a custom kernel or full OS control, very large stateful single-instance systems, strict isolation requirements, or teams without the capacity to run an orchestrator.' },
    { q: 'Is Arm worth it?', a: 'Often, for workloads you can recompile or that run on managed runtimes: price-performance gains are commonly cited in the 20–40% range. Costs are multi-arch image builds, testing, and dependencies with x86-only native code.' },
  ],
  keyTerms: ['virtual machine', 'micro-VM', 'container (namespaces, cgroups)', 'serverless function', 'cold start', 'provisioned concurrency', 'instance family', 'spot / preemptible', 'bin packing', 'immutable infrastructure', 'golden image'],
  deeper: `The staff-level frame is **total cost of ownership including people**: a platform that saves 30% on compute but needs three engineers to run may lose to a managed service. Second, **concurrency models** matter more than CPU: a standard Lambda execution environment handles one request at a time (Cloud Run and some newer function hosting modes allow many concurrent requests per instance), so downstream connection counts scale with concurrency and can exhaust database connections; front databases with a pooler or proxy. Third, **noisy neighbours** exist at every layer: CPU throttling from cgroup quotas (CFS throttling shows up as p99 latency even when average CPU is low), burstable instance credits running out, and shared network bandwidth. Finally, immutable infrastructure is also a security control: short-lived instances shrink the window for persistence after compromise, and image provenance (signed, scanned images) ties into supply-chain controls.`,
  interview: {
    seniorAnswer: `Choose by workload shape, not preference: steady high utilisation → containers or VMs on committed capacity; bursty event-driven → functions or scale-to-zero; long-running, stateful or hardware-specific → VMs. Quantify the crossover cost, state the latency floor (cold starts, image pulls, boot times), the isolation boundary (kernel-shared vs hypervisor), and who operates what. Use spot for interruption-tolerant work with diversification and fallback, and treat all compute as immutable images built by CI.`,
    followUps: [
      { q: 'How would you run untrusted customer code?', a: 'Hypervisor-level isolation per tenant: micro-VMs or sandboxed runtimes (gVisor/Kata), no shared kernel, strict egress controls, resource limits, and no credentials on the host. Plain containers on shared nodes are not enough.' },
      { q: 'How do you handle spot interruptions in a Kubernetes cluster?', a: 'Diversify node pools across instance types and AZs, run a node termination handler that cordons and drains on notice, use PodDisruptionBudgets, keep an on-demand baseline for critical replicas, and let the cluster autoscaler replace capacity.' },
      { q: 'Your function-based service started failing with database connection errors under load. Why?', a: 'Each concurrent execution environment opens its own connections; a burst to 1,000 concurrent invocations means 1,000+ connections. Use a connection proxy/pooler, cap reserved concurrency, or move the hot path to a pooled container service.' },
    ],
    redFlags: [
      'Choosing serverless or Kubernetes "because it is modern" without workload analysis',
      'Treating containers as a hard multi-tenant security boundary',
      'Running stateful, non-checkpointed work on spot with no fallback',
      'SSH-patching production instances',
    ],
    numbers: [
      'Spot/preemptible discount ~60–90% vs on-demand; reclaim notice ~2 min (AWS), ~30 s (GCP, Azure)',
      'Lambda max execution 15 minutes',
      'VM boot tens of seconds to minutes; container start sub-second to seconds once image is cached',
      'Function cold start ~100 ms to several seconds depending on runtime and package',
    ],
  },
  references: [
    { title: 'NIST SP 800-145: The NIST Definition of Cloud Computing', url: 'https://csrc.nist.gov/pubs/sp/800/145/final' },
    { title: 'AWS Well-Architected Framework', url: 'https://aws.amazon.com/architecture/well-architected/' },
    { title: 'The Twelve-Factor App', url: 'https://12factor.net/' },
  ],
};

const computeScaling: InfraLesson = {
  id: 'infra-compute-scaling',
  title: 'Scaling and capacity planning',
  stage: 1,
  order: 2,
  objectives: ['compute-scaling'],
  scope: 'senior',
  estMinutes: 30,
  summary:
    'Horizontal vs vertical scaling, choosing autoscaling signals, the end-to-end scale-out lag and how warm pools and headroom hide it, capacity planning from demand forecasts and per-instance throughput, load testing, and bin packing.',
  what: `Scaling is matching capacity to demand. **Vertical** scaling makes one instance bigger (simple, but bounded, often needs a restart, and concentrates risk). **Horizontal** scaling adds instances behind a load balancer (needs stateless or partitioned services, but scales nearly linearly and improves fault tolerance).

**Autoscaling** adjusts instance count from a signal: target tracking (keep CPU at 60%), step scaling, scheduled scaling, or predictive scaling from historical patterns. **Capacity planning** is the longer-horizon work: forecasting demand, knowing per-instance throughput from load tests, and ensuring quotas, IP space, and dependencies can absorb the plan.`,
  why: `Autoscaling is the difference between paying for peak 24/7 and paying for what you use, but it is reactive. A spike that arrives faster than your scale-out lag is served by whatever headroom exists; without headroom it becomes queueing, timeouts, retries and a cascading failure. Capacity planning catches what autoscaling cannot: account quotas, regional capacity, downstream limits, and launch events.`,
  problem: `Classic failures: scaling on CPU for an I/O-bound service that saturates its thread pool at 30% CPU, so the autoscaler never reacts; a scale-out that takes 6 minutes (instance boot, agent install, JIT warm-up, LB registration) while the spike peaks in 2; a scale-in that oscillates with scale-out (flapping); a fleet that scales to 300 instances and then hits the database connection limit, which is the real bottleneck; a launch day that hits the account's vCPU quota.`,
  how: `Build it from the bottleneck outward.

- **Measure per-instance capacity.** Load test one instance to find the throughput at which latency breaches SLO (the knee of the latency curve). Plan to run at a target utilisation below the knee, commonly 50–70%, to absorb bursts and an AZ loss.
- **Pick the right signal.** CPU works for CPU-bound services. For I/O-bound or concurrency-limited services, scale on **in-flight requests per instance**, request rate per target, or **queue depth/age** for workers. Latency is a poor primary signal (it rises late and also rises for reasons scaling cannot fix, like a slow dependency).
- **Account for scale-out lag.** Total lag = metric collection interval + evaluation periods + provisioning (VM boot or pod scheduling, possibly a new node) + application warm-up + LB health checks. Commonly 2–10 minutes for VMs, tens of seconds to minutes for containers (longer when nodes must be added).
- **Hide lag** with headroom sized for the fastest credible ramp over the lag window, **warm pools** of pre-initialised stopped instances, overprovisioned placeholder pods (low-priority pods evicted when real pods need room), scheduled scaling before known peaks, and predictive scaling.
- **Prevent flapping** with asymmetric policies: scale out fast, scale in slowly (cooldowns or stabilisation windows of several minutes) and in small steps.
- **Bin packing** for containers: set accurate requests (based on observed usage, e.g. p95), choose node sizes that fit common pod shapes, and use mixed instance types. Over-requesting wastes nodes; under-requesting causes contention and evictions.
- **Plan capacity end to end**: forecast peak (organic growth × seasonality × launch multiplier), divide by per-instance throughput at target utilisation, add N+1 per AZ (survive the loss of an AZ: with 3 AZs, each must hold 50% of peak), then check quotas, IPs, database connections, downstream rate limits and spot availability.`,
  components: [
    { name: 'Scaling signal', description: 'CPU, request rate per target, concurrency, queue depth or age, or custom business metrics. Must be a leading indicator that correlates with the bottleneck resource.' },
    { name: 'Scaling policy', description: 'Target tracking for steady control, step scaling for big jumps, scheduled for known patterns, predictive for daily cycles. Asymmetric scale-in to avoid flapping.' },
    { name: 'Provisioning path', description: 'Image size, boot and init time, container pull, node autoscaling, warm-up (JIT, caches), and LB registration. Each second here is a second of exposure to spikes.' },
    { name: 'Warm pools and overprovisioning', description: 'Pre-initialised capacity or placeholder pods that convert minutes of provisioning into seconds of attach or preemption.' },
    { name: 'Load testing', description: 'Find the knee of latency vs throughput per instance, verify linear scaling across instances, and expose the first shared bottleneck. Use realistic payloads and cache hit rates.' },
    { name: 'Capacity model', description: 'Forecast, per-unit throughput, utilisation target, redundancy (N+1, AZ loss), and dependency limits, reviewed before launches and quarterly.' },
  ],
  misconceptions: [
    { myth: 'Autoscaling means we do not need headroom.', reality: 'Autoscaling reacts after the signal moves and takes minutes to deliver capacity. Headroom covers the ramp during that lag; warm pools and predictive scaling shrink the lag but do not eliminate it.' },
    { myth: 'CPU is a fine default scaling metric.', reality: 'Only for CPU-bound services. I/O-bound services saturate threads, connections or memory at low CPU; scale on concurrency, request rate per target, or queue age instead.' },
    { myth: 'Scaling out always helps.', reality: 'If the bottleneck is a shared dependency (database, lock, third-party API), adding instances adds load to it and can worsen the outage. Find the first shared bottleneck in load tests.' },
    { myth: 'Running at 90% utilisation is efficient.', reality: 'Queueing delay grows non-linearly as utilisation approaches 100%; at high utilisation small bursts produce large latency spikes, and there is no room to absorb an AZ failure.' },
  ],
  example: {
    title: 'Capacity plan for a launch with an AZ-loss requirement',
    description: `Current peak 8,000 req/s, expected to triple for a launch. Load tests show one instance serves 400 req/s at the latency knee. Target utilisation 60% of the knee. Three AZs; must survive the loss of one AZ at peak without breaching SLO.`,
    code: `Launch peak            = 8,000 * 3                 = 24,000 req/s
Per-instance at target = 400 * 0.60                = 240 req/s
Instances needed       = 24,000 / 240              = 100

Survive AZ loss: remaining 2 AZs must carry the full peak
  per-AZ capacity      = 100 / 2                   = 50 instances per AZ
  total provisioned    = 50 * 3                    = 150 instances
  (or accept running at the knee, not 60%, during an AZ loss:
   24,000 / 400 = 60 needed across 2 AZs -> 30/AZ -> 90 total)

Scale-out lag ~5 min; observed max ramp ~+20%/min
  -> need ~+100% within the lag window: pre-scale to launch peak
     via scheduled scaling 30 min before; autoscale above that.

Checks: vCPU quota >= 150 * vCPUs; subnet IPs; DB pool:
  150 instances * 20 conns = 3,000 conns -> needs a pooler`,
    language: 'text',
  },
  exercise: {
    prompt: `A queue-worker fleet processes jobs averaging 2 s each, single-threaded, 4 workers per instance. Normal inflow is 100 jobs/s; a nightly batch drops 300,000 jobs at once and must drain within 30 minutes. Instances take 3 minutes to become ready. Design the scaling signal and estimate the required peak fleet.`,
    solution: `**Per-instance throughput:** 4 workers / 2 s = 2 jobs/s.

**Normal:** 100 / 2 = 50 instances (plus headroom, ~60).

**Batch:** effective drain time is 30 − 3 (provisioning) = ~27 min = 1,620 s. Required rate = 300,000 / 1,620 + 100 ongoing ≈ 185 + 100 = **~285 jobs/s → ~143 instances**, so scale to ~150.

**Signal:** scale on **backlog per instance** (queue depth / instances) or oldest-message age, not CPU: target backlog = acceptable latency × per-instance rate, e.g. 2 jobs/s × 600 s = 1,200 jobs per instance. With a step policy, a backlog of 300k immediately requests ~250 instances; cap the max at the downstream's limit. Add scheduled pre-scaling before the known batch to remove the 3-minute lag, and scale in slowly after the backlog clears. Verify downstream (DB, APIs) can take 285 jobs/s.`,
  },
  faq: [
    { q: 'How do I pick a target utilisation?', a: 'From the load test knee and your failure tolerance. With 3 AZs and an AZ-loss requirement, running each AZ at about two-thirds of the knee lets the remaining two absorb the lost one. Bursty traffic or slow scale-out argues for lower targets.' },
    { q: 'Horizontal or vertical for a database?', a: 'Vertical first: it is simple and a modern large instance handles a lot. Add read replicas for read scaling, and shard only when write throughput or dataset size exceeds a single primary; sharding is a one-way door with large operational cost.' },
    { q: 'How do Kubernetes autoscalers interact?', a: 'The horizontal pod autoscaler adds pods based on metrics; pending pods trigger the cluster autoscaler (or Karpenter-style provisioners) to add nodes, adding node boot time to the lag. Overprovisioning placeholder pods keep spare node capacity for instant scheduling.' },
  ],
  keyTerms: ['horizontal vs vertical scaling', 'target tracking', 'scale-out lag', 'warm pool', 'headroom', 'flapping / stabilisation window', 'queue backlog per instance', 'latency knee', 'N+1 / AZ-loss capacity', 'bin packing'],
  deeper: `Staff-level capacity work is about **shared bottlenecks and coordination**. Autoscalers are local controllers; when every service scales at once (a regional failover), they compete for the same quotas, the same scarce instance types, and the same downstream database. **Static stability** says the system should survive the loss of an AZ without needing to scale at all, because control planes and capacity are least available exactly when an AZ fails; that argues for pre-provisioned AZ-loss capacity for critical tiers. **Little's law** (concurrency = arrival rate × latency) links scaling signals: if latency doubles because a dependency slows, required concurrency doubles even at constant traffic, so concurrency-based autoscaling may scale out into a slow dependency and amplify it. Pair autoscaling with load shedding and maximum limits so the fleet cannot grow into a dependency's failure.`,
  interview: {
    seniorAnswer: `Start from per-instance capacity measured by load testing, pick a utilisation target below the latency knee, and size for the failure you must survive (an AZ loss). Choose a scaling signal that leads the bottleneck (concurrency or queue age for I/O-bound work), quantify scale-out lag, and cover it with headroom, warm pools or scheduled/predictive scaling. Scale out fast and in slowly. Then check everything that does not autoscale: quotas, IPs, database connections, downstream limits.`,
    followUps: [
      { q: 'Why not scale on latency?', a: 'Latency rises late, is noisy, and often rises because of a slow dependency; scaling out then adds pressure on that dependency. Use it as an SLO alert, not as the control signal.' },
      { q: 'Your autoscaler keeps flapping. Fix it.', a: 'Add a scale-in stabilisation window, scale in by smaller steps, check that the metric is not itself affected by scaling (e.g. per-instance averages that drop sharply when new instances start empty), and widen the gap between scale-out and scale-in thresholds.' },
      { q: 'How do you capacity plan for an event 10× normal traffic?', a: 'Load test at 10× including dependencies, pre-scale ahead of the event rather than relying on autoscaling, raise quotas and reserve capacity, cache aggressively, prepare load-shedding and feature degradation switches, and run a game day.' },
    ],
    redFlags: [
      'Assuming autoscaling removes the need for headroom',
      'CPU as the universal scaling metric',
      'No consideration of downstream limits when scaling out',
      'Sizing for average load rather than peak plus failure scenario',
    ],
    numbers: [
      'Target utilisation commonly 50–70% of measured capacity',
      'With N AZs, surviving one AZ loss needs each AZ sized to peak / (N − 1)',
      'VM scale-out lag ~2–10 min end to end; pods seconds to minutes (longer if nodes are added)',
      "Little's law: concurrency = arrival rate × time in system",
    ],
  },
  references: [
    { title: 'AWS Builders’ Library: Static stability using Availability Zones', url: 'https://aws.amazon.com/builders-library/static-stability-using-availability-zones/' },
    { title: 'Google SRE book: Handling Overload', url: 'https://sre.google/sre-book/handling-overload/' },
    { title: 'Google Cloud Well-Architected Framework', url: 'https://cloud.google.com/architecture/framework' },
  ],
};

const computePlatform: InfraLesson = {
  id: 'infra-compute-platform',
  title: 'Kubernetes as a multi-tenant platform',
  stage: 1,
  order: 3,
  objectives: ['compute-platform'],
  scope: 'senior',
  estMinutes: 35,
  summary:
    'Running Kubernetes as an internal product: tenancy models and isolation layers, cluster topology and blast radius, node pools, safe upgrades, and platform engineering with golden paths.',
  what: `Kubernetes as a platform means operating clusters for many teams rather than one application: providing **tenancy** (namespaces, quotas, policies), **isolation** proportional to trust, a **cluster topology** that limits blast radius, **upgrade and lifecycle** processes that do not break tenants, and **golden paths** (templates, CI, defaults) that make the right way the easy way.

Managed control planes (EKS, AKS, GKE) remove etcd and API server operations but leave you owning node pools, add-ons (CNI, ingress, DNS, autoscaler, policy engines), upgrades, and tenant experience.`,
  why: `Platform decisions scale both ways: a good one lets 50 teams ship safely with little friction; a bad one makes the cluster a shared failure domain where one team's misconfigured webhook, runaway job or CRD upgrade takes everyone down. Senior interviews probe whether you can reason about isolation, blast radius and upgrade safety rather than just YAML.`,
  problem: `Recurring incidents: a validating admission webhook with \`failurePolicy: Fail\` whose backend is down blocks all pod creation cluster-wide; a tenant without resource quotas schedules thousands of pods and starves others; a Kubernetes minor version upgrade removes a deprecated API that dozens of Helm charts still use; a single giant cluster per region means any control-plane or CNI issue is a regional outage; noisy neighbours on shared nodes cause latency spikes because pods have no limits.`,
  how: `Layer isolation and lifecycle deliberately.

- **Tenancy model.** Namespace-per-team (soft multi-tenancy) within shared clusters, or cluster-per-tenant (hard isolation, more overhead). Common hybrid: shared clusters per environment and region for trusted internal teams; dedicated clusters or node pools for regulated or untrusted workloads.
- **Isolation layers in a shared cluster.** RBAC scoped to namespaces; **ResourceQuota** and **LimitRange** for fairness; **NetworkPolicy** default-deny with explicit allows; Pod Security Admission (\`restricted\` profile) to block privileged pods; admission policies (OPA Gatekeeper, Kyverno, or built-in ValidatingAdmissionPolicy) for org rules; workload identity instead of node credentials; separate node pools with taints/tolerations for sensitive or noisy workloads; sandboxed runtimes for untrusted code.
- **Topology.** More, smaller clusters reduce blast radius and make upgrades incremental, at the cost of fleet management (GitOps, cluster templates, multi-cluster service discovery). Rule of thumb: at least per environment and per region; avoid stretching one cluster's control plane across regions.
- **Node pools.** Separate pools by instance type (general, memory, GPU, Arm), purchase model (on-demand base, spot burst), and trust. Use node auto-provisioning to pick shapes; keep system add-ons on a stable on-demand pool.
- **Upgrades.** Kubernetes ships about three minor releases per year and upstream supports roughly the latest three; providers have their own support windows, so plan for upgrades at least yearly. Process: scan for removed APIs before upgrading, upgrade non-prod first, control plane then nodes, **surge or blue/green node pools**, respect PodDisruptionBudgets, and keep add-on versions compatible. Treat clusters as cattle: being able to recreate a cluster from code is the ultimate rollback.
- **Platform engineering.** Offer **golden paths**: service templates with CI/CD, sane defaults (probes, requests, PDBs, network policies), observability wired in, and a self-service portal or CLI. Measure adoption, lead time and incident rate; keep escape hatches for advanced teams.`,
  components: [
    { name: 'Namespaces, RBAC and quotas', description: 'The basic soft-tenancy unit: who can do what, and how much CPU, memory, object count and storage a tenant may consume.' },
    { name: 'NetworkPolicy and Pod Security', description: 'Default-deny east-west traffic per namespace; Pod Security Admission levels (privileged, baseline, restricted) enforced per namespace.' },
    { name: 'Admission control', description: 'Validating/mutating webhooks and in-process policies that enforce org rules. Webhooks are in the API request path: availability, timeouts and failure policy are critical.' },
    { name: 'Node pools and scheduling', description: 'Taints, tolerations, affinity, topology spread constraints and priority classes to place workloads by hardware, trust and failure domain.' },
    { name: 'Cluster lifecycle', description: 'IaC/GitOps-defined clusters, version skew policy, deprecated API scanning, surge or blue/green node upgrades, PDB-aware draining.' },
    { name: 'Golden paths / internal developer platform', description: 'Opinionated templates, pipelines and defaults offered as a product with documentation, SLOs and feedback loops.' },
  ],
  misconceptions: [
    { myth: 'Namespaces isolate tenants.', reality: 'Namespaces are a naming and policy scope. Without RBAC, quotas, network policies, pod security and node isolation, tenants share kernel, network and control plane freely.' },
    { myth: 'One big cluster is cheaper and simpler.', reality: 'It maximises bin packing but concentrates blast radius, makes upgrades all-or-nothing, and runs into scale limits (API server load, etcd size, IP space). Most organisations land on several medium clusters managed as a fleet.' },
    { myth: 'Managed Kubernetes means the provider handles upgrades.', reality: 'Providers upgrade the control plane (often on a schedule you must follow), but deprecated APIs in your manifests, add-on compatibility, node upgrades and tenant disruption are yours.' },
    { myth: 'A platform team should hide Kubernetes completely.', reality: 'Abstractions that hide everything leak during incidents. Good golden paths cover the common case with defaults and let teams see and override underlying resources when needed.' },
  ],
  example: {
    title: 'Tenant namespace baseline',
    description: `A baseline every tenant namespace gets from the platform via GitOps: quota, default limits, default-deny network policy, and restricted pod security. Teams add allow rules for their own traffic.`,
    code: `apiVersion: v1
kind: Namespace
metadata:
  name: team-payments
  labels:
    pod-security.kubernetes.io/enforce: restricted
---
apiVersion: v1
kind: ResourceQuota
metadata: { name: quota, namespace: team-payments }
spec:
  hard:
    requests.cpu: "40"
    requests.memory: 80Gi
    limits.memory: 120Gi
    pods: "300"
---
apiVersion: v1
kind: LimitRange
metadata: { name: defaults, namespace: team-payments }
spec:
  limits:
    - type: Container
      defaultRequest: { cpu: 100m, memory: 128Mi }
      default: { memory: 512Mi }
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny, namespace: team-payments }
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
  egress:
    - to:
        - namespaceSelector: {}
          podSelector: { matchLabels: { k8s-app: kube-dns } }
      ports: [{ protocol: UDP, port: 53 }, { protocol: TCP, port: 53 }]`,
    language: 'yaml',
  },
  exercise: {
    prompt: `You run 4 production clusters (2 regions × 2) hosting 60 teams, currently one minor version behind the provider's oldest supported version in 3 months. Design an upgrade programme that minimises tenant disruption, and list the guardrails you would add so the next upgrade is routine.`,
    solution: `**Programme:**
- Week 1: scan all manifests and Helm releases for APIs removed in the target versions (deprecation tooling plus API server audit logs of deprecated calls); open tickets per owning team with a deadline.
- Upgrade non-prod clusters first, one minor version at a time (control plane cannot skip minors); validate add-ons (CNI, ingress, DNS, autoscaler, policy engine) against the compatibility matrix.
- Production: one cluster at a time, starting with the lowest-traffic region. Control plane, then node pools via **blue/green pools** (new pool at target version, cordon and drain old pool respecting PDBs), with traffic shifted away from the cluster at the global LB if multi-cluster serving allows.
- Pause criteria: SLO burn, PDB-blocked drains, failed health checks.

**Guardrails:** CI policy that rejects deprecated APIs; mandatory PDBs and readiness probes via admission policy; webhooks with \`failurePolicy: Ignore\` or highly available backends, short timeouts and namespace selectors that exclude system namespaces; a quarterly upgrade cadence so you are never more than one version behind; cluster recreation from code tested regularly.`,
  },
  faq: [
    { q: 'Soft or hard multi-tenancy?', a: 'Soft (shared cluster, namespace isolation) for teams within one trust boundary. Hard (separate clusters or sandboxed runtimes plus dedicated nodes) when tenants are untrusted, regulated, or need conflicting cluster-scoped configuration like different CRD versions.' },
    { q: 'How many clusters should we have?', a: 'Enough to bound blast radius and match failure domains (at least per environment and region), few enough that the platform team can manage them as a fleet with automation. Splitting further by compliance boundary or tenant tier is common.' },
    { q: 'How do I stop a webhook from taking down the cluster?', a: 'Run it highly available with PDBs, set short timeouts, exclude kube-system and the webhook’s own namespace via selectors, alert on webhook latency and rejections, and choose failurePolicy consciously: Fail for security-critical checks, Ignore for convenience mutations.' },
  ],
  keyTerms: ['soft vs hard multi-tenancy', 'ResourceQuota', 'LimitRange', 'NetworkPolicy', 'Pod Security Admission', 'admission webhook failurePolicy', 'node pool', 'taints and tolerations', 'PodDisruptionBudget', 'golden path'],
  deeper: `The real scaling limit of a shared platform is usually **cluster-scoped state**: CRDs, webhooks, operators and controllers are global, and every tenant depends on them. Treat each cluster-wide add-on as a tier-0 service with its own SLO and change process. **Priority and preemption** let critical system pods evict batch work, but misuse lets one team preempt another. **Control plane load** from chatty controllers (frequent list/watch, large objects, excessive events) degrades the API server for everyone; API Priority and Fairness exists to isolate this, and you should know it is there. At staff level, measure the platform like a product: adoption of golden paths, time-to-first-deploy for a new service, percentage of workloads on supported versions, and the share of incidents caused by the platform versus by tenants.`,
  interview: {
    seniorAnswer: `Treat the platform as a product with layered isolation and controlled blast radius. Explain the tenancy model (namespaces with RBAC, quotas, default-deny network policy, restricted pod security, workload identity; dedicated pools or clusters for untrusted or regulated tenants), the topology (multiple clusters per environment and region, managed as a fleet via GitOps), and the lifecycle (regular upgrades, deprecated API scanning, blue/green node pools, PDBs). Call out shared cluster-scoped components (webhooks, CRDs, CNI) as the main cross-tenant risk, and describe golden paths that make the secure default the easy one.`,
    followUps: [
      { q: 'A tenant’s CronJob created 20,000 pods. What should have prevented it?', a: 'ResourceQuota on pods and compute per namespace, LimitRange defaults, concurrencyPolicy on the CronJob, and object-count quotas. Also alert on pending pods per namespace.' },
      { q: 'How do you give pods cloud access without node credentials?', a: 'Workload identity: bind a Kubernetes service account to a cloud identity (IRSA/EKS Pod Identity, Azure Workload Identity, GKE Workload Identity) so each pod gets short-lived, scoped credentials, and block access to the node metadata endpoint.' },
      { q: 'How do you roll back a bad cluster upgrade?', a: 'Control-plane minors usually cannot be downgraded in place. Roll back by shifting traffic to another cluster or recreating from code at the previous version; for node pools, keep the old pool until the new one is validated.' },
    ],
    redFlags: [
      'Believing namespaces alone provide isolation',
      'No quota or limit defaults for tenants',
      'Webhooks with failurePolicy Fail and a single replica',
      'Treating upgrades as rare, manual events',
      'One cluster per region for everything with no plan for blast radius',
    ],
    numbers: [
      'Kubernetes: ~3 minor releases per year; upstream maintains roughly the latest 3',
      'Control plane upgrades go one minor version at a time',
      'Pod Security Admission levels: privileged, baseline, restricted',
    ],
  },
  references: [
    { title: 'Kubernetes documentation: Multi-tenancy', url: 'https://kubernetes.io/docs/concepts/security/multi-tenancy/' },
    { title: 'Open Policy Agent documentation', url: 'https://www.openpolicyagent.org/docs/latest/' },
    { title: 'CNCF projects', url: 'https://www.cncf.io/projects/' },
  ],
};

const storageTypes: InfraLesson = {
  id: 'infra-storage-types',
  title: 'Storage types, durability and performance',
  stage: 2,
  order: 1,
  objectives: ['storage-types'],
  scope: 'senior',
  estMinutes: 30,
  summary:
    'Block vs file vs object storage, how object stores reach eleven nines of durability, durability vs availability, IOPS vs throughput vs latency, consistency guarantees of object stores, storage classes and lifecycle, and what snapshots do and do not protect.',
  what: `Cloud storage comes in three access models:

- **Block** (EBS, Azure Managed Disks, Persistent Disk): a raw volume attached to one instance (some support limited multi-attach), formatted with a filesystem. Lowest latency, zonal, sized and billed by provisioned capacity and performance.
- **File** (EFS, Azure Files, Filestore): a shared POSIX/NFS or SMB filesystem mounted by many clients. Convenient for shared state and lift-and-shift; metadata operations and small files are the weak spot.
- **Object** (S3, Azure Blob Storage, Cloud Storage): immutable objects addressed by key over HTTP APIs, effectively unlimited scale, regional or multi-region, very high durability, higher per-request latency, billed per GB-month plus requests and egress.

Two properties are routinely confused: **durability** (probability data is not lost) and **availability** (probability you can access it right now).`,
  why: `Storage choice drives cost, latency, failure behaviour and recovery. Putting a database on a network file share causes latency and locking problems; serving millions of small files from block volumes forces you to manage fleets; storing backups in the same account and region as production means one credential compromise or regional event destroys both. Senior engineers are expected to reason in IOPS, throughput, durability and RPO, not product names.`,
  problem: `Incidents in this space are expensive: a database on a volume provisioned for 3,000 IOPS starts queueing when a batch job adds random reads, and latency jumps from 1 ms to 50 ms; a team assumes snapshots are backups, then an attacker with the same credentials deletes both; a lifecycle rule moves objects to an archive tier with a retrieval time of hours during an incident that needs them in minutes; a single-AZ volume becomes unavailable during an AZ event and the service has no replica.`,
  how: `Understand the mechanism behind each property.

- **Object durability.** Providers advertise designs for **99.999999999% (eleven nines)** annual durability for standard object storage. Mechanism: each object is split into fragments with **erasure coding** (e.g. k data + m parity fragments, any k recover the object) spread across many devices and, for regional classes, across multiple AZs; continuous background **scrubbing** verifies checksums and repairs lost fragments faster than further failures accumulate. Durability is a function of fragment spread, failure rates and repair time. It does **not** protect against you deleting or overwriting data: that is what versioning, object lock and cross-account replication are for.
- **Availability** is lower and separate: standard object storage availability SLAs are typically in the 99.9–99.99% range. Data can be perfectly durable and temporarily unreachable.
- **Block performance.** Three numbers: **IOPS** (operations/s, matters for random small I/O like databases), **throughput** (MB/s, matters for sequential scans and streaming), and **latency** (per-op, network-attached block is sub-millisecond to low milliseconds; local NVMe is lower). Throughput ≈ IOPS × I/O size, and each volume and each instance has caps; the instance's storage bandwidth limit is often the hidden ceiling. Queue depth links them: achievable IOPS ≈ queue depth / latency (Little's law).
- **Block durability** is replicated within an AZ, so annual failure rates are low but not eleven nines; snapshots (incremental, stored in object storage) are how you get cross-AZ and cross-region recovery points.
- **Object consistency.** Major object stores now provide **strong read-after-write consistency** for object PUTs and DELETEs and for listings (S3 since December 2020; Cloud Storage and Azure Blob are strongly consistent too). There is still no multi-object transaction; renaming is copy + delete, and cross-region replication is asynchronous.
- **Storage classes and lifecycle.** Hot/standard, infrequent access (cheaper storage, retrieval fee, minimum duration), archive (cheapest, retrieval minutes to hours). Lifecycle rules move or expire objects by age; tier based on actual access patterns, and model retrieval and minimum-duration charges.
- **Snapshots vs backups.** A snapshot is a point-in-time copy, typically crash-consistent unless you quiesce the application. A **backup** strategy needs isolation (separate account, immutable or locked storage), multiple recovery points, and tested restores. Rule of thumb 3-2-1: three copies, two media/services, one offsite/isolated.`,
  components: [
    { name: 'Block volume', description: 'Zonal, attached to an instance, with provisioned or baseline IOPS and throughput. Best for databases and boot disks; size performance explicitly.' },
    { name: 'Local instance storage', description: 'NVMe directly attached to the host: lowest latency and highest IOPS, but ephemeral, lost when the instance stops or the host fails. Use for caches, scratch, or replicated databases that tolerate node loss.' },
    { name: 'Shared file system', description: 'NFS/SMB semantics for many clients; throughput may scale with stored size or provisioned capacity. Weak at metadata-heavy workloads and file locking across clients.' },
    { name: 'Object storage', description: 'HTTP API, flat key namespace, erasure-coded across devices and AZs, strong read-after-write consistency, per-request and egress pricing, versioning and object lock for protection.' },
    { name: 'Storage classes and lifecycle', description: 'Tiering by access frequency with different storage, retrieval and minimum-duration costs; automated by lifecycle rules or intelligent tiering.' },
    { name: 'Snapshots and replication', description: 'Incremental point-in-time copies of volumes; asynchronous cross-region replication for objects. Both have RPO greater than zero and need isolation from the source credentials.' },
  ],
  misconceptions: [
    { myth: 'Eleven nines of durability means my data cannot be lost.', reality: 'It covers hardware failure. It does not cover deletion, overwrite, ransomware, a bad lifecycle rule or a compromised credential. Use versioning, object lock, and replication to an isolated account.' },
    { myth: 'Durability and availability are the same thing.', reality: 'Durability is about not losing data; availability is about reaching it now. Object stores design for eleven nines durability but offer three-to-four nines availability.' },
    { myth: 'Snapshots are backups.', reality: 'Snapshots in the same account and region share the source’s blast radius and credentials. They become backups when copied to an isolated, immutable location with tested restores.' },
    { myth: 'A bigger volume is always faster.', reality: 'Performance depends on the volume type’s IOPS/throughput settings and the instance’s storage bandwidth cap. A large volume on a small instance can be limited by the instance.' },
  ],
  example: {
    title: 'Sizing a database volume: IOPS, throughput and the instance cap',
    description: `A PostgreSQL primary needs 6,000 random 16 KB reads/s at peak plus 2,000 writes/s, and a nightly sequential scan at 400 MB/s. Volume caps and instance bandwidth vary by provider and type; the numbers below are illustrative.`,
    code: `Random I/O:   (6,000 + 2,000) ops/s           = 8,000 IOPS
              8,000 * 16 KB                    = ~128 MB/s
Sequential:   400 MB/s at 256 KB I/O           = ~1,600 IOPS
Provision:    >= 10,000 IOPS (25% headroom), >= 600 MB/s throughput
              (covers random 128 + scan 400 = 528 MB/s if they overlap)

Little's law check (at ~1 ms per op):
  queue depth needed = IOPS * latency = 8,000 * 0.001 = 8 outstanding I/Os

Instance cap: if the instance's storage bandwidth is 600 MB/s,
  random + scan together (128 + 400 = 528 MB/s) fits, barely.
  Run the scan on a read replica to protect the primary.

Durability plan:
  - synchronous standby in another AZ (RPO ~0 for AZ loss)
  - continuous WAL archiving to object storage (PITR)
  - daily snapshot copied to a separate backup account, locked 35 days
  - quarterly restore test, measured RTO`,
    language: 'text',
  },
  exercise: {
    prompt: `Design storage for a media platform: 2 PB of user-uploaded videos (90% are rarely accessed after 30 days), a metadata database, and transcoding workers that need fast scratch space. Requirements: survive an AZ loss with no data loss for uploads, survive account compromise, and minimise cost. Specify storage types, classes, protection mechanisms and one cost estimate.`,
    solution: `- **Videos:** regional object storage (multi-AZ erasure coding gives AZ-loss durability). Lifecycle: standard for 30 days, then infrequent access; very old content to archive only if a retrieval delay is acceptable for that product. Enable versioning and object lock (or deletion protection) for a retention window, and replicate to a separate account (and optionally region) with independent credentials.
- **Metadata DB:** block volumes with a multi-AZ synchronous standby, PITR via log archiving, and snapshots copied to the backup account.
- **Transcoding scratch:** local NVMe on the workers (ephemeral, fast); inputs and outputs are in object storage, so a lost node just retries the job.
- **Cost sketch (illustrative prices):** 2 PB = 2,000,000 GB. All standard at ~$0.021/GB-month ≈ $42k/month. With 10% standard and 90% infrequent access at ~$0.0125/GB-month ≈ $4.2k + $22.5k = **~$26.7k/month**, saving ~$15k/month before retrieval fees. Check that minimum-duration and per-GB retrieval charges do not eat the saving for content that gets re-popularised.`,
  },
  faq: [
    { q: 'When should I use a shared file system instead of object storage?', a: 'When applications need POSIX semantics (legacy apps, shared home directories, some ML training pipelines) and cannot be changed. For new applications, object storage is cheaper and scales better; use file systems sparingly and watch metadata performance.' },
    { q: 'Are object stores eventually consistent?', a: 'Not anymore for the major providers: S3, Cloud Storage and Azure Blob provide strong read-after-write consistency for object operations. Cross-region replication is still asynchronous, and there are no multi-object transactions.' },
    { q: 'How do I protect against ransomware in cloud storage?', a: 'Versioning plus object lock (WORM) with a retention period, backups in a separate account with separate admin identities, MFA/approval for deletion, and alerting on mass deletes or encryption-key changes.' },
  ],
  keyTerms: ['block vs file vs object', 'durability vs availability', 'eleven nines', 'erasure coding', 'IOPS', 'throughput', 'queue depth', 'read-after-write consistency', 'storage class / lifecycle', 'snapshot', 'object lock', '3-2-1 backup'],
  deeper: `At staff level the question is **correlated failure**, because durability math assumes independent failures. Shared firmware bugs, a bad deploy of the storage control plane, a region-wide event, or one compromised IAM principal are correlated and are the real risks: that is why isolation (separate accounts, regions, credentials and ideally providers for the most critical backups) matters more than an extra nine. **Small-object economics** often dominate cost: per-request charges and per-object metadata overhead mean billions of tiny objects should be batched or packed. **Egress** turns "cheap" storage into an expensive serving path; front with a CDN or keep compute co-located. Finally, measure RPO and RTO in drills: a backup that takes 40 hours to restore 200 TB is a backup with a 40-hour RTO, so test restore throughput, not just backup success.`,
  interview: {
    seniorAnswer: `Pick storage by access pattern: block for low-latency single-writer state (databases), file for shared POSIX needs, object for everything large, shared or durable. Separate durability (eleven nines via erasure coding across AZs plus scrubbing) from availability (three to four nines) and from protection against humans and attackers (versioning, object lock, isolated-account backups). Size block storage in IOPS, throughput and instance caps, explain object consistency (strong read-after-write on major providers, async cross-region replication), and quantify tiering savings net of retrieval fees.`,
    followUps: [
      { q: 'How does an object store achieve eleven nines?', a: 'Erasure coding across many devices and AZs so multiple simultaneous failures are survivable, checksums on every fragment, continuous scrubbing and fast repair so the window of reduced redundancy is short.' },
      { q: 'Your database p99 latency spikes during nightly jobs. Storage-related causes?', a: 'Volume IOPS or throughput cap reached, instance storage bandwidth cap reached, burst credits exhausted on burstable volume types, or the job saturating queue depth. Check volume metrics (queue length, throttling), move the job to a replica, or provision more performance.' },
      { q: 'What is the RPO of cross-region object replication?', a: 'Greater than zero: replication is asynchronous, typically seconds to minutes, with some providers offering an SLA-backed replication time for a fee. Design for the lag and monitor replication backlog.' },
    ],
    redFlags: [
      'Equating durability with availability',
      'Calling same-account snapshots a backup strategy',
      'Claiming object storage is eventually consistent (outdated for major providers)',
      'Sizing volumes by capacity only, ignoring IOPS/throughput and instance caps',
    ],
    numbers: [
      'Standard object storage designed for 99.999999999% annual durability; availability SLAs ~99.9–99.99%',
      'Throughput ≈ IOPS × I/O size; IOPS ≈ queue depth / latency',
      'Network block latency ~sub-ms to low ms; local NVMe tens to low hundreds of µs (order of magnitude)',
      '3-2-1 backup rule: 3 copies, 2 media, 1 offsite/isolated',
    ],
  },
  references: [
    { title: 'AWS Well-Architected Framework', url: 'https://aws.amazon.com/architecture/well-architected/' },
    { title: 'Google Cloud Well-Architected Framework', url: 'https://cloud.google.com/architecture/framework' },
    { title: 'Brendan Gregg: The USE Method', url: 'https://www.brendangregg.com/usemethod.html' },
  ],
};

const dataDatabases: InfraLesson = {
  id: 'infra-data-databases',
  title: 'Databases at scale: replication, sharding and operations',
  stage: 2,
  order: 2,
  objectives: ['data-databases'],
  scope: 'senior',
  estMinutes: 35,
  summary:
    'Relational vs NoSQL by access pattern, synchronous vs asynchronous replication and replication lag, read-your-writes, choosing shard keys and avoiding hot partitions, resharding, connection pooling, and online schema migrations.',
  what: `Operating databases at scale is about three axes: **replication** (copies for durability, availability and read scaling), **partitioning/sharding** (splitting data so writes and storage scale beyond one node), and **operations** (connections, schema change, failover, backups).

**Relational** databases (PostgreSQL, MySQL, and managed offerings such as RDS/Aurora, Azure Database, Cloud SQL/AlloyDB, plus distributed SQL like Spanner or CockroachDB) give transactions, joins and a flexible query model. **NoSQL** stores (key-value and wide-column such as DynamoDB, Cosmos DB, Bigtable, Cassandra; document stores such as MongoDB) trade query flexibility for predictable scale-out on a known access pattern.`,
  why: `The database is usually the hardest component to scale and the most expensive to get wrong: it holds state, it is where consistency is decided, and changes are slow and risky. Senior interviews almost always reach "what happens when the database is the bottleneck", and the expected answer is a ladder of options with costs, not a jump straight to sharding.`,
  problem: `Typical failures: a user updates their profile, the page reloads from a lagging replica and shows the old value; a shard key on \`created_date\` sends all writes to the newest partition; a celebrity account turns one partition hot; 400 application pods each open 20 connections and exhaust the database's connection limit; an \`ALTER TABLE\` takes an exclusive lock and blocks all writes for minutes; failover to an async replica silently loses the last seconds of committed writes.`,
  how: `Climb the ladder only as far as needed.

- **Optimise first**: indexes, query plans, avoiding N+1 queries, and vertical scaling. A large modern instance handles a lot.
- **Replication.** The primary ships its log (WAL/binlog) to replicas. **Synchronous** replication waits for at least one replica to acknowledge before commit: RPO ≈ 0 for that replica, at the cost of commit latency (cross-AZ ~1–2 ms extra) and availability coupling. **Asynchronous** replication commits locally and ships later: no latency cost, but **replication lag** (normally milliseconds, seconds to minutes under load or long transactions) and possible data loss on failover. Common pattern: synchronous standby in another AZ for HA, async replicas for reads and cross-region DR.
- **Read-your-writes** with replicas: route a user's reads to the primary for a short window after they write, or track the write's log position (LSN/GTID) and read from a replica only once it has caught up, or keep session-critical reads on the primary.
- **Connection management.** Each connection costs memory and, for process-per-connection databases like PostgreSQL, a process; thousands of idle connections hurt. Use a pooler (PgBouncer, RDS Proxy, or similar) in transaction-pooling mode so thousands of clients share tens to low hundreds of server connections; size application pools so pods × pool size stays under the limit.
- **Partitioning/sharding.** Choose a **shard key** that (1) appears in most queries, so queries hit one shard, (2) has high cardinality and even distribution, and (3) avoids monotonic hot spots. Hash on tenant or user ID is common; time-based keys need a hash prefix or bucket. **Hot keys** (a celebrity, a big tenant) need special handling: split the key (\`key#0..N\` write sharding with read fan-in), move big tenants to dedicated shards, or cache. Cross-shard queries and transactions become expensive or unsupported.
- **Resharding.** Use many **logical shards** (e.g. 1,024) mapped to fewer physical nodes, so growth moves logical shards rather than rehashing all data; consistent hashing serves the same goal. Migration pattern: copy snapshot, stream changes (CDC), verify, cut over per shard with a brief write freeze or dual writes.
- **Online schema migration.** Expand/contract: add nullable column or new table (expand), dual-write and backfill in batches, switch reads, then drop old (contract), each step deployed separately and backward-compatible with the previous app version. For large tables, use online tools (e.g. gh-ost or pt-online-schema-change for MySQL; for PostgreSQL, operations like \`CREATE INDEX CONCURRENTLY\`) and set \`lock_timeout\` so DDL fails fast instead of queueing behind long transactions and blocking everyone.`,
  components: [
    { name: 'Primary and replicas', description: 'Single writer with log-shipping replicas. Sync for zero-RPO failover, async for read scaling and DR with lag.' },
    { name: 'Failover controller', description: 'Detects primary failure, promotes a replica, repoints clients (DNS or proxy). Must fence the old primary to avoid split brain; failover time is commonly tens of seconds to a couple of minutes on managed services.' },
    { name: 'Connection pooler / proxy', description: 'Multiplexes many client connections onto few server connections, smooths failover, and protects the database from connection storms.' },
    { name: 'Shard map and router', description: 'Maps keys to logical shards and logical shards to physical nodes; lives in the application, a proxy layer, or the database itself (distributed SQL, managed NoSQL).' },
    { name: 'Change data capture (CDC)', description: 'Streams committed changes from the log for replication, resharding, cache invalidation and analytics without dual writes in application code.' },
    { name: 'Schema migration tooling', description: 'Versioned migrations, expand/contract discipline, online DDL tools, lock timeouts and batched backfills.' },
  ],
  misconceptions: [
    { myth: 'Read replicas are a free read-scaling win.', reality: 'They introduce replication lag, so reads may be stale and read-your-writes breaks. Applications must tolerate or route around staleness, and replica lag needs monitoring and alerting.' },
    { myth: 'Failover to a replica never loses data.', reality: 'Only if the promoted replica was synchronous. Async failover loses whatever had not replicated, typically the last seconds of writes; that is your RPO.' },
    { myth: 'NoSQL scales automatically.', reality: 'It scales if your partition key distributes load evenly and your queries match the key. A bad key creates hot partitions that throttle at a single partition’s limit regardless of total capacity.' },
    { myth: 'Schema changes are just a migration file.', reality: 'On a large, busy table DDL can take locks that block writes or rewrite the table for hours. Use expand/contract, online tools, lock timeouts and batched backfills, and keep each step compatible with the running code.' },
  ],
  example: {
    title: 'Connection budget and safe DDL on PostgreSQL',
    description: `400 pods each configured with a pool of 20 connections would open 8,000 connections against a database whose max_connections is ~2,000. A transaction-mode pooler collapses this to a few hundred server connections. Separately, adding a column with a default and an index on a 500 M-row table must not block writes.`,
    code: `# Connection budget
clients: 400 pods * 20 = 8,000 client connections -> PgBouncer (transaction mode)
server pool: ~200 connections  (roughly a few per CPU core, tune by load test)

-- Safe DDL (PostgreSQL 11+: ADD COLUMN with a constant default is metadata-only)
SET lock_timeout = '3s';          -- fail fast instead of queueing behind long txns
SET statement_timeout = '0';
ALTER TABLE orders ADD COLUMN region text DEFAULT 'unknown';
CREATE INDEX CONCURRENTLY idx_orders_region ON orders (region);

-- Backfill in batches, not one giant UPDATE
UPDATE orders SET region = c.region
FROM customers c
WHERE orders.customer_id = c.id
  AND orders.id BETWEEN :start AND :start + 10000
  AND orders.region = 'unknown';`,
    language: 'text',
  },
  exercise: {
    prompt: `A multi-tenant SaaS on a single PostgreSQL primary (64 vCPU) is at 75% CPU with 80% of load being reads; writes are growing 8% per month; the largest tenant generates 15% of all traffic. Lay out a scaling roadmap for the next 24 months, including when you would shard, the shard key, and how you handle the big tenant.`,
    solution: `**Now:** query and index tuning, a pooler, and 2–3 async read replicas for read-heavy, staleness-tolerant endpoints, with read-your-writes routing (primary for a few seconds after a user's write, or LSN-based). Expect primary CPU to fall well below 50%.

**Write growth:** 8%/month compounds to ~2.5× in 12 months and ~6.3× in 24 months. Writes are ~20% of today's load, so the primary handles that for roughly a year after offloading reads; vertical headroom buys a little more.

**Months 9–15: shard by tenant_id.** Almost all queries are tenant-scoped, cardinality is high, and it enables per-tenant isolation. Use ~1,024 logical shards on a handful of physical clusters, a shard directory (tenant → logical shard), and CDC-based migration per tenant with a short write freeze per tenant at cutover.

**Big tenant:** 15% of traffic would make its shard hot, so place it on a dedicated physical cluster (the directory makes this a mapping change), and plan intra-tenant partitioning by a secondary key if it keeps growing.

**Alternatives to evaluate:** distributed SQL (avoids app-level sharding at the cost of latency and migration effort) or moving specific high-volume tables to a key-value store.`,
  },
  faq: [
    { q: 'When should I choose NoSQL over relational?', a: 'When the access patterns are known and key-based, scale or availability requirements exceed a single primary, and you can give up ad-hoc joins and multi-row transactions (or use the limited transactions NoSQL offers). Relational remains the default for most business data.' },
    { q: 'How do I monitor replication lag?', a: 'Track replica lag in bytes and seconds (log position difference and replay timestamp), alert when it exceeds what readers can tolerate, and automatically pull lagging replicas out of read rotation.' },
    { q: 'Is distributed SQL a replacement for sharding?', a: 'It automates sharding, rebalancing and cross-shard transactions with consensus replication, at the cost of higher write latency (consensus round trips), cost and operational novelty. Data modelling for locality still matters to avoid cross-region transactions.' },
  ],
  keyTerms: ['synchronous vs asynchronous replication', 'replication lag', 'read-your-writes', 'RPO on failover', 'connection pooling', 'shard key', 'hot partition', 'logical shards', 'resharding', 'CDC', 'expand/contract migration', 'lock_timeout'],
  deeper: `The staff-level view is that **consistency is a product decision expressed in routing**: which endpoints accept stale reads, how stale, and what the user sees during failover. Make it explicit per endpoint rather than letting the ORM choose. **Failover safety** depends on fencing: the old primary must be prevented from accepting writes (by revoking its role, isolating it in the proxy, or STONITH) or you get split brain and divergent histories that are painful to reconcile. **Long-running transactions** are a hidden global hazard in MVCC databases: they block vacuum (bloat), hold back replication on some setups, and make DDL queue behind them, which then blocks every other query. Finally, **multi-region writes** force a choice between consensus latency on every write (Spanner-style), single-region writes with regional read replicas, or partitioning data by home region; most systems should pick the last.`,
  interview: {
    seniorAnswer: `Present a scaling ladder with costs: tune queries and indexes, scale vertically, add a pooler, add async read replicas with explicit read-your-writes handling, then partition by a key that matches the access pattern. State replication trade-offs (sync for RPO≈0 at a latency cost, async for reads and DR with lag and failover loss), the shard-key criteria (query locality, cardinality, no monotonic hot spots), how hot keys are split or isolated, and how resharding works with logical shards and CDC. Mention online schema migration (expand/contract, lock timeouts) and connection budgets as day-2 realities.`,
    followUps: [
      { q: 'How would you implement read-your-writes with async replicas?', a: 'Capture the commit LSN/GTID on write, store it in the session, and only read from a replica whose replay position is at or past it; otherwise go to the primary. A simpler variant routes a user to the primary for N seconds after any write.' },
      { q: 'A DynamoDB-style table is throttling even though total capacity is underused. Why?', a: 'A hot partition: traffic concentrates on a few partition keys, hitting per-partition throughput limits. Fix the key design (higher cardinality, write sharding with suffixes) or cache hot reads.' },
      { q: 'How do you migrate a column type on a 2 TB table with zero downtime?', a: 'Expand/contract: add a new column, dual-write from the app (or triggers/CDC), backfill in batches with throttling, verify, switch reads, stop writing the old column, drop it later. Each step is a separate deploy compatible with the previous app version.' },
      { q: 'What is split brain and how is it prevented?', a: 'Two nodes both acting as primary after a partition, accepting conflicting writes. Prevent with quorum-based leader election, fencing of the old primary, and clients that connect via a proxy or endpoint that only points to the elected leader.' },
    ],
    redFlags: [
      'Jumping to sharding before replicas, tuning and vertical scaling',
      'Ignoring replication lag and read-your-writes',
      'Choosing a timestamp or auto-increment as the shard key',
      'Unbounded per-pod connection pools',
      'Running blocking DDL on large tables in production',
    ],
    numbers: [
      'Sync replication across AZs adds roughly a cross-AZ RTT (~1–2 ms) per commit',
      'Async replica lag normally ms, can grow to minutes under load',
      'Managed database failover commonly tens of seconds to ~2 minutes',
      'Compound growth: 8%/month ≈ 2.5×/year',
    ],
  },
  references: [
    { title: 'PostgreSQL docs: High Availability, Load Balancing, and Replication', url: 'https://www.postgresql.org/docs/current/high-availability.html' },
    { title: 'Jepsen: Consistency Models', url: 'https://jepsen.io/consistency' },
    { title: 'The System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' },
  ],
};

const dataCaching: InfraLesson = {
  id: 'infra-data-caching',
  title: 'Caching: patterns, invalidation and failure modes',
  stage: 2,
  order: 3,
  objectives: ['data-caching'],
  scope: 'senior',
  estMinutes: 30,
  summary:
    'Cache-aside, read-through, write-through and write-back; TTLs and invalidation; stampede and thundering-herd mitigation with request coalescing, jittered TTLs and stale-while-revalidate; hot keys; and cache tiers from CDN to in-process.',
  what: `A cache stores the result of expensive work closer to where it is needed so the next request is cheaper. Tiers, from nearest to farthest: **in-process** memory (nanoseconds, per-instance, inconsistent across instances), **distributed cache** (Redis, Memcached; managed as ElastiCache/MemoryDB, Azure Cache for Redis / Azure Managed Redis, Memorystore; sub-millisecond within an AZ), **CDN/edge** (close to users, for HTTP responses), and database-internal buffer caches.

Patterns describe who populates and updates the cache: **cache-aside** (application reads cache, on miss reads the database and fills the cache), **read-through** (the cache library loads on miss), **write-through** (writes go to cache and database synchronously), and **write-back/write-behind** (writes go to cache and are flushed later).`,
  why: `Caching is the cheapest way to cut latency and protect databases, and also one of the most common causes of outages and correctness bugs. A cache at 95% hit ratio means the database sees 5% of reads; if the cache empties, the database sees 20× its normal read load instantly. Interviewers look for whether you treat the cache as an optimisation that can fail, and whether you can reason about staleness.`,
  problem: `Classic incidents: a cache cluster restart drops the hit ratio to zero and the database collapses under the miss storm; a popular key expires and 10,000 concurrent requests all miss and recompute it (stampede); a race between invalidation and a concurrent read repopulates the cache with stale data that then lives for the full TTL; a single viral key saturates one cache node's network while others idle; write-back caching loses acknowledged writes when a node dies.`,
  how: `Design caching as a system with explicit staleness and failure behaviour.

- **Cache-aside (default).** Read: get from cache; on miss, read DB, set with TTL. Write: update DB, then **delete** the cache key (not set it), so the next reader repopulates from the source of truth. Deleting avoids races where two writers set values out of order, though a read-before-delete race can still write back stale data; short TTLs bound that window, and versioned values or lease tokens close it.
- **Write-through** keeps cache and DB in sync on write at the cost of write latency and caching data that may never be read. **Write-back** gives fast writes and write coalescing but risks loss of acknowledged writes; use only when loss is acceptable or the cache is itself durable and replicated.
- **TTLs and invalidation.** TTL is the safety net bounding staleness; explicit invalidation (on write, or via **CDC** from the database log) keeps hot data fresh. Choose TTL per data type by how stale is acceptable and how expensive a miss is.
- **Stampede / thundering herd mitigation.**
  - **Request coalescing** (single-flight): only one request per key recomputes on a miss; others wait for its result. In a distributed setting, take a short lock/lease in the cache.
  - **Jittered TTLs**: TTL = base ± random (e.g. 10–20%) so keys populated together do not expire together.
  - **Stale-while-revalidate / early refresh**: serve the stale value while one worker refreshes; probabilistic early expiration refreshes hot keys slightly before TTL.
  - **Cold-start protection**: warm caches before shifting traffic, ramp traffic gradually, and rate-limit database access on misses so a cold cache degrades latency instead of taking the database down.
- **Hot keys.** Detect via per-key metrics or sampling. Mitigate with an in-process L1 cache for the hottest keys (short TTL), replicate the key across nodes with suffixes (\`key#1..N\`, read a random one), or read from replicas.
- **Sizing and eviction.** Working set must fit in memory; LRU/LFU eviction under pressure; monitor hit ratio, evictions, memory fragmentation and latency. Avoid huge values and unbounded collections that block single-threaded engines.
- **Failure behaviour.** Timeouts on cache calls shorter than the DB path, circuit-break to the database with load shedding if the cache is down, and never make the cache the only copy of data you cannot lose (unless intentionally using a durable store).`,
  components: [
    { name: 'In-process cache (L1)', description: 'Fastest, no network, but per-instance copies diverge and memory is limited. Ideal for small, hot, rarely-changing data with short TTLs.' },
    { name: 'Distributed cache (L2)', description: 'Shared across instances, sharded by key (client-side consistent hashing or cluster mode), optional replicas for availability. The main database shield.' },
    { name: 'CDN / edge cache', description: 'HTTP response caching near users with Cache-Control, request collapsing and stale-while-revalidate. Best for public or cacheable-per-segment responses.' },
    { name: 'Invalidation pipeline', description: 'Delete-on-write in the app or CDC-driven invalidation from the database log; TTL as a backstop for missed events.' },
    { name: 'Stampede controls', description: 'Single-flight coalescing, distributed leases, jittered TTLs, early refresh and serve-stale policies.' },
    { name: 'Cache observability', description: 'Hit ratio per key prefix, eviction rate, memory, p99 latency, hot-key detection and the database read rate as the true measure of cache effectiveness.' },
  ],
  misconceptions: [
    { myth: 'On write, update the cache with the new value.', reality: 'Concurrent writers can set values in a different order than they committed to the database, leaving the cache permanently stale until TTL. Deleting the key on write and letting the next read repopulate is safer.' },
    { myth: 'A cache is optional infrastructure; if it fails we just go to the database.', reality: 'Once the database is sized for the cache’s hit ratio, losing the cache multiplies database load by 1 / (1 − hit ratio). The cache is a capacity dependency; plan for its failure with warming, rate limits and degraded modes.' },
    { myth: 'Short TTLs solve consistency.', reality: 'They bound staleness but increase miss rate and stampede frequency. Combine moderate TTLs with explicit invalidation and coalescing.' },
    { myth: 'Higher hit ratio is always better.', reality: 'Past a point, chasing hit ratio means caching rarely-read data and long TTLs that increase staleness. Optimise for database load and latency SLOs, not the hit ratio alone.' },
  ],
  example: {
    title: 'Cache-aside with coalescing, jitter and serve-stale',
    description: `Read path for a product page cache. Values carry a soft expiry (refresh early) and a hard TTL (evict). A short lease prevents stampedes: one request refreshes while others serve the stale value or wait briefly.`,
    code: `get_product(id):
  v = cache.get("product:" + id)
  if v and now < v.soft_expiry:
      return v.data                          # fresh hit
  if v:                                      # stale but present
      if cache.set_nx("lease:product:" + id, ttl=5s):
          async refresh(id)                  # one refresher only
      return v.data                          # serve stale meanwhile
  # hard miss
  if cache.set_nx("lease:product:" + id, ttl=5s):
      return refresh(id)
  sleep(50ms); retry cache.get (bounded), else read DB with rate limit

refresh(id):
  data = db.read(id)
  base = 300s
  ttl  = base * random(0.9, 1.1)             # jitter
  cache.set("product:" + id,
            {data, soft_expiry: now + ttl * 0.8}, ttl = ttl + 60s)

on_write(id): db.update(...); cache.delete("product:" + id)`,
    language: 'text',
  },
  exercise: {
    prompt: `A service handles 50k reads/s with a 96% cache hit ratio; the database comfortably handles 4k reads/s and falls over at ~8k. A cache node failure (1 of 4 shards) drops the overall hit ratio. (a) Estimate database load during the failure and after a full cache flush. (b) Propose design changes so neither event causes an outage.`,
    solution: `**(a)** Normal DB load = 50k × 0.04 = **2k reads/s**. Losing 1 of 4 shards makes ~25% of keys miss: hit ratio ≈ 0.96 × 0.75 = 0.72 → DB load ≈ 50k × 0.28 = **14k reads/s**, well past the ~8k collapse point. A full flush means **50k reads/s**, 25× normal.

**(b)**
- Replicas per shard with automatic failover so a node loss does not empty a shard; spread shards and replicas across AZs.
- Consistent hashing so a lost node only remaps its own keys.
- Request coalescing so concurrent misses for the same key produce one DB read; with skewed popularity this cuts miss traffic dramatically.
- A database-side concurrency limit or token bucket on the miss path, with load shedding or serve-stale for non-critical reads; latency degrades instead of the DB falling over.
- An in-process L1 for the hottest keys, absorbing a large share of reads even when L2 is cold.
- Warm-up procedure: pre-populate hot keys from a snapshot or recent access log before shifting traffic, and ramp traffic.
- Capacity: decide explicitly whether the DB must survive a single-shard loss (size to ~14k reads/s, or reduce the gap with the controls above).`,
  },
  faq: [
    { q: 'Redis or Memcached?', a: 'Memcached is a simple multithreaded key-value cache. Redis adds data structures, replication, persistence options, Lua scripting and cluster mode; most teams pick Redis-compatible services for flexibility. Note that Redis executes commands on a single main thread, so large values or O(N) commands block other clients.' },
    { q: 'How do I cache data that is personalised?', a: 'Cache shared fragments globally and per-user data under per-user keys with shorter TTLs, or cache per segment (locale, plan). At the CDN, only cache personalised responses if the cache key includes the identity safely; otherwise you risk serving one user’s data to another.' },
    { q: 'How do I keep cache and database consistent?', a: 'You cannot make them perfectly consistent without distributed transactions. Use delete-on-write plus TTL, or CDC-driven invalidation from the database log for reliability, and design reads to tolerate bounded staleness; for strict consistency, read from the source of truth.' },
  ],
  keyTerms: ['cache-aside', 'read-through', 'write-through', 'write-back', 'TTL', 'invalidation', 'cache stampede / thundering herd', 'request coalescing (single-flight)', 'jittered TTL', 'stale-while-revalidate', 'hot key', 'hit ratio'],
  deeper: `Staff-level caching is about **metastable failure**: a system that is stable with a warm cache and stays down after a cold start, because the miss storm overloads the database, slow responses cause timeouts and retries, and the cache never warms because requests fail before filling it. Breaking the loop needs load shedding and admission control on the miss path, not more capacity. **Lease-based caching** (the cache hands a token to the first misser; sets without the current token are rejected) addresses both stampedes and the stale-set race and is the pattern large-scale memcache deployments describe. **Cache keys are an API**: changing a serialisation format or key schema is a migration that needs versioned keys (\`v2:product:123\`) and a warm-up plan. Finally, security: a cache shared across tenants must namespace keys by tenant, and an edge cache that ignores an authorisation header is a data leak.`,
  interview: {
    seniorAnswer: `Default to cache-aside with delete-on-write and a TTL backstop, add CDC-driven invalidation when freshness matters, and state the staleness each endpoint tolerates. Treat the cache as a capacity dependency: quantify database load as total reads × (1 − hit ratio) for normal, shard-loss and cold-cache cases, and design for each with replicas, consistent hashing, request coalescing, jittered TTLs, serve-stale, rate-limited misses and warm-up. Handle hot keys with L1 caching or key replication, and pick write-through or write-back only with explicit durability reasoning.`,
    followUps: [
      { q: 'What is a cache stampede and how do you prevent it?', a: 'Many concurrent requests miss the same key (expiry or cold cache) and all hit the database. Prevent with single-flight/lease coalescing, serving stale while one request refreshes, probabilistic early refresh and jittered TTLs.' },
      { q: 'Why delete instead of update the cache on write?', a: 'Updates from concurrent writers can arrive out of order, caching a value older than the database; delete makes the next read fetch the current value. A residual race remains with concurrent readers, bounded by TTL or closed by leases/versions.' },
      { q: 'One key receives 200k reads/s. What do you do?', a: 'Serve it from an in-process cache on each instance with a short TTL, or replicate it across N cache keys/nodes and read a random copy; consider pushing it to the CDN if it is a public response.' },
      { q: 'When is write-back acceptable?', a: 'When losing recent writes is tolerable (counters, analytics, view counts) or when the cache is replicated and persistent enough to meet the RPO. Never for financial or user-critical writes without durable acknowledgement.' },
    ],
    redFlags: [
      'Treating the cache as optional with no plan for a cold start',
      'Setting the cache on write without considering ordering races',
      'No TTL on cached entries',
      'Ignoring hot keys and stampedes',
      'Caching authenticated responses at the CDN without identity in the key',
    ],
    numbers: [
      'DB read load = total reads × (1 − hit ratio); 99% → 90% hit ratio is 10× more DB reads',
      'In-process ~ns–µs; distributed cache in-AZ ~sub-ms; cross-AZ adds ~1 ms (order of magnitude)',
      'TTL jitter commonly ±10–20%',
      'Losing 1 of N cache shards without replicas removes ~1/N of hits',
    ],
  },
  references: [
    { title: 'Azure Architecture Center: Cloud design patterns (Cache-Aside)', url: 'https://learn.microsoft.com/en-us/azure/architecture/patterns/' },
    { title: 'Google SRE book: Addressing Cascading Failures', url: 'https://sre.google/sre-book/addressing-cascading-failures/' },
    { title: 'The System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' },
  ],
};

export const infraLessons1: InfraLesson[] = [
  netFundamentals,
  netCloud,
  netEdge,
  computeModels,
  computeScaling,
  computePlatform,
  storageTypes,
  dataDatabases,
  dataCaching,
];
