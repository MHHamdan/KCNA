import type { BehavioralPrompt } from '../types';

/**
 * Senior infrastructure behavioural prompts. Outlines are skeletons with
 * placeholders in [brackets] — fill them with your own real experience.
 */
export const behavioralPrompts: BehavioralPrompt[] = [
  {
    id: 'bh-major-incident',
    theme: 'incident',
    question: 'Tell me about a major production incident you led. What happened, what did you do, and what changed afterwards?',
    signals: [
      'Took a clear role (incident commander, ops lead) and coordinated people rather than only typing commands',
      'Prioritised mitigation and customer impact over finding the root cause in the moment',
      'Communicated status on a cadence to stakeholders and customers',
      'Ran a blameless postmortem whose action items were actually completed',
      'Quantifies impact: duration, users or requests affected, SLO budget consumed',
    ],
    guidance:
      'Use STAR plus **Learnings**. Situation in two sentences: the system, its scale and the user-visible symptom. Task: your role and why it was yours. Action is the bulk: how you declared the incident, split roles (command, ops, comms), the hypotheses you ruled out, and the mitigation you chose (rollback, failover, shed load) and **why that one first**. Result in numbers: time to detect, time to mitigate, error budget burned, customers affected.\n\nFinish with Learnings that changed the **system**, not just people: a new alert on a symptom, a safer deploy gate, a runbook, a removed single point of failure. A senior answer names the one or two systemic causes and shows the follow-up was tracked to done.',
    pitfalls: [
      'Telling a heroic solo-debugging story with no coordination or communication',
      'Blaming an individual or another team for the outage',
      'No numbers for impact or time to mitigate',
      'Action items that ended at "we will be more careful"',
    ],
    exampleOutline:
      '- **S:** [service] serving [N req/s] began returning [symptom] at [time]; [customer-facing impact]\n- **T:** I was [on-call / IC]; owned coordination and the decision to mitigate\n- **A:** declared [SEV level]; assigned [ops / comms] roles; status updates every [N] min\n- **A:** ruled out [hypothesis 1, 2] using [dashboard / trace]; correlated with [recent change]\n- **A:** chose [rollback / failover / feature flag off] because [fastest safe reversal]\n- **R:** mitigated in [N] min; [X%] of requests affected; [Y%] of monthly error budget burned\n- **L:** postmortem found [systemic cause]; shipped [guardrail]; tracked [N] actions to completion; repeat incidents since: [0]',
  },
  {
    id: 'bh-owned-migration',
    theme: 'ownership',
    question: 'Describe a migration or large infrastructure project you owned end to end.',
    signals: [
      'Defined the goal and success metrics before starting',
      'Planned for risk: phased rollout, rollback path, dual-running or shadow traffic',
      'Managed stakeholders and dependencies across teams',
      'Finished the long tail (decommissioning the old system) rather than declaring victory at 80%',
      'Reports measurable outcomes: cost, latency, reliability, toil',
    ],
    guidance:
      'Scope matters most here, so open with the size: number of services, teams, data volume, traffic and the timeline. Explain **why** the migration was worth it (the business or reliability driver) and which strategy you chose (rehost, replatform, refactor) and why not the alternatives.\n\nIn Action, show the plan: inventory, wave grouping, a pilot, success criteria per wave, the rollback mechanism, and how you handled the hardest dependency. Show how you kept teams moving (tooling, docs, office hours). Result: before/after metrics and the date the old system was turned off. Learnings: what you would sequence differently.',
    pitfalls: [
      'Describing a team effort with no clarity about your personal contribution',
      'No rollback or risk plan — "we just cut over"',
      'Stopping the story before the old system was decommissioned',
      'Only technical detail, no stakeholder or timeline management',
    ],
    exampleOutline:
      '- **S:** [N services / TB of data] on [old platform]; driver: [cost / EOL / reliability]\n- **T:** I owned [design, plan and delivery]; deadline [date]; success = [metrics]\n- **A:** inventoried [N] workloads; grouped into [N] waves by [risk / dependency]\n- **A:** piloted with [low-risk service]; built [tooling / checklist] to make waves repeatable\n- **A:** used [dual-write / shadow traffic / blue-green] with rollback at each step\n- **A:** unblocked [hard dependency] by [negotiation / adapter]\n- **R:** migrated [N%] by [date]; [cost / latency / incident] change of [X]; old system off on [date]\n- **L:** next time I would [start decommissioning earlier / automate X sooner]',
  },
  {
    id: 'bh-influence-standard',
    theme: 'influence',
    question: "Tell me about a time you got a team you didn't manage to adopt a standard or practice.",
    signals: [
      'Started by understanding the other team\'s incentives and constraints',
      'Used data and a working example rather than authority',
      'Lowered the cost of adoption (tooling, templates, migration help)',
      'Accepted and incorporated feedback; adjusted the standard where they had a point',
      'Measures adoption, not just agreement',
    ],
    guidance:
      'Make the lack of authority explicit early: who owned the decision and why they had reasons to say no. Action should show a sequence: listen first, find a pain they already feel, prototype with one willing team, publish results, then make the right thing the easy thing (golden path, default module, CI check that warns before it blocks).\n\nResult: adoption rate over time and the outcome the standard was meant to produce (fewer incidents, faster deploys). Learnings: what you would do to build the coalition sooner.',
    pitfalls: [
      'Escalating to a manager as the main lever',
      'Presenting the other team as obstructive or wrong',
      'Mandating via a blocking gate with no migration support',
      'Counting "they agreed in a meeting" as success',
    ],
    exampleOutline:
      '- **S:** [N] teams each did [practice, e.g. deploys / IaC modules] differently; caused [incidents / drift]\n- **T:** I had no authority over [team]; goal: [standard] adopted by [date]\n- **A:** interviewed [team leads]; their concern was [velocity / ownership]\n- **A:** built [template / module] solving [their pain]; piloted with [early adopter]\n- **A:** shared [metric] from pilot; added [non-blocking check] before enforcing\n- **A:** changed [part of standard] based on their feedback\n- **R:** adoption went from [X%] to [Y%]; [incident / lead time] improved by [Z]\n- **L:** I learned to [find a champion first / publish data earlier]',
  },
  {
    id: 'bh-ambiguity',
    theme: 'ambiguity',
    question: 'Tell me about a significant decision you made with incomplete data.',
    signals: [
      'Separated what was known, unknown and unknowable within the time available',
      'Identified whether the decision was reversible and sized the effort accordingly',
      'Bought information cheaply (spike, load test, small experiment) where it paid off',
      'Made the call, stated assumptions and set checkpoints to revisit',
      'Owns the outcome, including what turned out wrong',
    ],
    guidance:
      'Frame the decision: options, deadline, and the cost of being wrong. Seniors distinguish **one-way** from **two-way doors** — say which this was and how it shaped your approach. In Action, list the assumptions you wrote down, the cheapest experiments you ran, and the explicit trigger that would make you change course.\n\nResult: what happened, and whether the assumptions held. Learnings: how you now handle similar decisions (e.g. timebox research, write a decision record).',
    pitfalls: [
      'Waiting for perfect data and missing the window',
      'Presenting a guess as certainty, with no stated assumptions',
      'A story where the data was actually complete',
      'Hindsight-only reasoning — "it worked so it was right"',
    ],
    exampleOutline:
      '- **S:** needed to choose [option A vs B] for [system] by [deadline]; [key unknown]\n- **T:** I was the [decision owner / tech lead]\n- **A:** classified as [reversible / irreversible] because [reason]\n- **A:** ran [spike / load test / cost model] in [N days] to narrow [unknown]\n- **A:** wrote decision record with assumptions [1, 2] and revisit trigger [metric > threshold]\n- **R:** chose [option]; outcome [metric]; assumption [X] proved [right / wrong] and we [adjusted]\n- **L:** I now [timebox / write ADRs / design for reversibility]',
  },
  {
    id: 'bh-disagree-senior',
    theme: 'conflict',
    question: 'Describe a time you disagreed with a senior stakeholder or architect on a technical direction.',
    signals: [
      'Disagreed on substance, respectfully, with data and a concrete alternative',
      'Genuinely understood the other position and its constraints',
      'Escalated or committed appropriately — "disagree and commit" when the decision went the other way',
      'Kept the relationship healthy',
      'Focus on the outcome for users and the business, not on being right',
    ],
    guidance:
      'State both positions fairly; if the listener cannot tell why the senior person thought what they did, the story is weak. Action: how you gathered evidence (benchmarks, incident history, cost model), how you framed the trade-off in their terms, and the forum you used (design review, 1:1, written proposal).\n\nResult can go either way: you persuaded them, a compromise emerged, or you committed to their direction and helped it succeed. Learnings: what you now do earlier (e.g. write the doc before the meeting).',
    pitfalls: [
      'Portraying the stakeholder as incompetent',
      'Winning the argument but damaging the relationship',
      'Going around them without telling them',
      'No evidence — just opinion against opinion',
    ],
    exampleOutline:
      '- **S:** [architect / director] proposed [approach] for [system]\n- **T:** I believed [risk: cost / reliability / lock-in]; I was [role]\n- **A:** asked about their constraints: [timeline / strategy]\n- **A:** built [benchmark / failure analysis / cost model] comparing [options]\n- **A:** presented in [design review / written doc] with a [hybrid / phased] alternative\n- **R:** [we adopted X / compromise Y / I committed to their plan and helped by Z]; outcome [metric]\n- **L:** I learned to [frame in their goals / raise concerns in writing earlier]',
  },
  {
    id: 'bh-failure',
    theme: 'failure',
    question: 'Tell me about a time you failed. What did you change as a result?',
    signals: [
      'Chooses a real failure with real consequences, owned personally',
      'Explains their own contributing decisions without deflection',
      'Shows how they contained the damage',
      'Describes a durable change in their behaviour or in the system',
      'Evidence the change worked later',
    ],
    guidance:
      'Pick a failure that matters but that you recovered from — e.g. a change you shipped that caused an outage, an estimate that blew up, a project that was cancelled. Spend little time on Situation; most on what **you** got wrong and why it made sense at the time. Then the recovery, then the change: a personal habit (pre-mortems, smaller batches) and, ideally, a systemic guardrail so nobody repeats it.\n\nClose with a later moment where the change paid off.',
    pitfalls: [
      'A humble-brag ("I worked too hard")',
      'Blaming circumstances or other people',
      'A failure with no consequence, so no learning',
      'No evidence the lesson stuck',
    ],
    exampleOutline:
      '- **S:** I [shipped / planned / decided] [X] for [system]\n- **T:** my responsibility was [scope]\n- **A (mistake):** I [skipped staging / underestimated / assumed]; reasoning at the time: [why]\n- **R (impact):** caused [outage N min / delay N weeks / cost $X]\n- **A (recovery):** I [rolled back / reset expectations / informed stakeholders]\n- **L:** personally I now [practice]; systemically we added [guardrail]\n- **Later:** on [project], that [practice / guardrail] caught [issue]',
  },
  {
    id: 'bh-toil',
    theme: 'ownership',
    question: 'Tell me about a time you significantly reduced toil or on-call pain.',
    signals: [
      'Measured toil first (pages per week, hours, repetitive tickets)',
      'Prioritised by frequency and cost rather than by interest',
      'Fixed root causes or automated safely, not just silenced alerts',
      'Improved the alerting design (symptom-based, actionable)',
      'Quantified the before/after and the effect on the team',
    ],
    guidance:
      'Open with the measurement: pages per shift, after-hours pages, percent of time on interrupts, ticket volume. Show the analysis: which alert or task made up most of the load (often a few sources dominate). Action: delete work that is not needed, fix the root cause, and only then automate what remains — in that order of preference — and how you made sure automation was safe (dry runs, rate limits, auditability).\n\nResult: concrete reductions and the reclaimed engineering time, plus any reliability gain. Learnings: how you keep toil from creeping back (budgets, regular review).',
    pitfalls: [
      'Reducing pages by deleting alerts without checking for missed real incidents',
      'No baseline measurement',
      'Automation that introduced a new failure mode',
      'Doing it alone without changing team process, so toil returned',
    ],
    exampleOutline:
      '- **S:** on-call averaged [N] pages/week, [M] after hours; team spent [X%] on interrupts\n- **T:** I took ownership of [on-call health]\n- **A:** categorised [N weeks] of pages; top [3] sources were [Y%] of volume\n- **A:** fixed [root cause]; automated [runbook] with [safety: dry run / limits]; converted [cause alerts] to [SLO burn alerts]\n- **A:** set up [weekly review / toil budget]\n- **R:** pages down to [N]/week; after-hours down [X%]; reclaimed [hours/week]\n- **L:** measuring first stopped us chasing [the interesting but rare problem]',
  },
  {
    id: 'bh-cost-reliability',
    theme: 'tradeoff',
    question: 'Describe a time you had to trade off cost against reliability. How did you decide?',
    signals: [
      'Framed the trade-off in business terms (cost of downtime vs cost of redundancy)',
      'Used SLOs and real data rather than gut feel',
      'Considered intermediate options, not just two extremes',
      'Made blast radius and risk explicit to decision makers',
      'Revisited the decision with production data',
    ],
    guidance:
      'Make the numbers the backbone: what the reliability option cost (e.g. a second region, extra capacity headroom) and what the risk cost (expected downtime x cost per hour, or SLO violation). Show the options spectrum — e.g. single-region multi-AZ with tested backups vs warm standby vs active-active — and why you landed where you did.\n\nResult: money saved or spent and the reliability outcome. Learnings: how you now present such trade-offs (a one-page cost/risk table to the decision owner).',
    pitfalls: [
      'Treating reliability as always worth any cost',
      'Cutting cost silently and leaving risk undocumented',
      'No numbers on either side',
      'Making a business-risk decision alone instead of with the owner',
    ],
    exampleOutline:
      '- **S:** [system] cost [$X/month]; proposal to [cut / add] [redundancy / capacity]\n- **T:** I was asked to [recommend / decide]\n- **A:** quantified: SLO [target], historical incidents [N], estimated downtime cost [$Y/hour]\n- **A:** compared [option 1, 2, 3] by cost, RTO/RPO and blast radius\n- **A:** presented to [owner]; agreed on [option] with [explicit accepted risk]\n- **R:** saved / spent [$Z/year]; reliability since: [metric]\n- **L:** I now [present expected-loss math / revisit quarterly]',
  },
  {
    id: 'bh-mentoring',
    theme: 'mentoring',
    question: 'Tell me about a time you raised the bar for your team or mentored someone to grow.',
    signals: [
      'Tailored the approach to the person or team rather than lecturing',
      'Delegated real ownership with support, not just tasks',
      'Created leverage: practices, reviews, docs that outlive the mentoring',
      'Concrete evidence of growth (promotion, owning on-call, leading a project)',
      'Humility — learned something themselves',
    ],
    guidance:
      'Choose one person or one team practice. Situation: where they started and the gap. Action: how you diagnosed what they needed, how you gave stretch work with a safety net (pairing, review, a clear escalation path), and how you gave feedback. For raising the bar, show a mechanism: design review template, production readiness checklist, incident-review rotation.\n\nResult: observable change in the person or team metrics. Learnings: what mentoring taught you.',
    pitfalls: [
      'Taking credit for the mentee\'s achievements',
      'Mentoring as "I told them the answer"',
      'Vague results ("they got better")',
      'Raising the bar by gatekeeping instead of teaching',
    ],
    exampleOutline:
      '- **S:** [engineer] was [new to on-call / unsure in design reviews]; or team lacked [practice]\n- **T:** I [volunteered / was asked] to help\n- **A:** agreed goals: [own X by date]; paired on [first incidents / design]\n- **A:** handed over [ownership of Y] with [weekly check-in / review]\n- **A:** introduced [checklist / review template / rotation] so it scales beyond me\n- **R:** they [led incident / shipped project / promoted]; team [metric] improved\n- **L:** I learned to [ask more, tell less / let people make recoverable mistakes]',
  },
  {
    id: 'bh-push-back-scope',
    theme: 'conflict',
    question: 'Tell me about a time you said no or pushed back on scope or a deadline.',
    signals: [
      'Pushed back with data on risk, effort and trade-offs, not emotion',
      'Offered options (reduce scope, phase, add resources, move date)',
      'Protected reliability or the team without being obstructive',
      'Reached agreement and then delivered on what was committed',
    ],
    guidance:
      'Set up the request and why it was unsafe or unrealistic (e.g. launch without load testing, migration in a freeze window). Action: how you quantified it, the alternatives you proposed, and how you made it easy for the requester to say yes to one. Seniors negotiate the **shape** of the work, not just the date.\n\nResult: what was agreed and delivered, and what risk was avoided. Learnings: how you now surface constraints earlier.',
    pitfalls: [
      'Saying no without an alternative',
      'Caving and then complaining later',
      'Framing the requester as unreasonable',
      'Not following through on the reduced commitment',
    ],
    exampleOutline:
      '- **S:** [stakeholder] asked for [scope] by [date] for [launch / customer]\n- **T:** I owned [delivery / platform readiness]\n- **A:** estimated [effort]; identified risks: [no load test / no rollback / on-call gap]\n- **A:** proposed [MVP scope by date + phase 2] or [date + full scope]\n- **A:** wrote [one-page trade-off] for [decision owner]\n- **R:** agreed [option]; shipped [what] on [date]; [risk avoided / incident-free launch]\n- **L:** I now [raise readiness criteria at kickoff]',
  },
  {
    id: 'bh-security-issue',
    theme: 'incident',
    question: 'Describe a security issue you discovered or handled. How did you approach it?',
    signals: [
      'Contained first (revoke, rotate, isolate) and preserved evidence',
      'Followed or established a disclosure and escalation process with security and legal',
      'Assessed blast radius with logs and data, not assumptions',
      'Fixed the class of problem, not just the instance (guardrail, policy as code)',
      'Appropriate discretion about sensitive details in the answer itself',
    ],
    guidance:
      'Keep details generic enough to be appropriate to share. Situation: what was found and how (scanner, audit, alert, report). Action: immediate containment (e.g. rotate a leaked credential, remove public access), who you involved and when, how you determined exposure (access logs, audit trail), and the permanent fix — e.g. short-lived credentials via workload identity, a policy that blocks public buckets, secret scanning in CI.\n\nResult: exposure window and confirmed impact. Learnings: the preventive control and how you verified it works.',
    pitfalls: [
      'Sharing confidential specifics or customer data in the interview',
      'Fixing quietly without involving the security team',
      'Rotating a secret without checking whether it was used',
      'Only fixing the one instance',
    ],
    exampleOutline:
      '- **S:** [secret scanner / audit / alert] flagged [class of issue, e.g. exposed credential / public storage]\n- **T:** I was [owner of the system / on-call / security champion]\n- **A:** contained within [N min]: [revoke / rotate / block]\n- **A:** engaged [security / incident process]; preserved [logs]\n- **A:** reviewed [audit logs for window]; confirmed [no / limited] use\n- **A:** prevented recurrence: [policy guardrail / short-lived creds / CI check]\n- **R:** exposure window [N]; impact [none confirmed / scoped]; [N] similar cases found and fixed\n- **L:** we now [detect at commit time / deny by default]',
  },
  {
    id: 'bh-delivery-speed',
    theme: 'delivery',
    question: 'Tell me about a time you improved delivery speed without compromising safety.',
    signals: [
      'Measured delivery with recognised metrics (lead time, deploy frequency, change failure rate, time to restore)',
      'Found the actual bottleneck before optimising',
      'Added safety mechanisms (canaries, automated rollback, feature flags) alongside speed',
      'Brought teams along; adoption, not just tooling',
      'Shows both speed and stability improved or held',
    ],
    guidance:
      'Baseline first: e.g. lead time of days, weekly deploys, manual approvals, frequent rollback pain. Show the bottleneck analysis (flaky tests, manual gates, large batch sizes). Action: smaller changes, pipeline parallelism, progressive delivery with automated canary analysis, removing manual steps that did not reduce risk.\n\nResult: before/after on speed **and** stability metrics. The senior point: safety mechanisms are what let you go faster.',
    pitfalls: [
      'Speed gains at the expense of more incidents',
      'Optimising a stage that was not the bottleneck',
      'Only tooling — no change to how teams worked',
      'No metrics',
    ],
    exampleOutline:
      '- **S:** lead time [N days]; deploys [weekly]; change failure rate [X%]\n- **T:** I owned [CI/CD platform / release process]\n- **A:** measured pipeline stages; bottleneck was [flaky tests / manual approval / batch size]\n- **A:** introduced [canary with auto-rollback / feature flags / parallel tests]\n- **A:** replaced [manual gate] with [automated check]; coached teams on [small batches]\n- **R:** lead time [N → M]; deploys [weekly → daily]; change failure rate [X% → Y%]\n- **L:** safety automation was what made the speed acceptable to [stakeholders]',
  },
  {
    id: 'bh-cross-org',
    theme: 'influence',
    question: 'Tell me about a project that required working across organisational boundaries.',
    signals: [
      'Mapped stakeholders and their goals early',
      'Created shared artefacts (design doc, roadmap, RACI) to align',
      'Handled competing priorities and dependency risk proactively',
      'Communicated in each audience\'s terms',
      'Delivered an outcome neither org could have achieved alone',
    ],
    guidance:
      'Scope: how many orgs/teams, and why their priorities differed. Action: how you built alignment (shared goal, written plan, clear owners), the mechanisms for keeping it (regular syncs, a shared tracker, escalation path agreed up front), and the hardest conflict and how you resolved it.\n\nResult: delivered outcome plus the relationship that remained. Learnings: how you would structure the collaboration next time.',
    pitfalls: [
      'Story is only about your team; other orgs appear only as blockers',
      'No mechanism — just "lots of meetings"',
      'Escalation as the first tool',
      'Unclear what you personally drove',
    ],
    exampleOutline:
      '- **S:** [initiative] needed [platform, security, product, finance] orgs; each had [different priority]\n- **T:** I was [technical lead / driver] with no authority over [orgs]\n- **A:** wrote [design doc / one-pager] with shared goal [metric]\n- **A:** agreed owners per workstream and an escalation path up front\n- **A:** resolved [conflict, e.g. timeline vs security review] by [compromise]\n- **R:** delivered [outcome] on [date]; [metric]; [teams now collaborate on X]\n- **L:** next time I would [align on success metric before design]',
  },
  {
    id: 'bh-tech-debt',
    theme: 'tradeoff',
    question: 'How have you prioritised technical debt against feature or roadmap work?',
    signals: [
      'Quantified the cost of the debt (incidents, toil, lead time, risk)',
      'Translated debt into business impact that product leadership understood',
      'Used a sustainable mechanism (capacity allocation, error budget policy) rather than heroics',
      'Prioritised ruthlessly — not all debt is worth paying',
      'Showed outcome after paying it down',
    ],
    guidance:
      'Start with a concrete debt item or portfolio and its **interest**: e.g. a legacy deploy path causing a share of incidents, an unsupported runtime version, manual cluster upgrades. Action: how you inventoried and scored debt (impact x likelihood x cost to fix), how you made the case (incident data, error budget exhaustion, security exposure), and the mechanism you won (a fixed share of capacity, or error budget policy that pauses features).\n\nResult: what was paid down and its measured effect. Learnings: which debt you deliberately chose **not** to pay and why.',
    pitfalls: [
      'Treating all debt as equally urgent or as a matter of taste',
      'Making the case on engineering aesthetics instead of impact',
      'A big-bang rewrite with no incremental value',
      'No follow-up measurement',
    ],
    exampleOutline:
      '- **S:** [system] had [debt items]; caused [N incidents / X hours toil / slow lead time]\n- **T:** I was [tech lead] responsible for [roadmap input]\n- **A:** inventoried [N] items; scored by [impact, risk, effort]\n- **A:** presented [top items] with [incident / cost data] to [product lead]\n- **A:** agreed [X% capacity / error-budget policy]; tackled incrementally via [strangler / phased]\n- **R:** paid down [items]; [incidents / toil / lead time] improved by [Y]\n- **L:** deliberately left [item] because [low interest]; we review the list [quarterly]',
  },
];
