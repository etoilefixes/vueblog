#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
COMPOSE_FILE="$ROOT_DIR/docker-compose.backend.yml"
BACKEND_GATE_PORT="${BACKEND_GATE_PORT:-3000}"
FRONTEND_PREVIEW_PORT="${FRONTEND_PREVIEW_PORT:-4173}"
BACKEND_GATE_BASE_URL="http://127.0.0.1:${BACKEND_GATE_PORT}"
FRONTEND_PREVIEW_BASE_URL="http://127.0.0.1:${FRONTEND_PREVIEW_PORT}"

STATUS=0
BACKEND_PID=""
PREVIEW_PID=""
USE_SETSID=0

if command -v setsid >/dev/null 2>&1; then
  USE_SETSID=1
fi

log() {
  printf '[gate] %s\n' "$*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "Missing required command: $1"
    return 1
  fi
}

run_stage() {
  local label="$1"
  local fn="$2"
  local rerun="$3"

  echo
  echo "==> $label"

  if "$fn"; then
    echo "PASS: $label"
  else
    local code=$?
    STATUS=1
    echo "FAIL: $label"
    echo "  command: $rerun"
    echo "  exit: $code"
    echo "  rerun: $rerun"
  fi
}

run_stage_fatal() {
  local label="$1"
  local fn="$2"
  local rerun="$3"

  echo
  echo "==> $label"

  if "$fn"; then
    echo "PASS: $label"
  else
    local code=$?
    echo "FAIL: $label"
    echo "  command: $rerun"
    echo "  exit: $code"
    echo "  rerun: $rerun"
    exit 1
  fi
}

cleanup() {
  stop_process "$BACKEND_PID"
  stop_process "$PREVIEW_PID"

  wait >/dev/null 2>&1 || true
}

trap cleanup EXIT

stop_process() {
  local pid="$1"

  if [ -z "$pid" ]; then
    return 0
  fi

  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  if [ "$USE_SETSID" -eq 1 ]; then
    # If started with setsid, pid is also the process group leader.
    kill -- -"$pid" 2>/dev/null || true
  fi

  kill "$pid" 2>/dev/null || true

  for _ in $(seq 1 25); do
    if ! kill -0 "$pid" 2>/dev/null; then
      wait "$pid" 2>/dev/null || true
      return 0
    fi
    sleep 0.1
  done

  if [ "$USE_SETSID" -eq 1 ]; then
    kill -9 -- -"$pid" 2>/dev/null || true
  fi
  kill -9 "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
}

port_in_use() {
  local port="$1"

  if command -v lsof >/dev/null 2>&1; then
    lsof -i TCP:"$port" -sTCP:LISTEN -n -P >/dev/null 2>&1
    return
  fi

  if command -v ss >/dev/null 2>&1; then
    ss -ltn "( sport = :$port )" 2>/dev/null | awk 'NR > 1 { found = 1 } END { exit(found ? 0 : 1) }'
    return
  fi

  return 2
}

print_port_usage() {
  local port="$1"

  if command -v lsof >/dev/null 2>&1; then
    lsof -i TCP:"$port" -sTCP:LISTEN -n -P || true
    return
  fi

  if command -v ss >/dev/null 2>&1; then
    ss -ltnp "( sport = :$port )" 2>/dev/null || true
  fi
}

ensure_port_free() {
  local port="$1"
  local label="$2"

  if port_in_use "$port"; then
    log "Port $port is occupied ($label)"
    print_port_usage "$port"
    return 1
  fi
}

container_running() {
  local container_name="$1"
  docker inspect --format '{{.State.Running}}' "$container_name" 2>/dev/null | grep -q '^true$'
}

ensure_infra_port_compatible() {
  local port="$1"
  local expected_container="$2"

  if ! port_in_use "$port"; then
    return 0
  fi

  if container_running "$expected_container"; then
    return 0
  fi

  log "Port $port is occupied and expected container '$expected_container' is not running"
  print_port_usage "$port"
  return 1
}

