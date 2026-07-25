#!/usr/bin/env bash
# Install Open Design deps into this repo (no sudo / no global npm).
set -euo pipefail

cd "$(dirname "$0")/.."

# Prefer nvm Node 24+ when available (avoids system node writing to /usr).
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
  nvm install 24 >/dev/null
  nvm use 24 >/dev/null
fi

echo "Using: $(command -v node) ($(node -v))"
echo "npm prefix: $(npm config get prefix)"

npm install

echo
echo "OK. Next:"
echo "  ./scripts/od-start.sh"
echo "Then reload MCP in Cursor (Settings → Tools & MCP → toggle open-design)."
