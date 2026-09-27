#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT_DIR/reports"

if ! command -v mcp-scanner >/dev/null 2>&1; then
  echo "mcp-scanner is not installed. Run ./scripts/setup.sh first." >&2
  exit 1
fi

mcp-scanner \
  --analyzers yara,prompt_defense,readiness \
  --format raw \
  --output "$ROOT_DIR/reports/mcp-scan.json" \
  static \
  --tools "$ROOT_DIR/lab/vulnerable-mcp/tools.json"

echo "Report written to $ROOT_DIR/reports/mcp-scan.json"
