#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
RELEASE_NOTE="${2:-}"
ROLLBACK_TARGET="${3:-latest}"
ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"

if [[ "$ROOT_DIR" == "-h" || "$ROOT_DIR" == "--help" ]] || [[ "$RELEASE_NOTE" == "-h" || "$RELEASE_NOTE" == "--help" ]]; then
  cat <<'EOF'
Usage:
  scripts/publish-preflight-check.sh [root_dir] "<release-note>" [rollback-target]

Examples:
  scripts/publish-preflight-check.sh . "v1.2 发布：修复登录并升级媒体链路" latest
  scripts/publish-preflight-check.sh . "v1.2 hotfix" pub-m8qj8v1
EOF
  exit 0
fi

trimmed_note="$(echo "$RELEASE_NOTE" | sed -E 's/^\s+|\s+$//g')"
if [ -z "$trimmed_note" ] || [ "${#trimmed_note}" -lt 8 ]; then
  echo "ERROR: release note must be at least 8 characters" >&2
  exit 1
fi

STATUS=0

run_stage() {
  local label="$1"
  shift

  echo
  echo "==> $label"
  if "$@"; then
    echo "PASS: $label"
  else
    local code=$?
    STATUS=1
    echo "FAIL: $label (exit=$code)"
  fi
}

echo "Release note: $trimmed_note"
echo "Rollback target: $ROLLBACK_TARGET"

run_stage "quality gate" bash -lc "cd '$ROOT_DIR' && BACKEND_GATE_PORT=\${BACKEND_GATE_PORT:-3300} FRONTEND_PREVIEW_PORT=\${FRONTEND_PREVIEW_PORT:-4273} yarn quality-gate"
run_stage "runtime consistency" bash -lc "cd '$ROOT_DIR/backend' && yarn runtime:consistency"
run_stage "media cleanup dry-run" bash -lc "cd '$ROOT_DIR/backend' && yarn media:gc --dry-run"
run_stage "rollback target validation" bash -lc "cd '$ROOT_DIR/backend' && yarn rollback:target \"$ROLLBACK_TARGET\""

echo
if [ "$STATUS" -eq 0 ]; then
  echo "PUBLISH_PREFLIGHT=PASS"
else
  echo "PUBLISH_PREFLIGHT=FAIL"
fi

exit "$STATUS"
