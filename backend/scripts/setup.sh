#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$BACKEND_DIR/.." && pwd)"

if [ ! -f "$BACKEND_DIR/.env" ]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  echo "created backend/.env"
fi

if [ ! -f "$BACKEND_DIR/yarn.lock" ]; then
  touch "$BACKEND_DIR/yarn.lock"
fi

start_infra() {
  if (
    cd "$ROOT_DIR"
    docker compose -f docker-compose.backend.yml up -d
  ); then
    return
  fi

  local mirror="${DOCKERHUB_MIRROR:-docker.m.daocloud.io}"
  mirror="${mirror%/}"
  (
    cd "$ROOT_DIR"
    POSTGRES_IMAGE="${POSTGRES_IMAGE:-$mirror/library/postgres:16-alpine}" \
    REDIS_IMAGE="${REDIS_IMAGE:-$mirror/library/redis:7-alpine}" \
    MINIO_IMAGE="${MINIO_IMAGE:-$mirror/minio/minio:latest}" \
    MINIO_MC_IMAGE="${MINIO_MC_IMAGE:-$mirror/minio/mc:latest}" \
      docker compose -f docker-compose.backend.yml up -d
  )
}

(
  cd "$BACKEND_DIR"
  yarn
)

start_infra

if [ -f "$BACKEND_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$BACKEND_DIR/.env"
  set +a
fi

bash "$ROOT_DIR/scripts/minio-lifecycle-policy.sh" --apply

echo "backend bootstrap completed"
