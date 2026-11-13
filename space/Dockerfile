# Hugging Face Docker Space: KCNA Interactive Learning Lab + AI tutor.
# Runs on the free "CPU basic" tier (2 vCPU, 16 GB RAM). No GPU, no paid inference.
#  - llama-server (llama.cpp) serves an open-weight GGUF model on 127.0.0.1:8081
#  - the Node API (server.mjs) serves the web app and /api/* on port 7860
# The web app and API are pre-built by CI (scripts/build-space.ts); nothing is compiled here.

FROM docker.io/library/node:22-bookworm-slim AS node

# Pinned llama.cpp CPU server image (Ubuntu based)
FROM ghcr.io/ggml-org/llama.cpp:server@sha256:2103d1f4f2e2e223ad80587dcb39fc15a9f912f29ae1fa9fc1193fe8c1aea82f

COPY --from=node /usr/local/bin/node /usr/local/bin/node

# Model is public; it is downloaded at build time so cold starts don't re-download it.
# Override with Space variables MODEL_REPO / MODEL_FILE (passed as build args).
ARG MODEL_REPO=unsloth/Qwen3.5-2B-GGUF
ARG MODEL_FILE=Qwen3.5-2B-Q4_K_M.gguf
ARG MODEL_LABEL="Qwen3.5-2B (Q4_K_M, llama.cpp CPU)"
RUN mkdir -p /models \
 && curl -fsSL --retry 5 --retry-delay 5 -o /models/model.gguf "https://huggingface.co/${MODEL_REPO}/resolve/main/${MODEL_FILE}" \
 && ls -la /models

WORKDIR /srv
COPY server.mjs start.sh ./
COPY web ./web
RUN chmod 755 /srv/start.sh && chmod -R a+rX /srv /models

ENV PORT=7860 \
    STATIC_DIR=/srv/web \
    LLAMA_URL=http://127.0.0.1:8081 \
    TUTOR_PROVIDER=llamacpp \
    TUTOR_MODEL="${MODEL_LABEL}" \
    LLAMA_CTX=8192 \
    LLAMA_THREADS=2 \
    ALLOWED_ORIGINS=https://mhhamdan.github.io \
    NODE_ENV=production

USER 1000
EXPOSE 7860
ENTRYPOINT ["/srv/start.sh"]
