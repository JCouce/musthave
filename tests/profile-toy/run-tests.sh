#!/usr/bin/env bash
# Cada test es un script bash (verify.file) que sale con 0 si pasa.
set -euo pipefail
DIR="$1"; shift
cd "$DIR"
for f in "$@"; do
  file="$(jq -r --arg f "$f" '.[] | select(.id == $f) | .verify.file' "$FEATURES")"
  if out="$(IN_ACCEPTANCE_TEST=1 bash ".oracle/$file" 2>&1)"; then
    jq -n --arg f "$f" '{($f): {passed: 1, failed: 0, skipped: 0, errors: []}}'
  else
    jq -n --arg f "$f" --arg e "$out" '{($f): {passed: 0, failed: 1, skipped: 0, errors: ["falla: \($e)"]}}'
  fi
done | jq -s 'add // {}'
