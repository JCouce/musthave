#!/usr/bin/env bash
# Contrato de perfil: run-tests.sh <dir> <MH-XX>...  (el núcleo exporta FEATURES y ORACLE)
# <dir> ya tiene .oracle/ con los tests. Imprime {MH-XX: {passed, failed, skipped, errors}}; el "ok" lo decide el núcleo.
# verify.kind "test" → Vitest con .oracle/vitest.config.mjs; "e2e" → Playwright con .oracle/playwright.config.mjs.
set -euo pipefail
DIR="$1"; shift
TMP="$(mktemp -d "${TMPDIR:-/tmp}/musthave-tests.XXXXXX")"
units=(); e2es=(); e2e_ids=()
for f in "$@"; do
  read -r kind file < <(jq -r --arg f "$f" '.[] | select(.id == $f) | "\(.verify.kind) \(.verify.file)"' "$FEATURES")
  if [[ "$kind" == e2e ]]; then e2es+=("$(basename "$file")"); e2e_ids+=("$f"); else units+=(".oracle/$file"); fi
done
cd "$DIR"; DIR="$(pwd -P)"
if ((${#units[@]})); then
  npx vitest run --config .oracle/vitest.config.mjs --root "$DIR" --reporter=json \
    --outputFile="$TMP/vitest.json" "${units[@]}" >"$TMP/vitest.log" 2>&1 || true
fi
if ((${#e2es[@]})); then
  npx playwright test --config .oracle/playwright.config.mjs --reporter=json "${e2es[@]}" \
    >"$TMP/e2e.json" 2>"$TMP/e2e.log" || true
fi
E2E_IDS="$(IFS=,; echo "${e2e_ids[*]:-}")" node "$(dirname "$0")/summarize.mjs" "$TMP" "$@"
