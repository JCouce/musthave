#!/usr/bin/env bash
# Instala la skill /musthave (enlace simbólico) y apunta dónde está este repo para que la skill lo encuentre.
# Uso: skill/install.sh        Idempotente.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
HOME_DIR="${MUSTHAVE_HOME:-$HOME/.musthave}"
SKILLS="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
mkdir -p "$HOME_DIR" "$SKILLS"
printf 'MUSTHAVE_REPO=%s\nMUSTHAVE_HOME=%s\n' "$REPO" "$HOME_DIR" >"$HOME_DIR/config.env"
if [[ -L "$SKILLS/musthave" || ! -e "$SKILLS/musthave" ]]; then
  ln -sfn "$REPO/skill/musthave" "$SKILLS/musthave"
  echo "skill enlazada: $SKILLS/musthave → $REPO/skill/musthave"
else
  echo "ya existe $SKILLS/musthave y no es un enlace: no lo toco" >&2; exit 1
fi
echo "config: $HOME_DIR/config.env"
