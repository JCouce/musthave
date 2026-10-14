#!/usr/bin/env bash
# Resumen de estado y consumo (tokens y coste estimado a precio de API; con plan Max no se cobra).
set -euo pipefail
source "$(dirname "$0")/common.sh"
echo "== Estado"
jq -r 'to_entries[] | "\(.key)  \(if .value.passes then "VERDE" elif .value.blocked_reason then "BLOQUEADA" else "rojo" end)  intentos=\(.value.attempts) regresiones=\(.value.regressions)"' "$STATE/status.json"
echo "== Consumo por rol"
shopt -s nullglob
files=("$STATE"/runs/*.json)
((${#files[@]})) || { echo "sin llamadas todavía"; exit 0; }
for f in "${files[@]}"; do
  role="$(basename "$f" .json | sed -E 's/.*-(build|eval)$/\1/')"
  jq -c --arg role "$role" 'select(type == "object") | {role: $role, cost: (.total_cost_usd // 0), in: ((.usage.input_tokens // 0) + (.usage.cache_creation_input_tokens // 0) + (.usage.cache_read_input_tokens // 0)), out: (.usage.output_tokens // 0), turns: (.num_turns // 0), ms: (.duration_ms // 0)}' "$f" 2>/dev/null || true
done | jq -s 'group_by(.role) | map({rol: .[0].role, llamadas: length, tokens_entrada: (map(.in) | add), tokens_salida: (map(.out) | add), turnos: (map(.turns) | add), minutos: ((map(.ms) | add) / 60000 | floor), coste_api_estimado_usd: ((map(.cost) | add) * 100 | round / 100)})
  | . + [{rol: "TOTAL", llamadas: (map(.llamadas) | add), tokens_entrada: (map(.tokens_entrada) | add), tokens_salida: (map(.tokens_salida) | add), turnos: (map(.turnos) | add), minutos: (map(.minutos) | add), coste_api_estimado_usd: ((map(.coste_api_estimado_usd) | add) * 100 | round / 100)}]'
