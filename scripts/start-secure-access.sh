#!/usr/bin/env bash
set -euo pipefail

: "${SECURE_ACCESS_API_KEY:?Set SECURE_ACCESS_API_KEY on the instructor host}"
: "${SECURE_ACCESS_API_SECRET:?Set SECURE_ACCESS_API_SECRET on the instructor host}"
: "${MCP_AUTH_TOKEN:=${SECURE_ACCESS_MCP_TOKEN:-}}"
: "${MCP_AUTH_TOKEN:?Set MCP_AUTH_TOKEN or SECURE_ACCESS_MCP_TOKEN}"
export MCP_AUTH_TOKEN

SERVER_DIR="${SECURE_ACCESS_SERVER_DIR:-/opt/secure-access-mcp-community}"
SERVER_VENV="${SECURE_ACCESS_VENV:-$SERVER_DIR/.venv}"
[[ -d "$SERVER_DIR" ]] || { echo "Clone CiscoDevNet/secure-access-mcp-community to $SERVER_DIR first." >&2; exit 1; }
[[ -x "$SERVER_VENV/bin/python" ]] || { echo "Create the server venv and install requirements at $SERVER_VENV first." >&2; exit 1; }

export SECURE_ACCESS_REQUIRE_CONFIRMATION=true
export SECURE_ACCESS_REDACT_PII=true
export HOST=127.0.0.1
export PORT="${SECURE_ACCESS_PORT:-8000}"
cd "$SERVER_DIR"
exec "$SERVER_VENV/bin/python" -m cisco_secure_access_mcp
