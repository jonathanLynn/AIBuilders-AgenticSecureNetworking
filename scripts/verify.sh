#!/usr/bin/env bash
set -u

pass=0
fail=0
check_command() {
  if command -v "$1" >/dev/null 2>&1; then printf 'PASS  %-20s %s\n' "$1" "$(command -v "$1")"; pass=$((pass+1));
  else printf 'FAIL  %-20s missing\n' "$1"; fail=$((fail+1)); fi
}

ROOT_DIR="${AGENT_FOUNDRY_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
printf 'Agent Foundry native readiness\n\n'
check_command python3
check_command pi
check_command mcp-scanner

if [[ -n "${VIRTUAL_ENV:-}" ]]; then printf 'PASS  %-20s %s\n' "virtual environment" "$VIRTUAL_ENV"; pass=$((pass+1));
else printf 'FAIL  %-20s inactive (run: source ~/.venv/bin/activate)\n' "virtual environment"; fail=$((fail+1)); fi
if python3 -m py_compile "$ROOT_DIR/app.py"; then printf 'PASS  %-20s valid\n' "Python service"; pass=$((pass+1)); else printf 'FAIL  %-20s invalid\n' "Python service"; fail=$((fail+1)); fi
if python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$ROOT_DIR/data/modules.json"; then printf 'PASS  %-20s valid\n' "course data"; pass=$((pass+1)); else printf 'FAIL  %-20s invalid\n' "course data"; fail=$((fail+1)); fi

printf '\n%d passed, %d failed\n' "$pass" "$fail"
test "$fail" -eq 0
