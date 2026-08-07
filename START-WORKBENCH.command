#!/bin/zsh

set -e

cd "${0:A:h}"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Unlock AI Workbench needs pnpm 11. Install pnpm, then run this launcher again."
  read -r "?Press Return to close."
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Installing Workbench dependencies for the first run…"
  pnpm install --frozen-lockfile
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
fi

echo "Starting Unlock AI Workbench…"
echo "Keep this window open while you use the app."
exec pnpm run workbench
