#!/usr/bin/env bash
set -euo pipefail

BACKEND_DIR="${1:-backend}"
SERVER_FILE="$BACKEND_DIR/src/server.ts"
BACKEND_PKG="$BACKEND_DIR/package.json"
ENV_FILE="$BACKEND_DIR/src/config/env.ts"

status=0
warn_count=0

pass() { echo "PASS: $1"; }
warn() { echo "WARN: $1"; warn_count=$((warn_count + 1)); }
fail() { echo "FAIL: $1"; status=1; }

search_q() {
  local pattern="$1"
  shift

  if command -v rg >/dev/null 2>&1; then
    rg -q -- "$pattern" "$@" 2>/dev/null
    return $?
  fi

  grep -R -E -q --binary-files=without-match -- "$pattern" "$@" 2>/dev/null
}

if [[ ! -f "$BACKEND_PKG" ]]; then
  fail "backend package.json not found: $BACKEND_PKG"
else
  if search_q '"@fastify/jwt"' "$BACKEND_PKG"; then
    pass "JWT dependency declared"
  else
    fail "JWT dependency missing"
  fi
fi

if [[ ! -f "$SERVER_FILE" ]]; then
  fail "server file not found: $SERVER_FILE"
else
  if search_q 'register\(jwt' "$SERVER_FILE"; then
    pass "JWT plugin registered"
  else
    fail "JWT plugin registration missing"
  fi

  if search_q '@fastify/rate-limit|rateLimit|register\(.*rate' "$SERVER_FILE" "$BACKEND_PKG"; then
    pass "rate limiting signal found"
  else
    warn "no explicit rate limiting detected"
  fi

  if search_q 'requestId' "$SERVER_FILE"; then
    pass "requestId support detected"
  else
    warn "requestId support not detected"
  fi
fi

if [[ -f "$ENV_FILE" ]]; then
  if search_q "CORS_ORIGIN" "$ENV_FILE"; then
    if search_q "default\('\*'\)|default\(\"\*\"\)" "$ENV_FILE"; then
      fail "CORS origin default is wildcard"
    else
      pass "CORS origin is not wildcard by default"
    fi
  else
    warn "CORS_ORIGIN env schema missing"
  fi
fi

if search_q "password:[[:space:]]*'[^']+'" src/services/admin-api.ts 2>/dev/null; then
  warn "hardcoded mock passwords detected in frontend admin mock"
fi

if search_q 'xss|sanitize|DOMPurify|white ?list|allow ?list' backend/src docs 2>/dev/null; then
  pass "content sanitization signal found"
else
  warn "no explicit content sanitization signal found"
fi

if search_q 'audit' docs backend/src src/services/admin-api.ts 2>/dev/null; then
  pass "audit logging signal found"
else
  warn "audit logging signal not found"
fi

echo
if (( status == 0 )); then
  echo "SECURITY_BASELINE=PASS warnings=$warn_count"
else
  echo "SECURITY_BASELINE=FAIL warnings=$warn_count"
fi

exit "$status"
