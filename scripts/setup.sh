#!/usr/bin/env bash
set -euo pipefail

if (( EUID != 0 )); then
  echo "Run this installer as root: sudo ./scripts/setup.sh" >&2
  exit 1
fi

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_ROOT="${INSTALL_ROOT:-/opt/agent-foundry}"
APP_ROOT="$INSTALL_ROOT/app"
VENV_ROOT="$INSTALL_ROOT/venv"
CONFIG_ROOT="${CONFIG_ROOT:-/etc/agent-foundry}"
STATE_ROOT="${STATE_ROOT:-/var/lib/agent-foundry}"
LEARNER_USER="${LEARNER_USER:-agentlab}"
LEARNER_HOME="${LEARNER_HOME:-/srv/agent-foundry/learner}"

install_host_packages() {
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y python3 python3-venv python3-pip rsync curl ca-certificates
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y python3 python3-pip rsync curl ca-certificates
  else
    echo "Install Python 3.11.4+, venv support, rsync, curl and CA certificates, then rerun." >&2
    exit 1
  fi
}

install_host_packages
python3 - <<'PY'
import sys
if sys.version_info < (3, 11, 4):
    raise SystemExit("Python 3.11.4 or newer is required")
PY

if ! id agentfoundry >/dev/null 2>&1; then
  useradd --system --home-dir "$STATE_ROOT" --shell /usr/sbin/nologin agentfoundry
fi
if ! id "$LEARNER_USER" >/dev/null 2>&1; then
  useradd --create-home --home-dir "$LEARNER_HOME" --shell /bin/bash "$LEARNER_USER"
fi
install -d -m 0755 "$APP_ROOT" "$INSTALL_ROOT/packages"
install -d -o agentfoundry -g agentfoundry -m 0750 "$STATE_ROOT" "$STATE_ROOT/progress"
install -d -o root -g agentfoundry -m 0750 "$CONFIG_ROOT"
install -d -o "$LEARNER_USER" -g "$LEARNER_USER" -m 0700 "$LEARNER_HOME" "$LEARNER_HOME/workspace" "$LEARNER_HOME/reports"

if [[ "$(realpath "$SOURCE_ROOT")" != "$(realpath "$APP_ROOT")" ]]; then
  rsync -a --delete --exclude .git --exclude .venv --exclude data/progress --exclude reports "$SOURCE_ROOT/" "$APP_ROOT/"
fi

python3 -m venv "$VENV_ROOT"
"$VENV_ROOT/bin/python" -m pip install --upgrade pip
"$VENV_ROOT/bin/pip" install -r "$APP_ROOT/requirements-web.txt" -r "$APP_ROOT/requirements-lab.txt"
if [[ ! -x "$LEARNER_HOME/.venv/bin/python" ]]; then
  python3 -m venv "$LEARNER_HOME/.venv"
fi
ln -sfn "$VENV_ROOT/bin/mcp-scanner" "$LEARNER_HOME/.venv/bin/mcp-scanner"

if ! command -v pi >/dev/null 2>&1; then
  command -v npm >/dev/null 2>&1 || {
    echo "Pi still needs Node.js 22.19+ and npm. Install them, then rerun." >&2
    exit 1
  }
  node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(major<22 || (major===22 && minor<19)) process.exit(1)' || {
    echo "Pi requires Node.js 22.19 or newer." >&2
    exit 1
  }
  npm install -g --ignore-scripts @earendil-works/pi-coding-agent@0.87.1
fi

if [[ ! -f "$CONFIG_ROOT/agent-foundry.env" ]]; then
  access_code="$(python3 -c 'import secrets; print(secrets.token_urlsafe(12))')"
  install -m 0640 -o root -g agentfoundry /dev/null "$CONFIG_ROOT/agent-foundry.env"
  {
    printf 'LAB_MODE=demo\n'
    printf 'LAB_ACCESS_CODE=%s\n' "$access_code"
    printf 'LAB_DATA_DIR=%s\n' "$STATE_ROOT"
  } > "$CONFIG_ROOT/agent-foundry.env"
fi

access_code="$(sed -n 's/^LAB_ACCESS_CODE=//p' "$CONFIG_ROOT/agent-foundry.env")"
if [[ "${ENABLE_LOCAL_PASSWORD:-1}" == "1" ]]; then
  printf '%s:%s\n' "$LEARNER_USER" "$access_code" | chpasswd
fi
if ! grep -q '# Agent Foundry environment' "$LEARNER_HOME/.profile" 2>/dev/null; then
  {
    printf '\n# Agent Foundry environment\n'
    printf 'export PATH="$HOME/.venv/bin:/opt/agent-foundry/venv/bin:$PATH"\n'
    printf 'export AGENT_FOUNDRY_ROOT=/opt/agent-foundry/app\n'
  } >> "$LEARNER_HOME/.profile"
fi
chown -R "$LEARNER_USER":"$LEARNER_USER" "$LEARNER_HOME"
install -m 0600 -o root -g root /dev/null /root/agent-foundry-credentials.txt
{
  printf 'Linux user: %s\n' "$LEARNER_USER"
  printf 'Lab access code: %s\n' "$access_code"
  printf 'Lab URL: http://HOST:8080\n'
} > /root/agent-foundry-credentials.txt

install -m 0644 "$APP_ROOT/deploy/agent-foundry.service" /etc/systemd/system/agent-foundry.service
systemctl daemon-reload
systemctl enable --now agent-foundry.service

echo "Agent Foundry is running on port 8080."
echo "Single-user credentials: /root/agent-foundry-credentials.txt"
