#!/usr/bin/env bash
# Start Open Design ADE (local daemon + web UI) for this repo.
set -euo pipefail

PORT="${OD_PORT:-7456}"
HOST="${OD_BIND_HOST:-127.0.0.1}"
NODE24_BIN="${HOME}/.nvm/versions/node/v24.18.0/bin"

if [[ -d "$NODE24_BIN" ]]; then
  export PATH="$NODE24_BIN:$PATH"
fi

if ! command -v open-design-ade >/dev/null 2>&1; then
  echo "open-design-ade not found. Install with: npm install -g open-design-ade" >&2
  exit 1
fi

if curl -sf "http://${HOST}:${PORT}/api/health" >/dev/null 2>&1; then
  echo "Open Design already running at http://${HOST}:${PORT}"
  curl -s "http://${HOST}:${PORT}/api/health"
  echo
  exit 0
fi

echo "Starting Open Design ADE on http://${HOST}:${PORT} ..."
nohup open-design-ade --no-open --host "$HOST" --port "$PORT" \
  >"${TMPDIR:-/tmp}/open-design-ade.log" 2>&1 &
echo $! >"${TMPDIR:-/tmp}/open-design-ade.pid"

for _ in $(seq 1 30); do
  if curl -sf "http://${HOST}:${PORT}/api/health" >/dev/null 2>&1; then
    echo "Open Design ready: http://${HOST}:${PORT}"
    # Ensure the typing-trainer2 project exists and points at our design system.
    curl -sf -X POST "http://${HOST}:${PORT}/api/projects" \
      -H 'Content-Type: application/json' \
      -d '{"id":"typing-trainer2","name":"Typing Trainer","designSystemId":"typing-trainer","skillId":"frontend-design","kind":"prototype","customInstructions":"Follow DESIGN.md and design-systems/typing-trainer/tokens.css. Use skills/frontend-design."}' \
      >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 0.5
done

echo "Open Design failed to become healthy. See ${TMPDIR:-/tmp}/open-design-ade.log" >&2
exit 1
