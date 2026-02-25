#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${SCHEDULER_BASE_URL:-http://localhost:3000}"
INTERVAL="${SCHEDULER_INTERVAL_SEC:-60}"

echo "[scheduler-loop] base_url=${BASE_URL} interval=${INTERVAL}s"

while true; do
  TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  if curl -fsS -X POST "${BASE_URL}/api/jobs/schedule_tick" >/tmp/fomo-schedule-tick.json 2>/dev/null; then
    STATUS="$(cat /tmp/fomo-schedule-tick.json)"
    echo "[${TS}] tick ok ${STATUS}"
  else
    echo "[${TS}] tick failed"
  fi
  sleep "${INTERVAL}"
done
