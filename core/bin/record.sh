#!/usr/bin/env bash
# Apunta en status.json el resultado de una vuelta. Solo este script escribe el estado.
# Uso: record.sh <MH-XX> <verify.json> <veredicto eval: pass|fail|none>
set -euo pipefail
source "$(dirname "$0")/common.sh"
F="$1"; V="$2"; EV="$3"
tmp="$(mktemp "$STATE/.status.XXXXXX")"
jq --arg f "$F" --slurpfile v "$V" --arg ev "$EV" --argjson max "$MAX_ATTEMPTS" '
  $v[0] as $v
  | reduce ($v.results | to_entries[] | select(.key != $f)) as $r (.;
      if $r.value.ok then .[$r.key].verified_at_sha = $v.sha
      else .[$r.key].passes = false | .[$r.key].verified_at_sha = null | .[$r.key].regressions += 1 end)
  | .[$f].attempts += 1
  | (($v.results[$f].ok // false) and ($v.global_errors | length) == 0 and ($ev == "pass" or $ev == "none")) as $ok
  | .[$f].passes = $ok
  | .[$f].verified_at_sha = (if $ok then $v.sha else null end)
  | if ($ok | not) and .[$f].attempts >= $max then .[$f].blocked_reason = "max_attempts" else . end
' "$STATE/status.json" >"$tmp"
mv "$tmp" "$STATE/status.json"
if [[ "$(jq -r --arg f "$F" '.[$f].passes' "$STATE/status.json")" == true ]]; then
  jq -r .sha "$V" >"$STATE/last_green.sha"
fi
