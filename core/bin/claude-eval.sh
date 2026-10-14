#!/usr/bin/env bash
# Lanza el evaluador (claude -p, sin herramientas de edición ni Bash) contra la app del worktree.
# Solo se usa en features con rúbrica (rubrics/MH-XX.json en el oráculo).
# Exit: 0 pass, 2 fail, 10 cupo agotado, 1 error. Uso: claude-eval.sh <MH-XX> <nº vuelta>
set -euo pipefail
source "$(dirname "$0")/common.sh"
F="$1"; N="$2"
WT="$STATE/wt"
PORT="${EVAL_PORT:-4174}"
mkdir -p "$STATE/eval/$F" "$STATE/eval-cwd"

# Ficheros de prueba que el evaluador puede cargar en la app (rutas relativas a mirror/).
files=""
for f in $EVAL_FILES; do
  cp "$ORACLE/mirror/$f" "$STATE/eval-cwd/"
  files="$files
- $STATE/eval-cwd/$(basename "$f")"
done

app="no hay app que levantar (SERVE_CMD vacío)"
if [[ -n "$SERVE_CMD" ]]; then
  cd "$WT"
  PORT="$PORT" bash -c "$SERVE_CMD" >"$STATE/eval/$F/serve.log" 2>&1 &
  srv=$!
  # El servidor puede ser un nieto de bash (npx → vite): al salir se mata también lo que escuche en el puerto.
  trap 'kill "$srv" 2>/dev/null || true; lsof -ti "tcp:$PORT" 2>/dev/null | xargs kill 2>/dev/null || true' EXIT
  up=0
  for _ in $(seq 1 240); do curl -fs "http://localhost:$PORT" >/dev/null 2>&1 && { up=1; break; }; sleep 0.5; done
  ((up)) || { log "la app del evaluador no arrancó (ver $STATE/eval/$F/serve.log)"; exit 1; }
  app="http://localhost:$PORT"
fi

prompt="$(cat "$ORACLE/prompts/PROMPT_eval.md")

FEATURE: $F
APP: $app
FICHEROS DE PRUEBA:${files:- ninguno}
INSTRUCCIONES DEL PROYECTO: $(cat "$ORACLE/eval.md" 2>/dev/null || echo ninguna)
RÚBRICA: $(cat "$ORACLE/rubrics/$F.json")"

mcp="$ORACLE/prompts/eval.mcp.json"
out="$STATE/runs/$(printf '%03d' "$N")-$F-eval.json"
rc=0
cd "$STATE/eval-cwd"
with_timeout "${EVAL_TIMEOUT:-20m}" claude -p "$prompt" \
  --model "$EVAL_MODEL" \
  --restricted --tools "Read" \
  --strict-mcp-config --mcp-config "$mcp" \
  --permission-mode dontAsk --allowedTools "${EVAL_TOOLS:-Read,mcp__playwright__*}" \
  --json-schema "$(cat "$ORACLE/prompts/eval.schema.json")" \
  --output-format json </dev/null >"$out" 2>"$out.err" || rc=$?
c=0; classify_run "$out" "$out.err" "$rc" || c=$?
((c == 0)) || exit "$c"
jq '.structured_output' "$out" >"$STATE/eval/$F/last.json"
[[ "$(jq -r '.verdict' "$STATE/eval/$F/last.json")" == pass ]] || exit 2
