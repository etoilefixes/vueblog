#!/usr/bin/env bash
set -euo pipefail

CONTRACT_FILE="${1:-docs/backend-api-contract.md}"
shift || true

if [[ $# -gt 0 ]]; then
  FRONTEND_FILES=("$@")
else
  FRONTEND_FILES=("src/services/blog-api.ts" "src/services/admin-api.ts")
fi

if [[ ! -f "$CONTRACT_FILE" ]]; then
  echo "ERROR: contract file not found: $CONTRACT_FILE" >&2
  exit 1
fi

for file in "${FRONTEND_FILES[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "ERROR: frontend file not found: $file" >&2
    exit 1
  fi
done

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

contract_paths="$tmp_dir/contract_paths.txt"
frontend_paths="$tmp_dir/frontend_paths.txt"

sed -nE 's/^### `((GET|POST|PUT|PATCH|DELETE) \/[^` ]+)`$/\1/p' "$CONTRACT_FILE" \
  | awk '{print $2}' \
  | sed -E 's/\{[^}]+\}/:param/g; s#/+$##' \
  | sort -u > "$contract_paths"

extract_frontend_paths() {
  local file="$1"
  local prefix="$2"

  node - "$file" <<'NODE' | sed -E 's/[[:space:]]+//g; s/\$\{[^}]+\}/:param/g; s#/+$##' \
    | awk -v prefix="$prefix" '
        NF > 0 {
          p = $0
          if (prefix != "" && p !~ "^/admin/" && p !~ "^/blog/") {
            p = prefix p
          }
          print p
        }'
const fs = require('fs')
const file = process.argv[2]
const source = fs.readFileSync(file, 'utf8')
const pattern = /build(?:Admin)?Endpoint\s*\(\s*([`'"])([\s\S]*?)\1\s*,?\s*\)/g
let match
while ((match = pattern.exec(source))) {
  console.log(match[2])
}
NODE
}

{
  for file in "${FRONTEND_FILES[@]}"; do
    case "$file" in
      *admin-api.ts) extract_frontend_paths "$file" "/admin" ;;
      *) extract_frontend_paths "$file" "" ;;
    esac
  done
} | sort -u > "$frontend_paths"

missing_in_frontend="$tmp_dir/missing_in_frontend.txt"
extra_in_frontend="$tmp_dir/extra_in_frontend.txt"

comm -23 "$contract_paths" "$frontend_paths" > "$missing_in_frontend"
comm -13 "$contract_paths" "$frontend_paths" > "$extra_in_frontend"

echo "Contract paths: $(wc -l < "$contract_paths" | tr -d ' ')"
echo "Frontend paths: $(wc -l < "$frontend_paths" | tr -d ' ')"

status=0

if [[ -s "$missing_in_frontend" ]]; then
  status=1
  echo
  echo "MISSING_IN_FRONTEND:"
  cat "$missing_in_frontend"
fi

if [[ -s "$extra_in_frontend" ]]; then
  echo
  echo "EXTRA_IN_FRONTEND:"
  cat "$extra_in_frontend"
fi

if (( status == 0 )); then
  echo
  echo "PASS: no contract paths missing in frontend endpoint registries"
else
  echo
  echo "FAIL: contract drift detected"
fi

exit "$status"
