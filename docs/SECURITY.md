# Security and privacy

## Credentials

| Credential | Where it lives | Who can read it |
|---|---|---|
| GitHub push access | The maintainer's local `gh` / SSH setup | Maintainer only. Never in the repo. |
| `HF_TOKEN` (deploy) | GitHub Actions secret in the `huggingface` environment | Only the `deploy-huggingface` job, which never runs for pull requests |
| `HF_TOKEN` (runtime) | **Not used.** The default tutor runs a local model inside the Space. | — |
| `HF_TOKEN` (optional `hf-router` provider) | Private Space secret | Server process only; never sent to the browser |

Rules enforced by this repo:

- No `.env` files are committed (`.gitignore`). CI fails if any tracked file matches common token patterns (Hugging Face, GitHub, AWS, private keys).
- The browser bundle contains no tokens. `__TUTOR_API__` is a public URL, nothing more.
- The Space image needs no credentials: the GGUF model is public and is downloaded at build time.
- Recommended deploy token: a **fine-grained** Hugging Face token with *write* access to `spaces/MHamdan/KCNA` only.

## Threat model for the public tutor endpoint

`POST https://mhamdan-kcna.hf.space/api/tutor/chat` is public, because GitHub Pages visitors need it.

| Threat | Mitigation |
|---|---|
| Cost abuse (someone runs up a bill) | The default provider is a local llama.cpp model on free `cpu-basic` hardware, so there is **no per-request cost** to abuse. The optional `hf-router` provider has a hard monthly request cap (`HF_ROUTER_MONTHLY_REQUEST_CAP`, default 300) and is off by default. |
| Resource exhaustion / DoS | Body ≤ 32 KB; message ≤ 2,000 chars; ≤ 12 history turns; YAML ≤ 6,000 chars; `max_tokens` 450; 300 s timeout; 20 requests per client IP per 10 min; 1 concurrent generation with a queue of 4 (`503 busy` beyond that). A determined attacker can still keep the free CPU busy, which degrades the tutor but not the rest of the app. |
| Using the tutor as a general proxy | The model is local and every request is wrapped in a Kubernetes-tutor system prompt, so there is no upstream API to proxy to. |
| Cross-site use from other websites | CORS allows only `https://mhhamdan.github.io` plus same-origin. Other origins get `403`. (CORS stops browsers, not scripts; the rate limits handle scripts.) |
| Prompt injection via learner input | The model has no tools, secrets or actions, so the worst case is a wrong or off-topic answer. Authoritative quiz answers are injected server-side from the content bank, not taken from the client. Quiz and lesson IDs are validated against the content. |
| XSS through model output | Answers are rendered by a custom Markdown renderer that builds React elements (no `innerHTML`). Links render only for `http(s)` URLs. A strict CSP (`script-src 'self'`) is set on the Space. |
| Path traversal on static hosting | Paths are normalised and confined to the static root (tested). |

## Privacy

- **No accounts, no tracking, no analytics.**
- Progress is stored in the browser's `localStorage` on the device. Hugging Face and GitHub Pages are different origins, so each keeps its own copy. Move progress between them with export/import.
- Tutor requests contain only the conversation (≤ 12 turns), the current lesson/question ID, and, in Revision mode, a short performance summary. The full progress state is never sent.
- Server logs record only mode, turn count, response length, duration and error codes. They never record message content, IP addresses or tokens.
- Tutor conversations are not saved, even in the browser, unless the learner opts in under *Settings*.

## Reporting

Please open a GitHub issue for security problems, and leave out sensitive details.
