#!/usr/bin/env bash
set -euo pipefail

OLD_FILE="${1:-}"
NEW_FILE="${2:-}"
ALLOW_TOKEN_REMOVAL="${ALLOW_TOKEN_REMOVAL:-false}"
PROTECTED_TOKEN_PREFIXES="${PROTECTED_TOKEN_PREFIXES:-color.,space.,radius.,font.}"

if [[ -z "$OLD_FILE" || -z "$NEW_FILE" ]]; then
  echo "Usage: $0 <old_tokens.json> <new_tokens.json>" >&2
  exit 1
fi

if [[ ! -f "$OLD_FILE" || ! -f "$NEW_FILE" ]]; then
  echo "ERROR: token file not found" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required" >&2
  exit 1
fi

node - "$OLD_FILE" "$NEW_FILE" "$ALLOW_TOKEN_REMOVAL" "$PROTECTED_TOKEN_PREFIXES" <<'NODE'
const fs = require('fs')

const [oldPath, newPath, allowRemovalRaw, protectedPrefixesRaw] = process.argv.slice(2)
const allowRemoval = String(allowRemovalRaw).toLowerCase() === 'true'
const protectedPrefixes = protectedPrefixesRaw
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

const readJson = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(content)
}

const flatten = (value, prefix = '', out = {}) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of Object.keys(value)) {
      const next = prefix ? `${prefix}.${key}` : key
      flatten(value[key], next, out)
    }
    return out
  }

  out[prefix] = value
  return out
}

const oldFlat = flatten(readJson(oldPath))
const newFlat = flatten(readJson(newPath))

const oldKeys = Object.keys(oldFlat)
const newKeys = Object.keys(newFlat)

const removed = oldKeys.filter((key) => !(key in newFlat)).sort()
const added = newKeys.filter((key) => !(key in oldFlat)).sort()
const changed = oldKeys
  .filter((key) => key in newFlat && JSON.stringify(oldFlat[key]) !== JSON.stringify(newFlat[key]))
  .sort()

const protectedChanged = changed.filter((key) =>
  protectedPrefixes.some((prefix) => key === prefix || key.startsWith(prefix)),
)

console.log(`Added keys: ${added.length}`)
console.log(`Removed keys: ${removed.length}`)
console.log(`Changed keys: ${changed.length}`)

if (added.length > 0) {
  console.log('\nADDED:')
  console.log(added.join('\n'))
}

if (removed.length > 0) {
  console.log('\nREMOVED:')
  console.log(removed.join('\n'))
}

if (protectedChanged.length > 0) {
  console.log('\nPROTECTED_CHANGED:')
  console.log(protectedChanged.join('\n'))
}

let status = 0

if (removed.length > 0 && !allowRemoval) {
  status = 1
  console.error('\nFAIL: token removals detected without ALLOW_TOKEN_REMOVAL=true')
}

if (protectedChanged.length > 0) {
  status = 1
  console.error('\nFAIL: protected token keys changed')
}

if (status === 0) {
  console.log('\nTOKEN_DIFF=PASS')
} else {
  console.log('\nTOKEN_DIFF=FAIL')
}

process.exit(status)
NODE
