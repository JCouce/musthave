#!/usr/bin/env bash
# Prepara un proyecto nuevo: el staging del oráculo en $MUSTHAVE_HOME/<nombre>/staging y las plantillas en el repo.
# Uso: new-project.sh <nombre> <ruta del repo> [perfil]   (perfil por defecto: node-vitest-playwright)
# No pisa ningún fichero que ya exista en el repo.
set -euo pipefail
N="${1:?uso: new-project.sh <nombre> <ruta del repo> [perfil]}"
REPO_IN="${2:?uso: new-project.sh <nombre> <ruta del repo> [perfil]}"
PROFILE="${3:-node-vitest-playwright}"
H="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT="${MUSTHAVE_HOME:-$HOME/.musthave}"
BASE="$ROOT/$N"; STG="$BASE/staging"
[[ "$N" =~ ^[a-z0-9][a-z0-9._-]*$ ]] || { echo "nombre inválido: usa minúsculas, números, . _ -" >&2; exit 1; }
[[ -e "$BASE" ]] && { echo "ya existe $BASE" >&2; exit 1; }
case "$PROFILE" in */*) PD="$PROFILE" ;; *) PD="$H/profiles/$PROFILE" ;; esac
[[ -f "$PD/profile.env" ]] || { echo "no existe el perfil $PD (mira $H/profiles/)" >&2; exit 1; }

mkdir -p "$REPO_IN"
REPO="$(cd "$REPO_IN" && pwd)"

# Copia el árbol $1 en $2 sin pisar nada; sustituye {{PROJECT}}, {{REPO}}, {{ORACLE}} y {{PROFILE}} en lo copiado.
# $3 (opcional): árbol del perfil, que manda; lo que ya trae el perfil no se copia de la plantilla genérica.
copy_tree() {
  local src="$1" dst="$2" over="${3:-}" rel
  [[ -d "$src" ]] || return 0
  (cd "$src" && find . -type f) | while read -r rel; do
    rel="${rel#./}"
    [[ -n "$over" && -e "$over/$rel" ]] && continue
    [[ "$rel" == .gitkeep || "$rel" == */.gitkeep ]] && { mkdir -p "$dst/$(dirname "$rel")"; continue; }
    [[ -e "$dst/$rel" ]] && { echo "  ya existe, no lo toco: $dst/$rel"; continue; }
    mkdir -p "$dst/$(dirname "$rel")"
    sed -e "s|{{PROJECT}}|$N|g" -e "s|{{REPO}}|$REPO|g" -e "s|{{ORACLE}}|$BASE/oracle|g" -e "s|{{PROFILE}}|$PROFILE|g" \
      "$src/$rel" >"$dst/$rel"
    [[ -x "$src/$rel" ]] && chmod +x "$dst/$rel"
    echo "  + $dst/$rel"
  done
}

echo "staging en $STG"
mkdir -p "$STG"
copy_tree "$PD/staging" "$STG"
copy_tree "$H/templates/staging" "$STG" "$PD/staging"
echo "plantillas en $REPO"
copy_tree "$PD/project" "$REPO"
copy_tree "$H/templates/project" "$REPO" "$PD/project"

[[ -d "$REPO/.git" ]] || git -C "$REPO" init -q
touch "$REPO/.gitignore"
GITIGNORE="$( (set +u; source "$PD/profile.env" >/dev/null 2>&1; printf %s "${GITIGNORE:-}") )"
for g in .oracle/ $GITIGNORE; do grep -qx "$g" "$REPO/.gitignore" || echo "$g" >>"$REPO/.gitignore"; done

cat <<EOF

Listo. Siguiente paso en GUIA.md, fase 1 (requisitos). Ficheros a rellenar:
  $REPO/MUST_HAVES.md, $REPO/docs/CONTRACT.md, $REPO/AGENT.md
  $STG/feature_list.json, $STG/mirror/tests/, $STG/rubrics/
EOF
