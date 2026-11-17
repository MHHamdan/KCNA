import type { DesignCase } from '../types';

export const designCases2: DesignCase[] = [
  // ---------------------------------------------------------------------------
  // 6. Enterprise landing zone & hybrid network
  // ---------------------------------------------------------------------------
  {
    id: 'sd-hybrid-network',
    title: 'Enterprise landing zone and hybrid network',
    difficulty: 'staff',
    topics: ['net-cloud', 'net-fundamentals', 'sec-identity', 'auto-iac', 'rel-resilience'],
    prompt: `We are a large enterprise moving to the cloud. Today we have two data centers, one in each of two countries, and about 40 cloud accounts — subscriptions or projects, depending on the provider — that teams created on their own over the last two years. Some of them overlap in IP space with each other and with on-prem. Security wants every byte that leaves for the internet to go through inspection, and the application teams want to reach on-prem databases and Active Directory from the cloud without hairpinning through a VPN appliance someone set up in 2021. Design the landing zone and the network: how accounts are organized, how traffic flows between spokes, on-prem and the internet, how you manage IP addresses and how DNS works end to end.`,
    clarifyingQuestions: [
      'How many cloud regions are in scope now and in two years, and do they map to the two data-center countries (data residency)?',
      'What is the current and projected bandwidth between cloud and on-prem — steady state and peak (backups, batch, replication)?',
      'Is east-west traffic between spokes required to be inspected, or only north-south (internet) traffic?',
      'Which existing accounts overlap in CIDR with each other or with on-prem, and can those workloads be re-addressed or must they be NATed?',
      'Who owns DNS today (AD-integrated DNS, a separate appliance), and which namespaces must resolve in both directions?',
      'Are there regulatory constraints (PCI, regulated data) that require separate network segments or dedicated inspection?',
      'What is the tolerance for an outage of the cloud-to-on-prem link — which workloads hard-depend on on-prem (AD, mainframe, databases)?',
      'Is the organization single-cloud, or must the design leave room for a second provider?',
    ],
    requirements: {
      functional: [
        'Account/subscription hierarchy with guardrails: organization-level policies, separate accounts per workload and environment, centrally owned shared-services and network accounts.',
        'Hub-and-spoke (or transit) connectivity: spokes reach shared services, on-prem and each other only where policy allows.',
        'Private, redundant connectivity to both data centers with automatic failover; encrypted VPN as a backup path.',
        'Centralized internet egress through a stateful firewall / inspection layer with logging; centralized ingress for internet-facing apps through WAF and load balancers.',
        'IP address management: a non-overlapping allocation plan for cloud and on-prem, automated allocation for new VPCs, a remediation plan for existing overlaps.',
        'Hybrid DNS: cloud private zones resolvable from on-prem, on-prem zones (including AD) resolvable from the cloud.',
        'Self-service vending of new accounts with network attached, via IaC, in under a day.',
      ],
      nonFunctional: [
        'Connectivity availability of at least 99.99% for the hybrid path (dual circuits, dual locations).',
        'No single inspection appliance or AZ failure takes down egress for the whole estate.',
        'Added latency for inspected paths in the low single-digit milliseconds.',
        'Every network change through code review and pipeline; no console changes in network or security accounts.',
        'Cost visibility per spoke for data-processing and egress charges.',
        'Scales to 200+ accounts and multiple regions without re-architecture.',
      ],
    },
    estimates: `**Accounts and VPCs.** 40 accounts today, plan for 200. Typical shape: one VPC/VNet per account per region; two regions → 80 VPCs today, ~400 at target.

**Address space.** Default spoke size /20 (4,096 addresses), large spokes /19. 400 × /20 ≈ 1.6M addresses ≈ a /11. Reserve a contiguous /10 for cloud (4.2M addresses), carved into one /12 per region (1M each, room for four regions) so each region can be summarized as one route toward on-prem.

**Kubernetes pressure.** A cluster with 300 nodes × 30 pods = 9,000 pod IPs. If pods take VPC-routable IPs, one cluster eats more than two /20s. Put pods in a non-routable secondary range (for example the shared address space 100.64.0.0/10 from RFC 6598, reused per VPC and source-NATed at the node) or use an overlay CNI, so the routable plan only carries nodes and load balancers. Confirm the range is not already used on-prem or by a carrier-grade NAT in the path.

**Hybrid bandwidth.** Steady 2 Gbps, peaks 8 Gbps during nightly backup/replication. Two 10 Gbps dedicated circuits per data center at diverse provider locations: normally 8 Gbps spread over four circuits is ~20% each; even with a whole DC's circuits down, the other site's 2 × 10 Gbps carries the 8 Gbps peak at ~40%. Rule of thumb: size so that N-1 (here, a full site) carries peak, and keep surviving circuits under ~70% at peak so failover does not congest.

**Egress.** 3 Gbps internet egress peak, ~1 Gbps average: 1 Gb/s × 86,400 s ≈ 86 Tb ≈ 11 TB/day ≈ 320 TB/month. Central NAT and firewall endpoints each charge per GB processed (order of cents per GB), so at ~320 TB/month NAT plus firewall processing alone is tens of thousands of dollars a month — a material line item, which is why private endpoints for provider services (object storage, queues, registries) are part of the design, not an afterthought.

**Latency.** Inspection adds ~1 ms (order of magnitude) per traversal; cross-region hub hops add the region RTT (tens of ms). DC to nearest cloud region over dedicated interconnect: typically 2–10 ms depending on metro distance.`,
    architecture: `**1. Organization and guardrails.** A root organization (AWS Organizations / Azure management groups / Google Cloud folders) with OUs: Security (log archive, security tooling), Infrastructure (network hub, shared services, DNS), Workloads/Prod, Workloads/NonProd, Sandbox. Org-level policies (SCPs / Azure Policy / Org Policy) deny creating internet gateways, public IPs and peering outside the network account, deny disabling logging, and restrict regions.

**2. Network account and hubs.** One hub per region in a dedicated network account: a transit router (AWS Transit Gateway / Azure Virtual WAN hub or hub VNet / Google Cloud Network Connectivity Center or Shared VPC host project). Spokes attach to the hub; no spoke-to-spoke peering. Route tables on the hub implement segmentation: prod, nonprod, shared-services and on-prem route domains. Prod and nonprod cannot route to each other; both reach shared services and on-prem.

**3. Inspection.** An inspection VPC per region with a horizontally scaled firewall tier behind a gateway-style load balancer (or the provider's managed firewall) spread across three AZs. Hub routing sends 0.0.0.0/0 and inter-domain traffic through it. Flow symmetry is preserved by keeping both directions of a flow in the same AZ (appliance mode or equivalent) so the stateful firewall sees both halves.

**4. Egress and ingress.** Egress: spokes have no NAT or internet gateway; default route → hub → inspection → central NAT → internet. Ingress: internet-facing apps sit behind a regional WAF + L7 load balancer in an ingress VPC (or per-app in their own spoke, with WAF mandatory via policy), forwarding to private targets.

**5. Hybrid connectivity.** Each DC has two dedicated circuits to two different provider edge locations (AWS Direct Connect / Azure ExpressRoute / Google Cloud Interconnect), terminated on a gateway attached to every regional hub. BGP with summarized prefixes: on-prem advertises its aggregates; cloud advertises one /12 per region. IPsec VPN over the internet as the third path with higher BGP cost (longer AS path / lower local preference). BFD for sub-second failure detection.

**6. IPAM.** A single source of truth (provider IPAM or an IPAM tool) owns 10.0.0.0/8 allocation: on-prem keeps its existing blocks, cloud gets a /10, per-region /12, per-environment pools. The account-vending pipeline requests a CIDR from IPAM; nobody types a CIDR by hand.

**7. DNS.** Cloud private zones per domain (for example aws.corp.example or app.cloud.example) associated with spokes centrally. Resolver endpoints in the shared-services VPC: inbound endpoints that on-prem DNS conditionally forwards to; outbound rules that forward corp.example and the AD domains to on-prem DNS servers in both DCs. Provider-service private endpoints get private zones so service names resolve to private IPs.

**8. Vending and IaC.** Account vending (Control Tower-style / Azure landing zone accelerators / Google Cloud project factory or equivalent Terraform modules) creates the account, baseline logging and IAM, the VPC from an IPAM allocation, the hub attachment into the right route domain and the DNS associations.

\`\`\`
              on-prem DC-A           on-prem DC-B
            [AD, DNS, DBs]          [AD, DNS, DBs]
             |  2x circuits           |  2x circuits   (+ IPsec backup)
             v                        v
   +-------- interconnect gateway (BGP, summarized) --------+
   |                                                         |
 [Hub region 1]  <---- inter-region peering ---->   [Hub region 2]
   |   route domains: prod | nonprod | shared | onprem
   |-- inspection VPC (FW tier x3 AZ) -- NAT -- internet
   |-- shared services (resolver endpoints, AD connectors, CI)
   |-- ingress VPC (WAF + L7 LB)
   |-- spoke: prod-app-1   spoke: prod-app-2   spoke: nonprod-...
\`\`\``,
    deepDives: [
      {
        title: 'IP address management and fixing the existing overlaps',
        body: `The plan matters more than the tool. Reserve contiguous, summarizable blocks: one /10 for cloud, one /12 per region, pools per environment. Summarization keeps the BGP table small (providers and on-prem routers cap accepted prefixes per session) and makes firewall rules readable.

For the existing overlapping accounts there are three options, in order of preference:
- **Re-address**: rebuild the VPC in a new CIDR via IaC and migrate workloads. Cheapest long term; feasible for stateless apps and anything already deployed by pipeline.
- **Isolate**: leave the overlapping VPC unattached to the hub and expose only specific services through private endpoint services (provider-level private link), which do not require routable, non-overlapping CIDRs.
- **NAT**: a private NAT in front of the overlapping range. Works, but breaks source-IP visibility and makes troubleshooting painful; use only as a time-boxed bridge.

Pods and other high-density address consumers go into non-routable ranges reused per VPC. A senior answer also names the governance hook: an org policy that blocks VPC creation outside the vending pipeline, so overlaps cannot reappear.`,
      },
      {
        title: 'Centralized inspection without making it a single point of failure',
        body: `Centralized egress gives one place for allow-listing, TLS inspection decisions, logging and threat intel, and avoids paying for NAT plus firewall in 400 VPCs. The risks are blast radius, throughput and asymmetry.

- **Scale out, not up**: a firewall fleet behind a gateway load balancer with per-AZ instances and autoscaling, or the provider's managed firewall. Health checks must test the data path, not just the management plane.
- **AZ affinity and symmetry**: traffic enters and leaves inspection in the same AZ; otherwise a stateful firewall drops return traffic. Cross-AZ also costs money.
- **Fail-open vs fail-closed**: for internet egress, fail closed (security requirement) but with enough N+1 capacity that a single-AZ failure does not trigger it. For east-west inspection, decide per route domain; many orgs inspect only prod ↔ nonprod and on-prem ↔ cloud, not every spoke-to-spoke flow, to limit cost and latency.
- **Bypass for bulk provider traffic**: object storage and registry traffic goes through private endpoints (gateway or interface endpoints / Private Link / Private Service Connect), not through the firewall, which saves both throughput and per-GB processing charges.`,
      },
      {
        title: 'Hybrid connectivity: redundancy, BGP and failover behavior',
        body: `"Two circuits" is not redundancy if both land in the same provider facility, share a conduit or terminate on the same on-prem router. Target: two DCs × two circuits × two distinct provider locations, each pair on separate customer routers. That is the shape providers recommend for their highest-resilience tier.

BGP policy decides which path wins. Use local preference (outbound from on-prem) and AS-path prepending or MED (inbound) to make each DC primary for its nearest region and secondary for the other. The VPN path is advertised with a worse metric so it is only used when all dedicated paths are down — and it is sized honestly (a few Gbps of IPsec, not 10), with a documented list of which flows get shed.

Failure detection: BGP hold timers default to 90 s or more (vendor-dependent), so a silently failed path can blackhole traffic for minutes; BFD brings detection to sub-second. Test failover quarterly by actually draining a circuit, and watch for the classic problem: the backup path works but a firewall rule or MTU (IPsec overhead reduces effective MTU, so enable MSS clamping) breaks large transfers.`,
      },
      {
        title: 'Hybrid DNS end to end',
        body: `Two directions, one rule: each namespace has exactly one authoritative home.
- **Cloud → on-prem**: outbound resolver endpoints with forwarding rules for corp.example and the AD forest domains, targeting DNS servers in both DCs. Rules are shared to all spokes from the network account.
- **On-prem → cloud**: on-prem DNS conditionally forwards the cloud zones to inbound resolver endpoint IPs (Route 53 Resolver endpoints / Azure DNS Private Resolver / Cloud DNS inbound server policy). Endpoints sit in at least two AZs.
- **Private endpoints**: provider service names must resolve to private IPs from both cloud and on-prem, otherwise on-prem clients use the public path. That means private zones for those service names plus forwarding from on-prem.

Pitfalls: forwarding loops (on-prem forwards to cloud, which forwards back), split-horizon confusion when the same name has public and private answers, resolver endpoint query-rate limits during a cache-cold event, and TTLs that make failover slow. Monitor resolution latency and SERVFAIL rate as SLIs.`,
      },
    ],
    tradeoffs: [
      {
        decision: 'Centralized vs distributed egress',
        options: 'Central inspection + NAT in the hub vs per-VPC NAT and firewall',
        choice: `Centralized for the estate, because it gives one policy and log point and avoids hundreds of NAT/firewall stacks. Accept the per-GB processing charge and an extra hop; mitigate with private endpoints for high-volume provider traffic. Allow a documented exception (local egress) for very high-throughput, low-risk workloads such as public dataset ingestion.`,
      },
      {
        decision: 'Transit hub vs mesh peering',
        options: 'Hub router with route tables vs direct VPC-to-VPC peering',
        choice: `Hub. Peering is non-transitive and grows as N² relationships; at 400 VPCs it is unmanageable and cannot enforce segmentation centrally. Keep direct peering only for a few latency- or bandwidth-critical pairs where the hub's per-GB charge or added hop is measurable.`,
      },
      {
        decision: 'Inspect east-west traffic or not',
        options: 'All spoke-to-spoke through firewall vs segmentation by route domain plus security groups',
        choice: `Route-domain segmentation plus identity-aware security groups for most east-west; firewall inspection only across trust boundaries (prod ↔ nonprod is blocked, cloud ↔ on-prem inspected, regulated zones inspected). Full east-west inspection doubles firewall throughput and cost for little additional risk reduction.`,
      },
      {
        decision: 'One hub per region vs one global hub',
        options: 'Regional hubs interconnected vs a single hub that all regions route through',
        choice: `Regional hubs. A single global hub adds cross-region latency and cost to local traffic and makes one region a dependency for all. Regional hubs keep failure domains regional and are peered for inter-region traffic.`,
      },
      {
        decision: 'Re-address overlapping VPCs vs NAT them',
        options: 'Rebuild in new CIDRs vs private NAT / private link exposure',
        choice: `Re-address wherever deployment is automated; private-link exposure for the few that cannot move; NAT only as a time-boxed bridge with an owner and a deadline.`,
      },
    ],
    failureModes: [
      {
        failure: 'Single circuit or provider location failure',
        mitigation: `Dual circuits at diverse locations per DC, BGP with BFD for sub-second failover, N-1 sizing so the survivor carries peak, VPN as a last-resort path with a pre-agreed traffic-shedding list.`,
      },
      {
        failure: 'Firewall fleet degraded in one AZ, or a bad rule push',
        mitigation: `Per-AZ instances with data-path health checks so the load balancer removes bad nodes; rule changes through a pipeline with staged rollout (one AZ or one region first) and automated synthetic probes; a pre-approved rollback of the last policy version.`,
      },
      {
        failure: 'Asymmetric routing drops return traffic through the stateful firewall',
        mitigation: `Enable AZ/flow-symmetric mode on the hub attachment for the inspection VPC; keep routes deterministic; include asymmetric scenarios in network tests after every route change.`,
      },
      {
        failure: 'BGP route leak or prefix-limit breach (someone advertises a /24 per subnet)',
        mitigation: `Only aggregates advertised by policy, prefix filters on both sides, maximum-prefix alarms well below the provider limit, and route-table changes reviewed as code.`,
      },
      {
        failure: 'DNS resolution failure for on-prem names (resolver endpoints overloaded, DC DNS down)',
        mitigation: `Forwarding rules target DNS servers in both DCs; endpoints in multiple AZs with capacity headroom; monitor SERVFAIL and latency; critical apps cache and tolerate short resolver outages.`,
      },
      {
        failure: 'Hidden hard dependency on on-prem (AD authentication, licence servers) takes down cloud apps during a hybrid outage',
        mitigation: `Place AD domain controllers (or a managed directory with trust) in the cloud shared-services account; inventory and test on-prem dependencies with a planned link-down game day.`,
      },
    ],
    followUps: [
      {
        q: 'An application team says the hub adds latency and cost and wants direct internet egress. How do you respond?',
        a: `Measure first: the inspection hop is typically about a millisecond and the cost is per GB. If their traffic is mostly to provider services, private endpoints remove it from the firewall path entirely. If they still have a real case (high-volume, low-risk egress), grant a documented exception with local egress through a provider-managed firewall in their VPC, policy-enforced logging, and a review date. Exceptions are a product of the platform, not a fight.`,
      },
      {
        q: 'How do you migrate the 40 existing accounts into this landing zone without breaking them?',
        a: `Inventory CIDRs, internet paths and dependencies. Move accounts into the new OU structure with guardrails in audit-only mode first, fix violations, then enforce. Attach non-overlapping VPCs to the hub and shift their default route to central egress one account at a time, with flow logs compared before and after. Overlapping ones get re-addressed or private-link exposure. Remove legacy VPNs and NAT only after traffic on them is zero for a defined period.`,
      },
      {
        q: 'How would you add a second cloud provider?',
        a: `Keep IPAM global (the second cloud gets its own /10), connect both clouds through on-prem or a colocation interconnect fabric rather than over the internet, keep DNS authority per namespace with conditional forwarding, and express guardrails in a tool-neutral way where possible (Terraform modules, OPA policies). Avoid stretching one application across providers unless there is a concrete reason.`,
      },
      {
        q: 'What do you log and how do you troubleshoot "I cannot reach the database on-prem"?',
        a: `VPC flow logs, hub/route-table changes, firewall allow/deny logs, resolver query logs, and BGP session state. Troubleshoot in layers: DNS resolves to the right IP? Route exists in spoke, hub and on-prem? Security group and firewall allow it? MTU/MSS on the path (VPN fallback)? A provider reachability analyzer saves time, but the senior move is having synthetic probes from each route domain to key on-prem endpoints, so you know before the ticket.`,
      },
      {
        q: 'How do you keep network changes safe when 200 teams depend on the hub?',
        a: `Everything as code with separate state per hub and per region to limit blast radius; plan output reviewed by the network team; policy-as-code checks (no 0.0.0.0/0 to on-prem, no new peering); changes rolled out region by region with synthetic connectivity tests as a gate; change freeze windows for the hub during major business events.`,
      },
    ],
    rubric: [
      {
        area: 'Landing zone structure and guardrails',
        signals: [
          'Separates security, network, shared services and workload accounts with an OU hierarchy',
          'Uses org-level preventive policies (deny IGW/public IP outside network account, region restriction)',
          'Includes account vending through IaC with network attached automatically',
        ],
      },
      {
        area: 'Topology and segmentation',
        signals: [
          'Chooses hub-and-spoke/transit and explains why mesh peering fails at scale',
          'Implements segmentation with route domains, not only firewalls',
          'Keeps hubs regional and limits blast radius per region',
        ],
      },
      {
        area: 'IP address management',
        signals: [
          'Produces a summarizable plan with concrete sizes (/10, /12, /20) and growth math',
          'Handles Kubernetes pod address consumption explicitly',
          'Offers ordered remediation for overlaps (re-address, private link, NAT as bridge)',
        ],
      },
      {
        area: 'Hybrid connectivity and DNS',
        signals: [
          'Designs real diversity (locations, routers) and N-1 capacity, with VPN as backup',
          'Explains BGP path preference and failure detection (BFD)',
          'Describes bidirectional DNS with resolver endpoints and private-endpoint name resolution',
        ],
      },
      {
        area: 'Inspection and egress',
        signals: [
          'Scales the firewall tier horizontally across AZs and addresses flow symmetry',
          'Uses private endpoints to bypass inspection for provider services and reduce cost',
          'States fail-open/fail-closed decisions per path',
        ],
      },
      {
        area: 'Operability and cost',
        signals: [
          'Names per-GB processing and cross-AZ charges as design inputs',
          'Defines synthetic probes, flow logs and staged network rollouts',
          'Plans failover game days and dependency inventory',
        ],
      },
    ],
    references: [
      { title: 'Amazon VPC User Guide', url: 'https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html' },
      { title: 'RFC 1918: Address Allocation for Private Internets', url: 'https://www.rfc-editor.org/rfc/rfc1918' },
      { title: 'RFC 1034: Domain Names - Concepts and Facilities', url: 'https://www.rfc-editor.org/rfc/rfc1034' },
      { title: 'Azure Well-Architected Framework', url: 'https://learn.microsoft.com/en-us/azure/well-architected/' },
    ],
  },

  // ---------------------------------------------------------------------------
  // 7. Global static & video delivery
  // ---------------------------------------------------------------------------
  {
    id: 'sd-cdn-media',
    title: 'Global static and video delivery',
    difficulty: 'senior',
    topics: ['net-edge', 'data-caching', 'storage-types', 'sec-data', 'arch-finops'],
    prompt: `We run a video platform: on-demand video plus a web and mobile app, users on every continent. Today everything is served from object storage in one region through a single CDN, and two things hurt — the egress bill and the fact that when a popular video drops, our origin falls over. Premium videos must only be playable by paying users. Design the delivery path for static assets and video: caching at the edge, protecting the origin, invalidating content, securing access, and keeping cost under control.`,
    clarifyingQuestions: [
      'On-demand only, or live streaming too? Live changes manifest TTLs and origin design significantly.',
      'What are views per day, average watch time and average bitrate, and how peaky is traffic (release events)?',
      'How large is the catalog and how skewed is popularity — what fraction of bytes comes from the top 1% of titles?',
      'What protection is required for premium content: signed URLs only, or studio-grade DRM?',
      'Are there geographic licensing restrictions (geo-blocking) or data residency rules?',
      'What are the targets for startup time and rebuffering, and which clients (browsers, smart TVs) must be supported?',
      'Is there an existing CDN contract with committed spend, and is multi-CDN acceptable?',
      'How often do static assets and video metadata change, and who triggers invalidations?',
    ],
    requirements: {
      functional: [
        'Serve web/app static assets and adaptive-bitrate video (HLS/DASH, ideally CMAF segments) globally.',
        'Origin shielding so a cache miss storm becomes a small number of origin fetches.',
        'Cache invalidation for static assets and metadata; immutable, versioned video segments.',
        'Access control: signed URLs or signed cookies with expiry for premium content; DRM for high-value titles; geo-restriction.',
        'Upload/transcode pipeline writes renditions to origin storage (in scope only as the source of objects).',
        'Per-title and per-region delivery analytics: hit ratio, egress, errors, startup time.',
      ],
      nonFunctional: [
        'Video start time p95 under 2 s; rebuffer ratio under 1% of watch time.',
        'Edge cache hit ratio ≥ 95% by bytes for video, origin offload ≥ 98% with shielding.',
        'Origin survives a release of a top title (10× normal request rate on one object set) without degradation.',
        'Availability of delivery ≥ 99.95%, tolerant of a single CDN PoP or provider-region outage.',
        'Delivery cost per GB tracked and reduced ≥ 30% from current.',
      ],
    },
    estimates: `**Traffic.** 5M views/day × 10 min average watch × 3 Mbps average bitrate. Per view: 600 s × 3 Mb/s = 1,800 Mb = 225 MB. Daily: 5M × 225 MB ≈ 1.1 PB/day, ≈ 34 PB/month.

**Throughput.** 1.1 PB/day ÷ 86,400 s ≈ 13 GB/s ≈ 104 Gbps average; peak-to-average ~3× → ~300 Gbps at peak. A release event can add a spike on top.

**Requests.** 6 s segments → 100 segment requests per 10-minute view, plus manifests: ~5M × 110 ≈ 550M video requests/day (~6.4k RPS average, ~20k peak). Static assets: say 2B requests/day (~23k RPS average), mostly small and highly cacheable.

**Origin load.** At 95% edge byte hit ratio, edges fetch 5% = 1.7 PB/month from the next tier. With a shield tier at 70–80% hit ratio on those misses, origin egress is ~0.35–0.5 PB/month — roughly 1–1.5% of delivered bytes.

**Cost (illustrative).** CDN egress at negotiated volume rates is often around a cent or two per GB (list prices are higher and vary by geography). 34M GB × $0.01–0.02 ≈ $340k–680k/month. Origin egress from object storage to the CDN is often discounted or free on the same provider but billed when crossing providers. A 1-point improvement in edge byte hit ratio at this scale removes ~340 TB/month of edge-miss fetches to the shield (and a fraction of that from origin). The biggest lever on total bytes, though, is encoding: a more efficient codec or per-title encoding that cuts average bitrate 20% cuts egress 20%.

**Storage.** Catalog 200k titles × ~6 renditions × ~1.5 GB average per title across renditions ≈ 300 TB; long-tail titles move to an infrequent-access storage class.`,
    architecture: `**1. Origin.** Object storage bucket(s) holding renditions and static builds, private (only the CDN/shield can read: origin access identity/control, or signed origin requests). A small origin service generates manifests if they are personalized (ad insertion, entitlement-filtered renditions); otherwise manifests are static objects.

**2. Shield tier.** One or two shield PoPs/regions close to origin (the CDN's origin shield / tiered cache feature, or your own caching proxy fleet). All edge misses go to the shield, which collapses concurrent misses for the same object into a single origin fetch (request coalescing).

**3. Edge.** Global CDN PoPs with anycast or DNS-based routing. Cache key = path + selected query params (rendition, never the auth token). Segments: long TTL (days to a year) because they are immutable and versioned. Manifests: shorter TTL for VOD (minutes) and seconds for live. Static assets: content-hashed filenames with a one-year TTL and immutable caching; HTML entry points with a short TTL.

**4. Access control.** Entitlement service issues a signed cookie or signed URL scoped to a path prefix (the title's directory) with a short expiry (for example 1–4 hours, longer than the title). Edge validates the signature without calling the origin. DRM (Widevine, FairPlay, PlayReady) for premium titles: segments are encrypted, the license server enforces entitlements.

**5. Multi-CDN and steering (at this scale).** Two CDNs behind a steering layer (DNS-based or client-side, using real-user measurements of throughput and errors). Gives resilience and pricing leverage.

**6. Observability.** CDN logs streamed to an analytics store; client-side player telemetry (startup time, rebuffering, bitrate) as the real SLIs.

\`\`\`
 player ──> steering (DNS / client) ──> CDN A edge ─┐
                                    └──> CDN B edge ─┤  (miss)
                                                     v
                                        shield tier (coalescing)
                                                     │ (miss)
                                                     v
               entitlement svc ── signs ──>  origin: object storage
               license server (DRM)              + manifest service
\`\`\``,
    deepDives: [
      {
        title: 'Origin shielding and the release-day thundering herd',
        body: `Without a shield, each of hundreds of PoPs misses independently on a new title: 300 PoPs × 6 renditions × first segments = thousands of near-simultaneous origin requests, repeated for every segment as viewers progress. The shield turns that into one fetch per object per shield location.

Make it robust:
- **Request coalescing** (collapsed forwarding) at the shield so 500 concurrent misses for one segment produce one origin fetch.
- **Pre-warm** the first N minutes of segments of a scheduled release through the shield before publication.
- **Stale-while-revalidate / stale-if-error** for manifests and static assets so an origin hiccup serves slightly stale content instead of errors.
- **Origin protection**: rate-limit and concurrency-limit requests at the origin layer, and return a fast 503 (which the shield can absorb with stale content) rather than queueing until timeouts cascade.

Choose the shield location near the origin to minimise shield→origin latency and cost; with origins in two regions, use one shield per origin.`,
      },
      {
        title: 'Cache keys, TTLs and invalidation',
        body: `The fastest invalidation is never needing one. Segments and static assets are immutable and content-addressed (hash or version in the path), so publishing a new version is a new URL and the old one ages out.

Purges are for mistakes and for mutable objects (manifests, HTML, metadata JSON). Practical rules:
- **Surrogate keys / cache tags** where the CDN supports them, so you purge "everything for title 123" without enumerating URLs.
- **Purge is eventually consistent** across PoPs (seconds to minutes); for legal takedowns, also revoke at the authorisation layer (stop issuing tokens, block the path at the edge) because a purge alone does not stop a holder of a valid token from refetching the object from origin.
- **Cache-key hygiene**: strip tracking and auth query params from the cache key; a token in the key yields a 0% hit ratio. Normalize case and parameter order.
- **Vary carefully**: varying on full User-Agent fragments the cache; vary on a small set of device classes computed at the edge if you must.`,
      },
      {
        title: 'Signed URLs vs signed cookies vs DRM',
        body: `A video is a manifest plus hundreds of segments, so signing every segment URL forces the manifest to be personalised and uncacheable. **Signed cookies** (or a token in a path prefix) scoped to the title directory let the manifest and segments stay cacheable while the edge validates the signature on every request.

Design points:
- Short expiry plus prefix scope limits link sharing; binding to IP breaks mobile users switching networks, so use it sparingly.
- Keys: asymmetric or HMAC keys with rotation; publish two active keys during rotation so in-flight tokens stay valid.
- Signed URLs/cookies are **access control, not content protection**: a paying user can still download segments. Studio content needs DRM (encrypted CMAF with multi-DRM licensing), with the license server as the entitlement check. DRM adds a license round trip to start-up; cache licenses on the device where allowed.`,
      },
      {
        title: 'Cost of egress and how to reduce it',
        body: `Delivery cost ≈ bytes delivered × blended CDN rate + origin egress + requests. The levers, by usual impact:
- **Fewer bytes**: per-title encoding and more efficient codecs (HEVC/AV1 where devices support it) reduce average bitrate; capping the top rendition on small screens. Often the largest single saving.
- **Better rate**: committed-volume contracts, multi-CDN to create price competition, routing traffic in expensive geographies to the cheapest adequate CDN.
- **Higher hit ratio**: shield tier, cache-key cleanup, longer TTLs on immutable objects, larger edge cache footprint for the long tail.
- **Cheaper origin path**: keep origin and shield on the same provider to avoid inter-cloud egress, and use the provider's discounted CDN-origin pricing.
- **Embedded caches / ISP peering** at very large scale (appliances inside ISPs) — a later-stage optimisation that only pays off at hundreds of Gbps sustained.

Track cost per hour watched as the unit metric, by region and by CDN.`,
      },
    ],
    tradeoffs: [
      {
        decision: 'Single CDN vs multi-CDN',
        options: 'One provider with deep integration vs two or more with a steering layer',
        choice: `Multi-CDN at ~300 Gbps peak: resilience against a provider outage and pricing leverage outweigh the cost of maintaining two configs, two log formats and token schemes. Keep config in code and use the lowest common denominator of features (or an abstraction) so steering can move traffic freely.`,
      },
      {
        decision: 'Segment length',
        options: '2 s vs 6 s vs 10 s segments',
        choice: `About 4–6 s for VOD: fewer requests and better cache efficiency than 2 s, faster bitrate adaptation and start-up than 10 s. Live low-latency needs shorter segments or partial segments, accepting more requests.`,
      },
      {
        decision: 'Purge-based vs versioned invalidation',
        options: 'Stable URLs with purges vs content-addressed URLs',
        choice: `Versioned URLs for everything immutable (segments, JS/CSS, images); purges only for a small set of mutable entry points (manifests, HTML) with short TTLs. Purges are slow, rate-limited and eventually consistent.`,
      },
      {
        decision: 'Signed cookies vs per-segment signed URLs',
        options: 'Prefix-scoped cookie/token vs each URL signed individually',
        choice: `Prefix-scoped signed cookies or path tokens, keeping manifests cacheable. Per-URL signing only where cookies are not supported by the client, and then the manifest is generated per session by a small, scaled manifest service.`,
      },
      {
        decision: 'Managed shield vs self-run caching tier',
        options: 'CDN tiered cache feature vs own proxy fleet near origin',
        choice: `Managed shield first; it is cheap and operationally simple. A self-run tier makes sense with multi-CDN (one shared shield for both CDNs, so one origin fetch serves both) or when origin is on-prem.`,
      },
    ],
    failureModes: [
      {
        failure: 'Release-day stampede overloads origin',
        mitigation: `Shield with request coalescing, pre-warming, origin concurrency limits returning fast 503s, and stale-if-error so the edge keeps serving.`,
      },
      {
        failure: 'Cache-key mistake (token or tracking param in key) drops hit ratio to near zero',
        mitigation: `Cache-key config in code with tests; alert on byte hit ratio per CDN dropping by more than a few points; canary config changes to a fraction of PoPs or traffic first.`,
      },
      {
        failure: 'CDN provider outage or regional degradation',
        mitigation: `Multi-CDN steering driven by real-user metrics and synthetic probes; DNS TTLs short enough (seconds to a minute) to shift traffic; capacity commitments sized so either CDN can carry most of the load.`,
      },
      {
        failure: 'Signing key leak or broken key rotation',
        mitigation: `Keys in a secrets manager/KMS, two-key overlap during rotation, ability to revoke a key at the edge within minutes, short token expiry to bound exposure.`,
      },
      {
        failure: 'Bad purge (wildcard) wipes the cache and stampedes the origin',
        mitigation: `Restrict wildcard purges, require surrogate-key purges, rate-limit purge API usage, and rely on the shield to absorb refills.`,
      },
      {
        failure: 'Origin bucket deleted or corrupted renditions published',
        mitigation: `Versioning and object lock/deletion protection on origin buckets, cross-region replication for the catalog, checksum validation in the publish pipeline, and immutable URLs so a bad version can be replaced by republishing the manifest to the previous version.`,
      },
    ],
    followUps: [
      {
        q: 'How would this change for live streaming of a sports event with 2M concurrent viewers?',
        a: `Manifests refresh every segment, so manifest TTL is about one segment duration or less and request coalescing at the shield becomes critical. Use a packager with redundant encoders in two regions, origin per region, short or partial segments for low latency, and pre-provisioned CDN capacity (tell the CDN in advance). Every viewer requests the same newest segment, so hit ratio is high but the miss window is tiny and simultaneous.`,
      },
      {
        q: 'How do you measure whether the CDN is performing well?',
        a: `Client-side metrics are the truth: start-up time, rebuffer ratio, average delivered bitrate and error rate, segmented by CDN, ISP and country. CDN-side: byte and request hit ratio, origin fetch rate, edge 4xx/5xx, time-to-first-byte. Synthetic probes catch regional problems before users report them.`,
      },
      {
        q: 'A content owner demands a video be removed worldwide within 10 minutes. How?',
        a: `Stop issuing tokens for the title in the entitlement service, add an edge rule that blocks the path prefix (propagates faster and more reliably than purge), purge by surrogate key, and remove or hide it at origin. Verify with probes from multiple regions. Short token expiry bounds the remaining exposure.`,
      },
      {
        q: 'Would you use HTTP/3 to the client?',
        a: `Yes where the CDN supports it: QUIC avoids head-of-line blocking at the transport layer and recovers faster on lossy mobile networks, and connection migration helps devices switching networks. Keep HTTP/2 and HTTP/1.1 fallback because some networks block UDP. Measure start-up and rebuffering by protocol before declaring a win.`,
      },
    ],
    rubric: [
      {
        area: 'Estimation',
        signals: [
          'Derives bytes per view and PB/month from views, watch time and bitrate',
          'Converts to Gbps average and peak, and request rate from segment length',
          'Connects hit ratio to origin load and cost numerically',
        ],
      },
      {
        area: 'Caching design',
        signals: [
          'Uses a shield tier with request coalescing',
          'Distinguishes TTLs for immutable segments, manifests and HTML',
          'Prefers versioned URLs over purges and keeps tokens out of the cache key',
        ],
      },
      {
        area: 'Security',
        signals: [
          'Chooses prefix-scoped signed cookies/tokens to keep manifests cacheable',
          'Distinguishes access control from DRM content protection',
          'Covers key rotation and fast revocation',
        ],
      },
      {
        area: 'Cost',
        signals: [
          'Identifies bitrate/encoding as a top egress lever',
          'Discusses committed rates, multi-CDN leverage and origin egress between providers',
          'Proposes a unit metric such as cost per hour watched',
        ],
      },
      {
        area: 'Resilience and operations',
        signals: [
          'Plans for CDN outage with steering and short DNS TTLs',
          'Protects origin with concurrency limits and stale-if-error',
          'Measures QoE from the client, not just CDN dashboards',
        ],
      },
    ],
    references: [
      { title: 'High Performance Browser Networking', url: 'https://hpbn.co/' },
      { title: 'RFC 9114: HTTP/3', url: 'https://www.rfc-editor.org/rfc/rfc9114' },
      { title: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' },
      { title: 'FinOps Framework', url: 'https://www.finops.org/framework/' },
    ],
  },

  // ---------------------------------------------------------------------------
  // 8. API gateway with distributed rate limiting
  // ---------------------------------------------------------------------------
  {
    id: 'sd-rate-limiter-gateway',
    title: 'API gateway with distributed rate limiting',
    difficulty: 'senior',
    topics: ['dist-patterns', 'dist-theory', 'net-edge', 'data-caching', 'rel-resilience'],
    prompt: `We have a public API used by about 10,000 tenants, from hobby developers to large enterprises. Peak traffic is around 100,000 requests per second across three regions. Each tenant has a plan with quotas — requests per second and requests per day — and some enterprise tenants have custom limits. Last quarter one tenant's runaway script took down a shared backend. Design the API gateway layer, with emphasis on how rate limiting works across many gateway nodes and multiple regions, and what consistency you can realistically promise.`,
    clarifyingQuestions: [
      'Are limits per tenant only, or also per API key, per endpoint and per source IP (for unauthenticated traffic)?',
      'How accurate must enforcement be — is 5–10% over-admission briefly acceptable, or are quotas billing-critical?',
      'Are daily/monthly quotas tied to billing (hard stop or overage charges)?',
      'How is traffic distributed across regions — does a tenant usually hit one region or all three?',
      'What is the latency budget the gateway may add per request (p99)?',
      'Should the system behave fail-open or fail-closed if the rate-limit store is unavailable?',
      'Do we need to protect backends from aggregate overload separately from tenant fairness?',
      'What does the client contract look like — 429 with Retry-After, rate-limit headers, documented burst sizes?',
    ],
    requirements: {
      functional: [
        'Authenticate requests (API key / OAuth token) and resolve tenant and plan.',
        'Enforce per-tenant short-window limits (RPS with burst) and long-window quotas (per day/month), plus per-endpoint and per-IP limits.',
        'Return 429 with Retry-After and rate-limit headers describing limit, remaining and reset.',
        'Allow live updates to tenant limits without redeploying gateways.',
        'Global backend protection: concurrency limits and load shedding independent of tenant quotas.',
        'Usage metering per tenant for billing and analytics.',
      ],
      nonFunctional: [
        '100k RPS peak across three regions, headroom to 2×.',
        'Rate-limit decision adds < 1 ms p50 and < 5 ms p99.',
        'Gateway availability 99.99%; rate-limit store failure must not take the API down.',
        'Short-window limits accurate within ~10% globally; daily quotas accurate within ~1% for billing.',
        'Noisy tenant cannot degrade other tenants (isolation).',
      ],
    },
    estimates: `**Traffic.** 100k RPS peak; roughly 40/35/25k across three regions. With 2× headroom design for 200k RPS.

**Gateway fleet.** A well-tuned proxy (Envoy/NGINX class) handles very roughly several thousand to ~10k+ RPS per vCPU for simple proxying (benchmark your own request mix); with TLS termination, auth and filters assume ~2–5k RPS per vCPU. 200k RPS ÷ 3k ≈ 70 vCPUs in total; the busiest region (40% → 80k RPS at 2×) needs ~27 vCPUs ≈ 4 nodes of 8 vCPU. With N+2, three AZs and nodes kept under ~60% CPU, run ~6–9 nodes per region.

**Rate-limit store.** If every request does one atomic check-and-increment in an in-memory store (Redis-class), that is 100k ops/s, ×2–3 if you check several dimensions (tenant, endpoint, IP). A single in-memory shard handles on the order of 100k simple ops/s; with scripts closer to tens of thousands. The busiest region at 2× headroom is ~80k RPS × 3 dimensions ≈ 240k script ops/s, so 6–10 shards per region with replicas, sharded by tenant ID — if every request went to the store, which is exactly what the local tier below avoids.

**Latency.** Same-AZ round trip ~0.2–0.5 ms, cross-AZ ~1 ms (order of magnitude), cross-region 30–150 ms. A synchronous cross-region check per request is not viable inside a 5 ms budget.

**State size.** 10k tenants × a few dimensions × ~100 bytes ≈ a few MB. Per-IP limits for anonymous traffic can mean millions of keys, still only hundreds of MB with TTLs.

**Hot tenant.** The biggest tenant may send 20k RPS alone; if all its counters live on one shard key, that shard takes 20k+ ops/s — which motivates local aggregation for large tenants.`,
    architecture: `**1. Edge.** Anycast/global load balancer and DDoS/WAF layer in front of three regions; per-IP coarse limits applied here for unauthenticated abuse.

**2. Gateway fleet per region.** Stateless L7 proxies across three AZs: TLS termination, authentication (key lookup cached locally with short TTL), tenant/plan resolution, routing, request size limits, and the rate-limit filter.

**3. Rate limiting in two tiers.**
- **Local tier**: each gateway node keeps in-memory token buckets per tenant. It admits requests locally against a share of the tenant's limit and handles bursts with zero network calls.
- **Regional tier**: a sharded in-memory store (Redis-class, replicated across AZs) holding authoritative counters. Nodes sync with it asynchronously every ~50–100 ms (batch increments, fetch current usage) or synchronously for small tenants where precision matters and load is low. Algorithm: token bucket or GCRA for RPS with burst; sliding-window counter for per-minute; daily quota via counters per tenant per day.

**4. Cross-region.** Each region gets an allocation of each tenant's global limit, rebalanced every few seconds based on observed demand by a quota coordinator. Daily quotas aggregate usage events through a stream to a metering service that is the billing source of truth.

**5. Config.** Tenant limits stored in a database, published to gateways through a config distribution channel (push or polled snapshot) with versioning; gateways keep the last known good config.

**6. Backend protection.** Separate from fairness: adaptive concurrency limits per backend, priority-based load shedding (enterprise and health checks last to shed), circuit breakers, and timeouts with budgets.

**7. Metering and observability.** Every decision emits a counter (allowed/limited by tenant and rule); access logs go to a stream for usage analytics and billing reconciliation.

\`\`\`
client ─> global LB / WAF (per-IP coarse limits)
            ├─ region A ─ gateway nodes [auth | local buckets | route]
            │                 │ async sync every ~100 ms
            │                 v
            │          regional limit store (sharded by tenant)
            │                 ^
            │       quota coordinator (rebalances regional shares)
            ├─ region B ...           │
            └─ region C ...   usage stream ─> metering (daily quota, billing)
                              backends (adaptive concurrency, shedding)
\`\`\``,
    deepDives: [
      {
        title: 'Choosing the algorithm',
        body: `- **Fixed window**: simplest, but allows 2× the limit across a window boundary.
- **Sliding log**: exact, but stores a timestamp per request — too much memory at 100k RPS.
- **Sliding window counter**: weights the previous window's count by overlap; tiny state, error of a few percent. Good for per-minute and per-hour limits.
- **Token bucket**: rate r, capacity b; natural expression of "100 RPS with bursts of 200". State is (tokens, last refill time) — update lazily on each request.
- **GCRA**: equivalent to a token bucket but stores a single timestamp (theoretical arrival time); easy to implement as one atomic compare-and-set.

Choice: token bucket/GCRA for per-second limits with burst, sliding-window counter for longer windows, and a durable usage pipeline for daily/monthly billing quotas. Always perform check-and-decrement atomically (server-side script or single command), never read-then-write from the gateway, or concurrent nodes over-admit.`,
      },
      {
        title: 'Local vs centralized counting: accuracy vs latency',
        body: `A purely centralized check per request is accurate but puts a network round trip and a hot dependency on every request; a purely local limit (limit ÷ node count) is fast but wrong when traffic is unevenly balanced or node count changes.

The hybrid: each node admits against locally cached tokens and periodically (every ~100 ms) reports consumed tokens to the regional store and receives the tenant's remaining global budget, from which it derives its local allowance. Over-admission is bounded by roughly sync interval × admitted rate per node — for a 1,000 RPS tenant spread over 8 nodes and a 100 ms sync, the worst case is around one sync interval's worth (~100 requests) of overshoot, about 10% for a second. Small tenants (a few RPS) can use synchronous checks because their volume is tiny. Large tenants use the local tier, which also removes the hot-shard problem.

This is the honest promise: short-window limits are approximate and protective; billing quotas are exact because they come from the metering pipeline, not from the fast path.`,
      },
      {
        title: 'Multi-region consistency',
        body: `A globally consistent counter would need consensus or a single home region; at 30–150 ms between regions that is incompatible with a 5 ms budget and couples region availability. Options:
- **Static split**: each region gets limit/3. Simple; unfair when a tenant's traffic is concentrated in one region.
- **Home region**: route each tenant's traffic to a home region. Accurate, but loses latency and failover benefits.
- **Dynamic allocation**: a coordinator observes per-region demand and reassigns shares every few seconds (with a floor per region). Close to the global limit; tolerates coordinator failure by freezing the last allocation.
- **CRDT-style counters** (per-region grow-only counters merged asynchronously): good for daily quotas where a few seconds of lag is fine.

Pick dynamic allocation for RPS and asynchronous merged counters for daily quotas. During a region partition, each region enforces its last allocation. If allocations summed to the global limit (per-region floors can push the sum slightly above), the global limit still roughly holds; the real cost is unfairness — a region whose demand grows stays throttled at its stale share while another region's share sits unused.`,
      },
      {
        title: 'Failure behavior of the limiter itself',
        body: `The limiter must never be a bigger outage than the abuse it prevents.
- **Store unavailable**: fall back to local-only buckets at a conservative share (fail-open with a local cap), not to "allow everything" and not to "reject everything". Emit an alert and a metric for degraded mode.
- **Timeouts**: the store call gets a 1–2 ms timeout; on timeout, use the local decision.
- **Config distribution failure**: keep last known good; new tenants get the default plan.
- **Hot keys**: shard by tenant, and use the local tier for large tenants so no single key sees 20k ops/s.
- **Retry storms**: 429s with Retry-After and documented backoff with jitter; clients ignoring them are throttled harder at the edge (per-key penalty).

Separately, tenant quotas do not protect backends from aggregate overload; adaptive concurrency limits and priority load shedding at the gateway do.`,
      },
    ],
    tradeoffs: [
      {
        decision: 'Accuracy vs latency in the fast path',
        options: 'Synchronous central check per request vs local buckets with async sync',
        choice: `Hybrid: synchronous for low-volume tenants, local-with-sync for high-volume ones. Accept bounded short-term over-admission (~10%) in exchange for sub-millisecond decisions and no hard dependency on the store.`,
      },
      {
        decision: 'Fail-open vs fail-closed when the limit store is down',
        options: 'Allow all / deny all / degrade to local limits',
        choice: `Degrade to local limits (a form of fail-open with a cap). Fail-closed turns a cache outage into a full API outage; unconstrained fail-open removes protection exactly when the system is stressed.`,
      },
      {
        decision: 'Global vs per-region limits',
        options: 'Static per-region split vs home region vs dynamic allocation',
        choice: `Dynamic allocation with a per-region floor and last-known-good on coordinator failure. Static split as the initial default for new tenants until demand data exists.`,
      },
      {
        decision: 'Build vs buy the gateway',
        options: 'Managed API gateway service vs self-run proxy fleet (Envoy-based)',
        choice: `At 100k RPS with custom multi-region quota logic, a self-run proxy fleet with a rate-limit service gives control over algorithms, latency and cost; managed gateways price per request, which at 100B+ requests/month (100k RPS sustained would be ~260B) is significant. Use a managed edge (DDoS/WAF) in front either way. Re-evaluate if the team cannot staff on-call for the fleet.`,
      },
      {
        decision: 'Billing quota enforcement source',
        options: 'Fast-path counters vs metering pipeline',
        choice: `Metering pipeline is the billing truth (durable, reconcilable); fast-path counters enforce approximately and are periodically corrected from metering. Never bill from a cache.`,
      },
    ],
    failureModes: [
      {
        failure: 'Rate-limit store shard fails or becomes slow',
        mitigation: `Replicas with automatic failover, 1–2 ms client timeout, fallback to local buckets, and alerts on degraded-mode decisions. Counters lost on failover are acceptable for short windows.`,
      },
      {
        failure: 'Hot tenant overloads a single shard',
        mitigation: `Local aggregation for large tenants so the shard sees batched updates every ~100 ms per node instead of every request; optionally split a tenant's counter across sub-keys and sum.`,
      },
      {
        failure: 'Misconfigured limit (extra zero, or 0) pushed to all gateways',
        mitigation: `Validation and diff review for limit changes, staged rollout of config by region, bounds checks (no change more than N× without approval), and instant rollback to the previous config version.`,
      },
      {
        failure: 'Retry storm from clients after an incident',
        mitigation: `Retry-After headers, documented exponential backoff with jitter in SDKs, server-side retry budgets, and edge penalties for clients ignoring 429s.`,
      },
      {
        failure: 'Aggregate overload below every tenant limit (many tenants spike together)',
        mitigation: `Adaptive concurrency limits per backend, priority-based load shedding at the gateway, and capacity planning against the sum of realistic peaks, not the sum of quotas.`,
      },
      {
        failure: 'Region partition from the coordinator',
        mitigation: `Regions keep enforcing the last allocation; metering reconciles daily quotas after recovery; alert if allocations are stale beyond a threshold.`,
      },
    ],
    followUps: [
      {
        q: 'Why not just divide each tenant limit by the number of gateway nodes?',
        a: `Load balancing is not perfectly even (long-lived HTTP/2 connections pin a tenant to a few nodes), and node counts change with autoscaling and deploys. A tenant with traffic on 3 of 8 nodes would get under 40% of its limit. Local shares must be derived from observed usage, which is what the sync loop provides.`,
      },
      {
        q: 'How do you rate limit by cost rather than by request count?',
        a: `Assign each endpoint a weight (for example a search costs 10 tokens, a read 1) or charge tokens after the fact based on measured work. The bucket algorithm is unchanged; only the decrement varies. Communicate costs in documentation and headers so clients can plan.`,
      },
      {
        q: 'What headers and status codes do you return?',
        a: `429 Too Many Requests with Retry-After (seconds or a date), plus headers for limit, remaining and reset. The IETF HTTPAPI working group has a long-running draft standardising RateLimit / RateLimit-Policy headers; most APIs today use X-RateLimit-* conventions, so document whichever you emit. Return 503 (not 429) when shedding for backend overload, so clients and dashboards can tell "you exceeded your plan" from "we are overloaded".`,
      },
      {
        q: 'How would you test this before launch?',
        a: `Unit tests of algorithms against reference traces; load tests with skewed tenant distributions and node churn to measure over-admission; fault injection on the store (kill shards, add latency) to verify degraded mode; and shadow mode in production where decisions are logged but not enforced, comparing with expected limits before switching to enforcement.`,
      },
    ],
    rubric: [
      {
        area: 'Algorithms',
        signals: [
          'Compares fixed window, sliding window, token bucket/GCRA with their errors and state cost',
          'Insists on atomic check-and-decrement',
          'Separates per-second limits from billing quotas',
        ],
      },
      {
        area: 'Distributed design',
        signals: [
          'Proposes local + central hybrid and quantifies over-admission bounds',
          'Handles hot tenants and sharding by tenant',
          'Explains why synchronous cross-region checks do not fit the latency budget',
        ],
      },
      {
        area: 'Failure handling',
        signals: [
          'Defines degraded mode when the store fails (local caps, timeouts)',
          'Protects against config mistakes with staged rollout and bounds',
          'Addresses retry storms with Retry-After and backoff with jitter',
        ],
      },
      {
        area: 'Capacity and latency',
        signals: [
          'Sizes gateway fleet and store shards from RPS',
          'States latency numbers for intra-AZ, cross-AZ and cross-region',
          'Plans headroom and AZ spread',
        ],
      },
      {
        area: 'Product and API contract',
        signals: [
          'Defines 429 vs 503 semantics and headers',
          'Supports weighted/cost-based limits and live limit changes',
          'Treats metering as the billing source of truth',
        ],
      },
    ],
    references: [
      { title: 'SRE Book: Handling Overload', url: 'https://sre.google/sre-book/handling-overload/' },
      { title: "Amazon Builders' Library: Timeouts, retries and backoff with jitter", url: 'https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/' },
      { title: 'SRE Book: Addressing Cascading Failures', url: 'https://sre.google/sre-book/addressing-cascading-failures/' },
      { title: 'Jepsen: Consistency Models', url: 'https://jepsen.io/consistency' },
    ],
  },

  // ---------------------------------------------------------------------------
  // 9. Data-center to cloud migration with near-zero downtime
  // ---------------------------------------------------------------------------
  {
    id: 'sd-migration',
    title: 'Monolith and 5 TB database migration to the cloud',
    difficulty: 'staff',
    topics: ['arch-frameworks', 'data-databases', 'rel-resilience', 'auto-delivery', 'net-cloud'],
    prompt: `Our core product is a ten-year-old monolith — a Java application on about 30 VMs in our data center — backed by a 5 TB relational database. Most of it is Oracle, and one newer module uses PostgreSQL. The data-center lease ends in nine months. The business will accept at most a few minutes of downtime for the cutover, and we must be able to roll back if things go wrong. Walk me through how you would migrate it: the strategy for each component, how you move the data, how the cutover works and how you roll back.`,
    clarifyingQuestions: [
      'Is moving off Oracle a goal of this migration, or can we keep Oracle (licence-included or bring-your-own) and convert later?',
      'What is the write rate and redo/WAL generation per day, and what are peak hours?',
      'How much PL/SQL, triggers, sequences and Oracle-specific features (packages, CONNECT BY, materialized views) does the app use?',
      'What else talks to this database directly — reports, ETL jobs, other apps, DB links?',
      'What network do we have to the cloud today (internet VPN vs dedicated circuit) and how much bandwidth?',
      'Are there compliance constraints (data residency, encryption, audit) that affect the target?',
      'What does the release process look like today, and is there a test suite or staging environment we can trust?',
      'What is the definition of "a few minutes" — total write unavailability, or user-visible errors?',
    ],
    requirements: {
      functional: [
        'Move the application tier, the Oracle database and the PostgreSQL database to the cloud before the lease ends.',
        'Continuous replication (CDC) from source to target so cutover requires only draining the last changes.',
        'Validation that the target data matches the source (counts, checksums, business invariants).',
        'A cutover runbook with go/no-go criteria and a tested rollback path, including reverse replication.',
        'All integrations (batch jobs, reports, file transfers, DB links, external partners) inventoried and moved or re-pointed.',
      ],
      nonFunctional: [
        'Write downtime ≤ 5–10 minutes at cutover; read degradation acceptable for a short window.',
        'Zero data loss (RPO = 0 at cutover).',
        'Rollback possible within an agreed window (for example 48 hours) without data loss.',
        'Performance on the target at least equal to current p95 latency for key transactions.',
        'Security and compliance controls equal to or better than the DC (encryption, audit, network isolation).',
      ],
    },
    estimates: `**Bulk copy time.** 5 TB = 40 Tb. Over a 10 Gbps dedicated link at ~70% efficiency (7 Gbps): 40,000 Gb ÷ 7 ≈ 5,700 s ≈ 1.6 h for the raw bytes. Over a 1 Gbps VPN at ~70%: ~16 h. Raw transfer is not the bottleneck; logical load (inserts, index builds, constraint validation) usually is — plan 1–3 days for a full load with indexes, which is why CDC is mandatory.

**Change rate.** Say 50 GB/day of redo/WAL, peaking at 3× during business hours: average ~0.6 MB/s, peak ~2 MB/s. CDC throughput needs comfortable headroom over peak (≥ 5×) so lag recovers quickly after a pause.

**Lag budget.** If CDC is paused for 4 h (target maintenance), backlog at peak ≈ 2 MB/s × 14,400 s ≈ 29 GB; at a 10 MB/s apply rate the net drain is ~8 MB/s (new changes keep arriving), so it catches up in ~1 hour. This number determines how long you can tolerate an interruption without reloading.

**Physical alternative.** Storage-level backup/restore of 5 TB plus archived log shipping (homogeneous only) avoids slow logical loads: restore in hours, then apply logs continuously.

**Offline transfer.** Only relevant below ~1 Gbps or for many TB of archives; shipping appliances take days, so they seed the initial copy at best.

**Application tier.** 30 VMs; re-hosted roughly 1:1 at first, then rightsized after observing real utilisation for a few weeks (typical DC VMs run at 10–20% CPU).`,
    architecture: `**1. Discover and decide per component (the 7 Rs).**
- Monolith app: **re-host / re-platform** — move as-is to VMs or containers, externalise config, put it behind a cloud load balancer. Do not combine "move" and "rewrite"; the deadline is the lease.
- PostgreSQL module: **re-platform** to managed PostgreSQL (RDS/Aurora PostgreSQL, Azure Database for PostgreSQL, Cloud SQL/AlloyDB).
- Oracle: depends on code coupling. If heavy PL/SQL, **re-host or re-platform Oracle first** (Oracle on VMs, or a managed Oracle offering), and convert to PostgreSQL as a later project. If light, convert now with schema-conversion tooling, but only if there is time to test.
- Batch jobs, file drops, reports: inventory; re-point or retire.

**2. Landing zone and connectivity.** Dedicated circuit (or at least redundant VPN) between DC and cloud, private DNS forwarding, target VPC with app and data subnets, IAM and secrets in place.

**3. Data path.**
- Initial load: physical backup/restore (homogeneous) or a parallel logical load by table chunk.
- Ongoing replication: CDC from the source log. Homogeneous Oracle: Data Guard-style standby or log-based replication; heterogeneous: a CDC tool (AWS DMS, Google Database Migration Service for Oracle → PostgreSQL, Oracle GoldenGate, Debezium + Kafka, or the provider's equivalent — confirm the source/target pair is supported with CDC, not just a one-time load). PostgreSQL → managed PostgreSQL: native logical replication (publications and subscriptions).
- Continuous validation: chunked checksums, row counts and business-level reconciliation queries running on both sides.

**4. Application in parallel.** Deploy the app in the cloud pointing at the target replica in read-only mode for testing; run performance tests against the replica with production-like load (replayed traffic).

**5. Cutover (minutes).** Freeze writes, drain CDC lag to zero, validate, fix sequences, switch app and integrations to the target, start reverse replication, unfreeze.

**6. Rollback.** Reverse CDC (target → source) keeps the DC database current for the rollback window; switching back is the same runbook in reverse.

\`\`\`
   DATA CENTER                               CLOUD
 [app VMs x30] ──writes──> [Oracle] ──CDC──> [target DB] <── [app (warm, read-only tests)]
                           [Postgres]─logical repl─> [managed PG]
                                  ^                       │
                                  └──── reverse CDC ──────┘  (after cutover, rollback window)
 DNS / config switch moves traffic DC ──> cloud LB at cutover
\`\`\``,
    deepDives: [
      {
        title: 'Strategy per component and why not refactor now',
        body: `The lease deadline is the dominant constraint, so the default is "move first, improve second". Re-hosting the monolith keeps the risk to infrastructure differences (network latency, storage IOPS, time zones, hostnames, file shares, licence servers) rather than code changes.

The Oracle decision is the real staff-level call. Converting to PostgreSQL removes licence cost and is often a stated goal, but the conversion risk sits in PL/SQL packages, implicit type behaviour (Oracle DATE has a time component; empty string equals NULL in Oracle but not in PostgreSQL; NUMBER precision), sequences, hierarchical queries and transaction semantics. Schema conversion tools typically auto-convert most DDL but leave the hard procedural code. If an assessment shows weeks of manual PL/SQL work, decouple: move Oracle to the cloud homogeneously now, convert in a second phase with its own CDC and cutover. Two smaller, reversible steps beat one large irreversible one.

Strangler-fig extraction of services comes after the move, when the platform is stable.`,
      },
      {
        title: 'Replication and CDC mechanics',
        body: `Sequence: start CDC capture **before** the initial load (record the source log position/SCN/LSN), load the snapshot consistent to that position, then apply captured changes from that position. That ordering avoids a gap.

What breaks CDC in practice:
- **Tables without primary keys**: updates cannot be applied reliably; add keys or use full-row supplemental logging.
- **LOBs**: often handled in a slower mode; test large-object tables separately.
- **DDL during migration**: freeze schema changes or ensure the tool replicates DDL.
- **Triggers and cascades on the target**: disable on the target during replication or changes are applied twice.
- **Sequences**: not replicated by logical CDC; set target sequences above source values at cutover (with a safety gap).
- **Log retention**: source must keep logs long enough to cover any CDC outage, otherwise reload.

Monitor CDC lag in seconds and in bytes as an SLI with alerts; a cutover is only scheduled when lag at peak has stayed under a few seconds for days.`,
      },
      {
        title: 'Cutover runbook',
        body: `A scripted, rehearsed sequence with timings and a named decision owner:
1. T-7 days: dress rehearsals on a production clone, at least two, measured end to end.
2. T-1 h: go/no-go — CDC lag < 5 s, validation green, rollback tested, on-call staffed, stakeholders notified.
3. Put the app into maintenance/read-only mode (feature flag), stop batch jobs, block writes at the DB (revoke or restrict sessions).
4. Wait for CDC lag = 0; record final source position.
5. Run fast validation (row counts and checksums on hot tables, business invariants).
6. Reset sequences on the target; enable triggers/constraints if deferred.
7. Start reverse replication target → source from the current position.
8. Switch the app (already deployed and warm in the cloud) to the target; flip DNS (low TTL set days in advance) or load balancer weights; re-point integrations.
9. Smoke tests on critical journeys, then lift read-only.

Total write freeze: target 5–10 minutes to fit the agreed budget, dominated by validation and smoke tests, so rehearse those to be fast and pre-agree which checks can run after writes resume.`,
      },
      {
        title: 'Rollback design',
        body: `Rollback is only real if the old system stays current. After cutover, reverse CDC replicates writes from the cloud target back to the DC source, so switching back loses nothing.

Define rollback triggers in advance (error rate above X for Y minutes, p95 latency above Z on key transactions, data inconsistency detected) and a rollback window (for example 48 hours or one business cycle such as month-end). After the window, stop reverse replication and decommission deliberately.

Pitfalls: reverse replication for heterogeneous migrations must map types back (test it as rigorously as forward); identity columns/sequences must not collide; external partners who were re-pointed must be re-pointed back; and anything that wrote only to the cloud (new features enabled post-cutover) must be disabled during the window. Practise the rollback in rehearsal, not just the forward path.`,
      },
    ],
    tradeoffs: [
      {
        decision: 'Convert Oracle to PostgreSQL during the move vs after',
        options: 'Heterogeneous migration now vs homogeneous move then conversion',
        choice: `Assess PL/SQL volume first. Heavy procedural code or a tight deadline → homogeneous move now, convert later. Light usage and time to test → convert now and avoid migrating twice. State the licence cost of delay explicitly so the business makes an informed choice.`,
      },
      {
        decision: 'Physical vs logical replication',
        options: 'Backup/restore + log shipping vs row-level CDC',
        choice: `Physical for homogeneous moves to self-managed or compatible targets (faster load, exact copy); logical CDC when heterogeneous or when the managed target does not accept physical replication. Logical gives table-level control and reverse replication at the cost of more edge cases.`,
      },
      {
        decision: 'Big-bang cutover vs phased',
        options: 'All components in one window vs move integrations and modules in waves',
        choice: `Phased where coupling allows (PostgreSQL module, batch jobs, reporting replicas first), with one final short cutover for the core write path. A hybrid period where the cloud app talks to the DC database is acceptable only if latency allows — chatty ORMs across a 5–10 ms link can multiply page latency.`,
      },
      {
        decision: 'Lift-and-shift VMs vs containerise now',
        options: 'Re-host 30 VMs vs re-platform to containers/Kubernetes',
        choice: `Re-host or minimal re-platform (VM images built by pipeline) given the deadline; containerise after cutover. Exception: if the app is already stateless and has a working build, containers are a cheap win.`,
      },
      {
        decision: 'Read-only window vs dual writes',
        options: 'Short write freeze vs application dual-writing to both databases',
        choice: `Short write freeze. Dual writes without distributed transactions create divergence that is hard to detect and reconcile; minutes of read-only mode is a much smaller risk.`,
      },
    ],
    failureModes: [
      {
        failure: 'CDC lag grows during peak or the CDC task fails silently',
        mitigation: `Lag SLI with alerts in seconds and bytes, sized apply capacity (≥ 5× peak change rate), source log retention covering the longest plausible outage, and a documented reload procedure.`,
      },
      {
        failure: 'Data mismatch discovered after cutover (type conversion, missing rows, sequence collisions)',
        mitigation: `Continuous chunked checksums before cutover, business reconciliation queries, sequences reset with a large gap, and reverse replication enabling rollback without loss.`,
      },
      {
        failure: 'Performance regression in the cloud (storage IOPS, missing indexes, network latency between tiers)',
        mitigation: `Replay production traffic against the cloud stack before cutover, provision storage for measured peak IOPS, co-locate app and DB in the same region and keep DB in one AZ with standby in another, and keep the rollback trigger tied to latency.`,
      },
      {
        failure: 'Forgotten integration (nightly file drop, DB link, hard-coded IP) breaks after cutover',
        mitigation: `Dependency discovery from network flow data and DB session/audit logs over weeks, not only interviews; low DNS TTLs; an integration checklist with owners signed off in rehearsal.`,
      },
      {
        failure: 'Cutover overruns the downtime window',
        mitigation: `Timed rehearsals, pre-agreed abort point (if not done by T+X, roll back), parallelised validation, and warm app instances already deployed.`,
      },
      {
        failure: 'Licensing or support surprise (Oracle licensing on cloud vCPUs, vendor support of the target)',
        mitigation: `Resolve licensing with procurement early; confirm the vendor's position on licence counting in the chosen cloud and instance type before sizing.`,
      },
    ],
    followUps: [
      {
        q: 'How do you validate 5 TB of data without stopping the source?',
        a: `Chunk tables by primary-key range and compute hashes per chunk on both sides at the same replicated position (or repeatedly until stable), compare row counts per chunk, and run business invariants (sum of balances, open orders count). Re-check only chunks that changed since the last pass. Final validation at cutover focuses on hot tables because cold chunks were already verified.`,
      },
      {
        q: 'The lease deadline slips to six months. What changes?',
        a: `Cut scope, not safety: homogeneous Oracle move, re-host app, defer any conversion and containerisation, move low-risk components first to burn down the inventory, and get the network circuit ordered immediately because provisioning lead times can be weeks to months. Keep rehearsals — they are the cheapest risk reduction.`,
      },
      {
        q: 'How would you handle the 30 app VMs talking to the database during a hybrid phase?',
        a: `Measure query counts per request. With a 5–10 ms round trip, a page that makes 100 sequential queries gains up to a second. Either keep app and DB on the same side (move them together at cutover) or only move components that are coarse-grained in their DB access.`,
      },
      {
        q: 'What would you do differently for a 50 TB database?',
        a: `Raw transfer becomes significant (50 TB at 7 Gbps ≈ 16 h), and logical full loads may take a week, so physical seeding (backup restore or storage-level copy) plus log apply becomes essential. CDC headroom and log retention planning become stricter; consider partitioning historical data and moving cold partitions early as a separate, offline step.`,
      },
    ],
    rubric: [
      {
        area: 'Strategy and scoping',
        signals: [
          'Applies the migration strategies (re-host, re-platform, refactor, retire) per component',
          'Separates "move" from "modernise" under a hard deadline',
          'Makes an explicit, assessed decision about Oracle conversion',
        ],
      },
      {
        area: 'Data movement',
        signals: [
          'Computes bulk transfer time and change-rate headroom',
          'Orders CDC start before snapshot to avoid gaps',
          'Names CDC pitfalls: primary keys, LOBs, sequences, triggers, DDL',
        ],
      },
      {
        area: 'Cutover',
        signals: [
          'Writes a step-by-step runbook with go/no-go criteria and timings',
          'Rehearses on production-like data at least twice',
          'Pre-lowers DNS TTLs and keeps the app warm in the cloud',
        ],
      },
      {
        area: 'Rollback and risk',
        signals: [
          'Uses reverse replication to make rollback lossless',
          'Defines rollback triggers and a window in advance',
          'Discovers integrations from data (flow/audit logs), not just interviews',
        ],
      },
      {
        area: 'Operations and performance',
        signals: [
          'Tests performance with replayed traffic before cutover',
          'Monitors CDC lag as an SLI',
          'Plans post-migration rightsizing and decommissioning',
        ],
      },
    ],
    references: [
      { title: 'AWS Prescriptive Guidance: Migration strategies', url: 'https://docs.aws.amazon.com/prescriptive-guidance/latest/large-migration-guide/migration-strategies.html' },
      { title: 'PostgreSQL: High Availability, Load Balancing, and Replication', url: 'https://www.postgresql.org/docs/current/high-availability.html' },
      { title: 'Google Cloud Architecture Center', url: 'https://cloud.google.com/architecture' },
      { title: 'Apache Kafka Documentation', url: 'https://kafka.apache.org/documentation/' },
    ],
  },

  // ---------------------------------------------------------------------------
  // 10. Cut a $2M/month cloud bill by 30%
  // ---------------------------------------------------------------------------
  {
    id: 'sd-cost-reduction',
    title: 'Cut a $2M/month cloud bill by 30%',
    difficulty: 'staff',
    topics: ['arch-finops', 'compute-scaling', 'compute-models', 'storage-types', 'rel-slo'],
    prompt: `Our cloud bill is about two million dollars a month and growing faster than revenue. The CFO has asked engineering to cut it by 30% within two quarters, and the CTO has said we cannot hurt reliability while we do it. You have been asked to lead this. How do you approach it — what do you look at first, what do you do quickly, what structural changes do you make, and how do you make sure the bill does not grow back?`,
    clarifyingQuestions: [
      'What is the breakdown by service category (compute, managed databases, storage, data transfer, observability, support) and by team or product?',
      'How much of the spend is covered by commitments (reservations, savings plans, committed-use discounts) today, and when do they expire?',
      'Is resource tagging/labelling in place, and what fraction of spend is attributable to an owner?',
      'What are the reliability SLOs per service, so we know which savings are safe?',
      'Is there an enterprise discount agreement up for renewal?',
      'How much of the fleet is Kubernetes vs VMs vs serverless, and how are requests/limits set?',
      'Is the 30% measured on absolute spend, or on spend normalised for growth (unit cost)?',
      'Who has authority to change architecture in teams — central platform or each product team?',
    ],
    requirements: {
      functional: [
        'Full cost visibility: allocation of ≥ 95% of spend to teams/services via tags, accounts and shared-cost rules.',
        'A prioritised savings backlog with estimated value, effort and risk per item.',
        'Execution of quick wins within the first 4–6 weeks and structural changes over two quarters.',
        'Unit-economics metrics (cost per request, per customer, per transaction) per product.',
        'Ongoing governance: budgets, anomaly alerts, showback/chargeback, design reviews for cost.',
      ],
      nonFunctional: [
        'No SLO breaches attributable to cost work; every change rolled out with the same safety as a feature change.',
        '$600k/month run-rate reduction (30%) at the end of two quarters, measured against a growth-adjusted baseline agreed with finance.',
        'Commitments sized so that under-utilisation stays under ~5%.',
        'Savings sustained: unit cost trend tracked monthly; regressions caught within days.',
      ],
    },
    estimates: `**Illustrative breakdown of $2M/month** (validate against the real bill):
- Compute (VMs, Kubernetes nodes): $1.0M (50%)
- Managed databases: $300k (15%)
- Storage (block, object, snapshots): $250k (12.5%)
- Data transfer (egress, cross-AZ, NAT processing): $200k (10%)
- Observability (logs, metrics, APM): $150k (7.5%)
- Other (support, misc services): $100k (5%)

**Target**: $600k/month. Plausible contributions (each estimated after the previous, so no double counting):
- **Non-prod scheduling**: if 25% of compute ($250k) is non-prod and runs 24×7, turning it off nights and weekends (~12 h × 5 days on of 168 h ≈ 36% uptime) saves ~60% of it ≈ $150k.
- **Rightsizing and Kubernetes bin packing**: fleets running at 10–20% average CPU; reducing remaining compute ($750k) by 15–20% ≈ $110–150k.
- **Commitments** on the new, smaller steady baseline: cover ~70–80% of it with 1-year commitments at roughly 25–40% discount (varies by provider, term and type). On ~$500k committable compute and database spend not already covered: 75% × $500k × ~30% ≈ $110k, up to ~$150k with deeper discounts on stable databases ≈ $100–150k.
- **Spot/preemptible** for stateless and batch: often 60–90% off on-demand (approximate, varies); moving $100k of batch ≈ $60k.
- **Storage**: delete unattached volumes and orphaned snapshots, lifecycle object storage to colder tiers, move to cheaper block volume types: 20–30% of $250k ≈ $50–75k.
- **Data transfer**: private endpoints instead of NAT for provider services, keep chatty services in one AZ or use topology-aware routing, compress: 20–30% of $200k ≈ $40–60k.
- **Observability**: drop debug logs in prod, sampling, retention tiers, cardinality limits: 25–40% of $150k ≈ $40–60k.

Sum ≈ $550–700k/month, so 30% is achievable but needs the structural items, not just commitments.`,
    architecture: `This is an organisational system as much as a technical one. Reference approach, following the FinOps lifecycle (Inform → Optimise → Operate):

**1. Weeks 0–3: Inform.**
- Ingest detailed billing exports (AWS CUR / Azure cost exports / Google Cloud billing export to a warehouse) into a cost data warehouse.
- Allocation: account/subscription/project structure + mandatory tags (team, service, env); rules for shared costs (Kubernetes clusters split by namespace requests, shared networking split by traffic).
- Top-down: rank spend by service, team, and SKU; identify the 20 line items that make up ~80% of spend.
- Bottom-up: utilisation data (CPU, memory, IOPS, storage access patterns) for those items.
- Agree the baseline and target definition with finance (absolute vs growth-adjusted).

**2. Weeks 2–8: Quick wins (low risk, central team can execute).**
- Idle and orphaned resources: unattached volumes, idle load balancers, old snapshots, unused IPs, forgotten test environments.
- Non-prod schedules and auto-shutdown for sandboxes.
- Storage lifecycle policies and cheaper volume types.
- Log retention and debug-level cleanup.
- Commitments for the clearly stable floor only (for example the minimum hourly usage over the last 3 months), so you do not lock in waste you are about to remove.

**3. Months 2–6: Structural (owned by product teams, supported centrally).**
- Rightsizing with real utilisation; Kubernetes request/limit tuning and node autoscaler/bin-packing improvements.
- Spot/preemptible for stateless services and batch, with interruption handling.
- Arm-based instances where the stack supports it (often meaningfully better price-performance; benchmark per workload).
- Architecture fixes for egress: private endpoints, AZ-aware routing, caching, compression.
- Database rightsizing, read replica review, storage engine/tier changes, archiving cold data.
- Second wave of commitments once the baseline has shrunk.

**4. Operate: governance so it stays down.**
- Showback dashboards per team with unit cost; monthly reviews with engineering leads.
- Budgets and anomaly detection alerts to owning teams.
- Cost as a non-functional requirement in design reviews; policy-as-code guardrails (allowed instance families, mandatory tags, no unbounded log retention).
- A central FinOps function that owns commitments portfolio management.

\`\`\`
billing export ─> cost warehouse ─> allocation (tags, accounts, shared rules)
                                       │
         ┌─────────────────────────────┼───────────────────────────┐
     dashboards / unit cost      savings backlog            anomaly + budget alerts
     (per team, monthly)     (value x effort x risk)          (to owning team)
                                       │
            quick wins (central) ── structural (teams) ── commitments (FinOps)
\`\`\``,
    deepDives: [
      {
        title: 'Analysis approach: find the money before you touch anything',
        body: `Start with allocation, because unowned spend does not get optimised. Untagged spend is often a large fraction (commonly quoted as 20–40%) in organisations that have never enforced tagging; fix allocation first with account structure (cheap and complete) and then tags (precise but leaky).

Then rank:
- **By SKU and service**: which 20 lines make 80% of spend.
- **By growth**: what grew fastest in the last 6 months, because that is where waste is being created now.
- **By utilisation**: average and p95 CPU/memory per instance group, IOPS vs provisioned, object storage access frequency.
- **By unit cost**: cost per request or per customer per product; a product whose unit cost is rising faster than its traffic has architectural waste.

Every backlog item gets estimated monthly value, effort, risk to SLOs and owner. A senior answer resists "turn on commitments and declare victory": commitments come after removing waste, or you pay a discount on resources you should have deleted.`,
      },
      {
        title: 'Commitments without overcommitting',
        body: `Commitments (reservations, savings plans, committed-use discounts) are one of the largest levers with no engineering risk, and also the easiest way to waste money if sized badly.

- Size to the **floor** of usage, not the average: use the minimum hourly spend over the last 60–90 days, then subtract planned reductions (rightsizing, spot migrations).
- Prefer **flexible** forms (spend-based or convertible, across instance families/regions) while the fleet is changing; specific reservations only for very stable workloads such as databases.
- **Ladder** commitments: buy in tranches every month or quarter rather than once, so expirations are staggered and you can adapt.
- Track **coverage** (share of eligible usage covered) and **utilisation** (share of commitments used); targets around 70–80% coverage and > 95% utilisation are common.
- 3-year terms give deeper discounts but lock in architecture; use them only for workloads you are confident will exist (core databases).`,
      },
      {
        title: 'Savings that do not hurt reliability',
        body: `Cost changes are production changes. Rules:
- Rightsizing happens through the normal pipeline with canaries, and the SLO dashboard is the guardrail. Reduce in steps (for example one size down), watch p99 latency and saturation for a week.
- Keep **headroom for failure**: an N+1 multi-AZ setup must still carry peak if one AZ is lost. Rightsizing that removes AZ-failure headroom is a reliability regression disguised as savings.
- Spot only where interruption is handled: stateless replicas spread over several instance types and AZs, graceful termination on the interruption notice, a floor of on-demand capacity for baseline.
- Non-prod scheduling with an easy override, so teams do not bypass it.
- Observability cuts target noise (debug logs, unused metrics, high-cardinality labels), not the signals behind SLO alerts.

Report savings alongside SLO attainment every month so the trade-off is visible.`,
      },
      {
        title: 'Data transfer: the hidden line items',
        body: `Data transfer is often poorly understood because it is spread across many line items: internet egress, inter-region, cross-AZ, NAT processing, load balancer processing, and transit hub processing.

Common fixes:
- **Private endpoints** for provider storage, queues and registries so traffic does not traverse NAT (which charges per GB processed).
- **AZ-aware routing**: keep chatty service-to-service and service-to-cache calls in the same AZ (topology-aware routing in Kubernetes, zonal endpoints), while keeping multi-AZ for failover.
- **Compression** and protocol efficiency for service-to-service payloads and replication streams.
- **CDN** in front of public downloads; cached bytes are usually cheaper than origin egress.
- **Log shipping**: ship logs within a region and aggregate there; cross-region log replication of everything is a classic surprise.

Make transfer visible per service with flow logs joined to the allocation model; teams cannot fix what they cannot see.`,
      },
    ],
    tradeoffs: [
      {
        decision: 'Central team executes vs teams own their savings',
        options: 'FinOps team makes changes centrally vs product teams change their own services',
        choice: `Central team executes commitments, idle cleanup and platform-wide policies (fast, low coordination). Product teams own rightsizing and architecture changes, because they own the SLOs; the central team provides data, recommendations and tooling. Executive sponsorship sets per-team targets.`,
      },
      {
        decision: 'Commit early vs commit after optimising',
        options: 'Buy commitments in week 1 vs after rightsizing',
        choice: `Commit only the clear floor early (captures savings immediately with low risk), then a second tranche after structural reductions. Waiting entirely forfeits months of discount; committing everything early locks in waste.`,
      },
      {
        decision: 'Showback vs chargeback',
        options: 'Report costs to teams vs bill teams against their budgets',
        choice: `Showback first, with unit costs and trends, because chargeback without trusted allocation creates disputes. Move to chargeback (or budget accountability) once allocation is above ~95% and shared-cost rules are agreed.`,
      },
      {
        decision: 'Spot/preemptible adoption',
        options: 'Aggressive spot for most stateless services vs only batch',
        choice: `Batch and CI first (easy, large savings), then stateless services with a mixed on-demand floor and instance diversification. Not for stateful single-instance workloads or anything where interruption handling is not tested.`,
      },
      {
        decision: 'Absolute target vs unit-cost target',
        options: '30% off the bill vs 30% lower cost per unit of business',
        choice: `Agree both with finance: an absolute run-rate target for this programme, and unit cost as the long-term metric, so growth does not mask efficiency gains or erase them.`,
      },
    ],
    failureModes: [
      {
        failure: 'Rightsizing causes latency regressions or outages under peak or during an AZ failure',
        mitigation: `Step-wise changes through the deployment pipeline, SLO guardrails with automatic rollback, and capacity checks that include N+1 AZ failure headroom.`,
      },
      {
        failure: 'Overcommitting: commitments go unused after migrations or rightsizing',
        mitigation: `Size to the usage floor minus planned reductions, prefer flexible commitments, ladder purchases, monitor utilisation monthly.`,
      },
      {
        failure: 'Savings decay: costs creep back within two quarters',
        mitigation: `Anomaly detection and budgets routed to owning teams, unit-cost dashboards reviewed monthly, guardrails in policy-as-code (tags, instance families, retention), and cost review in design approvals.`,
      },
      {
        failure: 'Deleting "orphaned" resources that were actually needed (backups, DR snapshots)',
        mitigation: `Tag-and-notify before deleting, a quarantine period (stop or snapshot before deletion), and an explicit allow-list for backup and DR assets with owners.`,
      },
      {
        failure: 'Spot interruptions cascade into capacity shortfalls',
        mitigation: `Diversify across instance types and AZs, keep an on-demand floor, handle termination notices gracefully, and test with injected interruptions.`,
      },
      {
        failure: 'Cutting observability removes signals needed during incidents',
        mitigation: `Classify telemetry: SLO and alerting signals are protected; cut debug logs, unused dashboards' metrics and high-cardinality labels; keep short-retention full-fidelity data with sampling for the long tail.`,
      },
    ],
    followUps: [
      {
        q: 'After a month you have only found 15%. What next?',
        a: `Go to architecture: look at unit cost per product and find the services whose cost per request is out of line; typical culprits are over-provisioned databases, chatty cross-AZ traffic, logging everything, and duplicated environments. Revisit the enterprise agreement and support tier. Present the gap honestly with options and their risk, rather than quietly cutting headroom.`,
      },
      {
        q: 'How do you get product teams to prioritise cost work over features?',
        a: `Make it visible and owned: per-team showback with unit cost, targets set by leadership, savings items sized like features with value per engineering week. Make the easy path cheap (platform defaults: schedules, rightsized templates, spot-ready node pools) so most savings require little team effort. Celebrate and report savings next to reliability metrics.`,
      },
      {
        q: 'How does Kubernetes complicate cost allocation and what do you do?',
        a: `Nodes are shared, so the bill shows nodes, not services. Allocate by namespace based on requested CPU/memory (or max of requested and used), plus a share of idle capacity and cluster overhead. Tune requests to actual usage (vertical recommendations), enable node autoscaling with consolidation, and use separate node pools for spot and for special hardware.`,
      },
      {
        q: 'Would you move to a cheaper cloud or back on-prem to save money?',
        a: `Only with a full TCO model: hardware, facilities, staff, migration cost and time, lost elasticity and managed services. Repatriation can make sense for large, stable, predictable workloads (storage-heavy, steady compute) but takes far longer than two quarters, so it does not meet this goal. Mention it as a long-term option, not a lever for this programme.`,
      },
    ],
    rubric: [
      {
        area: 'Analysis and visibility',
        signals: [
          'Starts with allocation and ownership before optimisation',
          'Breaks the bill down by category, team and growth with concrete numbers',
          'Defines unit-economics metrics and an agreed baseline with finance',
        ],
      },
      {
        area: 'Prioritised plan',
        signals: [
          'Separates quick wins from structural changes with timelines',
          'Estimates savings per lever without double counting',
          'Shows the sum reaches the target and identifies the risky items',
        ],
      },
      {
        area: 'Commitments and pricing',
        signals: [
          'Sizes commitments to the usage floor after planned reductions',
          'Prefers flexible, laddered commitments and tracks coverage and utilisation',
          'Uses spot/preemptible where interruption is handled',
        ],
      },
      {
        area: 'Reliability protection',
        signals: [
          'Treats cost changes as production changes with SLO guardrails',
          'Preserves N+1/AZ-failure headroom',
          'Protects SLO-critical observability signals',
        ],
      },
      {
        area: 'Governance and culture',
        signals: [
          'Introduces showback, budgets and anomaly alerts routed to owners',
          'Adds policy-as-code guardrails and cost in design reviews',
          'Describes how to influence product teams and leadership',
        ],
      },
    ],
    references: [
      { title: 'FinOps Framework', url: 'https://www.finops.org/framework/' },
      { title: 'AWS Well-Architected Framework', url: 'https://aws.amazon.com/architecture/well-architected/' },
      { title: 'Google Cloud Architecture Framework', url: 'https://cloud.google.com/architecture/framework' },
      { title: 'SRE Book: Service Level Objectives', url: 'https://sre.google/sre-book/service-level-objectives/' },
    ],
  },
];
