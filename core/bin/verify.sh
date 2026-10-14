#!/usr/bin/env bash
# Verifica HEAD en un worktree limpio con los tests del oráculo.
# Uso: verify.sh <MH-XX|ALL>   → JSON por stdout; exit 0 si la feature (o todas con ALL) pasa.
set -euo pipefail
source "$(dirname "$0")/common.sh"
F="$1"
SHA="$(git -C "$REPO" rev-parse HEAD 2>/dev/null || echo none)"
WT="$STATE/wt"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/musthave-verify.XXXXXX")"
errors=()

if [[ "$SHA" == none ]]; then
  jq -n --arg f "$F" '{sha: null, feature: $f, global_errors: ["no hay ningún commit"], results: {}}'
  exit 1
fi

git -C "$REPO" worktree remove --force "$WT" >/dev/null 2>&1 || true
git -C "$REPO" worktree prune
git -C "$REPO" worktree add --detach "$WT" "$SHA" >/dev/null 2>&1
sync_oracle "$WT"
cd "$WT"

if [[ -n "$INSTALL_CMD" ]] && ! bash -c "$INSTALL_CMD" >"$TMP/install.log" 2>&1; then
  errors+=("instalación falló ($INSTALL_CMD): $(tail -5 "$TMP/install.log" | tr '\n' ' ')")
fi
if [[ -n "$TYPECHECK_CMD" ]] && ! bash -c "$TYPECHECK_CMD" >"$TMP/typecheck.log" 2>&1; then
  errors+=("typecheck ($TYPECHECK_CMD): $(head -15 "$TMP/typecheck.log" | tr '\n' ' ' | cut -c1-1200)")
fi
# Trampas y placeholders en el código de la app: las genéricas más las del perfil/proyecto.
pattern='\.oracle|TODO|FIXME|placeholder'
[[ -n "$TRAP_PATTERNS" ]] && pattern="$pattern|$TRAP_PATTERNS"
# shellcheck disable=SC2086
if traps="$(grep -rnE "$pattern" $TRAP_PATHS 2>/dev/null | head -5)" && [[ -n "$traps" ]]; then
  errors+=("trampa o placeholder en $TRAP_PATHS: $(tr '\n' ' ' <<<"$traps" | cut -c1-600)")
fi

if [[ "$F" == ALL ]]; then
  check="$(all_features)"
else
  check="$({ echo "$F"; green_features; } | awk '!seen[$0]++')"
fi
# shellcheck disable=SC2086
results="$(run_tests "$WT" $check)"

json="$(jq -n --arg sha "$SHA" --arg f "$F" --argjson r "$results" \
  --argjson e "$(printf '%s\n' "${errors[@]+"${errors[@]}"}" | jq -R . | jq -s 'map(select(length > 0))')" \
  '{sha: $sha, feature: $f, global_errors: $e, results: $r}')"
echo "$json"
if [[ "$F" == ALL ]]; then
  jq -e '(.global_errors | length) == 0 and ([.results[] | .ok] | all)' <<<"$json" >/dev/null
else
  jq -e --arg f "$F" '(.global_errors | length) == 0 and .results[$f].ok' <<<"$json" >/dev/null
fi
