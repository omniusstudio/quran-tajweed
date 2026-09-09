#!/usr/bin/env bash
# Run by the launchd agent com.omniusstudio.nutq from ~/Library/Application Support/nutq (installed
# by scripts/install_app.sh). Finds node (nvm or Homebrew) and serves the copied build.
APP="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP" || exit 1
PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
NVM_NODE=$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1)
[ -n "$NVM_NODE" ] && PATH="$NVM_NODE:$PATH"
export PATH
command -v node >/dev/null || { echo "node not found; install Node.js"; sleep 30; exit 1; }
[ -f dist/index.html ] || { echo "no build here; run scripts/install_app.sh"; sleep 30; exit 1; }
exec node server/serve.mjs
