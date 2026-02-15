#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"
BACKEND_ENV_FILE="$ROOT_DIR/backend/.env"
BASE_URL="${BACKEND_BASE_URL:-http://127.0.0.1:3000}"

log() {
  printf '[security-regression] %s\n' "$*"
}

if [[ ! -f "$BACKEND_ENV_FILE" ]]; then
  log "missing backend env file: $BACKEND_ENV_FILE"
  exit 1
fi

get_env_value() {
  local key="$1"
  local value=""
  value="$(sed -nE "s/^${key}=//p" "$BACKEND_ENV_FILE" | tail -n 1 | tr -d '\r')"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "$value"
}

ADMIN_EMAIL="$(get_env_value ADMIN_BOOTSTRAP_EMAIL)"
ADMIN_PASSWORD="$(get_env_value ADMIN_BOOTSTRAP_PASSWORD)"

if [[ -z "$ADMIN_EMAIL" ]]; then
  ADMIN_EMAIL="admin@example.com"
fi

if [[ -z "$ADMIN_PASSWORD" ]]; then
  ADMIN_PASSWORD="change-me-please"
fi

assert_status() {
  local label="$1"
  local expected="$2"
  local actual="$3"

  if [[ "$actual" != "$expected" ]]; then
    log "FAIL: $label expected=$expected actual=$actual"
    return 1
  fi

  log "PASS: $label ($actual)"
}

request() {
  local method="$1"
  local url="$2"
  local output_file="$3"
  shift 3

  curl -sS -o "$output_file" -w '%{http_code}' -X "$method" "$url" "$@"
}

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

status_code="$(request GET "$BASE_URL/api/admin/media/list" "$tmp_dir/media-list.json")"
assert_status "unauthorized media list" "401" "$status_code"

status_code="$(request POST "$BASE_URL/api/admin/media/upload" "$tmp_dir/media-upload.json" \
  -H 'Content-Type: application/json' \
  -d '{"name":"x","url":"https://example.com/x.png","mimeType":"image/png","size":100}' )"
assert_status "unauthorized media upload" "401" "$status_code"

status_code="$(request POST "$BASE_URL/api/admin/auth/login" "$tmp_dir/login.json" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")"
assert_status "bootstrap admin login" "200" "$status_code"

ACCESS_TOKEN="$(node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(String(p?.data?.tokens?.accessToken||''));" "$tmp_dir/login.json")"

if [[ -z "$ACCESS_TOKEN" ]]; then
  log "FAIL: login response missing access token"
  exit 1
fi

status_code="$(request PATCH "$BASE_URL/api/admin/access/users" "$tmp_dir/lockout.json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"userId":"bootstrap-admin","roles":["viewer"],"permissions":["dashboard:read"],"disabled":true}')"
assert_status "last-admin lockout protection" "422" "$status_code"

status_code="$(request POST "$BASE_URL/api/admin/media/upload-local" "$tmp_dir/upload-local.json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"x"}')"
assert_status "local upload content-type guard" "415" "$status_code"

status_code="$(request POST "$BASE_URL/api/admin/media/multipart/init" "$tmp_dir/multipart-init-invalid.json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"x.bin","mimeType":"application/octet-stream","size":7340032,"partSize":1024}')"
assert_status "multipart minimum part size validation" "400" "$status_code"

log "SECURITY_REGRESSION=PASS"
