#!/usr/bin/env bash
# Pasa los tests del STAGING (sin congelar) contra cualquier directorio. Sirve para validar el oráculo antes de
# congelarlo: contra el repo vacío (todo debe fallar), contra una implementación de referencia (todo debe pasar)
# y contra mutantes de esa referencia (cada uno debe hacer fallar algún test).
# Uso: try-tests.sh <proyecto> <dir> <MH-XX|ALL> [MH-YY...]
# Copia staging/mirror a <dir>/.oracle (borra lo que hubiera ahí) y no hace commits.
set -euo pipefail
P="${1:?uso: try-tests.sh <proyecto> <dir> <MH-XX|ALL>...}"; DIR="${2:?falta <dir>}"; shift 2
(($#)) || { echo "falta al menos una feature (o ALL)" >&2; exit 2; }
H="$(cd "$(dirname "$0")/../.." && pwd)"
STG="${MUSTHAVE_HOME:-$HOME/.musthave}/$P/staging"
FEATURES="$STG/feature_list.json"
[[ -f "$FEATURES" ]] || { echo "no existe $FEATURES" >&2; exit 1; }
DIR="$(cd "$DIR" && pwd)"
PROFILE="$( (set +u; source "$STG/project.env" >/dev/null 2>&1; printf %s "${PROFILE:-}") )"
case "$PROFILE" in */*) PD="$PROFILE" ;; *) PD="$H/profiles/$PROFILE" ;; esac
[[ -x "$PD/run-tests.sh" ]] || { echo "perfil inválido: $PD" >&2; exit 1; }
# shellcheck disable=SC2046  # los ids no llevan espacios
if [[ "$1" == ALL ]]; then set -- $(jq -r '.[].id' "$FEATURES"); fi
mkdir -p "$DIR/.oracle"
rsync -a --delete "$STG/mirror/" "$DIR/.oracle/"
raw="$(FEATURES="$FEATURES" ORACLE="$STG" "$PD/run-tests.sh" "$DIR" "$@" 2>/dev/null)" || true
jq -e . <<<"$raw" >/dev/null 2>&1 || raw='{}'
res="$(jq -c -f "$H/core/bin/normalize.jq" --args "$@" <<<"$raw")"
jq -r 'to_entries[] | "\(.key): \(if .value.ok then "OK" else "FALLA" end) (\(.value.passed) ok, \(.value.failed) fallos, \(.value.skipped) saltados)" + (if .value.errors|length > 0 then "\n  - " + (.value.errors | map(.[:300]) | join("\n  - ")) else "" end)' <<<"$res"
jq -e '[.[] | .ok] | all' <<<"$res" >/dev/null
