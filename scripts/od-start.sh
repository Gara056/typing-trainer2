#!/usr/bin/env bash
# Start Open Design ADE (local daemon + web UI) for this repo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${OD_PORT:-7456}"
HOST="${OD_BIND_HOST:-127.0.0.1}"

# Prefer nvm Node 24, then repo-local binaries.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
  nvm use 24 >/dev/null 2>&1 || nvm use default >/dev/null 2>&1 || true
fi

# Newest nvm node bin first if present
if [[ -d "$HOME/.nvm/versions/node" ]]; then
  NEWEST_BIN="$(ls -d "$HOME"/.nvm/versions/node/v*/bin 2>/dev/null | sort -V | tail -1 || true)"
  if [[ -n "${NEWEST_BIN}" ]]; then
    export PATH="${NEWEST_BIN}:$PATH"
  fi
fi
export PATH="${ROOT}/node_modules/.bin:$PATH"

ADE_BIN="$(command -v open-design-ade || true)"
if [[ -z "$ADE_BIN" && -x "${ROOT}/node_modules/.bin/open-design-ade" ]]; then
  ADE_BIN="${ROOT}/node_modules/.bin/open-design-ade"
fi

if [[ -z "$ADE_BIN" ]]; then
  echo "open-design-ade not found." >&2
  echo "Run: ./scripts/od-install.sh" >&2
  echo "(Do NOT use: npm install -g … — that hits /usr and causes EACCES.)" >&2
  exit 1
fi

if curl -sf "http://${HOST}:${PORT}/api/health" >/dev/null 2>&1; then
  echo "Open Design already running at http://${HOST}:${PORT}"
  curl -s "http://${HOST}:${PORT}/api/health"
  echo
  exit 0
fi

echo "Starting Open Design ADE on http://${HOST}:${PORT} ..."
echo "Using binary: $ADE_BIN"
nohup "$ADE_BIN" --no-open --host "$HOST" --port "$PORT" \
  >"${TMPDIR:-/tmp}/open-design-ade.log" 2>&1 &
echo $! >"${TMPDIR:-/tmp}/open-design-ade.pid"

for _ in $(seq 1 30); do
  if curl -sf "http://${HOST}:${PORT}/api/health" >/dev/null 2>&1; then
    echo "Open Design ready: http://${HOST}:${PORT}"
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
