#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COUNT="${1:-40}"
BASE_PORT="${BASE_PORT:-9000}"

[[ "$COUNT" =~ ^[0-9]+$ ]] && (( COUNT >= 1 && COUNT <= 40 )) || { echo "Seat count must be 1-40." >&2; exit 2; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required." >&2; exit 1; }

printf 'seat,url,access_code,container\n' > "$ROOT_DIR/users.csv"
for ((i=1; i<=COUNT; i++)); do
  seat="$(printf '%02d' "$i")"
  name="agent-foundry-$seat"
  port=$((BASE_PORT+i))
  code="$(openssl rand -hex 6)"
  docker volume create "$name-progress" >/dev/null
  docker volume create "$name-reports" >/dev/null
  docker volume create "$name-home" >/dev/null
  docker volume create "$name-workspace" >/dev/null
  docker run -d --name "$name" --restart unless-stopped \
    --cpus 1.5 --memory 2g --pids-limit 256 \
    --read-only --tmpfs /tmp:rw,noexec,nosuid,size=256m \
    -v "$name-progress:/opt/agent-foundry/data/progress" \
    -v "$name-reports:/opt/agent-foundry/reports" \
    -v "$name-home:/home/learner" \
    -v "$name-workspace:/workspace" \
    -e "LAB_ACCESS_CODE=$code" -e LAB_MODE=demo \
    -p "${port}:8080" agent-foundry-lab:local >/dev/null
  printf '%s,http://HOST:%s,%s,%s\n' "$seat" "$port" "$code" "$name" >> "$ROOT_DIR/users.csv"
done
chmod 600 "$ROOT_DIR/users.csv"
echo "Provisioned $COUNT isolated seats. Credentials: $ROOT_DIR/users.csv"
