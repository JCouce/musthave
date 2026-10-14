#!/usr/bin/env bash
# Para el constructor: pasa los tests de aceptación sobre el directorio actual (sin commit).
# Uso (desde el repo): <oracle>/bin/check.sh MH-XX [MH-YY...]
set -euo pipefail
source "$(dirname "$0")/common.sh"
[[ "$PWD" == "$REPO" ]] || { echo "ejecútalo desde $REPO" >&2; exit 2; }
(($#)) || { echo "uso: check.sh MH-XX [...]" >&2; exit 2; }
sync_oracle "$REPO"
res="$(run_tests "$REPO" "$@")"
jq -r 'to_entries[] | "\(.key): \(if .value.ok then "OK" else "FALLA" end) (\(.value.passed) ok, \(.value.failed) fallos, \(.value.skipped) saltados)" + (if .value.errors|length > 0 then "\n  - " + (.value.errors | join("\n  - ")) else "" end)' <<<"$res"
jq -e '[.[] | .ok] | all' <<<"$res" >/dev/null