wait_for_http() {
  local url="$1"
  local expected_code="$2"
  local timeout_seconds="$3"
  local elapsed=0
  local code=""
  local body=""

  while [ "$elapsed" -lt "$timeout_seconds" ]; do
    code="$(curl -s -o /tmp/blog-gate-http.json -w '%{http_code}' "$url" || true)"
    if [ "$code" = "$expected_code" ]; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  body="$(tr -d '\n' < /tmp/blog-gate-http.json 2>/dev/null || true)"
  log "Expected $url -> $expected_code, got ${code:-unknown}"
  if [ -n "$body" ]; then
    log "Response: ${body:0:220}"
  fi
  return 1
}

stage_preflight() {
  local failed=0

  require_cmd yarn || failed=1
  require_cmd docker || failed=1
  require_cmd curl || failed=1

  if ! command -v lsof >/dev/null 2>&1 && ! command -v ss >/dev/null 2>&1; then
    log "Need either lsof or ss for port checks"
    failed=1
  fi

  [ -f "$ROOT_DIR/package.json" ] || failed=1
  [ -f "$BACKEND_DIR/package.json" ] || failed=1
  [ -f "$COMPOSE_FILE" ] || failed=1
  [ -f "$ROOT_DIR/.env" ] || failed=1
  [ -f "$BACKEND_DIR/.env" ] || failed=1

  ensure_port_free "$BACKEND_GATE_PORT" "backend runtime" || failed=1
  ensure_port_free "$FRONTEND_PREVIEW_PORT" "frontend preview runtime" || failed=1

  ensure_infra_port_compatible 5432 "blog-postgres" || failed=1
  ensure_infra_port_compatible 6379 "blog-redis" || failed=1
  ensure_infra_port_compatible 9000 "blog-minio" || failed=1
  ensure_infra_port_compatible 9001 "blog-minio" || failed=1

  return "$failed"
}

stage_install_dependencies() {
  local failed=0

  (
    set -euo pipefail
    cd "$ROOT_DIR"
    yarn
  ) || failed=1

  (
    set -euo pipefail
    cd "$BACKEND_DIR"
    yarn
  ) || failed=1

  return "$failed"
}

stage_frontend_checks() {
  (
    set -euo pipefail
    cd "$ROOT_DIR"
    yarn type-check
    yarn build
  )
}

stage_backend_checks() {
  (
    set -euo pipefail
    cd "$BACKEND_DIR"
    yarn type-check
    yarn build
  )
}

stage_start_infra() {
  if (
    cd "$ROOT_DIR"
    docker compose -f "$COMPOSE_FILE" up -d
  ); then
    return 0
  fi

  local mirror="${DOCKERHUB_MIRROR:-docker.m.daocloud.io}"
  mirror="${mirror%/}"
  log "Docker Hub pull failed, retrying with mirror: $mirror"
  (
    cd "$ROOT_DIR"
    POSTGRES_IMAGE="${POSTGRES_IMAGE:-$mirror/library/postgres:16-alpine}" \
    REDIS_IMAGE="${REDIS_IMAGE:-$mirror/library/redis:7-alpine}" \
    MINIO_IMAGE="${MINIO_IMAGE:-$mirror/minio/minio:latest}" \
    MINIO_MC_IMAGE="${MINIO_MC_IMAGE:-$mirror/minio/mc:latest}" \
      docker compose -f "$COMPOSE_FILE" up -d
  )
}

stage_minio_lifecycle_policy() {
  local script="$ROOT_DIR/scripts/minio-lifecycle-policy.sh"

  if [ ! -x "$script" ]; then
    log "Skipping MinIO lifecycle policy stage (script not executable)"
    return 0
  fi

  (
    cd "$ROOT_DIR"
    if [ -f "$BACKEND_DIR/.env" ]; then
      set -a
      # shellcheck disable=SC1090
      . "$BACKEND_DIR/.env"
      set +a
    fi

    MINIO_ENDPOINT="127.0.0.1" \
    MINIO_PORT="9000" \
    MINIO_USE_SSL="false" \
      bash "$script" --apply
  )
}

