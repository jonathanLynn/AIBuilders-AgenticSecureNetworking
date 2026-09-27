#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-docker}"

if [[ "$MODE" == "docker" ]]; then
  command -v docker >/dev/null 2>&1 || { echo "Docker is required for docker mode." >&2; exit 1; }
  docker build -t agent-foundry-lab:local "$ROOT_DIR"
  echo "Image ready. Start one seat with: docker compose up -d"
  echo "Provision a cohort with: ./scripts/provision-cohort.sh 40"
elif [[ "$MODE" == "native" ]]; then
  command -v node >/dev/null 2>&1 || { echo "Node.js 22.19+ is required." >&2; exit 1; }
  command -v npm >/dev/null 2>&1 || { echo "npm is required." >&2; exit 1; }
  command -v uv >/dev/null 2>&1 || { echo "uv is required: https://docs.astral.sh/uv/" >&2; exit 1; }
  npm install -g --ignore-scripts @earendil-works/pi-coding-agent@0.87.1
  pi install npm:pi-code@1.0.77
  uv tool install --python 3.13 cisco-ai-mcp-scanner==4.7.5
  "$ROOT_DIR/scripts/verify.sh"
  echo "Start the guide with: npm start"
else
  echo "Usage: $0 [docker|native]" >&2
  exit 2
fi
