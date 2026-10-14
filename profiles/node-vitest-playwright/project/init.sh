#!/usr/bin/env bash
# Smoke test: dependencias instaladas y el proyecto compila. Lo usa el constructor al empezar.
set -euo pipefail
cd "$(dirname "$0")"
[[ -d node_modules ]] || npm install --no-audit --no-fund
npx tsc --noEmit
echo "init ok"
