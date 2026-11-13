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
| Practice | Simulated kubectl terminal (accepts aliases and flag variations), YAML trainer with a deterministic validator, troubleshooting simulator (symptom → hypothesis → investigation → evidence → solution), architecture decision game, 15 local-cluster labs (6 full kind walkthroughs) |
| Exam prep | 156 original questions with per-option rationale; timed, domain-weighted mock exams (60 questions / 90 minutes) with flagging, navigation and wrong-answer review; smart review of repeated mistakes; SM-2 flashcards; an evidence-based **Am I ready?** page with a study plan |
| AI tutor | Six modes (Explain, Socratic, Exam coach, Troubleshoot, YAML review, Revision); follow-up conversation; answers grounded in lesson content with cited sources; available from every lesson, quiz result, lab, trainer and the dashboard; clear offline state with a non-AI knowledge-base fallback |
| Reference | Glossary (110 terms), 12 concept comparisons, CNCF ecosystem explorer, curated free resources, full-text search |
| Progress | Stored locally in your browser; export/import JSON, CSV study history, reset. Works offline from the tutor. |

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

## Documentation

- [ARCHITECTURE](docs/ARCHITECTURE.md): system design and request flow
- [CURRICULUM](docs/CURRICULUM.md) and [COVERAGE_MATRIX](docs/COVERAGE_MATRIX.md): official alignment and coverage
- [AI_TUTOR](docs/AI_TUTOR.md): modes, grounding, fallbacks, limits
- [MODEL_SELECTION](docs/MODEL_SELECTION.md): model choice, measurements, cost
- [DEPLOYMENT](docs/DEPLOYMENT.md): CI/CD, configuration, troubleshooting, progress recovery
- [SECURITY](docs/SECURITY.md): credentials, threat model, privacy
- [EXAM_READINESS](docs/EXAM_READINESS.md): the readiness formula
- [CONTENT_GUIDELINES](docs/CONTENT_GUIDELINES.md): how to add lessons, questions, labs and challenges

## Cost

Target **CAD $0/month**. GitHub Pages and Actions are free for public repositories. The Space runs on the free *CPU basic* tier, and the model runs inside it, so there is no inference spend. Docker Spaces require a Hugging Face PRO account to create, which the owner already has. No paid hardware, endpoints or pay-as-you-go inference is enabled. Details are in [MODEL_SELECTION](docs/MODEL_SELECTION.md#cost-and-free-tier-limits).
