import type { InfraLesson } from '../types';

/** Stages 3–5: Distributed Systems, Reliability & SRE, Security & Identity. */
export const infraLessons2: InfraLesson[] = [
  // ---------------------------------------------------------------- Stage 3: Distributed Systems
  {
    id: 'infra-dist-theory',
    title: 'Distributed systems theory: consistency, consensus and clocks',
    stage: 3,
    order: 1,
    objectives: ['dist-theory', 'data-databases'],
    scope: 'senior',
    estMinutes: 35,
    summary:
      'CAP stated correctly, PACELC, the consistency ladder from linearizable to eventual, quorum arithmetic, Raft, why clocks lie, and how fencing tokens stop split brain from corrupting data.',
    what: `Distributed systems theory is the small set of results that tell you what is **impossible**, what is **expensive**, and what is merely **hard** when state lives on more than one machine connected by an unreliable network.

- **CAP**: when a network **partition** happens, a replicated system must choose, for the affected operations, between **consistency** (linearizability: every read sees the latest completed write or a newer one, in real-time order) and **availability** (every request to a non-failed node gets a non-error response). It says nothing about the normal, healthy case.
- **PACELC** extends it: if **P**artition, choose **A** or **C**; **E**lse (normal operation), choose **L**atency or **C**onsistency. The "else" half is what you pay every day.
- **Consistency models** describe which histories a client can observe. **Consensus** (Raft, Paxos) is how a group of nodes agrees on one ordered log despite crashes. **Clocks** decide whether "before" means anything across machines.`,
    why: `Almost every senior design question hides a consistency question: "can two users buy the last seat?", "can a deleted permission still grant access?", "what does a replica return during failover?". Interviewers use this topic to separate engineers who repeat "CAP: pick two" from those who can say **which operations** need linearizability, **what it costs in round trips**, and **what breaks** when the leader is partitioned.

Operationally, the theory explains real incidents: stale reads after failover, two primaries both accepting writes (split brain), lease expiry during a long GC pause, and lost updates from last-writer-wins on skewed clocks.`,
    problem: `Networks drop, delay, duplicate and reorder messages, and a slow node is indistinguishable from a dead one. That creates three concrete problems:

- **Failure detection is guesswork.** A timeout only says "no reply yet". Declare death too fast and you fail over a healthy-but-slow leader; too slow and you sit unavailable.
- **Replicas diverge.** With asynchronous replication, the primary can acknowledge a write and crash before a replica has it; failover then loses the write.
- **Time is not shared.** NTP keeps clocks within roughly milliseconds on a good network but can step, drift or be wrong by much more on a bad day, so wall-clock timestamps cannot safely order events on different machines.`,
    how: `**1. Pick the consistency model per operation, not per system.** From strongest to weakest:

- **Linearizable**: operations appear to take effect atomically at one instant between call and return, in real-time order. Needed for locks, leader election, uniqueness and balances. Costs a quorum round trip (and cross-region latency if replicas span regions).
- **Sequential**: all clients see one total order consistent with each client's program order, but not necessarily real time.
- **Causal**: operations that are causally related are seen in order by everyone; concurrent ones may differ.
- **Session guarantees** such as **read-your-writes** and monotonic reads: a single client never sees its own write disappear. Often implemented by sticky routing or by reading at a version no older than the client's last write.
- **Eventual**: replicas converge if writes stop; no bound on staleness.

**2. Quorums.** With N replicas, write to W and read from R. If **R + W > N**, every read set intersects every write set, so a read can see the latest acknowledged write (with versioning to pick it). N=3, W=2, R=2 tolerates one node down for both reads and writes. N=3, W=3, R=1 gives fast reads but any single failure blocks writes. Caveats: **sloppy quorums** with hinted handoff break the intersection, and concurrent writes still need conflict resolution, so R+W>N alone is not linearizability.

**3. Consensus with Raft.** Time is divided into numbered **terms**.
- Followers expect heartbeats from the leader. If none arrives within a **randomized election timeout** (the paper suggests on the order of 150–300 ms), a follower becomes a candidate, increments the term, votes for itself and sends RequestVote.
- A node grants at most one vote per term and only to a candidate whose log is **at least as up to date** as its own. A majority of votes makes a leader. Randomization makes split votes rare.
- The leader appends client commands to its log and replicates via AppendEntries. An entry is **committed** once stored on a majority (and the entry is from the current term); only then is it applied and acknowledged.
- A deposed leader that sees a higher term steps down. Because any two majorities overlap, a committed entry survives any leader change. A 5-node group tolerates 2 failures; a 3-node group tolerates 1. Even sizes add cost without adding tolerance.

**4. Clocks.** Use **monotonic** clocks for durations and timeouts, never wall time. For ordering, use **logical clocks** (Lamport counters; vector clocks to detect concurrency) or **hybrid logical clocks** (HLC: a physical timestamp plus a logical counter, which stays close to wall time but never goes backwards and respects causality). Google Spanner instead bounds clock uncertainty with TrueTime and **waits out** the uncertainty interval before committing.

**5. Split brain and fencing.** A leader holding a lease can pause (GC, VM migration) past lease expiry, wake up, and still believe it is leader. The fix is a **fencing token**: the lock service issues a monotonically increasing number with each lease (Raft's term works), the leader sends it with every write, and the storage layer **rejects any token lower than the highest it has seen**. Safety then no longer depends on clocks.`,
    components: [
      { name: 'CAP / PACELC', description: 'CAP constrains behaviour **only during a partition**; PACELC adds the everyday latency vs consistency trade-off. Classify per operation: e.g. Dynamo-style stores lean PA/EL, Spanner-style lean PC/EC.' },
      { name: 'Consistency models', description: 'Linearizable > sequential > causal > session guarantees (read-your-writes, monotonic reads) > eventual. Each step down removes coordination and latency, and adds anomalies the application must tolerate.' },
      { name: 'Quorums', description: 'R + W > N guarantees read/write set overlap. Tune W and R for read-heavy vs write-heavy load and for which failures you must survive.' },
      { name: 'Consensus (Raft / Paxos)', description: 'Majority-replicated log with terms and leader election. Basis of etcd, Consul, ZooKeeper-like coordination and many distributed databases. Tolerates f failures with 2f+1 nodes.' },
      { name: 'Clocks and ordering', description: 'Physical clocks drift and step; logical, vector and hybrid logical clocks give causal ordering; bounded-uncertainty clocks (TrueTime) enable external consistency at the cost of commit wait.' },
      { name: 'Fencing tokens', description: 'Monotonic tokens checked by the resource itself, so a zombie leader with an expired lease cannot write.' },
    ],
    misconceptions: [
      { myth: 'CAP means you pick any two of consistency, availability and partition tolerance.', reality: 'Partitions are not optional on real networks. CAP says that **when** one occurs you must sacrifice C or A for the affected operations. Without a partition you can have both; the real everyday trade-off is latency vs consistency (PACELC).' },
      { myth: 'R + W > N makes a quorum store linearizable.', reality: 'It guarantees overlap, not linearizability. Sloppy quorums, concurrent writes, last-writer-wins on skewed clocks and read repair timing can still produce anomalies. Linearizability needs consensus or careful read/write protocols.' },
      { myth: 'Synchronized NTP clocks are good enough to order writes across servers.', reality: 'NTP skew is typically milliseconds but unbounded on bad days, and clocks can jump. Last-writer-wins by wall clock silently drops writes. Use logical/hybrid clocks, versions, or consensus.' },
      { myth: 'A distributed lock with a TTL guarantees mutual exclusion.', reality: 'A paused holder can outlive its lease. Only a fencing token checked by the protected resource makes it safe.' },
    ],
    example: {
      title: 'Quorum and failure arithmetic for a 5-node, 3-AZ store',
      description: `Work the numbers aloud: what each configuration survives and what it costs. Assume intra-AZ RTT ~0.5 ms and cross-AZ RTT ~1–2 ms (order of magnitude).`,
      language: 'text',
      code: `Replicas N = 5 placed 2 / 2 / 1 across AZ-a, AZ-b, AZ-c

Config A: W=3, R=3   (R+W=6 > 5, overlap guaranteed)
  - survives 2 node failures for reads AND writes
  - lose AZ-a (2 nodes): 3 left -> still W=3, R=3  OK
  - write latency = 3rd-fastest ack ~ cross-AZ RTT (~1-2 ms)

Config B: W=5, R=1   (fast reads)
  - any single node failure blocks ALL writes -> poor availability

Config C: W=1, R=1   (R+W=2 <= 5)
  - fast, always available, reads may be stale: eventual only

Raft group of 5 (majority = 3):
  - tolerates 2 failures; losing AZ-a + one more node -> 2 left -> no leader, writes stop
  - leader election ~ election timeout (150-300 ms) + one RequestVote round
  - 4 nodes would still need 3 for majority -> tolerates only 1: no gain

Split brain check:
  old leader term=7 paused 20 s; new leader elected term=8
  old leader wakes, sends write with token 7 -> storage has seen 8 -> REJECT`,
    },
    exercise: {
      prompt: `A payments team stores account balances in a multi-region database with asynchronous cross-region replication and reads from the local region. Users report that after topping up, the balance sometimes shows the old value, and during a regional failover a top-up was lost. Explain each symptom in consistency terms and propose fixes with their latency cost.`,
      solution: `- **Stale balance after top-up** is a **read-your-writes** violation: the write went to one replica, the read hit another that had not caught up. Fix cheaply with session consistency: route the user's reads to the write region for a short window, or attach the write's version/LSN to the session and have replicas wait (or redirect) until they have applied it. No cross-region cost on most reads.
- **Lost top-up on failover** is the asynchronous-replication **RPO > 0** problem: the primary acknowledged before any other region had the write. Fix by making balance writes **synchronous to a quorum spanning regions** (consensus-backed), accepting an extra cross-region round trip (tens of ms) on writes, or by keeping a single home region per account and failing over only after confirming replication lag is zero.
- Balances need **linearizable** writes (no double spend); browse-only data such as transaction history can stay eventual. Say this distinction explicitly.`,
    },
    faq: [
      { q: 'Is a single-leader database with sync replicas CP or AP?', a: `For writes it is CP-leaning: if the leader cannot reach its synchronous replica, it blocks or fails writes rather than diverge. Reads from async replicas are AP-ish (available, possibly stale). Classify per operation, not per product.` },
      { q: 'Why does Raft use majorities rather than all nodes?', a: `Any two majorities intersect, so a new leader is guaranteed to have every committed entry, while still tolerating a minority of failures. Requiring all nodes would make every single failure an outage.` },
      { q: 'Where do vector clocks show up in practice?', a: `In Dynamo-style stores and CRDT systems to detect **concurrent** updates (neither happened-before the other) so they can be merged or surfaced as siblings instead of silently overwritten.` },
    ],
    keyTerms: ['CAP theorem', 'PACELC', 'linearizability', 'read-your-writes', 'quorum (R + W > N)', 'Raft term', 'hybrid logical clock', 'split brain', 'fencing token'],
    deeper: `The FLP result shows that deterministic consensus is impossible in a fully asynchronous system with even one crash, which is why every practical protocol relies on timeouts (partial synchrony) for **liveness** while keeping **safety** independent of timing. Jepsen's consistency map is the best single picture of how models relate, including serializability (a transaction property) vs linearizability (a single-object, real-time property); "strict serializable" is both. Most databases default to weaker isolation (often read committed), and some engines' "serializable" or "repeatable read" levels are actually snapshot isolation, which permits write skew.`,
    interview: {
      seniorAnswer: `A strong answer states CAP precisely (a constraint **during partitions**), immediately moves to PACELC because latency is the everyday cost, and classifies **operations**: uniqueness, locks and money need linearizable writes via consensus or a single leader; feeds, counters and caches tolerate eventual or session consistency. It quantifies: a Raft write costs one majority round trip, so placing replicas across regions adds tens of milliseconds per write; 5 nodes tolerate 2 failures, 4 nodes still only 1. It names the failure modes (async failover losing acknowledged writes, stale reads, split brain from paused leaders) and their mitigations (synchronous quorum, session tokens, fencing tokens, monotonic clocks for timeouts).`,
      followUps: [
        { q: 'How would you implement read-your-writes on top of async read replicas?', a: `Return the commit position (LSN/version) with the write; store it in the session; on read, send to a replica whose applied position is at least that, or fall back to the primary. Alternatively, pin the user to the primary for a few seconds after a write.` },
        { q: 'Why not run a 2-node consensus cluster?', a: `Majority of 2 is 2, so any one failure halts it, and a partition cannot be distinguished from a peer crash. Use 3 (tolerates 1) or 5 (tolerates 2), spread across failure domains, or add a lightweight witness/arbiter.` },
        { q: 'What does a leader lease buy you, and what does it risk?', a: `It lets the leader serve linearizable reads locally without a quorum round trip, relying on bounded clock drift. If clocks drift beyond the assumed bound or the leader pauses, a deposed leader can serve **stale reads** while a new leader exists. Writes through the Raft log stay safe (term checks reject the old leader), but side effects on external resources still need fencing tokens.` },
        { q: 'How does Spanner get external consistency?', a: `TrueTime returns an interval with bounded uncertainty; a transaction picks a commit timestamp and waits until that timestamp is guaranteed to be in the past everywhere (commit wait) before making the result visible, so timestamp order matches real-time order.` },
      ],
      redFlags: [
        'Saying "we chose AP" for an entire system without naming which operations can tolerate staleness.',
        'Ordering events across machines by wall-clock timestamps.',
        'Proposing an even-sized consensus cluster or a cluster placed in a single AZ.',
        'Relying on a TTL lock for correctness with no fencing at the resource.',
        'Treating "eventually consistent" as having a bounded or small delay by default.',
      ],
      numbers: [
        'Raft/Paxos: 2f+1 nodes tolerate f failures (3 -> 1, 5 -> 2)',
        'Raft election timeout in the paper: ~150-300 ms randomized',
        'Quorum overlap rule: R + W > N; typical N=3, W=2, R=2',
        'Intra-AZ RTT ~0.5 ms, cross-AZ ~1-2 ms, cross-region tens to 100+ ms (order of magnitude)',
        'NTP skew: usually milliseconds, unbounded in failure cases',
      ],
    },
    references: [
      { title: 'Raft consensus algorithm', url: 'https://raft.github.io/' },
      { title: 'Jepsen: Consistency models', url: 'https://jepsen.io/consistency' },
      { title: 'The System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' },
    ],
  },
  {
    id: 'infra-dist-patterns',
    title: 'Resilience patterns: timeouts, retries, breakers and load shedding',
    stage: 3,
    order: 2,
    objectives: ['dist-patterns'],
    scope: 'senior',
    estMinutes: 35,
    summary:
      'How to stop one slow dependency from taking down a fleet: timeout budgets, bounded retries with full jitter, idempotency keys, circuit breakers, bulkheads, token buckets, load shedding and backpressure.',
    what: `Resilience patterns are the client- and server-side mechanisms that keep a service healthy when its dependencies are slow, failing or overloaded.

- **Client side**: timeouts, retries with exponential backoff and jitter, idempotency keys, circuit breakers, hedged requests.
- **Server side**: rate limiting (token bucket), concurrency limits and bulkheads, load shedding, backpressure, graceful degradation.

Together they turn "dependency is slow" from a cascading outage into a bounded, partial degradation.`,
    why: `The most common large outages are not a single crash but a **cascade**: a dependency slows down, callers hold threads and connections waiting, retries multiply load, queues grow, latency exceeds client timeouts, and everything upstream falls over. A senior engineer is expected to know the exact mechanics and the defaults that prevent it, because these settings live in every service config and are frequently wrong (infinite timeouts, retries at every layer, no jitter).`,
    problem: `Consider a 3-tier call path: edge -> API -> service -> database. The database gets slow (lock contention, failover). Without protection:

- Each layer waits for its default timeout (often 30–60 s or none), so worker pools fill with blocked requests.
- Each layer retries 3 times. Retries compound **multiplicatively**: 3 layers x 3 attempts = up to **27 attempts** at the database for one user click, arriving exactly when it is weakest.
- Retries without jitter synchronize into waves. Clients time out but the server keeps doing the now-useless work.
- When the database recovers, the backlog plus retry storm knocks it over again (a **metastable** failure that persists after the trigger is gone).`,
    how: `**1. Timeouts with a budget.** Every network call gets a timeout. Set it from the dependency's latency distribution (for example slightly above its p99.9) and from the caller's **deadline**: if the user-facing SLO is 1 s, the edge sets a 1 s deadline and propagates the **remaining** budget downstream (gRPC deadlines do this natively). A downstream call that cannot finish within the remaining budget should not start.

**2. Retries, bounded and in one place.** Retry only transient errors (timeouts, 503, connection reset), only idempotent operations, and ideally at **one layer** (usually closest to the caller, or the edge). Cap attempts (2–3) and add a **retry budget**: retries may be at most ~10% of requests per client, so a widespread failure cannot multiply load.

**3. Exponential backoff with full jitter.** \`sleep = random(0, min(cap, base * 2^attempt))\`. Exponential growth spreads retries over time; full jitter de-correlates clients so they do not arrive in synchronized waves.

**4. Idempotency keys.** For non-idempotent operations (create payment), the client generates a unique key per logical operation and sends it on every attempt. The server stores key -> result (with a TTL, e.g. 24 h) atomically with the side effect; a duplicate returns the stored result. This makes retries safe across timeouts where the client does not know whether the first attempt succeeded.

**5. Circuit breaker.** Three states:
- **Closed**: calls flow; failures and slow calls are counted over a rolling window.
- **Open**: when the failure rate exceeds a threshold (e.g. 50% over at least 20 calls), calls fail fast (or use a fallback) for a cool-down period.
- **Half-open**: a few trial calls are allowed; success closes the breaker, failure re-opens it.
This frees threads immediately and gives the dependency room to recover.

**6. Bulkheads.** Separate pools (threads, connections, queues, even cells) per dependency or tenant so one slow dependency can exhaust only its own pool.

**7. Rate limiting with a token bucket.** A bucket holds up to **b** tokens and refills at **r** tokens/s; each request consumes one; empty bucket means reject (HTTP 429 with Retry-After). It allows bursts of size b while bounding the average rate to r. Apply per client/tenant and globally.

**8. Load shedding and backpressure.** When the server is past its capacity (concurrency or queue time above a threshold), reject early and cheaply instead of queuing; prioritize critical traffic (checkout over recommendations). Drop requests whose client deadline has already passed. Bound every queue; use **LIFO or deadline-aware** dequeuing under overload so fresh requests succeed. Backpressure propagates "slow down" upstream (bounded queues, 429/503, TCP flow control, reactive streams) instead of letting memory grow.`,
    components: [
      { name: 'Timeouts and deadlines', description: 'Per-call timeouts derived from dependency latency; end-to-end deadline propagated so downstream work stops when the caller has given up.' },
      { name: 'Retries with backoff and full jitter', description: 'Bounded attempts, transient errors only, one layer, retry budget (~10%), randomized exponential delay.' },
      { name: 'Idempotency keys', description: 'Client-generated unique key per logical operation; server dedupes and returns the original result, making retries safe for side effects.' },
      { name: 'Circuit breaker', description: 'Closed -> open on failure threshold -> half-open probes -> closed. Fails fast to protect callers and the struggling dependency.' },
      { name: 'Bulkheads and concurrency limits', description: 'Isolated pools per dependency/tenant; adaptive concurrency limits that shrink when latency rises.' },
      { name: 'Rate limiting, load shedding, backpressure', description: 'Token bucket per tenant; reject early with 429/503 under overload; prioritize critical paths; bounded queues.' },
    ],
    misconceptions: [
      { myth: 'More retries make a system more reliable.', reality: 'Retries help with rare, independent, transient faults. During a real overload they multiply load (27x across 3 layers of 3 attempts) and turn a slowdown into an outage. Bound them, budget them and retry in one layer.' },
      { myth: 'A long timeout is safer because fewer requests fail.', reality: 'Long timeouts hold threads and connections, which is exactly how a slow dependency exhausts a caller. Fail fast and fall back; a timeout longer than the caller\'s own deadline is pure waste.' },
      { myth: 'Exponential backoff alone prevents retry storms.', reality: 'Without jitter, all clients that failed at the same moment retry at the same moments. Full jitter is what spreads them out.' },
      { myth: 'Circuit breakers replace timeouts.', reality: 'A breaker needs timeouts to detect slowness in the first place, and it acts on aggregate rates. Use both.' },
    ],
    example: {
      title: 'Retry amplification and a token bucket, worked numerically',
      description: `Numbers you can derive on a whiteboard, then the fixed policy.`,
      language: 'text',
      code: `BEFORE: edge -> api -> svc -> db, each layer: 3 attempts, 30 s timeout
  1 user request -> up to 3 x 3 x 3 = 27 db calls
  normal load 2,000 rps at db; 10% start timing out
  extra db load ~ 2,000 x 0.10 x 26 = ~5,200 rps extra -> db saturated -> 100% fail

AFTER:
  deadline 1,000 ms set at edge, propagated
  timeouts: api->svc 400 ms, svc->db 150 ms (db p99.9 = 120 ms)
  retries: only at api, max 2 attempts, retry budget 10% of requests
  backoff: sleep = random(0, min(1000 ms, 50 ms * 2^attempt))
  breaker on svc->db: open if >=50% failures over >=20 calls in 10 s; 5 s cool-down
  worst-case amplification: 2x per user request, capped at 1.1x fleet-wide

Token bucket per tenant: r = 100 req/s, b = 200
  idle tenant bursts 200 requests instantly, then sustains 100/s
  tenant sending 300/s for 10 s: accepted = 200 + 100*10 = 1,200; rejected 1,800 (429)`,
    },
    exercise: {
      prompt: `A checkout service calls inventory (p99 80 ms), pricing (p99 50 ms) and a recommendations service (p99 300 ms, frequently degraded). Checkout's SLO is p99 < 800 ms. Design the timeout, retry, breaker and bulkhead configuration, and say what happens to the page when recommendations is down.`,
      solution: `- Edge sets an 800 ms deadline. Inventory and pricing timeouts ~150 ms and ~100 ms (above p99.9, below budget), one retry each with jitter only if remaining budget allows; inventory reservation uses an **idempotency key** so the retry cannot double-reserve.
- Recommendations: timeout ~250 ms, **no retry**, separate bulkhead pool (small fixed concurrency), circuit breaker that opens on error/slow-call rate and returns an empty or cached list.
- Call inventory and pricing in parallel; recommendations asynchronously or in parallel with a hard cutoff.
- When recommendations is down, the breaker opens, checkout renders without recommendations, and checkout latency and availability are unaffected: **graceful degradation**. Alert on breaker state but do not page checkout on-call for it.`,
    },
    faq: [
      { q: 'When should I use hedged requests?', a: `For idempotent reads with long tail latency: send a second request after the first exceeds roughly the p95, take whichever returns first, and cancel the other. Cap hedges (a few % of traffic) so they do not become load amplification.` },
      { q: 'Should the server or the client decide to retry?', a: `The client decides, but the server should signal retryability (429/503 with Retry-After vs 400). Servers under load should shed cheaply so the signal arrives fast.` },
      { q: 'What is a metastable failure?', a: `A state where the system stays overloaded even after the trigger is removed, sustained by its own feedback loop (retries, cache misses, queue backlog). Breaking it usually needs load shedding, dropping the backlog, or temporarily blocking traffic.` },
    ],
    keyTerms: ['timeout budget', 'deadline propagation', 'retry amplification', 'full jitter', 'idempotency key', 'circuit breaker', 'bulkhead', 'token bucket', 'load shedding', 'backpressure'],
    deeper: `Adaptive concurrency limits (inspired by TCP congestion control, e.g. AIMD or gradient algorithms) adjust a service's allowed in-flight requests based on observed latency, which avoids hand-tuning fixed limits. Google's SRE material describes client-side adaptive throttling: each client tracks requests vs accepts and probabilistically rejects locally when the backend is rejecting, so overload is shed before it reaches the network.`,
    interview: {
      seniorAnswer: `A strong answer starts from the cascade mechanism (slow dependency -> resource exhaustion -> retries amplify -> metastable overload) and walks through defences layer by layer with numbers: deadlines propagated from the user SLO, per-call timeouts near the dependency's p99.9, retries at one layer only with 2–3 attempts, full jitter and a ~10% retry budget, idempotency keys for side effects, a breaker with explicit thresholds, bulkheads per dependency, token-bucket limits per tenant, and load shedding that prioritizes critical traffic and drops expired requests. It names what degrades gracefully and what must fail, and how you would test it (fault injection of latency, not just errors).`,
      followUps: [
        { q: 'Why does full jitter beat "equal jitter" or no jitter?', a: `Full jitter spreads retries uniformly over the whole backoff window, minimizing collisions and total work in contention; AWS's analysis found it gives the lowest load among the common variants at a small latency cost.` },
        { q: 'How do you store idempotency keys safely?', a: `In the same transaction as the side effect (or with a unique constraint), with request fingerprint to reject key reuse with different payloads, a TTL longer than the client's maximum retry horizon, and a stored response to replay.` },
        { q: 'FIFO or LIFO queue under overload?', a: `Under overload, FIFO serves the oldest requests, whose clients have often already timed out. LIFO or deadline-aware dequeue serves fresh requests that can still succeed; combine with dropping expired items.` },
        { q: 'How would you test these patterns?', a: `Inject latency and partial failure (not just hard errors) in staging and in controlled production experiments; verify breaker trips, shed rate, and that p99 of unaffected endpoints holds.` },
      ],
      redFlags: [
        'Retrying at every layer, or retrying non-idempotent writes without a key.',
        'No timeouts, or default 30–60 s client timeouts on internal calls.',
        'Exponential backoff with no jitter.',
        'Unbounded in-memory queues as a "buffer" for overload.',
        'Treating a circuit breaker as a replacement for capacity planning.',
      ],
      numbers: [
        'Retry amplification: attempts^layers (3 layers x 3 attempts = 27x)',
        'Retry budget: ~10% of requests',
        'Max attempts: 2-3 with exponential backoff + full jitter',
        'Timeout: slightly above dependency p99.9 and below remaining deadline',
        'Token bucket: sustained rate r, burst b',
      ],
    },
    references: [
      { title: "AWS Builders' Library: Timeouts, retries and backoff with jitter", url: 'https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/' },
      { title: "AWS Builders' Library: Making retries safe with idempotent APIs", url: 'https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/' },
      { title: 'Google SRE book: Addressing cascading failures', url: 'https://sre.google/sre-book/addressing-cascading-failures/' },
      { title: 'Martin Fowler: CircuitBreaker', url: 'https://martinfowler.com/bliki/CircuitBreaker.html' },
    ],
  },
  {
    id: 'infra-dist-messaging',
    title: 'Queues and streams: delivery semantics, ordering and the outbox',
    stage: 3,
    order: 3,
    objectives: ['dist-messaging'],
    scope: 'senior',
    estMinutes: 35,
    summary:
      'Queue vs log, why at-least-once plus idempotent consumers is the real-world contract, per-partition ordering, consumer lag, DLQs and poison messages, the transactional outbox and sagas.',
    what: `Asynchronous messaging decouples producers from consumers in time and rate. Two families:

- **Message queue** (SQS on AWS, Service Bus queues on Azure, Pub/Sub subscriptions on Google Cloud, RabbitMQ): messages are delivered to one of many competing consumers, **acknowledged and removed**. Good for work distribution.
- **Log / stream** (Apache Kafka and its managed offerings, Kinesis Data Streams on AWS, Event Hubs on Azure): an append-only, **retained**, partitioned log. Consumers track their own **offset**; many independent consumer groups can read the same data and **replay** it. Good for event distribution, change data capture and rebuilding state.`,
    why: `Messaging is how large systems absorb spikes, isolate failures and integrate services, and it is the source of a predictable class of bugs: duplicates, out-of-order events, lost events between a database write and a publish, poison messages that block a partition, and lag that silently grows for hours. Interviewers probe whether you know that "exactly-once" is a scoped guarantee and how you make the end-to-end pipeline correct anyway.`,
    problem: `- A service writes an order row and then publishes "OrderCreated". If it crashes between the two, the event is lost; if it publishes first, the event may describe an order that was never committed. This is the **dual-write problem**.
- A consumer processes a message, performs a side effect, then crashes before acknowledging. The broker redelivers; the side effect happens twice.
- One malformed message makes the consumer throw on every attempt; with strict ordering, everything behind it on that partition stops.
- Producers run at 5,000 msg/s, consumers at 4,500 msg/s; lag grows by 500 msg/s, i.e. 1.8 million messages per hour, until data ages out of retention.`,
    how: `**1. Delivery semantics.**
- **At-most-once**: ack before processing; a crash loses the message.
- **At-least-once**: ack after processing; a crash causes redelivery, so duplicates happen. This is the default you should design for.
- **Exactly-once** is achievable only within a boundary. Kafka's idempotent producer plus transactions give exactly-once **read-process-write within Kafka** (consume offsets and produced records commit atomically). Once a side effect leaves that boundary (an email, a payment API, a different database), you are back to at-least-once and need **idempotent consumers**.

**2. Idempotent consumers.** Give every message a stable ID. In the same transaction as the side effect, insert the ID into a processed-messages table with a unique constraint (or use a natural idempotent write such as an upsert keyed by entity and version). A duplicate fails the insert and is acked without re-applying.

**3. Ordering.** Logs guarantee order **within a partition** only. Choose the partition key so that events that must be ordered share it (e.g. \`account_id\`); global order would require a single partition and caps throughput at one consumer. Re-partitioning (adding partitions) changes key-to-partition mapping and can reorder in-flight keys. Standard queues are best-effort ordered; FIFO queues (SQS FIFO, Service Bus sessions) order per group key at lower throughput.

**4. Consumer groups and lag.** In a group, each partition is consumed by one member; parallelism is capped by partition count. **Lag** = latest offset minus committed offset, per partition. Alert on lag **age/time-to-drain**, not just message count. Drain time = lag / (consume rate - produce rate). Rebalances (member joins/leaves) pause consumption; keep processing time well under session and poll timeouts.

**5. Visibility timeout (queues).** A received message is hidden for a visibility timeout; if not deleted before it expires, it is redelivered. Set it above the worst-case processing time (or extend it while working), otherwise the same message is processed concurrently by two consumers.

**6. Dead-letter queues and poison messages.** After N failed attempts (e.g. 5) move the message to a **DLQ** with error metadata, so it stops blocking or burning capacity. Alarm on DLQ depth > 0, and build a reviewed **redrive** path. Distinguish transient errors (retry with backoff) from permanent ones (straight to DLQ).

**7. Transactional outbox.** Write the business row and an **outbox** row (event payload) in the **same local transaction**. A relay publishes outbox rows to the broker, by polling or by tailing the database's change log (CDC, e.g. Debezium), and marks them sent. The relay is at-least-once, so consumers must dedupe by event ID. This removes the dual-write gap without distributed transactions.

**8. Sagas.** A business transaction spanning services is a sequence of local transactions, each with a **compensating action** (reserve inventory -> release inventory). **Orchestration** uses a coordinator that drives steps and compensations (easier to reason about and observe); **choreography** has services react to each other's events (looser coupling, harder to trace). Sagas give atomicity eventually, not isolation: intermediate states are visible, so design for them (e.g. "pending" status).`,
    components: [
      { name: 'Queue', description: 'Competing consumers, per-message ack and deletion, visibility timeout, DLQ. Scales consumers freely; ordering only with FIFO/session features.' },
      { name: 'Partitioned log', description: 'Retained, replayable, ordered per partition; consumers own offsets; multiple independent consumer groups; parallelism bounded by partition count.' },
      { name: 'Idempotent consumer', description: 'Dedup table or idempotent upsert committed atomically with the side effect; the real fix for duplicates.' },
      { name: 'Dead-letter queue', description: 'Quarantine for messages that fail N times; alarmed, inspected, and redriven deliberately.' },
      { name: 'Transactional outbox + relay', description: 'Business change and event written in one local transaction; relay (poll or CDC) publishes at-least-once.' },
      { name: 'Saga', description: 'Multi-service workflow of local transactions with compensations; orchestrated or choreographed.' },
    ],
    misconceptions: [
      { myth: 'Enabling exactly-once in the broker means my consumers never see duplicates.', reality: 'Broker exactly-once covers reads and writes inside that broker. External side effects (databases, emails, APIs) still see at-least-once delivery and need idempotency.' },
      { myth: 'Kafka guarantees ordering.', reality: 'Only within a partition, and only if producers preserve it (idempotent producer, careful retry settings). Across partitions there is no order.' },
      { myth: 'A growing queue is fine because the queue is durable.', reality: 'Backlog is latency. Retention limits turn sustained lag into data loss, and a huge backlog can take hours to drain because drain rate is consume minus produce rate.' },
      { myth: 'Two-phase commit between the database and the broker is the standard fix for dual writes.', reality: 'Most cloud brokers do not participate in XA, and 2PC adds coordinator failure modes. The transactional outbox (or CDC) is the standard answer.' },
    ],
    example: {
      title: 'Outbox schema, idempotent consumer and lag arithmetic',
      description: `The minimal SQL shape of the outbox and dedup, plus the numbers for sizing a consumer group.`,
      language: 'text',
      code: `-- producer side, one local transaction
BEGIN;
  INSERT INTO orders(id, account_id, total) VALUES ('o-981', 'a-17', 42.00);
  INSERT INTO outbox(event_id, aggregate_id, type, payload)
    VALUES ('e-5531', 'a-17', 'OrderCreated', '{"order":"o-981","total":42.00}');
COMMIT;
-- relay publishes outbox rows keyed by aggregate_id (keeps per-account order)

-- consumer side, one local transaction per message
BEGIN;
  INSERT INTO processed_events(event_id) VALUES ('e-5531');  -- UNIQUE; duplicate -> skip
  UPDATE loyalty SET points = points + 42 WHERE account_id = 'a-17';
COMMIT;   -- then commit offset / delete message

Sizing:
  produce 5,000 msg/s; one consumer handles 400 msg/s
  need >= 13 consumers -> use 16 partitions (headroom + replay)
  incident left 3,600,000 msgs of lag; 16 consumers x 400 = 6,400/s
  drain time = 3,600,000 / (6,400 - 5,000) = ~2,570 s = ~43 min`,
    },
    exercise: {
      prompt: `An order service updates Postgres and then calls the payment service synchronously, then publishes "OrderPaid" to a stream that shipping consumes. During a deploy, some orders were charged but never shipped, and a few were shipped twice. Redesign the flow.`,
      solution: `- **Charged but never shipped**: dual write; the process died between payment and publish. Use a **transactional outbox**: record the order state change and the "OrderPaid" event in one transaction; a relay publishes it.
- **Shipped twice**: at-least-once redelivery (relay retry, consumer crash before offset commit). Make shipping an **idempotent consumer** keyed by event ID or order ID with a unique constraint on shipment creation.
- Make the payment call idempotent with an **idempotency key** = order ID so retries cannot double-charge.
- Model the whole flow as an **orchestrated saga**: reserve inventory -> charge -> create shipment, with compensations (refund, release) and explicit pending states; DLQ plus alarm for messages that fail repeatedly; partition the stream by order ID for per-order ordering.`,
    },
    faq: [
      { q: 'Queue or log: how do I choose?', a: `Queue for task distribution where each job is done once and then forgotten, with per-message retry and DLQ. Log when several consumers need the same events, you need replay or reprocessing, or ordering per key matters at high throughput.` },
      { q: 'How many partitions should a topic have?', a: `Enough for peak consumer parallelism with headroom (consumers <= partitions), considering that adding partitions later remaps keys. Too many increases broker metadata, open files and rebalance time.` },
      { q: 'How should a consumer handle a message it cannot parse?', a: `Do not retry forever. Classify it as permanent, send it with error context to the DLQ, commit/ack, and alarm. Retries are for transient failures only.` },
    ],
    keyTerms: ['at-least-once', 'idempotent consumer', 'exactly-once (scoped)', 'partition key', 'consumer lag', 'visibility timeout', 'dead-letter queue', 'transactional outbox', 'saga', 'compensating action'],
    deeper: `Large queue backlogs create a fairness problem: one noisy tenant can fill a shared queue and delay everyone. Mitigations include per-tenant queues or shards, shuffle sharding, and prioritizing recent messages while a separate worker drains old backlog. CDC-based outboxes also let you publish events without a polling relay and preserve commit order from the write-ahead log, at the cost of coupling event schema to table schema unless you transform them.`,
    interview: {
      seniorAnswer: `A strong answer contrasts queues and logs by consumption model, retention and ordering, then states the honest contract: **at-least-once delivery plus idempotent consumers**, with "exactly-once" only inside a broker's transactional boundary. It solves dual writes with the transactional outbox or CDC, chooses a partition key for the ordering that matters, sizes partitions from throughput and consumer capacity, monitors lag as time-to-drain, isolates poison messages with a DLQ and redrive process, and handles cross-service workflows with sagas and compensations rather than distributed transactions.`,
      followUps: [
        { q: 'What happens to ordering when a consumer retries a message in place?', a: `Retrying in place blocks that partition (head-of-line). Moving it to a retry topic unblocks the partition but breaks order for that key; if order matters per key, park subsequent messages for the same key or retry in place with a bounded attempt count then DLQ.` },
        { q: 'How do you safely replay a topic from the beginning?', a: `Use a new consumer group or reset offsets in a controlled window, ensure consumers are idempotent, throttle replay to protect downstream stores, and make sure retention still covers the range.` },
        { q: 'Choreography or orchestration for a 6-step saga?', a: `Orchestration: with many steps, an explicit coordinator gives one place for state, timeouts, compensations and visibility. Choreography suits 2–3 loosely coupled steps.` },
      ],
      redFlags: [
        'Claiming end-to-end exactly-once without idempotent side effects.',
        'Publishing to a broker after a database commit with no outbox or CDC.',
        'Expecting global ordering from a multi-partition topic.',
        'No DLQ, or a DLQ nobody alarms on.',
        'Measuring lag only in message count with no time-to-drain view.',
      ],
      numbers: [
        'Drain time = lag / (consume rate - produce rate)',
        'Max consumer parallelism in a group = partition count',
        'Typical DLQ threshold: ~3-5 receive attempts',
        'Visibility timeout > worst-case processing time',
      ],
    },
    references: [
      { title: 'Apache Kafka documentation', url: 'https://kafka.apache.org/documentation/' },
      { title: "AWS Builders' Library: Avoiding insurmountable queue backlogs", url: 'https://aws.amazon.com/builders-library/avoiding-insurmountable-queue-backlogs/' },
      { title: 'Azure Architecture Center: Cloud design patterns', url: 'https://learn.microsoft.com/en-us/azure/architecture/patterns/' },
    ],
  },
  // ---------------------------------------------------------------- Stage 4: Reliability & SRE
  {
    id: 'infra-rel-slo',
    title: 'SLIs, SLOs and error budgets',
    stage: 4,
    order: 1,
    objectives: ['rel-slo', 'obs-signals'],
    scope: 'senior',
    estMinutes: 35,
    summary:
      'Choosing user-centric SLIs, availability arithmetic, composing dependencies, error budget policy, and multi-window multi-burn-rate alerting.',
    what: `- An **SLI** (service level indicator) is a measured ratio of good events to valid events, e.g. "proportion of HTTP requests served successfully in under 300 ms".
- An **SLO** (objective) is a target for that SLI over a window, e.g. "99.9% over 28 or 30 rolling days".
- The **error budget** is 1 - SLO: the amount of unreliability you are allowed to spend, on incidents, risky releases or planned maintenance.
- An **SLA** is a contract with consequences (credits) and should be looser than the internal SLO.`,
    why: `SLOs turn "is it reliable enough?" from an opinion into a number that product and engineering share. They decide when to ship faster and when to freeze, which alerts page a human, and how much redundancy is worth paying for. In senior interviews this topic tests whether you can choose a meaningful SLI, do the nines arithmetic in your head, reason about dependency budgets, and design alerts that are both fast and quiet.`,
    problem: `Typical failure states:

- SLIs measured on the server's CPU or "the process is up" rather than what users experience; dashboards are green while users see errors.
- A 100% target, which makes every change a risk and every blip an incident.
- Static threshold alerts ("error rate > 1% for 5 minutes") that page on brief spikes that barely touch the budget, yet miss a slow 0.5% leak that burns the whole month's budget.
- An SLO nobody acts on: budget exhausted, releases continue.`,
    how: `**1. Choose SLIs from the user journey.** Measure as close to the user as practical (load balancer or client telemetry rather than the app's own logs). Common types: **availability** (good responses / valid requests, excluding client errors), **latency** (requests faster than a threshold / requests; use thresholds, not averages), **freshness** for pipelines, **correctness** and **durability** for storage.

**2. Request-based vs window-based.**
- **Request-based**: good requests / total requests over the window. Weights busy periods more, is easy to compute from counters, and is the usual default.
- **Window-based**: proportion of time slices (e.g. 1-minute windows) that met a condition. Treats a 3 a.m. outage like a peak-hour one and is useful for low-traffic services where a few requests skew the ratio.

**3. Do the availability arithmetic.** Downtime allowed per average month (~30.44 days, ~43,830 minutes):
- 99% ~ 7.3 hours; 99.5% ~ 3.65 hours; 99.9% ~ **43.8 minutes**; 99.95% ~ 21.9 minutes; 99.99% ~ **4.4 minutes**; 99.999% ~ 26 seconds.
- Per year: 99.9% ~ 8.77 hours; 99.99% ~ 52.6 minutes.
Each extra nine costs roughly an order of magnitude more effort: 4.4 minutes per month is less than a typical human detect-and-respond loop, so 99.99% requires automated detection and failover.

**4. Compose dependencies.** For **serial** hard dependencies, availabilities multiply: three components at 99.9% give 0.999^3 ~ **99.7%**. Your SLO cannot exceed the product of your hard dependencies unless you add redundancy, caching or graceful degradation. For **redundant** independent components, unavailability multiplies: two 99.9% replicas give 1 - 0.001^2 = 99.9999% in theory, but correlated failures and the failover mechanism itself dominate in practice.

**5. Write an error budget policy** agreed with product before it is needed, e.g.: budget > 50% remaining, normal velocity; < 25%, only low-risk changes and reliability work prioritized; exhausted, feature freeze except fixes and security until the rolling window recovers; a single incident consuming > 20% of budget requires a postmortem with tracked action items.

**6. Alert on burn rate.** Burn rate = observed error rate / allowed error rate. Burn rate 1 spends exactly the budget over the window. For a 30-day window, the SRE workbook's recommended **multi-window, multi-burn-rate** set is:
- **Page**: burn rate 14.4 over 1 h (2% of budget), confirmed by a 5 m short window.
- **Page**: burn rate 6 over 6 h (5% of budget), confirmed by a 30 m short window.
- **Ticket**: burn rate 1 over 3 days (10% of budget), confirmed by a 6 h short window.
The long window gives significance (no paging on blips); the short window makes the alert **reset quickly** after recovery.`,
    components: [
      { name: 'SLI', description: 'Ratio of good to valid events measured near the user: availability, latency threshold, freshness, correctness.' },
      { name: 'SLO and window', description: 'Target plus a rolling (28/30-day) or calendar window. Rolling windows avoid "budget reset" behaviour at month boundaries.' },
      { name: 'Error budget', description: '1 - SLO, expressed in bad requests or minutes. The currency for release risk and maintenance.' },
      { name: 'Error budget policy', description: 'Pre-agreed actions at budget thresholds: slow releases, freeze, prioritize reliability, mandatory postmortems.' },
      { name: 'Burn-rate alerts', description: 'Multi-window, multi-burn-rate alerts that page on fast burns and ticket on slow leaks, with low false-positive rates.' },
      { name: 'SLA', description: 'External contract, deliberately looser than the internal SLO so you breach the SLO first and have time to react.' },
    ],
    misconceptions: [
      { myth: 'The SLO should be as high as possible, ideally 100%.', reality: 'Users cannot tell 99.99% from 100% through their own unreliable networks and devices, and 100% leaves zero budget for change. Set the SLO at the point where users stop being happy, not higher.' },
      { myth: 'Average latency is a good latency SLI.', reality: 'Averages hide the tail. Use "proportion of requests under X ms" at one or two thresholds (e.g. 300 ms and 1 s), which also composes into a budget.' },
      { myth: 'Our service has 99.99% because each of our dependencies does.', reality: 'Serial dependencies multiply: five 99.99% hard dependencies give ~99.95% before your own failures.' },
      { myth: 'Alert when the error rate exceeds the SLO error rate.', reality: 'That is burn rate 1: it pages on every short blip and takes a whole window to mean anything. Use burn-rate thresholds over paired long and short windows.' },
    ],
    example: {
      title: 'Budget, composition and burn-rate alert rules for a 99.9% API',
      description: `Numbers for a service handling ~100 million requests per 30 days, plus Prometheus-style alert expressions (the recording-rule names are illustrative).`,
      language: 'yaml',
      code: `# SLO 99.9% over 30 days; 100,000,000 requests/30d
# error budget = 0.1% = 100,000 bad requests (~43.2 min of full outage in 30 days)
# serial dependencies: LB 99.99% x app 99.95% x db 99.95% = ~99.89% -> below SLO!
#   -> add a cache/fallback for read paths or raise db availability

groups:
- name: api-slo-burn
  rules:
  - alert: ApiErrorBudgetFastBurn        # 2% of budget in 1 h
    expr: |
      job:slo_errors_per_request:ratio_rate1h{job="api"} > (14.4 * 0.001)
      and
      job:slo_errors_per_request:ratio_rate5m{job="api"} > (14.4 * 0.001)
    labels: {severity: page}
  - alert: ApiErrorBudgetMediumBurn      # 5% of budget in 6 h
    expr: |
      job:slo_errors_per_request:ratio_rate6h{job="api"} > (6 * 0.001)
      and
      job:slo_errors_per_request:ratio_rate30m{job="api"} > (6 * 0.001)
    labels: {severity: page}
  - alert: ApiErrorBudgetSlowBurn        # 10% of budget in 3 d
    expr: |
      job:slo_errors_per_request:ratio_rate3d{job="api"} > (1 * 0.001)
      and
      job:slo_errors_per_request:ratio_rate6h{job="api"} > (1 * 0.001)
    labels: {severity: ticket}`,
    },
    exercise: {
      prompt: `A product team wants a 99.99% availability SLO for an internal API. It depends synchronously on an auth service (99.95%) and a database (99.95%), has one on-call engineer with a 15-minute response time, and deploys 20 times a week. Evaluate the target and propose an SLO, an SLI and a budget policy.`,
      solution: `- 99.99% allows ~4.4 minutes/month. The serial dependencies alone give 0.9995 x 0.9995 ~ **99.90%**, so the target is unachievable without removing hard dependencies (cache auth tokens/decisions locally, read replicas or fallbacks for the DB).
- A 15-minute human response consumes ~3.4x the whole monthly 99.99% budget in one incident; that target would demand automated detection and rollback.
- Propose **99.9%** request-based availability SLI measured at the load balancer: good = non-5xx responses (excluding 429s from client abuse, by explicit decision) / all valid requests, over 30 rolling days, plus a latency SLI (99% under 400 ms).
- Policy: fast/medium burn pages; budget < 25% means canary-only deploys with automatic rollback; exhausted means freeze except fixes; any incident > 20% of budget gets a postmortem. Revisit after a quarter of data.`,
    },
    faq: [
      { q: 'Should planned maintenance count against the budget?', a: `If users experience it, yes. That is the point of the budget: it forces maintenance to be designed as zero-downtime or to be paid for explicitly.` },
      { q: 'How do I handle low-traffic services where one failed request is 1% of the day?', a: `Use window-based SLIs, longer windows, synthetic probes to add valid traffic, or combine low-traffic services into a single SLO for alerting purposes.` },
      { q: 'Do 4xx responses count as errors?', a: `Generally no: client errors are excluded from valid events. But 429s caused by your own over-aggressive throttling, or 404s from a broken deploy, are your failures; decide explicitly and document it in the SLI definition.` },
    ],
    keyTerms: ['SLI', 'SLO', 'SLA', 'error budget', 'error budget policy', 'burn rate', 'multi-window alert', 'request-based SLI', 'window-based SLI', 'serial availability'],
    deeper: `SLOs can also drive capacity and cost: if a service is consistently far above its SLO, it may be over-provisioned or over-replicated, and the surplus budget can be spent on faster releases or cheaper infrastructure (e.g. fewer replicas, spot capacity). Some teams deliberately inject planned downtime into overly reliable services so consumers do not build implicit dependencies on reliability that is not promised.`,
    interview: {
      seniorAnswer: `A strong answer picks SLIs from user journeys and measures them at the edge, prefers request-based ratios with latency thresholds rather than averages, does the arithmetic instantly (99.9% ~ 43.8 min/month, 99.99% ~ 4.4 min/month), composes serial dependencies by multiplication and explains how caching, redundancy and degradation break that ceiling. It ties the budget to a pre-agreed policy with product, and alerts using multi-window multi-burn-rate rules (14.4x/1 h and 6x/6 h page, 1x/3 d ticket), explaining why long windows give significance and short windows give fast reset.`,
      followUps: [
        { q: 'Why is a burn rate of 14.4 chosen for the 1-hour window?', a: `Over a 30-day (720-hour) window, burning at 14.4x for 1 hour spends 14.4/720 = 2% of the budget, a threshold that is significant enough to page but still leaves time to react before the budget is gone (~50 hours at that rate).` },
        { q: 'How would you set an SLO for a batch pipeline?', a: `Use freshness and correctness SLIs: e.g. 99% of hourly partitions available within 90 minutes of the hour, and 99.99% of records passing validation; alert on missed deadlines rather than job failures that were retried successfully.` },
        { q: 'What do you do when one team\'s dependency keeps burning your budget?', a: `Show the budget attribution data, negotiate their SLO to meet yours or reduce the hard dependency (cache, async, fallback), and escalate through the budget policy rather than absorbing it silently.` },
      ],
      redFlags: [
        'Proposing 100% or five nines without discussing cost or human response time.',
        'Latency SLI based on average or max.',
        'Alerting on CPU or static error-rate thresholds instead of user-facing symptoms and burn rate.',
        'No error budget policy, or one that product never agreed to.',
        'Adding dependency availabilities instead of multiplying them.',
      ],
      numbers: [
        '99.9% ~ 43.8 min/month, ~8.77 h/year',
        '99.95% ~ 21.9 min/month',
        '99.99% ~ 4.4 min/month, ~52.6 min/year',
        'Serial: multiply availabilities (0.999^3 ~ 99.7%)',
        'Burn-rate alerts (30-day window): 14.4x/1h + 5m, 6x/6h + 30m page; 1x/3d + 6h ticket',
      ],
    },
    references: [
      { title: 'Google SRE book: Service level objectives', url: 'https://sre.google/sre-book/service-level-objectives/' },
      { title: 'Google SRE workbook: Alerting on SLOs', url: 'https://sre.google/workbook/alerting-on-slos/' },
      { title: 'Google SRE book: Monitoring distributed systems', url: 'https://sre.google/sre-book/monitoring-distributed-systems/' },
    ],
  },
  {
    id: 'infra-rel-incidents',
    title: 'Incident response, postmortems and toil',
    stage: 4,
    order: 2,
    objectives: ['rel-incidents'],
    scope: 'senior',
    estMinutes: 30,
    summary:
      'How a mature organization runs an incident: roles, severity, mitigation before root cause, communication cadence, blameless postmortems with real action items, and toil reduction.',
    what: `Incident management is the practised process for restoring service when something user-visible breaks, and for learning from it afterwards. It has three phases: **detect and declare**, **mitigate and communicate**, and **learn** (postmortem and follow-up). Toil management is the ongoing work of removing the manual, repetitive operational load that makes on-call unsustainable.`,
    why: `Senior and staff engineers are expected to lead incidents, not just debug them, and almost every behavioural loop includes "tell me about an outage you handled". Interviewers look for structure under pressure: clear roles, early declaration, mitigation first, regular communication, and a postmortem that produces systemic fixes instead of blame. Poor incident practice turns a 10-minute rollback into a 3-hour outage with five people debugging the same graph.`,
    problem: `Common failure patterns in real incidents:

- Nobody declares an incident, so a dozen engineers investigate in parallel without coordination.
- The most senior engineer both debugs and coordinates, and does neither well.
- The team chases root cause for an hour while a rollback would have restored service in minutes.
- Stakeholders and support get no updates, so they interrupt responders.
- The postmortem names a person ("operator ran the wrong command"), action items have no owners, and the same class of incident recurs.`,
    how: `**1. Detect and declare.** Alerts are symptom-based (SLO burn), so the page itself is evidence of user impact. Declare early: it is cheaper to downgrade a false alarm than to coordinate late. Assign a **severity** using a shared rubric, for example:
- **SEV1**: broad user-facing outage or data loss/security exposure; all hands, executive comms.
- **SEV2**: significant degradation or a major feature down for a subset of users.
- **SEV3**: minor or contained impact, workaround exists.
- **SEV4**: no user impact yet; follow up in working hours.

**2. Assign roles** (from the Incident Command System, as adapted in the SRE book):
- **Incident commander (IC)**: owns the incident, sets priorities, assigns work, decides; does **not** debug.
- **Operations / tech lead**: the only people changing production; coordinate changes through the IC.
- **Communications lead**: posts status updates on a fixed cadence (e.g. every 30 minutes for SEV1) to stakeholders and the status page.
- **Scribe** (optional): keeps the timeline of observations, decisions and actions with timestamps.
Hand over the IC role explicitly when shifts change.

**3. Mitigate first, then find root cause.** Ask "what changed?" (deploys, config, flags, traffic, dependencies). Prefer fast, reversible mitigations: roll back the latest deploy, disable a feature flag, fail over or drain an AZ/region, shed load, scale up, block an abusive client. Restore service, then investigate with the pressure off. Preserve evidence (logs, heap dumps, snapshots) before destroying it with a restart when that is safe.

**4. Communicate.** Internal channel for responders, separate channel for stakeholders. Each update: current impact, what is being done, next update time. Do not speculate on root cause publicly.

**5. Resolve and hand off.** Define "resolved" (SLIs back within SLO for a period), then schedule the postmortem.

**6. Blameless postmortem.** Written within days, reviewed, and shared. Structure:
- Summary and **impact** (users affected, duration, budget consumed, revenue/data effects).
- **Timeline** with detection, escalation and mitigation timestamps; compute time to detect and time to mitigate.
- **Root cause and contributing factors**: usually several (a latent bug, a missing guardrail, an alert that did not fire, a confusing runbook).
- What went well, what went poorly, **where we got lucky**.
- **Action items**: each with an owner, priority and tracking ticket; categorized as prevent, detect and mitigate. Prefer systemic fixes (guardrails, automation, tests) over "be more careful" or "more training".
Blameless means assuming people acted reasonably given the information and tools they had, and fixing the system that made the error possible.

**7. Reduce toil.** Toil is operational work that is manual, repetitive, automatable, tactical, has no enduring value and **scales linearly with the service**. Google's SRE guidance caps toil at about **50%** of an SRE's time; measure it (tickets, pages, manual runs), and spend engineering time automating the top items. Track pager load too: the SRE book suggests on the order of at most two incidents per 12-hour on-call shift so each can be handled and followed up properly.`,
    components: [
      { name: 'Severity rubric', description: 'Shared, impact-based definitions (SEV1–SEV4) that set response expectations, paging scope and comms cadence.' },
      { name: 'Incident commander', description: 'Coordinates, prioritizes and decides; delegates debugging; owns hand-offs and declares resolution.' },
      { name: 'Operations and communications roles', description: 'Ops lead makes production changes; comms lead updates stakeholders on a fixed cadence; scribe keeps the timeline.' },
      { name: 'Mitigation playbook', description: 'Rollback, flag off, drain/failover, shed load, scale out, block traffic; pre-tested and fast.' },
      { name: 'Blameless postmortem', description: 'Impact, timeline, contributing factors, lucky breaks, owned and prioritized action items across prevent/detect/mitigate.' },
      { name: 'Toil budget', description: 'Measured manual operational work, capped (~50%) and reduced by automation and self-service.' },
    ],
    misconceptions: [
      { myth: 'You must understand the root cause before you act.', reality: 'Mitigation comes first. A rollback or failover restores users while you investigate; root cause analysis is a postmortem activity.' },
      { myth: 'Blameless means no accountability.', reality: 'Accountability moves to fixing the system: owners for action items, deadlines and reviews. Blame discourages honest timelines, which destroys the data you need.' },
      { myth: 'Every incident has a single root cause.', reality: 'Complex systems fail through several contributing factors lining up. A postmortem with a single cause and a single fix usually missed the detection and mitigation gaps.' },
      { myth: 'The most experienced engineer should be incident commander and fix it.', reality: 'The IC should coordinate, not debug. Splitting the roles is what keeps a large incident from becoming chaos.' },
    ],
    example: {
      title: 'SEV2 timeline and postmortem action items',
      description: `A condensed, realistic timeline showing mitigation before root cause, with the metrics a postmortem should compute.`,
      language: 'text',
      code: `14:02  Deploy v412 of checkout begins (canary skipped: "small config change")
14:07  v412 fully rolled out; 5xx jumps to ~30% (burn rate ~300x on 99.9%)
14:10  Fast-burn SLO alert pages on-call
       (1h window crosses 14.4x after ~14.4/300 x 60 min = ~3 min)
14:12  On-call declares SEV2, takes IC; pulls in ops lead + comms lead
14:15  IC asks "what changed?" -> v412 deploy finished 14:07
14:17  Ops lead starts rollback to v411 (decision: mitigate, don't debug)
14:24  5xx back to baseline; comms posts update #2; IC keeps incident open
14:54  SLIs within SLO for 30 min -> resolved

Metrics: time to detect 3 min (14:07 -> 14:10), time to mitigate 14 min
         (14:10 -> 14:24), user impact ~17 min at ~30% errors
         ~5 min-equivalent of full outage = ~12% of a 43.8-min monthly budget

Root cause: new connection-pool setting reduced max connections 100 -> 10
Contributing: canary skippable for "config"; no config validation; alert fine
Lucky: deploy happened during low traffic

Action items (owner, priority):
  P0 make canary mandatory for config changes      (delivery team, 1 wk)
  P1 schema + range validation for pool settings   (checkout, 2 wk)
  P1 auto-rollback on canary SLO burn              (delivery team, 4 wk)
  P2 runbook: "rollback first" decision guidance   (SRE, 2 wk)`,
    },
    exercise: {
      prompt: `You join a team whose on-call engineer receives ~40 pages per week, most auto-resolve, and postmortems are rarely written. Outline a 90-day plan to fix incident response and on-call health.`,
      solution: `- **Measure**: categorize a month of pages (actionable vs not, by alert), count toil hours, list incidents and their time to detect/mitigate.
- **Alerting**: delete or downgrade non-actionable alerts; move to SLO burn-rate pages for symptoms; route cause-based signals to dashboards or tickets. Target a few actionable pages per week.
- **Process**: publish a severity rubric and IC/ops/comms roles, run tabletop exercises, add an incident bot or template for declaration, status cadence and timeline capture.
- **Learning**: postmortems mandatory for SEV1/SEV2 and for incidents above a budget threshold; review weekly; track action items to closure as a team metric.
- **Toil**: automate the top three manual tasks; cap toil at ~50% and report it. Re-measure at day 90.`,
    },
    faq: [
      { q: 'When should I escalate or page more people?', a: `As soon as the IC sees the incident needs skills or authority not present, or the mitigation is not working within the expected time. Escalating early is cheap; heroics are not.` },
      { q: 'Should postmortems name people?', a: `Use roles ("the on-call engineer"), not names, in the shared document. Include the decisions people made and the information they had, so the reader understands why it seemed reasonable.` },
      { q: 'How do you prevent postmortem action items from rotting?', a: `Give each an owner, priority and ticket, review open items in a recurring operations meeting, and link the error budget policy so an exhausted budget prioritizes them over features.` },
    ],
    keyTerms: ['incident commander', 'severity level', 'communications lead', 'mitigation', 'time to detect', 'time to mitigate', 'blameless postmortem', 'contributing factors', 'action item', 'toil'],
    deeper: `Mean-time metrics (MTTR, MTTD) are noisy for small incident counts and can be gamed; many teams prefer tracking distributions and the proportion of incidents detected by alerting rather than by customers. Learning-focused reviews borrow from resilience engineering: instead of asking only what failed, they study how operators normally succeed under pressure, which often reveals the guardrails worth automating.`,
    interview: {
      seniorAnswer: `A strong answer describes a repeatable structure: symptom-based detection, early declaration with an impact-based severity, explicit roles (IC who coordinates and does not debug, ops lead who changes production, comms lead on a fixed cadence), "what changed?" and **mitigate first** with reversible actions, and a clear resolution criterion. Afterwards a blameless postmortem with impact in budget terms, a precise timeline, several contributing factors, lucky breaks, and owned action items across prevent, detect and mitigate. It also covers on-call sustainability: actionable pages only, toil measured and capped around 50%.`,
      followUps: [
        { q: 'The rollback did not fix it. What now?', a: `Re-check "what changed" beyond your own deploys (dependencies, config, traffic, certificates, quotas), widen the blast radius view (one AZ? one tenant?), try the next mitigation (drain AZ, fail over, shed non-critical traffic), and escalate. Keep updates going.` },
        { q: 'How do you measure whether incident response is improving?', a: `Time to detect and mitigate distributions, percentage detected by alerting vs customers, repeat incidents of the same class, action item closure rate, pages per shift and toil percentage.` },
        { q: 'How do you run a postmortem when another team caused the outage?', a: `Joint, blameless review focused on the interface: why their change could affect you, why you did not detect or contain it (missing fallbacks, timeouts, bulkheads), with action items on both sides.` },
      ],
      redFlags: [
        'Debugging for root cause while users remain impacted and a rollback is available.',
        'IC also acting as the main debugger in a large incident.',
        'Postmortems blaming an individual or ending with "be more careful".',
        'Action items with no owners or deadlines.',
        'Accepting high page volume as normal on-call life.',
      ],
      numbers: [
        'Toil cap: ~50% of SRE time (Google guidance)',
        'Pager load: on the order of <= 2 incidents per 12-hour shift',
        'SEV1 comms cadence: commonly every 15-30 minutes',
        '99.9% budget: ~43.8 min/month, so a 45-minute outage exhausts it',
      ],
    },
    references: [
      { title: 'Google SRE book: Postmortem culture', url: 'https://sre.google/sre-book/postmortem-culture/' },
      { title: 'Google SRE book: Eliminating toil', url: 'https://sre.google/sre-book/eliminating-toil/' },
      { title: 'Google SRE workbook', url: 'https://sre.google/workbook/table-of-contents/' },
    ],
  },
  {
    id: 'infra-rel-resilience',
    title: 'High availability and disaster recovery',
    stage: 4,
    order: 3,
    objectives: ['rel-resilience', 'rel-slo'],
    scope: 'senior',
    estMinutes: 35,
    summary:
      'Failure domains, static stability, DR strategies from backup/restore to active-active with their RPO, RTO and cost, DNS failover pitfalls, cell-based architecture and chaos engineering.',
    what: `**High availability (HA)** keeps a service running through component and zone failures, usually automatically. **Disaster recovery (DR)** restores service after a larger loss (region, account compromise, data corruption) within agreed targets:

- **RPO** (recovery point objective): how much data, measured in time, you may lose.
- **RTO** (recovery time objective): how long until service is restored.

Both are business decisions with steep cost curves, and both must be proven by testing.`,
    why: `"How would you make this survive an AZ or region failure?" is a standard senior follow-up, and the weak answer is "make it multi-region". A strong answer chooses the cheapest strategy that meets the RPO/RTO, identifies which failure domains are actually covered, removes dependencies on control planes during recovery, and explains how failover is triggered, tested and reversed. Real outages often come from the recovery path itself: untested restores, DNS caching, cold standby that cannot scale, or failover tooling that depends on the failed region.`,
    problem: `- A "multi-AZ" deployment still has one primary database in one AZ and a NAT gateway in another; losing either takes the service down.
- During a zone outage, autoscaling tries to launch replacement capacity in the remaining zones at the same moment as everyone else, and the control plane is degraded.
- Backups exist, but nobody has restored one; the first restore during a real incident takes 9 hours instead of the 1-hour RTO.
- DNS failover is configured with a 60 s TTL, but clients and intermediate resolvers keep old answers, and long-lived connections never re-resolve.
- A bad config push hits every region at once, so multi-region provided no protection.`,
    how: `**1. Map failure domains.** Host/rack < availability zone (one or more datacentres with independent power and networking) < region < provider/account. Also **logical** domains: a deployment, a config push, a shared dependency (identity, DNS), a tenant. Decide explicitly which failures you design for.

**2. Multi-AZ by default, statically stable.** Spread stateless capacity across at least 3 AZs and provision enough that losing one AZ needs **no new launches**: with 3 AZs, each AZ must carry 50% of peak (150% total) so two AZs carry 100%. That is **static stability**: the data plane keeps working without calling the control plane during the failure. Use zonal replicas of per-AZ dependencies (NAT gateway per AZ, zonal load balancer targets) and synchronous or quorum replication across AZs for state.

**3. Choose a DR strategy from RPO, RTO and cost:**
- **Backup and restore**: backups (snapshots, PITR logs) copied to another region/account. RPO hours (or minutes with continuous log shipping), RTO hours to a day. Lowest cost.
- **Pilot light**: data replicated continuously to the DR region; core infrastructure defined in IaC but compute mostly off. RPO minutes or less, RTO tens of minutes to hours (scale-up time). Low cost.
- **Warm standby**: a scaled-down but running copy that can take traffic immediately and scale up. RPO seconds to minutes, RTO minutes. Moderate cost.
- **Active-passive (hot standby)**: full-size standby, traffic switched on failover. RTO minutes; cost ~2x.
- **Active-active (multi-site)**: all regions serve traffic; RTO near zero for routing. RPO depends on replication: asynchronous means some recent writes can be lost; synchronous cross-region writes add tens of milliseconds. Highest cost and complexity (conflict handling, data residency, global capacity for N-1).

**4. Make failover boring.** Prefer failing over by **stopping** the bad region (health checks fail, traffic manager stops sending to it) rather than by actions that need the failed region's control plane. Pre-scale or keep warm capacity. Keep runbooks and tooling outside the region they protect.

**5. Mind DNS.** DNS-based failover is bounded by TTL **plus** caching that ignores TTL (some resolvers, client runtimes with their own DNS caches, connection pools and HTTP keep-alive that never re-resolve). Use low TTLs (30–60 s) on failover records, cap connection lifetimes, and where possible use anycast or global load balancers whose IPs do not change.

**6. Cell-based architecture.** Partition the service into independent **cells** (full stacks serving a subset of customers), with a thin routing layer mapping customer to cell. A bad deploy, poison request or noisy tenant affects one cell's share of customers (e.g. 1 of 20 = 5%). Deploy cell by cell, and size cells so they can be load-tested at maximum size.

**7. Back up for corruption, not just loss.** Replication faithfully copies a bad delete. Keep point-in-time recovery, immutable or logically separated backups (different account, deletion protection), and test restores on a schedule, measuring the real RTO.

**8. Chaos engineering.** Define steady state from SLIs, hypothesize it holds under a fault (kill an AZ's instances, add latency to a dependency, fail DNS), run in production-like conditions with a limited blast radius and an abort switch, and fix what breaks. Game days rehearse humans and runbooks as well as systems.`,
    components: [
      { name: 'Failure domains', description: 'Physical (host, AZ, region) and logical (deploy, config, dependency, tenant) units that fail together. Redundancy only helps across independent domains.' },
      { name: 'Static stability', description: 'Pre-provisioned capacity and data-plane-only recovery so losing a domain needs no new launches or control-plane calls.' },
      { name: 'DR strategy ladder', description: 'Backup/restore -> pilot light -> warm standby -> hot standby -> active-active, trading cost for lower RPO and RTO.' },
      { name: 'Traffic failover', description: 'Health-checked DNS or global load balancing; TTL and client caching determine real switch-over time.' },
      { name: 'Cells', description: 'Independent full-stack partitions behind a thin router; caps blast radius of deploys, poison requests and noisy tenants.' },
      { name: 'Restore and chaos testing', description: 'Scheduled restores with measured RTO, game days, and controlled fault injection against SLO-defined steady state.' },
    ],
    misconceptions: [
      { myth: 'Multi-region is always more reliable than multi-AZ.', reality: 'It protects against region-level failure but adds replication, failover and consistency complexity that causes its own outages, and it does not help with global config pushes or bad code deployed everywhere. Many services meet their SLO with a well-built multi-AZ design.' },
      { myth: 'Replication is a backup.', reality: 'Replication copies corruption and deletes within seconds. You need point-in-time, isolated backups for logical failures and ransomware.' },
      { myth: 'A 60-second DNS TTL means failover in 60 seconds.', reality: 'Resolvers, runtimes and connection pools can hold stale answers or connections much longer. Measure real client behaviour.' },
      { myth: 'Active-active has zero RPO.', reality: 'Only if writes are synchronously committed across regions. With async replication, writes acknowledged in the failed region but not yet replicated are lost or must be reconciled.' },
    ],
    example: {
      title: 'Choosing a DR tier for three services',
      description: `Map business requirements to strategy, cost and the capacity rule for static stability.`,
      language: 'text',
      code: `Service          RPO      RTO      Strategy                Approx. extra cost
---------------  -------  -------  ----------------------  -------------------
Payments ledger  ~0       < 5 min  multi-AZ quorum DB +    high (2-3x infra,
                                   warm standby region      sync-in-region)
Catalog API      15 min   1 h      pilot light: async DB   low-moderate
                                   replica + IaC, scale up
Analytics batch  24 h     24 h     backup/restore to       very low
                                   another region/account

Static stability for stateless tier, peak = 3,000 rps, 1 instance = 100 rps:
  2 AZs: survive 1 loss -> each AZ 3,000 rps -> 60 instances total (200%)
  3 AZs: each AZ 1,500 rps -> 45 instances total (150%)
  4 AZs: each AZ 1,000 rps -> 40 instances total (133%)

Cells: 20 cells, customer -> cell by hash; bad deploy in cell 1 -> 5% of customers
DNS: failover record TTL 60 s; client pool max connection age 5 min`,
    },
    exercise: {
      prompt: `An e-commerce site runs in one region across 2 AZs, with a single-AZ primary database and nightly snapshots in the same account. The business asks for "survive a region outage with at most 5 minutes of data loss and 1 hour of downtime". Propose a design, the order of work, and how you would prove it.`,
      solution: `- **First fix the region itself**: 3 AZs with static stability (150% capacity), multi-AZ database with synchronous standby, NAT and other per-AZ dependencies duplicated. This removes the most likely failures cheaply.
- **Backups**: enable point-in-time recovery, copy backups to another region **and account** with deletion protection, schedule restore tests.
- **DR**: RPO 5 min / RTO 1 h fits **pilot light or warm standby**: an async cross-region read replica (lag alarmed well under 5 minutes), infrastructure in IaC, a small running app tier, images and secrets replicated, and a global load balancer or health-checked DNS with low TTL.
- **Failover runbook** that does not depend on the primary region: promote replica, scale DR tier, shift traffic, freeze writes in the old region on recovery and plan failback.
- **Prove it**: quarterly game day that fails over a production-like environment, measuring actual RPO (replication lag at cut-over) and RTO end to end; fix gaps until both meet target.`,
    },
    faq: [
      { q: 'What is the difference between RTO and MTTR?', a: `RTO is a target set by the business for a disaster scenario; MTTR is a measured average across incidents. You validate RTO by drills.` },
      { q: 'Why do failover plans warn against relying on the control plane?', a: `Control planes (launching instances, changing configuration) are more complex and more likely to be impaired or throttled during large events, while data planes (serving existing resources) are designed to keep running. Recovery that only needs data-plane operations is more dependable.` },
      { q: 'How big should a cell be?', a: `Small enough that the blast radius is acceptable and that you can load-test a cell at its maximum size; large enough that per-cell overhead and cross-cell operations stay manageable. Cap cell size and add cells rather than growing them.` },
    ],
    keyTerms: ['failure domain', 'availability zone', 'static stability', 'RPO', 'RTO', 'pilot light', 'warm standby', 'active-active', 'cell-based architecture', 'chaos engineering'],
    deeper: `Shuffle sharding extends cells: each customer is assigned to a random small combination of workers, so two customers rarely share the same full set, and a poison customer can only take down the few combinations it touches. Also consider **failback**: after a regional failover, data written in the DR region must be replicated back and reconciled before returning traffic, which is often harder than the original failover.`,
    interview: {
      seniorAnswer: `A strong answer enumerates failure domains (including logical ones like deploys and config), makes multi-AZ statically stable with explicit capacity math (N AZs -> N/(N-1) of peak), then picks a DR tier by RPO, RTO and cost rather than defaulting to active-active. It is honest that async replication means RPO > 0, warns about DNS and client caching during failover, keeps recovery off control planes and outside the failed region, uses cells to cap blast radius, separates backups from replication for corruption scenarios, and insists on measured restore drills and chaos experiments.`,
      followUps: [
        { q: 'How do you avoid split brain when failing over a database across regions?', a: `Fence the old primary (revoke its write access or network, increment an epoch/term checked by clients), make promotion a deliberate single-writer decision, and never let automatic failover promote without a quorum or a human for cross-region cases.` },
        { q: 'Active-active across two regions: how much capacity do you need?', a: `Each region must handle full traffic when the other fails, so ~200% of peak in total (or N/(N-1) with N regions), plus data-layer headroom for the extra write load. This is the main cost driver.` },
        { q: 'What does a good game day look like?', a: `A written hypothesis tied to SLIs, a bounded blast radius, an abort criterion, observers, real runbooks used by on-call, measured RTO/RPO, and tracked follow-ups.` },
      ],
      redFlags: [
        '"Just make it multi-region" with no RPO/RTO or cost discussion.',
        'Treating replication as backup.',
        'Failover plans that require launching capacity during the event with no headroom.',
        'Never having tested a restore.',
        'Ignoring DNS caching and long-lived connections in failover timing.',
      ],
      numbers: [
        'Static stability: N AZs need N/(N-1) of peak (3 AZs -> 150%)',
        'Two-region active-active: ~200% of peak capacity',
        'Failover DNS TTL: typically 30-60 s, real switch-over often longer',
        'Cells: blast radius ~ 1 / number of cells',
        'Intra-region cross-AZ RTT ~1-2 ms; cross-region tens to 100+ ms (order of magnitude)',
      ],
    },
    references: [
      { title: "AWS Builders' Library: Static stability using Availability Zones", url: 'https://aws.amazon.com/builders-library/static-stability-using-availability-zones/' },
      { title: 'Principles of Chaos Engineering', url: 'https://principlesofchaos.org/' },
      { title: 'AWS Well-Architected Framework', url: 'https://aws.amazon.com/architecture/well-architected/' },
      { title: 'Google Cloud Architecture Center', url: 'https://cloud.google.com/architecture' },
    ],
  },
  // ---------------------------------------------------------------- Stage 5: Security & Identity
  {
    id: 'infra-sec-identity',
    title: 'Identity, least privilege and zero trust',
    stage: 5,
    order: 1,
    objectives: ['sec-identity'],
    scope: 'senior',
    estMinutes: 35,
    summary:
      'How cloud IAM evaluates a request, why roles and short-lived credentials beat users and keys, federation and workload identity, guardrails above accounts, and zero trust per NIST SP 800-207.',
    what: `Cloud identity and access management answers one question for every API call: **may this principal perform this action on this resource under these conditions?**

- **Principals**: human users (ideally federated from an identity provider), roles assumed by humans or workloads, service accounts / managed identities.
- **Policies**: identity-based (attached to the principal), resource-based (attached to the bucket, key, queue), and organization-level **guardrails** that cap what any principal in an account or folder can do.
- **Zero trust**: an architecture in which no request is trusted because of its network location; every access is authenticated, authorized and evaluated per session against identity, device and context.

Rough equivalents: AWS IAM roles and SCPs, Azure Entra ID with Azure RBAC and Azure Policy, Google Cloud IAM with organization policies and IAM deny policies.`,
    why: `Most cloud breaches involve identity rather than exotic exploits: leaked long-lived access keys, over-permissive roles, public resources, or a CI system with administrator rights. Interviewers expect a senior engineer to explain how policy evaluation actually works, to design least privilege that teams can live with, to eliminate static secrets for workloads, and to put organization-wide guardrails in place so one mistake cannot become a company-wide incident.`,
    problem: `A typical legacy setup:

- Engineers have IAM users with console passwords and access keys created years ago, some in laptops and CI variables.
- Applications on VMs or Kubernetes read a static key from an environment variable.
- Roles are granted wildcard actions (\`"Action": "*"\`) "to unblock the launch".
- Nothing at the organization level prevents someone from disabling audit logging, creating resources in an unapproved region, or making a bucket public.
- Network location ("it is inside the VPC") is treated as authentication.`,
    how: `**1. Understand policy evaluation (AWS model, conceptually similar elsewhere).**
- Start from **implicit deny**: nothing is allowed unless something allows it.
- Evaluate all applicable policies. If **any** applicable policy has an **explicit deny** matching the request, the answer is deny. **Explicit deny always wins.**
- Organization guardrails (service control policies, resource control policies and similar) must **permit** the action; they never grant permissions on their own, they only cap them. (On AWS, SCPs do not apply to the management account or to service-linked roles.)
- Then an allow is needed from the identity-based policy and/or the resource-based policy (cross-account access usually needs both sides to agree).
- **Permission boundaries** and **session policies**, if present, further cap the effective permissions: the result is the intersection.
Azure RBAC is additive role assignments with deny assignments taking precedence; Google Cloud IAM evaluates deny policies before allow policies. In all three, "deny wins" and "guardrails cap" are the mental model.

**2. Prefer roles over users.** Humans sign in through **federation** (SAML or OIDC from the corporate IdP, with MFA) and assume roles that issue **short-lived credentials** (minutes to hours). No long-lived human access keys. Offboarding is then a single IdP action.

**3. Workload identity, no static keys.** The platform attests the workload and exchanges that for short-lived cloud credentials:
- VMs: instance profiles / managed identities / attached service accounts via the metadata service.
- Kubernetes: projected service-account tokens federated to cloud roles (EKS Pod Identity or IRSA on AWS, Microsoft Entra Workload ID on AKS, Workload Identity Federation for GKE).
- CI/CD: the CI system issues an **OIDC token** describing the repository, branch and workflow; the cloud's trust policy accepts only tokens whose claims match (e.g. a specific repo and the main branch) and returns credentials for one deploy role.
Credentials expire on their own, so a leak has a short useful life.

**4. Least privilege that scales.** Start from managed or narrowly scoped policies, use conditions (resource tags, source VPC, organization ID, MFA present) and **access analysis** of actual usage (last-accessed data, policy analyzers) to remove unused permissions. Separate accounts/subscriptions/projects per environment and team: the account boundary is the strongest blast-radius control.

**5. Guardrails and delegated administration.** At the organization level: deny disabling audit logs, deny leaving the organization, restrict regions, block public access settings, require encryption. **Permission boundaries** let platform teams allow developers to create roles for their services without being able to create a role more powerful than the boundary, which prevents privilege escalation through role creation.

**6. Zero trust (NIST SP 800-207).** Access decisions are made per request or session by a **policy decision point** (the policy engine plus policy administrator) and enforced by a **policy enforcement point** in front of the resource, using identity, device posture and context signals. Its seven tenets: all data sources and computing services are resources; all communication is secured regardless of network location; access to each resource is granted per session with least privilege; access is determined by dynamic policy (identity, application, asset state, behavioural and environmental attributes); the enterprise monitors the integrity and security posture of all assets; authentication and authorization are dynamic and strictly enforced before access; and the enterprise collects as much state as possible (assets, network, communications) to improve its posture. Practically: identity-aware proxies instead of VPN-as-trust, mTLS and workload identity between services, and continuous evaluation.

**7. Break-glass.** A small number of emergency credentials, stored offline, MFA-protected, alarmed on any use, and tested periodically.`,
    components: [
      { name: 'Principals', description: 'Federated humans, roles, service accounts / managed identities. Humans and workloads get short-lived credentials, not keys.' },
      { name: 'Identity and resource policies', description: 'Allow statements scoped by action, resource and condition; resource policies enable controlled cross-account access.' },
      { name: 'Explicit deny and guardrails', description: 'Explicit deny overrides any allow; organization policies (SCP-style, Azure Policy, org policies, IAM deny) cap whole accounts or folders.' },
      { name: 'Permission boundaries', description: 'Upper bound on what a principal (or roles it creates) can ever do; enables safe delegation of role creation.' },
      { name: 'Federation and workload identity', description: 'SAML/OIDC for humans; platform-attested tokens (metadata service, Kubernetes service account tokens, CI OIDC) exchanged for short-lived credentials.' },
      { name: 'Zero-trust decision and enforcement points', description: 'Policy engine/administrator decides per session; enforcement points (identity-aware proxy, mesh sidecar, gateway) apply the decision at each resource.' },
    ],
    misconceptions: [
      { myth: 'An organization guardrail policy that allows an action grants it to everyone.', reality: 'Guardrails only cap permissions. A principal still needs an identity- or resource-based allow, and any explicit deny anywhere wins.' },
      { myth: 'Rotating access keys every 90 days makes them safe.', reality: 'A leaked key is useful immediately. Remove long-lived keys entirely in favour of federation and workload identity with credentials that expire in minutes to hours.' },
      { myth: 'Traffic inside the VPC is trusted, so internal services do not need authentication.', reality: 'Zero trust treats network location as insufficient. Lateral movement after one compromised host is the classic breach pattern; authenticate and authorize every call.' },
      { myth: 'Least privilege means hand-writing perfect policies up front.', reality: 'Least privilege is iterative: start scoped, observe actual usage, tighten, and rely on account boundaries and guardrails so imperfect policies cannot do catastrophic damage.' },
    ],
    example: {
      title: 'Layered policies: identity allow, explicit deny and an organization guardrail',
      description: `Three AWS-style policy documents shown together. The service role may read and write its own prefix; an explicit deny blocks non-TLS access even though the allow matches; the organization guardrail caps every account to approved regions (global services would need exemptions in a real policy). Evaluate a PutObject to \`eu-west-1\` over TLS: allowed. The same call over plain HTTP: denied by the explicit deny. Any call in \`us-east-2\`: denied by the guardrail regardless of the role's allow.`,
      language: 'json',
      code: `{
  "identityPolicy_orders_service": {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "OwnPrefixReadWrite",
        "Effect": "Allow",
        "Action": ["s3:GetObject", "s3:PutObject"],
        "Resource": "arn:aws:s3:::acme-orders-prod/orders/*"
      },
      {
        "Sid": "DenyInsecureTransport",
        "Effect": "Deny",
        "Action": "s3:*",
        "Resource": "*",
        "Condition": { "Bool": { "aws:SecureTransport": "false" } }
      }
    ]
  },
  "orgGuardrail_regions": {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "DenyOutsideApprovedRegions",
        "Effect": "Deny",
        "Action": "*",
        "Resource": "*",
        "Condition": {
          "StringNotEquals": { "aws:RequestedRegion": ["eu-west-1", "eu-central-1"] }
        }
      }
    ]
  }
}`,
    },
    exercise: {
      prompt: `Your GitHub Actions pipelines deploy to production using an access key with administrator rights stored as a repository secret, shared by 40 repositories. Design the replacement and the guardrails.`,
      solution: `- Replace the key with **OIDC federation**: configure the CI provider's OIDC issuer as an identity provider in the cloud; create one deploy role per service or environment whose trust policy accepts only tokens with matching audience and subject claims (e.g. \`repo:acme/orders:ref:refs/heads/main\` or a protected environment).
- Scope each role to what its deployment touches (its stack, its artifact bucket, \`iam:PassRole\` only for its runtime role), attach a **permission boundary** so it cannot create more powerful roles.
- Credentials last minutes to an hour and cannot be exfiltrated for later use.
- Add organization guardrails: deny disabling audit logging, deny unapproved regions, deny public access changes; alarm on use of the old key, then delete it.
- Review access analyzer findings and last-used data after a few weeks and tighten further.`,
    },
    faq: [
      { q: 'Users or roles for humans?', a: `Roles via federation from the corporate IdP with MFA. Humans get short-lived sessions; access follows group membership; offboarding is immediate.` },
      { q: 'How does cross-account access work safely?', a: `The target account's role trusts a specific principal (or organization) in the source account, ideally with conditions such as external ID for third parties; the source principal must also be allowed to assume it. Both sides consent.` },
      { q: 'What is the confused deputy problem?', a: `A trusted service is tricked into using its own permissions on behalf of an attacker. Mitigate with conditions binding the request to the original caller (source account/ARN conditions, external IDs).` },
    ],
    keyTerms: ['implicit deny', 'explicit deny', 'service control policy', 'permission boundary', 'federation', 'OIDC', 'workload identity', 'short-lived credentials', 'zero trust', 'policy enforcement point'],
    deeper: `Attribute-based access control (ABAC) scales least privilege by writing a few policies over tags (e.g. a principal may act on resources whose \`team\` tag equals its own), which avoids an explosion of role-per-resource policies, but makes tag integrity a security control: who can set or change tags must itself be restricted.`,
    interview: {
      seniorAnswer: `A strong answer explains evaluation precisely (implicit deny, explicit deny wins, guardrails and boundaries cap, allows from identity or resource policies, intersection for sessions), removes long-lived credentials entirely with federation for humans and workload identity / CI OIDC for machines, uses accounts or projects as the primary blast-radius boundary with organization guardrails on top, and treats least privilege as an iterative process driven by usage data. It frames zero trust as per-request decisions on identity and context with enforcement points at each resource, citing NIST SP 800-207, and mentions break-glass access with alarms.`,
      followUps: [
        { q: 'A developer needs to create IAM roles for their Lambda/functions. How do you allow that safely?', a: `Allow role creation only with a mandatory permission boundary attached and only within a naming path; deny removing the boundary. Any role they create is capped by the boundary, so no escalation.` },
        { q: 'How would you detect a leaked credential being used?', a: `Audit logs streamed to a central account, anomaly detection on new source IPs/regions/APIs, alarms on use of break-glass or legacy keys, and short lifetimes so the window is small.` },
        { q: 'Is a VPN required in a zero-trust model?', a: `Not as a trust mechanism. Access goes through identity-aware proxies or gateways that evaluate user and device on each session; private networking may still exist for routing, not for authorization.` },
      ],
      redFlags: [
        'Long-lived access keys in CI variables, environment variables or code.',
        'Wildcard actions and resources as a normal practice.',
        'Believing an allow in a guardrail policy grants access.',
        'Treating "inside the VPC" as authenticated.',
        'No organization-level protection for audit logs.',
      ],
      numbers: [
        'Short-lived credentials: minutes to ~1-12 hours, not months',
        'Evaluation: explicit deny > guardrail cap > allow (identity/resource) > implicit deny',
        'Break-glass accounts: a handful, MFA, alarmed on every use',
      ],
    },
    references: [
      { title: 'NIST SP 800-207: Zero Trust Architecture', url: 'https://csrc.nist.gov/pubs/sp/800/207/final' },
      { title: 'AWS Well-Architected Framework', url: 'https://aws.amazon.com/architecture/well-architected/' },
      { title: 'Google Cloud Well-Architected Framework', url: 'https://cloud.google.com/architecture/framework' },
    ],
  },
  {
    id: 'infra-sec-data',
    title: 'Encryption, key management and secrets',
    stage: 5,
    order: 2,
    objectives: ['sec-data', 'sec-identity'],
    scope: 'senior',
    estMinutes: 35,
    summary:
      'Envelope encryption with a KMS (DEK and KEK), key rotation and its limits, TLS and mTLS between services, secrets managers vs environment variables, and network segmentation as defence in depth.',
    what: `Data protection in the cloud has four layers:

- **Encryption at rest** using keys held in a **key management service** (AWS KMS, Azure Key Vault / Managed HSM, Google Cloud KMS), usually through **envelope encryption**.
- **Encryption in transit** with TLS 1.3 at the edge and between services, and **mTLS** where both sides must prove identity.
- **Secrets management**: database passwords, API tokens and certificates stored in a secrets manager (AWS Secrets Manager, Azure Key Vault, Google Secret Manager or HashiCorp Vault), delivered to workloads at runtime and rotated.
- **Segmentation**: network and account boundaries that limit what a compromised component can reach.`,
    why: `"Encrypt everything" is table stakes; interviews probe whether you know **what encryption actually protects against**. Disk encryption with a provider-managed key protects lost drives, not an attacker with your IAM credentials. The control that matters is **who can use the key**, which turns key policy into an access-control layer. Senior candidates are expected to explain envelope encryption, rotation trade-offs, crypto-shredding, why secrets do not belong in images or plain environment variables, and how mTLS gives workload identity.`,
    problem: `- A database password is baked into a container image and committed in a Helm values file; rotating it requires a redeploy of 30 services.
- Every service uses one KMS key, so any role with \`kms:Decrypt\` on it can read every tenant's data.
- Encrypting a 5 GB file directly with the KMS API fails (KMS encrypt calls accept only small payloads, e.g. 4 KB on AWS KMS) and would be slow and expensive per call anyway.
- Internal traffic is plaintext HTTP "because it is inside the VPC"; one compromised pod can sniff or spoof calls.
- Key rotation is enabled, and the team believes old data has been re-encrypted. It has not.`,
    how: `**1. Envelope encryption, step by step.**
- The application asks KMS to **generate a data key** under a **key-encryption key (KEK)** that never leaves the KMS/HSM.
- KMS returns the **data encryption key (DEK)** twice: in plaintext and encrypted under the KEK.
- The application encrypts the data locally with the plaintext DEK (e.g. AES-256-GCM), stores the **encrypted DEK alongside the ciphertext**, and wipes the plaintext DEK from memory.
- To decrypt, it sends the encrypted DEK to KMS; KMS checks the caller's permission (key policy + IAM + conditions), decrypts and returns the DEK; the application decrypts locally.
Benefits: bulk data never travels to KMS; one KMS call per object or per session (cache DEKs briefly to cut cost and latency); access to data is governed and **audited** at the KMS decrypt call. Bind ciphertext to context with **additional authenticated data / encryption context** (e.g. tenant ID), so a DEK for one tenant cannot be replayed for another.

**2. Key hierarchy and separation.** Separate KEKs per environment, data classification and (for high-sensitivity multi-tenant systems) per tenant. Key policies grant encrypt/decrypt to specific roles; separate duties so key **administrators** cannot use keys and key **users** cannot change policy. Customer-managed keys allow you to revoke or disable access, and **crypto-shredding**: destroying a tenant's key renders all their data unreadable, including in backups.

**3. Rotation and its limits.** Automatic KEK rotation (commonly yearly by default; configurable on some providers) creates new key material for **new** encryptions while retaining old versions to decrypt old data. It does **not** re-encrypt existing data, and because old versions remain usable it does not help after a key compromise. After compromise, re-encrypt (or re-wrap DEKs) under a new key and disable the old. Re-wrapping DEKs is cheap: only the small encrypted DEKs change, not the bulk data.

**4. TLS and mTLS.** Terminate TLS 1.3 at the edge (1-RTT handshake, forward secrecy by default). Between services, use **mTLS**: each workload gets a short-lived certificate encoding its identity (e.g. a SPIFFE ID), issued and rotated automatically by a mesh or workload-identity system (lifetimes of hours to about a day). Authorization policies then reference identities ("orders may call payments on POST /charge"), not IP addresses. Watch certificate expiry: an expired root or intermediate is a classic outage.

**5. Secrets management.** Store secrets in a secrets manager with fine-grained IAM, versioning, audit and **rotation** (the manager or a function rotates the credential in the database, then updates the secret; apps re-read on failure or on a schedule). Deliver at runtime via SDK, sidecar/agent or a CSI-mounted file rather than baking into images or plain environment variables, which leak into crash dumps, \`/proc\`, debug endpoints and logs, and are inherited by child processes. Better still, **eliminate** secrets: IAM database authentication, workload identity to cloud APIs, short-lived dynamic database credentials. Scan repositories and images for committed secrets and treat any hit as compromised.

**6. Segmentation.** Layer controls: separate accounts/projects per environment, private subnets with no inbound internet route, security groups that reference other groups rather than CIDRs, private endpoints for managed services so traffic never crosses the internet, egress filtering through proxies or firewalls, and service-level authorization via mTLS identities. Encryption and segmentation are complementary: one protects data if traffic is intercepted, the other limits who can reach it at all.`,
    components: [
      { name: 'KMS and KEKs', description: 'HSM-backed keys that never leave the service; key policies decide who can encrypt, decrypt and administer; every use is audit-logged.' },
      { name: 'Data encryption keys', description: 'Per-object or per-session keys generated by KMS, used locally, stored encrypted next to the data.' },
      { name: 'Rotation and re-wrapping', description: 'New key versions for new data; re-wrap DEKs or re-encrypt after compromise; old versions disabled deliberately.' },
      { name: 'TLS 1.3 and mTLS', description: 'Encryption and server authentication at the edge; mutual authentication with short-lived workload certificates internally.' },
      { name: 'Secrets manager', description: 'Central, audited, versioned storage with automated rotation and runtime delivery; ideally replaced by identity-based access where possible.' },
      { name: 'Segmentation', description: 'Account, network, private endpoint and egress controls that limit reachability and blast radius.' },
    ],
    misconceptions: [
      { myth: 'Encryption at rest protects our data from an attacker who has stolen cloud credentials.', reality: 'Storage services decrypt transparently for any principal allowed to read. Protection comes from controlling **who can use the key** and the data API, with separate keys and narrow key policies.' },
      { myth: 'Enabling automatic key rotation re-encrypts existing data.', reality: 'It only creates new key material for future encryptions; old versions stay available to decrypt old ciphertext. Re-encryption or DEK re-wrapping is a separate job.' },
      { myth: 'Environment variables are a secure way to deliver secrets.', reality: 'They are better than hardcoding but leak through process listings, crash reports, debug endpoints and child processes, and cannot rotate without restart. Prefer a secrets manager with runtime fetch or mounted files, or no secret at all.' },
      { myth: 'mTLS inside the cluster is redundant if the network is private.', reality: 'mTLS gives each call an authenticated identity, which is what allows authorization policy and blocks lateral movement after a single compromise.' },
    ],
    example: {
      title: 'Envelope encryption flow with per-tenant context',
      description: `The KMS calls are real AWS CLI operations (other providers have equivalent APIs); local encryption uses a standard AEAD from your crypto library. Note what is stored and what is never stored.`,
      language: 'bash',
      code: `# 1) Ask KMS for a fresh 256-bit DEK under the tenant's KEK, bound to the tenant
aws kms generate-data-key \\
  --key-id alias/tenant-data-prod \\
  --key-spec AES_256 \\
  --encryption-context tenant=t-42
# -> { "Plaintext": "<base64 DEK>", "CiphertextBlob": "<base64 encrypted DEK>", "KeyId": "arn:..." }

# 2) In the app: AES-256-GCM encrypt the object with Plaintext DEK (local, fast)
#    store: { ciphertext, nonce, auth_tag, encrypted_dek=CiphertextBlob, ctx={tenant:t-42} }
#    then zero the plaintext DEK in memory. Never log or persist it.

# 3) To read: unwrap the DEK (KMS checks key policy + IAM + context, and logs the call)
aws kms decrypt \\
  --ciphertext-blob fileb://encrypted_dek.bin \\
  --encryption-context tenant=t-42 \\
  --query Plaintext --output text
# wrong tenant context -> decrypt fails (context is authenticated)

# Cost/latency: 10,000 objects/s with one KMS call each = 10,000 KMS req/s
#   -> cache DEKs per tenant for e.g. 5 min, or one DEK per batch/session`,
    },
    exercise: {
      prompt: `A multi-tenant SaaS stores customer documents in object storage with provider-managed encryption and one shared database password in an environment variable. A large customer requires that they can revoke your access to their data and that you can prove every access. Design the changes.`,
      solution: `- Move to **per-tenant customer-managed KEKs** (optionally keys hosted in the customer's own account/tenancy for bring-your-own-key) with **envelope encryption** and the tenant ID as encryption context.
- Revocation: the customer disables the key or removes your grant; all of their data, including backups encrypted under it, becomes unreadable once any cached plaintext DEKs expire, so keep the DEK cache TTL short and state it in the contract (crypto-shredding on deletion).
- Proof of access: every decrypt is a KMS call recorded in audit logs with caller identity and context; ship them to an immutable log store and expose a per-tenant access report.
- Replace the database password with **IAM database authentication** or dynamic short-lived credentials from a secrets manager; remove it from environment variables; enable rotation.
- Add mTLS between services so only the document service identity can request decryption for documents, and scope the key policy to that role.`,
    },
    faq: [
      { q: 'Provider-managed or customer-managed keys?', a: `Provider-managed is fine for baseline at-rest protection. Use customer-managed keys when you need separate access control and audit per dataset, revocation, crypto-shredding, cross-account control or compliance requirements that demand it; they add cost and operational responsibility.` },
      { q: 'Should the app cache plaintext DEKs?', a: `Briefly and in memory only, bounded by time and number of uses, to reduce KMS cost and latency. The trade-off is a slightly longer window if the host is compromised and slower revocation.` },
      { q: 'Is client-side encryption worth it?', a: `When the storage operator (or the provider) must not see plaintext, or for end-to-end protection across systems. It costs search/indexing capability and adds key distribution complexity.` },
    ],
    keyTerms: ['envelope encryption', 'data encryption key (DEK)', 'key encryption key (KEK)', 'encryption context', 'key rotation', 'crypto-shredding', 'mTLS', 'SPIFFE ID', 'secrets manager', 'network segmentation'],
    deeper: `Hardware security modules give FIPS-validated key protection; cloud KMS services run on HSMs, with dedicated single-tenant HSM offerings for stricter requirements at much higher cost and operational burden. Confidential computing (memory encryption with hardware-attested enclaves or confidential VMs) extends protection to data in use, relevant when even the host operator must be excluded.`,
    interview: {
      seniorAnswer: `A strong answer explains envelope encryption step by step (generate DEK, encrypt locally, store wrapped DEK, decrypt via KMS with policy checks and audit), uses encryption context to bind ciphertext to a tenant, separates keys by environment, classification and tenant, and is precise about rotation (new versions for new data; re-wrap or re-encrypt after compromise). It frames key policy as the real access control, uses TLS 1.3 at the edge and mTLS with short-lived workload certificates internally, moves secrets to a manager with rotation or eliminates them via workload identity, and layers network segmentation and private endpoints for defence in depth.`,
      followUps: [
        { q: 'What does encryption at rest with a provider key actually protect against?', a: `Physical media theft and certain provider-side access paths. Not against your own principals or stolen credentials, since the service decrypts for anyone authorized to read.` },
        { q: 'How do you rotate a database password without downtime?', a: `Use two credentials (or the manager's alternating-user strategy): create the new one, update the secret, let clients pick it up (re-read on auth failure), then revoke the old one after the overlap window.` },
        { q: 'Where would you terminate TLS?', a: `At the edge load balancer for the public certificate and WAF, then re-encrypt to backends with mTLS; terminate at the service itself when end-to-end encryption is required and the load balancer must not see plaintext (L4 passthrough).` },
      ],
      redFlags: [
        'Equating "encryption at rest enabled" with "data is protected".',
        'Believing key rotation re-encrypts data or fixes a compromise.',
        'Secrets in images, code, Terraform state without protection, or logs.',
        'One key for all tenants and environments.',
        'Plaintext internal traffic justified by "private network".',
      ],
      numbers: [
        'DEK: AES-256, usually AES-256-GCM',
        'KMS direct encrypt payload limit: small (4 KB on AWS KMS, 64 KiB on Google Cloud KMS), hence envelope encryption',
        'Automatic KEK rotation: commonly yearly by default',
        'Workload certificates: hours to ~1 day lifetime',
        'TLS 1.3: 1-RTT full handshake',
      ],
    },
    references: [
      { title: 'RFC 8446: TLS 1.3', url: 'https://www.rfc-editor.org/rfc/rfc8446' },
      { title: 'AWS Well-Architected Framework', url: 'https://aws.amazon.com/architecture/well-architected/' },
      { title: 'Azure Well-Architected Framework', url: 'https://learn.microsoft.com/en-us/azure/well-architected/' },
    ],
  },
  {
    id: 'infra-sec-supply-chain',
    title: 'Supply chain security, guardrails and compliance',
    stage: 5,
    order: 3,
    objectives: ['sec-supply-chain', 'auto-delivery'],
    scope: 'senior',
    estMinutes: 35,
    summary:
      'The shared responsibility model across IaaS, PaaS and SaaS, SLSA build levels and provenance, SBOMs, keyless signing with Sigstore, vulnerability management with patch SLAs, policy-as-code guardrails and audit logging.',
    what: `Supply chain security protects everything that goes into what you run: source, dependencies, base images, build systems, artifacts and deployment. Compliance is proving, continuously and with evidence, that controls exist and work.

- **Shared responsibility**: what the provider secures versus what you secure, which shifts with the service model.
- **Build integrity**: SLSA levels and signed **provenance** describing how an artifact was built.
- **Inventory**: **SBOMs** listing components and versions.
- **Authenticity**: artifact **signing** (Sigstore / cosign) and verification at deploy time.
- **Hygiene**: vulnerability management with patch SLAs; **policy as code** guardrails; tamper-resistant **audit logs**.`,
    why: `Attacks on build systems, dependencies and package registries (malicious packages, typosquatting, compromised CI, poisoned base images) bypass perimeter controls entirely because the malicious code arrives signed by your own pipeline. Regulators and enterprise customers increasingly ask for SBOMs and provenance. Senior engineers are expected to design a pipeline where only artifacts built by trusted builders from reviewed source can run in production, and to run vulnerability management by risk rather than by CVE count.`,
    problem: `- Developers build images on laptops and push them directly to the production registry with a shared credential.
- Images are referenced by mutable tags like \`:latest\`, so what runs is not what was tested.
- A critical vulnerability is announced; nobody can say within a day which services include the affected library.
- The vulnerability scanner reports 4,000 findings; teams ignore all of them.
- Policies exist in a wiki ("no public buckets") but nothing enforces them, and audit logs live in the same account an attacker would control.`,
    how: `**1. Shared responsibility by model (NIST SP 800-145 service models).**
- **IaaS** (VMs): provider secures facilities, hardware, hypervisor and network; you own guest OS patching, runtime, network configuration, IAM, data and application.
- **PaaS** (managed databases, functions, managed Kubernetes control plane): provider also owns OS and runtime patching; you own configuration, identity, network exposure, data and code.
- **SaaS**: provider runs nearly everything; you still own **identities, access configuration and your data**.
In every model, misconfiguration and access management are yours.

**2. SLSA build track.** SLSA v1.x defines build levels:
- **L1**: provenance exists, describing how the artifact was built (builder, source, build steps).
- **L2**: builds run on a **hosted** build platform that generates and **signs** the provenance, so it cannot be trivially forged after the fact.
- **L3**: a **hardened** build platform: builds are isolated from one another and the signing material is not accessible to user-defined build steps, so even a compromised build script cannot forge provenance.
Consumers verify provenance at deploy time: expected builder, expected source repository and branch, artifact digest matches.

**3. SBOMs.** Generate an SBOM (SPDX or CycloneDX) for each artifact at build time, store and attach it to the image (as an attestation), and index it centrally. When a new CVE lands, query "which deployed digests contain library X version Y" in minutes. An SBOM is inventory, not a security verdict.

**4. Signing with Sigstore.** **cosign** signs container images and attestations. In **keyless** mode, the CI job authenticates with its OIDC identity to **Fulcio**, which issues a short-lived signing certificate binding the signature to that identity (e.g. a specific workflow in a specific repository); the signature event is recorded in the **Rekor** transparency log. Verification checks the signature, the certificate identity and issuer, and the log entry. No long-lived signing keys to steal or rotate.

**5. Enforce at admission.** Deploy by **digest**, not tag. A Kubernetes admission controller (OPA Gatekeeper, Kyverno, or a cloud's binary authorization feature) rejects images that are not signed by the expected identity, lack provenance from the trusted builder, or violate policy. Have an audited break-glass path.

**6. Vulnerability management by risk.** Scan images, dependencies and hosts continuously (new CVEs affect old images). Prioritize by severity **and** exploitability and exposure: known exploited vulnerabilities (e.g. CISA's KEV catalog), exploit-likelihood scores such as EPSS, internet exposure, and whether the vulnerable code is reachable. Set **patch SLAs** by tier, for example: critical and known-exploited on internet-facing systems within days; high within ~30 days; medium within ~90 days; track exceptions with expiry dates. Keep base images minimal (distroless or slim) and rebuild them on a schedule so patching is a rebuild, not a manual fix.

**7. Policy as code guardrails.** Express rules as code (OPA/Rego, Kyverno, cloud-native policy services, Terraform policy checks) and enforce in three places: **CI** (fail the plan or build), **admission/deploy** (reject), and **runtime/organization** (preventive guardrails and detective rules that alert or auto-remediate). Version, test and review policies like application code.

**8. Audit logging and evidence.** Enable control-plane audit logs everywhere (AWS CloudTrail, Azure Activity Log and Entra ID logs, Google Cloud Audit Logs), centralize them into a separate, restricted log-archive account or project with immutable retention (object lock / immutability policies), and deny disabling them through organization guardrails. Compliance frameworks (SOC 2, ISO 27001, PCI DSS) then draw evidence from these logs and policy reports continuously instead of from screenshots.`,
    components: [
      { name: 'Shared responsibility model', description: 'Provider vs customer duties shift across IaaS, PaaS and SaaS; identity, configuration and data stay with the customer.' },
      { name: 'SLSA provenance', description: 'Signed, verifiable record of builder, source and build process; L1 exists, L2 hosted and signed, L3 hardened and isolated.' },
      { name: 'SBOM', description: 'Machine-readable component inventory (SPDX, CycloneDX) per artifact, indexed for fast "where are we affected?" queries.' },
      { name: 'Signing and verification', description: 'Sigstore cosign keyless signing via OIDC identity, Fulcio short-lived certificates and the Rekor transparency log; verified at admission.' },
      { name: 'Vulnerability management', description: 'Continuous scanning, risk-based prioritization (KEV, EPSS, exposure, reachability), tiered patch SLAs and expiring exceptions.' },
      { name: 'Policy as code and audit', description: 'Guardrails enforced in CI, at admission and at the organization level; immutable, centralized audit logs as evidence.' },
    ],
    misconceptions: [
      { myth: 'Using a managed service means the provider handles security.', reality: 'The provider secures the service; you still own identities, access policies, network exposure, encryption choices and your data. Most cloud incidents are customer-side misconfiguration.' },
      { myth: 'An SBOM makes software secure.', reality: 'An SBOM is an inventory. Its value is fast impact analysis and licence/vulnerability matching; it must be paired with scanning, prioritization and patching.' },
      { myth: 'Signing images is enough.', reality: 'A signature proves who signed, not that the build was trustworthy. Verify the signer identity and the provenance (trusted builder, expected source), and enforce it at admission.' },
      { myth: 'Fix every CVE by CVSS score order.', reality: 'Raw counts and CVSS alone bury the urgent few. Prioritize known-exploited, internet-exposed and reachable vulnerabilities first, with SLAs and tracked exceptions.' },
    ],
    example: {
      title: 'Sign in CI, verify at deploy, reject unpinned images',
      description: `Keyless signing in CI with cosign, verification that pins the signer identity, and a small Rego admission rule (OPA v1 syntax) requiring digest-pinned images. The organization, repository and image names are placeholders.`,
      language: 'bash',
      code: `# In CI (GitHub Actions job with id-token: write permission), after pushing by digest
IMAGE=registry.example.com/orders@sha256:3f1c...e9
cosign sign --yes "$IMAGE"                       # keyless: OIDC -> Fulcio cert -> Rekor entry
cosign attest --yes --type cyclonedx --predicate sbom.cdx.json "$IMAGE"

# At deploy / in an admission controller: verify WHO signed it, not just that it is signed
cosign verify "$IMAGE" \\
  --certificate-identity-regexp '^https://github.com/acme/orders/\\.github/workflows/release\\.yml@refs/heads/main$' \\
  --certificate-oidc-issuer https://token.actions.githubusercontent.com

# Rego admission rule: images must be pinned by digest
# package k8s.admission
# deny contains msg if {
#   input.request.kind.kind == "Pod"
#   some c in input.request.object.spec.containers
#   not contains(c.image, "@sha256:")
#   msg := sprintf("image %v must be pinned by digest", [c.image])
# }

# Example patch SLA policy (internal policy, not a standard):
#   known-exploited or critical + internet-facing : 7 days
#   high                                         : 30 days
#   medium                                       : 90 days
#   exceptions: owner + compensating control + expiry date`,
    },
    exercise: {
      prompt: `A widely used logging library has a critical remote-code-execution CVE announced this morning, and it is on the known-exploited list. You run ~300 services across Kubernetes and VMs. Walk through the first 24 hours, then the changes that make the next one faster.`,
      solution: `- **Hour 0–2**: declare an incident; query the SBOM index (and running-image inventory) for affected versions; rank by exposure: internet-facing first. Where available, apply a fast mitigation: WAF rules for the known exploit pattern, configuration flags that disable the vulnerable feature, egress restrictions that block the typical callback.
- **Hour 2–24**: bump the dependency in shared base images and libraries, rebuild through the normal pipeline (signed, with provenance), roll out by priority with canaries; patch VM fleets via image rebuild or configuration management. Track coverage as "% of exposed services patched" and hunt in audit and network logs for exploitation indicators.
- **Afterwards**: make SBOMs mandatory at build and indexed centrally; scheduled base-image rebuilds; dependency update bots; admission policy requiring signed, digest-pinned images built by the trusted builder; default-deny egress; documented patch SLAs with known-exploited items at the top.`,
    },
    faq: [
      { q: 'What is the difference between an SBOM and provenance?', a: `An SBOM lists **what** is inside an artifact. Provenance describes **how and where** it was built (builder, source revision, parameters). You want both, attached to the artifact digest.` },
      { q: 'Preventive or detective guardrails?', a: `Both. Preventive (deny in CI, admission or organization policy) for rules that must never be broken; detective (alert, auto-remediate) for rules with legitimate exceptions or where blocking would break production. Start detective, measure violations, then promote to preventive.` },
      { q: 'Why keep audit logs in a separate account?', a: `An attacker who gains administrator access in a workload account should not be able to delete or alter the evidence. A separate, locked-down account with immutable retention preserves it.` },
    ],
    keyTerms: ['shared responsibility model', 'SLSA', 'build provenance', 'SBOM', 'cosign', 'keyless signing', 'transparency log', 'patch SLA', 'policy as code', 'audit log'],
    deeper: `Dependency confusion and typosquatting are mitigated by routing all package installs through an internal proxy/registry that pins namespaces to sources, lockfiles with hashes, and allowlisting. For the highest assurance, reproducible builds let independent builders produce bit-identical artifacts so provenance can be cross-checked rather than trusted.`,
    interview: {
      seniorAnswer: `A strong answer starts with the shared responsibility model (and that identity, configuration and data are always the customer's), then describes an end-to-end trusted pipeline: reviewed source, hosted hardened builder producing signed SLSA provenance, SBOM per artifact, keyless signing bound to the CI workload identity, digest-pinned deploys, and admission policies that verify signer identity and provenance. It runs vulnerability management by risk with patch SLAs and expiring exceptions, enforces policy as code in CI, at admission and at the organization level, and keeps immutable, centralized audit logs that double as compliance evidence.`,
      followUps: [
        { q: 'How do you get from SLSA L1 to L3?', a: `L1: generate provenance in the pipeline. L2: move builds to a hosted CI that signs provenance. L3: use a hardened, isolated builder whose signing keys are inaccessible to build steps (e.g. reusable trusted workflows), then enforce verification at deploy.` },
        { q: 'What does keyless signing remove, and what does it depend on?', a: `It removes long-lived signing keys. It depends on the OIDC identity provider and the Sigstore infrastructure (Fulcio, Rekor) and on verifying the exact identity and issuer; verifying "any valid signature" is meaningless.` },
        { q: 'How do you stop the scanner backlog from being ignored?', a: `Prioritize by exploitation and exposure, auto-fix via base-image rebuilds and dependency bots, show each team only actionable items against SLAs, and track exceptions with owners and expiry.` },
      ],
      redFlags: [
        'Deploying mutable tags such as :latest to production.',
        'Long-lived signing keys or registry credentials on developer laptops.',
        'Treating SBOM generation as the whole supply chain programme.',
        'Prioritizing by raw CVE count or CVSS alone.',
        'Audit logs stored in the same account they are meant to protect, or deletable by workload admins.',
      ],
      numbers: [
        'SLSA build track: L1 provenance exists, L2 hosted + signed, L3 hardened + isolated',
        'Example patch SLAs: critical/known-exploited exposed ~7 days, high ~30, medium ~90',
        'Sigstore keyless certs are short-lived (on the order of minutes)',
      ],
    },
    references: [
      { title: 'SLSA: Supply-chain Levels for Software Artifacts', url: 'https://slsa.dev/' },
      { title: 'Sigstore', url: 'https://sigstore.dev/' },
      { title: 'AWS Shared Responsibility Model', url: 'https://aws.amazon.com/compliance/shared-responsibility-model/' },
      { title: 'Open Policy Agent documentation', url: 'https://www.openpolicyagent.org/docs/latest/' },
    ],
  },
];
