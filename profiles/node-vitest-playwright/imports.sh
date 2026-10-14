#!/usr/bin/env bash
# Contrato de perfil (opcional): imports.sh <fichero de test> → un módulo de la app por línea.
# Lo usa check-deps.sh. Aquí: imports estáticos y dinámicos con el alias @/ (los relativos son helpers de test).
# Los "import type" no cuentan: se borran al compilar y no crean dependencia en tiempo de ejecución.
set -euo pipefail
grep -vE '^[[:space:]]*import[[:space:]]+type[[:space:]]' "$1" \
  | grep -oE "(from|import\() *['\"]@/[^'\"]+['\"]" | sed -E "s/.*['\"](@\/[^'\"]+)['\"].*/\1/" | sort -u || true
