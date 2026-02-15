#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/minio-lifecycle-policy.sh [--apply|--verify]

Env overrides:
  MINIO_MC_IMAGE         (default: minio/mc:latest)
  MINIO_ENDPOINT         (default: 127.0.0.1)
  MINIO_PORT             (default: 9000)
  MINIO_USE_SSL          (default: false)
  MINIO_ACCESS_KEY       (default: minioadmin)
  MINIO_SECRET_KEY       (default: minioadmin)
  MINIO_BUCKET_PUBLIC    (default: blog-public)
  MINIO_TMP_PREFIX       (default: admin/tmp/)
  MINIO_TMP_EXPIRE_DAYS  (default: 3)
  MINIO_TMP_RULE_ID      (default: blog-admin-tmp-expire-v1)
EOF
}

MODE="apply"
case "${1:---apply}" in
  --apply)
    MODE="apply"
    ;;
  --verify)
    MODE="verify"
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    echo "[minio-lifecycle] unknown option: $1" >&2
    usage >&2
    exit 1
    ;;
esac

MINIO_MC_IMAGE="${MINIO_MC_IMAGE:-minio/mc:latest}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-127.0.0.1}"
MINIO_PORT="${MINIO_PORT:-9000}"
MINIO_USE_SSL="${MINIO_USE_SSL:-false}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-minioadmin}"
MINIO_BUCKET_PUBLIC="${MINIO_BUCKET_PUBLIC:-blog-public}"
MINIO_TMP_PREFIX="${MINIO_TMP_PREFIX:-admin/tmp/}"
MINIO_TMP_EXPIRE_DAYS="${MINIO_TMP_EXPIRE_DAYS:-3}"
MINIO_TMP_RULE_ID="${MINIO_TMP_RULE_ID:-blog-admin-tmp-expire-v1}"

if ! [[ "$MINIO_TMP_EXPIRE_DAYS" =~ ^[0-9]+$ ]] || [ "$MINIO_TMP_EXPIRE_DAYS" -le 0 ]; then
  echo "[minio-lifecycle] MINIO_TMP_EXPIRE_DAYS must be a positive integer" >&2
  exit 1
fi

if [ -z "$MINIO_TMP_PREFIX" ]; then
  echo "[minio-lifecycle] MINIO_TMP_PREFIX cannot be empty" >&2
  exit 1
fi

case "$(echo "$MINIO_USE_SSL" | tr '[:upper:]' '[:lower:]')" in
  true|1|yes|on)
    MINIO_SCHEME="https"
    ;;
  *)
    MINIO_SCHEME="http"
    ;;
esac

