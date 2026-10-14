#!/usr/bin/env bash
# Lanza el constructor (claude -p) para una feature. Exit: 0 ok, 10 cupo agotado, 1 error.
# Uso: claude-build.sh <MH-XX> <nº vuelta>
set -euo pipefail
source "$(dirname "$0")/common.sh"
F="$1"; N="$2"
cd "$REPO"
sync_oracle "$REPO"
entry="$(jq -c --arg f "$F" '.[] | select(.id == $f)' "$FEATURES")"
last_verify="$(jq -c '{global_errors, fallos: [.results | to_entries[] | select(.value.ok | not) | {feature: .key, errors: .value.errors}]}' "$STATE/verify/$F.json" 2>/dev/null || echo ninguna)"
last_eval="$(cat "$STATE/eval/$F/last.json" 2>/dev/null || echo ninguno)"
prompt="$(cat "$ORACLE/prompts/PROMPT_build.md")

FEATURE: $F
ENTRADA: $entry
CHECK: $ORACLE/bin/check.sh $F
TYPECHECK: ${TYPECHECK_CMD:-no hay}
ÚLTIMA VERIFICACIÓN: $last_verify
ÚLTIMO VEREDICTO DEL EVALUADOR: $last_eval"

# Base común a cualquier stack + los comandos del perfil y del proyecto (lista separada por comas).
tools="Read,Edit,Write,Grep,Glob,TodoWrite,Bash(./init.sh*),Bash(ls *),Bash(git status*),Bash(git diff*),Bash(git log*),Bash(git show *),Bash(git add *),Bash(git commit *),Bash($ORACLE/bin/check.sh *)"
[[ -n "$BUILD_TOOLS" ]] && tools="$tools,$BUILD_TOOLS"
[[ -n "${EXTRA_BUILD_TOOLS:-}" ]] && tools="$tools,$EXTRA_BUILD_TOOLS"

out="$STATE/runs/$(printf '%03d' "$N")-$F-build.json"
rc=0
with_timeout "${BUILD_TIMEOUT:-45m}" claude -p "$prompt" \
  --model "$BUILD_MODEL" \
  --tools "Read,Edit,Write,Grep,Glob,Bash,TodoWrite" \
  --permission-mode dontAsk \
  --allowedTools "$tools" \
  --output-format json </dev/null >"$out" 2>"$out.err" || rc=$?
classify_run "$out" "$out.err" "$rc"
