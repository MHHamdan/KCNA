# AI tutor

The tutor is a grounded Kubernetes teaching assistant built into every part of the app.

## Where it appears

| Location | Entry point | Context sent |
|---|---|---|
| Every lesson | *Ask AI about this*, *Ask AI about this diagram*, *Ask AI to explain this YAML* | `lessonId`, diagram id, example YAML |
| Quiz feedback, exam review | *Explain why my answer was wrong* (Exam coach mode) | `questionId`, selected choices. The server looks up the verified answer. |
| Terminal trainer | Socratic help for the current step | `page: terminal:<id>`, lesson |
| YAML trainer | *AI review of my YAML* | the manifest + deterministic validator findings |
| Troubleshooting simulator | Troubleshooting-mode help | scenario id, lesson |
| Labs | *Diagnose my lab error* (paste output) | lab id + pasted error text (≤ 2,000 chars) |
| Flashcards, comparisons, visualizers, search | contextual questions | lesson / page id |
| Dashboard and readiness page | *Ask AI why these are recommended* (Revision mode) | compact performance summary (≤ 1,500 chars) |
| `#/tutor` and the header button | free conversation | the page the learner is on |

The browser never sends the full progress state.

## Modes

Each mode has its own instructions in the system prompt (`packages/engine/src/tutor.ts`). A unit test checks that all six system prompts differ.

| Mode | Behaviour |
|---|---|
| Explain | One-sentence answer, then mechanism and a concrete example. Ends with a check-your-understanding question. |
| Socratic | Asks guiding questions and withholds the full answer until the learner asks for it. |
| Exam coach | KCNA scope only: the tested concept, the trap, and why each wrong option is wrong. Labels deeper material "beyond KCNA". |
| Troubleshoot | Symptom → Hypothesis → Investigation → Evidence → Solution. Suggests the next kubectl command and holds back the fix until the evidence supports it. |
| YAML review | Field-by-field explanation plus problems. Treats the deterministic validator's findings as facts and never invents fields. |
| Revision | Uses the performance summary to explain recommendations, then runs a short drill. |
| Mock interviewer | Senior infrastructure interviewer: asks one question at a time and probes trade-offs and failure modes. When given a design case or behavioural prompt, it steers by that rubric and scores the answer 1–4 per area on request. |

A **level** switch (Beginner / Technical) changes how much analogy or jargon the answers use.

## Conversation continuity

The client keeps the conversation and sends the last 12 turns with each request. The server keeps them in order (system → earlier turns → latest question with retrieved context), so follow-ups like "Why do we need a Deployment then?" or "What if the Pod crashes?" are answered in context. Retrieval also folds the previous question into short follow-ups. Tests cover this at three levels: engine (`buildChat`), API (the mock model receives the history), and Playwright (the second answer reports `history=3`).

## Grounding (retrieval-augmented generation)

- **Corpus**: 650+ documents built from lessons (split into what/why/how/components/misconceptions/example/deeper sections), FAQs, glossary, comparisons, labs and flashcards (`packages/engine/src/corpus.ts`). Question explanations are excluded from search so quizzes aren't spoiled.
- **Index**: BM25 with a small stemmer that keeps hyphenated Kubernetes terms (`kube-proxy`, `CrashLoopBackOff`) intact, plus title and current-lesson boosts. No vector database is needed for a corpus this size.
- **Prompt**: the top 4 snippets (≤ 600 chars each), numbered `[1]`–`[4]`. The model is told to cite them, to mark anything outside them as "(general knowledge — verify in the docs)", and never to invent commands, fields or URLs.
- **Sources** go back to the browser as a `meta` event: lesson anchors plus the official reference URLs attached to those lessons. Only URLs from the content (all verified by `npm run check:links`) can appear.
- **Authoritative answers**: for "why was I wrong", the server injects the verified correct answer, the official explanation and per-option rationale from the question bank, and instructs the model never to contradict them. The client cannot supply or override the correct answer.

## Fact guard

After each answer, the server checks the text against a list of well-known Kubernetes misconceptions (`packages/engine/src/factguard.ts`). If the model states one, for example "a crashed Pod is replaced" or "delete the Deployment to roll back", the UI appends a **Verified correction** from the course content with a lesson link. Sentences containing a negation are not flagged. This complements grounding; it does not replace it.

## Availability and fallbacks

| State | What the learner sees |
|---|---|
| `ready` | Streaming answer + sources |
| `loading` (model starting after a Space wake-up) | "The tutor model is starting…" banner; learning features keep working |
| `unavailable` / network error (Space asleep, crashed, unreachable from Pages) | "AI tutor unavailable: …" plus up to 4 matching results from the built-in knowledge base, linking to lessons, glossary and comparisons |
| `quota` (only with the optional paid-router provider) | Quota message plus the same knowledge-base fallback |
| `busy` / `rate-limited` | Retry message with the wait time |

The tutor never invents a reply when the model is unavailable. The fallback is clearly labelled "no AI".

## Provider abstraction

`apps/api/src/providers.ts` has one OpenAI-compatible streaming client and three configurations:

- `llamacpp` (default): local `llama-server` inside the Space, health-checked via `/health`.
- `hf-router`: Hugging Face Inference Providers (`router.huggingface.co/v1`). It needs an `HF_TOKEN` Space secret and has a hard monthly request cap. It is **off by default**: PRO's included credits are small, and usage beyond them can be billed (see MODEL_SELECTION.md).
- `none`: tutor disabled; fallbacks only.

## Limits

| Limit | Value |
|---|---|
| Message length | 2,000 chars (user) / 4,000 (assistant history) |
| History | last 12 turns |
| Output | 450 tokens |
| Timeout | 180 s |
| Rate | 20 requests / 10 min per client IP |
| Concurrency | 1 generation at a time, queue of 4 |

## Known limitations

- A 4-billion-parameter model on 2 shared CPU cores is slow (about 4 tokens/s; first text after roughly 10–35 s; see MODEL_SELECTION.md) and can still be wrong. Answers carry citations, and the fact guard corrects known traps.
- Free Spaces sleep after a period without traffic. The first request after that waits for a cold start.
- One shared CPU serves all visitors, so concurrent users queue.
