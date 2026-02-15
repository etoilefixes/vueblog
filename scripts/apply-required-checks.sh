#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/apply-required-checks.sh [--apply] [owner/repo] [branch]

Defaults:
  mode    : dry-run
  repo    : inferred from git remote origin
  branch  : repository default branch

Env:
  REQUIRED_CHECK_CONTEXTS  comma-separated contexts (default: Quality Gate / gate)

Examples:
  scripts/apply-required-checks.sh
  scripts/apply-required-checks.sh --apply owner/repo main
  REQUIRED_CHECK_CONTEXTS="Quality Gate / gate,CodeQL" scripts/apply-required-checks.sh --apply
EOF
}

MODE="dry-run"
if [[ "${1:-}" == "--apply" ]]; then
  MODE="apply"
  shift
fi

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[required-checks] missing command: $1" >&2
    exit 1
  fi
}

require_cmd gh

repo_input="${1:-}"
branch_input="${2:-}"

infer_repo_from_remote() {
  local remote_url
  remote_url="$(git config --get remote.origin.url 2>/dev/null || true)"
  if [ -z "$remote_url" ]; then
    return 1
  fi

  if [[ "$remote_url" =~ github.com[:/]([^/]+/[^/.]+)(\.git)?$ ]]; then
    echo "${BASH_REMATCH[1]}"
    return 0
  fi

  return 1
}

repo="${repo_input:-}"
if [ -z "$repo" ]; then
  repo="$(infer_repo_from_remote || true)"
fi

if [ -z "$repo" ]; then
  echo "[required-checks] cannot infer repository, provide owner/repo explicitly" >&2
  exit 1
fi

branch="${branch_input:-}"
if [ -z "$branch" ]; then
  branch="$(gh api "repos/$repo" --jq .default_branch)"
fi

contexts_raw="${REQUIRED_CHECK_CONTEXTS:-Quality Gate / gate}"

payload_file="$(mktemp)"
node - "$contexts_raw" >"$payload_file" <<'NODE'
const rawContexts = process.argv[2] ?? ''
const contexts = rawContexts
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

if (contexts.length === 0) {
  contexts.push('Quality Gate / gate')
}

const payload = {
  required_status_checks: {
    strict: true,
    contexts,
  },
  enforce_admins: true,
  required_pull_request_reviews: null,
  restrictions: null,
}

process.stdout.write(JSON.stringify(payload, null, 2))
NODE

echo "[required-checks] repo=$repo branch=$branch mode=$MODE"
echo "[required-checks] payload:"
cat "$payload_file"

if [ "$MODE" = "apply" ]; then
  gh api \
    --method PUT \
    -H "Accept: application/vnd.github+json" \
    "repos/$repo/branches/$branch/protection" \
    --input "$payload_file" >/dev/null
  echo "[required-checks] REQUIRED_CHECKS=APPLIED"
else
  echo "[required-checks] REQUIRED_CHECKS=DRY_RUN"
fi

rm -f "$payload_file"
