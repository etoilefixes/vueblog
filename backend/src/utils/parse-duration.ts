const durationPattern = /^(\d+)(ms|s|m|h|d)?$/i

const durationUnits: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
}

export const parseDurationToMs = (input: string): number => {
  const normalized = input.trim().toLowerCase()
  const match = durationPattern.exec(normalized)

  if (!match) {
    throw new Error(`Invalid duration format: ${input}`)
  }

  const [, rawValue, rawUnit] = match
  const value = Number(rawValue)
  const unit = rawUnit ?? 'ms'
  const multiplier = durationUnits[unit]

  if (!Number.isFinite(value) || value <= 0 || !multiplier) {
    throw new Error(`Invalid duration value: ${input}`)
  }

  return value * multiplier
}
