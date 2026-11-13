# Model selection

## Decision

**Qwen3-4B-Instruct-2507** (Apache-2.0), quantised to GGUF Q4_K_M (`unsloth/Qwen3-4B-Instruct-2507-GGUF`, about 2.5 GB). It is served by llama.cpp's `llama-server` **inside the Hugging Face Space on the free CPU basic tier** (2 vCPU, 16 GB RAM).

This is the only option we found that is open-weight, works today, and has **zero per-request cost with no billing exposure**.

## Hosting options considered (checked 2026-11-12/13)

| Option | Free? | Verdict |
|---|---|---|
| HF Inference Providers (router) | Free accounts get no credits. PRO gets **$2/month** in compute credits; beyond that you pay as you go after buying credits ([pricing docs](https://huggingface.co/docs/inference-providers/pricing)). | Not unlimited and not guaranteed $0. Kept as an **optional, off-by-default** provider (`TUTOR_PROVIDER=hf-router`) with a hard monthly request cap. |
| HF Inference Endpoints / GPU Spaces / ZeroGPU | Billed hourly or by quota | Rejected (cost). |
| Docker Space on CPU basic, model in the container | CPU basic has no hourly cost. Docker Spaces need a PRO account to create; this account has one. | **Chosen.** Costs nothing per request; slow but sustainable. |
| Static Space + browser-side model (WebGPU/WASM) | Free | Rejected for v1: a multi-GB download per learner, uneven device support, and most phones can't run a 4B model. |

## Candidates

| Model | License | Params / GGUF size | Notes |
|---|---|---|---|
| **Qwen3-4B-Instruct-2507** | Apache-2.0 | 4B / 2.5 GB (Q4_K_M) | Non-thinking instruct model, strong instruction following, 256K native context (we use 8K). |
| Qwen3.5-2B | Apache-2.0 | 2B / 1.3 GB (Q4_K_M) | Newer (Feb 2026), multimodal family; faster tokens, weaker on facts. |
| SmolLM3-3B | Apache-2.0 | 3B / 1.9 GB | Not measured live; kept as an alternative. |
| Qwen3.5-0.8B | Apache-2.0 | 0.8B | Too small for reliable technical explanations. |
| Qwen3.5-9B and larger | Apache-2.0 | 9B+ | Too slow on 2 shared vCPUs (well under 2 tok/s expected). |

## Measured on the live Space (`npx tsx scripts/tutor-eval.ts`)

Seven KCNA cases: container crash vs Pod replacement, rollback, Secret encoding, scheduler role, Service vs Ingress, state store, and a two-turn follow-up. Each case has 19 checks covering facts that must appear and known errors that must not. Same prompts, retrieval and hardware (CPU basic, 2 threads, ctx 8192, max 450–600 output tokens).

| Model | Fact checks | Avg first token | Avg full answer | Avg length | Approx. speed |
|---|---:|---:|---:|---:|---:|
| Qwen3.5-2B Q4_K_M | 17/19 (89%) | 11.0 s | 63.9 s | 242 words | ~6 tok/s |
| **Qwen3-4B-Instruct-2507 Q4_K_M** | **19/19 (100%)** | 18.8 s | 71.4 s | 159 words | ~4 tok/s |

Qwen3.5-2B kept making the two errors that matter most for the exam: it described a crashed container as replaced rather than restarted, and it suggested deleting a Deployment to roll it back. It did this even with explicit grounding rules. The 4B model got every check right, and total time was similar because its answers are more concise. For an exam-prep tutor, accuracy wins.

Answers stream token by token, so learners see text after about 10–35 s rather than waiting for the full answer.

## Accuracy safeguards beyond the model

1. **Retrieval grounding** with cited sources from verified course content (see AI_TUTOR.md).
2. **Authoritative answers** for quiz explanations, injected server-side.
3. **Fact guard** (`packages/engine/src/factguard.ts`): a deterministic check of each finished answer against well-known misconceptions. These cover crash vs replacement, container data loss, rollback by deletion, "Secrets are encrypted", "the scheduler starts containers", what `kubectl run` creates, Docker as the runtime, and PodSecurityPolicy. When one is detected, the UI adds a clearly marked *Verified correction* linking to the lesson. Negated sentences ("do not delete the Deployment…") are not flagged.
4. A **"(general knowledge — verify in the docs)"** marker for anything outside the retrieved material.

## Cost and free-tier limits

- **Cost: $0 per request.** The model runs on the Space's free CPU. No inference API, no GPU, no endpoint.
- **Account requirement**: creating a Docker Space needs Hugging Face PRO. If PRO lapses, the existing Space's status should be re-checked. The fallback is the GitHub Pages site, which works fully without the tutor.
- **Sleep**: free Spaces sleep when unused. After a wake-up, the container must start and load the 2.5 GB model before the first answer (expect a minute or two).
- **Throughput**: one generation at a time on 2 vCPUs, about 4 tokens/s. Concurrent learners queue (up to 4), then get "busy".
- **No unlimited, fast, high-quality free hosted inference was found.** This setup trades speed for a guaranteed $0.

## Changing the model

Set Space variables `MODEL_REPO`, `MODEL_FILE` and `MODEL_LABEL` (they are passed as Docker build args), or change the defaults in `space/Dockerfile`. Then re-run `npx tsx scripts/tutor-eval.ts` and update this file with the results.
