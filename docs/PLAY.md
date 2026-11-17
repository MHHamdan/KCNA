# Play & habit: never stop learning

These features exist to keep you practising every day. They are built on how memory works, not on attention tricks:

- **Retrieval:** you produce answers rather than re-read them.
- **Spacing:** material comes back just before you forget it.
- **Interleaving:** topics are mixed rather than studied in blocks.
- **Desirable difficulty:** breaking and fixing things under time pressure.

All of it runs offline in the browser, costs nothing, and stores progress locally (export/import covers it).

## Break-Fix Arena (`#/arena`)

A deterministic Kubernetes cluster simulator (`packages/engine/src/arena.ts`).

- **Cluster:** 3 nodes running `web` (3 replicas) and `api` (2 replicas).
- **Reconcile loop:** runs once per second and models surge rolling updates (maxSurge 1, maxUnavailable 0, so a broken release leaves old Pods serving), kubelet retries, scheduling against memory capacity, cordons, `NoExecute` taints, CrashLoopBackOff with back-off, OOMKills, Service selectors, endpoints and an error budget.
- **Chaos faults:** a broken image push, a deleted ConfigMap, a Service selector typo, scale-to-zero, a memory limit below what the app needs, forgotten cordons, a cluster-wide `NoExecute` taint, and a bad environment variable.
- **Supported commands:** `get`, `describe`, `logs --previous`, `top pods`, `rollout status|history|undo|restart`, `set image|env|resources|selector`, `scale`, `create configmap`, `delete pod`, `cordon`/`uncordon`, `taint … -`.
- **Levels and scoring:** levels 1–3 inject one to three non-masking faults. Score = remaining error budget × level − hints − time to recover.
- **Tests:** every fault is tested to be discoverable through the commands its hints teach and fixable with the taught command. Ignoring an outage loses the round (`packages/engine/test/arena.test.ts`).

## Endless feed (`#/feed`)

`nextFeedItem` picks each card in priority order:

1. Missed questions that are due for spaced review.
2. Flashcards that are due.
3. An interleaved mix weighted toward weak topics and unseen material: myth busters (built from lesson misconceptions), step-ordering puzzles, match-pairs boards and new flashcards.

Nothing repeats back to back. You can filter to KCNA, Senior infra, or both. It never ends.

## Daily challenge (`#/daily`)

Five interleaved questions (one per topic, across both tracks) plus one step puzzle. The challenge is seeded by the date, so everyone gets the same one each day.

## Mini-games and explain-it-back

- **Order the steps:** 24 independently reviewed puzzles, such as `kubectl apply` to a running Pod, the TLS 1.3 handshake, expand/contract migrations and a multi-region failover runbook. Up/down controls make them keyboard- and touch-friendly.
- **Match pairs:** generated from the glossary.
- **Explain it back (Feynman technique):** write your own explanation. The app shows which of the lesson's key terms you covered, and the AI tutor critiques it in Socratic mode.

## XP, levels, streaks, achievements and the skill map (`#/map`)

- **XP is derived from evidence, never stored,** so it can't be farmed. Sources: answers (10 if correct, 3 for a wrong attempt), lessons read and mastered, labs, practice items, flashcards studied, solid designs, STAR stories, mock interviews, Arena wins (×level), daily challenges and mini-activities.
- **Levels:** reaching level n needs 150·n^1.6 cumulative XP, with titles from *Curious Cadet* to *Distinguished Engineer*.
- **Streaks and daily goal:** consecutive study days (today's gap doesn't break a streak until the day ends) and a goal of 15 learning events a day.
- **Achievements:** 22, from *First steps* to *Never stop learning* (a 100-day streak).
- **Skill constellation:** every topic in both tracks is a star in its domain's cluster, brightening with conservative mastery.
- **Calendar reminder:** a daily study event you can download as an `.ics` file (Settings), with no server and no notification permissions.
