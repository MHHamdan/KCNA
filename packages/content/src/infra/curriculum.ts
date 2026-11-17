import type { InfraDomain, InfraTopic, InfraTopicId, Reference } from '../types';

/**
 * Cloud Infrastructure — Senior Interview Prep.
 * Built around the cloud providers' Well-Architected frameworks (AWS: 6 pillars,
 * Google Cloud: 6 pillars, Azure: 5 pillars), Google's SRE books, the AWS
 * Builders' Library and NIST cloud/zero-trust publications. Verified 2026-11-17.
 */
export const INFRA_VERIFIED_AT = '2026-11-17';

export const INFRA_DOMAINS: InfraDomain[] = [
  { id: 'networking', name: 'Networking & Edge', importance: 'core', summary: 'TCP/IP, DNS, TLS and HTTP; VPC and hybrid network design; load balancing, CDN and global traffic.', topics: ['net-fundamentals', 'net-cloud', 'net-edge'] },
  { id: 'compute', name: 'Compute & Platforms', importance: 'high', summary: 'VMs, containers and serverless; autoscaling and capacity; Kubernetes as a multi-tenant platform.', topics: ['compute-models', 'compute-scaling', 'compute-platform'] },
  { id: 'storage-data', name: 'Storage & Data', importance: 'core', summary: 'Block, file and object storage; databases, replication and sharding; caching.', topics: ['storage-types', 'data-databases', 'data-caching'] },
  { id: 'distributed', name: 'Distributed Systems', importance: 'core', summary: 'Consistency, consensus and failure; resilience patterns; queues and streams.', topics: ['dist-theory', 'dist-patterns', 'dist-messaging'] },
  { id: 'reliability', name: 'Reliability & SRE', importance: 'core', summary: 'SLIs, SLOs and error budgets; incident response and postmortems; multi-AZ/region and disaster recovery.', topics: ['rel-slo', 'rel-incidents', 'rel-resilience'] },
  { id: 'security', name: 'Security & Identity', importance: 'high', summary: 'IAM and zero trust; encryption, KMS and secrets; software supply chain and compliance.', topics: ['sec-identity', 'sec-data', 'sec-supply-chain'] },
  { id: 'automation', name: 'Automation & Delivery', importance: 'high', summary: 'Infrastructure as code with Terraform; CI/CD, deployment strategies and GitOps.', topics: ['auto-iac', 'auto-delivery'] },
  { id: 'observability', name: 'Observability & Performance', importance: 'high', summary: 'Signals, alerting and on-call hygiene; Linux and latency troubleshooting.', topics: ['obs-signals', 'obs-performance'] },
  { id: 'architecture-cost', name: 'Architecture & Cost', importance: 'medium', summary: 'Well-Architected trade-offs, migrations and multi-cloud; FinOps and cost engineering.', topics: ['arch-frameworks', 'arch-finops'] },
  { id: 'interview-craft', name: 'Interview Craft', importance: 'core', summary: 'A repeatable system-design method; senior behavioural stories that show scope and judgement.', topics: ['craft-system-design', 'craft-behavioral'] },
];

