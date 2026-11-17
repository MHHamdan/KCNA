# Cloud Infrastructure — Senior Interview Prep track

A standalone track inside the app (`#/infra`) for senior and staff **cloud infrastructure, platform, SRE and DevOps** interviews. It is vendor-neutral, and names AWS, Azure and Google Cloud equivalents where they matter. Its progress and readiness are kept separate from KCNA.

## What senior interviews test, and how the track covers it

| Interview round | What interviewers score | Track feature |
|---|---|---|
| Technical deep dives | Mechanisms, trade-offs, failure modes, numbers | 26 lessons, each with an **Interview angle** (how a senior answers, common follow-ups with model answers, red flags, numbers to know) |
| Knowledge screens | Breadth and judgement | 152 scenario and trade-off questions with per-option rationale |
| System design | Scoping, estimation, architecture, reliability, security, operations and cost, communication | 10 design cases with a timer, your own written design, a reference answer, trade-offs, failure modes, follow-ups and a **grading rubric** |
| Behavioural | Ownership, scope, influence, judgement under ambiguity, learning from failure | 14 prompts with scoring signals, structure guidance, pitfalls, and your own STAR story bank |
| All of the above, live | Thinking out loud under follow-up pressure | AI **mock interviewer** mode: one question at a time, probing follow-ups, then scored feedback against the rubric |

## Curriculum

10 domains and 26 topics (`packages/content/src/infra/curriculum.ts`):

- **Networking & Edge** (core): fundamentals (TCP/TLS/QUIC/DNS/HTTP), cloud network design (VPC, CIDR, NAT, peering, transit, private and hybrid connectivity), load balancing and edge (L4/L7, CDN, anycast, global traffic, WAF/DDoS).
- **Compute & Platforms**: compute models, scaling and capacity, Kubernetes as a multi-tenant platform.
- **Storage & Data** (core): storage types and durability, databases at scale, caching.
- **Distributed Systems** (core): theory (CAP/PACELC, consistency, consensus, clocks), resilience patterns (timeouts, retries with jitter, idempotency, circuit breakers, load shedding), queues and streams.
- **Reliability & SRE** (core): SLIs, SLOs and error budgets; incidents and on-call; high availability and DR (RPO/RTO, multi-region, cells, chaos).
- **Security & Identity**: IAM and zero trust; encryption, KMS and secrets; supply chain and compliance (SLSA, SBOM, signing, shared responsibility).
- **Automation & Delivery**: Terraform and IaC; CI/CD and release safety.
- **Observability & Performance**: signals and alerting; performance troubleshooting (tail latency, USE, Little's law, Linux tools).
- **Architecture & Cost**: Well-Architected trade-offs (AWS 6, Azure 5 and Google Cloud 6 pillars), migrations, multi-cloud; FinOps.
- **Interview Craft** (core): system design method; senior behavioural interviews.

## Sources

Content is anchored to:

- **Cloud frameworks:** the AWS, Azure and Google Cloud Well-Architected Frameworks; Azure Architecture Center patterns.
- **Reliability engineering:** Google's *Site Reliability Engineering* book and *Site Reliability Workbook*; the AWS Builders' Library.
- **Standards and specifications:** NIST SP 800-145 (cloud computing definition) and 800-207 (zero trust); IETF RFCs for TCP, TLS 1.3, QUIC, HTTP/3, DNS and private addressing; SLSA and Sigstore; the FinOps Foundation framework.
- **Tooling and practice:** Terraform docs; Brendan Gregg's USE method and Linux performance material; *High Performance Browser Networking*; the System Design Primer.

The reading list is at `#/infra/resources`. `npm run check:links` verifies every URL.

## Quality process

1. Authors wrote to a schema enforced by TypeScript and `packages/content/test/infra.test.ts`. Every lesson must have an interview angle and a knowledge check; every question needs a single defensible answer and a rationale for each option; every design case needs all sections and a gradeable rubric.
2. A separate reviewer re-checked every file. Reviewers solved each question blind before reading the key, recomputed every numeric item, and made uncertain provider-specific facts generic or marked them approximate.
3. Prices and limits are illustrative orders of magnitude. Interviewers care that you reason with numbers, not that you quote a price sheet.

## Interview readiness (`computeInfraReadiness`)

`index = 100 × (0.40·knowledge + 0.10·coverage + 0.25·design + 0.10·stories + 0.15·mocks)`

| Component | Definition |
|---|---|
| knowledge | Conservative topic mastery (same Bayesian lower bound as KCNA), averaged per domain, with domains weighted core 3 / high 2 / medium 1 |
| coverage | Share of topics with at least 5 distinct questions answered |
| design | Solid designs / 6. A design is solid when you self-certify at least 70% of its rubric signals |
| stories | STAR stories of 80+ words / 8 |
| mocks | Completed AI mock interviews (ended with feedback) / 4 |

"Interview-ready" requires an index of at least 75, every core technical domain at 70% or more, 6 solid designs and 4 mocks. Quiz accuracy alone can never reach it. Like the KCNA indicator, this is a preparation heuristic, not a prediction of an offer.

## Privacy

Your designs, stories and mock counts stay in your browser (export/import covers them). Text is sent to the tutor only when you press an AI button, capped at 6,000 characters.
