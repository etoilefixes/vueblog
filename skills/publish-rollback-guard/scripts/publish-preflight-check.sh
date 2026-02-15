#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.}"
RELEASE_NOTE="${2:-}"

if [[ "$ROOT_DIR" == "-h" || "$ROOT_DIR" == "--help" ]]; then
  echo "Usage: $0 [root_dir] \"<release-note>\""
  exit 0
fi

if [[ -z "$RELEASE_NOTE" ]]; then
  echo "ERROR: release note is required" >&2
  echo "Usage: $0 [root_dir] \"<release-note>\"" >&2
  exit 1
fi

trimmed_note="$(echo "$RELEASE_NOTE" | sed -E 's/^\s+|\s+$//g')"
if (( ${#trimmed_note} < 8 )); then
  echo "ERROR: release note must be at least 8 characters" >&2
  exit 1
fi

if [[ ! -d "$ROOT_DIR" ]]; then
  echo "ERROR: root directory not found: $ROOT_DIR" >&2
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

echo "Release note: $trimmed_note"

if [[ -x "$ROOT_DIR/skills/ci-quality-gate/scripts/run-quality-gate.sh" ]]; then
  run_stage "quality gate" bash -lc "cd '$ROOT_DIR' && skills/ci-quality-gate/scripts/run-quality-gate.sh ."
else
  echo "WARN: quality gate script not found, skipping"
fi

if rg -q '/admin/publish/rollback|rollback' "$ROOT_DIR/docs/backend-api-contract.md" "$ROOT_DIR/docs/backend-fastify-drizzle-plan.md" 2>/dev/null; then
  echo "PASS: rollback contract signal detected"
else
  status=1
  echo "FAIL: rollback contract signal missing"
fi

if [[ -f "$ROOT_DIR/backend/.env" ]]; then
  echo "PASS: backend/.env exists"
else
  echo "WARN: backend/.env missing"
fi

echo
if (( status == 0 )); then
  echo "PUBLISH_PREFLIGHT=PASS"
else
  echo "PUBLISH_PREFLIGHT=FAIL"
fi

exit "$status"
