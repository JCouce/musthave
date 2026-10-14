#!/usr/bin/env bash
# Devuelve los intentos a features bloqueadas (o que gastaron intentos por un fallo que no era suyo).
# Uso: unblock.sh <proyecto> <MH-XX> [MH-YY...]   (con el bucle parado)
set -euo pipefail
P="${1:?uso: unblock.sh <proyecto> <MH-XX>...}"; shift
(($#)) || { echo "uso: unblock.sh <proyecto> <MH-XX>..." >&2; exit 2; }
STATE="${MUSTHAVE_HOME:-$HOME/.musthave}/$P/state"
[[ -f "$STATE/status.json" ]] || { echo "no existe $STATE/status.json" >&2; exit 1; }
if [[ -s "$STATE/lock.pid" ]] && kill -0 "$(cat "$STATE/lock.pid")" 2>/dev/null; then echo "el bucle está corriendo: páralo antes" >&2; exit 1; fi
tmp="$(mktemp "$STATE/.status.XXXXXX")"
jq --args '. as $s | reduce $ARGS.positional[] as $f ($s;
  if has($f) then .[$f].attempts = 0 | .[$f].blocked_reason = null else error("no existe \($f)") end)' "$@" \
  <"$STATE/status.json" >"$tmp" && mv "$tmp" "$STATE/status.json"
for f in "$@"; do echo "$f: intentos a 0, desbloqueada"; done
