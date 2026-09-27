#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${AGENT_FOUNDRY_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
REPORT_DIR="${AGENT_FOUNDRY_REPORTS:-$HOME/reports}"
mkdir -p "$REPORT_DIR"

if ! command -v mcp-scanner >/dev/null 2>&1; then
  echo "mcp-scanner is not installed. Run ./scripts/setup.sh first." >&2
  exit 1
fi

mcp-scanner \
  --analyzers yara,prompt_defense,readiness \
  --format raw \
  --output "$REPORT_DIR/mcp-scan.json" \
  static \
  --tools "$ROOT_DIR/lab/vulnerable-mcp/tools.json"

echo "Report written to $REPORT_DIR/mcp-scan.json"