stage_backend_smoke() {
  local failed=0

  if [ "$USE_SETSID" -eq 1 ]; then
    setsid bash -lc "cd '$BACKEND_DIR' && exec env PORT=$BACKEND_GATE_PORT yarn dev" > /tmp/blog-gate-backend.log 2>&1 &
  else
    bash -lc "cd '$BACKEND_DIR' && exec env PORT=$BACKEND_GATE_PORT yarn dev" > /tmp/blog-gate-backend.log 2>&1 &
  fi
  BACKEND_PID="$!"

  wait_for_http "$BACKEND_GATE_BASE_URL/health/live" "200" 60 || failed=1
  wait_for_http "$BACKEND_GATE_BASE_URL/health/ready" "200" 60 || failed=1
  wait_for_http "$BACKEND_GATE_BASE_URL/api/blog/bootstrap" "200" 30 || failed=1

  stop_process "$BACKEND_PID"
  BACKEND_PID=""

  return "$failed"
}

stage_backend_security_regression() {
  local failed=0
  local script="$ROOT_DIR/scripts/security-regression.sh"

  if [ ! -x "$script" ] && [ ! -f "$script" ]; then
    log "Skipping backend security regression (script not found)"
    return 0
  fi

  if [ "$USE_SETSID" -eq 1 ]; then
    setsid bash -lc "cd '$BACKEND_DIR' && exec env PORT=$BACKEND_GATE_PORT yarn dev" > /tmp/blog-gate-backend-security.log 2>&1 &
  else
    bash -lc "cd '$BACKEND_DIR' && exec env PORT=$BACKEND_GATE_PORT yarn dev" > /tmp/blog-gate-backend-security.log 2>&1 &
  fi
  BACKEND_PID="$!"

  wait_for_http "$BACKEND_GATE_BASE_URL/health/live" "200" 60 || failed=1

  if [ "$failed" -eq 0 ]; then
    BACKEND_BASE_URL="$BACKEND_GATE_BASE_URL" bash "$script" "$ROOT_DIR" || failed=1
  fi

  stop_process "$BACKEND_PID"
  BACKEND_PID=""

  return "$failed"
}

stage_backend_perf_smoke() {
  local failed=0
  local script="$ROOT_DIR/scripts/perf-smoke.sh"

  if [ ! -x "$script" ] && [ ! -f "$script" ]; then
    log "Skipping backend perf smoke (script not found)"
    return 0
  fi

  if [ "$USE_SETSID" -eq 1 ]; then
    setsid bash -lc "cd '$BACKEND_DIR' && exec env PORT=$BACKEND_GATE_PORT yarn dev" > /tmp/blog-gate-backend-perf.log 2>&1 &
  else
    bash -lc "cd '$BACKEND_DIR' && exec env PORT=$BACKEND_GATE_PORT yarn dev" > /tmp/blog-gate-backend-perf.log 2>&1 &
  fi
  BACKEND_PID="$!"

  wait_for_http "$BACKEND_GATE_BASE_URL/health/live" "200" 60 || failed=1

  if [ "$failed" -eq 0 ]; then
    BACKEND_BASE_URL="$BACKEND_GATE_BASE_URL" bash "$script" "$ROOT_DIR" || failed=1
  fi

  stop_process "$BACKEND_PID"
  BACKEND_PID=""

  return "$failed"
}

