import type { InfraLesson } from '../types';

export const infraLessons3: InfraLesson[] = [
  // ───────────────────────────── Stage 6 · Automation & Delivery ────────────────────────────
  {
    id: 'infra-auto-iac',
    title: 'Infrastructure as code: state, blast radius and policy',
    stage: 6,
    order: 1,
    objectives: ['auto-iac'],
    scope: 'senior',
    estMinutes: 30,
    summary:
      'Declarative IaC turns infrastructure into reviewed diffs. The hard parts are not syntax: they are state ownership, locking, blast radius, drift, secrets and guardrails that scale to many teams.',
    what: `Infrastructure as code (IaC) describes the **desired state** of infrastructure in versioned files and lets a tool compute and apply the difference against reality. Terraform (and its open-source fork OpenTofu) is the reference model most interviews assume:

- **Configuration** – HCL files declaring resources, data sources, variables and outputs.
- **State** – a JSON document mapping every declared resource address (\`aws_s3_bucket.logs\`) to the real object ID and its last-known attributes.
- **Plan** – refresh state from provider APIs, diff it against configuration, and produce an ordered set of create / update / replace / destroy actions.
- **Apply** – execute that plan through provider APIs, walking the dependency graph in parallel, then write the new state.

Cloud-native alternatives (CloudFormation on AWS, Bicep/ARM on Azure, Infrastructure Manager / Config Connector on Google Cloud, Pulumi, Crossplane) share the same core idea: a desired-state model, a diff, and an engine that converges.`,
    why: `Without IaC every environment is a hand-built snowflake: nobody can say what production *is*, rebuilding a region after a disaster becomes archaeology, and audits rely on screenshots. With IaC, a change to infrastructure is a pull request with a machine-generated plan attached, reviewed like code, applied by a pipeline, and reproducible in another account or region.

For a senior engineer the real value is **controlled change at scale**: dozens of teams modifying shared cloud estates without stepping on each other, with guardrails enforced automatically rather than by tribal review.`,
    problem: `The naive setup is one giant root module with a local state file. It fails in predictable ways:

- **Concurrent applies** corrupt or overwrite state because nothing locks it.
- **One plan touches everything**, so a typo in a tag can propose replacing a production database; plans take 20 minutes and reviewers stop reading them.
- **Console hot-fixes** during incidents create drift that the next apply silently reverts.
- **Secrets** (generated DB passwords, private keys) land in plaintext in state that is readable by anyone with bucket access.
- **No guardrails**: a public bucket or a \`0.0.0.0/0\` security rule gets merged because a reviewer missed one line in a 900-line plan.`,
    how: `**State is the source of truth for what the tool manages.** Store it remotely (object storage such as S3 / Azure Blob / GCS, or a managed backend) with versioning enabled and **locking** so only one writer runs at a time (for the S3 backend, historically a DynamoDB lock table; Terraform 1.10+ supports S3-native locking with \`use_lockfile = true\`, and DynamoDB-based locking is now deprecated). Restrict state access as tightly as production credentials, because it contains them.

**Split state to limit blast radius.** Organise roots by lifecycle and ownership: \`network\`, \`shared-data\`, \`platform\`, \`service-x\` per environment. Rarely-changing, high-impact layers (VPCs, DNS zones, KMS keys) live apart from frequently-changing app infrastructure. Pass values between layers via outputs read through remote-state data sources or, better, via a published parameter store, so consumers do not need read access to another team's whole state.

**Modules with versions.** Shared modules (a "standard service", a "hardened bucket") are published with semantic versions and pinned by consumers. Breaking changes are a major bump; consumers upgrade deliberately. Pin provider versions with a lock file for reproducible plans.

**Plan, review, apply the same plan.** CI runs \`terraform plan -out=tfplan\` on the PR, posts the summary, runs policy checks on the JSON plan, and the apply step applies *that saved plan* after approval, so what was reviewed is what runs.

**Drift detection.** Schedule \`terraform plan -refresh-only\` (or a full plan with \`-detailed-exitcode\`) per root and alert on non-empty diffs. Then decide: codify the manual change, or revert it.

**Import and refactor safely.** Bring existing resources under management with \`import\` blocks (or the older \`terraform import\` command), and rename/move resources with \`moved\` blocks instead of destroy-and-recreate.

**Environments.** CLI workspaces share one configuration and backend with separate state; they suit identical, ephemeral copies. For long-lived dev/stage/prod, separate directories (or separate root configs per environment calling the same versioned modules) with separate backends and credentials give clearer isolation: a prod apply cannot happen because someone forgot which workspace was selected.

**Policy as code.** Evaluate the plan JSON against rules (OPA/Rego via tools like Conftest, HashiCorp Sentinel, or cloud-native policy such as AWS SCPs / Azure Policy / GCP Organization Policy as a backstop). Typical rules: no public storage, encryption required, mandatory cost tags, allowed instance families, deletion protection on databases.

**Immutable over mutable.** Prefer replacing servers from a new image (bake with Packer or build containers) over patching them in place with configuration management; in-place mutation accumulates drift. Mutable updates remain fine for things that are expensive to replace and designed for it (database parameter changes, autoscaling settings).`,
    components: [
      { name: 'State backend + lock', description: 'Remote, versioned, encrypted storage for state with a mutual-exclusion lock. Losing or corrupting it means the tool no longer knows what it owns; versioning is your undo button.' },
      { name: 'Root modules (stacks)', description: 'The unit of plan/apply and therefore the unit of **blast radius**. Sized by ownership and change frequency, not by convenience.' },
      { name: 'Reusable modules', description: 'Versioned building blocks that encode the paved road (encryption on, logging on, tags required). Pinned by consumers; upgraded via PRs.' },
      { name: 'Plan pipeline', description: 'CI that runs fmt/validate, plan, policy checks and posts results on the PR; applies the saved plan after approval using short-lived credentials (OIDC federation rather than static keys).' },
      { name: 'Policy engine', description: 'OPA/Conftest, Sentinel or similar evaluating plan JSON pre-apply, backed by organisation-level cloud policies that also stop console changes.' },
      { name: 'Drift detector', description: 'Scheduled refresh-only plans per root that open tickets or alerts when reality diverges from code.' },
    ],
    misconceptions: [
      { myth: 'State is just a cache; you can regenerate it.', reality: 'State holds the mapping from addresses to real IDs plus attributes some providers cannot re-read. Losing it means re-importing everything by hand. Treat it as critical data: versioned, backed up, access-controlled.' },
      { myth: 'Marking a variable `sensitive` keeps secrets out of state.', reality: '`sensitive` only redacts CLI output. Values still land in state in plaintext. Keep secrets in a secrets manager and reference them at runtime, generate them outside IaC, use ephemeral values (Terraform 1.10+) and write-only arguments (1.11+) where providers support them, and encrypt and lock down the state backend.' },
      { myth: 'Workspaces are the standard way to separate prod from dev.', reality: 'Workspaces share code, backend and usually credentials, so a wrong selection can hit prod. For long-lived environments, separate directories/backends/credentials are the safer default.' },
      { myth: 'One big state is simpler, so it is better.', reality: 'It is simpler on day one and dangerous on day 300: slow plans, lock contention between teams and a blast radius equal to the whole estate.' },
    ],
    example: {
      title: 'Layered roots with a remote, locked backend and a policy gate',
      description: `A network layer owned by the platform team, consumed by a service layer. The service root reads only the outputs it needs; CI blocks the plan if policy fails.`,
      language: 'bash',
      code: `# repo layout
live/prod/network/      # VPC, subnets, NAT, DNS  (changes monthly)
live/prod/data/         # databases, KMS keys      (changes rarely, deletion_protection on)
live/prod/svc-orders/   # ASG/K8s resources, queues (changes daily)
modules/service/ v3.2.0 # pinned by svc-* roots

# CI for live/prod/svc-orders
terraform init -input=false
terraform plan -input=false -out=tfplan -detailed-exitcode   # exit 2 = changes present
terraform show -json tfplan > plan.json
conftest test plan.json --policy policy/                    # OPA/Rego rules
# ...human approval on the PR...
terraform apply -input=false tfplan                          # applies exactly what was reviewed`,
    },
    exercise: {
      prompt: `Your company has a single Terraform state with ~4,000 resources across all services in prod. Plans take 25 minutes, two teams regularly block each other on the lock, and last month a PR proposed replacing the primary database because of a module upgrade. Propose a migration plan.`,
      solution: `- **Target layout:** split by ownership and change rate: \`network\`, \`data\` (databases, keys), \`platform\` (clusters, shared ingress), then one root per service. Each gets its own backend key and least-privilege CI role.
- **Mechanics:** move resources with \`terraform state mv\` or by adding \`import\` blocks in the new root and \`removed\` blocks (with \`lifecycle { destroy = false }\`) in the old one, one layer at a time, verifying each new root plans to **zero changes** before moving on.
- **Guardrails:** \`prevent_destroy\` / provider deletion protection on databases; a policy that fails any plan containing \`delete\` or \`replace\` on resources tagged \`tier=data\` unless an override label is present.
- **Modules:** version the shared module, pin it, and upgrade service roots independently.
- **Outcome to report:** plan time per root drops to about a minute, lock contention disappears, and the worst-case blast radius of a service PR is that service.`,
    },
    faq: [
      { q: 'Terraform vs cloud-native tools (CloudFormation, Bicep)?', a: 'Native tools get day-zero support for new services and server-side state, but lock you to one provider. Terraform/OpenTofu gives one workflow across clouds and SaaS (DNS, monitoring, identity). Many orgs pick one per layer and are explicit about why.' },
      { q: 'How do I handle a console change made during an incident?', a: 'Drift detection flags it; the incident follow-up either codifies the change in a PR (plan shows no diff afterward) or reverts it deliberately. Never let the next unrelated apply be the thing that silently undoes it.' },
      { q: 'What is the difference between `moved`, `import` and `removed` blocks?', a: '`moved` renames an address without touching the real object; `import` adopts an existing object into state; `removed` drops an object from state, optionally without destroying it. All three make refactors reviewable in a plan.' },
    ],
    keyTerms: ['desired state', 'state file', 'state locking', 'blast radius', 'module versioning', 'drift detection', 'import block', 'policy as code', 'immutable infrastructure', 'workspaces'],
    deeper: `**Dependency and ordering traps.** Terraform builds a graph from references; hidden dependencies (an IAM policy that must exist before a function can start) need explicit \`depends_on\`, which also makes plans more conservative. **Create-before-destroy** avoids downtime on replacement but needs unique names. **Provider-side eventual consistency** (IAM propagation can take seconds) causes flaky applies; retries in providers mitigate but do not eliminate it.

**Controllers vs CLI.** Reconciling controllers (Crossplane, Config Connector, the Terraform-in-Kubernetes operators) continuously correct drift rather than detecting it on a schedule. That is great for consistency and painful during incidents, when someone's manual fix is reverted within minutes. Decide explicitly which layer is continuously reconciled.`,
    interview: {
      seniorAnswer: `A strong answer frames IaC as **change management**, not templating. Cover: state as the record of ownership (remote, versioned, locked, access-controlled because it contains secrets); splitting roots by ownership and change frequency to cap blast radius and lock contention; versioned modules as the paved road; plan-on-PR and apply-the-saved-plan; policy as code on plan JSON with org-level cloud policy as a backstop; drift detection with a clear rule for codify-or-revert; and short-lived CI credentials via OIDC. Mention a failure story: a module bump proposing replacement of a stateful resource, caught by a deny-replace policy and \`prevent_destroy\`.`,
      followUps: [
        { q: 'How would you safely rename a resource that holds data?', a: 'Use a `moved` block (or `state mv`) so the plan shows a move, not destroy/create. Verify the plan has zero replace actions before applying; keep deletion protection on as a second layer.' },
        { q: 'Two teams need the VPC ID from the network stack. How do you share it?', a: 'Publish outputs to a parameter store or registry and read them with a data source, rather than granting full read on the network state. That avoids leaking secrets and coupling to internal addresses.' },
        { q: 'How do you stop someone bypassing IaC in the console?', a: 'Read-only console roles for most humans, break-glass roles with alerting, org-level guardrail policies that also apply to API calls, and drift detection to catch what slips through.' },
        { q: 'What goes wrong with workspaces for prod?', a: 'Shared backend and credentials mean selecting the wrong workspace can apply to prod; per-environment differences turn into conditionals on `terraform.workspace`. Separate roots/backends per long-lived env are clearer.' },
      ],
      redFlags: [
        'Keeps state locally or in git.',
        'Believes `sensitive = true` removes secrets from state.',
        'One state for the whole company "for simplicity".',
        'Applies from laptops with long-lived admin keys.',
        'No answer for drift beyond "we tell people not to use the console".',
      ],
      numbers: [
        'Aim for roots whose plan completes in ~1–3 minutes; 20+ minute plans signal a split is overdue (rule of thumb).',
        'Rule of thumb: hundreds, not thousands, of resources per root.',
        'Drift detection cadence: daily for most roots, more often for security-sensitive layers.',
      ],
    },
    references: [
      { title: 'Terraform documentation', url: 'https://developer.hashicorp.com/terraform/docs' },
      { title: 'Terraform state', url: 'https://developer.hashicorp.com/terraform/language/state' },
      { title: 'Open Policy Agent documentation', url: 'https://www.openpolicyagent.org/docs/latest/' },
    ],
  },
  {
    id: 'infra-auto-delivery',
    title: 'CI/CD and release safety',
    stage: 6,
    order: 2,
    objectives: ['auto-delivery'],
    scope: 'senior',
    estMinutes: 30,
    summary:
      'Most outages are caused by changes. Release engineering is about making change small, observable and reversible: build once, promote the artifact, expose it progressively, and roll back automatically when SLOs burn.',
    what: `- **Continuous integration (CI)** – every change merges to mainline frequently and is built and tested automatically; the main branch stays releasable.
- **Continuous delivery (CD)** – every green build produces a deployable artifact and *could* go to production at the push of a button; the release decision is a business choice.
- **Continuous deployment** – every green build goes to production automatically, with no human gate.
- **Progressive delivery** – exposing a new version to a growing fraction of traffic or users while watching health signals, with automatic halt or rollback.
- **GitOps** – the desired state of each environment lives in git; an agent inside the environment pulls and reconciles it (Argo CD, Flux), rather than CI pushing with admin credentials.`,
    why: `Industry incident data and every SRE postmortem archive say the same thing: a large share of outages are triggered by deployments or configuration changes. You cannot stop changing, so you reduce the **size** of each change, the **exposure** before you know it is safe, and the **time to undo**. Teams that deploy small batches often have lower change failure rates, not higher, because each change is easy to reason about and revert. The DORA metrics quantify this: deployment frequency, lead time for changes, change failure rate and time to restore service (renamed *failed deployment recovery time* in recent DORA reports, which also added rework rate).`,
    problem: `A typical fragile pipeline: rebuild the code separately for each environment ("works in staging" but a different dependency resolved in prod), deploy big batches weekly, flip 100% of traffic at once, and discover breakage from customer tickets. Rollback means a new build under pressure. Database migrations that drop columns make rollback impossible, so every bad deploy becomes a forward-fix incident.`,
    how: `**Build once, promote the artifact.** CI produces one immutable artifact (container image referenced by **digest**, not a mutable tag), signs it and records provenance. Staging and prod deploy that same digest; only configuration differs, and configuration is versioned too.

**Choose a rollout strategy per risk:**
- **Rolling** – replace instances in batches (\`maxSurge\`/\`maxUnavailable\`). Cheap, default for stateless services; mixed versions coexist, and rollback is another rolling update.
- **Blue/green** – stand up a full parallel stack, switch traffic at the load balancer or DNS. Near-instant rollback by switching back; costs 2× capacity during the window; DNS-based switches are slowed by TTLs and cached resolvers.
- **Canary** – send 1% → 5% → 25% → 100% of traffic to the new version, comparing its error rate and latency against the baseline at each step. Catches problems with real traffic while exposing few users; needs enough traffic per step to be statistically meaningful.
- **Feature flags** – decouple *deploy* from *release*: code ships dark and is enabled per tenant/cohort at runtime. Rollback is a flag flip in seconds. Cost: flag debt and combinatorial test states; remove flags after rollout.

**Automated analysis and rollback.** Each canary step gates on SLIs (error ratio, p99 latency, saturation) vs baseline and on error-budget burn rate. If the burn rate on the canary exceeds a threshold, the controller (Argo Rollouts, Flagger, Spinnaker, cloud deploy services) aborts and shifts traffic back without a human.

**Database migrations: expand/contract.** Never couple a breaking schema change with the code that needs it. (1) **Expand:** add the new column/table, nullable, backward compatible. (2) Deploy code that writes both and reads old. (3) Backfill. (4) Switch reads to new. (5) **Contract:** after the old version can never come back, drop the old column. Every step is independently deployable and reversible.

**GitOps pull model.** The cluster agent watches an environment repo and reconciles; CI's only job is to open a PR bumping the image digest. Benefits: no cluster-admin credentials in CI, an audit trail of every prod change, drift is auto-corrected, and rollback is \`git revert\`.

**Measure with DORA.** Track deployment frequency, lead time (commit to prod), change failure rate (deploys causing degraded service) and time to restore (now called failed deployment recovery time). Elite teams deploy on demand with lead times under a day; the point is the trend, not the badge.`,
    components: [
      { name: 'Pipeline stages', description: 'Lint/unit → build → scan/sign → integration → deploy staging → automated checks → progressive prod rollout. Fast feedback first; aim for CI under ~10 minutes.' },
      { name: 'Artifact registry', description: 'Immutable images referenced by digest, with signatures and provenance (SLSA-style attestations) verified at admission.' },
      { name: 'Rollout controller', description: 'Executes canary/blue-green steps, queries metrics, pauses, promotes or aborts automatically.' },
      { name: 'Feature flag service', description: 'Runtime toggles with targeting rules, kill switches for risky features, and an owner + expiry for every flag.' },
      { name: 'GitOps agent', description: 'In-cluster reconciler pulling desired state from git; removes push credentials from CI and makes rollback a revert.' },
      { name: 'Release health signals', description: 'Per-version SLIs and burn-rate queries the controller can evaluate; without version labels on metrics, canary analysis is blind.' },
    ],
    misconceptions: [
      { myth: 'Continuous delivery means every commit goes to production automatically.', reality: 'That is continuous *deployment*. Continuous delivery means every build is releasable; a human or business rule may still decide when.' },
      { myth: 'Blue/green gives instant, free rollback.', reality: 'Only for stateless tiers. Shared databases, queues with new message formats and DNS caching all break the illusion, and you pay double capacity during the cut-over.' },
      { myth: 'A 1% canary for five minutes proves the release is safe.', reality: 'At low traffic, 1% may see a handful of requests: not enough to detect a 0.5% error regression. Size canary steps and bake times to traffic volume, and include time-based failures (cache expiry, cron jobs, memory leaks).' },
      { myth: 'Rollback is always possible.', reality: 'Destructive migrations, message format changes and external side effects (emails sent, payments captured) are one-way. Design for roll-forward safety with expand/contract and versioned payloads.' },
    ],
    example: {
      title: 'Canary with automated analysis (Argo Rollouts-style)',
      description: `Traffic steps with pauses; an analysis template compares the canary's 5xx ratio against a threshold and aborts the rollout automatically if it fails twice.`,
      language: 'yaml',
      code: `apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata: { name: orders }
spec:
  strategy:
    canary:
      steps:
        - setWeight: 5
        - pause: { duration: 10m }
        - analysis: { templates: [{ templateName: error-ratio }] }
        - setWeight: 25
        - pause: { duration: 15m }
        - setWeight: 50
        - pause: { duration: 15m }
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata: { name: error-ratio }
spec:
  metrics:
    - name: canary-5xx-ratio
      interval: 1m
      failureLimit: 2
      successCondition: result[0] < 0.01
      provider:
        prometheus:
          query: |
            sum(rate(http_requests_total{app="orders",version="canary",code=~"5.."}[5m]))
            / sum(rate(http_requests_total{app="orders",version="canary"}[5m]))`,
    },
    exercise: {
      prompt: `You must rename \`users.fullname\` to \`users.display_name\` in a service with 30 replicas, rolling deploys, and a requirement that any deploy can be rolled back within 5 minutes. Lay out the release sequence.`,
      solution: `- **Release 1 (expand):** migration adds nullable \`display_name\`. Code writes both columns, reads \`fullname\`. Rollback: old code ignores the new column.
- **Backfill job:** copy \`fullname\` → \`display_name\` in batches (throttled, idempotent), verify counts.
- **Release 2:** read \`display_name\` (fallback to \`fullname\` if null), still dual-write. Rollback to release 1 is safe because both columns are kept in sync.
- **Release 3:** stop writing \`fullname\`. Only after release 2 has been stable and no older version can be deployed.
- **Release 4 (contract):** drop \`fullname\`. This is the only irreversible step and it happens when nothing depends on it.
- Each release goes through the normal canary; at no point does a rollback require a schema change.`,
    },
    faq: [
      { q: 'Canary or blue/green?', a: 'Canary when you have enough traffic to measure and want limited exposure; blue/green when you need an atomic switch (e.g. protocol change) and can afford double capacity. Many teams combine them: blue/green infrastructure with weighted traffic shifting.' },
      { q: 'Where should integration tests run in a GitOps setup?', a: 'CI tests the artifact before the PR to the environment repo; post-sync hooks or the rollout controller run smoke and analysis in the environment. Promotion between environments is a PR, gated on those results.' },
      { q: 'How do you avoid feature-flag debt?', a: 'Every flag gets an owner, a type (release, ops kill-switch, experiment, permission) and an expiry; CI warns on stale release flags; removing a flag is part of the definition of done.' },
    ],
    keyTerms: ['continuous delivery', 'continuous deployment', 'artifact promotion', 'blue/green', 'canary', 'feature flag', 'expand/contract', 'GitOps', 'DORA metrics', 'automated rollback'],
    deeper: `**Bake time and the long tail of failures.** Some defects appear only after hours: memory leaks, certificate or token expiry, daily batch jobs, cache TTLs. Large providers deploy region by region, starting with low-traffic cells, with bake times between waves, so a time-delayed bug hits one cell, not the fleet. **Config is code:** feature-flag and configuration pushes deserve the same progressive rollout as binaries; several famous global outages came from an instantly-propagated config change, not a code deploy.`,
    interview: {
      seniorAnswer: `Anchor on "most incidents are changes", then show the system: trunk-based CI with fast feedback; one immutable, signed artifact promoted by digest; rollout strategy chosen per risk (rolling default, canary with automated SLO-based analysis, blue/green for atomic cut-overs, flags to decouple deploy from release); expand/contract migrations so rollback is always possible; GitOps pull model for credentials and auditability; wave-based rollouts across cells/regions with bake time; and DORA metrics to show improvement. Be explicit about failure modes: insufficient canary traffic, config pushes bypassing the pipeline, irreversible migrations.`,
      followUps: [
        { q: 'How do you decide canary step sizes and bake times?', a: 'From traffic and detection power: each step must see enough requests to distinguish the target error rate from baseline (often thousands), and bake long enough to cover periodic work. Low-traffic services may need synthetic load or longer steps.' },
        { q: 'What metrics would trigger automated rollback?', a: 'Canary vs baseline error ratio, p99 latency, saturation (CPU, memory, restarts), and short-window error-budget burn rate. Use relative comparison to baseline to avoid false aborts from global incidents.' },
        { q: 'Why build once rather than per environment?', a: 'Rebuilding can resolve different dependencies or compiler versions, so what you tested is not what you run. One digest promoted everywhere makes staging evidence valid for prod and enables provenance verification.' },
        { q: 'Push vs pull deployment?', a: 'Push needs CI to hold prod credentials and has no drift correction. Pull (GitOps) keeps credentials inside the cluster, reconciles drift, and gives a git audit trail, at the cost of another controller to operate and slower emergency changes unless you plan for them.' },
      ],
      redFlags: [
        'Rebuilds artifacts per environment or deploys `:latest`.',
        'Plans rollback without considering the database schema.',
        'Treats config/flag changes as exempt from progressive rollout.',
        'Canary "analysis" is a human watching a dashboard.',
        'Cannot name the DORA metrics or what they trade off.',
      ],
      numbers: [
        'CI feedback target: under ~10 minutes for the main pipeline (rule of thumb).',
        'Typical canary ladder: 1–5% → 25% → 50% → 100% with 10–30 minute bakes.',
        'DORA elite benchmark: on-demand deploys, lead time under a day, restore under an hour.',
      ],
    },
    references: [
      { title: 'Google SRE workbook', url: 'https://sre.google/workbook/table-of-contents/' },
      { title: 'SLSA', url: 'https://slsa.dev/' },
      { title: 'The Twelve-Factor App', url: 'https://12factor.net/' },
      { title: 'Alerting on SLOs (SRE workbook)', url: 'https://sre.google/workbook/alerting-on-slos/' },
    ],
  },

  // ───────────────────────────── Stage 7 · Observability & Performance ────────────────────────────
  {
    id: 'infra-obs-signals',
    title: 'Signals, alerting and observability cost',
    stage: 7,
    order: 1,
    objectives: ['obs-signals'],
    scope: 'senior',
    estMinutes: 30,
    summary:
      'Metrics tell you that something is wrong, traces tell you where, logs and profiles tell you why. Page on user-visible symptoms via SLO burn, and keep cardinality and volume under control or the bill becomes the incident.',
    what: `Observability is the ability to answer new questions about a system's behaviour from the telemetry it already emits. The signal types:

- **Metrics** – numeric time series, cheap to store and query, aggregated by labels. Best for dashboards and alerts.
- **Logs** – discrete events with context; expensive per byte, rich for debugging.
- **Traces** – a request's path across services as a tree of spans with timing and attributes; essential in microservices.
- **Profiles** – where CPU time and memory go inside a process, continuously sampled in production.

Frameworks for *which* metrics: Google's **four golden signals** (latency, traffic, errors, saturation); **RED** for request-driven services (Rate, Errors, Duration); **USE** for resources (Utilization, Saturation, Errors). OpenTelemetry is the vendor-neutral standard for generating and shipping all of these.`,
    why: `In a distributed system nobody can hold the whole thing in their head. When p99 latency doubles at 03:00, the on-call engineer needs to know within minutes whether users are affected, which dependency is responsible and what changed. Poor alerting is also a people problem: a team paged 30 times a week stops trusting pages, and the one real outage is acknowledged and ignored.`,
    problem: `Common failure patterns:

- **Cause-based alerts everywhere**: "CPU > 80%", "disk > 70%", "one pod restarted". They fire constantly without user impact and stay silent during real outages caused by something unanticipated.
- **Alert fatigue**: dozens of non-actionable pages; responders mute channels.
- **Cardinality explosion**: someone adds \`user_id\` or full URL path as a metric label; the time-series database runs out of memory and the monthly bill triples.
- **Logs as the only signal**: unstructured text grepped during incidents, 100% retained at great cost, no correlation to requests.
- **Broken traces**: context not propagated through a queue or a proxy, so traces stop at the first hop.`,
    how: `**Instrument with RED + USE.** Every service exports request rate, error rate and a latency **histogram** (not just an average) per endpoint class; every resource (CPU, memory, disk, connection pools, queues, thread pools) exports utilization, saturation (queue length, wait time) and errors.

**Alert on symptoms, investigate with causes.** Pages should fire when users are hurt or about to be: SLO burn, availability, latency at the edge. Cause metrics (CPU, replication lag) belong on dashboards and in tickets, with a few exceptions that predict imminent unrecoverable failure (disk will be full in 4 hours, certificate expires in 7 days).

**SLO-based alerting with burn rates.** Burn rate = observed error rate / allowed error rate. With a 99.9% SLO over 30 days, a burn rate of 1 consumes the budget exactly in 30 days. The SRE workbook's multiwindow, multi-burn-rate approach pages at about **14.4× over 1 hour** (2% of budget gone) and **6× over 6 hours** (5%), each confirmed by a short window (~5 and ~30 minutes) so the alert also resets quickly, and opens a ticket at about **1× over 3 days** (10%).

**Control cardinality.** Series count ≈ product of label value counts. \`endpoint\` (50) × \`status\` (5) × \`pod\` (200) = 50k series per metric, which is fine; add \`customer_id\` (100k) and it is 5 billion, which is not. Keep unbounded identifiers in logs and trace attributes, use route templates (\`/users/{id}\`) not raw paths, and drop or aggregate pod-level labels where not needed.

**Tracing and context propagation.** Use W3C Trace Context (\`traceparent\` header) end to end, including through message queues (put it in message attributes) and async jobs. Sample: head-based (decide at the root, e.g. 1–10%) is cheap; tail-based (decide after the trace completes, keep all errors and slow traces) is more useful but needs a collector tier that buffers spans. Attach **exemplars** so a latency spike on a metric links to example traces.

**Structured logs and sampling.** JSON logs with consistent fields (\`trace_id\`, \`service\`, \`level\`, \`tenant\`), no secrets or PII. Sample high-volume success logs, keep 100% of errors, and set tiered retention (hot for days, cheap archive for months).

**Make alerts actionable.** Each page has an owner, a runbook link, a dashboard and a clear "what to do". Review pages weekly; delete or demote any alert that did not lead to action.`,
    components: [
      { name: 'Four golden signals', description: 'Latency (split successful vs failed requests), traffic, errors (explicit, implicit and policy failures such as "slow = failed"), saturation (how full the most constrained resource is).' },
      { name: 'RED / USE', description: 'RED for every service endpoint; USE for every resource. Together they cover "is the service healthy" and "is the box/pool/queue the bottleneck".' },
      { name: 'Latency histograms', description: 'Bucketed distributions that can be aggregated across instances to compute percentiles. Averaging per-instance percentiles is mathematically wrong.' },
      { name: 'OpenTelemetry collector', description: 'Agent/gateway that receives, processes (batching, attribute scrubbing, tail sampling) and exports telemetry to one or more backends, decoupling instrumentation from vendor.' },
      { name: 'Burn-rate alerts', description: 'Multiwindow alerts on error-budget consumption speed that page for fast burns and ticket for slow burns.' },
      { name: 'Runbooks and dashboards', description: 'Linked from every alert: what the alert means, first diagnostic steps, mitigations, escalation.' },
    ],
    misconceptions: [
      { myth: 'More alerts mean better coverage.', reality: 'Beyond a handful of symptom alerts per service, each extra page reduces the chance any page is taken seriously. Coverage comes from SLOs at the user boundary.' },
      { myth: 'Average latency is a good health indicator.', reality: 'Averages hide the tail. A 50 ms mean can coexist with a 2 s p99 that hits every user who loads a page with many calls. Alert on percentiles from histograms.' },
      { myth: 'Observability means collecting everything.', reality: 'Telemetry cost often grows faster than traffic. Senior teams budget telemetry, sample, set retention tiers and choose the cheapest signal that answers each question.' },
    ],
    example: {
      title: 'Multiwindow burn-rate alert (Prometheus rule)',
      description: `For a 99.9% availability SLO (error budget 0.1%). Pages only when both the long and short window exceed 14.4× burn, so it fires fast for big outages and clears quickly after recovery.`,
      language: 'yaml',
      code: `groups:
  - name: checkout-slo
    rules:
      - alert: CheckoutErrorBudgetFastBurn
        expr: |
          (
            sum(rate(http_requests_total{svc="checkout",code=~"5.."}[1h]))
            / sum(rate(http_requests_total{svc="checkout"}[1h]))
          ) > (14.4 * 0.001)
          and
          (
            sum(rate(http_requests_total{svc="checkout",code=~"5.."}[5m]))
            / sum(rate(http_requests_total{svc="checkout"}[5m]))
          ) > (14.4 * 0.001)
        labels: { severity: page }
        annotations:
          summary: "Checkout burning error budget at >14.4x (2% of 30d budget per hour)"
          runbook: "runbooks/checkout-availability"`,
    },
    exercise: {
      prompt: `A team has 140 alert rules, gets ~25 pages per week, and still learned about last month's checkout outage from Twitter. Their metrics bill grew 3× after adding per-customer labels. What do you change?`,
      solution: `- **Inventory pages from the last 30 days:** classify each as actionable/user-impacting or not. Delete or demote (to ticket/dashboard) every non-actionable rule.
- **Define SLOs at the edge** for the critical journeys (checkout availability and latency) and add multiwindow burn-rate pages; that is the alert that would have caught the outage.
- **Keep a few cause alerts** that predict unrecoverable failure (disk full ETA, cert expiry), as tickets where possible.
- **Fix cardinality:** remove \`customer_id\` from metric labels; put it on spans and logs; use route templates; drop unused per-pod series at the collector.
- **Process:** every page needs a runbook and owner; a weekly review tracks pages per on-call shift, aiming for a couple per shift at most.`,
    },
    faq: [
      { q: 'Metrics, logs or traces: which first?', a: 'Metrics first for detection (cheap, alertable), traces next for localisation in distributed systems, logs for detail. Correlate them via trace IDs and exemplars so you can pivot in one click.' },
      { q: 'Head or tail sampling?', a: 'Head sampling is simple and cheap but drops most interesting traces. Tail sampling keeps errors and slow requests but requires a stateful collector tier that sees all spans of a trace. A common compromise is low-rate head sampling plus tail rules for errors and latency outliers.' },
      { q: 'Should I alert on CPU?', a: 'Rarely as a page. High CPU without user impact is efficient use; user impact will show up in latency/error SLOs. Use CPU saturation for capacity planning and autoscaling.' },
    ],
    keyTerms: ['four golden signals', 'RED method', 'USE method', 'symptom-based alerting', 'burn rate', 'cardinality', 'context propagation', 'tail sampling', 'exemplars', 'structured logging'],
    deeper: `**Black-box vs white-box.** Probes from outside (synthetic checks from several regions) catch DNS, certificate and edge failures that internal metrics cannot see, because a service that receives no traffic reports no errors. Pair them.

**Watch the watcher.** If the monitoring pipeline is down, silence looks like health. Use a dead-man's-switch alert (an always-firing heartbeat that pages when it *stops* arriving) and host part of the alerting path outside the failure domain it monitors.`,
    interview: {
      seniorAnswer: `Explain the signal roles (metrics detect, traces localise, logs/profiles explain), instrument with RED + USE and latency histograms, and page only on symptoms: SLO burn rate with multiwindow thresholds (~14.4× over 1h, ~6× over 6h, ticket at ~1× over 3d for a 30-day window). Treat telemetry as a cost and reliability problem: cardinality budgets, route templates, sampling (head + tail for errors/slow), tiered log retention. Mention context propagation through async boundaries, runbooks on every page, dead-man's switch for the monitoring stack, and a target of very few pages per shift.`,
      followUps: [
        { q: 'Why multiwindow burn-rate alerts instead of a simple threshold?', a: 'A single short window is noisy; a single long window is slow to fire and slow to clear. Requiring both a long and short window gives fast detection of serious burns, low false positives, and quick reset after recovery.' },
        { q: 'How do you compute fleet p99 correctly?', a: 'Aggregate histogram buckets across instances, then compute the quantile. Averaging per-pod p99 values gives a meaningless number.' },
        { q: 'A trace stops at the queue. Why?', a: 'Context is not propagated through the message: the producer must inject `traceparent` into message attributes and the consumer must extract it and start a linked or child span.' },
        { q: 'How do you keep telemetry cost under control?', a: 'Per-team budgets and showback, cardinality limits enforced at the collector, sampling, dropping unused metrics, shorter hot retention with cheap archive, and preferring metrics over logs for counting things.' },
      ],
      redFlags: [
        'Pages on CPU or single pod restarts.',
        'Uses averages for latency SLOs.',
        'Adds user IDs or raw URLs as metric labels.',
        'No runbooks; "the on-call will figure it out".',
        'Thinks 100% trace sampling is free.',
      ],
      numbers: [
        '99.9% over 30 days ≈ 43 minutes of full-outage budget.',
        'Burn-rate pages: 14.4× over 1h (2% budget), 6× over 6h (5%); ticket at 1× over 3 days (10%).',
        'Series per metric = product of label cardinalities; keep per-metric series in the thousands to low hundreds of thousands (rule of thumb).',
        'On-call health target: no more than a couple of pages per shift (SRE guidance, approximate).',
      ],
    },
    references: [
      { title: 'Monitoring distributed systems (SRE book)', url: 'https://sre.google/sre-book/monitoring-distributed-systems/' },
      { title: 'Alerting on SLOs (SRE workbook)', url: 'https://sre.google/workbook/alerting-on-slos/' },
      { title: 'OpenTelemetry documentation', url: 'https://opentelemetry.io/docs/' },
      { title: 'The USE method', url: 'https://www.brendangregg.com/usemethod.html' },
    ],
  },
  {
    id: 'infra-obs-performance',
    title: 'Performance troubleshooting and tail latency',
    stage: 7,
    order: 2,
    objectives: ['obs-performance'],
    scope: 'senior',
    estMinutes: 30,
    summary:
      'Latency lives in the tail, and fan-out makes the tail everyone\'s problem. Queueing theory explains why 80% utilization feels fine and 95% falls off a cliff; the USE method and a 60-second Linux checklist find the bottleneck.',
    what: `Performance troubleshooting is a method for going from "it's slow" to a specific saturated resource or code path, using measurements rather than guesses. The core tools:

- **Latency percentiles** – p50 describes the typical request, p99/p99.9 the experience of users who make many requests.
- **Little's law** – \`L = λ × W\`: items in the system equal arrival rate times time in system. Holds for any stable system.
- **Queueing intuition** – as utilization approaches 100%, waiting time grows non-linearly.
- **USE method** – for every resource, check Utilization, Saturation and Errors.
- **Linux observability tools** – a quick standard sequence of commands, then profilers and flame graphs for CPU-bound problems.`,
    why: `Senior interviews love "the service is slow, walk me through it" because it reveals whether you have a method. Production loves it too: a methodical engineer finds a saturated connection pool in five minutes, while guessing leads to scaling the wrong tier, restarting things and losing evidence.`,
    problem: `**Tail at scale.** If a page fans out to 100 backends in parallel and each has a 1% chance of exceeding its p99, the probability that at least one is slow is \`1 − 0.99^100 ≈ 63%\`. The backend's p99 becomes the frontend's typical case.

**Utilization lies.** A disk at "60% busy" averaged over a minute may be 100% busy in bursts with a deep queue. A CPU at 50% on a VM may be losing cycles to **steal** from the hypervisor. A container may be **throttled** by its cgroup CPU quota while the node looks idle.

**Noisy neighbours.** Shared hosts, shared disks, shared network links and shared databases mean your latency can rise because of someone else's batch job.`,
    how: `**Start from the symptom.** Which requests, which percentile, since when, what changed (deploy, traffic, dependency)? Compare against the baseline.

**Little's law for sizing.** At 2,000 req/s and 50 ms mean latency, \`L = 2000 × 0.05 = 100\` requests are in flight, so a pool of 20 DB connections each held for the whole request caps you near 400 req/s. If latency rises to 250 ms, you need 500 concurrent slots for the same throughput, which is why slow dependencies exhaust thread and connection pools.

**Queueing intuition.** For a simple single-server queue (M/M/1) the mean time in system scales like \`service_time / (1 − ρ)\`: at 50% utilization ≈ 2× service time, at 90% ≈ 10×, at 95% ≈ 20×. Real systems differ in detail but the knee is real; plan headroom so steady state stays well below the knee.

**USE checklist per resource:** CPU (utilization per core, run-queue length, throttling), memory (used vs available, swapping, OOM kills, page-fault rate), disk (utilization, await, queue size, errors), network (throughput vs link capacity, retransmits, drops), and software resources (thread pools, connection pools, file descriptors, locks).

**The 60-second Linux checklist** (popularised by Brendan Gregg):
- \`uptime\` – load averages; rising or falling trend.
- \`dmesg | tail\` – OOM kills, TCP drops, disk errors.
- \`vmstat 1\` – run queue (\`r\`), free memory, swap in/out, CPU user/system/idle/iowait/**steal**.
- \`mpstat -P ALL 1\` – per-CPU balance; one hot core suggests a single-threaded bottleneck.
- \`pidstat 1\` – per-process CPU over time.
- \`iostat -xz 1\` – per-device \`await\`, queue depth and utilization.
- \`free -m\` – available memory and page cache.
- \`sar -n DEV 1\` – network interface throughput; \`sar -n TCP,ETCP 1\` – connection rates and retransmits.
- \`top\` – overall check.

**Containers and VMs.** Check cgroup CPU throttling (\`nr_throttled\`/\`throttled_usec\` in \`cpu.stat\`) and memory pressure; check steal time on VMs; burstable instance credits on small instance types.

**Profile the hot path.** If CPU-bound, sample stacks (\`perf\`, eBPF-based tools, language profilers, continuous profilers) and render a **flame graph**: width is proportion of samples, so look for wide plateaus. Off-CPU analysis finds time spent blocked on locks and I/O.

**Mitigate the tail.** Timeouts and budgets per hop, hedged requests (send a second request after the p95 delay, cancel the loser), limiting fan-out, load shedding and caching hot results.`,
    components: [
      { name: 'Percentiles and histograms', description: 'p50/p95/p99/p99.9 from aggregated histograms; always state the window and the population (all requests, successful only, per endpoint).' },
      { name: "Little's law", description: '`L = λW`. Turns throughput and latency into required concurrency for pools, workers and connection limits.' },
      { name: 'Utilization vs queueing delay', description: 'Wait time explodes non-linearly near saturation; averages over long windows hide bursts at 100%.' },
      { name: 'USE method', description: 'Systematic per-resource sweep that finds saturated resources quickly and avoids streetlight debugging.' },
      { name: 'Linux 60-second tools', description: 'uptime, dmesg, vmstat, mpstat, pidstat, iostat, free, sar, top: a fast first pass before deeper tooling.' },
      { name: 'Profilers and flame graphs', description: 'Sampled stack traces visualised by width; on-CPU for compute hot spots, off-CPU for blocking.' },
    ],
    misconceptions: [
      { myth: 'Load average equals CPU utilization.', reality: 'On Linux, load average counts runnable tasks *and* tasks in uninterruptible sleep (often disk I/O). High load with idle CPUs usually means an I/O or lock problem.' },
      { myth: 'Adding replicas always fixes latency.', reality: 'Only if the bottleneck is in that tier. If replicas share a saturated database, more replicas add more contention and make it worse.' },
      { myth: 'A low p50 means the service is fast.', reality: 'Users who load pages with many calls experience the tail. With fan-out, the backend p99 dominates end-user latency.' },
      { myth: 'High iowait means the disk is the bottleneck.', reality: 'iowait is idle CPU time while I/O is outstanding: it is a hint, not proof. Confirm with per-device `await`, queue depth and utilization.' },
    ],
    example: {
      title: 'First minute on a slow VM',
      description: `Reading a \`vmstat\` sample: a run queue well above the vCPU count, almost no idle time and high steal points at the hypervisor (noisy neighbour or exhausted burst credits), not the application.`,
      language: 'bash',
      code: `$ vmstat 1 3
procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
 9  0      0 812344  10212 2143220    0    0     4    20 2310 4100 46 11  2  0 41
11  0      0 811980  10212 2143300    0    0     0    16 2290 4050 45 10  2  0 43
10  0      0 811700  10212 2143310    0    0     0    12 2305 4120 45 11  2  0 42
# r=10 runnable on a 4-vCPU VM, st≈42% steal: the guest is starved of CPU by the host.
# Action: check instance type (burstable credits?), move to dedicated/larger instance,
# or reschedule; profiling the app would be a waste of time here.`,
    },
    exercise: {
      prompt: `An API's p99 rose from 120 ms to 900 ms after traffic grew from 1,500 to 2,400 req/s. p50 barely moved. App CPU is 45%. Each request holds a DB connection for ~40 ms; the pool has 64 connections per instance across 2 instances. Explain the likely cause and fix.`,
      solution: `- **Little's law:** required concurrent DB connections ≈ 2,400 × 0.040 = 96 on average, against 128 total, so the pools run around 75% average utilization with bursts well above that.
- **Queueing:** near the knee, waits for a free connection grow non-linearly. Most requests still get a connection immediately (p50 flat), but the unlucky ones queue (p99 explodes). App CPU is not the bottleneck.
- **Verify:** pool wait-time and active-connection metrics, DB-side active sessions and query latency.
- **Fix:** reduce hold time (do not hold connections across remote calls, fix slow queries), size the pool with headroom *if* the database can take more sessions (check DB CPU and max connections; consider a pooler), add instances only with a per-instance pool budget that keeps total connections within the database limit, and add pool-wait timeouts so overload fails fast instead of queueing.`,
    },
    faq: [
      { q: 'Why is p99.9 worth tracking?', a: 'At high request rates 0.1% is a lot of users, and for fan-out pages it becomes the common case. It also surfaces GC pauses, retries and cold caches that p99 misses.' },
      { q: 'What is CPU steal?', a: 'Time a virtual CPU was ready to run but the hypervisor ran something else. Sustained steal above a few percent means contention on the host or exhausted burst credits.' },
      { q: 'When should I reach for a profiler?', a: 'After the USE sweep shows CPU is genuinely saturated by your process (high user time, not steal or throttling). For latency without CPU saturation, look at off-CPU time, locks, pools and dependencies first.' },
    ],
    keyTerms: ['tail latency', 'fan-out', "Little's law", 'utilization', 'saturation', 'USE method', 'CPU steal', 'CPU throttling', 'flame graph', 'hedged requests'],
    deeper: `**Coordinated omission.** Many load generators wait for a response before sending the next request, so when the server stalls they send fewer requests and under-record the latency users would have seen. Use open-loop load generation (fixed arrival rate) when measuring tail latency.

**Hedging budget.** Hedged requests cut tail latency dramatically if they are sent only after the p95 delay (adding roughly 5% extra load) and the backend can cancel the loser. Hedging non-idempotent writes or hedging immediately just doubles load during an overload.`,
    interview: {
      seniorAnswer: `Show a method: clarify the symptom (which percentile, which endpoint, since when, what changed), then sweep USE across resources, including software resources like pools and queues. Use Little's law to turn throughput and latency into concurrency, and queueing intuition to explain why p99 explodes near saturation while p50 stays flat. Know the Linux first-minute tools and what each reveals (run queue, steal, iowait, await, retransmits), container throttling and noisy neighbours, and when to profile (flame graphs for on-CPU, off-CPU for blocking). Close with tail mitigations: deadlines, hedging, reducing fan-out, load shedding, headroom.`,
      followUps: [
        { q: 'Why does fan-out amplify tail latency?', a: 'The request completes when the slowest leaf completes. With N independent leaves, P(at least one slow) = 1 − (1 − p)^N; at N=100 and p=1%, that is ~63%.' },
        { q: 'Load average is 30 on a 16-core box but CPUs are 60% idle. What next?', a: 'Load includes uninterruptible (D-state) tasks, usually disk or NFS I/O. Check `vmstat` `b` column, `iostat -xz` await and queue depth, and `dmesg` for storage errors.' },
        { q: 'How much headroom do you plan for?', a: 'Enough that steady-state utilization of the bottleneck stays below the knee (often 60–70% for latency-sensitive tiers), plus the capacity to lose an AZ (N+1 or N+2) without crossing it.' },
      ],
      redFlags: [
        'Immediately suggests "add more servers" without locating the bottleneck.',
        'Only talks about averages.',
        'Treats load average as CPU percent.',
        'Ignores steal, throttling and dependency saturation.',
        'Restarts processes before capturing evidence.',
      ],
      numbers: [
        '1 − 0.99^100 ≈ 63%: fan-out of 100 makes backend p99 the common case.',
        'M/M/1 wait multiplier ≈ 1/(1 − ρ): 2× at 50%, 10× at 90%, 20× at 95%.',
        '~0.5 ms intra-datacenter round trip; ~100 ns main-memory reference (order of magnitude).',
        'Hedge after p95 ≈ ~5% extra load.',
      ],
    },
    references: [
      { title: 'The USE method', url: 'https://www.brendangregg.com/usemethod.html' },
      { title: 'Linux performance (Brendan Gregg)', url: 'https://www.brendangregg.com/linuxperf.html' },
      { title: 'Handling overload (SRE book)', url: 'https://sre.google/sre-book/handling-overload/' },
    ],
  },
  // ───────────────────────────── Stage 8 · Architecture & Cost ────────────────────────────
  {
    id: 'infra-arch-frameworks',
    title: 'Well-Architected trade-offs, migrations and multi-cloud',
    stage: 8,
    order: 1,
    objectives: ['arch-frameworks'],
    scope: 'senior',
    estMinutes: 30,
    summary:
      'The Well-Architected frameworks give a shared vocabulary for reviewing designs. The senior skill is naming which pillar you are trading for which, choosing a migration strategy per workload, and resisting multi-region or multi-cloud unless the requirement pays for it.',
    what: `Each major provider publishes a framework of design pillars and review questions:

- **AWS Well-Architected (6 pillars):** operational excellence, security, reliability, performance efficiency, cost optimization, sustainability.
- **Azure Well-Architected (5 pillars):** reliability, security, cost optimization, operational excellence, performance efficiency.
- **Google Cloud Well-Architected Framework (6 pillars):** operational excellence; security, privacy and compliance; reliability; cost optimization; performance optimization; sustainability.

Around them sit adjacent decisions every architect faces: **migration strategy** per workload (the "7 Rs"), **multi-region / multi-cloud** posture, **build vs buy**, and recording decisions in **architecture decision records (ADRs)**.`,
    why: `Interviewers at senior and staff level want to see that you can evaluate a design across several dimensions at once and articulate costs. "Make it highly available" is not an answer; "active-passive across two regions buys us a 1-hour RTO at roughly 1.4× infrastructure cost and adds a failover runbook we must exercise quarterly" is. The frameworks also matter practically: many organisations run formal reviews against them before launch.`,
    problem: `Without explicit trade-off thinking, teams over-build (multi-region active-active for an internal tool with a 99.5% SLO), under-build (single-AZ database behind a "99.99%" promise), or migrate everything with one strategy (lift-and-shift the whole estate and then wonder why the bill went up). Decisions get relitigated every quarter because nobody wrote down why they were made.`,
    how: `**Pillars trade against each other.** Typical tensions:
- Reliability vs cost: each extra AZ or region multiplies baseline spend; standby capacity is paid insurance.
- Security vs operational excellence/velocity: stricter change controls and network segmentation slow delivery unless automated.
- Performance vs cost: provisioned capacity and caches cost money even when idle.
- Sustainability vs reliability: fewer, fuller machines reduce energy but shrink headroom.
State which pillar you are optimising for this workload, and the floor you will not go below on the others.

**Migration strategies, the 7 Rs** (AWS terminology, widely used):
- **Retire** – turn it off; often 10–20% of a legacy portfolio is unused (rough industry anecdote, verify per estate).
- **Retain** – leave it where it is for now (compliance, recent hardware investment, too risky).
- **Rehost** – lift and shift VMs as-is; fastest, least cloud benefit.
- **Relocate** – move at the hypervisor/platform level without changing the workload (e.g. VMware-based offerings).
- **Replatform** – lift, tinker and shift: swap self-managed DB for a managed one, containerise without rewriting.
- **Repurchase** – replace with SaaS.
- **Refactor / re-architect** – rebuild cloud-native; highest effort and highest long-term benefit.
Choose per workload by business value, change rate and technical debt; sequence easy wins first to build migration muscle.

**Multi-region decision criteria.** Driven by RTO/RPO, regulatory residency, latency to global users and blast-radius isolation. Options: backup-and-restore (hours RTO, cheap), pilot light, warm standby, active-active (seconds RTO, highest cost and data-consistency complexity). Active-active forces you to answer write conflicts: single-writer per region/partition, CRDTs or a globally consistent database with cross-region write latency.

**Multi-cloud decision criteria.** Valid reasons: regulatory or customer mandate, acquisitions, a clearly best-of-breed service, negotiating leverage at very large scale. Costs: lowest-common-denominator architecture, duplicated platform teams and skills, egress between clouds, two identity and network models. A pragmatic stance is "portable where cheap" (containers, Terraform, OpenTelemetry) and "native where valuable", rather than abstracting every service.

**Build vs buy.** Buy (managed or SaaS) when the capability is not your differentiator and a vendor operates it better; build when it is core to your product, when vendor limits block you, or when scale makes the unit economics favour owning it. Count total cost of ownership: on-call, upgrades, security patching, and the opportunity cost of engineers.

**ADRs.** A short document per significant decision: context, decision, alternatives considered, consequences, status. Stored next to the code, immutable once accepted (superseded by a new ADR). Cheap insurance against relitigating.`,
    components: [
      { name: 'Pillars', description: 'Shared review dimensions (operations, security, reliability, performance, cost, sustainability). Useful as a checklist; the value is in explicit trade-offs.' },
      { name: 'Well-Architected review', description: 'Structured question set applied before launch or periodically; outputs a prioritised list of high-risk issues, not a score to maximise.' },
      { name: '7 Rs', description: 'Retire, retain, rehost, relocate, replatform, repurchase, refactor: a per-workload migration decision.' },
      { name: 'DR tiers', description: 'Backup/restore → pilot light → warm standby → active-active, trading RTO/RPO against cost and complexity.' },
      { name: 'Build vs buy analysis', description: 'Differentiation, TCO including people, vendor risk and exit cost, time to value.' },
      { name: 'ADR', description: 'Lightweight, versioned record of a decision and its consequences, so future engineers know why.' },
    ],
    misconceptions: [
      { myth: 'Multi-cloud is more reliable than multi-region in one cloud.', reality: 'Usually the opposite for a given budget: multi-region within one provider gives most of the isolation with one skill set; multi-cloud adds failure modes in the glue and rarely gets exercised.' },
      { myth: 'Lift-and-shift saves money.', reality: 'Rehosting always-on, oversized VMs frequently costs more than on-premises. Savings come later from rightsizing, elasticity, managed services and commitments.' },
      { myth: 'Well-Architected means scoring high on every pillar.', reality: 'Pillars conflict. A good review documents conscious trade-offs and fixes high-risk gaps; it does not maximise everything.' },
    ],
    example: {
      title: 'An ADR for regional posture',
      description: `A concise ADR showing the format and the trade-off language interviewers want to hear.`,
      language: 'text',
      code: `ADR-014: Payments API regional posture
Status: Accepted (2026-03)
Context: SLO 99.95%, RPO <= 1 min, RTO <= 30 min. 92% of users in one geography.
         Regulator requires data to stay in-country; two regions available in-country.
Decision: Warm standby in region B. Async DB replication (lag p99 < 5 s), app tier
          scaled to 30% in B, failover runbook automated, game-day every quarter.
Alternatives:
  - Active-active: RTO ~0 but needs multi-writer DB; +80% cost; rejected for now.
  - Backup/restore: RTO hours; violates RTO.
Consequences: ~+35% infra cost; we accept up to ~5 s of acknowledged writes at risk
              on regional failover (documented to product); revisit if SLO -> 99.99%.`,
    },
    exercise: {
      prompt: `A company with 300 on-premises applications must exit its data centre in 18 months. The CTO wants "everything cloud-native". Propose an approach.`,
      solution: `- **Portfolio discovery:** inventory apps, owners, dependencies, utilisation and business criticality. Expect a meaningful share to be candidates for **retire** or **repurchase** (SaaS).
- **Bucket by strategy:** low-change legacy → **rehost/relocate** to hit the deadline; databases and middleware with managed equivalents → **replatform**; a few strategic, high-change systems → **refactor** on their own timeline (possibly after rehost).
- **Waves:** start with low-risk apps to build landing zone, networking, identity and migration tooling; move dependency groups together to avoid chatty cross-site traffic.
- **Explain to the CTO:** refactoring 300 apps in 18 months is not feasible; rehost-then-modernise meets the hard deadline and lets you spend refactoring effort where it pays.
- **Guardrails:** rightsizing and commitments after 1–2 months of real usage data; ADRs for each strategic decision.`,
    },
    faq: [
      { q: 'How do I talk about the pillars without sounding like a brochure?', a: 'Use them as a checklist to find gaps, then talk in specifics: "this costs X, buys Y nines, and the failure mode we still accept is Z".' },
      { q: 'When is active-active worth it?', a: 'When the RTO is near zero, the business loss per minute justifies roughly doubling infrastructure plus engineering complexity, and the data model tolerates multi-region writes (partitioned ownership or conflict resolution).' },
      { q: 'What makes a good ADR?', a: 'One decision, the context and constraints at the time, at least two alternatives with why they lost, explicit consequences including what you are giving up, and a trigger for revisiting.' },
    ],
    keyTerms: ['Well-Architected pillars', 'trade-off', '7 Rs', 'rehost', 'replatform', 'refactor', 'RTO/RPO', 'multi-region', 'build vs buy', 'ADR'],
    deeper: `**Cells over regions.** Many large systems reduce blast radius with **cell-based architecture**: independent stacks each serving a slice of customers, routed by a thin layer. A bad deploy or poison request takes out one cell, not a region. Cells also make capacity planning and gradual rollouts more uniform. The cost is a routing layer and cross-cell operations (migrations between cells, global queries).`,
    interview: {
      seniorAnswer: `Use the pillars as a lens, then talk in trade-offs with numbers: what reliability tier the SLO actually requires, what each step up (multi-AZ, warm standby, active-active) costs and what new failure modes it introduces (replication lag, split brain, failover that nobody has tested). For migrations, choose among the 7 Rs per workload and sequence them in waves against the deadline. On multi-cloud, give legitimate drivers and real costs and prefer portability where it is cheap. Close with how you record and revisit the decision (ADR with explicit revisit triggers).`,
      followUps: [
        { q: 'Name the AWS pillars. How do Azure and Google Cloud differ?', a: 'AWS: operational excellence, security, reliability, performance efficiency, cost optimization, sustainability. Azure has five (no separate sustainability pillar). Google Cloud has six, including sustainability, and groups security with privacy and compliance.' },
        { q: 'Your CEO wants multi-cloud "for resilience". Response?', a: 'Ask what failure we are protecting against and what it costs per hour. Usually multi-region in one provider plus tested DR meets the need for far less; if there is a regulatory or concentration-risk mandate, scope multi-cloud to the critical path and keep it exercised.' },
        { q: 'Replatform vs refactor for a monolith on VMs?', a: 'Replatform (containers + managed DB) gets operational wins quickly with limited risk. Refactor only the parts with high change rate or scaling pain, ideally strangler-fig style, once the platform is stable.' },
        { q: 'How do you evaluate build vs buy for an internal developer platform?', a: 'Differentiation (usually low), TCO including staffing and on-call, integration with existing identity/CI, vendor lock-in and exit cost, and time to value. Often buy/adopt the core and build the thin opinionated layer.' },
      ],
      redFlags: [
        'Proposes active-active multi-region for every workload.',
        'Treats multi-cloud as free resilience.',
        'One migration strategy for the whole portfolio.',
        'Cannot articulate what a design gives up.',
        'No written record of decisions.',
      ],
      numbers: [
        'AWS: 6 pillars; Azure: 5; Google Cloud: 6.',
        '7 Rs: retire, retain, rehost, relocate, replatform, repurchase, refactor.',
        '99.9% ≈ 8.8 h/year; 99.99% ≈ 53 min/year; 99.999% ≈ 5.3 min/year downtime.',
      ],
    },
    references: [
      { title: 'AWS Well-Architected', url: 'https://aws.amazon.com/architecture/well-architected/' },
      { title: 'Azure Well-Architected Framework', url: 'https://learn.microsoft.com/en-us/azure/well-architected/' },
      { title: 'Google Cloud Well-Architected Framework', url: 'https://cloud.google.com/architecture/framework' },
      { title: 'AWS migration strategies', url: 'https://docs.aws.amazon.com/prescriptive-guidance/latest/large-migration-guide/migration-strategies.html' },
    ],
  },
  {
    id: 'infra-arch-finops',
    title: 'FinOps and cost engineering',
    stage: 8,
    order: 2,
    objectives: ['arch-finops'],
    scope: 'senior',
    estMinutes: 25,
    summary:
      'Cloud cost is an engineering metric. Know the drivers (compute, storage, and especially data transfer), match purchase models to workload shape, measure unit cost, and make spend visible to the teams that cause it.',
    what: `**FinOps** is the operating practice of bringing financial accountability to variable cloud spend, so engineering, finance and product make trade-offs together. The FinOps Foundation framework describes an iterative lifecycle:

- **Inform** – allocation and visibility: who spends what, on which product, and is it forecastable?
- **Optimize** – reduce waste and improve rates: rightsizing, scheduling, commitments, spot, architecture changes.
- **Operate** – embed it: budgets, anomaly alerts, policies, cost reviews in design and planning.

**Cost engineering** is the technical half: designing systems whose cost scales sensibly with the business.`,
    why: `In the cloud, every engineer is a purchaser: a Terraform PR can add six figures a year. Cost is also a design signal: a service whose cost grows faster than its traffic has an architectural problem. Senior interviewers increasingly ask "what would this cost?" and expect order-of-magnitude reasoning, including the costs people forget.`,
    problem: `Typical waste and surprises:

- **Idle and oversized resources**: dev environments running nights and weekends, instances sized for a peak that happens once a year, unattached volumes and old snapshots.
- **Data transfer**: internet egress, **cross-AZ** traffic between chatty services or replicas, NAT gateway processing, cross-region replication. Often invisible until the bill.
- **Storage that only grows**: logs and backups with no lifecycle policy, everything on the hottest tier.
- **No allocation**: untagged resources mean nobody owns the spend, so nobody optimises it.
- **Wrong purchase model**: steady 24/7 baseline on on-demand rates; or commitments bought for workloads that were later decommissioned.`,
    how: `**Know the drivers.** Compute (instance hours, vCPU-seconds for serverless), storage (GB-month by tier, plus requests), data transfer (per GB, direction- and distance-dependent), managed-service premiums, and licences. Inbound internet traffic is generally free; outbound internet egress commonly costs several cents per GB; cross-AZ traffic is charged in many providers (on AWS, on the order of $0.01/GB in each direction). Approximate and provider-specific: always check current pricing.

**Match purchase model to workload shape.**
- **On-demand** for spiky, short-lived or unknown workloads.
- **Commitments** (AWS Savings Plans / Reserved Instances, Azure reservations / savings plans, Google Cloud committed use discounts) for the steady baseline: commonly 30–70% cheaper depending on term and flexibility. Commit to the floor of usage, not the average.
- **Spot / preemptible** (AWS Spot, Azure Spot VMs, Google Cloud Spot VMs) for fault-tolerant, interruptible work (batch, CI, stateless workers): deep discounts (often 60–90%) with short-notice interruption (about two minutes on AWS, roughly 30 seconds on Azure and Google Cloud). Diversify instance types and handle the interruption signal.

**Rightsize** from observed utilization (p95 CPU/memory over weeks), not requested capacity; in Kubernetes, rightsize requests too, since the scheduler packs by requests. Move to newer instance generations and, where supported, ARM-based instances for better price/performance.

**Design out transfer costs.** Keep chatty services and their caches in the same AZ where availability allows (zone-aware routing), compress, use a CDN for internet egress, use private endpoints instead of NAT for cloud-service traffic, and avoid cross-region replication you do not need.

**Storage lifecycle.** Tier objects by access pattern (hot → infrequent → archive), expire logs and temporary data, clean old snapshots, and watch request costs for many tiny objects.

**Allocation: tagging, showback, chargeback.** Enforce tags (\`team\`, \`service\`, \`env\`, \`cost-center\`) via policy as code; account-per-team structures make allocation simpler. **Showback** reports costs to teams; **chargeback** bills them internally. Shared costs (platform clusters, networking) are split by a documented key such as requested CPU.

**Unit economics.** Track cost per business unit (per 1k requests, per active customer, per order, per GB processed). Absolute spend can rightly grow with the business; unit cost should flatten or fall. This is the metric to put in front of leadership.

**Operate.** Budgets and anomaly detection per team, cost visible in PRs (estimation tools), regular reviews of the top cost lines, and engineers empowered to act.`,
    components: [
      { name: 'Lifecycle: inform, optimize, operate', description: 'Iterative phases: visibility and allocation, then rate and usage optimisation, then continuous governance.' },
      { name: 'Data transfer', description: 'Internet egress, cross-AZ, cross-region, NAT processing. The most commonly underestimated cost driver in architecture reviews.' },
      { name: 'Commitments vs spot', description: 'Commit to the steady baseline; run interruptible work on spot; leave peaks on on-demand or autoscaled.' },
      { name: 'Rightsizing', description: 'Resize from observed p95 utilization; in containers, fix requests so bin-packing reflects reality.' },
      { name: 'Tagging, showback, chargeback', description: 'Allocation enforced by policy, reported to owners; shared costs split by a documented key.' },
      { name: 'Unit economics', description: 'Cost per business outcome; the metric that separates healthy growth from waste.' },
    ],
    misconceptions: [
      { myth: 'Serverless is always cheaper.', reality: 'Cheaper for spiky, low-duty-cycle workloads. For a steady high-throughput service, per-invocation pricing can cost several times more than well-utilised instances or containers.' },
      { myth: 'Buy commitments for all current usage.', reality: 'Commit to the floor you are confident persists for the term. Over-committing turns elasticity into fixed cost, and architecture changes can strand reservations.' },
      { myth: 'Multi-AZ is free apart from the extra instances.', reality: 'Replication and service-to-service traffic across AZs is billed per GB in many providers; a chatty microservice mesh spread across three zones can generate a large transfer bill.' },
      { myth: 'Cost optimisation is a one-off project.', reality: 'Without operate-phase controls (tags, budgets, anomaly alerts, reviews) waste returns within months.' },
    ],
    example: {
      title: 'Back-of-envelope transfer cost',
      description: `A service sends 2 TB/day to a cache and a database in other AZs, and serves 500 GB/day to the internet without a CDN. Prices are illustrative approximations.`,
      language: 'text',
      code: `Cross-AZ: 2 TB/day ≈ 60 TB/month = 60,000 GB
  ~ $0.01/GB out + ~$0.01/GB in  ≈ $0.02/GB  →  ~ $1,200 / month
Internet egress: 500 GB/day ≈ 15 TB/month = 15,000 GB
  ~ $0.08/GB (first tiers, approximate)       →  ~ $1,200 / month
Fixes:
  - zone-aware routing to same-AZ cache replicas  → cross-AZ traffic down ~2/3
  - CDN with high cache-hit ratio for static/media → origin egress down sharply
Unit metric: transfer cost per 1k requests, tracked monthly.`,
    },
    exercise: {
      prompt: `A SaaS company's cloud bill grew 70% year over year while revenue grew 25%. You have one quarter. What do you do?`,
      solution: `- **Inform first:** enforce tagging and map 90%+ of spend to teams/services; publish a showback dashboard; compute unit cost (per customer, per 1k requests) to show which services are scaling badly.
- **Quick wins:** shut down idle/non-prod out of hours, delete unattached volumes and old snapshots, apply storage lifecycle policies, rightsize the top over-provisioned instances and Kubernetes requests.
- **Rates:** cover the observed steady baseline with flexible commitments; move CI and batch to spot.
- **Architecture:** investigate data transfer lines (cross-AZ chatter, NAT for cloud-service traffic, missing CDN) and the top 3 services by unit-cost growth.
- **Operate:** budgets and anomaly alerts per team, cost estimation in IaC PRs, monthly review. Report the delta as unit cost trend, not just absolute spend.`,
    },
    faq: [
      { q: 'Showback or chargeback?', a: 'Start with showback: it builds trust in the numbers. Chargeback makes sense once allocation is accurate and teams have the authority to change their spend; otherwise it creates disputes without savings.' },
      { q: 'How do I estimate cost in a system design interview?', a: 'Order of magnitude: instance count × hourly price, storage GB × tier price, and especially transfer GB × per-GB price. State assumptions and flag transfer and managed-service premiums as the likely surprises.' },
      { q: 'What is a good unit metric?', a: 'Something tied to value that engineering can influence: cost per active customer, per order, per million API calls, per GB ingested. Pick one or two per product and trend them.' },
    ],
    keyTerms: ['FinOps lifecycle', 'data egress', 'cross-AZ traffic', 'commitments', 'spot instances', 'rightsizing', 'unit economics', 'showback', 'chargeback', 'storage lifecycle'],
    deeper: `**Kubernetes cost allocation** is hard because many workloads share nodes. Allocate by the larger of requested and used CPU/memory per pod, attribute idle node capacity to the platform (or spread it), and make cluster efficiency (used ÷ allocatable) a platform KPI. Overstated requests are both a cost problem and a scheduling problem.`,
    interview: {
      seniorAnswer: `Treat cost as a design constraint with numbers. Name the drivers including the hidden ones (internet egress, cross-AZ and NAT processing, cross-region replication, log volume), map purchase models to workload shape (commit to the baseline, spot for interruptible, on-demand for peaks), rightsize from observed utilization including container requests, and apply storage lifecycle policies. Explain the FinOps loop (inform, optimize, operate) with tagging enforced by policy, showback before chargeback, budgets and anomaly alerts. Measure success as unit cost per business outcome, not total spend.`,
      followUps: [
        { q: 'How do you size a commitment purchase?', a: 'Look at 30–90 days of hourly usage, commit to roughly the minimum sustained level (the floor), prefer flexible commitment types, ladder purchases over time, and review coverage and utilization monthly.' },
        { q: 'How would you run stateless workers on spot safely?', a: 'Diversify across instance types and AZs, handle the interruption notice (drain, checkpoint, stop taking work), keep an on-demand base for minimum capacity, and make jobs idempotent so retries are safe.' },
        { q: 'Where do cross-AZ costs hide in Kubernetes?', a: 'Service-to-service calls load-balanced across zones, cross-zone load balancer traffic, and replicated stateful sets. Topology-aware routing and zone-local replicas reduce it, traded against even spread for availability.' },
      ],
      redFlags: [
        'Ignores data transfer when estimating cost.',
        'Buys commitments for peak usage.',
        'Runs stateful, non-interruptible work on spot without a plan.',
        'Optimises total spend while unit cost is rising.',
        'No allocation, so nobody owns the bill.',
      ],
      numbers: [
        'Commitment discounts commonly ~30–70% vs on-demand (term and flexibility dependent).',
        'Spot discounts often ~60–90%; AWS gives ~2 minutes interruption notice, Azure and Google Cloud ~30 seconds.',
        'Cross-AZ transfer on AWS ≈ $0.01/GB each direction; internet egress several cents per GB (approximate).',
        '1 TB/day ≈ 30 TB/month: multiply per-GB prices by ~30,000.',
      ],
    },
    references: [
      { title: 'FinOps Framework', url: 'https://www.finops.org/framework/' },
      { title: 'AWS Well-Architected', url: 'https://aws.amazon.com/architecture/well-architected/' },
      { title: 'Google Cloud Well-Architected Framework', url: 'https://cloud.google.com/architecture/framework' },
    ],
  },

  // ───────────────────────────── Stage 9 · Interview Craft ────────────────────────────
  {
    id: 'infra-craft-system-design',
    title: 'A 45-minute system design method',
    stage: 9,
    order: 1,
    objectives: ['craft-system-design'],
    scope: 'senior',
    estMinutes: 30,
    summary:
      'System design interviews score how you think, not which boxes you draw. Use a repeatable structure, quantify early, drive the conversation, go deep where it matters, and close with failure modes, trade-offs and evolution.',
    what: `A system design interview is a 45–60 minute collaborative exercise: you are given a vague product ("design a URL shortener", "design a metrics pipeline", "design a multi-region rate limiter") and must produce a reasoned architecture while thinking aloud. A reliable framework:

- **Clarify (5 min)** – functional requirements (what it does), non-functional requirements (scale, latency, availability, consistency, durability, cost, compliance), and what is out of scope.
- **Estimate (3–5 min)** – QPS (peak vs average), storage growth, bandwidth, memory for hot data.
- **API and data model (5 min)** – core endpoints or events, entities, access patterns, partition keys.
- **High-level design (10 min)** – clients, edge, services, data stores, async paths. Walk a request end to end.
- **Deep dives (10–15 min)** – the 1–2 hardest parts, often chosen with the interviewer.
- **Bottlenecks and failure modes (5 min)** – hot keys, overload, dependency failure, AZ/region loss, data corruption.
- **Trade-offs and evolution (3–5 min)** – what you would change at 10× scale, what you deliberately did not build.`,
    why: `At senior level, the interview is a proxy for how you would lead a real design review: do you find the actual requirements, size the problem, make defensible choices, and know where it will break? Candidates with deep knowledge still fail because they jump to components, never quantify, or spend 30 minutes on one box. Structure frees your attention for judgment.`,
    problem: `Common failure patterns:

- **Diving into technology** ("we'll use Kafka and Cassandra") before knowing scale or access patterns.
- **No numbers**, so no way to justify sharding, caching or a queue.
- **Passive candidate** waiting for prompts; the interviewer has to drive.
- **Breadth with no depth**: twelve boxes, nothing explained below the label.
- **Happy path only**: no mention of what happens when a dependency is slow, a region fails or a hot key appears.
- **Running out of time** before trade-offs, which is where senior signal lives.`,
    how: `**Clarify like an owner.** Ask who the users are, the read/write ratio, peak vs average traffic, latency targets (p99, not "fast"), consistency needs per operation (balance must be strongly consistent; a like counter need not), data retention, and multi-region requirements. Write the requirements visibly and confirm them.

**Back-of-envelope numbers to keep handy (order of magnitude):**
- 1 day ≈ 86,400 s ≈ 10^5 s. So 1M requests/day ≈ 12 req/s; 100M/day ≈ 1,200 req/s average; plan peak at 2–10× average.
- Main memory reference ~100 ns; SSD random read ~tens to ~100 µs; round trip within a datacenter ~0.5 ms; cross-continent round trip ~100–150 ms.
- Reading 1 MB sequentially: ~microseconds from memory, ~ms from SSD.
- A single well-tuned relational primary can typically handle thousands to low tens of thousands of simple writes/s; a Redis-class cache node ~100k ops/s (rough rules of thumb, workload dependent).
- Storage: 100M records × 1 KB = 100 GB; times replication factor 3; times retention.

**API and data first, then boxes.** The access pattern determines the store: key-value lookups, range scans by time, secondary indexes, full-text, graph traversal. State the partition key and why it avoids hot spots.

**High-level design, then walk a request.** Narrate a write and a read through the system, naming where state lives and what is synchronous vs async.

**Drive the deep dive.** Offer choices: "The interesting parts are the fan-out on write for timelines and the hot-key problem for celebrities; which would you like me to go into?" Then go to mechanism level: data layout, consistency, caching strategy and invalidation, idempotency, backpressure.

**Failure modes and operability.** For each critical component: what if it is slow, down, or returns wrong data? Timeouts, retries with jitter, circuit breakers, load shedding, multi-AZ, backups and restore tests, the SLOs you would set and the alerts you would page on, how you would deploy safely.

**Trade-offs and evolution.** Summarise the key decisions and their costs, and what changes at 10× (sharding, cells, moving to async, regional deployment).

**What interviewers score.** At **senior**: requirements gathering, sound estimates, correct use of building blocks, depth in at least one area, awareness of failure modes and trade-offs, clear communication. At **staff**: framing the problem in business terms, identifying the few decisions that really matter, reasoning about org and operational cost (who runs this, migration path from today's system), multi-year evolution, and making the interviewer feel they were in a good design review.`,
    components: [
      { name: 'Requirements', description: 'Functional, non-functional with numbers, and explicit non-goals. Everything later is justified against these.' },
      { name: 'Estimation', description: 'QPS, storage, bandwidth and memory to order of magnitude; drives sharding, caching and queue decisions.' },
      { name: 'API and data model', description: 'Endpoints/events, entities, access patterns and partition keys; chooses the data store for you.' },
      { name: 'High-level architecture', description: 'Edge, services, stores, async paths; a narrated request walk-through.' },
      { name: 'Deep dives', description: 'One or two hard problems to mechanism depth, chosen with the interviewer.' },
      { name: 'Failure modes, trade-offs, evolution', description: 'What breaks, how it degrades, what you chose not to do, and what changes at 10×.' },
    ],
    misconceptions: [
      { myth: 'There is a correct answer the interviewer is waiting for.', reality: 'Multiple designs pass. Interviewers score the reasoning: requirements, numbers, justified choices, awareness of costs and failure.' },
      { myth: 'Naming more technologies shows more experience.', reality: 'Unjustified components are a negative signal. Fewer boxes, each explained, beats a buzzword map.' },
      { myth: 'The interviewer should guide the discussion.', reality: 'Seniors drive: propose the agenda, check in at transitions, and invite the interviewer to steer deep dives.' },
      { myth: 'Precise arithmetic matters.', reality: 'Order of magnitude matters. Round aggressively, state assumptions, and show how the number changes the design.' },
    ],
    example: {
      title: 'Opening five minutes for "design a URL shortener"',
      description: `Clarifying questions and a quick estimate that already shapes the design (read-heavy, small dataset, cache-friendly).`,
      language: 'text',
      code: `Clarify:
  - Create short links and redirect. Custom aliases? Expiry? Analytics?  -> aliases yes, analytics async
  - Scale: 100M new links/month, 100:1 read:write
  - Redirect latency p99 < 50 ms at edge; availability 99.99% for redirects, 99.9% for create
Estimate:
  writes: 100M / (30 * 1e5 s) ≈ 40/s avg, ~400/s peak
  reads:  ~4,000/s avg, ~40,000/s peak
  storage: 100M * 12 months * 5 years * ~500 B ≈ 3 TB (+ replicas)
  hot set: top 20% of links serve most reads -> fits comfortably in memory cache
Implications:
  - KV store keyed by short code; ID generation without coordination (range allocation / random + check)
  - redirects served from cache/CDN; analytics via async event stream, never in the redirect path`,
    },
    exercise: {
      prompt: `Practise the framework on "design a metrics ingestion pipeline for 50k hosts, each sending 500 series every 10 s, with 30-day retention and dashboards that must load in under 2 s". Produce requirements, estimates and the two deep dives you would propose.`,
      solution: `- **Estimates:** 50k × 500 = 25M active series; 25M / 10 s = 2.5M samples/s. At ~1–2 bytes/sample compressed (Gorilla-style compression, approximate) that is ~2.5–5 MB/s, roughly 6.5–13 TB over 30 days before replication; raw ingest bandwidth before compression is far higher.
- **High level:** agents → regional ingest gateways (stateless, batching) → durable log (partitioned by series hash) → ingesters building compressed blocks in memory → object storage for blocks + index → query layer with caching and downsampled rollups.
- **Deep dive 1: cardinality and partitioning.** Hash series to partitions, per-tenant series limits, hot-tenant isolation, what happens when a deploy changes a label and doubles series.
- **Deep dive 2: query performance.** Pre-aggregated rollups (1 m, 1 h) for long ranges, query result caching, limits on series per query, fan-out and tail latency across shards.
- **Failure modes:** ingester crash (replay from the log), backpressure when the log lags, and dropping or delaying low-priority tenants under overload rather than failing everyone.`,
    },
    faq: [
      { q: 'How much should I write vs talk?', a: 'Keep a visible list of requirements and numbers and a simple diagram; talk continuously about why. The written artefacts let the interviewer follow and let you refer back when justifying choices.' },
      { q: 'What if I do not know a technology the interviewer mentions?', a: 'Say so, reason from first principles about what it must do (e.g. "a log-structured store optimised for writes"), and compare to something you know. Honesty plus reasoning scores better than bluffing.' },
      { q: 'How do I recover if I realise a mistake mid-way?', a: 'Name it and fix it: "Given the 100:1 read ratio I under-weighted caching; let me revise." Self-correction is a positive senior signal.' },
    ],
    keyTerms: ['functional requirements', 'non-functional requirements', 'back-of-envelope estimation', 'access patterns', 'partition key', 'deep dive', 'failure modes', 'trade-offs', 'evolution', 'driving the interview'],
    deeper: `**Infrastructure-flavoured variants.** Platform and SRE loops often swap product questions for infrastructure ones: design a deployment system, a multi-tenant Kubernetes platform, a global load-balancing layer, a log pipeline, or a secrets service. The framework is the same, but the non-functional requirements dominate: blast radius, tenancy isolation, upgrade strategy, failure of the control plane vs data plane (data plane should keep working when the control plane is down: static stability), and the operational cost of the platform team.`,
    interview: {
      seniorAnswer: `Show the structure explicitly at the start ("I'll clarify, estimate, sketch the API and data model, do a high-level design, then go deep on two areas and finish with failure modes and trade-offs"), then execute it with numbers. Tie every component to a requirement or estimate, pick data stores by access pattern, go to mechanism depth on the hardest part, and proactively cover overload, dependency failure, AZ/region loss, deployment and observability. Keep time; reserve the last minutes for trade-offs and 10× evolution. For staff, add business framing, migration from today's system and who operates it.`,
      followUps: [
        { q: 'The interviewer says "assume 10× the traffic". What do you revisit?', a: 'The estimates first, then whichever component crosses a limit: single-writer database (shard or partition), cache memory, fan-out costs, cross-AZ transfer cost, and whether synchronous paths should become async.' },
        { q: 'How do you choose between SQL and NoSQL in an interview?', a: 'From access patterns and consistency: relational for multi-entity transactions, ad-hoc queries and moderate write scale; key-value/wide-column for very high write throughput with known access patterns by key. State the trade-off and migration path.' },
        { q: 'How do you handle a hot key?', a: 'Detect it (per-key metrics), cache with request coalescing, replicate hot entries across cache nodes, shard the key (key#N with fan-in on read), and rate-limit pathological clients.' },
      ],
      redFlags: [
        'Starts drawing before asking any questions.',
        'No numbers anywhere in the design.',
        'Picks technologies by name without justification.',
        'Never mentions failures, overload or deployment.',
        'Runs out of time with no trade-off discussion.',
      ],
      numbers: [
        '1 day ≈ 10^5 s; 1M/day ≈ 12/s; peak ≈ 2–10× average.',
        'Memory ~100 ns, SSD ~10–100 µs, intra-DC RTT ~0.5 ms, cross-continent ~100–150 ms.',
        'Time budget: clarify 5, estimate 5, API/data 5, high level 10, deep dives 10–15, failures + trade-offs 5–10 minutes.',
      ],
    },
    references: [
      { title: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' },
      { title: 'High Performance Browser Networking', url: 'https://hpbn.co/' },
      { title: 'Amazon Builders\' Library', url: 'https://aws.amazon.com/builders-library/' },
      { title: 'Static stability using Availability Zones', url: 'https://aws.amazon.com/builders-library/static-stability-using-availability-zones/' },
    ],
  },
  {
    id: 'infra-craft-behavioral',
    title: 'Senior behavioural interviews',
    stage: 9,
    order: 2,
    objectives: ['craft-behavioral'],
    scope: 'senior',
    estMinutes: 25,
    summary:
      'Behavioural rounds decide levelling as often as technical ones. Prepare a bank of quantified STAR+L stories that show scope, ownership, influence, judgment under ambiguity and growth from failure, and map each to the themes interviewers probe.',
    what: `Behavioural interviews ask about past situations ("tell me about a time...") on the premise that past behaviour predicts future behaviour. For senior and staff roles they are a primary **levelling** signal: the same story told at team scope reads as mid-level, told at multi-team scope with business impact reads as senior or staff.

**STAR+L** gives each story a shape:
- **Situation** – the context in one or two sentences: system, team, stakes.
- **Task** – your responsibility or goal, and why it was hard.
- **Action** – what *you* did, specifically, including decisions and trade-offs. The bulk of the story.
- **Result** – the measurable outcome.
- **Learning** – what you would do differently and what you changed afterwards.`,
    why: `Infrastructure work is high-leverage and high-blast-radius: interviewers need evidence you can lead an incident, drive a migration across teams, push back on an unsafe deadline and mentor others. Many strong engineers under-level because their stories are vague ("we improved reliability"), use "we" throughout, or describe tasks instead of decisions.`,
    problem: `Common failure patterns:

- **Rambling situation**, little action: five minutes of context and one sentence of what you did.
- **"We" not "I"**: the interviewer cannot tell your contribution.
- **No numbers**: no before/after, no scale, no business impact.
- **Wrong scope** for the level: a senior candidate whose biggest story is a single ticket.
- **Fake failures**: "my weakness is I work too hard"; or failure stories that blame others.
- **No preparation**: improvising stories under pressure, repeating the same story for every question.`,
    how: `**Build a story bank.** Write 8–12 stories from the last few years, each in STAR+L form in a few bullet points. Tag each with the themes it demonstrates. Aim for every theme to be covered by at least two stories so you never repeat within a loop.

**Themes to cover (senior signals):**
- **Scope** – work that spanned teams, systems or quarters.
- **Ownership** – you saw a problem nobody owned and fixed it end to end, including the unglamorous parts.
- **Influence without authority** – convincing peer teams or leadership with data, prototypes, or by reducing their cost of saying yes.
- **Ambiguity** – turning a vague goal into a plan with milestones and decision points.
- **Mentoring and multiplying** – making others better: reviews, docs, paved roads, on-call training.
- **Judgment** – a trade-off where you chose speed vs safety, build vs buy, or pushed back on a risky plan.
- **Conflict and disagreement** – disagreeing well, committing once decided.
- **Failure** – a real mistake, owned, with systemic follow-up.

**Quantify impact.** Before and after numbers: "pages per week from 30 to 4", "p99 from 900 ms to 180 ms", "deploy lead time from 3 days to 2 hours", "cut $40k/month in transfer costs", "migrated 120 services across 6 teams in two quarters with zero customer-facing incidents". If exact numbers are confidential, use relative ones (percentages, orders of magnitude).

**Balance the time.** Roughly 10–15% situation and task, 60–70% action, 15–20% result and learning. Aim for 2–3 minutes per story, then let the interviewer probe; follow-ups are where depth and authenticity show.

**Say "I" for your decisions, "we" for team outcomes.** Name the specific choices you made and the alternatives you rejected.

**Handling "tell me about a failure".** Pick a real failure with real consequences, where you were the cause or the owner (not a teammate). Structure: what happened, your part in it, how you detected and mitigated it, the impact, the blameless systemic fix (process, tooling, guardrail) and evidence it worked. Show you changed something durable, not only that you "learned to be more careful".

**Calibrate to level.** Senior: you led a significant project or incident and made the key technical calls. Staff: you set direction across teams, changed how the organisation works, and dealt with org-level trade-offs. Choose stories accordingly.`,
    components: [
      { name: 'STAR+L', description: 'Situation, Task, Action, Result, Learning. Action is the centre of gravity; Learning separates senior from mid-level.' },
      { name: 'Story bank', description: '8–12 prepared stories, each tagged with themes, covering every theme at least twice.' },
      { name: 'Senior signals', description: 'Scope, ownership, influence without authority, ambiguity, mentoring, judgment.' },
      { name: 'Impact quantification', description: 'Before/after metrics, scale, business outcome; relative numbers when absolute ones are confidential.' },
      { name: 'Failure story', description: 'Real, owned, with blameless systemic fixes and evidence they worked.' },
    ],
    misconceptions: [
      { myth: 'Behavioural rounds are a formality after the technical ones.', reality: 'They frequently decide the level and sometimes the hire. Under-prepared behavioural answers are a common reason strong engineers get down-levelled.' },
      { myth: 'Saying "we" shows you are a team player.', reality: 'It hides your contribution. Credit the team for outcomes, but be specific about your own decisions and actions.' },
      { myth: 'A failure story should end with a positive spin quickly.', reality: 'Interviewers want depth on cause, ownership and systemic change. Rushing past the failure looks evasive.' },
    ],
    example: {
      title: 'A quantified STAR+L story (influence without authority)',
      description: `Condensed bullet form, as it would appear in a story bank.`,
      language: 'text',
      code: `Themes: influence without authority, scope, judgment
S: 40 services on 6 teams deployed via hand-run scripts; change failure rate ~25%,
   two Sev-1s in a quarter from bad deploys.
T: I was a senior SRE with no authority over product teams; goal: progressive
   delivery for all tier-1 services within two quarters.
A: - Pulled deploy and incident data to show 70% of Sev-1/2s were deploy-triggered.
   - Built a canary template with automated rollback; migrated my own team first.
   - Paired with one product team per week; removed their cost to adopt (PRs written for them).
   - Negotiated a staged policy with eng leadership: required for tier-1 only.
R: 34/40 services migrated in 5 months; change failure rate 25% -> 8%;
   zero deploy-caused Sev-1s in the following two quarters.
L: I underinvested in docs early and became a bottleneck; next time I'd train
   two champions per team in month one.`,
    },
    exercise: {
      prompt: `Draft your story bank: list 8 stories with one-line STAR summaries, tag each with themes from the list (scope, ownership, influence, ambiguity, mentoring, judgment, conflict, failure), and check that every theme has at least two stories. Then write the full STAR+L for your failure story with at least two numbers.`,
      solution: `- A good bank has a mix: an incident you led, a migration across teams, a cost or performance win, a disagreement with a manager or peer team, someone you mentored to promotion or on-call readiness, a project you killed or descoped, and a real failure.
- **Check the grid:** every theme at least twice; no story carries more than 3–4 themes (it becomes vague).
- **Failure story checklist:** you caused or owned it; impact quantified (e.g. "40 minutes of checkout errors for ~8% of users"); your detection and mitigation; the systemic fix (e.g. "added a deny-replace policy on stateful resources and a pre-apply plan review"); evidence (e.g. "it blocked three similar changes in the next six months").
- **Rehearse aloud** to 2–3 minutes each and practise answering two follow-ups per story ("what would you do differently?", "how did you get the other team to agree?").`,
    },
    faq: [
      { q: 'How many stories do I really need?', a: 'Eight to twelve well-prepared stories cover most loops, because each can answer several questions. Breadth of themes matters more than count.' },
      { q: 'What if my best work is confidential?', a: 'Abstract the specifics (no customer or product names), keep the shape and relative numbers. Interviewers care about your reasoning and impact, not secrets.' },
      { q: 'How do I show staff-level scope if my title was senior?', a: 'Choose stories where you set direction across teams, changed a process or standard others adopted, or made an org-level trade-off. Scope of impact matters more than title.' },
    ],
    keyTerms: ['STAR+L', 'story bank', 'scope', 'ownership', 'influence without authority', 'ambiguity', 'judgment', 'quantified impact', 'failure story', 'levelling'],
    deeper: `**Blameless framing transfers.** The same culture that makes good postmortems (focus on systems and incentives, not individual fault) makes good failure stories: explain the conditions that made the mistake possible and how you changed them. It signals that you would make the team safer, not just yourself more careful.`,
    interview: {
      seniorAnswer: `Come with a prepared, theme-mapped bank of 8–12 STAR+L stories. In each answer, spend most of the time on your actions and decisions (including alternatives you rejected), state measurable before/after results, and finish with a genuine learning and what you changed because of it. Match the scope to the level you are targeting: cross-team, multi-quarter, business-relevant. For failure questions, own a real mistake, describe impact honestly, and show the systemic, blameless fix and evidence it worked.`,
      followUps: [
        { q: 'Tell me about a time you disagreed with your manager.', a: 'Show that you disagreed with data, proposed an alternative, escalated proportionately, and committed once a decision was made, plus how it turned out and what you learned about influencing.' },
        { q: 'What would you do differently?', a: 'Always have a concrete answer prepared for each story: a decision you would make earlier, a stakeholder you would involve sooner, or a guardrail you would add. "Nothing" is a red flag.' },
        { q: 'How did you measure success?', a: 'Name the metric before and after, how it was measured, and the time frame, e.g. "change failure rate from DORA-style tracking, 25% to 8% over two quarters".' },
      ],
      redFlags: [
        'Uses "we" throughout; personal contribution unclear.',
        'No numbers in any story.',
        'Failure story blames others or is a disguised strength.',
        'Same story reused for every question.',
        'Stories at task scope for a senior/staff role.',
      ],
      numbers: [
        '8–12 stories; every theme covered at least twice.',
        '2–3 minutes per story before follow-ups.',
        'Time split: ~15% situation/task, ~65% action, ~20% result and learning.',
      ],
    },
    references: [
      { title: 'Tech Interview Handbook: behavioral interviews', url: 'https://www.techinterviewhandbook.org/behavioral-interview/' },
      { title: 'Postmortem culture (SRE book)', url: 'https://sre.google/sre-book/postmortem-culture/' },
    ],
  },
];
