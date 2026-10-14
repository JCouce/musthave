#!/usr/bin/env bash
set -euo pipefail
grep -oE 'src/[a-z]+\.sh' "$1" | sort -u || true