if [[ "$MINIO_ENDPOINT" =~ ^https?:// ]]; then
  MINIO_ORIGIN="${MINIO_ENDPOINT%/}"
else
  MINIO_ORIGIN="${MINIO_SCHEME}://${MINIO_ENDPOINT}"
fi

if [[ "$MINIO_ORIGIN" =~ ^https?://[^/]+$ ]]; then
  MINIO_ORIGIN="${MINIO_ORIGIN}:${MINIO_PORT}"
fi

TARGET="local/${MINIO_BUCKET_PUBLIC}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[minio-lifecycle] missing command: $1" >&2
    exit 1
  fi
}

require_cmd docker
require_cmd node

run_mc() {
  local command="$1"

  docker run --rm --network host --entrypoint /bin/sh "$MINIO_MC_IMAGE" -lc "
    set -euo pipefail
    mc alias set local \"$MINIO_ORIGIN\" \"$MINIO_ACCESS_KEY\" \"$MINIO_SECRET_KEY\" >/dev/null
    $command
  "
}

read_lifecycle_rules() {
  local error_file
  error_file="$(mktemp)"
  local output=""

  if output="$(run_mc "mc ilm rule export \"$TARGET\"" 2>"$error_file")"; then
    rm -f "$error_file"
    echo "$output"
    return 0
  fi

  if grep -qi 'lifecycle configuration does not exist' "$error_file"; then
    rm -f "$error_file"
    echo '{"Rules":[]}'
    return 0
  fi

  cat "$error_file" >&2
  rm -f "$error_file"
  return 1
}

merge_managed_rule() {
  local raw_json="$1"

  node - "$raw_json" "$MINIO_TMP_RULE_ID" "$MINIO_TMP_PREFIX" "$MINIO_TMP_EXPIRE_DAYS" <<'NODE'
const [rawJson, ruleId, prefix, expireDaysRaw] = process.argv.slice(2)
const expireDays = Number(expireDaysRaw)

let parsed = { Rules: [] }
if (rawJson && rawJson.trim()) {
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    parsed = { Rules: [] }
  }
}

const existingRules = Array.isArray(parsed.Rules) ? parsed.Rules : []
const filteredRules = existingRules.filter((rule) => {
  if (!rule || typeof rule !== 'object') {
    return false
  }

  const id = typeof rule.ID === 'string' ? rule.ID : ''
  const currentPrefix =
    rule.Filter && typeof rule.Filter === 'object' && typeof rule.Filter.Prefix === 'string'
      ? rule.Filter.Prefix
      : ''

  return id !== ruleId && currentPrefix !== prefix
})

filteredRules.push({
  ID: ruleId,
  Status: 'Enabled',
  Filter: {
    Prefix: prefix,
  },
  Expiration: {
    Days: expireDays,
  },
})

process.stdout.write(JSON.stringify({ Rules: filteredRules }))
NODE
}

verify_managed_rule() {
  local raw_json="$1"

  node - "$raw_json" "$MINIO_TMP_RULE_ID" "$MINIO_TMP_PREFIX" "$MINIO_TMP_EXPIRE_DAYS" <<'NODE'
const [rawJson, ruleId, prefix, expireDaysRaw] = process.argv.slice(2)
const expireDays = Number(expireDaysRaw)

let parsed = { Rules: [] }
if (rawJson && rawJson.trim()) {
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    parsed = { Rules: [] }
  }
}

const rules = Array.isArray(parsed.Rules) ? parsed.Rules : []
const matched = rules.some((rule) => {
  if (!rule || typeof rule !== 'object') {
    return false
  }

  const id = typeof rule.ID === 'string' ? rule.ID : ''
  const currentPrefix =
    rule.Filter && typeof rule.Filter === 'object' && typeof rule.Filter.Prefix === 'string'
      ? rule.Filter.Prefix
      : ''
  const days =
    rule.Expiration && typeof rule.Expiration === 'object' && Number.isFinite(Number(rule.Expiration.Days))
      ? Number(rule.Expiration.Days)
      : NaN

  return id === ruleId && currentPrefix === prefix && days === expireDays
})

if (!matched) {
  process.exit(1)
}
NODE
}

apply_rules() {
  local current_rules
  current_rules="$(read_lifecycle_rules)"
  local merged_rules
  merged_rules="$(merge_managed_rule "$current_rules")"

  local rules_file
  rules_file="$(mktemp)"
  printf '%s' "$merged_rules" > "$rules_file"

  cat "$rules_file" | docker run --rm --network host -i \
    --entrypoint /bin/sh "$MINIO_MC_IMAGE" -lc "
      set -euo pipefail
      mc alias set local \"$MINIO_ORIGIN\" \"$MINIO_ACCESS_KEY\" \"$MINIO_SECRET_KEY\" >/dev/null
      mc mb --ignore-existing \"$TARGET\" >/dev/null
      mc ilm rule import \"$TARGET\"
    "

  rm -f "$rules_file"
}

if [ "$MODE" = "apply" ]; then
  apply_rules
fi

latest_rules="$(read_lifecycle_rules)"

if verify_managed_rule "$latest_rules"; then
  echo "MINIO_LIFECYCLE_POLICY=PASS mode=$MODE bucket=$MINIO_BUCKET_PUBLIC prefix=$MINIO_TMP_PREFIX expire_days=$MINIO_TMP_EXPIRE_DAYS"
else
  echo "MINIO_LIFECYCLE_POLICY=FAIL mode=$MODE bucket=$MINIO_BUCKET_PUBLIC prefix=$MINIO_TMP_PREFIX expire_days=$MINIO_TMP_EXPIRE_DAYS" >&2
  exit 1
fi
