import type { DesignCase } from '../types';

/**
 * Infrastructure system-design cases, set 1.
 * Numbers are back-of-envelope approximations, labelled as such.
 */
export const designCases1: DesignCase[] = [
  // ---------------------------------------------------------------------------
  // 1. Multi-region web application
  // ---------------------------------------------------------------------------
  {
    id: 'sd-multi-region-web',
    title: 'Highly available multi-region SaaS web application',
    difficulty: 'senior',
    topics: ['rel-resilience', 'net-edge', 'data-databases', 'dist-theory', 'rel-slo', 'sec-data'],
    prompt: `"We run a B2B SaaS product: a web app plus a public API. Customers are global, roughly 40% North America, 35% Europe, 25% Asia-Pacific. Today everything sits in one region and last year a regional outage took us down for most of an afternoon. Leadership has committed to **99.99% availability**, we must survive the loss of an entire region, and our European customers contractually require their data to stay in the EU. Design the target architecture and tell me how you would get there."`,
    clarifyingQuestions: [
      'What exactly does 99.99% measure: the API, the web UI, specific critical user journeys, per tenant or aggregate, and over what window?',
      'What are the read/write ratio and peak request rate, and which operations must be strongly consistent (billing, permissions) versus tolerant of seconds of staleness?',
      'What does data residency cover: primary data only, or also backups, logs, support tooling, and derived analytics? Can EU metadata (tenant name, routing key) be global?',
      'What RPO and RTO are acceptable on a full region loss: is losing a few seconds of writes acceptable for normal SaaS data?',
      'Is a tenant ever global (a multinational with users on several continents), and how do we handle a user in Asia belonging to an EU tenant?',
      'What third-party dependencies sit on the critical path (identity provider, payment, email) and are they themselves multi-region?',
      'What is the budget tolerance: is roughly doubling infrastructure spend acceptable, and how big is the platform team?',
      'Are there existing constraints such as a single relational database monolith that we have to migrate incrementally?',
    ],
    requirements: {
      functional: [
        'Serve web UI and public API to global users with authentication, tenant isolation and per-tenant configuration.',
        'Pin each tenant to a home geography (EU, US, APAC); EU tenant data at rest and in backups stays in EU regions.',
        'Survive the complete loss of any one region with automatic or one-command failover of traffic.',
        'Global control-plane functions: sign-up, tenant directory and routing, billing aggregation.',
        'Support planned regional evacuation for maintenance and game days.',
      ],
      nonFunctional: [
        'Availability 99.99% for critical journeys (login, core read/write API), measured monthly: about 4.3 minutes of error budget per month.',
        'Region-loss RTO under 5 minutes for traffic; RPO of seconds for ordinary tenant data, zero for billing ledger entries.',
        'p99 latency under 300 ms for API calls from the tenant home geography.',
        'Blast radius: a bad deploy or poison tenant affects at most one cell (a small fraction of tenants).',
        'Compliance: data residency, encryption at rest and in transit, auditable access.',
        'Cost: multi-region overhead within roughly 1.6–2x of single-region spend.',
      ],
    },
    estimates: `Assume 5,000 tenants, 2 million monthly active users, about 300k daily active.

- **Traffic**: 300k DAU x ~200 API calls/day = 60M calls/day, about 700 req/s average. Peaks are business-hours and regional, so assume a 4x peak in the busiest geography: **~3k req/s** globally at peak, under 1.5k req/s in any one region. Read:write roughly 9:1.
- **Error budget**: 99.99% of a 30-day month = 43,200 min x 0.0001 = **~4.3 min**. A single DNS-based failover with a 60 s TTL plus detection time can consume a full month of budget, so failover must be fast and rare, and most failures must be absorbed without failover at all (multi-AZ inside the region).
- **Composite availability**: three serial dependencies at 99.95% each give about 99.85%. Hitting 99.99% requires redundancy (two independent regions at 99.9% each, failing independently, give about 99.9999% in theory; correlated failures and failover time make the real figure far lower), so the design must remove serial single-region dependencies.
- **Storage**: 5,000 tenants x average 20 GB = **~100 TB total** relational plus object data, split by geography (EU ~35 TB). Replicating each geography to a second region doubles storage: ~200 TB.
- **Replication bandwidth**: writes are ~10% of 3k req/s = 300 writes/s x ~2 KB including WAL overhead = ~0.6 MB/s, around 50 GB/day (~1.5 TB/month) of cross-region transfer per direction. At an order-of-magnitude ~$0.02/GB inter-region, database replication is tens of dollars a month; even with object-storage replication and cross-region reads it stays in the low thousands at most: negligible versus compute.
- **Cost order of magnitude**: if the single-region footprint is ~$150k/month, active-active pairs per geography with ~50–60% headroom (each region must absorb its partner) land at **$240k–300k/month**. The headroom is the real cost, not bandwidth.`,
    architecture: `The reference design is **geography-pinned cells with a paired-region standby per geography**, plus a thin global control plane.

1. **Global edge**: a global CDN and WAF (anycast or DNS-steered, depending on provider) in front of everything (CloudFront + Shield / Azure Front Door / Cloud CDN + Cloud Armor). TLS terminates at the edge; static assets are cached there. Dynamic requests go to the tenant's home geography.
2. **Routing**: the edge resolves the tenant from the hostname (tenant.example.com) or a signed token claim and looks up a small, globally replicated **tenant directory** (tenant id to geography, cell, active region). The directory is read-mostly, cached at the edge for 30–60 s, and must keep working when its own write path is down (static stability).
3. **Geographies and regions**: each geography (EU, US, APAC) has two regions, for example EU-West and EU-Central. Both regions run the full stateless stack; one region is the **write primary** per cell and the other is a warm, scaled standby that serves reads.
4. **Cells**: inside each region tenants are partitioned into cells of ~200–500 tenants, each with its own app tier, database cluster, cache and queue. Cells are the unit of deploy, blast radius and capacity.
5. **Data tier**: per cell, a relational database with synchronous multi-AZ replication inside the region and **asynchronous replication** to the paired region (seconds of lag). Object storage uses cross-region replication within the same geography. Backups are copied to a third location inside the geography, never outside it.
6. **Global control plane**: sign-up, billing aggregation and the tenant directory. It stores only non-residency-scoped metadata, runs active-active across geographies, and is **not on the request path** except through cached directory reads.
7. **Failover**: health is judged per cell from synthetic probes and SLI burn rates across several vantage points. Failover promotes the standby database and flips the directory entry; the edge picks it up within its cache TTL.

\`\`\`
 users --> anycast edge (CDN/WAF, TLS) --> tenant directory (cached)
                 |                 |                   |
              EU geo            US geo              APAC geo
         +---------------+   (same shape)        (same shape)
         | EU-West  (RW) |<-- async repl --> | EU-Central (RO/standby) |
         | cells 1..N    |                   | cells 1..N              |
         | app, cache,   |                   | app (warm), replica DB, |
         | DB primary    |                   | object repl             |
         +---------------+                   +-------------------------+
 global control plane: signup, billing, directory writes (metadata only)
\`\`\``,
    deepDives: [
      {
        title: 'Why not active-active writes everywhere',
        body: `Multi-master across regions means concurrent writes to the same row in two places, so you need conflict resolution (last-writer-wins silently loses data; CRDTs fit only some data types) or a globally consistent database that pays a cross-region round trip on every write (~10–30 ms between nearby regions, ~60–150 ms across a large continent or an ocean, order of magnitude). For B2B SaaS the natural shard key is the tenant, and a tenant's users cluster in one geography, so **single-writer per tenant with fast failover** gives most of the availability benefit without conflicts. Reserve globally consistent storage (distributed SQL such as Spanner, CockroachDB or similar) for the small global control plane where correctness matters more than write latency.`,
      },
      {
        title: 'Failover mechanics and avoiding split brain',
        body: `The dangerous failure is a partial one: the primary region is reachable from some vantage points but not others. Rules:
- Decide from **multiple independent observers** (probes from other regions and the edge), requiring a quorum before declaring a region unhealthy.
- **Fence the old primary** before promoting the new one: revoke its write credentials or flip it read-only via the control plane, so a recovering zombie cannot accept writes.
- Prefer **human-approved, one-command failover** for the data tier and automatic failover for stateless traffic. Automatic database promotion on flaky signals causes more outages than it prevents.
- After failover, the old primary rejoins as a replica; any unreplicated writes (the RPO window) are written to a quarantine table and reconciled, not discarded silently.`,
      },
      {
        title: 'Data residency done properly',
        body: `Residency is a data-flow problem, not only a database-placement problem. Inventory every sink: primary DB, replicas, backups, search indexes, caches, logs, traces, analytics exports, support tooling and LLM or third-party processors. Patterns:
- Keep the global tier limited to **pseudonymous metadata** (tenant id, geography, plan); anything personal stays in-geo.
- Scrub or tokenise personal data before logs and traces leave the geography, or run per-geography observability stacks.
- Enforce with policy: organisation-level region restrictions (AWS SCPs / Azure Policy allowed locations / GCP resource-location constraint) and per-geography encryption keys whose key policies forbid use from outside the geography.
- A multinational tenant still has one home; remote users pay the latency or get read-only edge caching of non-personal content.`,
      },
      {
        title: 'Static stability and dependency hygiene',
        body: `Failover must not depend on the thing that failed. The failover path should need only data-plane operations that are already provisioned: pre-scaled standby capacity (or capacity reservations), pre-created DNS records, warm connection pools. Control-plane calls in the failing region (create instances, modify load balancers) are the first to break during regional events. Likewise, authentication must not depend on a single-region identity provider: cache signing keys (JWKS) and allow token validation offline for the session lifetime.`,
      },
    ],
    tradeoffs: [
      {
        decision: 'Regional topology per geography',
        options: 'Active-passive (cold/pilot light) vs warm standby vs active-active with single writer per tenant vs multi-master',
        choice: `**Warm standby that serves reads, single writer per tenant.** Cold standby cannot meet a 5-minute RTO because scaling from zero under a regional event is unreliable; multi-master adds conflict resolution for little gain when tenants are geographically clustered. Keeping the standby serving real read traffic proves it works every day.`,
      },
      {
        decision: 'Traffic steering mechanism',
        options: 'DNS-based failover (health-checked records) vs anycast edge with origin failover vs client-side region lists',
        choice: `**Anycast edge with origin selection from the tenant directory.** DNS TTLs are not honoured uniformly by resolvers and clients, so DNS failover has a long tail of minutes. Steering at an edge you control shifts traffic in seconds. Keep DNS failover as the backstop if the edge provider itself fails.`,
      },
      {
        decision: 'Replication mode to the paired region',
        options: 'Synchronous cross-region commit vs asynchronous replication',
        choice: `**Asynchronous for tenant data, synchronous only for the billing ledger.** Synchronous commit adds a cross-region round trip (~10–30 ms between paired regions in one geography) to every write and couples the primary's availability to the standby. Seconds of RPO is acceptable for ordinary SaaS records if it is written into the SLA; the ledger gets its own quorum-replicated store.`,
      },
      {
        decision: 'Cell size',
        options: 'Few large cells vs many small cells',
        choice: `**Many small cells (hundreds of tenants each).** Smaller blast radius and easier per-cell evacuation, at the cost of more fixed overhead per cell and a routing layer. Large enterprise tenants can get dedicated cells.`,
      },
      {
        decision: 'Who triggers failover',
        options: 'Fully automatic vs human-in-the-loop vs hybrid',
        choice: `**Hybrid.** Stateless traffic shifts automatically on clear signals; database promotion is a single pre-approved command an on-call engineer runs after checking the runbook signals. Budget: detection 1–2 min, decision 1 min, execution 1–2 min.`,
      },
    ],
    failureModes: [
      {
        failure: 'Full regional outage of the EU write region',
        mitigation: `Probes and burn-rate alerts fire; on-call runs the cell-evacuation command: fence the old primary, promote replicas in EU-Central, flip directory entries. Standby already serves reads and is pre-scaled, so only writes see an interruption of a few minutes. Unreplicated writes go to quarantine for reconciliation.`,
      },
      {
        failure: 'Partial or grey failure: elevated latency and 5% errors in one AZ',
        mitigation: `Handled inside the region, not with a regional failover: load balancers eject unhealthy targets via outlier detection, zonal shift drains the AZ, and services are provisioned so the remaining AZs carry full load (static stability: N+1 AZ capacity).`,
      },
      {
        failure: 'Bad deploy breaks one cell',
        mitigation: `Deploys roll cell by cell with bake time and automatic rollback on SLI regression. Only the first (canary) cell is exposed; blast radius is a few percent of tenants.`,
      },
      {
        failure: 'Tenant directory write path down',
        mitigation: `Edges serve the last-known directory from cache and the directory replicas are read-only-capable. New sign-ups queue; existing traffic is unaffected. The directory is designed so stale data is safe for minutes.`,
      },
      {
        failure: 'Split brain after a network partition between paired regions',
        mitigation: `Fencing via the control plane (read-only flag plus credential revocation) before promotion; database writes require a valid lease token checked on commit. Replication monitors alert if two primaries ever exist for one cell.`,
      },
      {
        failure: 'Replication lag grows to minutes under a write burst',
        mitigation: `Alert on lag versus the RPO objective; throttle bulk jobs (imports, migrations) that cause bursts; failover runbook states the expected data-loss window before promotion so the decision is informed.`,
      },
    ],
    followUps: [
      {
        q: 'How would you prove you meet 99.99%?',
        a: `Define SLIs per critical journey from the edge (successful requests / valid requests, plus latency-qualified success) and compute availability per tenant cohort, not just aggregate, so a dead cell is not hidden by healthy ones. Alert on multi-window burn rates. Run quarterly regional evacuation game days in production and measure the actual RTO and RPO achieved.`,
      },
      {
        q: 'An EU customer’s user travels to Singapore. What happens?',
        a: `The edge in Singapore terminates TLS and forwards to the EU home region, adding ~150–200 ms round trip, order of magnitude. Static content is cached at the edge. Their data is never stored in APAC; if latency is unacceptable we can optimise the protocol (fewer round trips, HTTP/2 or HTTP/3 to the edge with pooled connections behind it), not move the data.`,
      },
      {
        q: 'How do you migrate from today’s single region without a big bang?',
        a: `First move to multi-AZ and cells inside the current region, introducing the tenant directory and routing layer. Then stand up the paired region as a read replica target and run read traffic there. Then migrate EU tenants cell by cell to EU regions using logical replication and a short per-tenant write freeze. Finally rehearse failover per cell before declaring the SLO.`,
      },
      {
        q: 'What if the CDN/edge provider itself has an outage?',
        a: `It is now a serial dependency, so it needs a fallback: keep regional load balancer endpoints with valid certificates, and a pre-tested DNS change (low TTL on the apex record) that bypasses the edge, accepting lost WAF/caching for the duration. Some companies run two CDN providers with DNS steering; that doubles configuration complexity and is only justified at large scale.`,
      },
      {
        q: 'How do you keep the standby region from rotting?',
        a: `Make it serve production reads, deploy to it in the same pipeline, include it in every config change, and periodically flip the primary for a few cells so both directions are exercised. Capacity drift is caught by load tests that replay the partner region’s peak.`,
      },
    ],
    rubric: [
      {
        area: 'Requirements & scoping',
        signals: [
          'Converts 99.99% into ~4.3 minutes per month and notes that failover time itself consumes budget.',
          'Asks what residency covers beyond the primary database (backups, logs, support tooling).',
          'Separates data needing RPO 0 (ledger) from data that tolerates seconds.',
        ],
      },
      {
        area: 'Architecture',
        signals: [
          'Uses tenant as the partition key with a home geography and single writer per tenant.',
          'Introduces cells to bound blast radius and a cached, statically stable routing directory.',
          'Keeps the global control plane off the hot path.',
        ],
      },
      {
        area: 'Reliability & failure',
        signals: [
          'Distinguishes AZ-level handling from regional failover; does not fail over regions for grey failures.',
          'Addresses split brain with fencing and multi-vantage health decisions.',
          'Pre-provisions standby capacity rather than relying on control-plane scale-up during an event.',
        ],
      },
      {
        area: 'Security & compliance',
        signals: [
          'Enforces residency with organisation policies and geography-scoped encryption keys.',
          'Treats observability data and third-party processors as residency scope.',
        ],
      },
      {
        area: 'Operations & cost',
        signals: [
          'Identifies headroom (not bandwidth) as the dominant cost of multi-region.',
          'Plans game days that measure actual RTO/RPO.',
          'Gives an incremental migration path with checkpoints.',
        ],
      },
      {
        area: 'Communication',
        signals: [
          'States the chosen design first, then defends it against alternatives.',
          'Quantifies latency and cost claims as order-of-magnitude estimates.',
        ],
      },
    ],
    references: [
      { title: 'AWS Builders’ Library: Static stability using Availability Zones', url: 'https://aws.amazon.com/builders-library/static-stability-using-availability-zones/' },
      { title: 'Google SRE Book: Service Level Objectives', url: 'https://sre.google/sre-book/service-level-objectives/' },
      { title: 'AWS Well-Architected Framework', url: 'https://aws.amazon.com/architecture/well-architected/' },
      { title: 'Azure Architecture Center: Cloud design patterns', url: 'https://learn.microsoft.com/en-us/azure/architecture/patterns/' },
    ],
  },

  // ---------------------------------------------------------------------------
  // 2. Observability pipeline
  // ---------------------------------------------------------------------------
  {
    id: 'sd-observability-pipeline',
    title: 'Centralized observability platform for 500 services',
    difficulty: 'staff',
    topics: ['obs-signals', 'dist-messaging', 'storage-types', 'arch-finops', 'compute-scaling'],
    prompt: `"We have about 500 microservices across several Kubernetes clusters and some VMs. Every team ships logs, metrics and traces differently, our vendor bill doubled last year, and during the last big incident our logging system fell over exactly when we needed it. We ingest roughly **2 TB of logs a day**. Design a centralized observability platform: logs, metrics and traces, with sensible retention, cost control, and protection against cardinality explosions."`,
    clarifyingQuestions: [
      'What are the query patterns: incident debugging over the last few hours, compliance search over a year, or analytics? Who are the users and how many concurrent queries?',
      'What retention is required by compliance (audit/security logs) versus what teams want for debugging?',
      'How many active metric time series do we have today, and what scrape interval? Do we know the top offenders?',
      'Do we want to build on open source, stay with a vendor, or a hybrid (self-hosted for logs, vendor for APM)?',
      'Is there sensitive data in logs (PII, tokens) that must be redacted before storage?',
      'What is the freshness requirement: how quickly must a log line or metric be queryable after it is emitted?',
      'Is the platform multi-region, and must telemetry stay in region for residency?',
      'What is the cost target: a percentage of infrastructure spend, or an absolute budget?',
    ],
    requirements: {
      functional: [
        'Collect logs, metrics and traces from Kubernetes, VMs and managed services through one standard (OpenTelemetry SDKs and collectors).',
        'Query recent logs by service, time, trace id and free text; query metrics with a PromQL-compatible language; view traces and jump between signals via trace and exemplar links.',
        'Alerting on metrics (SLO burn rates) and log-derived metrics, routed to owning teams.',
        'Tiered retention: hot, warm, archive; legal hold for audit logs.',
        'Per-team quotas, cost showback, and guardrails against cardinality explosions.',
      ],
      nonFunctional: [
        'Ingest available 99.9%+ and decoupled from query: the pipeline must not drop data during incidents when volume spikes 3–5x.',
        'Freshness: logs searchable within ~30 s, metrics within ~1 scrape interval, traces within ~1 min.',
        'Query: recent-window log search p95 under 5 s; dashboard queries under 2 s.',
        'Cost: total observability spend under ~10% of infrastructure spend (a common rule of thumb target).',
        'Security: PII redaction at the edge, per-team access control, immutable audit logs.',
      ],
    },
    estimates: `- **Logs**: 2 TB/day / 86,400 s = **~23 MB/s average**; incident peaks of 3x give ~70 MB/s. At ~500 bytes per line that is ~46k lines/s average, ~140k lines/s peak.
- **Log storage**: typical compression for logs on columnar or chunked storage is ~5–15x; assume 8x, so ~250 GB/day compressed. Hot 7 days on fast storage = ~1.75 TB (x replication factor 2–3 = ~3.5–5 TB). Warm to 30 days in object storage = ~7.5 TB. Archive 1 year of audit/security logs only (say 10% of volume) = ~9 TB in cold object storage.
- **Metrics**: 500 services x ~20 instances x ~1,000 series each = **~10M active series**. At a 30 s scrape that is ~330k samples/s. With compressed TSDB encoding at roughly 1–2 bytes per sample, that is ~30–60 GB/day before downsampling.
- **Traces**: assume 20k req/s at the edge, ~10 spans per request, ~1 KB/span = 200 MB/s unsampled, which is 17 TB/day: more than all the logs. Tail-based sampling keeping errors, slow requests and ~1% of normal traffic brings it to **~3–5 MB/s**, a few hundred GB/day.
- **Buffer**: a Kafka-style buffer sized for 6 h of peak log ingest = 70 MB/s x 21,600 s = ~1.5 TB per replica, ~4.5 TB at replication factor 3.
- **Cost order of magnitude**: object storage at ~$0.02/GB-month for ~20 TB is ~$400/month; the expense is compute for indexing and query, plus the buffer. A self-hosted stack at this scale is plausibly **$30k–80k/month** all-in; a per-GB-ingest commercial tool at list prices is often several times that, which is why volume reduction pays off before anything else.`,
    architecture: `The platform is a **collect, buffer, process, store, query** pipeline per signal, with a common OpenTelemetry front end.

1. **Collection**: services use OpenTelemetry SDKs; a node-level collector (DaemonSet) tails container stdout, receives OTLP, adds Kubernetes metadata (cluster, namespace, pod, team label), and does **first-pass redaction and drop rules**. Metrics are scraped or pushed via OTLP; managed cloud services export via their native log/metric sinks.
2. **Gateway collectors**: a horizontally scaled gateway tier per cluster or region enforces per-team rate limits and quotas, performs tail-based trace sampling (all spans of a trace must reach the same gateway, so route by trace id), and writes to the buffer.
3. **Buffer**: a durable log (Kafka or a managed equivalent: Amazon MSK / Azure Event Hubs / Google Cloud Managed Service for Apache Kafka or Pub/Sub) with topics per signal and team tier. It absorbs incident spikes and decouples ingest from storage outages.
4. **Processing**: stream processors parse, enrich, derive metrics from logs (error counts per service), route audit logs to an immutable store, and route by retention class.
5. **Storage**:
- Logs: a label-indexed, chunk-on-object-storage store (Loki-style) for most logs, or a search index (OpenSearch/Elasticsearch-style) only for the subset needing full-text search; chunks live in object storage.
- Metrics: Prometheus-compatible long-term store with object-storage blocks (Thanos/Mimir/Cortex-style). Where the backend supports downsampling (e.g. the Thanos compactor), keep 5 min resolution after ~2 weeks and 1 h after ~3 months; otherwise use recording rules for long-range aggregates.
- Traces: span store on object storage indexed by trace id, with exemplars linking metrics to traces.
- Archive: compressed Parquet or raw files in cold object storage with lifecycle policies.
6. **Query and alerting**: a query frontend with caching, per-tenant query limits and result-size caps; dashboards; rule evaluation for alerts, separated from ad-hoc query capacity.
7. **Meta-monitoring**: the platform is watched by a small, independent stack (different cluster, minimal dependencies), because it cannot alert on its own death.

\`\`\`
 apps (OTel SDK) -> node collector -> gateway (quota, sampling) -> buffer (Kafka)
                     redact/drop          by trace id               |
                                                    +---------------+-------------+
                                                    v               v             v
                                               log ingesters  metric ingesters  trace ingesters
                                                    \\_______ object storage (hot cache + blocks) ___/
                                                                      |
                                            query frontend / rules / alerting -> on-call
 independent meta-monitoring watches pipeline lag, drops, ingest errors
\`\`\``,
    deepDives: [
      {
        title: 'Cardinality control',
        body: `Metric cost scales with **active series**, and a series is a unique combination of label values. One engineer adding a user_id or request path label to a histogram with 10 buckets across 200 pods can create millions of series in minutes and take down ingesters. Controls, layered:
- **Prevention**: lint instrumentation in CI (no unbounded labels), and an allow-list of labels per metric for high-volume services.
- **Enforcement**: per-team series limits at the gateway and ingesters; reject new series beyond the limit while keeping existing ones flowing, and alert the owning team.
- **Visibility**: a daily top-N report of series by metric and label, attributed to teams; showback of series counts.
- **Redirection**: high-cardinality questions (per-user, per-request) belong in traces or logs, which are priced per event not per series.`,
      },
      {
        title: 'Surviving the incident spike',
        body: `Telemetry volume is correlated with outages: error logs multiply, retries amplify, and engineers start running heavy queries simultaneously. Design for it:
- Buffer sized for hours of peak so storage can fall behind without losing data; alert on consumer lag rather than dropping.
- **Priority classes**: audit and error-level logs in a protected tier; debug-level logs from a misbehaving service are rate-limited first.
- Separate **write path and read path** capacity, so a thundering herd of queries cannot starve ingest; per-user query concurrency limits and query cost estimation reject accidental full-scans.
- Log sampling or deduplication for identical repeated lines (counts instead of copies) at the collector.`,
      },
      {
        title: 'Retention tiers and the cost model',
        body: `Most log reads happen within hours of writing; most stored bytes are never read. So pay for indexing only where it is used:
- **Hot** (1–7 days): fast storage and caches, full query capability.
- **Warm** (to 30 days): object storage with label indexes; slower queries are acceptable.
- **Archive** (to 1–7 years, audit only): object storage cold tiers with rehydration in hours; legal hold via object lock (S3 Object Lock / Azure immutable blob storage / GCS retention policies and bucket lock).
Default retention is short; longer retention is an explicit, charged choice per stream. The biggest single lever is usually **not ingesting** low-value data: debug logs in production, health-check access logs, and duplicate logging of the same event by sidecars and apps.`,
      },
      {
        title: 'Tail-based sampling at scale',
        body: `Head sampling (decide at the root span) is cheap but discards the rare interesting traces. Tail sampling waits until a trace completes, then keeps errors, slow traces and a baseline percentage. The constraint is that all spans of a trace must meet in one place: route spans by trace id hash to a sampling tier, hold traces in memory for a decision window (~10–30 s), and size memory for spans/s x window. Late spans after the decision are dropped or kept by a cached decision. Keep a consistent probability-based baseline so you can still compute rates from sampled data.`,
      },
    ],
    tradeoffs: [
      {
        decision: 'Log storage engine',
        options: 'Full-text inverted index for all logs vs label index plus chunked object storage vs columnar analytics store',
        choice: `**Label-indexed chunks on object storage as the default, full-text index for a small, high-value subset** (security, audit). Full-text indexing everything at 2 TB/day multiplies storage and compute several times; most debugging starts from service, time and trace id. A columnar store (ClickHouse-style) is a strong alternative when teams run aggregations over logs.`,
      },
      {
        decision: 'Build versus buy',
        options: 'Commercial SaaS for everything vs self-hosted open source vs hybrid',
        choice: `**Hybrid with OpenTelemetry as the contract.** Standardising on OTel collectors makes the backend swappable. Self-host high-volume, low-value-per-byte logs and metrics; consider a vendor for APM/tracing UX where engineer time matters more. Self-hosting needs a team of several engineers, which must be in the cost comparison.`,
      },
      {
        decision: 'Buffer between collectors and storage',
        options: 'Direct write from collectors vs durable log buffer',
        choice: `**Durable buffer.** It adds latency (seconds) and an operationally heavy component, but it is what keeps data during storage outages and spikes and allows replay after a bad processor deploy.`,
      },
      {
        decision: 'Where to drop and redact',
        options: 'At the source/collector vs centrally in processing',
        choice: `**As close to the source as possible.** Every byte dropped at the node saves network, buffer and storage, and PII redacted at the node never lands anywhere. Central processing still applies a second, policy-driven redaction pass.`,
      },
      {
        decision: 'Metrics scrape interval',
        options: '10 s vs 30 s vs 60 s',
        choice: `**30 s default, 10 s opt-in for critical SLIs.** Moving from 30 s to 10 s triples samples and storage for marginal benefit on most dashboards; alerting windows are minutes anyway.`,
      },
    ],
    failureModes: [
      {
        failure: 'Cardinality explosion from one deploy',
        mitigation: `Per-team series limits reject new series beyond quota; ingesters stay healthy; the owning team gets an alert naming the metric and label. Existing series and other teams are unaffected.`,
      },
      {
        failure: 'Log storage backend unavailable for an hour',
        mitigation: `Buffer holds hours of peak ingest; consumers resume and catch up at a rate higher than ingest (size consumers for ~2x peak). Alert on lag; query users are told data is delayed, not lost.`,
      },
      {
        failure: 'Runaway query scans 30 days of logs during an incident',
        mitigation: `Query frontend estimates cost and rejects or splits it; per-user concurrency limits; read path is isolated from ingest so writes keep flowing.`,
      },
      {
        failure: 'Collector DaemonSet crash-loops after a config change',
        mitigation: `Roll collector config progressively by cluster; collectors buffer to local disk; the kubelet keeps rotated container log files on node disk so tailing resumes from the last checkpoint, but rotation limits (a few files of ~10 MiB by default) mean chatty pods can lose lines during a long outage.`,
      },
      {
        failure: 'Secrets or PII leak into logs',
        mitigation: `Redaction rules at the collector for known patterns (tokens, card numbers, emails); detection jobs scan stored logs and alert; access to raw log streams is per team; deletion runbook for purging affected chunks.`,
      },
      {
        failure: 'The observability platform itself fails silently',
        mitigation: `Independent meta-monitoring on separate infrastructure tracks end-to-end freshness by injecting synthetic canary log lines and metrics and alerting if they do not appear within the freshness SLO.`,
      },
    ],
    followUps: [
      {
        q: 'How do you cut the bill by 40% next quarter?',
        a: `Measure first: top 20 log streams and metrics by volume per team. Then the usual order of impact: drop debug and health-check logs in production, deduplicate sidecar plus app logging, shorten default hot retention, turn high-cardinality metric labels into trace attributes, tail-sample traces, and downsample old metrics. Showback per team makes the reductions stick.`,
      },
      {
        q: 'Logs, metrics or traces: which do you alert on?',
        a: `Primarily metrics, specifically SLO burn rates on symptoms users feel, because they are cheap to evaluate and stable. Log-derived metrics fill gaps for systems without instrumentation. Traces are for diagnosis, not alerting. Alerting on raw log patterns is brittle and noisy.`,
      },
      {
        q: 'How do you make the platform multi-tenant across 500 services?',
        a: `Tenant equals team: every signal carries a team label injected from namespace metadata at the collector, not trusted from the app. Quotas, retention classes, access control and showback are per tenant. Query isolation through per-tenant limits in the query frontend.`,
      },
      {
        q: 'What SLOs would you set for the observability platform itself?',
        a: `Ingest availability (accepted / sent), end-to-end freshness (p99 time from emit to queryable under 60 s), query availability and latency for the hot window, and alert evaluation delay. Freshness matters most: stale data during an incident is worse than slow queries.`,
      },
    ],
    rubric: [
      {
        area: 'Estimation',
        signals: [
          'Converts 2 TB/day to ~23 MB/s and plans for 3–5x incident peaks.',
          'Estimates active series and recognises traces unsampled can exceed log volume.',
          'Applies compression ratios and tiering to storage estimates.',
        ],
      },
      {
        area: 'Architecture',
        signals: [
          'Uses OpenTelemetry as a vendor-neutral collection contract.',
          'Places a durable buffer between collection and storage.',
          'Separates read and write paths and uses object storage as the durable tier.',
        ],
      },
      {
        area: 'Reliability & failure',
        signals: [
          'Designs for telemetry spikes that coincide with outages.',
          'Adds independent meta-monitoring with synthetic freshness canaries.',
          'Handles cardinality explosion without impacting other tenants.',
        ],
      },
      {
        area: 'Operations & cost',
        signals: [
          'Identifies volume reduction at the source as the biggest cost lever.',
          'Proposes per-team quotas and showback.',
          'Includes team headcount in build versus buy.',
        ],
      },
      {
        area: 'Security',
        signals: [
          'Redacts PII at the collector and controls access per team.',
          'Uses immutable storage for audit logs with legal hold.',
        ],
      },
    ],
    references: [
      { title: 'OpenTelemetry documentation', url: 'https://opentelemetry.io/docs/' },
      { title: 'Google SRE Book: Monitoring Distributed Systems', url: 'https://sre.google/sre-book/monitoring-distributed-systems/' },
      { title: 'Google SRE Workbook: Alerting on SLOs', url: 'https://sre.google/workbook/alerting-on-slos/' },
      { title: 'FinOps Framework', url: 'https://www.finops.org/framework/' },
    ],
  },

  // ---------------------------------------------------------------------------
  // 3. CI/CD platform
  // ---------------------------------------------------------------------------
  {
    id: 'sd-ci-cd-platform',
    title: 'Internal CI/CD and deployment platform for 200 teams',
    difficulty: 'staff',
    topics: ['auto-delivery', 'sec-supply-chain', 'compute-scaling', 'compute-platform', 'arch-finops'],
    prompt: `"We have about 200 engineering teams, a mix of monorepo and polyrepo, deploying to Kubernetes and some serverless. Today every team maintains its own Jenkins and scripts, builds are slow, nobody can tell me what is actually running in production, and the security team is worried after a few public supply-chain attacks. Design an internal CI/CD and deployment platform: build isolation, caching, supply-chain security and progressive delivery."`,
    clarifyingQuestions: [
      'How many engineers, commits and pipeline runs per day, and what is the current median and p95 build time?',
      'Which languages and build systems, and is there a monorepo with a hermetic build tool (Bazel-style) or many repos with heterogeneous tooling?',
      'What are the deployment targets and how many environments (dev, staging, prod, per region)?',
      'What compliance regime applies (SOC 2, PCI, FedRAMP-like): is two-person review and provenance required for production?',
      'Do builds need access to internal networks or secrets, and do any teams build on special hardware (GPUs, macOS, ARM)?',
      'Is the platform a mandate or must it win adoption? What is the migration timeline?',
      'Do we use a hosted SCM (GitHub/GitLab-style) and is a hosted runner offering acceptable, or must runners be in our cloud accounts?',
      'What is the target for deployment frequency and change failure rate?',
    ],
    requirements: {
      functional: [
        'Pipeline-as-code templates (golden paths) teams can extend but not bypass for required controls.',
        'Ephemeral, isolated build runners with autoscaling; remote build cache and dependency proxy.',
        'Artifact registry for images and packages with signing, SBOMs and build provenance attestations.',
        'Admission policy that only signed, provenance-verified artifacts from the platform reach production.',
        'Progressive delivery: canary or blue/green with automated analysis and rollback; GitOps-based deployment state per environment.',
        'Inventory: which commit, image and config is running in every cluster and region.',
      ],
      nonFunctional: [
        'Median CI time under 10 minutes for a typical service; queue time p95 under 1 minute.',
        'Platform availability 99.9% during business hours; deploys must not be blocked for long by platform outages (break-glass path).',
        'Isolation: one team’s build cannot read another team’s secrets or poison shared caches.',
        'Supply chain: aim for SLSA Build Level 3-style properties (hardened, isolated build platform producing non-forgeable provenance).',
        'Cost visibility per team; compute cost per build tracked.',
      ],
    },
    estimates: `- **Load**: 200 teams x ~8 engineers = ~1,600 engineers. ~4 pushes per engineer per day = ~6,400 pipeline runs/day, plus main-branch and scheduled runs, call it **~8k pipelines/day**. Average 6 jobs per pipeline = ~50k jobs/day.
- **Concurrency**: work concentrates in ~8 business hours; 50k jobs / 8 h = ~6k jobs/h average, and the peak hour is ~2x that, ~12k jobs/h. With an average job of 6 minutes, peak concurrency (Little's law) = 12k x 0.1 h = **~1,200 concurrent jobs**; plan for ~2k to absorb release-day and merge-queue bursts.
- **Compute**: at 4 vCPU per job that is ~5–8k vCPU at peak and much less overnight, which suits autoscaled, largely spot/preemptible capacity. ~50k jobs x 6 min x 4 vCPU = ~20k vCPU-hours/day. At an order-of-magnitude ~$0.02–0.04 per vCPU-hour on spot, that is **~$400–800/day**, roughly $12–24k/month; on-demand is ~2–3x.
- **Cache and artifacts**: remote build cache sized ~5–20 TB with LRU eviction; images ~8k builds/day x a few hundred MB of new layers would be large, but layer deduplication keeps net growth to perhaps 100–300 GB/day; retention policies prune untagged images after 30–90 days.
- **Egress**: dependency downloads dominate; a pull-through proxy with ~90% hit ratio cuts external egress and protects against upstream outages.
- **Value**: shaving 5 minutes off 8k pipelines/day saves 40k engineer-minutes of waiting per day if someone waits on each, which dwarfs runner cost. This is the argument for paying for caching and bigger runners.`,
    architecture: `1. **Source and triggers**: the SCM sends webhooks to a pipeline orchestrator (GitHub Actions, GitLab CI, Buildkite, Tekton or similar). Pipelines are defined in repo but must **include platform-owned templates** for build, test, scan, sign and publish; required checks are enforced by branch protection.
2. **Runner fleet**: ephemeral runners, one job per fresh VM or microVM (or a Kubernetes pod in a dedicated, hardened build cluster with sandboxed runtimes), autoscaled from queue depth. Separate pools per trust level: untrusted (forks, PRs), trusted (main branch, release) and privileged (signing). No long-lived runners, no Docker socket sharing.
3. **Identity**: runners get short-lived credentials through OIDC federation with the cloud (AWS IAM roles for OIDC / Azure workload identity federation / GCP Workload Identity Federation), scoped by repo, branch and environment. No static cloud keys in CI secrets.
4. **Caching**: remote build cache (content-addressed) with write access only from trusted main-branch builds, read for everyone; dependency pull-through proxies for language registries and base images; per-pool layer caches.
5. **Supply chain**: builds produce an image, an SBOM, vulnerability scan results and **signed provenance** (who built what, from which commit, with which builder). Signing uses keyless Sigstore-style signing tied to the workload identity, or KMS-held keys. Artifacts land in a registry (ECR / ACR / Artifact Registry) with immutable tags.
6. **Deployment**: the pipeline does not push to clusters. It opens a change to an environment config repo (GitOps); an in-cluster agent (Argo CD / Flux) reconciles. A progressive delivery controller (Argo Rollouts / Flagger) runs canaries with metric analysis against SLOs.
7. **Admission**: cluster admission policy (Kyverno, OPA Gatekeeper or the provider's binary authorization feature) verifies the signature and provenance and rejects unsigned images or images from outside the platform registry.
8. **Inventory and audit**: deployment events and the GitOps repos give a queryable record of what runs where.

\`\`\`
 dev push -> SCM -> orchestrator -> ephemeral runner (OIDC creds, sandbox)
                                       | build/test (remote cache, dep proxy)
                                       | SBOM + scan + sign + provenance
                                       v
                                   registry (immutable) --> env config repo (PR)
                                                               |
                         cluster: GitOps agent -> rollout controller (canary, analysis)
                                  admission policy verifies signature + provenance
\`\`\``,
    deepDives: [
      {
        title: 'Build isolation and trust tiers',
        body: `CI is remote code execution as a service. A pull request from any contributor runs arbitrary code, so:
- **Ephemeral per-job environments**: a fresh VM or microVM (Firecracker-style) or sandboxed pod per job; nothing persists between jobs except through explicit, verified caches.
- **Trust tiers**: PR builds run without secrets and without write access to caches or registries; main-branch builds can publish; signing and production deploy credentials live in a separate, minimal pool.
- **Network egress control**: builds reach the internet only through the dependency proxy, which blocks exfiltration paths and pins what comes in.
- **Credential scoping**: OIDC tokens carry repo, ref and workflow claims so a cloud role trusts only main branch of one repo. A common mistake is trusting the whole organisation in the federation condition.`,
      },
      {
        title: 'Supply-chain security end to end',
        body: `Map controls to where attacks happen: source (compromised account, malicious commit), build (tampered builder, poisoned cache), dependencies (typosquats, compromised packages), and distribution (registry tampering).
- Source: mandatory review, signed commits or verified SCM identity, protected branches.
- Build: platform-owned hardened builders producing provenance the tenant job cannot forge, which is the essence of SLSA Build L3.
- Dependencies: lockfiles, pull-through proxy with allow/deny policy, SBOMs, and continuous scanning so new CVEs against already-deployed images raise alerts.
- Distribution: signatures and attestations verified at admission; immutable tags; deploy by digest.
Prioritise by risk: OIDC instead of static keys and admission verification usually deliver more than perfect SBOM coverage.`,
      },
      {
        title: 'Caching without poisoning',
        body: `A shared cache is a shared attack surface: if a PR build can write a cache entry keyed by an action's inputs, it can plant a malicious artifact for main. Rules: cache entries are content-addressed by hashed inputs; **only trusted builders write**; PR builds read from the trusted cache and write to a per-PR scratch namespace. Hermetic builds make caching correct; non-hermetic steps (network fetches, timestamps) must be excluded or the cache hit rate collapses and correctness suffers. Track hit rate per repo; a falling hit rate is the leading indicator of slower builds.`,
      },
      {
        title: 'Progressive delivery with automated analysis',
        body: `For a typical service: deploy to one region's canary at ~5% of traffic, compare error rate and latency of canary versus baseline (not versus a fixed threshold, because absolute values move with load), bake for 10–30 minutes, then step to 25%, 50%, 100%, region by region. Rollback is automatic on analysis failure. Prerequisites teams forget: backward-compatible database migrations (expand then contract), feature flags to separate deploy from release, and enough traffic in the canary for statistical signal; low-traffic services need longer bakes or synthetic load.`,
      },
    ],
    tradeoffs: [
      {
        decision: 'Runner isolation unit',
        options: 'Long-lived shared VMs vs container per job on shared nodes vs VM/microVM per job',
        choice: `**VM or microVM per job for untrusted and trusted tiers**, accepting ~10–60 s boot overhead (mitigated by warm pools). Containers on shared nodes share a kernel, and privileged Docker-in-Docker builds are effectively host access. Long-lived runners leak state between jobs.`,
      },
      {
        decision: 'Push-based deploys from CI vs GitOps pull',
        options: 'CI holds cluster credentials and applies manifests vs in-cluster agent reconciles from a config repo',
        choice: `**GitOps pull.** CI never holds production cluster credentials, desired state is auditable and diffable, and drift is corrected. Cost: an extra hop and some latency, plus secret handling in Git needs encryption or external secret references.`,
      },
      {
        decision: 'Central templates vs team freedom',
        options: 'Fully standardised pipelines vs fully custom vs required-steps-plus-extension',
        choice: `**Required platform steps with extension points.** Compliance controls (scan, sign, provenance) are non-bypassable; teams customise test stages. A mandate with no flexibility drives shadow pipelines.`,
      },
      {
        decision: 'Hosted runners vs self-hosted in our accounts',
        options: 'Vendor-hosted runners vs self-hosted autoscaled fleet',
        choice: `**Self-hosted for builds needing internal network access or large volume; hosted for public/open-source repos.** Self-hosting gives network control, spot pricing and larger machines but adds an ops burden for the fleet.`,
      },
      {
        decision: 'Blocking on vulnerability scans',
        options: 'Block on any CVE vs block on critical exploitable vs report only',
        choice: `**Block new critical/high vulnerabilities with a fix available in production paths; report the rest with SLAs.** Blocking on everything trains teams to bypass; report-only never fixes anything.`,
      },
    ],
    failureModes: [
      {
        failure: 'Orchestrator or SCM outage blocks all deploys, including an urgent fix',
        mitigation: `Documented break-glass path: an audited, two-person-approved manual promotion of an already-built, signed artifact via the GitOps repo. Rollbacks are a revert in the config repo and do not need CI.`,
      },
      {
        failure: 'Runner fleet cannot scale (spot capacity exhausted)',
        mitigation: `Diversify across instance types and zones, fall back to on-demand for the trusted and release tiers, and keep a small warm pool. Queue time is an SLI with alerts.`,
      },
      {
        failure: 'Poisoned cache or compromised dependency',
        mitigation: `Trusted-writer-only caches, content addressing, proxy allow-lists, SBOM search to find every image containing a bad package within minutes, and the ability to purge cache namespaces.`,
      },
      {
        failure: 'Leaked CI credential',
        mitigation: `Short-lived OIDC tokens limit the window; roles scoped to repo and branch limit blast radius; secret scanning on logs and commits; audit trail of every assume-role.`,
      },
      {
        failure: 'Canary passes, then failure at 100% (load-dependent bug)',
        mitigation: `Step-wise rollout with analysis at each step, region-by-region waves, and quick rollback by revert. Long-tail metrics (memory growth, saturation) included in analysis, not only error rate.`,
      },
      {
        failure: 'Admission policy blocks all deploys after a signing key or policy change',
        mitigation: `Roll policy changes in audit mode first, then enforce per cluster; monitor admission denials; keep a time-boxed emergency exemption controlled by the platform team with audit.`,
      },
    ],
    followUps: [
      {
        q: 'How do you measure whether the platform is succeeding?',
        a: `DORA-style metrics per team (deployment frequency, lead time for changes, change failure rate, time to restore), plus platform SLIs: queue time, median build time, cache hit rate, and adoption percentage. Survey developer satisfaction quarterly. Cost per pipeline run tracked over time.`,
      },
      {
        q: 'How do you migrate 200 teams off their own Jenkins?',
        a: `Start with a few willing teams and make the golden path visibly faster. Provide automated converters for common pipeline shapes, keep a compatibility period, and then make the new admission policy (signed artifacts only) the forcing function for production, with clear dates and office hours. Retire old infrastructure per team, not all at once.`,
      },
      {
        q: 'Monorepo: how do you keep CI time flat as it grows?',
        a: `Build only what changed using a dependency graph (Bazel/Pants/Nx-style affected-target detection), remote caching and remote execution for parallelism, test sharding, and a merge queue that batches commits to keep main green without serialising every PR.`,
      },
      {
        q: 'What does SLSA actually buy you here?',
        a: `A shared vocabulary for build integrity. Build L1 is provenance existing; L2 is signed provenance from a hosted build platform; L3 adds hardened builders where tenant jobs cannot tamper with provenance or each other. The Build track does not by itself cover source review (SLSA's separate, newer Source track addresses that) or dependency trust, so it is one layer, not the whole programme.`,
      },
    ],
    rubric: [
      {
        area: 'Requirements & scoping',
        signals: [
          'Asks about compliance, trust model for contributors and deployment targets before designing.',
          'Defines success with delivery metrics and build/queue SLIs.',
        ],
      },
      {
        area: 'Estimation',
        signals: [
          'Derives peak concurrent jobs from pipelines/day and job duration.',
          'Compares runner cost to engineer waiting time.',
          'Sizes caches and registry growth with retention.',
        ],
      },
      {
        area: 'Architecture',
        signals: [
          'Ephemeral per-job isolation with trust tiers.',
          'GitOps pull-based deployment with progressive delivery controller.',
          'Admission-time verification of signatures and provenance.',
        ],
      },
      {
        area: 'Security',
        signals: [
          'Uses OIDC federation scoped to repo and branch instead of static keys.',
          'Prevents cache poisoning by restricting cache writes to trusted builds.',
          'Maps controls to source, build, dependency and distribution threats.',
        ],
      },
      {
        area: 'Operations & cost',
        signals: [
          'Plans a break-glass deploy path for platform outages.',
          'Uses spot capacity with fallbacks and warm pools.',
          'Has an adoption and migration plan, not just a target state.',
        ],
      },
    ],
    references: [
      { title: 'SLSA: Supply-chain Levels for Software Artifacts', url: 'https://slsa.dev/' },
      { title: 'Sigstore', url: 'https://sigstore.dev/' },
      { title: 'Open Policy Agent documentation', url: 'https://www.openpolicyagent.org/docs/latest/' },
      { title: 'AWS Builders’ Library', url: 'https://aws.amazon.com/builders-library/' },
    ],
  },

  // ---------------------------------------------------------------------------
  // 4. Multi-tenant Kubernetes
  // ---------------------------------------------------------------------------
  {
    id: 'sd-k8s-multitenant',
    title: 'Secure multi-tenant Kubernetes platform',
    difficulty: 'staff',
    topics: ['compute-platform', 'sec-identity', 'net-cloud', 'arch-finops', 'auto-iac'],
    prompt: `"Our platform team runs Kubernetes for about 150 internal product teams, and we are now asked to also run workloads for some external customers who bring their own code. Today it is a handful of big shared clusters with namespaces per team and not much else. Design a secure multi-tenant Kubernetes platform. I want to hear how you decide between namespaces and dedicated clusters, how you enforce policy, how you handle upgrades, and how you allocate cost."`,
    clarifyingQuestions: [
      'Which tenants are trusted (internal teams, same security boundary) and which are untrusted (external customer code)? Is untrusted code expected to be actively hostile?',
      'How many tenants, workloads and nodes, and how fast is it growing?',
      'Do tenants need cluster-scoped resources: CRDs, operators, admission webhooks, cluster roles?',
      'What compliance requirements apply (PCI, HIPAA, customer contracts requiring dedicated infrastructure)?',
      'Do tenants need network isolation from each other and controlled access to shared services or on-prem networks?',
      'What is the upgrade tolerance: can tenants accept a platform-driven upgrade window, and how much do workloads rely on deprecated APIs?',
      'Do we use a managed control plane (EKS/AKS/GKE) or run our own?',
      'Should cost be shown back or charged back, and at what granularity?',
    ],
    requirements: {
      functional: [
        'Self-service tenant onboarding: create namespace(s) or cluster, quotas, RBAC, network policy and identity bindings from a declarative request.',
        'Two isolation tiers: soft multi-tenancy for internal teams, hard isolation for untrusted external workloads.',
        'Central policy enforcement: pod security, image provenance, resource limits, allowed registries, labelling.',
        'Fleet management: provisioning, upgrades and add-on lifecycle for many clusters through GitOps and IaC.',
        'Per-tenant cost allocation including shared overhead.',
      ],
      nonFunctional: [
        'Security: a compromised internal tenant cannot escalate to cluster admin or reach other tenants’ secrets; an untrusted tenant cannot escape to the node or reach other tenants’ network.',
        'Noisy-neighbour control: one tenant cannot exhaust API server, node or network capacity for others.',
        'Upgrades: stay within the supported Kubernetes minor versions, upgrading each cluster at least every few months without tenant downtime.',
        'Platform API availability 99.9%; workload availability depends on tenants spreading across zones.',
        'Cost overhead of the platform under ~15% of tenant compute.',
      ],
    },
    estimates: `- **Fleet**: 150 internal teams averaging ~40 pods = ~6k pods; with ~30 pods per node (well below the default 110 max pods per node, because CPU/memory bind first), that is ~200 nodes. Kubernetes' documented scalability envelope is up to ~5,000 nodes and ~150,000 pods per cluster, so size is not what forces multiple clusters; blast radius, upgrades and isolation are.
- **External tenants**: say 50 customers growing to 500. Cluster-per-tenant at ~3 small nodes plus a managed control plane fee (order of ~$70/month per cluster on standard managed tiers, several times that on extended-support or premium tiers; provider-dependent) costs ~$500–1,500/month per tenant floor; 500 tenants is ~$250k–750k/month before real workload. Virtual clusters or sandboxed node pools reduce the floor substantially.
- **API server load**: each controller, operator and CI system watches the API. 150 teams each running a few operators can be thousands of watches; API priority and fairness and per-tenant client rate limits matter more than node count.
- **IP space**: 6k pods plus headroom with VPC-native pod IPs need a /19 or larger for pods (8k addresses) per cluster; plan CIDRs early, because exhausting pod IP space is a common scaling wall. Size by nodes x per-node allocation, not pod count: many CNIs reserve a block per node (GKE reserves a /24 per node at the default 110 max pods), so 200 nodes can need a /16 of pod range.
- **Cost allocation**: allocate node cost by max(requests, usage) per pod; idle capacity (often 20–40% in poorly tuned clusters) and system overhead are distributed proportionally or charged to the platform budget.`,
    architecture: `The design is a **tiered fleet**: shared clusters with namespace tenancy for trusted internal teams, and hard-isolated capacity for untrusted tenants, all managed as one fleet.

1. **Tenant model**: a tenant is a declarative object in Git (team, cost centre, tier, quotas, allowed namespaces, network exposure). A platform controller or IaC pipeline renders it into namespaces, RBAC RoleBindings, ResourceQuota, LimitRange, NetworkPolicy, cloud identity bindings and cost labels.
2. **Tier 1, soft multi-tenancy (internal)**: a few shared clusters per region and environment. Isolation per namespace: restricted Pod Security Standard enforced by Pod Security Admission, default-deny NetworkPolicy, namespace-scoped RBAC only, per-namespace workload identity (IRSA or EKS Pod Identity / Microsoft Entra Workload ID / Workload Identity Federation for GKE) so pods get only their own cloud permissions, quotas on CPU, memory, pods, services and load balancers.
3. **Tier 2, hard multi-tenancy (untrusted)**: either **cluster per tenant** for high-value or compliance-bound customers, or **dedicated node pools per tenant with sandboxed runtimes** (gVisor or Kata Containers via RuntimeClass), taints and tolerations, no shared nodes, strict egress policy, and no access to the Kubernetes API from tenant pods unless explicitly needed. Where tenants need their own CRDs or admin experience, virtual control planes (vCluster-style) on a host cluster give API-level isolation at lower cost than full clusters.
4. **Policy layer**: admission policies (Kyverno or OPA Gatekeeper, or built-in ValidatingAdmissionPolicy) for allowed registries, signed images, required labels, no hostPath/hostNetwork/privileged, required requests and limits. Policies ship from a central repo in audit mode first, then enforce.
5. **Fleet management**: clusters defined in Terraform or Cluster API; add-ons (CNI, ingress, cert manager, policy engine, observability agents) deployed by GitOps with fleet-wide rollout waves.
6. **Networking**: CNI with NetworkPolicy enforcement, per-tenant ingress hostnames, egress gateways or firewall rules per tier, private endpoints to cloud services.
7. **Cost**: a cost allocation tool (OpenCost/Kubecost-style or provider split-cost features) attributes node cost via labels and namespaces to tenants.

\`\`\`
                   tenant requests (Git) -> platform controller / IaC
                         |                                 |
        Tier 1: shared clusters (internal)        Tier 2: hard isolation (external)
   +-------------------------------------+   +-----------------------------------+
   | ns team-a | ns team-b | ns team-c   |   | cluster-per-tenant (regulated)     |
   | PSA restricted, default-deny netpol |   | or host cluster + virtual CPs,     |
   | quotas, RBAC, workload identity     |   | dedicated node pools, gVisor/Kata  |
   +-------------------------------------+   +-----------------------------------+
        policy engine + GitOps add-ons + cost allocation across the fleet
\`\`\``,
    deepDives: [
      {
        title: 'Namespace vs virtual cluster vs dedicated cluster',
        body: `Choose by trust and by what the tenant needs from the API:
- **Namespace**: cheapest, densest, but shares the kernel (unless sandboxed), the API server, cluster-scoped resources and admission webhooks. Fine for teams inside one company security boundary with good guardrails.
- **Virtual cluster**: each tenant gets its own API server and can install CRDs and cluster roles, while pods are synced to a host namespace. Solves API-level conflicts and admin needs; does not by itself solve node or kernel isolation.
- **Dedicated cluster**: strongest isolation and independent upgrades, simplest compliance story, but per-cluster fixed cost and fleet management overhead scale linearly with tenants.
The senior move is to not pick one: define tiers and let the risk profile choose the tier, with the same tenant API on top.`,
      },
      {
        title: 'Hardening the shared kernel and node',
        body: `Containers on a shared node share the Linux kernel; a kernel exploit or a privileged pod breaks isolation. Layers:
- Enforce the restricted Pod Security Standard: no privileged, no host namespaces, no hostPath, drop capabilities, run as non-root, seccomp RuntimeDefault.
- Sandboxed runtimes (gVisor intercepts syscalls in user space; Kata runs pods in lightweight VMs) for untrusted code, at a CPU and I/O overhead cost.
- Dedicated node pools for untrusted tenants so a node compromise exposes only that tenant.
- Block pod access to the cloud instance metadata endpoint (or require hardened metadata modes) so pods cannot steal node credentials.
- Minimise what the node identity can do; kubelet credentials scoped by the node authorizer.`,
      },
      {
        title: 'Noisy neighbours at every layer',
        body: `Compute: ResourceQuota per namespace plus LimitRange defaults so pods without requests cannot be scheduled carelessly; PriorityClasses so platform components preempt tenants, not the reverse. API server: API Priority and Fairness FlowSchemas map tenant service accounts to a bounded priority level, and fair queuing by user or namespace within that level stops one runaway controller starving others or the platform's own controllers. Network: NetworkPolicy does not limit bandwidth, so bandwidth-heavy tenants go to dedicated pools. Storage: per-namespace PVC and storage quotas. Object counts: quotas on ConfigMaps, Secrets and Services prevent etcd bloat.`,
      },
      {
        title: 'Upgrades across a fleet',
        body: `Kubernetes ships roughly three minor releases a year and the upstream project supports the most recent three minors, so a cluster that is not upgraded for about a year falls out of support. Process: scan for deprecated API usage before each upgrade; upgrade the control plane, then node pools with surge and PodDisruptionBudgets respected; roll in waves (dev clusters, then low-risk prod, then the rest), with bake time. Alternatively replace clusters blue/green for major add-on changes. Tenants own PDBs and multi-replica deployments; the platform publishes upgrade calendars and refuses to be blocked indefinitely by one tenant.`,
      },
    ],
    tradeoffs: [
      {
        decision: 'Isolation model for external, untrusted tenants',
        options: 'Namespace on shared nodes vs dedicated node pools + sandboxed runtime vs virtual clusters vs dedicated clusters',
        choice: `**Dedicated node pools with sandboxed runtimes by default, dedicated clusters for regulated or large customers.** Shared nodes with untrusted code rely on the kernel as the only boundary. Full cluster-per-tenant for every small customer makes fixed cost and fleet toil dominate.`,
      },
      {
        decision: 'Number of internal shared clusters',
        options: 'One giant cluster vs a few per region/environment vs cluster per team',
        choice: `**A few per region and environment**, sized well below scalability limits. One giant cluster concentrates blast radius and makes upgrades terrifying; cluster per team multiplies upgrades and idle capacity.`,
      },
      {
        decision: 'Policy engine',
        options: 'Kyverno vs OPA Gatekeeper vs built-in ValidatingAdmissionPolicy',
        choice: `**Use built-in CEL-based admission policy for simple validations and one engine for mutation and complex rules.** Webhook-based engines are an availability dependency of the API server; run them highly available and decide fail-open versus fail-closed per policy.`,
      },
      {
        decision: 'Cost allocation basis',
        options: 'Allocate by requests vs by actual usage vs by max(requests, usage)',
        choice: `**max(requests, usage)**: requests reserve capacity others cannot use, and usage above requests consumes shared slack. Idle and overhead are reported separately so teams see their efficiency.`,
      },
    ],
    failureModes: [
      {
        failure: 'Container escape from an untrusted tenant pod',
        mitigation: `Sandboxed runtime makes escape reach a sandbox, not the host; dedicated node pool limits exposure to that tenant; minimal node IAM and blocked metadata endpoint prevent lateral movement to the cloud account; runtime threat detection alerts.`,
      },
      {
        failure: 'Policy webhook outage blocks all pod creation',
        mitigation: `Run the policy engine with multiple replicas across zones and PDBs, exclude system namespaces from the webhook, and choose failure policy per rule: fail-closed for security-critical checks in the untrusted tier, fail-open with alerting for hygiene rules.`,
      },
      {
        failure: 'Tenant controller floods the API server',
        mitigation: `API Priority and Fairness isolates the tenant's flow; per-tenant client rate limits; alert on request rate per service account; the platform can scale the offending deployment to zero.`,
      },
      {
        failure: 'Cluster upgrade breaks workloads using removed APIs',
        mitigation: `Pre-upgrade scan of manifests and audit logs for deprecated API use; block upgrades until resolved; upgrade non-prod first; blue/green cluster replacement when risk is high.`,
      },
      {
        failure: 'Pod IP exhaustion stops scaling',
        mitigation: `Plan large pod CIDRs or use overlay/secondary ranges, monitor IP utilisation per subnet, and alert at 70%.`,
      },
      {
        failure: 'Cross-tenant secret access via over-broad RBAC',
        mitigation: `Only namespace-scoped RoleBindings for tenants, generated from templates; periodic RBAC audits; external secret managers with per-tenant cloud identity so even a leaked Kubernetes token does not grant cloud secret access.`,
      },
    ],
    followUps: [
      {
        q: 'Is a namespace a security boundary?',
        a: `On its own, no. It is a scope for RBAC, quotas and policy. Combined with restricted pod security, network policy, per-namespace identity and admission control it is an adequate boundary for mutually trusted internal teams. For hostile tenants you need a stronger boundary underneath: sandboxed runtimes, dedicated nodes or separate clusters.`,
      },
      {
        q: 'A tenant wants to install their own operator with CRDs.',
        a: `CRDs are cluster-scoped and can conflict across tenants, and operators often want cluster-wide permissions. Options: the platform curates and installs the operator once for all tenants, the tenant gets a virtual cluster, or a dedicated cluster. Do not grant cluster-admin in a shared cluster.`,
      },
      {
        q: 'How do you handle 500 clusters operationally?',
        a: `Treat clusters as cattle: declarative definitions, identical add-on bundles versioned together, GitOps fleet rollout in waves, automated conformance tests after each change, and a fleet inventory dashboard showing version skew. Avoid per-cluster snowflake configuration.`,
      },
      {
        q: 'How do you reduce cost on the shared clusters?',
        a: `Right-size requests using usage data, autoscale nodes with bin-packing-friendly settings, consolidate underused nodes, run batch and dev on spot capacity, and show each team its idle percentage. Requests far above usage are the usual largest waste.`,
      },
    ],
    rubric: [
      {
        area: 'Requirements & scoping',
        signals: [
          'Separates trusted from untrusted tenants before choosing an isolation model.',
          'Asks whether tenants need cluster-scoped resources.',
        ],
      },
      {
        area: 'Architecture',
        signals: [
          'Proposes tiers with a common tenant API rather than one model for all.',
          'Lists the concrete isolation controls: PSA restricted, NetworkPolicy default-deny, RBAC, quotas, workload identity.',
          'Knows virtual clusters isolate the API but not the kernel.',
        ],
      },
      {
        area: 'Security',
        signals: [
          'Addresses kernel sharing with sandboxed runtimes or dedicated nodes.',
          'Blocks metadata endpoint credential theft and scopes node identity.',
          'Treats admission webhooks as an availability dependency.',
        ],
      },
      {
        area: 'Operations & cost',
        signals: [
          'Explains the upgrade cadence and the supported-version window.',
          'Plans fleet management with GitOps waves and deprecated API scanning.',
          'Allocates cost by max(requests, usage) and surfaces idle capacity.',
        ],
      },
      {
        area: 'Reliability & failure',
        signals: [
          'Addresses noisy neighbours at API server, compute, network and storage layers.',
          'Mentions IP exhaustion and API priority and fairness.',
        ],
      },
    ],
    references: [
      { title: 'Kubernetes documentation: Multi-tenancy', url: 'https://kubernetes.io/docs/concepts/security/multi-tenancy/' },
      { title: 'Open Policy Agent documentation', url: 'https://www.openpolicyagent.org/docs/latest/' },
      { title: 'CIS Benchmarks', url: 'https://www.cisecurity.org/cis-benchmarks' },
      { title: 'FinOps Framework', url: 'https://www.finops.org/framework/' },
    ],
  },

  // ---------------------------------------------------------------------------
  // 5. Payments disaster recovery
  // ---------------------------------------------------------------------------
  {
    id: 'sd-payments-dr',
    title: 'Disaster recovery for a payments system',
    difficulty: 'staff',
    topics: ['rel-resilience', 'data-databases', 'dist-theory', 'rel-incidents', 'sec-data'],
    prompt: `"We process card and bank payments for merchants, about **2,000 transactions per second at peak**. The core is a ledger database, a payment orchestration service, and integrations to card networks and banks. Regulators and our largest merchants require that we never lose an acknowledged payment and that we are back within **15 minutes** of losing a region. Design the disaster recovery strategy: database, failover, runbooks, and how you test it."`,
    clarifyingQuestions: [
      'Does RPO zero apply to everything or only to acknowledged ledger entries and payment state? Can analytics, reporting and notifications lag?',
      'Is the RTO 15 minutes for full service, or for accepting new authorisations while some functions (refunds, reporting) come later?',
      'Where are the external dependencies: are card network and bank connections reachable from both regions, with separate circuits and credentials?',
      'What is the current database (single-primary relational, distributed SQL) and what write latency budget does the authorisation path have?',
      'Which disasters are in scope: region loss, data corruption, ransomware, bad deploy, cloud account compromise, provider-wide failure?',
      'Are there regulatory constraints on where data and keys live (PCI DSS scope, data residency)?',
      'How often are we allowed to perform live failovers in production?',
    ],
    requirements: {
      functional: [
        'Authorise, capture, refund and settle payments with an append-only double-entry ledger.',
        'Every acknowledged payment is durable in at least two regions (or a quorum spanning regions) before the client receives success.',
        'Resume accepting payments in a surviving region within 15 minutes of a regional loss.',
        'Exactly-once effect toward merchants and external networks through idempotency keys and reconciliation.',
        'Recover from logical corruption (bad migration, bug, malicious deletion) to a point in time.',
      ],
      nonFunctional: [
        'RPO ≈ 0 for acknowledged ledger writes; RTO ≤ 15 min for authorisation; RTO of hours acceptable for reporting.',
        'Authorisation p99 latency budget under ~500 ms end to end, including network calls.',
        'Availability 99.99%+ for authorisations.',
        'PCI DSS-aligned controls: encryption, key management, segregation, audited access.',
        'DR plan tested regularly with measured RTO/RPO; evidence retained for auditors.',
      ],
    },
    estimates: `- **Write rate**: 2,000 TPS peak; each payment produces ~3–5 ledger rows plus state transitions, so **~6–10k row writes/s** at peak, roughly 2–4k database transactions/s if each payment step commits its rows in one transaction.
- **Data volume**: ~2 KB per payment including ledger rows and indexes x average ~600 TPS x 86,400 s = **~100 GB/day**, ~36 TB/year before archiving.
- **Replication bandwidth**: 2,000 TPS x 2 KB x 2–3x WAL overhead = ~10 MB/s peak per replica stream; trivial for inter-region links.
- **Synchronous latency cost**: a commit that must be acknowledged by a replica in another region adds at least one inter-region round trip: ~5–15 ms between nearby regions in the same geography, ~60–100 ms+ across a continent, order of magnitude. Within a ~500 ms authorisation budget dominated by network calls to card networks, a ~10 ms commit penalty is acceptable; 80 ms across an ocean on every write is not.
- **RTO budget**: detection 2–3 min, decision 2 min, database promotion or quorum re-election under 1 min, traffic shift 2–3 min, external connectivity checks 2–3 min, leaving ~3–5 min slack in 15 minutes. Anything requiring provisioning (scaling up compute, issuing certificates) during the event breaks the budget.
- **Cost**: a full hot standby region with pre-scaled compute roughly doubles compute and database spend; a three-region quorum adds a third copy of storage. For a payments company this is typically small against what is at risk: 15 minutes down at a 2,000 TPS peak x an assumed average $50 ticket is ~$90M of payment volume not processed. At an assumed take rate well under 1% the direct fee revenue lost is under ~$1M, but merchant churn, contractual penalties and regulatory consequences usually dominate.`,
    architecture: `The core idea: **acknowledge a payment only after it is durable across failure domains that include another region**, and keep everything needed to resume pre-provisioned in that region.

1. **Regions**: two primary regions close together within the same geography (e.g. ~10 ms apart) plus a third region or a lightweight witness for quorum. Each region has a full, pre-scaled stack: API gateway, orchestration, ledger service, HSM/KMS access, and its own connections to card networks and bank partners.
2. **Ledger database**, two viable options:
- **Option A, distributed SQL with consensus** (Spanner multi-region configurations, CockroachDB, YugabyteDB or similar): replicas in three regions, Raft/Paxos majority commit. Loss of one region keeps a majority; leaders re-elect in seconds; RPO 0 by construction.
- **Option B, relational primary with synchronous cross-region standby**: e.g. PostgreSQL synchronous replication (synchronous_commit with a standby in region B), plus asynchronous replicas for reads. RPO 0 only while the synchronous standby is attached; you must decide what happens when it is not. PostgreSQL itself blocks commits when no listed synchronous standby is available; the silent downgrade usually comes from an HA manager or an operator editing synchronous_standby_names (Patroni, for example, needs synchronous_mode_strict to keep blocking).
3. **Payment state machine**: every payment has an idempotency key from the merchant and an internal payment id. The orchestrator writes intent before calling the card network and records the outcome after, so recovery can resume or reconcile every in-flight payment.
4. **Outbox and events**: state changes are written with an outbox row in the same transaction; a relay publishes to a replicated event log for downstream consumers (notifications, reporting), which can lag and replay.
5. **Traffic**: merchants hit a global endpoint with health-based routing; the payment API is active in one region per merchant shard or active-active over the consensus database.
6. **Backups for corruption**: continuous WAL/changelog archiving and point-in-time recovery to an isolated, separately-credentialed backup account with immutability; replication does not protect against logical corruption, because it replicates the corruption.
7. **Control and runbooks**: a DR controller exposes declared, audited actions (fence region, promote, shift traffic, verify external links) used by on-call.

\`\`\`
 merchants -> global endpoint (health-routed)
                |                         |
         Region A (active)          Region B (active/hot)        Region C (witness/replica)
         API, orchestrator          API, orchestrator             ledger replica / voter
         ledger replica (voter) <==== consensus / sync commit ====> ledger replica (voter)
         network + bank links       network + bank links
                \\________ outbox -> replicated event log -> reporting, notifications
 isolated backup account: PITR archive, object lock, separate credentials
\`\`\``,
    deepDives: [
      {
        title: 'What RPO zero really requires',
        body: `RPO 0 means the client is told "success" only after the write survives the loss of the primary failure domain. With asynchronous replication the window between commit and replication is lost on region failure, so it cannot be zero. Two ways to get it: majority consensus across three regions, or a synchronous standby. With synchronous replication, the hard question is **degraded mode**: if region B's standby becomes unreachable, either the primary stops accepting writes (availability hit, RPO preserved) or it continues alone (availability preserved, RPO zero silently lost). For payments, write it down: either block, or continue only after automatically attaching another synchronous standby in a different region, never silently downgrade. Consensus with three voters handles this naturally because any two can commit.`,
      },
      {
        title: 'In-flight payments and external side effects',
        body: `The database can be perfect and you can still double-charge. A payment sent to the card network just before the region died has an unknown outcome. Design:
- Persist the intent before the external call, with a unique idempotency reference passed to the network or acquirer where supported.
- On failover, the recovering region scans payments in an in-flight state and resolves each by querying the network/acquirer status or reconciling against settlement files, rather than retrying blindly.
- Merchant retries use the same idempotency key and get the stored result, not a second charge.
- Daily reconciliation against network and bank settlement files is the final backstop that catches anything the system state got wrong.`,
      },
      {
        title: 'Failover runbook and decision rights',
        body: `A 15-minute RTO fails on hesitation more often than on technology. The runbook should be short, rehearsed and tool-driven:
1. Declare incident; incident commander confirms regional impairment from independent signals (synthetic transactions failing from multiple vantage points, provider health, database health).
2. Decide using pre-agreed criteria (for example, authorisation success below threshold for 3 minutes and not recovering) so no executive approval is needed in the moment.
3. Fence region A: block writes and revoke its database lease and external-link credentials.
4. Confirm the ledger in region B is leader/promoted and caught up (for consensus, verify quorum; for sync replication, you cannot query a dead primary, so confirm from replication monitoring that the standby was in synchronous state up to the failure; if it had dropped out, the RPO-0 guarantee no longer holds and the decision changes).
5. Shift traffic and verify external connectivity with test authorisations.
6. Run in-flight reconciliation; communicate to merchants.
Each step has a single command, a verification signal and a timer.`,
      },
      {
        title: 'Testing DR so it actually works',
        body: `Untested DR is a hope. Layers: automated per-component failover tests in staging weekly; production **game days** quarterly where a region is really drained under live traffic during a low-volume window; restore drills from the isolated backups monthly, measured by time to a verified, consistent ledger; chaos experiments for partial failures (one AZ, elevated latency to the standby, network link loss). Measure achieved RTO and RPO each time and file postmortems on misses. Auditors want evidence; engineers want the muscle memory.`,
      },
      {
        title: 'Corruption, ransomware and account compromise',
        body: `Cross-region replication copies bad writes and deletes instantly, so it protects against infrastructure loss only. For logical disasters: point-in-time recovery from continuously archived logs, kept in a separate cloud account or project with separate credentials and object lock so an attacker with production admin cannot delete them; delayed replicas (lagging an hour) for fast rollback of bad migrations; and ledger-level invariants (debits equal credits, balances reconcile) checked continuously so corruption is detected in minutes, not at month end.`,
      },
    ],
    tradeoffs: [
      {
        decision: 'Ledger database strategy',
        options: 'Distributed SQL with three-region consensus vs relational primary with synchronous cross-region standby vs async replication with reconciliation',
        choice: `**Three-region consensus if the team can operate it, otherwise synchronous standby with an explicit block-on-loss policy.** Consensus gives RPO 0 and automatic leader election without split-brain risk, at the cost of write latency to a quorum and a newer operational model. Async with reconciliation from network files can recover money movements but cannot honestly claim RPO 0.`,
      },
      {
        decision: 'Region placement',
        options: 'Nearby regions in one geography vs distant regions on different continents',
        choice: `**Nearby regions for the synchronous quorum** (single-digit to low tens of milliseconds), plus an asynchronous copy farther away for geographic disasters with an RPO of seconds. Synchronous writes across an ocean blow the latency budget.`,
      },
      {
        decision: 'Active-active vs active-hot-standby for the application tier',
        options: 'Both regions serve payments vs one serves and one is hot standby',
        choice: `**Active-active stateless tier over the consensus database**, or active-hot standby that takes a small share of real traffic. Either way the standby proves its external connectivity daily; a standby that never processes a real authorisation will fail on credentials or allow-listed IPs on the day it matters.`,
      },
      {
        decision: 'Automatic vs human-initiated failover',
        options: 'Database auto-failover vs one-command human decision with pre-agreed criteria',
        choice: `**Consensus re-election is automatic for the database; the regional traffic shift and fencing of external links is a single human-approved command.** The 15-minute RTO leaves room for a human decision and avoids flapping on grey failures.`,
      },
    ],
    failureModes: [
      {
        failure: 'Complete loss of the active region',
        mitigation: `Consensus keeps a majority in the other two regions and elects a new leader; runbook shifts traffic and fences region A's external links; in-flight payments reconciled via network status queries; RTO measured against 15 minutes.`,
      },
      {
        failure: 'Synchronous standby unreachable (link or region B impaired)',
        mitigation: `Pre-defined policy: automatically attach a synchronous standby in the third region, or pause writes. Never silently fall back to async. Alert immediately because the system is one failure away from data loss or downtime.`,
      },
      {
        failure: 'Logical corruption from a bad migration replicated everywhere',
        mitigation: `Ledger invariant checks detect it; stop writes on affected tables; point-in-time restore to an isolated environment and replay valid transactions from the outbox and event log; delayed replica as a fast path.`,
      },
      {
        failure: 'Ransomware or compromised admin credentials deleting backups',
        mitigation: `Backups in a separate account with independent credentials, object lock in compliance mode, and break-glass access requiring multiple approvers. Restore drills prove the backups are usable.`,
      },
      {
        failure: 'Failover succeeds but card network connections fail from region B',
        mitigation: `Each region has its own pre-established, continuously exercised connections, certificates and allow-listed IPs with the networks and acquirers; synthetic authorisations run from both regions continuously.`,
      },
      {
        failure: 'Split brain: old region recovers and accepts writes',
        mitigation: `Consensus prevents two leaders by design; for sync replication, fencing via lease and credential revocation before promotion. Merchant-facing endpoints in the fenced region return retriable errors.`,
      },
      {
        failure: 'Duplicate charges from merchant retries during the failover',
        mitigation: `Idempotency keys persisted in the replicated ledger, so a retry in region B finds the original result; responses are deterministic for the same key.`,
      },
    ],
    followUps: [
      {
        q: 'What happens to the latency of every payment with three-region consensus?',
        a: `Each commit waits for the leader plus one other voter, so latency is roughly one round trip to the nearest other region plus fsync, around 5–20 ms with nearby regions, order of magnitude. Place the leader (or leaseholder) in the region serving the traffic and keep the voters close. Reads can be served locally from the leader or with bounded staleness where acceptable.`,
      },
      {
        q: 'The provider has a multi-region outage of a shared control plane. Now what?',
        a: `Design data planes that run without control-plane calls (static stability). For the worst case, some payments firms keep a cross-provider or on-premises fallback for authorisations only, with reduced features and store-and-forward to the main ledger. It is expensive; justify it with the regulator's requirements and revenue at risk.`,
      },
      {
        q: 'How do you convince auditors the DR plan works?',
        a: `Evidence: scheduled game day reports with measured RTO/RPO, restore drill logs with integrity checks, runbook versions with change history, access logs for break-glass, and postmortems with completed action items. A plan document alone is not evidence.`,
      },
      {
        q: 'Where do encryption keys live, and what if KMS in a region fails?',
        a: `Keys must be usable from every region that may serve traffic: multi-region keys or replicated key material in each region's KMS/HSM, with key policies identical across regions. Test decryption in the standby region continuously; an unusable key is an outage as complete as a lost database.`,
      },
      {
        q: 'Could you meet the goal with only async replication?',
        a: `Not honestly for RPO 0. You could reduce loss to seconds and then rebuild missing ledger entries from the card network and bank records, but that turns a technical failover into a reconciliation project with merchant-visible inconsistencies. It might be acceptable for non-ledger data like notifications and reporting.`,
      },
    ],
    rubric: [
      {
        area: 'Requirements & scoping',
        signals: [
          'Clarifies that RPO 0 applies to acknowledged ledger writes and lets reporting lag.',
          'Includes logical corruption and account compromise in the disaster scope, not only region loss.',
        ],
      },
      {
        area: 'Estimation',
        signals: [
          'Quantifies the synchronous commit latency penalty versus the authorisation budget.',
          'Breaks the 15-minute RTO into detection, decision, execution and verification.',
          'Estimates revenue at risk to justify cost.',
        ],
      },
      {
        area: 'Architecture',
        signals: [
          'Chooses consensus across three regions or synchronous standby and explains degraded-mode behaviour.',
          'Uses idempotency keys, intent records and an outbox for exactly-once effects.',
          'Pre-provisions external connectivity and keys in every region.',
        ],
      },
      {
        area: 'Reliability & failure',
        signals: [
          'Handles in-flight payments with unknown outcomes via status query and reconciliation.',
          'Prevents split brain with fencing or consensus.',
          'Separates replication (infrastructure loss) from backups (logical loss) with immutable, isolated backups.',
        ],
      },
      {
        area: 'Operations',
        signals: [
          'Writes a short, tool-driven runbook with pre-agreed decision criteria.',
          'Tests through game days and restore drills with measured RTO/RPO.',
          'Produces audit evidence.',
        ],
      },
      {
        area: 'Communication',
        signals: [
          'States trade-offs plainly (for example, block writes rather than silently lose RPO 0).',
          'Uses order-of-magnitude numbers instead of vague claims.',
        ],
      },
    ],
    references: [
      { title: 'PostgreSQL documentation: High Availability, Load Balancing, and Replication', url: 'https://www.postgresql.org/docs/current/high-availability.html' },
      { title: 'Raft consensus algorithm', url: 'https://raft.github.io/' },
      { title: 'AWS Builders’ Library: Making retries safe with idempotent APIs', url: 'https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/' },
      { title: 'Principles of Chaos Engineering', url: 'https://principlesofchaos.org/' },
    ],
  },
];
