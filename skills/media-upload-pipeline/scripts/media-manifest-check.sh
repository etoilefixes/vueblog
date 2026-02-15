#!/usr/bin/env bash
set -euo pipefail

MANIFEST_FILE="${1:-}"
MAX_MEDIA_BYTES="${MAX_MEDIA_BYTES:-10485760}"

if [[ -z "$MANIFEST_FILE" ]]; then
  echo "Usage: $0 <manifest.csv>" >&2
  echo "CSV columns: name,url,mimeType,size,width,height" >&2
  exit 1
fi

if [[ ! -f "$MANIFEST_FILE" ]]; then
  echo "ERROR: manifest file not found: $MANIFEST_FILE" >&2
  exit 1
fi

awk -F, -v max_bytes="$MAX_MEDIA_BYTES" '
function trim(s) {
  gsub(/^[ \t\"]+|[ \t\"]+$/, "", s)
  return s
}
BEGIN {
  invalid = 0
  total = 0
}
{
  name = trim($1)
  url = trim($2)
  mime = trim($3)
  size = trim($4)
  width = trim($5)
  height = trim($6)

  if (NR == 1 && tolower(name) == "name" && tolower(url) == "url") {
    next
  }

  total += 1
  row_ok = 1

  if (name == "" || url == "" || mime == "" || size == "") {
    row_ok = 0
  }

  if (url !~ /^https?:\/\// && url !~ /^\//) {
    row_ok = 0
  }

  if (mime !~ /^[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+$/) {
    row_ok = 0
  }

  if (size !~ /^[0-9]+$/ || (size + 0) <= 0 || (size + 0) > max_bytes) {
    row_ok = 0
  }

  if (width != "" && (width !~ /^[0-9]+$/ || (width + 0) <= 0)) {
    row_ok = 0
  }

  if (height != "" && (height !~ /^[0-9]+$/ || (height + 0) <= 0)) {
    row_ok = 0
  }

  if (!row_ok) {
    invalid += 1
    printf "INVALID_ROW[%d]: %s\n", NR, $0
  }
}
END {
  printf "Rows checked: %d\n", total
  printf "Invalid rows: %d\n", invalid
  if (invalid > 0) {
    print "MANIFEST_CHECK=FAIL"
    exit 1
  }
  print "MANIFEST_CHECK=PASS"
}
' "$MANIFEST_FILE"
