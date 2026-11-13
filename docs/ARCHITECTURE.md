# Architecture

One codebase, two deployment targets, no paid services.

```text
                         GitHub: MHHamdan/KCNA (canonical source)
                                       │  push to main
                                       ▼
                    GitHub Actions: lint → typecheck → unit tests → coverage check
                                 → build (HF + Pages) → Playwright e2e
                         ┌─────────────┴──────────────┐
                         ▼                            ▼
          GitHub Pages (static)              Hugging Face Docker Space (cpu-basic, free)
          https://mhhamdan.github.io/KCNA/   https://mhamdan-kcna.hf.space
          web app only, base /KCNA/          ┌──────────────────────────────────────┐
                 │                           │ node server.mjs :7860                │
                 │  tutor requests (CORS)    │   ├─ serves the web app (base /)     │
                 └──────────────────────────▶│   └─ /api/health, /api/tutor/chat   │
                                             │        validate → rate-limit → RAG   │
                                             │        → stream (SSE)                │
                                             │ llama-server 127.0.0.1:8081          │
                                             │   open-weight GGUF model on CPU      │
                                             └──────────────────────────────────────┘
```

## Repository layout

| Path | Purpose |
|---|---|
| `packages/content` | All learning content as typed TypeScript data: curriculum (domains, competencies, stages), lessons, questions, flashcards, glossary, comparisons, labs, terminal/YAML/troubleshooting challenges, decision games, resources, CNCF ecosystem. |
| `packages/engine` | Pure, framework-free logic shared by browser and server: BM25 search and retrieval corpus, progress schema + import/export, SM-2 spaced repetition, exam selection and grading, mastery/readiness, kubectl parser, YAML validator, tutor protocol (validation, modes, prompt building). |
| `apps/web` | React 19 + TypeScript + Vite + Tailwind CSS v4 single-page app (hash routing). |
| `apps/api` | Zero-runtime-dependency Node HTTP server: static hosting, tutor API, provider abstraction, rate limiting. Bundled by esbuild into one `server.mjs`. |
| `space/` | Hugging Face Space files: `Dockerfile`, `start.sh`, Space `README.md`. |
| `scripts/` | `build-space.ts` (assemble Space bundle), `coverage-matrix.ts` (curriculum audit), `check-links.ts` (reference URL verification). |
| `tests/e2e` | Playwright student-journey tests with a mock model server. |
| `docs/` | This documentation. |

## Design decisions

- **Content as typed data, not Markdown files.** The compiler enforces the schema (`packages/content/src/types.ts`), and `packages/content/test/content.test.ts` enforces quality rules: every question has per-option rationale, every lesson has knowledge-check questions, YAML starters fail and solutions pass, every terminal expectation is reachable, and so on.
- **Shared engine.** The browser uses the same BM25 index for search and the offline tutor fallback that the server uses for retrieval-augmented generation, so "AI unavailable" still returns the same grounded sources.
- **Hash routing.** `#/lessons/pods` works unchanged under `/KCNA/` on GitHub Pages and `/` on Hugging Face without server rewrites.
- **Two explicit web builds.** `vite build` (HF: base `/`, same-origin API) and `vite build --mode pages` (Pages: base `/KCNA/`, API at `https://mhamdan-kcna.hf.space`). CI asserts both settings.
- **Local-first progress.** Progress lives in `localStorage` (one versioned JSON document) with export/import. See [SECURITY.md](SECURITY.md) and [EXAM_READINESS.md](EXAM_READINESS.md).
- **Model in the container.** The tutor model runs with llama.cpp on the Space's free CPU, so there is no per-request cost and no third-party API key. See [MODEL_SELECTION.md](MODEL_SELECTION.md).

## Request flow: one tutor question

1. The learner asks from a lesson. The browser sends `{mode, level, messages (≤12), context: {lessonId}}`. It never sends the whole progress state; Revision mode adds a summary of at most 1,500 characters.
2. The API checks the origin (CORS allow-list), the per-client rate limit (20 requests per 10 minutes), the body size (≤32 KB), and the schema (`validateTutorRequest`).
3. Retrieval: BM25 over lessons, FAQs, glossary, comparisons, labs and flashcards. The query is the latest question, plus the previous one for short follow-ups. The current lesson gets a boost.
4. Prompt: a fixed system prompt for each mode (so llama.cpp can reuse its prompt cache), the earlier turns, then the latest turn with the numbered reference snippets attached. It also carries the *authoritative answer* for quiz questions and deterministic validator findings for YAML.
5. A global concurrency gate (1 active, queue of 4) protects the 2 vCPUs. llama-server streams tokens. The API strips any `<think>` traces and relays Server-Sent Events: `meta` (sources), `token`, `done` / `error`.
6. The UI renders the answer with a safe Markdown renderer (no `innerHTML`) and lists the sources it used.
