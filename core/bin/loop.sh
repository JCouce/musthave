#!/usr/bin/env bash
# Bucle principal. Lánzalo desde fuera del repo: $MUSTHAVE_HOME/<proyecto>/oracle/bin/loop.sh
# Exit: 0 terminado · 3 bloqueado/decisión · 4 tope de vueltas · 5 atascado · 6 lock/infra
set -euo pipefail
source "$(dirname "$0")/common.sh"
NFEAT="$(jq length "$FEATURES")"
MAX_ITER="${MAX_ITER:-$((3 * NFEAT + 10))}"
STALL_N="${STALL_N:-8}"
WAIT_SECS="${WAIT_SECS:-900}"
MAX_WAITS="${MAX_WAITS:-48}"

unset ANTHROPIC_API_KEY            # que tire del plan, no de la API
sudo -k 2>/dev/null || true        # sin sudo cacheado: el oráculo de root sigue siendo de root

mkdir -p "$STATE"/{runs,verify,eval,eval-cwd}
if [[ -s "$STATE/lock.pid" ]] && kill -0 "$(cat "$STATE/lock.pid")" 2>/dev/null; then log "ya hay un loop corriendo (pid $(cat "$STATE/lock.pid"))"; exit 6; fi
echo $$ >"$STATE/lock.pid"
cleanup() {
  git -C "$REPO" worktree remove --force "$STATE/wt" >/dev/null 2>&1 || true
  : >"$STATE/lock.pid"
}
trap cleanup EXIT

# Ejecuta claude-build/claude-eval esperando si se acaba el cupo; la espera no cuenta como intento.
with_wait() {
  local waits=0 rc
  while :; do
    rc=0; "$@" || rc=$?
    if ((rc == 10)); then
      waits=$((waits + 1))
      ((waits > MAX_WAITS)) && { log "demasiadas esperas de cupo"; exit 6; }
      log "cupo agotado; espero ${WAIT_SECS}s ($waits/$MAX_WAITS)"
      sleep "$WAIT_SECS"; continue
    fi
    return "$rc"
  done
}

greens() { jq '[.[] | select(.passes)] | length' "$STATE/status.json"; }
since_green=0; broken=0
log "inicio: $P · $NFEAT features · MAX_ITER=$MAX_ITER"
for ((i = 1; i <= MAX_ITER; i++)); do
  if ls "$REPO"/decisions/*.md >/dev/null 2>&1; then log "hay decisiones pendientes en $REPO/decisions"; exit 3; fi
  F="$(jq -r --slurpfile feats "$FEATURES" -f "$ORACLE/bin/next.jq" "$STATE/status.json")"
  case "$F" in
    ALL_GREEN)
      log "todo en verde: puerta final"
      rc=0; with_wait "$ORACLE/bin/final-gate.sh" "$i" || rc=$?
      ((rc == 0)) && { log "TERMINADO"; "$ORACLE/bin/report.sh" || true; exit 0; }
      continue ;;
    ALL_BLOCKED) log "todo lo pendiente está bloqueado"; "$ORACLE/bin/report.sh" || true; exit 3 ;;
  esac
  before="$(greens)"
  log "vuelta $i/$MAX_ITER · $F · verdes $before/$NFEAT"
  brc=0; with_wait "$ORACLE/bin/claude-build.sh" "$F" "$i" || brc=$?
  ((brc == 0)) || log "el constructor terminó con error ($brc); verifico igualmente"
  ev=none; vrc=0
  "$ORACLE/bin/verify.sh" "$F" >"$STATE/verify/$F.json" || vrc=$?
  if ((vrc == 0)) && has_rubric "$F"; then
    erc=0; with_wait "$ORACLE/bin/claude-eval.sh" "$F" "$i" || erc=$?
    case "$erc" in 0) ev=pass ;; *) ev=fail ;; esac
  fi
  "$ORACLE/bin/record.sh" "$F" "$STATE/verify/$F.json" "$ev"
  after="$(greens)"
  log "  → $F: $(jq -r --arg f "$F" '.[$f] | if .passes then "VERDE" else "rojo (intento \(.attempts))" end' "$STATE/status.json") · verdes $after/$NFEAT"
  if ((after > before)); then since_green=0; else since_green=$((since_green + 1)); fi
  # Build roto dos veces seguidas → vuelta al último verde (Ralph).
  if jq -e '.global_errors | length > 0' "$STATE/verify/$F.json" >/dev/null; then broken=$((broken + 1)); else broken=0; fi
  if ((broken >= 2)) && [[ -s "$STATE/last_green.sha" ]]; then
    log "build roto 2 veces: git reset --hard $(cat "$STATE/last_green.sha")"
    git -C "$REPO" reset --hard "$(cat "$STATE/last_green.sha")" >/dev/null; broken=0
  fi
  ((since_green >= STALL_N)) && { log "atascado: $STALL_N vueltas sin nuevos verdes"; "$ORACLE/bin/report.sh" || true; exit 5; }
done
log "tope de vueltas"; "$ORACLE/bin/report.sh" || true
exit 4