export const INFRA_TOPICS: InfraTopic[] = [
  { id: 'net-fundamentals', domain: 'networking', name: 'Network fundamentals', description: 'OSI vs TCP/IP, TCP handshake and congestion, UDP, DNS resolution and TTLs, TLS 1.3, HTTP/1.1 vs 2 vs 3 (QUIC).' },
  { id: 'net-cloud', domain: 'networking', name: 'Cloud network design', description: 'VPC/VNet, CIDR planning, subnets and route tables, NAT, security groups vs NACLs, peering, transit hubs, private endpoints, VPN and dedicated interconnects.' },
  { id: 'net-edge', domain: 'networking', name: 'Load balancing & edge', description: 'L4 vs L7 load balancing, health checks, connection draining, CDN caching, anycast, global DNS-based traffic management, WAF and DDoS protection.' },
  { id: 'compute-models', domain: 'compute', name: 'Compute models', description: 'VMs, containers, serverless functions and their trade-offs; instance families; spot/preemptible capacity; immutable infrastructure.' },
  { id: 'compute-scaling', domain: 'compute', name: 'Scaling & capacity', description: 'Horizontal vs vertical scaling, autoscaling signals and lag, warm pools, capacity planning, load testing, bin packing.' },
  { id: 'compute-platform', domain: 'compute', name: 'Kubernetes as a platform', description: 'Multi-tenancy and isolation, cluster topology, upgrades, node pools, platform engineering and golden paths.' },
  { id: 'storage-types', domain: 'storage-data', name: 'Storage types & durability', description: 'Block vs file vs object storage, durability vs availability, replication, storage classes and lifecycle, snapshots.' },
  { id: 'data-databases', domain: 'storage-data', name: 'Databases at scale', description: 'Relational vs NoSQL, replication (sync/async), read replicas, partitioning and sharding, schema migrations, connection management.' },
  { id: 'data-caching', domain: 'storage-data', name: 'Caching', description: 'Cache-aside, write-through and write-back, TTLs and invalidation, stampedes, hot keys, cache tiers from CDN to in-process.' },
  { id: 'dist-theory', domain: 'distributed', name: 'Distributed systems theory', description: 'CAP and PACELC, consistency models, consensus (Raft/Paxos), quorums, clocks and ordering, failure detection.' },
  { id: 'dist-patterns', domain: 'distributed', name: 'Resilience patterns', description: 'Timeouts, retries with exponential backoff and jitter, idempotency keys, circuit breakers, bulkheads, rate limiting, load shedding, backpressure.' },
  { id: 'dist-messaging', domain: 'distributed', name: 'Queues & streams', description: 'Message queues vs logs/streams, delivery semantics, ordering and partitions, consumer groups, dead-letter queues, outbox pattern.' },
  { id: 'rel-slo', domain: 'reliability', name: 'SLIs, SLOs & error budgets', description: 'Choosing SLIs, setting SLOs, error budget policy, burn-rate alerting, availability arithmetic.' },
  { id: 'rel-incidents', domain: 'reliability', name: 'Incidents & on-call', description: 'Incident command, severity levels, communication, mitigation before root cause, blameless postmortems, toil reduction.' },
  { id: 'rel-resilience', domain: 'reliability', name: 'High availability & DR', description: 'Failure domains, multi-AZ and multi-region (active-active vs active-passive), RPO/RTO, backup and restore testing, cell-based architecture, chaos engineering.' },
  { id: 'sec-identity', domain: 'security', name: 'Identity & zero trust', description: 'IAM roles and policies, least privilege, federation and SSO, workload identity, short-lived credentials, zero-trust architecture.' },
  { id: 'sec-data', domain: 'security', name: 'Encryption & secrets', description: 'Encryption in transit and at rest, KMS and envelope encryption, key rotation, secrets management, mTLS, network segmentation.' },
  { id: 'sec-supply-chain', domain: 'security', name: 'Supply chain & compliance', description: 'Shared responsibility, SLSA and provenance, SBOMs, image signing, vulnerability management, policy guardrails, audit and compliance.' },
  { id: 'auto-iac', domain: 'automation', name: 'Infrastructure as code', description: 'Declarative IaC, Terraform state and locking, modules, drift, environments, policy as code, blast-radius control.' },
  { id: 'auto-delivery', domain: 'automation', name: 'CI/CD & release safety', description: 'Pipelines, artifact promotion, blue/green, canary, feature flags, progressive delivery, GitOps, rollback strategy.' },
  { id: 'obs-signals', domain: 'observability', name: 'Signals & alerting', description: 'Metrics, logs, traces and profiles; the four golden signals; RED and USE; symptom-based alerting; cardinality and cost.' },
  { id: 'obs-performance', domain: 'observability', name: 'Performance troubleshooting', description: 'Tail latency, Linux performance tools and the USE method, saturation, Little\'s law, queueing intuition.' },
  { id: 'arch-frameworks', domain: 'architecture-cost', name: 'Well-Architected trade-offs', description: 'Well-Architected pillars across AWS, Azure and Google Cloud, migration strategies, multi-region and multi-cloud decisions, build vs buy.' },
  { id: 'arch-finops', domain: 'architecture-cost', name: 'FinOps & cost engineering', description: 'Cost drivers (compute, storage, egress), commitments and spot, unit economics, tagging and showback, the FinOps lifecycle.' },
  { id: 'craft-system-design', domain: 'interview-craft', name: 'System design method', description: 'Clarify, estimate, design, deep-dive, evaluate trade-offs and failure modes — out loud, in 45 minutes.' },
  { id: 'craft-behavioral', domain: 'interview-craft', name: 'Senior behavioural interviews', description: 'STAR stories that show ownership, scope, influence without authority, judgement under ambiguity and learning from failure.' },
];

export const infraTopicById = (id: InfraTopicId) => INFRA_TOPICS.find((t) => t.id === id)!;

/** Reference library roots used across the track (all checked by npm run check:links). */
export const INFRA_CORE_REFERENCES: Reference[] = [
  { title: 'AWS Well-Architected Framework', url: 'https://aws.amazon.com/architecture/well-architected/' },
  { title: 'Azure Well-Architected Framework', url: 'https://learn.microsoft.com/en-us/azure/well-architected/' },
  { title: 'Google Cloud Well-Architected Framework', url: 'https://cloud.google.com/architecture/framework' },
  { title: 'Google SRE book (free online)', url: 'https://sre.google/sre-book/table-of-contents/' },
  { title: 'Google SRE workbook (free online)', url: 'https://sre.google/workbook/table-of-contents/' },
  { title: "AWS Builders' Library", url: 'https://aws.amazon.com/builders-library/' },
  { title: 'NIST SP 800-145: The NIST Definition of Cloud Computing', url: 'https://csrc.nist.gov/pubs/sp/800/145/final' },
  { title: 'NIST SP 800-207: Zero Trust Architecture', url: 'https://csrc.nist.gov/pubs/sp/800/207/final' },
  { title: 'The System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' },
];
