#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
USE_SETSID=0

if command -v setsid >/dev/null 2>&1; then
  USE_SETSID=1
fi

log() {
  printf '[start] %s\n' "$*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "Missing required command: $1"
    exit 1
  fi
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

  return 1
}

print_port_usage() {
  local port="$1"

  if command -v lsof >/dev/null 2>&1; then
    lsof -i TCP:"$port" -sTCP:LISTEN -n -P | while IFS= read -r line; do
      log "$line"
    done
    return
  fi

  if command -v ss >/dev/null 2>&1; then
    ss -ltnp "( sport = :$port )" 2>/dev/null | while IFS= read -r line; do
      log "$line"
    done
  fi
}

assert_port_available() {
  local port="$1"
  local service="$2"

  if port_in_use "$port"; then
    log "Port $port is already in use ($service). Stop the existing process and retry."
    print_port_usage "$port"
    exit 1
  fi
}

check_runtime_ports() {
  if ! command -v lsof >/dev/null 2>&1 && ! command -v ss >/dev/null 2>&1; then
    log "Skipping port conflict checks because neither lsof nor ss is available"
    return
  fi

  assert_port_available 3000 "backend dev server"
  assert_port_available 5173 "frontend dev server"
}

stop_process() {
  local pid="$1"

  if [ -z "${pid:-}" ]; then
    return 0
  fi

  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  if [ "$USE_SETSID" -eq 1 ]; then
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

copy_env_if_missing() {
  local example_path="$1"
  local env_path="$2"

  if [ ! -f "$env_path" ] && [ -f "$example_path" ]; then
    cp "$example_path" "$env_path"
    log "Created ${env_path#$ROOT_DIR/} from template"
  fi
}

install_deps_if_needed() {
  local dir="$1"
  local label="$2"

  if [ ! -d "$dir/node_modules" ]; then
    log "Installing dependencies for $label"
    (
      cd "$dir"
      yarn
    )
  else
    log "Dependencies for $label already exist, skipping install"
  fi
}

start_infra() {
  log "Starting infrastructure containers"

  if (
    cd "$ROOT_DIR"
    docker compose -f docker-compose.backend.yml up -d
  ); then
    return
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
      docker compose -f docker-compose.backend.yml up -d
  )
}

wait_for_container_ready() {
  local container_name="$1"
  local timeout_seconds="$2"
  local accepted_statuses="$3"
  local elapsed=0
  local status=""

  while [ "$elapsed" -lt "$timeout_seconds" ]; do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_name" 2>/dev/null || true)"

    case " $accepted_statuses " in
      *" $status "*) return 0 ;;
    esac

    sleep 2
    elapsed=$((elapsed + 2))
  done

  log "Timeout waiting for ${container_name} (last status: ${status:-unknown})"
  return 1
}

wait_for_infra() {
  log "Waiting for infrastructure readiness"
  wait_for_container_ready "blog-postgres" 90 "healthy"
  wait_for_container_ready "blog-redis" 60 "healthy"
  wait_for_container_ready "blog-minio" 60 "running healthy"
}

cleanup() {
  local exit_code=$?

  trap - EXIT INT TERM
  log "Stopping running services"

  stop_process "${BACKEND_PID:-}"
  stop_process "${FRONTEND_PID:-}"

  wait >/dev/null 2>&1 || true
  exit "$exit_code"
}

main() {
  require_cmd yarn
  require_cmd docker

  copy_env_if_missing "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  copy_env_if_missing "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  check_runtime_ports

  install_deps_if_needed "$ROOT_DIR" "frontend"
  install_deps_if_needed "$BACKEND_DIR" "backend"
  start_infra
  wait_for_infra

  if [ -f "$BACKEND_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$BACKEND_DIR/.env"
    set +a
  fi

  log "Applying MinIO lifecycle policy"
  bash "$ROOT_DIR/scripts/minio-lifecycle-policy.sh" --apply

  log "Starting backend dev server"
  if [ "$USE_SETSID" -eq 1 ]; then
    setsid bash -lc "cd '$BACKEND_DIR' && exec yarn dev" &
  else
    bash -lc "cd '$BACKEND_DIR' && exec yarn dev" &
  fi
  BACKEND_PID="$!"

  log "Starting frontend dev server"
  if [ "$USE_SETSID" -eq 1 ]; then
    setsid bash -lc "cd '$ROOT_DIR' && exec yarn dev" &
  else
    bash -lc "cd '$ROOT_DIR' && exec yarn dev" &
  fi
  FRONTEND_PID="$!"

  log "Frontend: http://localhost:5173"
  log "Backend: http://localhost:3000"
  log "Press Ctrl+C to stop everything"

  trap cleanup EXIT INT TERM

  wait -n "$BACKEND_PID" "$FRONTEND_PID"
}

main "$@"
