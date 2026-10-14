# shellcheck shell=bash disable=SC2034
# Variables y utilidades comunes. Se deducen de la ubicación: <base>/oracle/bin/common.sh
ORACLE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="$(dirname "$ORACLE")"
P="$(basename "$BASE")"
STATE="$BASE/state"
FEATURES="$ORACLE/feature_list.json"
PROFILE_DIR="$ORACLE/profile"

# Valores por defecto del núcleo; el perfil y luego el proyecto pueden pisarlos.
INSTALL_CMD=""
TYPECHECK_CMD=""
SERVE_CMD=""
BUILD_TOOLS=""
TRAP_PATHS="src"
TRAP_PATTERNS=""
EVAL_FILES=""
BUILD_MODEL="opus"
EVAL_MODEL="sonnet"
# shellcheck disable=SC1091
source "$PROFILE_DIR/profile.env"
# shellcheck disable=SC1091
source "$ORACLE/project.env"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-3}"
TIMEOUT_BIN="$(command -v gtimeout || command -v timeout || true)"

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" >&2; }

# Copia tests, fixtures y configs del oráculo a <dir>/.oracle, borrando lo que sobre.
sync_oracle() {
  mkdir -p "$1/.oracle"
  rsync -a --delete "$ORACLE/mirror/" "$1/.oracle/"
}

all_features() { jq -r '.[].id' "$FEATURES"; }
green_features() { jq -r 'to_entries[] | select(.value.passes) | .key' "$STATE/status.json"; }
has_rubric() { [[ -f "$ORACLE/rubrics/$1.json" ]]; }

# Corre un comando con tope de tiempo si hay timeout/gtimeout; si no, sin tope.
with_timeout() {
  local t="$1"; shift
  if [[ -n "$TIMEOUT_BIN" ]]; then "$TIMEOUT_BIN" "$t" "$@"; else "$@"; fi
}

# Pasa los tests del perfil y normaliza su salida (normalize.jq).
# Uso: run_tests <dir> <MH-XX>...   → JSON {MH-XX: {ok, passed, failed, skipped, errors}}
run_tests() {
  local dir="$1"; shift
  local raw
  raw="$(FEATURES="$FEATURES" ORACLE="$ORACLE" "$PROFILE_DIR/run-tests.sh" "$dir" "$@" 2>/dev/null)" || true
  jq -e . <<<"$raw" >/dev/null 2>&1 || raw='{}'
  jq -c -f "$ORACLE/bin/normalize.jq" --args "$@" <<<"$raw"
}

# 0 = ok, 10 = cupo/rate limit, 1 = otro error. $1 = salida JSON de claude, $2 = stderr, $3 = exit code
classify_run() {
  local out="$1" err="$2" rc="$3"
  if jq -e . "$out" >/dev/null 2>&1; then
    if [[ "$(jq -r '.is_error' "$out")" == "false" ]]; then return 0; fi
    if jq -e '(.api_error_status == 429) or ((.result // "") | test("usage limit|rate limit|limit reached"; "i"))' "$out" >/dev/null; then return 10; fi
    return 1
  fi
  if grep -qiE 'usage limit|rate limit|limit reached|429' "$err" 2>/dev/null; then return 10; fi
  return 1
}
