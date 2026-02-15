#!/usr/bin/env bash
set -euo pipefail

DIST_DIR="${1:-dist}"
JS_BUDGET_KB="${JS_BUDGET_KB:-300}"
CSS_BUDGET_KB="${CSS_BUDGET_KB:-120}"
IMG_BUDGET_KB="${IMG_BUDGET_KB:-800}"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "ERROR: build directory not found: $DIST_DIR" >&2
  exit 1
fi

sum_by_pattern() {
  local pattern="$1"
  find "$DIST_DIR" -type f -name "$pattern" -print0 \
    | xargs -0 -r stat -c%s \
    | awk '{sum += $1} END {print sum + 0}'
}

bytes_to_kb() {
  local bytes="$1"
  echo $(((bytes + 1023) / 1024))
}

check_budget() {
  local label="$1"
  local size_kb="$2"
  local budget_kb="$3"
  if (( size_kb <= budget_kb )); then
    echo "PASS: $label ${size_kb}KB <= ${budget_kb}KB"
    return 0
  fi
  echo "FAIL: $label ${size_kb}KB > ${budget_kb}KB"
  return 1
}

js_bytes="$(sum_by_pattern '*.js')"
css_bytes="$(sum_by_pattern '*.css')"
img_bytes=$(
  {
    sum_by_pattern '*.png'
    sum_by_pattern '*.jpg'
    sum_by_pattern '*.jpeg'
    sum_by_pattern '*.webp'
    sum_by_pattern '*.avif'
    sum_by_pattern '*.svg'
    sum_by_pattern '*.gif'
  } | awk '{sum += $1} END {print sum + 0}'
)

js_kb="$(bytes_to_kb "$js_bytes")"
css_kb="$(bytes_to_kb "$css_bytes")"
img_kb="$(bytes_to_kb "$img_bytes")"

echo "Build directory: $DIST_DIR"
echo "Budgets: JS=${JS_BUDGET_KB}KB CSS=${CSS_BUDGET_KB}KB IMG=${IMG_BUDGET_KB}KB"
echo "Sizes:   JS=${js_kb}KB CSS=${css_kb}KB IMG=${img_kb}KB"

status=0
check_budget "JavaScript" "$js_kb" "$JS_BUDGET_KB" || status=1
check_budget "CSS" "$css_kb" "$CSS_BUDGET_KB" || status=1
check_budget "Images" "$img_kb" "$IMG_BUDGET_KB" || status=1

exit "$status"

