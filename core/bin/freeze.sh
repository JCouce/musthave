#!/usr/bin/env bash
# Congela el oráculo de un proyecto: staging + núcleo + perfil → $MUSTHAVE_HOME/<p>/oracle (de root, solo lectura).
# Uso: sudo <repo musthave>/core/bin/freeze.sh <proyecto>
#      FREEZE_NOROOT=1 para los tests (sin sudo). Si MUSTHAVE_HOME no es ~/.musthave: sudo MUSTHAVE_HOME=... freeze.sh <p>
set -euo pipefail
P="${1:?uso: sudo freeze.sh <proyecto>}"
H="$(cd "$(dirname "$0")/../.." && pwd)"
# Lee una variable de un .env sourceándolo en un subshell (así vale $HOME y comillas).
# shellcheck disable=SC1090
env_var() { [[ -f "$1" ]] || return 0; ( set +u; source "$1" >/dev/null 2>&1; eval "printf %s \"\${$2:-}\"" ); }
if [[ "${FREEZE_NOROOT:-}" == 1 ]]; then
  U="$(id -un)"; UH="$HOME"
else
  [[ $EUID -eq 0 ]] || { echo "ejecútalo con sudo" >&2; exit 1; }
  U="${SUDO_USER:?}"; UH="$(eval echo "~$U")"
fi
ROOT="${MUSTHAVE_HOME:-$UH/.musthave}"
BASE="$ROOT/$P"; STG="$BASE/staging"; O="$BASE/oracle"
[[ -f "$STG/feature_list.json" && -f "$STG/project.env" ]] || { echo "falta $STG/feature_list.json o project.env" >&2; exit 1; }
[[ -d "$STG/mirror" ]] || { echo "falta $STG/mirror (tests, fixtures y configs)" >&2; exit 1; }

PROFILE="$(HOME="$UH" env_var "$STG/project.env" PROFILE)"
[[ -n "$PROFILE" ]] || { echo "project.env no define PROFILE" >&2; exit 1; }
case "$PROFILE" in */*) PD="$PROFILE" ;; *) PD="$H/profiles/$PROFILE" ;; esac
[[ -x "$PD/run-tests.sh" && -f "$PD/profile.env" ]] || { echo "perfil inválido: $PD (necesita run-tests.sh y profile.env)" >&2; exit 1; }

# Antes de congelar, el grafo de dependencias tiene que estar sano (aviso si no; FREEZE_FORCE=1 para saltarlo).
if [[ "${FREEZE_FORCE:-}" != 1 ]] && ! MUSTHAVE_HOME="$ROOT" "$H/core/bin/check-deps.sh" "$P" >&2; then
  echo "check-deps ha encontrado problemas: arréglalos o congela con FREEZE_FORCE=1" >&2; exit 1
fi

[[ -d "$O" ]] && mv "$O" "$O.prev.$(date +%s)"
mkdir -p "$O/bin" "$O/prompts" "$O/profile" "$O/mirror"
cp "$H"/core/bin/*.sh "$H"/core/bin/*.jq "$O/bin/"
cp "$H"/core/prompts/* "$O/prompts/"
find "$PD" -maxdepth 1 -type f -exec cp {} "$O/profile/" \;   # sin las plantillas staging/ y project/
cp "$STG/feature_list.json" "$STG/project.env" "$O/"
[[ -f "$STG/eval.md" ]] && cp "$STG/eval.md" "$O/"
[[ -f "$STG/eval.mcp.json" ]] && cp "$STG/eval.mcp.json" "$O/prompts/eval.mcp.json"
mkdir -p "$O/rubrics"
[[ -d "$STG/rubrics" ]] && cp -R "$STG/rubrics/." "$O/rubrics/"
cp -R "$STG/mirror/." "$O/mirror/"
(cd "$O" && find . -type f ! -name hashes.sha256 -print0 | sort -z | xargs -0 shasum -a 256 >hashes.sha256)
mkdir -p "$BASE/state"/{runs,verify,eval,eval-cwd}
[[ -f "$BASE/state/status.json" ]] || jq 'map({key: .id, value: {passes: false, attempts: 0, verified_at_sha: null, blocked_reason: null, regressions: 0}}) | from_entries' "$O/feature_list.json" >"$BASE/state/status.json"
# Features nuevas tras recongelar: entran en rojo sin tocar las existentes.
tmp="$(mktemp "$BASE/state/.status.XXXXXX")"
jq --slurpfile fl "$O/feature_list.json" 'reduce $fl[0][].id as $id (.; .[$id] //= {passes: false, attempts: 0, verified_at_sha: null, blocked_reason: null, regressions: 0})' "$BASE/state/status.json" >"$tmp" && mv "$tmp" "$BASE/state/status.json"
if [[ "${FREEZE_NOROOT:-}" != 1 ]]; then
  chown -R 0:0 "$O"
  chmod -R u=rwX,go=rX "$O"
  chmod 755 "$O"/bin/*.sh "$O"/profile/*.sh 2>/dev/null || true
  chown -R "$U:$(id -gn "$U")" "$BASE/state"
fi
echo "oráculo congelado en $O ($(wc -l <"$O/hashes.sha256" | tr -d ' ') ficheros, perfil $(basename "$PD"))"
