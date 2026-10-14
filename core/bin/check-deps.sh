#!/usr/bin/env bash
# Revisa el staging de un proyecto antes de congelar: lista de features, dependencias y ficheros.
# Uso: check-deps.sh <proyecto>   → exit 0 si no hay errores (los avisos no cuentan), 1 si los hay.
#
# Errores: ids repetidos o mal formados, dependencias que no existen o ciclos, tests que faltan,
# rúbricas sin feature, y el caso que paró fast-reading: el test de una feature usa un módulo cuya
# dueña (campo "provides" de otra feature) no está entre sus dependencias, directas o indirectas.
# Avisos: módulos que usan los tests de varias features sin dueña declarada.
set -euo pipefail
P="${1:?uso: check-deps.sh <proyecto>}"
H="$(cd "$(dirname "$0")/../.." && pwd)"
# Lee una variable de un .env sourceándolo en un subshell (así vale $HOME y comillas).
# shellcheck disable=SC1090
env_var() { [[ -f "$1" ]] || return 0; ( set +u; source "$1" >/dev/null 2>&1; eval "printf %s \"\${$2:-}\"" ); }
ROOT="${MUSTHAVE_HOME:-$HOME/.musthave}"
STG="$ROOT/$P/staging"
FL="$STG/feature_list.json"
[[ -f "$FL" ]] || { echo "ERROR: no existe $FL" >&2; exit 1; }
jq -e 'type == "array" and length > 0' "$FL" >/dev/null 2>&1 || { echo "ERROR: $FL no es un array JSON con features" >&2; exit 1; }

PROFILE="$(env_var "$STG/project.env" PROFILE)"
case "$PROFILE" in */*) PD="$PROFILE" ;; "") PD="" ;; *) PD="$H/profiles/$PROFILE" ;; esac

# Módulos que importa el test de cada feature, si el perfil sabe sacarlos (imports.sh).
imports='{}'
if [[ -n "$PD" && -x "$PD/imports.sh" ]]; then
  imports="$(jq -r '.[] | "\(.id)\t\(.verify.file // "")"' "$FL" | while IFS=$'\t' read -r id file; do
    [[ -f "$STG/mirror/$file" ]] || continue
    "$PD/imports.sh" "$STG/mirror/$file" | jq -R --arg id "$id" '{id: $id, m: .}'
  done | jq -s 'group_by(.id) | map({key: .[0].id, value: (map(.m) | unique)}) | from_entries')"
fi
missing="$(jq -r '.[] | .verify.file // ""' "$FL" | while read -r file; do
  [[ -n "$file" && -f "$STG/mirror/$file" ]] || echo "${file:-<sin verify.file>}"
done | jq -R . | jq -s .)"
rubrics="$( (ls "$STG/rubrics" 2>/dev/null || true) | sed -n 's/\.json$//p' | jq -R . | jq -s .)"

report="$(jq --argjson imp "$imports" --argjson missing "$missing" --argjson rubrics "$rubrics" '
  . as $fl
  | ($fl | map(.id)) as $ids
  | ($fl | map({key: (.id | tostring), value: (.depends_on // [])}) | from_entries) as $deps
  # ancestros = todo lo que hace falta antes, directa o indirectamente (a prueba de ciclos)
  | def anc($f): {seen: [], todo: ($deps[$f] // [])}
      | until(.todo | length == 0; .todo[0] as $x | .todo |= .[1:]
          | if (.seen | index($x)) then . else .seen += [$x] | .todo += ($deps[$x] // []) end)
      | .seen;
  ($fl | map(select(.provides) | .id as $id | .provides[] | {key: ., value: $id}) | from_entries) as $owner
  | [$fl[] | .id as $f | select(anc($f) | index($f)) | $f] as $cyc
  # orden en que el bucle las cogerá si todo pasa a la primera
  | ({done: [], stop: false} | until(.stop;
      . as $s | ([$fl[] | .id as $i | select(($s.done | index($i)) == null and all((.depends_on // [])[]; . as $d | ($s.done | index($d)) != null))]
                 | sort_by(.priority) | first) as $n
      | if $n == null then .stop = true else .done += [$n.id] end) | .done) as $order
  | {
      errors: [
        ($ids | group_by(.) | map(select(length > 1) | "id repetido \(.[0])")[]),
        ($fl[] | select((.id | type) != "string" or (.priority | type) != "number" or ((.depends_on // []) | type) != "array")
          | "\(.id // "?"): faltan id (string), priority (número) o depends_on (array)"),
        ($fl[] | .id as $f | (.depends_on // [])[] | . as $d | select(($ids | index($d)) == null) | "\($f) depende de \($d), que no existe"),
        (if $cyc | length > 0 then "ciclo de dependencias en \($cyc | join(", "))" else empty end),
        ($missing[] | "no existe el test mirror/\(.)"),
        ($rubrics[] | . as $r | select(($ids | index($r)) == null) | "rubrics/\($r).json no corresponde a ninguna feature"),
        ($imp | to_entries[] | .key as $f | .value[] | . as $m | $owner[$m] as $o | select($o and $o != $f and ((anc($f) | index($o)) == null))
          | "el test de \($f) usa \($m), que hace \($o), pero \($f) no depende de \($o)")
      ],
      warnings: [
        [$imp | to_entries[] | .key as $f | .value[] | {m: ., f: $f}] | group_by(.m)
        | map(select(length > 1 and ($owner[.[0].m] | not)))[]
        | "\(.[0].m) lo usan los tests de \(map(.f) | join(", ")) y ninguna lo declara en \"provides\""
      ],
      order: $order,
      pending: [$ids[] | . as $i | select(($order | index($i)) == null)],
      total: ($fl | length)
    }' "$FL")"

jq -r '
  (.errors[] | "ERROR: \(.)"), (.warnings[] | "AVISO: \(.)"),
  "Orden previsto: \(.order | join(" → "))" + (if .pending | length > 0 then " · nunca arrancan: \(.pending | join(", "))" else "" end),
  (if .errors | length == 0 then "OK: \(.total) features, dependencias sanas" else empty end)' <<<"$report"
jq -e '.errors | length == 0' <<<"$report" >/dev/null
