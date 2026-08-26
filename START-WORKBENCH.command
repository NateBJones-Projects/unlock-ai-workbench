#!/bin/zsh

set -e

cd "${0:A:h}"

workbench_node_ok() {
  "$1" -e 'const [a,b,c]=process.versions.node.split(".").map(Number);process.exit(a>24||(a===24&&(b>13||(b===13&&c>=1)))?0:1)' >/dev/null 2>&1
}

# A version manager (nvm, volta, etc.) can leave an old Node first on PATH even
# when a new-enough one is installed elsewhere — check known install locations
# before failing.
if ! command -v node >/dev/null 2>&1 || ! workbench_node_ok "$(command -v node)"; then
  for workbench_node_candidate in \
    /opt/homebrew/opt/node/bin/node \
    /usr/local/opt/node/bin/node \
    "$HOME"/.nvm/versions/node/*/bin/node(NnOn); do
    if [[ -x "$workbench_node_candidate" ]] && workbench_node_ok "$workbench_node_candidate"; then
      export PATH="${workbench_node_candidate:h}:$PATH"
      break
    fi
  done
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Unlock AI Workbench needs Node.js 24.13 or newer, and Node was not found."
  echo "Install it with:  brew install node"
  echo "Or download the installer from https://nodejs.org — then run this launcher again."
  read -r "?Press Return to close."
  exit 1
fi

if ! workbench_node_ok "$(command -v node)"; then
  echo "Unlock AI Workbench needs Node.js 24.13.1 or newer; this machine has Node $(node --version)."
  echo "Update it with:  brew install node  (or, if you use nvm:  nvm install 24 && nvm alias default 24)"
  echo "Or download the installer from https://nodejs.org — then run this launcher again."
  read -r "?Press Return to close."
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Unlock AI Workbench needs pnpm 11 or newer, and pnpm was not found."
  echo "Install it with:  brew install pnpm"
  echo "Or use the corepack tool that ships with Node:  corepack enable pnpm"
  read -r "?Press Return to close."
  exit 1
fi

workbench_pnpm_major="${$(pnpm --version 2>/dev/null)%%.*}"
if [[ "$workbench_pnpm_major" != <-> || "$workbench_pnpm_major" -lt 11 ]]; then
  echo "Unlock AI Workbench needs pnpm 11 or newer; this machine has pnpm $(pnpm --version)."
  echo "Update it with:  brew upgrade pnpm"
  echo "Or use the corepack tool that ships with Node:  corepack enable pnpm"
  read -r "?Press Return to close."
  exit 1
fi

workbench_install_sentinel="node_modules/.unlock-workbench-install-ok"
workbench_lock_hash="$(shasum -a 256 pnpm-lock.yaml | cut -d' ' -f1)"
if [[ ! -f "$workbench_install_sentinel" || "$(cat "$workbench_install_sentinel")" != "$workbench_lock_hash" ]]; then
  echo "Step 1/2: Installing dependencies (one-time, a few minutes)…"
  if ! pnpm install --frozen-lockfile; then
    echo "Dependency install did not finish, so the app was not started."
    echo "Check your internet connection, then run this launcher again — it retries automatically."
    echo "To see the full error, run this from Terminal in this folder:  pnpm install --frozen-lockfile"
    read -r "?Press Return to close."
    exit 1
  fi
  echo "$workbench_lock_hash" > "$workbench_install_sentinel"
else
  echo "Step 1/2: Dependencies are already installed — skipping."
fi

workbench_ringer_root="$PWD/apps/desktop/resources/ringer"
if [[ -f "$workbench_ringer_root/ringer.py" ]]; then
  export UNLOCK_RINGER_ROOT="$workbench_ringer_root"
else
  echo "Ringer is not bundled yet; Ringside launch controls will report unavailable."
  echo "Run: UNLOCK_RINGER_SOURCE=/path/to/ringer pnpm run sync:ringer"
fi

if [[ -z "${UNLOCK_RINGER_PYTHON:-}" ]]; then
  for workbench_python_candidate in python3.13 python3.12 python3; do
    if command -v "$workbench_python_candidate" >/dev/null 2>&1 && \
      "$workbench_python_candidate" -c 'import sys; raise SystemExit(sys.version_info < (3, 12))' >/dev/null 2>&1; then
      export UNLOCK_RINGER_PYTHON="$(command -v "$workbench_python_candidate")"
      break
    fi
  done
fi
if [[ -z "${UNLOCK_RINGER_PYTHON:-}" ]]; then
  echo "Python 3.12+ was not found; Ringside launch controls will report unavailable."
  echo "To enable multi-agent Ringer runs, install it with:  brew install python@3.13"
  echo "Everything else works without it — continuing."
fi

echo "Step 2/2: Starting Unlock AI Workbench…"
echo "Keep this window open while you use the app."
exec pnpm run workbench
