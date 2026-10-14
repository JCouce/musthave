#!/usr/bin/env bash
# Puerta final: oráculo intacto + todos los tests en el mismo SHA + evaluador sobre todas las features con rúbrica.
# Exit 0 si todo pasa; si no, marca en rojo lo que falle (vía record.sh) y sale con 1.
# Uso: final-gate.sh <nº vuelta>
set -euo pipefail
source "$(dirname "$0")/common.sh"
N="$1"
if ! (cd "$ORACLE" && shasum -a 256 -c --quiet hashes.sha256 >/dev/null 2>&1); then
  log "PUERTA: el oráculo ha cambiado (hashes no cuadran)"; exit 1
fi
V="$STATE/verify/ALL.json"
ok=1
"$ORACLE/bin/verify.sh" ALL >"$V" || ok=0
# Reaplica resultados: lo que no pase vuelve a rojo.
tmp="$(mktemp "$STATE/.status.XXXXXX")"
jq --slurpfile v "$V" '$v[0] as $v | reduce ($v.results | to_entries[]) as $r (.;
  if $r.value.ok and ($v.global_errors | length) == 0 then .[$r.key].verified_at_sha = $v.sha
  else .[$r.key].passes = false | .[$r.key].verified_at_sha = null | .[$r.key].regressions += 1 end)' \
  "$STATE/status.json" >"$tmp" && mv "$tmp" "$STATE/status.json"
((ok)) || { log "PUERTA: verify completo falla"; exit 1; }
for f in $(all_features); do
  has_rubric "$f" || continue
  rc=0; "$ORACLE/bin/claude-eval.sh" "$f" "$N" || rc=$?
  if ((rc == 10)); then exit 10; fi
  if ((rc != 0)); then
    log "PUERTA: el evaluador suspende $f"
    tmp="$(mktemp "$STATE/.status.XXXXXX")"
    jq --arg f "$f" '.[$f].passes = false | .[$f].verified_at_sha = null' "$STATE/status.json" >"$tmp" && mv "$tmp" "$STATE/status.json"
    ok=0
  fi
done
((ok))
