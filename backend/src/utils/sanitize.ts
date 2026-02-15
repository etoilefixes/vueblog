const CONTROL_CHARACTERS_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g

interface SanitizeOptions {
  readonly maxLength?: number
  readonly allowNewlines?: boolean
}

export const sanitizePlainText = (input: string, options: SanitizeOptions = {}): string => {
  const { maxLength = 2_000, allowNewlines = true } = options

  let next = input
    .replace(CONTROL_CHARACTERS_PATTERN, '')
    .replace(/[<>]/g, '')
    .trim()

  if (!allowNewlines) {
    next = next.replace(/\s+/g, ' ')
  } else {
    next = next
      .replace(/\r\n/g, '\n')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
  }

  if (next.length > maxLength) {
    next = next.slice(0, maxLength)
  }

  return next
}
