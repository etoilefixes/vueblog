#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <request-log.csv> [top_n]" >&2
  echo "CSV columns: endpoint,duration_ms,status_code" >&2
  exit 1
fi

CSV_FILE="$1"
TOP_N="${2:-15}"
ERROR_STATUS_MIN="${ERROR_STATUS_MIN:-500}"

if [[ ! -f "$CSV_FILE" ]]; then
  echo "ERROR: file not found: $CSV_FILE" >&2
  exit 1
fi

if [[ ! "$TOP_N" =~ ^[0-9]+$ ]] || [[ "$TOP_N" -lt 1 ]]; then
  echo "ERROR: top_n must be a positive integer" >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

normalized="$tmp_dir/normalized.csv"
awk -F, '
function trim(s) {
  gsub(/^[ \t"]+/, "", s)
  gsub(/[ \t"]+$/, "", s)
  return s
}
{
  endpoint = trim($1)
  duration = trim($2)
  status = trim($3)

  if (tolower(endpoint) == "endpoint" && tolower(duration) ~ /duration/) {
    next
  }
  if (endpoint == "") {
    next
  }
  if (duration !~ /^[0-9]+(\.[0-9]+)?$/) {
    next
  }
  if (status !~ /^[0-9][0-9][0-9]$/) {
    status = "0"
  }
  print endpoint "," duration "," status
  valid = 1
}
END {
  if (!valid) {
    exit 2
  }
}
' "$CSV_FILE" > "$normalized" || {
  if [[ $? -eq 2 ]]; then
    echo "ERROR: no valid rows found in CSV" >&2
  else
    echo "ERROR: failed to parse CSV" >&2
  fi
  exit 1
}

endpoints="$tmp_dir/endpoints.txt"
cut -d, -f1 "$normalized" | sort | uniq > "$endpoints"

raw_report="$tmp_dir/raw-report.csv"

percentile_from_sorted() {
  local file="$1"
  local p="$2"
  awk -v p="$p" '
  {
    values[NR] = $1
  }
  END {
    if (NR == 0) {
      printf "0.00"
      exit
    }
    # nearest-rank percentile
    idx = int((p * NR + 99) / 100)
    if (idx < 1) idx = 1
    if (idx > NR) idx = NR
    printf "%.2f", values[idx]
  }' "$file"
}

while IFS= read -r endpoint; do
  [[ -z "$endpoint" ]] && continue

  ep_rows="$tmp_dir/ep_rows.csv"
  awk -F, -v ep="$endpoint" '$1 == ep { print $2 "," $3 }' "$normalized" > "$ep_rows"

  count="$(wc -l < "$ep_rows" | tr -d ' ')"
  avg="$(awk -F, '{sum += $1} END { if (NR == 0) printf "0.00"; else printf "%.2f", sum / NR }' "$ep_rows")"
  err_rate="$(awk -F, -v min_status="$ERROR_STATUS_MIN" '{ if ($2 + 0 >= min_status) err += 1 } END { if (NR == 0) printf "0.00"; else printf "%.2f", (err * 100) / NR }' "$ep_rows")"

  sorted_durations="$tmp_dir/sorted_durations.txt"
  cut -d, -f1 "$ep_rows" | sort -n > "$sorted_durations"
  p50="$(percentile_from_sorted "$sorted_durations" 50)"
  p95="$(percentile_from_sorted "$sorted_durations" 95)"
  p99="$(percentile_from_sorted "$sorted_durations" 99)"

  printf "%s,%s,%s,%s,%s,%s,%s\n" \
    "$endpoint" "$count" "$err_rate" "$avg" "$p50" "$p95" "$p99" >> "$raw_report"
done < "$endpoints"

sorted_report="$tmp_dir/sorted-report.csv"
sort -t, -k6,6nr "$raw_report" | head -n "$TOP_N" > "$sorted_report"

printf "%-40s %8s %8s %10s %10s %10s %10s\n" \
  "Endpoint" "Count" "Err(%)" "Avg(ms)" "P50(ms)" "P95(ms)" "P99(ms)"
printf "%-40s %8s %8s %10s %10s %10s %10s\n" \
  "--------" "-----" "------" "-------" "-------" "-------" "-------"

while IFS=, read -r endpoint count err avg p50 p95 p99; do
  printf "%-40s %8s %8s %10s %10s %10s %10s\n" \
    "$endpoint" "$count" "$err" "$avg" "$p50" "$p95" "$p99"
done < "$sorted_report"
