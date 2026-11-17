import type { InfraDomainId, InfraQuestion, InfraTopicId, Reference } from '../types';

const DOMAIN: Partial<Record<InfraTopicId, InfraDomainId>> = {
  'auto-iac': 'automation',
  'auto-delivery': 'automation',
  'obs-signals': 'observability',
  'obs-performance': 'observability',
  'arch-frameworks': 'architecture-cost',
  'arch-finops': 'architecture-cost',
  'craft-system-design': 'interview-craft',
  'craft-behavioral': 'interview-craft',
};

const R = {
  tfDocs: { title: 'Terraform documentation', url: 'https://developer.hashicorp.com/terraform/docs' },
  tfState: { title: 'Terraform state', url: 'https://developer.hashicorp.com/terraform/language/state' },
  opa: { title: 'Open Policy Agent documentation', url: 'https://www.openpolicyagent.org/docs/latest/' },
  twelve: { title: 'The Twelve-Factor App', url: 'https://12factor.net/' },
  slsa: { title: 'SLSA framework', url: 'https://slsa.dev/' },
  builders: { title: 'Amazon Builders’ Library', url: 'https://aws.amazon.com/builders-library/' },
  sreBook: { title: 'Google SRE book', url: 'https://sre.google/sre-book/table-of-contents/' },
  sreWorkbook: { title: 'Google SRE workbook', url: 'https://sre.google/workbook/table-of-contents/' },
  monitoring: { title: 'SRE book: Monitoring distributed systems', url: 'https://sre.google/sre-book/monitoring-distributed-systems/' },
  sloAlerting: { title: 'SRE workbook: Alerting on SLOs', url: 'https://sre.google/workbook/alerting-on-slos/' },
  slo: { title: 'SRE book: Service level objectives', url: 'https://sre.google/sre-book/service-level-objectives/' },
  otel: { title: 'OpenTelemetry documentation', url: 'https://opentelemetry.io/docs/' },
  use: { title: 'Brendan Gregg: The USE method', url: 'https://www.brendangregg.com/usemethod.html' },
  linuxPerf: { title: 'Brendan Gregg: Linux performance', url: 'https://www.brendangregg.com/linuxperf.html' },
  overload: { title: 'SRE book: Handling overload', url: 'https://sre.google/sre-book/handling-overload/' },
  awsWa: { title: 'AWS Well-Architected', url: 'https://aws.amazon.com/architecture/well-architected/' },
  azWa: { title: 'Azure Well-Architected Framework', url: 'https://learn.microsoft.com/en-us/azure/well-architected/' },
  gcpFw: { title: 'Google Cloud Architecture Framework', url: 'https://cloud.google.com/architecture/framework' },
  migration: { title: 'AWS migration strategies', url: 'https://docs.aws.amazon.com/prescriptive-guidance/latest/large-migration-guide/migration-strategies.html' },
  staticStab: { title: 'Static stability using Availability Zones', url: 'https://aws.amazon.com/builders-library/static-stability-using-availability-zones/' },
  finops: { title: 'FinOps Framework', url: 'https://www.finops.org/framework/' },
  vpc: { title: 'What is Amazon VPC?', url: 'https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html' },
  primer: { title: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' },
  behavioral: { title: 'Tech Interview Handbook: Behavioral interviews', url: 'https://www.techinterviewhandbook.org/behavioral-interview/' },
  cascading: { title: 'SRE book: Addressing cascading failures', url: 'https://sre.google/sre-book/addressing-cascading-failures/' },
  postmortem: { title: 'SRE book: Postmortem culture', url: 'https://sre.google/sre-book/postmortem-culture/' },
} satisfies Record<string, Reference>;

interface Draft {
  difficulty: 1 | 2 | 3;
  prompt: string;
  choices: string[];
  answer: number[];
  explanation: string;
  choiceRationale: string[];
  references: Reference[];
  tags: string[];
}

const q = (topic: InfraTopicId, n: number, d: Draft): InfraQuestion => ({
  id: `iq-${topic}-${String(n).padStart(3, '0')}`,
  domain: DOMAIN[topic]!,
  objective: topic,
  lessonId: `infra-${topic}`,
  type: d.answer.length > 1 ? 'multi' : 'single',
  ...d,
});

export const infraQuestions3: InfraQuestion[] = [
  // ---------------------------------------------------------------- auto-iac
  q('auto-iac', 1, {
    difficulty: 2,
    prompt:
      "All production infrastructure (shared network, databases and 40 services) lives in one Terraform root module with a single state. Plans take 25 minutes, and last week a typo in one service's module produced a plan that would have replaced a shared route table. What is the best structural fix?",
    choices: [
      'Require engineers to run `terraform apply -target` for the resources they changed',
      'Split into separate root modules and states by lifecycle and blast radius (network, data, per-service), passing values via outputs or data sources',
      'Increase `-parallelism` so plans finish faster and reviewers have more time to read them',
      'Add `prevent_destroy` to every resource in the configuration',
    ],
    answer: [1],
    explanation:
      'A single state couples every change to every resource: plans are slow, locks are contended and any mistake can touch shared foundations. Splitting states along lifecycle and ownership boundaries shrinks the blast radius of each apply and makes plans fast enough to review. Stable layers (network) change rarely and are consumed read-only by faster-moving service stacks.',
    choiceRationale: [
      'Routine `-target` use is documented as an exceptional tool; it hides dependency changes and lets state drift from config.',
      'Correct: state boundaries are the primary blast-radius control in Terraform.',
      'Faster plans do not reduce what a single apply can break.',
      'Blocks destruction but also blocks legitimate replacements, and does nothing for in-place damaging updates.',
    ],
    references: [R.tfState, R.tfDocs],
    tags: ['terraform', 'state', 'blast-radius'],
  }),
  q('auto-iac', 2, {
    difficulty: 3,
    prompt:
      'During an incident an on-call engineer opened a security group rule in the console to restore traffic from a new partner CIDR. The scheduled drift-detection plan now shows Terraform will remove that rule on the next apply. What is the best next step?',
    choices: [
      'Add `lifecycle { ignore_changes = all }` to the security group so console fixes are never reverted',
      'Run a refresh-only apply so state matches reality and close the ticket',
      'Codify the rule in the Terraform config through a reviewed PR, apply so plan returns to no-op, and record the break-glass change in the incident follow-ups',
      'Revoke console write access immediately, then let the next apply remove the rule so config stays the source of truth',
    ],
    answer: [2],
    explanation:
      'Drift after a break-glass fix is expected; the goal is to reconcile intent back into code without re-breaking production. Updating config via PR makes the emergency change reviewed, durable and visible, and a clean plan proves convergence. Ignoring changes or only refreshing state leaves code that no longer describes the system, which is how the next rebuild silently loses the fix.',
    choiceRationale: [
      'Hides all future drift on a security-critical resource; IaC stops being authoritative.',
      'State would record the rule, but config still lacks it, so a later plan or rebuild will remove it.',
      'Correct: reconcile in code, prove a no-op plan, and track the break-glass usage.',
      'Reverting a live mitigation would re-cause the outage; tightening access is a separate follow-up.',
    ],
    references: [R.tfState, R.tfDocs],
    tags: ['terraform', 'drift', 'break-glass'],
  }),
  q('auto-iac', 3, {
    difficulty: 2,
    prompt:
      'Your Terraform state lives in an object-storage bucket and several CI pipelines can apply concurrently. Select TWO practices that most reduce risk.',
    choices: [
      'Enable state locking so two applies cannot write the same state at once',
      'Commit a copy of the state file to Git after every apply for auditability',
      'Mark secret outputs as `sensitive`, which keeps them out of the state file',
      'Encrypt the state at rest, enable bucket versioning, and restrict read access, because state can contain secrets in plaintext',
    ],
    answer: [0, 3],
    explanation:
      'Concurrent writers without a lock can corrupt state or lose resources from tracking. State frequently contains secret values (generated passwords, keys), so it must be treated as a secret itself: encrypted, access-controlled and versioned for recovery. `sensitive` only redacts values from CLI output; they are still stored in state.',
    choiceRationale: [
      'Correct: locking serialises writers to one state.',
      'Spreads secrets into Git history and creates a second, stale source of truth.',
      'Incorrect: `sensitive` affects display only; the value is still persisted in state.',
      'Correct: protects confidentiality and enables rollback of a bad state write.',
    ],
    references: [R.tfState],
    tags: ['terraform', 'state', 'secrets'],
  }),
  q('auto-iac', 4, {
    difficulty: 1,
    prompt:
      'You want policy as code (for example OPA/Rego rules) to stop a publicly readable storage bucket before it is ever created. Where should the check run?',
    choices: [
      'In CI against the machine-readable plan output, failing the pipeline before apply',
      'Only in a nightly cloud scanner that flags public buckets after creation',
      'Only as variable validation blocks inside the bucket module',
      'In a pre-commit hook on developer laptops',
    ],
    answer: [0],
    explanation:
      'Evaluating the plan JSON in CI sees the exact resources and attributes about to be created, regardless of which module produced them, and blocks before anything exists. Runtime scanners are a valuable second layer but detect after exposure. Module validation is bypassed by anyone who does not use the module, and laptop hooks are optional.',
    choiceRationale: [
      'Correct: preventive, central and independent of module choice.',
      'Detective only; the bucket is already exposed when flagged.',
      'Only covers callers of that module and only its inputs.',
      'Easily skipped; not an enforcement point.',
    ],
    references: [R.opa, R.tfDocs],
    tags: ['policy-as-code', 'opa', 'guardrails'],
  }),
  q('auto-iac', 5, {
    difficulty: 3,
    prompt:
      'A refactor moves `aws_db_instance.main` into a new `module.database`. The plan now shows the production database will be destroyed and recreated. What is the safest correct fix?',
    choices: [
      'Add `create_before_destroy` so a new database exists before the old one is removed',
      'Add `prevent_destroy` and apply; Terraform will then update in place',
      'Take a snapshot, apply during a maintenance window, and restore data into the new instance',
      'Declare a `moved` block (or run a state move) from the old address to the new module address so Terraform treats it as the same object',
    ],
    answer: [3],
    explanation:
      'The resource did not change; only its address did, and Terraform keys objects by address. A `moved` block records the rename in code so every environment applying the refactor migrates state consistently and the plan becomes a no-op. Lifecycle flags address replacement behaviour, not identity.',
    choiceRationale: [
      'Still replaces the database, with a new endpoint and empty data.',
      'Makes the plan fail rather than fixing the address mismatch.',
      'Turns a refactor into a risky data migration with downtime.',
      'Correct: maps the old address to the new one; reviewable and repeatable across environments.',
    ],
    references: [R.tfState, R.tfDocs],
    tags: ['terraform', 'refactoring', 'state'],
  }),
  q('auto-iac', 6, {
    difficulty: 2,
    prompt:
      'You manage dev, staging and prod for the same platform. Prod needs bigger instances and multi-AZ databases. Which layout best balances consistency and safety?',
    choices: [
      'Copy-paste a directory per environment and edit each one independently',
      'One root module and one state, with `count` per environment on every resource',
      'Versioned shared modules, one thin root config and separate state per environment with environment-specific variables, promoted through the pipeline',
      'One root module using `terraform.workspace` conditionals throughout resources to express prod-only differences',
    ],
    answer: [2],
    explanation:
      'Shared versioned modules keep environments structurally identical, while separate states isolate blast radius so a dev apply can never touch prod. Differences live in explicit variables, and promoting a module version dev to staging to prod mirrors artifact promotion. Copy-paste diverges silently; scattered conditionals make prod behaviour impossible to test elsewhere.',
    choiceRationale: [
      'Environments drift apart and fixes must be repeated by hand.',
      'One state couples all environments; a dev mistake can destroy prod.',
      'Correct: consistency from modules, isolation from state, differences as data.',
      'Hidden branching means staging no longer exercises prod code paths.',
    ],
    references: [R.tfDocs, R.twelve],
    tags: ['terraform', 'environments', 'modules'],
  }),

  // ----------------------------------------------------------- auto-delivery
  q('auto-delivery', 1, {
    difficulty: 3,
    prompt:
      'A service handles 2,000 rps with a 0.1% baseline error rate. You run a 1% canary for 10 minutes. Roughly how many requests and expected baseline errors does the canary see, and what does that imply?',
    choices: [
      '~12,000 requests and ~12 expected errors; only large regressions are statistically detectable, so lengthen the bake or raise the canary weight for subtle ones',
      '~120,000 requests and ~120 errors; a 10% regression is easily detectable',
      '~1,200 requests and ~1 error; canaries are useless below 10% traffic',
      '~12,000 requests; any single extra error proves a regression and should trigger rollback',
    ],
    answer: [0],
    explanation:
      '2,000 x 1% = 20 rps, x 600 s = 12,000 requests; at 0.1% that is about 12 errors. Poisson noise on 12 is about ±3.5 (sqrt 12), so a 25% regression (15 errors) is invisible and only roughly a doubling (about 24, ~3 sigma) stands out; detecting subtle regressions needs more samples: longer bake, staged weights, or comparing against a concurrent baseline cohort. Seniors size canaries from traffic and SLO, not by habit.',
    choiceRationale: [
      'Correct arithmetic and the right conclusion about statistical power.',
      'Off by 10x on traffic.',
      'Off by 10x, and small canaries still catch crashes and gross regressions.',
      'Single-error triggers produce constant false rollbacks given Poisson noise.',
    ],
    references: [R.sreWorkbook, R.builders],
    tags: ['canary', 'progressive-delivery', 'statistics'],
  }),
  q('auto-delivery', 2, {
    difficulty: 2,
    prompt:
      'A release renames a database column from `addr` to `address`. You deploy with blue/green and want instant rollback. Which approach preserves that?',
    choices: [
      'Run the rename in the same deploy; blue/green switches traffic atomically so both versions are fine',
      'Deploy the code first and run the rename after green is healthy',
      'Take a snapshot before cutover and restore it if rollback is needed',
      'Expand/contract: add `address`, dual-write and backfill, switch reads, and only drop `addr` after the old version can no longer return',
    ],
    answer: [3],
    explanation:
      'Blue/green only swaps compute; both colours share the same database, so every schema state must work with both N and N-1 code. Expand/contract spreads a breaking change across several backward-compatible deploys. Restoring snapshots loses writes made since the cutover, which is not a rollback.',
    choiceRationale: [
      'Blue (old code) breaks the instant the column disappears.',
      'Green breaks until the rename runs, and rollback after it breaks blue.',
      'Data loss and long RTO; not an instant rollback.',
      'Correct: each step is compatible with the adjacent code versions.',
    ],
    references: [R.builders, R.twelve],
    tags: ['blue-green', 'schema-migration', 'rollback'],
  }),
  q('auto-delivery', 3, {
    difficulty: 2,
    prompt:
      'You are shipping a rewritten checkout flow. Product wants it live for internal users first, then 5% of customers, with the ability to turn it off in seconds without a deploy. What do you use?',
    choices: [
      'Blue/green deploy with a full traffic switch',
      'Deploy the code dark behind a feature flag, ramp by cohort, and keep a kill switch',
      'A long-lived release branch merged when QA signs off',
      'A pod-level canary at 5% of replicas',
    ],
    answer: [1],
    explanation:
      'Flags decouple deploy from release: code ships continuously, exposure is targeted by user cohort, and disabling is a config change measured in seconds. Pod-level canaries cannot target internal users and give inconsistent experiences across requests without stickiness. The cost is flag debt, so flags need owners and removal dates.',
    choiceRationale: [
      'All-or-nothing; no cohort targeting.',
      'Correct: cohort targeting plus seconds-to-disable.',
      'Increases merge risk and still releases all at once.',
      'Splits by replica, not user, and rollback still needs a deploy.',
    ],
    references: [R.builders, R.sreWorkbook],
    tags: ['feature-flags', 'progressive-delivery', 'release'],
  }),
  q('auto-delivery', 4, {
    difficulty: 1,
    prompt: 'Which practice best guarantees that what you tested in staging is exactly what runs in production?',
    choices: [
      'Rebuild the image in each environment from the same Git tag',
      'Pin base images by tag such as `:latest-stable`',
      'Build once, then promote the same immutable artifact digest through environments, injecting config at deploy time',
      'Run the full test suite again in production after deploy',
    ],
    answer: [2],
    explanation:
      'Rebuilds can pull different dependencies or base layers, so the same tag can yield different bits. Promoting a single digest, with environment config supplied separately, makes staging evidence apply to prod and supports provenance attestations. This is the twelve-factor separation of build, release and run.',
    choiceRationale: [
      'Non-reproducible builds can differ between environments.',
      'Mutable tags can move underneath you.',
      'Correct: same bits everywhere; only config differs.',
      'Late detection, not a guarantee of sameness.',
    ],
    references: [R.twelve, R.slsa],
    tags: ['artifacts', 'promotion', 'immutability'],
  }),
  q('auto-delivery', 5, {
    difficulty: 3,
    prompt: 'Your platform team is adopting pull-based GitOps (for example Argo CD or Flux). Select TWO statements that are accurate.',
    choices: [
      'Rollback is always instant, because `git revert` bypasses the reconciliation loop',
      'An in-cluster agent continuously reconciles live state to Git, so manual `kubectl` drift is detected and reverted',
      'CI no longer needs cluster-admin credentials, since the cluster pulls changes rather than CI pushing them',
      'GitOps removes the need for a separate secrets-management solution',
    ],
    answer: [1, 2],
    explanation:
      'Pull-based GitOps moves deploy credentials inside the cluster boundary and makes Git the desired state that an agent converges on, which also corrects drift. Rollback still goes through reconciliation and is only as safe as the change being reverted (schemas, data migrations). Secrets must not be stored in plaintext in Git; you still need sealed or external secrets.',
    choiceRationale: [
      'A revert is reconciled like any commit and cannot undo data or schema side effects.',
      'Correct: continuous reconciliation is the core mechanism.',
      'Correct: shrinks the credential blast radius of CI.',
      'Plaintext secrets in Git are a serious leak; you still need a secrets solution.',
    ],
    references: [R.slsa, R.builders],
    tags: ['gitops', 'kubernetes', 'security'],
  }),
  q('auto-delivery', 6, {
    difficulty: 3,
    prompt:
      'Version 2 of a producer started emitting a new message format to a queue. Errors spiked, you rolled producers back to v1, but consumers that were also upgraded to v2 now fail on old messages, and v1 consumers fail on the v2 messages still in the queue. What practice would have prevented this?',
    choices: [
      'Purging the queue before every rollback',
      'Making consumers tolerant of both formats first, then switching producers in a later release, so N and N-1 are always mutually compatible',
      'Deploying producers and consumers together in one atomic release',
      'Pausing consumers during deploys until the queue drains',
    ],
    answer: [1],
    explanation:
      'Asynchronous systems have data in flight, so a deploy is never atomic across producers, consumers and stored messages. Readers must accept old and new formats before any writer emits the new one, and writers keep N-1 compatibility until rollback is no longer possible. This makes both roll-forward and rollback safe.',
    choiceRationale: [
      'Destroys business data to fix a compatibility bug.',
      'Correct: tolerant reader first, then writer, makes every step reversible.',
      'There is no atomic deploy across services and in-flight messages.',
      'Adds downtime and backlog without fixing format incompatibility.',
    ],
    references: [R.builders, R.cascading],
    tags: ['rollback', 'compatibility', 'messaging'],
  }),

  // ------------------------------------------------------------- obs-signals
  q('obs-signals', 1, {
    difficulty: 2,
    prompt:
      'A request-count metric has labels endpoint (20 values), status (5) and pod (50). A developer wants to add `user_id` (2 million active users) to debug per-customer issues. What is the right response?',
    choices: [
      'Fine: series grow linearly by 2 million, which modern TSDBs handle',
      'Add it but lower the scrape interval to compensate',
      'Add it, but only on error responses',
      'Reject it: today ~5,000 series could become millions or more; put `user_id` on traces and structured logs (linking via exemplars) instead',
    ],
    answer: [3],
    explanation:
      'Series count is the product of label cardinalities: 20 x 5 x 50 = 5,000 today. Multiplying by an unbounded user dimension can produce millions to billions of series, blowing up memory, query latency and cost. High-cardinality identifiers belong in traces and logs, which are indexed per event rather than per series.',
    choiceRationale: [
      'Growth is multiplicative, not additive.',
      'Scrape interval does not change series count.',
      'Errors across 2 million users still explode cardinality.',
      'Correct: keep metrics low-cardinality; use events for identifiers.',
    ],
    references: [R.monitoring, R.otel],
    tags: ['metrics', 'cardinality', 'cost'],
  }),
  q('obs-signals', 2, {
    difficulty: 2,
    prompt: 'You are cleaning up a noisy pager rotation. Which alert most deserves to page a human at 3 a.m.?',
    choices: [
      'Fast and slow error-budget burn on the checkout availability SLO are both above threshold',
      'CPU above 90% on any node for 5 minutes',
      'A single pod restarted',
      'Disk on a log host is 70% full',
    ],
    answer: [0],
    explanation:
      'Pages should fire on user-visible symptoms that need urgent human action. Multiwindow burn-rate alerts tie paging to SLO impact and filter short blips. Cause-based signals such as CPU or restarts belong on dashboards or tickets unless they reliably predict imminent user harm.',
    choiceRationale: [
      'Correct: symptom-based, SLO-aligned and noise-filtered.',
      'High CPU may be healthy utilisation; not a user symptom.',
      'Self-healing event; ticket or dashboard at most.',
      'Slow-moving; a ticket, not a page.',
    ],
    references: [R.sloAlerting, R.monitoring],
    tags: ['alerting', 'slo', 'on-call'],
  }),
  q('obs-signals', 3, {
    difficulty: 3,
    prompt:
      'A service has a 99.9% availability SLO over 30 days. Your fast-burn page fires when 2% of the monthly error budget is consumed in 1 hour. What burn rate and sustained error rate does that threshold correspond to?',
    choices: [
      'Burn rate 2, error rate 0.2%',
      'Burn rate 14.4, error rate 14.4%',
      'Burn rate 14.4, error rate about 1.44%',
      'Burn rate 720, error rate 72%',
    ],
    answer: [2],
    explanation:
      'A 30-day window has 720 hours. Spending 2% of the budget in 1 hour means burning 0.02 x 720 = 14.4 times faster than sustainable. With a 0.1% budget, the error rate is 14.4 x 0.1% = 1.44%. At that pace the whole month of budget is gone in about 50 hours.',
    choiceRationale: [
      'Confuses the budget fraction with the burn rate.',
      'Right burn rate, but forgets to multiply by the 0.1% budget.',
      'Correct: 0.02 x 720 = 14.4; 14.4 x 0.1% = 1.44%.',
      'Uses 720 as the rate rather than scaling by 2%.',
    ],
    references: [R.sloAlerting, R.slo],
    tags: ['burn-rate', 'slo', 'computation'],
  }),
  q('obs-signals', 4, {
    difficulty: 3,
    prompt: 'Your tracing uses 1% head-based sampling and keeps missing the rare slow or failed requests. You evaluate tail-based sampling in the collector. Select TWO accurate statements.',
    choices: [
      'Tail sampling removes all instrumentation overhead from application processes',
      'The keep/drop decision is made after spans for a trace are collected, so policies can keep all errors and slow traces',
      'Request-rate metrics computed from the sampled traces remain accurate without adjustment',
      'Collectors must buffer spans and route all spans of a trace to the same instance, which adds memory cost and stateful scaling',
    ],
    answer: [1, 3],
    explanation:
      'Head sampling decides at the root before outcome is known, so rare failures are dropped at the sampling rate. Tail sampling decides with the full trace in view, but every span must still be exported and held until the decision, and the trace must land on one collector (trace-ID-aware load balancing). Biased sampling also distorts rate metrics, so derive RED metrics before sampling.',
    choiceRationale: [
      'Applications still create and export every span; overhead moves, it does not disappear.',
      'Correct: outcome-aware retention is the main benefit.',
      'Keeping all errors biases the sample; rates need pre-sampling metrics.',
      'Correct: the operational cost of tail sampling.',
    ],
    references: [R.otel],
    tags: ['tracing', 'sampling', 'opentelemetry'],
  }),
  q('obs-signals', 5, {
    difficulty: 1,
    prompt: 'Which pairing of method to target is most appropriate?',
    choices: [
      'USE (utilisation, saturation, errors) for request-driven services; RED for disks',
      'RED (rate, errors, duration) for request-driven services; USE for resources such as CPU, disks and connection pools',
      'RED only for databases; USE only for load balancers',
      'Both methods measure the same things, so pick one org-wide',
    ],
    answer: [1],
    explanation:
      'RED describes what a service delivers to its callers and maps directly to SLIs. USE describes the health of each resource and is the fastest way to find a saturated bottleneck. In practice you alert on RED symptoms and diagnose with USE.',
    choiceRationale: [
      'Reversed.',
      'Correct: RED for services, USE for resources.',
      'Arbitrary split; both apply more broadly.',
      'They answer different questions and are complementary.',
    ],
    references: [R.use, R.monitoring],
    tags: ['red', 'use-method', 'golden-signals'],
  }),
  q('obs-signals', 6, {
    difficulty: 2,
    prompt: 'Log ingestion cost tripled in two quarters; most volume is INFO request logs and load-balancer health-check lines. Select TWO changes with the highest leverage.',
    choices: [
      'Drop or sample health-check and debug lines at the agent or collector before they reach the paid backend',
      'Move all logs to a longer hot-retention tier for faster search',
      'Switch from structured JSON to free text to save bytes',
      'Replace per-request INFO logs used only for counting with metrics, keeping full logs for errors and sampled successes',
    ],
    answer: [0, 3],
    explanation:
      'The cheapest log line is the one never ingested, so filter low-value lines at the edge. When logs exist only to count things, a metric gives the same answer at a tiny fraction of the cost and query time. Structure should be kept, because it makes the remaining logs useful.',
    choiceRationale: [
      'Correct: removes noise before it is billed.',
      'Increases cost.',
      'Saves little and destroys queryability.',
      'Correct: aggregates are far cheaper as metrics.',
    ],
    references: [R.monitoring, R.otel],
    tags: ['logging', 'cost', 'telemetry-pipeline'],
  }),

  // ---------------------------------------------------------- obs-performance
  q('obs-performance', 1, {
    difficulty: 2,
    prompt: 'An API serves a steady 1,200 rps with a mean latency of 250 ms. By Little’s law, how many requests are in flight across the system on average?',
    choices: ['30', '300', '4.8', '3,000'],
    answer: [1],
    explanation:
      'Little’s law: L = lambda x W = 1,200 /s x 0.25 s = 300 concurrent requests. This sizes worker threads, connection pools and concurrency limits. If latency doubles under a slow dependency, in-flight work doubles too, which is how pools exhaust and failures cascade.',
    choiceRationale: [
      'Off by 10x; perhaps a per-instance figure for 10 instances.',
      'Correct: 1,200 x 0.25 = 300.',
      'Divides instead of multiplying.',
      'Uses 2.5 s instead of 0.25 s.',
    ],
    references: [R.overload, R.cascading],
    tags: ['littles-law', 'concurrency', 'computation'],
  }),
  q('obs-performance', 2, {
    difficulty: 3,
    prompt:
      'A frontend request fans out in parallel to 50 backend shards and waits for all of them. Each shard independently exceeds its p99 latency on 1% of calls. Roughly what fraction of frontend requests see at least one shard above its p99?',
    choices: ['1%', '50%', '5%', 'About 40%'],
    answer: [3],
    explanation:
      'P(no slow shard) = 0.99^50, about 0.605, so about 39.5% of requests wait on at least one tail response. Fan-out turns a 1-in-100 backend event into something roughly 4 in 10 frontend requests experience. Mitigations include hedged or backup requests, tighter backend tail control, partial results and reducing fan-out width.',
    choiceRationale: [
      'Ignores the fan-out.',
      'Adds probabilities naively (50 x 1%), which overestimates.',
      'Underestimates by an order of magnitude.',
      'Correct: 1 - 0.99^50 is about 0.395.',
    ],
    references: [R.primer, R.builders],
    tags: ['tail-latency', 'fan-out', 'computation'],
  }),
  q('obs-performance', 3, {
    difficulty: 2,
    prompt: 'A 16-core Linux host shows a load average of 40 while CPU utilisation is 35% and latency is poor. What is the most likely explanation and next check?',
    choices: [
      'Many threads are blocked in uninterruptible I/O wait, which Linux counts in load average; check `vmstat 1`, `iostat -x 1` and per-process D-state',
      'The CPU is saturated; add cores',
      'The load average is wrong when utilisation is under 50%; ignore it',
      'Memory is leaking; restart the service',
    ],
    answer: [0],
    explanation:
      'Linux load average counts runnable tasks plus those in uninterruptible sleep (usually disk or NFS I/O). High load with low CPU therefore points at I/O or lock contention, not CPU. Following USE, check disk utilisation, queue depth and await before scaling CPU.',
    choiceRationale: [
      'Correct: load includes D-state tasks; USE says check disk saturation next.',
      'CPU at 35% contradicts CPU saturation.',
      'Load average is valid; it simply measures more than CPU.',
      'No evidence of memory pressure; restarting hides the cause.',
    ],
    references: [R.use, R.linuxPerf],
    tags: ['linux', 'load-average', 'use-method'],
  }),
  q('obs-performance', 4, {
    difficulty: 3,
    prompt:
      'To cut cost, a team proposes running a latency-sensitive service at 90% average CPU instead of 50%. Using a simple single-server queue model (M/M/1), what happens to mean queueing delay?',
    choices: [
      'It rises about 1.8x, in proportion to utilisation',
      'It is unchanged until utilisation reaches 100%',
      'It rises about 9x, because queueing delay scales with rho/(1 - rho), going from 1 to 9; tail latency degrades even more',
      'It falls, because busier caches are warmer',
    ],
    answer: [2],
    explanation:
      'In M/M/1, mean waiting time is proportional to rho/(1 - rho): 0.5/0.5 = 1 versus 0.9/0.1 = 9. Latency is non-linear in utilisation, which is why latency-sensitive tiers keep headroom while batch tiers can run hot. Real systems with bursty arrivals behave worse than the model.',
    choiceRationale: [
      'Assumes linear behaviour, which queueing theory refutes.',
      'Queues form well before 100%.',
      'Correct: the hockey-stick of rho/(1 - rho).',
      'Cache effects do not offset queueing growth.',
    ],
    references: [R.overload, R.use],
    tags: ['queueing', 'utilisation', 'computation'],
  }),
  q('obs-performance', 5, {
    difficulty: 3,
    prompt:
      'A multithreaded service in a container with a 2-CPU limit shows p99 spikes of roughly 50 to 100 ms while average CPU usage is only 60% of the limit and p50 is flat. What should you check first?',
    choices: [
      'DNS resolution latency on the node',
      'Garbage-collection logs only, since CPU is not the problem',
      'Disk IOPS on the node',
      'CFS quota throttling: `nr_throttled` and throttled time in the cgroup `cpu.stat`, since bursts can exhaust the quota early in each 100 ms period',
    ],
    answer: [3],
    explanation:
      'CPU limits are enforced per scheduling period (100 ms by default). Many threads bursting together can use the whole quota in the first part of the period, then sit throttled for the rest, adding tens of ms to unlucky requests even though average usage looks low. Fixes include raising or removing the limit, reducing thread counts, or right-sizing requests.',
    choiceRationale: [
      'Possible, but does not match the period-shaped spikes under a CPU limit.',
      'GC can cause pauses, but average CPU hides throttling, so averages do not rule CPU out.',
      'No evidence of I/O involvement.',
      'Correct: classic averaged-out throttling under quota.',
    ],
    references: [R.linuxPerf, R.use],
    tags: ['containers', 'cpu-throttling', 'tail-latency'],
  }),
  q('obs-performance', 6, {
    difficulty: 2,
    prompt: 'You need an accurate fleet-wide p99 latency across 20 hosts. Select TWO valid approaches.',
    choices: [
      'Sum histogram bucket counts across hosts, then compute the percentile from the merged histogram',
      'Average the 20 per-host p99 values',
      'Merge per-host mergeable quantile sketches (for example t-digest or DDSketch-style) and query p99',
      'Take the maximum of the per-host p99 values',
    ],
    answer: [0, 2],
    explanation:
      'Percentiles are not additive: averaging or taking the max of per-host p99s gives a number that does not correspond to any real distribution, and hosts with different traffic volumes skew it further. Histograms with shared bucket boundaries and mergeable sketches preserve enough of the distribution to compute a correct aggregate percentile within known error.',
    choiceRationale: [
      'Correct: bucket counts add, so the merged histogram represents the fleet.',
      'Ignores traffic weighting and distribution shape.',
      'Correct: sketches are designed to merge.',
      'An upper bound at best, often badly pessimistic.',
    ],
    references: [R.monitoring, R.otel],
    tags: ['percentiles', 'histograms', 'aggregation'],
  }),

  // ---------------------------------------------------------- arch-frameworks
  q('arch-frameworks', 1, {
    difficulty: 2,
    prompt:
      'Your data-centre lease ends in 9 months. One of 300 applications is a vendor product with no source code, a licence that permits virtual machines, and a stable workload. Which migration strategy fits best?',
    choices: [
      'Rehost (lift and shift) onto cloud VMs, then optimise later',
      'Refactor into microservices on Kubernetes',
      'Rebuild it as serverless functions',
      'Retain it on premises indefinitely, regardless of the lease',
    ],
    answer: [0],
    explanation:
      'With no source code and a hard deadline, rehosting is the fastest low-risk path and is common for the bulk of a large migration. Deep modernisation is reserved for apps where business value justifies it. Retain is a valid strategy, but the lease end removes it here unless a colocation option exists.',
    choiceRationale: [
      'Correct: fits deadline, licensing and lack of source.',
      'Impossible without source and unnecessary for a stable app.',
      'Same problem: no source code.',
      'The lease end makes indefinite retention impractical.',
    ],
    references: [R.migration, R.awsWa],
    tags: ['migration', '7rs', 'trade-offs'],
  }),
  q('arch-frameworks', 2, {
    difficulty: 3,
    prompt:
      'Leadership asks for active-active across two cloud providers to achieve 99.99% availability for a service that currently runs in a single region of one provider. What is the strongest senior recommendation?',
    choices: [
      'Agree; multi-cloud active-active is the only way to exceed 99.9%',
      'First go multi-AZ and then multi-region within one provider, with tested failover; consider multi-cloud only for specific drivers such as regulation or concentration risk, and quantify its cost',
      'Refuse; 99.99% is not achievable in the cloud',
      'Use two providers in active-passive with manual DNS failover and no regular drills',
    ],
    answer: [1],
    explanation:
      'Most outages come from your own changes (contained by progressive, zone-by-zone and region-by-region rollout) and zonal or regional faults (handled by multi-AZ and multi-region), all achievable within one provider at a fraction of the complexity. Multi-cloud doubles tooling, skills and data-replication problems and pushes you towards lowest-common-denominator services. A senior ties the choice to stated drivers and shows the cost.',
    choiceRationale: [
      'Overstates; multi-region designs commonly target 99.99%.',
      'Correct: incremental, evidence-based and cost-aware.',
      'Incorrect; well-designed multi-region systems can achieve it.',
      'Untested manual failover rarely meets its RTO.',
    ],
    references: [R.awsWa, R.gcpFw],
    tags: ['multi-cloud', 'multi-region', 'availability'],
  }),
  q('arch-frameworks', 3, {
    difficulty: 2,
    prompt:
      'A request path depends serially on three independent components with availabilities of 99.95%, 99.9% and 99.99%. What is the approximate best-case availability of the path?',
    choices: ['99.99%', '99.9%', '99.95%', 'About 99.84%'],
    answer: [3],
    explanation:
      'Serial dependencies multiply: 0.9995 x 0.999 x 0.9999 is about 0.9984. A chain is always weaker than its weakest link. Seniors use this to argue for fewer hard dependencies, redundancy (parallel components combine as 1 - product of unavailabilities) and graceful degradation.',
    choiceRationale: [
      'Takes the best component, not the product.',
      'Takes the weakest link, ignoring the others.',
      'Takes the middle value.',
      'Correct: product of availabilities.',
    ],
    references: [R.slo, R.awsWa],
    tags: ['availability', 'computation', 'dependencies'],
  }),
  q('arch-frameworks', 4, {
    difficulty: 2,
    prompt:
      'A four-person platform team needs an event streaming backbone. Event streaming is not a product differentiator. They are debating self-managing Kafka on VMs versus a managed streaming service. What is the best default?',
    choices: [
      'Self-manage; it is always cheaper',
      'Build a custom log on object storage',
      'Use the managed service, verify limits and cost at projected scale, and keep clients on standard protocols to preserve an exit path',
      'Delay the decision until traffic justifies streaming',
    ],
    answer: [2],
    explanation:
      'For a small team, the dominant cost of self-managing is engineering time for upgrades, rebalancing, capacity and on-call. Buying non-differentiating capability frees the team for product work. Due diligence on quotas, pricing at scale and portability addresses the main risks of buying.',
    choiceRationale: [
      'Ignores labour and operational risk; frequently false at this team size.',
      'Building core infrastructure from scratch is the highest-risk option.',
      'Correct: buy the undifferentiated, with explicit checks.',
      'Ignores an existing need.',
    ],
    references: [R.azWa, R.awsWa],
    tags: ['build-vs-buy', 'managed-services', 'trade-offs'],
  }),
  q('arch-frameworks', 5, {
    difficulty: 1,
    prompt: 'What is the primary output of a Well-Architected style review of a workload?',
    choices: [
      'A certification that the workload is compliant',
      'A prioritised list of risks and improvement actions with explicit trade-offs across the pillars',
      'A guarantee of a specific availability SLA',
      'An automatic remediation of all findings',
    ],
    answer: [1],
    explanation:
      'The frameworks from AWS, Azure and Google Cloud are structured ways to surface risks against pillars such as reliability, security, cost and performance. The value is a prioritised improvement plan and conscious trade-off decisions, not a certificate or guarantee.',
    choiceRationale: [
      'Not a compliance attestation.',
      'Correct: risks, priorities and trade-offs.',
      'Reviews do not create SLAs.',
      'Remediation is the team’s follow-up work.',
    ],
    references: [R.awsWa, R.azWa],
    tags: ['well-architected', 'review', 'pillars'],
  }),
  q('arch-frameworks', 6, {
    difficulty: 3,
    prompt: 'You want a three-AZ service to survive the loss of one zone without depending on any recovery actions. Select TWO design choices that provide static stability.',
    choices: [
      'Rely on autoscaling to launch replacement capacity in the surviving zones when a zone fails',
      'Pre-provision enough capacity in each zone that two zones alone can carry peak load',
      'Keep the failure path free of control-plane calls, for example no need to launch instances, change DNS or update configuration to stay up',
      'Run the database primary in one zone and restore from backup elsewhere on failure',
    ],
    answer: [1, 2],
    explanation:
      'Static stability means the system keeps working in a degraded state without making changes, because control planes are often impaired during the same event. That requires headroom already in place (about 50% extra with three zones sized for N-1) and data-plane-only failover. Restore-based designs have long RTOs and depend on extra operations.',
    choiceRationale: [
      'Depends on a control plane that may be degraded or capacity-constrained during the event.',
      'Correct: pre-provisioned N-1 capacity.',
      'Correct: avoid control-plane dependencies during recovery.',
      'Single-zone primary with restore is neither fast nor static.',
    ],
    references: [R.staticStab, R.awsWa],
    tags: ['static-stability', 'multi-az', 'resilience'],
  }),

  // -------------------------------------------------------------- arch-finops
  q('arch-finops', 1, {
    difficulty: 2,
    prompt:
      'Private-subnet workloads pull about 50,000 GB per month from object storage in the same region through a NAT gateway billed at roughly $0.045 per GB processed (approximate, provider-dependent). What is the best fix and approximate monthly saving?',
    choices: [
      'Move the workloads to public subnets with public IPs; saves about $2,250 but widens exposure',
      'Add a second NAT gateway per AZ; saves about $1,000',
      'Route storage traffic through a gateway or private endpoint for the storage service, removing NAT processing; saves about $2,250 per month',
      'Compress objects; saves about $225',
    ],
    answer: [2],
    explanation:
      '50,000 GB x $0.045 is about $2,250 per month of pure NAT processing for traffic that never leaves the provider. Private connectivity to the storage service, such as a gateway endpoint on AWS or Private Google Access or a private endpoint on other providers, removes that path and keeps traffic off the internet route. Always check endpoint pricing for your provider, as some endpoint types carry their own per-GB charge.',
    choiceRationale: [
      'Saves money by giving up the private-subnet security posture.',
      'More NAT gateways add cost; this does not save.',
      'Correct: private path for in-region service traffic.',
      'Marginal and invasive compared with fixing the route.',
    ],
    references: [R.vpc, R.finops],
    tags: ['nat', 'egress', 'computation'],
  }),
  q('arch-finops', 2, {
    difficulty: 3,
    prompt:
      'A fleet runs a steady 400 vCPU all day and peaks at 1,000 vCPU for 4 hours daily. Commitments give a 40% discount on committed vCPU whether used or not. Relative to all on-demand (normalised to 500 vCPU-equivalents per hour on average), which commitment is cheapest?',
    choices: [
      'Commit 400 vCPU: about 340 (240 committed + 100 on-demand), roughly 32% savings',
      'Commit 500 vCPU (the daily average): about 300',
      'Commit 1,000 vCPU (the peak): about 600',
      'No commitment: about 500',
    ],
    answer: [0],
    explanation:
      'Average usage is 400 + 600 x 4/24 = 500 vCPU. Committing at the floor: 400 x 0.6 = 240, plus peak overflow 600 x 4/24 = 100 on demand, totalling 340. Committing 500 costs 300 plus 500 x 4/24, about 83, so roughly 383, because 100 vCPU sit idle 20 hours a day. Commit to the reliable floor and serve peaks with on-demand, spot or autoscaling.',
    choiceRationale: [
      'Correct: covering the baseline maximises utilisation of the commitment.',
      'Ignores the on-demand overflow during peaks; the true total is about 383.',
      'Paying for 600 idle vCPU for 20 hours a day costs more than on-demand.',
      'Baseline, but leaves the discount unused.',
    ],
    references: [R.finops],
    tags: ['commitments', 'coverage', 'computation'],
  }),
  q('arch-finops', 3, {
    difficulty: 2,
    prompt:
      'The CFO flags that the cloud bill grew 30% quarter over quarter. Over the same period, orders grew 50%. What is the most accurate framing?',
    choices: [
      'Efficiency worsened by 30%; freeze new spend',
      'Efficiency is unchanged because both numbers grew',
      'The bill should have grown 50%, so the team underspent',
      'Cost per order fell about 13% (1.3 / 1.5 is about 0.87); report unit cost alongside the total and watch for components where it is rising',
    ],
    answer: [3],
    explanation:
      'Unit economics separate growth from efficiency. Cost per order went from 1.0 to 1.3/1.5, about 0.87, a 13% improvement despite the larger bill. FinOps practice reports unit cost trends to engineering and finance together, then digs into the services where unit cost is moving the wrong way.',
    choiceRationale: [
      'Ignores the denominator.',
      'Different growth rates mean efficiency changed.',
      'Spend is not a target to hit.',
      'Correct: unit cost improved and is the right metric.',
    ],
    references: [R.finops],
    tags: ['unit-economics', 'finops', 'computation'],
  }),
  q('arch-finops', 4, {
    difficulty: 1,
    prompt: '35% of monthly cloud spend cannot be attributed to any team. What is the best first move?',
    choices: [
      'Immediately charge back the untagged cost to every team equally',
      'Enforce required ownership tags at provisioning via policy, align accounts or projects to owners, and start with showback before chargeback',
      'Ask each team to tag resources manually by the end of the quarter',
      'Delete untagged resources after 24 hours',
    ],
    answer: [1],
    explanation:
      'Allocation needs prevention (policy-enforced tags and account or project structure) and visibility (showback) before financial accountability (chargeback). Equal splits remove incentives, manual cleanup decays, and deleting untagged resources risks outages.',
    choiceRationale: [
      'Unfair and gives no signal about who is driving the cost.',
      'Correct: enforce at creation, structure by owner, show back first.',
      'No enforcement; coverage erodes again.',
      'Dangerous; can delete production resources.',
    ],
    references: [R.finops],
    tags: ['tagging', 'showback', 'allocation'],
  }),
  q('arch-finops', 5, {
    difficulty: 2,
    prompt:
      'Chatty microservices spread across three AZs exchange about 200 TB per month across zones. Assume cross-AZ transfer costs roughly $0.01/GB in each direction (approximate). What is the best mitigation?',
    choices: [
      'Prefer same-zone endpoints with topology-aware routing, falling back to other zones only when local capacity is unhealthy, which can save a large share of roughly $4,000 per month',
      'Move everything into a single AZ to eliminate the charge',
      'Compress payloads; this removes the charge entirely',
      'Ignore it; data transfer is always negligible',
    ],
    answer: [0],
    explanation:
      '200,000 GB x $0.02 (both directions) is about $4,000 per month. Zone-aware routing keeps most traffic local while retaining multi-AZ resilience, as long as each zone has enough capacity and failover remains automatic. Consolidating into one zone trades a cost line for a large availability risk.',
    choiceRationale: [
      'Correct: cuts cross-zone traffic without giving up zone redundancy.',
      'Saves money by removing AZ fault tolerance.',
      'Reduces bytes, not the per-GB charge on what remains.',
      'At this volume transfer is a material line item.',
    ],
    references: [R.finops, R.vpc],
    tags: ['data-transfer', 'cross-az', 'computation'],
  }),
  q('arch-finops', 6, {
    difficulty: 2,
    prompt: 'Spot or preemptible capacity is 60 to 90% cheaper but can be reclaimed with short notice. Select TWO workloads that are good fits.',
    choices: [
      'Stateless batch rendering jobs that checkpoint progress and can retry',
      'The single primary node of a production relational database',
      'CI build and test runners that can simply rerun interrupted jobs',
      'A latency-critical stateful singleton with no replica',
    ],
    answer: [0, 2],
    explanation:
      'Spot suits work that is interruption-tolerant: stateless, retryable, checkpointed or horizontally redundant. Losing a database primary or an unreplicated singleton causes an outage or data risk. Diversifying instance types and zones improves spot availability further.',
    choiceRationale: [
      'Correct: checkpoints bound lost work.',
      'Interruption causes failover or downtime on the most critical node.',
      'Correct: reruns are cheap.',
      'No redundancy; interruption is an outage.',
    ],
    references: [R.finops, R.awsWa],
    tags: ['spot', 'preemptible', 'workload-fit'],
  }),

  // ------------------------------------------------------ craft-system-design
  q('craft-system-design', 1, {
    difficulty: 1,
    prompt: 'The interviewer says: "Design a URL shortener." What is the best next step?',
    choices: [
      'Start drawing the database schema',
      'Pick the tech stack so the interviewer knows you are hands-on',
      'Clarify functional scope and non-functional requirements (scale, read/write ratio, latency, availability, retention) and agree on them before designing',
      'Jump to a deep dive on hash collision handling',
    ],
    answer: [2],
    explanation:
      'Senior candidates scope the problem first: what is in and out, the scale and the quality bar. These drive every later decision, and stating assumptions out loud shows judgement. Schemas, technologies and deep dives come after a shared understanding exists.',
    choiceRationale: [
      'Premature; the schema depends on requirements.',
      'Technology choices without requirements look like pattern matching.',
      'Correct: clarify and agree first.',
      'Deep dives belong after the high-level design.',
    ],
    references: [R.primer],
    tags: ['interview-method', 'requirements', 'scoping'],
  }),
  q('craft-system-design', 2, {
    difficulty: 2,
    prompt: 'After you present your design, the interviewer asks: "What happens if the cache cluster goes down?" Which response is strongest?',
    choices: [
      'It will not; the cache is replicated',
      'Quantify the impact (for example a 95% hit rate means the database suddenly sees about 20x the load), then describe mitigations such as request coalescing, load shedding and a staged warm-up, and the trade-off of each',
      'Add a second cache cluster in another region',
      'Say you would look at the dashboards and decide then',
    ],
    answer: [1],
    explanation:
      'Interviewers probe failure modes to see whether you reason about blast radius and degradation. Quantifying the impact (a miss rate going from 5% to 100% is 20x origin load) shows the cascading-failure risk, and naming mitigations with costs shows operational maturity. Dismissing or deferring the question is a red flag.',
    choiceRationale: [
      'Dismisses the failure mode; replicated systems still fail.',
      'Correct: impact, mechanism, mitigations, trade-offs.',
      'Adds cost without addressing the thundering-herd risk.',
      'Defers rather than reasoning.',
    ],
    references: [R.primer, R.cascading],
    tags: ['interview-method', 'failure-modes', 'caching'],
  }),
  q('craft-system-design', 3, {
    difficulty: 2,
    prompt: 'You estimate 100 million daily active users each making about 10 writes per day. Which capacity statement is the most reasonable to say out loud?',
    choices: [
      'About 1 billion writes per day, roughly 12k writes per second on average; I will plan for about 2 to 3x that at peak, so around 30k per second',
      'About 100k writes per second on average',
      'About 1,200 writes per second, so a single database is plenty',
      'Exact numbers do not matter in system design interviews',
    ],
    answer: [0],
    explanation:
      '100M x 10 = 1B per day; dividing by about 86,400 seconds gives about 11.6k per second. Real traffic is diurnal and bursty, so a stated peak multiplier is expected. Rounded numbers with explicit assumptions are what interviewers want, because they drive sharding and storage decisions.',
    choiceRationale: [
      'Correct: right arithmetic and an explicit peak factor.',
      'Overestimates by roughly 10x.',
      'Underestimates by 10x and draws the wrong conclusion.',
      'Estimates justify the architecture; skipping them is a red flag.',
    ],
    references: [R.primer],
    tags: ['estimation', 'capacity', 'computation'],
  }),
  q('craft-system-design', 4, {
    difficulty: 3,
    prompt:
      'Halfway through, the interviewer adds that users in three continents must be able to write with low latency. Your design uses a single-leader database in one region. What is the best move?',
    choices: [
      'Keep the design and say read replicas in each region will handle it',
      'Silently redraw the diagram with a different database',
      'Ask the interviewer to drop the requirement because it is out of scope',
      'Say explicitly that the single-leader choice no longer meets the requirement, present options (home-region partitioning by user, multi-leader with conflict resolution, or a globally consistent database with higher write latency), pick one with trade-offs, and update the design',
    ],
    answer: [3],
    explanation:
      'Requirements changing mid-interview is often a deliberate test of adaptability. Naming the broken assumption, laying out options and their consistency and latency costs, then committing to one shows senior judgement. Read replicas do not address write latency, and hiding the change loses the reasoning signal.',
    choiceRationale: [
      'Replicas help reads, not cross-continent writes.',
      'Loses the signal; the interviewer wants to hear the reasoning.',
      'Avoids the test rather than engaging with it.',
      'Correct: acknowledge, compare options, decide, adapt.',
    ],
    references: [R.primer, R.gcpFw],
    tags: ['interview-method', 'trade-offs', 'multi-region'],
  }),

  // -------------------------------------------------------- craft-behavioral
  q('craft-behavioral', 1, {
    difficulty: 2,
    prompt: 'Which STAR answer best demonstrates influence without authority?',
    choices: [
      'I escalated to our VP, who directed the other team to adopt our logging standard',
      'I quietly rewrote the other team’s pipeline myself over a weekend so they would not have to',
      'The other team agreed because I was the most senior engineer in the room',
      'I measured how many incidents traced back to inconsistent logging, prototyped the standard with one willing team, addressed the main objection (migration effort) with a tool, and three teams adopted it voluntarily within a quarter',
    ],
    answer: [3],
    explanation:
      'Influence without authority shows up as data, empathy for the other side’s constraints, a low-friction path and voluntary adoption with a measured result. Escalation and title-based persuasion are authority, and doing others’ work unasked does not change minds or scale.',
    choiceRationale: [
      'Uses someone else’s authority; escalation should be a last resort.',
      'Bypasses ownership and builds no buy-in.',
      'Relies on seniority as authority.',
      'Correct: evidence, pilot, objection handling and measurable voluntary adoption.',
    ],
    references: [R.behavioral],
    tags: ['behavioral', 'influence', 'star'],
  }),
  q('craft-behavioral', 2, {
    difficulty: 2,
    prompt: '"Tell me about a time you failed." Which answer is strongest for a senior role?',
    choices: [
      'I pushed a config change without a staged rollout and caused a 40-minute partial outage; I led the mitigation, wrote the blameless postmortem, and drove a change requiring progressive rollout for config, which has since caught two bad changes',
      'I work too hard and sometimes take on too much',
      'A project failed because another team missed their deadline',
      'I have not really failed at anything significant',
    ],
    answer: [0],
    explanation:
      'Interviewers look for genuine ownership, quantified impact, what you did in the moment and a durable systemic fix with evidence that it worked. Disguised strengths, blaming others or claiming no failures all signal low self-awareness.',
    choiceRationale: [
      'Correct: real mistake, impact, ownership, systemic fix and proof.',
      'A disguised strength; not a failure.',
      'Externalises blame and shows no learning.',
      'Signals low self-awareness or low risk-taking.',
    ],
    references: [R.behavioral, R.postmortem],
    tags: ['behavioral', 'failure', 'ownership'],
  }),
  q('craft-behavioral', 3, {
    difficulty: 1,
    prompt: 'While telling an incident story you keep saying "we". The interviewer asks, "What did you specifically do?" What is the best response?',
    choices: [
      'Repeat that it was a team effort and everyone contributed equally',
      'Take credit for the whole outcome to sound senior',
      'State your own decisions and actions concretely (for example, I took incident command, chose to roll back rather than patch forward, and ran the comms), while crediting others for their parts',
      'Change to a different story',
    ],
    answer: [2],
    explanation:
      'The interviewer needs to evaluate you, not the team. Naming your specific decisions and why you made them gives that signal, and crediting others shows collaboration without claiming their work. Overclaiming is often exposed by follow-up questions.',
    choiceRationale: [
      'Leaves the interviewer unable to assess you.',
      'Overclaiming erodes credibility.',
      'Correct: clear personal contribution with honest credit.',
      'Avoids the question.',
    ],
    references: [R.behavioral],
    tags: ['behavioral', 'star', 'ownership'],
  }),
  q('craft-behavioral', 4, {
    difficulty: 3,
    prompt: 'For a staff-level loop, which "Result" statement best signals staff scope?',
    choices: [
      'We shipped the feature on time because I worked several weekends',
      'Sev-1 incidents across six teams fell from 9 to 2 per quarter after I proposed and drove adoption of a deploy-safety standard, which is now part of the org’s golden path',
      'I fixed a tricky production bug in under an hour',
      'Everyone was happy with how it turned out',
    ],
    answer: [1],
    explanation:
      'Staff scope means multi-team impact through durable mechanisms, with a measured outcome. The strongest result shows breadth (six teams), a metric with a before and after, and institutionalisation (golden path). Heroics, individual fixes and vague sentiment show task-level scope.',
    choiceRationale: [
      'Heroics are not sustainable and show individual scope.',
      'Correct: cross-team, measured, durable mechanism.',
      'Valuable but individual and tactical.',
      'No measurable result.',
    ],
    references: [R.behavioral],
    tags: ['behavioral', 'scope', 'impact'],
  }),
];
