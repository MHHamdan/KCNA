# Deployment

| Target | URL | What runs there | Cost |
|---|---|---|---|
| GitHub Pages | https://mhhamdan.github.io/KCNA/ | Static web app (`vite build --mode pages`, base `/KCNA/`). Tutor calls go to the HF Space. | Free |
| Hugging Face Space | https://huggingface.co/spaces/MHamdan/KCNA (app: https://mhamdan-kcna.hf.space) | Docker Space on **CPU basic** (2 vCPU, 16 GB): Node API + web app + llama.cpp model | No hourly cost on CPU basic |

## Pipeline (`.github/workflows/ci.yml`)

```text
push to main ─▶ test job: npm ci → lint → typecheck → vitest → coverage-matrix --check
                          → build (HF) → build (Pages) → assert base paths / API URL
                          → Playwright e2e (mock model) → assemble Space bundle
                ├─▶ deploy-pages: actions/deploy-pages
                └─▶ deploy-huggingface: upload .space-build to MHamdan/KCNA (needs HF_TOKEN secret)
                                        → wait until /version.json shows this commit SHA
```

Pull requests run only the test job. Deploy jobs (and the `HF_TOKEN` secret) never run for PR code.

### Build settings per target

| | Hugging Face | GitHub Pages |
|---|---|---|
| Command | `npm run build` | `npm run build:pages` |
| Output | `apps/web/dist` | `apps/web/dist-pages` |
| Base path | `/` | `/KCNA/` |
| Tutor API | same origin | `https://mhamdan-kcna.hf.space` (override with `VITE_TUTOR_API`) |

## One-time setup

1. **GitHub Pages**: Settings → Pages → Source: *GitHub Actions* (already configured with `gh api -X POST repos/MHHamdan/KCNA/pages -f build_type=workflow`).
2. **Space**: created as a Docker Space on `cpu-basic`. Do **not** change the hardware; any upgrade is billed hourly.
3. **Deploy token for CI (required for automatic HF deploys)**: create a *fine-grained* token at https://huggingface.co/settings/tokens with *Write* permission on `spaces/MHamdan/KCNA` only, then add it to GitHub without echoing it:

   ```bash
   gh secret set HF_TOKEN --repo MHHamdan/KCNA --env huggingface   # paste the token when prompted
   ```

   Until that secret exists, the deploy-huggingface job logs a warning and skips. You can deploy manually as shown below.

## Manual Space deploy

```bash
npm ci && npm run build && npm run space:bundle
python -c "from huggingface_hub import HfApi; HfApi().upload_folder(repo_id='MHamdan/KCNA', repo_type='space', folder_path='.space-build')"
```

`huggingface_hub` uses the token from `hf auth login`; it never appears on the command line.

## Space runtime configuration (Settings → Variables)

| Variable | Default | Meaning |
|---|---|---|
| `MODEL_REPO` / `MODEL_FILE` | `unsloth/Qwen3-4B-Instruct-2507-GGUF` / `Qwen3-4B-Instruct-2507-Q4_K_M.gguf` | GGUF downloaded at build time (Docker build arg). Leave unset to use the Dockerfile defaults. |
| `MODEL_LABEL` | `Qwen3-4B-Instruct-2507 (Q4_K_M, llama.cpp CPU)` | Shown in the UI |
| `LLAMA_CTX` / `LLAMA_THREADS` | `8192` / `2` | llama.cpp context and threads |
| `TUTOR_PROVIDER` | `llamacpp` | `llamacpp`, `hf-router` (needs `HF_TOKEN` secret) or `none` |
| `ALLOWED_ORIGINS` | `https://mhhamdan.github.io` | CORS allow-list (comma-separated) |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `20` / `600000` | Per-client tutor limit |
| `TUTOR_MAX_TOKENS` / `TUTOR_TIMEOUT_MS` | `450` / `180000` | Output and time limits |

## Troubleshooting deployments

| Symptom | Check |
|---|---|
| Space stuck in *Building* | Space → Logs → Build. The model download needs huggingface.co reachable; re-run with *Factory rebuild*. |
| Space *Runtime error* | Space → Logs → Container. `start.sh` launches llama-server; if it crashes the web app still serves and `/api/health` reports `tutor.state: unavailable`. |
| Tutor says "model starting" | llama-server is loading the model (cold start after sleep). `/api/health` returns `state: loading` until ready. |
| Pages tutor shows "offline" | The Space is asleep or building. Open the Space URL once to wake it. Check that `ALLOWED_ORIGINS` includes `https://mhhamdan.github.io`. |
| Pages shows a blank page | Wrong base path. CI asserts `src="/KCNA/assets/` in `dist-pages/index.html`. |
| `deploy-huggingface` skipped | The `HF_TOKEN` secret is missing in the `huggingface` environment. |

## Recovering learner progress

Progress is in the browser (`localStorage` key `kcna-progress-v1`; the in-progress exam is under `kcna-exam-active-v1`).

- Export it regularly: *Progress & settings → Export progress (JSON)*.
- To restore, use *Import progress*. The file is validated, malformed rows are dropped, and newer schema versions are rejected with a clear error.
- To move between GitHub Pages and Hugging Face, export on one and import on the other.
- If the app fails to load because of corrupt storage, clear site data for that origin, then import your last export.
