#!/usr/bin/env bash
# Comprueba que la máquina (y, si se indica, un proyecto) está lista para lanzar el bucle.
# Uso: doctor.sh [proyecto] [--smoke]
#   --smoke hace dos llamadas mínimas a claude -p: confirma que tira del plan (no de API key) y que --json-schema va.
set -uo pipefail
H="$(cd "$(dirname "$0")/../.." && pwd)"
# Lee una variable de un .env sourceándolo en un subshell (así vale $HOME y comillas).
# shellcheck disable=SC1090
env_var() { [[ -f "$1" ]] || return 0; ( set +u; source "$1" >/dev/null 2>&1; eval "printf %s \"\${$2:-}\"" ); }
ROOT="${MUSTHAVE_HOME:-$HOME/.musthave}"
P=""; SMOKE=0
for a in "$@"; do case "$a" in --smoke) SMOKE=1 ;; *) P="$a" ;; esac; done
fails=0
ok() { printf '  ok     %s\n' "$*"; }
warn() { printf '  AVISO  %s\n' "$*"; }
bad() { printf '  FALLA  %s\n' "$*"; fails=$((fails + 1)); }
need() { if command -v "$1" >/dev/null 2>&1; then ok "$1"; else bad "$1 no está instalado${2:+ ($2)}"; fi; }

echo "== Máquina"
for c in bash git jq rsync shasum curl lsof claude; do need "$c"; done
if command -v gtimeout >/dev/null || command -v timeout >/dev/null; then ok "timeout"; else warn "sin gtimeout/timeout: las vueltas no tienen tope de tiempo (brew install coreutils)"; fi
command -v bats >/dev/null && ok "bats" || warn "sin bats: no puedes pasar los tests del harness (brew install bats-core)"
command -v caffeinate >/dev/null && ok "caffeinate" || warn "sin caffeinate: evita que el equipo se duerma a mano"
command -v claude >/dev/null && ok "claude $(claude --version 2>/dev/null | head -1)"
[[ -n "${ANTHROPIC_API_KEY:-}" ]] && warn "ANTHROPIC_API_KEY está definida: el bucle la quita, pero en tu shell gastaría API" || ok "sin ANTHROPIC_API_KEY"
sudo -n true 2>/dev/null && warn "sudo cacheado: el bucle hace sudo -k, pero no lances nada más con sudo mientras corre" || ok "sudo no cacheado"
[[ -f "$ROOT/config.env" ]] && ok "skill instalada ($ROOT/config.env)" || warn "skill /musthave sin instalar (skill/install.sh)"

if ((SMOKE)); then
  echo "== Smoke de claude -p"
  src="$(cd "${TMPDIR:-/tmp}" && env -u ANTHROPIC_API_KEY claude -p "responde solo: ok" --output-format stream-json --verbose --max-turns 1 2>/dev/null | head -1 | jq -r '.apiKeySource // "?"')"
  [[ "$src" == none ]] && ok "tira de la suscripción (apiKeySource=none)" || bad "apiKeySource=$src: no está usando el plan (haz claude /login)"
  js="$(cd "${TMPDIR:-/tmp}" && env -u ANTHROPIC_API_KEY claude -p "devuelve n=1" --output-format json --max-turns 2 \
        --json-schema '{"type":"object","properties":{"n":{"type":"number"}},"required":["n"]}' 2>/dev/null | jq -r '.structured_output.n // empty')"
  [[ "$js" == 1 ]] && ok "--json-schema devuelve structured_output" || bad "--json-schema no devolvió structured_output"
fi

if [[ -n "$P" ]]; then
  BASE="$ROOT/$P"
  echo "== Proyecto $P"
  [[ -f "$BASE/staging/project.env" ]] || { bad "no existe $BASE/staging/project.env (new-project.sh)"; exit 1; }
  REPO="$(env_var "$BASE/staging/project.env" REPO)"
  PROFILE="$(env_var "$BASE/staging/project.env" PROFILE)"
  if [[ -d "$REPO/.git" ]]; then
    ok "repo $REPO"
    git -C "$REPO" rev-parse HEAD >/dev/null 2>&1 && ok "el repo tiene commits" || bad "el repo no tiene ningún commit"
    [[ -z "$(git -C "$REPO" status --porcelain 2>/dev/null)" ]] && ok "árbol limpio" || warn "hay cambios sin commitear en el repo"
  else bad "REPO=$REPO no es un repo git"; fi
  case "$PROFILE" in */*) PD="$PROFILE" ;; *) PD="$H/profiles/$PROFILE" ;; esac
  if [[ -f "$PD/profile.env" ]]; then
    ok "perfil $PROFILE"
    REQUIRES="$(env_var "$PD/profile.env" REQUIRES)"
    for c in $REQUIRES; do need "$c" "lo pide el perfil"; done
  else bad "perfil $PROFILE no existe"; fi
  "$H/core/bin/check-deps.sh" "$P" | sed 's/^/  /' || fails=$((fails + 1))
  O="$BASE/oracle"
  if [[ -d "$O" ]]; then
    [[ "$(stat -f %u "$O" 2>/dev/null || stat -c %u "$O")" == 0 ]] && ok "oráculo de root" || warn "el oráculo no es de root (¿congelado sin sudo?)"
    (cd "$O" && shasum -a 256 -c --quiet hashes.sha256 >/dev/null 2>&1) && ok "hashes del oráculo cuadran" || bad "hashes del oráculo NO cuadran"
    for f in feature_list.json project.env; do
      cmp -s "$O/$f" "$BASE/staging/$f" && ok "$f congelado = staging" || warn "$f del staging cambió tras congelar: recongela"
    done
  else warn "oráculo sin congelar (sudo $H/core/bin/freeze.sh $P)"; fi
  if [[ -s "$BASE/state/lock.pid" ]] && kill -0 "$(cat "$BASE/state/lock.pid")" 2>/dev/null; then warn "hay un bucle corriendo (pid $(cat "$BASE/state/lock.pid"))"; fi
  ls "$REPO"/decisions/*.md >/dev/null 2>&1 && warn "decisiones pendientes en $REPO/decisions/" || ok "sin decisiones pendientes"
fi
echo
((fails == 0)) && echo "todo listo" || echo "$fails fallo(s)"
((fails == 0))
