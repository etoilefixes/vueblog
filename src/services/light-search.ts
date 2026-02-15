export interface WeightedSearchField {
  text: string
  weight: number
}

const TOKEN_SEPARATOR = /[\s\u3000]+/
const WORD_BREAK_PATTERN = /[\s\-_/|.,;:!?()[\]{}]/

const normalizeSearchText = (value: string) => value.trim().toLowerCase()

const scoreTokenInText = (text: string, token: string) => {
  const index = text.indexOf(token)

  if (index < 0) {
    return 0
  }

  let score = 1

  if (index === 0) {
    score += 0.55
  }

  const previousChar = text[index - 1] ?? ''
  if (index === 0 || WORD_BREAK_PATTERN.test(previousChar)) {
    score += 0.25
  }

  if (text === token) {
    score += 0.65
  }

  return score
}

const escapeRegExp = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const tokenizeSearchKeyword = (keyword: string) => {
  return normalizeSearchText(keyword).split(TOKEN_SEPARATOR).filter(Boolean)
}

export const scoreWeightedSearch = (
  fields: ReadonlyArray<WeightedSearchField>,
  keyword: string,
) => {
  const tokens = tokenizeSearchKeyword(keyword)

  if (tokens.length === 0) {
    return 0
  }

  const normalizedFields = fields
    .map((field) => ({
      text: normalizeSearchText(field.text),
      weight: field.weight,
    }))
    .filter((field) => field.text.length > 0 && field.weight > 0)

  if (normalizedFields.length === 0) {
    return 0
  }

  let totalScore = 0

  for (const token of tokens) {
    let bestScore = 0

    normalizedFields.forEach((field) => {
      const nextScore = scoreTokenInText(field.text, token) * field.weight
      if (nextScore > bestScore) {
        bestScore = nextScore
      }
    })

    if (bestScore === 0) {
      return 0
    }

    totalScore += bestScore
  }

  return Number(totalScore.toFixed(4))
}

export const collectKeywordMatchRanges = (value: string, keyword: string) => {
  const tokens = Array.from(new Set(tokenizeSearchKeyword(keyword)))

  if (tokens.length === 0 || value.length === 0) {
    return [] as Array<readonly [number, number]>
  }

  const pattern = new RegExp(tokens.map((token) => escapeRegExp(token)).join('|'), 'gi')
  const ranges: Array<readonly [number, number]> = []
  let match: RegExpExecArray | null

  while (true) {
    match = pattern.exec(value)

    if (!match) {
      break
    }

    const matchedText = match[0]
    const start = match.index
    const end = start + matchedText.length - 1

    if (end >= start) {
      ranges.push([start, end] as const)
    }

    if (matchedText.length === 0) {
      pattern.lastIndex += 1
    }
  }

  if (ranges.length <= 1) {
    return ranges
  }

  const sortedRanges = [...ranges].sort((a, b) => a[0] - b[0])
  const [firstRange, ...restRanges] = sortedRanges

  if (!firstRange) {
    return []
  }

  const mergedRanges: Array<readonly [number, number]> = [firstRange]

  for (const [start, end] of restRanges) {
    const previous = mergedRanges[mergedRanges.length - 1]

    if (!previous) {
      mergedRanges.push([start, end])
      continue
    }

    const [previousStart, previousEnd] = previous

    if (start <= previousEnd + 1) {
      mergedRanges[mergedRanges.length - 1] = [previousStart, Math.max(previousEnd, end)]
      continue
    }

    mergedRanges.push([start, end])
  }

  return mergedRanges
}
