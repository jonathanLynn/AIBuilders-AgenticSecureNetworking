#!/usr/bin/env bash
set -u

pass=0
fail=0
check_command() {
  if command -v "$1" >/dev/null 2>&1; then printf 'PASS  %-18s %s\n' "$1" "$(command -v "$1")"; pass=$((pass+1));
  else printf 'FAIL  %-18s missing\n' "$1"; fail=$((fail+1)); fi
}

printf 'Agent Foundry readiness\n\n'
check_command node
check_command pi
check_command mcp-scanner

if node --check server.mjs >/dev/null 2>&1; then printf 'PASS  %-18s valid\n' "guide server"; pass=$((pass+1)); else printf 'FAIL  %-18s invalid\n' "guide server"; fail=$((fail+1)); fi
if node --check lab/vulnerable-mcp/server.mjs >/dev/null 2>&1; then printf 'PASS  %-18s valid\n' "training fixture"; pass=$((pass+1)); else printf 'FAIL  %-18s invalid\n' "training fixture"; fail=$((fail+1)); fi

printf '\n%d passed, %d failed\n' "$pass" "$fail"
test "$fail" -eq 0