stage_frontend_preview_smoke() {
  local failed=0

  if [ "$USE_SETSID" -eq 1 ]; then
    setsid bash -lc "cd '$ROOT_DIR' && exec yarn preview --host 127.0.0.1 --port $FRONTEND_PREVIEW_PORT" > /tmp/blog-gate-preview.log 2>&1 &
  else
    bash -lc "cd '$ROOT_DIR' && exec yarn preview --host 127.0.0.1 --port $FRONTEND_PREVIEW_PORT" > /tmp/blog-gate-preview.log 2>&1 &
  fi
  PREVIEW_PID="$!"

  wait_for_http "$FRONTEND_PREVIEW_BASE_URL/" "200" 60 || failed=1
  wait_for_http "$FRONTEND_PREVIEW_BASE_URL/posts/css-system-design" "200" 30 || failed=1
  wait_for_http "$FRONTEND_PREVIEW_BASE_URL/links" "200" 30 || failed=1
  wait_for_http "$FRONTEND_PREVIEW_BASE_URL/timeline" "200" 30 || failed=1
  wait_for_http "$FRONTEND_PREVIEW_BASE_URL/about" "200" 30 || failed=1
  wait_for_http "$FRONTEND_PREVIEW_BASE_URL/admin/login" "200" 30 || failed=1
  wait_for_http "$FRONTEND_PREVIEW_BASE_URL/admin" "200" 30 || failed=1

  stop_process "$PREVIEW_PID"
  PREVIEW_PID=""

  return "$failed"
}

stage_postflight_ports() {
  local failed=0

  ensure_port_free "$BACKEND_GATE_PORT" "backend runtime (postflight)" || failed=1
  ensure_port_free "$FRONTEND_PREVIEW_PORT" "frontend preview runtime (postflight)" || failed=1

  return "$failed"
}

stage_contract_drift() {
  local script="$ROOT_DIR/skills/api-contract-sync/scripts/contract-drift-check.sh"
  if [ ! -x "$script" ]; then
    log "Skipping API contract drift check (script not found)"
    return 0
  fi

  (
    cd "$ROOT_DIR"
    "$script" docs/backend-api-contract.md
  )
}

stage_security_baseline() {
  local script="$ROOT_DIR/skills/backend-security-hardening/scripts/security-baseline-check.sh"
  if [ ! -x "$script" ]; then
    log "Skipping security baseline check (script not found)"
    return 0
  fi

  (
    cd "$ROOT_DIR"
    "$script"
  )
}

stage_runtime_consistency() {
  (
    cd "$BACKEND_DIR"
    yarn runtime:consistency
  )
}

run_stage_fatal "preflight (tools/env/ports)" stage_preflight "./scripts/run-quality-gate.sh"
run_stage "install dependencies" stage_install_dependencies "yarn && (cd backend && yarn)"
run_stage "frontend checks (type-check/build)" stage_frontend_checks "yarn type-check && yarn build"
run_stage "backend checks (type-check/build)" stage_backend_checks "cd backend && yarn type-check && yarn build"
run_stage "start infrastructure" stage_start_infra "docker compose -f docker-compose.backend.yml up -d"
run_stage "minio lifecycle policy" stage_minio_lifecycle_policy "bash scripts/minio-lifecycle-policy.sh --apply"
run_stage "backend smoke checks" stage_backend_smoke "cd backend && yarn dev"
run_stage "backend security regression" stage_backend_security_regression "bash scripts/security-regression.sh"
run_stage "backend perf smoke" stage_backend_perf_smoke "bash scripts/perf-smoke.sh"
run_stage "frontend preview smoke checks" stage_frontend_preview_smoke "yarn preview --host 127.0.0.1 --port 4173"
run_stage "postflight (ports)" stage_postflight_ports "./scripts/run-quality-gate.sh"
run_stage "api contract drift" stage_contract_drift "skills/api-contract-sync/scripts/contract-drift-check.sh docs/backend-api-contract.md"
run_stage "security baseline" stage_security_baseline "skills/backend-security-hardening/scripts/security-baseline-check.sh"
run_stage "runtime consistency" stage_runtime_consistency "cd backend && yarn runtime:consistency"

echo
if [ "$STATUS" -eq 0 ]; then
  echo "QUALITY_GATE=PASS"
else
  echo "QUALITY_GATE=FAIL"
  echo "Rerun with: ./scripts/run-quality-gate.sh"
fi

exit "$STATUS"
