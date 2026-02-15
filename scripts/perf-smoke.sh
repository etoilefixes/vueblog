#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"
BASE_URL="${BACKEND_BASE_URL:-http://127.0.0.1:3000}"
REQUESTS="${PERF_SMOKE_REQUESTS:-30}"
P95_THRESHOLD_MS="${PERF_P95_THRESHOLD_MS:-450}"

log() {
  printf '[perf-smoke] %s\n' "$*"
}

if ! [[ "$REQUESTS" =~ ^[0-9]+$ ]] || [ "$REQUESTS" -lt 5 ]; then
  log "invalid PERF_SMOKE_REQUESTS: $REQUESTS"
  exit 1
fi

tmp_file="$(mktemp)"
trap 'rm -f "$tmp_file"' EXIT

for _ in $(seq 1 "$REQUESTS"); do
  curl -sS -o /dev/null -w '%{time_total}\n' "$BASE_URL/api/blog/bootstrap" >> "$tmp_file"
done

metrics="$(node - "$tmp_file" <<'NODE'
const fs = require('fs')
const values = fs.readFileSync(process.argv[2], 'utf8')
  .split('\n')
  .map((v) => Number(v.trim()))
  .filter((v) => Number.isFinite(v) && v > 0)
if (values.length === 0) {
  console.log(JSON.stringify({ ok: false, reason: 'no_samples' }))
  process.exit(0)
}
values.sort((a, b) => a - b)
const idx = Math.min(values.length - 1, Math.ceil(values.length * 0.95) - 1)
const p95 = values[idx] * 1000
const avg = values.reduce((s, v) => s + v, 0) / values.length * 1000
console.log(JSON.stringify({ ok: true, p95, avg, count: values.length }))
NODE
)"

ok="$(node -e "const m=JSON.parse(process.argv[1]);process.stdout.write(String(Boolean(m.ok)));" "$metrics")"

if [[ "$ok" != "true" ]]; then
  log "unable to compute metrics: $metrics"
  exit 1
fi

p95_ms="$(node -e "const m=JSON.parse(process.argv[1]);process.stdout.write(String(Math.round(m.p95)));" "$metrics")"
avg_ms="$(node -e "const m=JSON.parse(process.argv[1]);process.stdout.write(String(Math.round(m.avg)));" "$metrics")"
count="$(node -e "const m=JSON.parse(process.argv[1]);process.stdout.write(String(m.count));" "$metrics")"

log "samples=$count avg_ms=$avg_ms p95_ms=$p95_ms threshold_ms=$P95_THRESHOLD_MS"

if [ "$p95_ms" -gt "$P95_THRESHOLD_MS" ]; then
  log "FAIL: p95 exceeds threshold"
  exit 1
fi

log "PERF_SMOKE=PASS"
