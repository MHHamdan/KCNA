#!/bin/sh
# Start the model server in the background, then the web/API server in the foreground.
# If llama-server fails, the learning app keeps working and the tutor reports "unavailable".
set -e
/app/llama-server \
  --model /models/model.gguf \
  --host 127.0.0.1 --port 8081 \
  --ctx-size "${LLAMA_CTX:-8192}" \
  --threads "${LLAMA_THREADS:-2}" \
  --parallel 1 \
  --jinja \
  --reasoning-budget 0 \
  --no-webui &
exec node /srv/server.mjs
