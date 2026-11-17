# KCNA Interactive Learning Lab

*Master Kubernetes and Cloud Native — Learn, Practice, Troubleshoot, Ask, Review, and Pass.*

An interactive study platform for the CNCF **Kubernetes and Cloud Native Associate (KCNA)** exam, with a grounded AI tutor that runs on free hardware.

| | |
|---|---|
| **GitHub Pages** | https://mhhamdan.github.io/KCNA/ |
| **Hugging Face Space** (app + AI tutor) | https://huggingface.co/spaces/MHamdan/KCNA · direct: https://mhamdan-kcna.hf.space |
| **Source** | https://github.com/MHHamdan/KCNA |

> All practice questions are original and **unofficial**. This project is not affiliated with CNCF or the Linux Foundation.

## Study loop

**Learn → Visualize → Practice → Ask AI → Quiz → Diagnose weaknesses → Review → Mock exam → Exam readiness**

| Area | What you get |
|---|---|
| Learning path | 41 lessons over 9 stages (foundations → architecture → workloads → networking → storage → security & ops → delivery → cloud-native architecture → exam prep). Each lesson covers what/why/problem/how, components, misconceptions, an example, an exercise, a knowledge check, FAQ and official references, and is labelled *KCNA*, *Foundation* or *Beyond KCNA*. |
| Visualizers | Clickable cluster architecture with animated sequences (`kubectl apply`, container crash vs Pod replacement, node failure), plus networking (DNS → Service → EndpointSlice → Pod, Ingress, NodePort) and storage (PVC → StorageClass → CSI → PV) step-throughs |
| Practice | Simulated kubectl terminal (accepts aliases and flag variations), YAML trainer with a deterministic validator, troubleshooting simulator (symptom → hypothesis → investigation → evidence → solution), architecture decision game, 15 local-cluster labs (6 full kind walkthroughs, executed weekly on a real kind cluster in CI) |
| Exam prep | 262 original questions (each independently reviewed) with per-option rationale; timed, domain-weighted mock exams (60 questions / 90 minutes) with flagging, navigation and wrong-answer review; spaced review: every missed question returns (1 day, ~6 days, longer) until answered correctly over three weeks; lessons count as *mastered* only when their knowledge check is all correct; SM-2 flashcards; an evidence-based **Am I ready?** page with a study plan |
| AI tutor | Six modes (Explain, Socratic, Exam coach, Troubleshoot, YAML review, Revision); follow-up conversation; answers grounded in lesson content with cited sources; available from every lesson, quiz result, lab, trainer and the dashboard; clear offline state with a non-AI knowledge-base fallback |
| Reference | Glossary (110 terms), 12 concept comparisons, CNCF ecosystem explorer, curated free resources, full-text search |
| Progress | Stored locally in your browser; export/import JSON, CSV study history, reset. |
| Phone | Installable (Add to Home Screen) and works offline after the first visit — everything except the AI tutor. |

## Play & habit: never stop learning

- **Break-Fix Arena:** a live simulated cluster where chaos injects real failures while you restore service with kubectl, racing an error budget.
- **∞ Endless feed:** an adaptive, never-ending, interleaved mix of spaced reviews, weak topics, myth busters, step puzzles and matching.
- **Daily challenge:** the same five-minute challenge for everyone each day.
- **Mini-games and explain-it-back:** step ordering, matching pairs, and the Feynman technique.
- **Motivation from evidence:** XP and levels, streaks, 22 achievements, a skill constellation and a calendar reminder.

See [docs/PLAY.md](docs/PLAY.md).

## Cloud Infrastructure — Senior Interview Prep (separate track)

A standalone track at `#/infra` for senior and staff cloud infrastructure, platform and SRE interviews. It has:

- 26 lessons, each with an interview angle covering how seniors answer, follow-ups, red flags and numbers to know
- 152 scenario and trade-off questions
- 10 timed system design cases, each with a reference answer and grading rubric
- 14 behavioural prompts with your own STAR story bank
- 110 flashcards
- an AI **mock interviewer**
- its own readiness page

Details are in [docs/INFRA_TRACK.md](docs/INFRA_TRACK.md).

## Quick start (development)

```bash
nvm use 20            # Node ≥ 20
npm ci
npm run dev           # web app on http://localhost:5173 (tutor proxied to :7860)
npm run build && STATIC_DIR=apps/web/dist node apps/api/dist/server.mjs   # API + app on :7860
```

The tutor needs an OpenAI-compatible model server at `LLAMA_URL` (default `http://127.0.0.1:8081`), for example `llama-server -m model.gguf --port 8081 --jinja`. Without one, the app works and the tutor reports itself unavailable.

| Command | Purpose |
|---|---|
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit and integration tests (content integrity, engine, API) |
| `npm run test:e2e` | Playwright student-journey tests (build first) |
| `npm run build` / `npm run build:pages` | Hugging Face / GitHub Pages builds |
| `npm run coverage:matrix` | Regenerate [docs/COVERAGE_MATRIX.md](docs/COVERAGE_MATRIX.md) |
| `npm run check:links` | Verify every reference URL resolves |
| `npm run space:bundle` | Assemble the Hugging Face Space bundle |
| `npx tsx scripts/tutor-eval.ts` | Fact-check and time the deployed tutor |
| `npm run check:ecosystem` | Compare CNCF maturity levels with the official landscape |
| `npx tsx scripts/run-labs.ts` | Run the full labs against the current kube context (CI: `labs.yml`) |

## Documentation

- [ARCHITECTURE](docs/ARCHITECTURE.md): system design and request flow
- [CURRICULUM](docs/CURRICULUM.md) and [COVERAGE_MATRIX](docs/COVERAGE_MATRIX.md): official alignment and coverage
- [AI_TUTOR](docs/AI_TUTOR.md): modes, grounding, fallbacks, limits
- [MODEL_SELECTION](docs/MODEL_SELECTION.md): model choice, measurements, cost
- [DEPLOYMENT](docs/DEPLOYMENT.md): CI/CD, configuration, troubleshooting, progress recovery
- [SECURITY](docs/SECURITY.md): credentials, threat model, privacy
- [EXAM_READINESS](docs/EXAM_READINESS.md): the readiness formula
- [CONTENT_GUIDELINES](docs/CONTENT_GUIDELINES.md): how to add lessons, questions, labs and challenges
- [INFRA_TRACK](docs/INFRA_TRACK.md): the senior cloud infrastructure interview track
- [PLAY](docs/PLAY.md): Arena, endless feed, daily challenge, games, XP, streaks and the skill map

## Cost

Target **CAD $0/month**. GitHub Pages and Actions are free for public repositories. The Space runs on the free *CPU basic* tier, and the model runs inside it, so there is no inference spend. Docker Spaces require a Hugging Face PRO account to create, which the owner already has. No paid hardware, endpoints or pay-as-you-go inference is enabled. Details are in [MODEL_SELECTION](docs/MODEL_SELECTION.md#cost-and-free-tier-limits).
