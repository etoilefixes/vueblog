#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.}"

if [[ ! -d "$ROOT_DIR" ]]; then
  echo "ERROR: root directory not found: $ROOT_DIR" >&2
  exit 1
fi

if ! command -v yarn >/dev/null 2>&1; then
  echo "ERROR: yarn is required for this gate" >&2
  exit 1
fi

status=0

run_stage() {
  local label="$1"
  shift

  echo
  echo "==> $label"
  if "$@"; then
    echo "PASS: $label"
  else
    local code=$?
    status=1
    echo "FAIL: $label (exit=$code)"
  fi
}

if [[ -f "$ROOT_DIR/package.json" ]]; then
  run_stage "frontend type-check" bash -lc "cd '$ROOT_DIR' && yarn type-check"
  run_stage "frontend build" bash -lc "cd '$ROOT_DIR' && yarn build"
fi

if [[ -f "$ROOT_DIR/backend/package.json" ]]; then
  run_stage "backend type-check" bash -lc "cd '$ROOT_DIR/backend' && yarn type-check"
  run_stage "backend build" bash -lc "cd '$ROOT_DIR/backend' && yarn build"
fi

if [[ -x "$ROOT_DIR/skills/api-contract-sync/scripts/contract-drift-check.sh" ]]; then
  run_stage "api contract drift" bash -lc "cd '$ROOT_DIR' && skills/api-contract-sync/scripts/contract-drift-check.sh docs/backend-api-contract.md"
fi

if [[ -x "$ROOT_DIR/skills/backend-security-hardening/scripts/security-baseline-check.sh" ]]; then
  run_stage "security baseline" bash -lc "cd '$ROOT_DIR' && skills/backend-security-hardening/scripts/security-baseline-check.sh"
fi

echo
if (( status == 0 )); then
  echo "QUALITY_GATE=PASS"
else
  echo "QUALITY_GATE=FAIL"
  echo "Run failing stages locally and rerun this script."
fi

exit "$status"
