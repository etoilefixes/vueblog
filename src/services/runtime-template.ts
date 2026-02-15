export interface RuntimeCounter {
  days: number
  hours: number
  minutes: number
  seconds: number
}

export const DEFAULT_RUNTIME_TEMPLATE = '本站居然运行了{days}天{hours}小时{minutes}分{seconds}秒'

const LEGACY_TRAILING_RUNTIME_PATTERN = /\d+天\d+小时\d+分\d+秒$/

const toLegacyPrefix = (value: string) => {
  const stripped = value.replace(LEGACY_TRAILING_RUNTIME_PATTERN, '').trim()
  return stripped || '本站居然运行了'
}

export const hasRuntimeTokens = (value: string) => {
  return /\{days\}|\{hours\}|\{minutes\}|\{seconds\}/.test(value)
}

export const normalizeRuntimeTemplate = (value: string) => {
  const trimmed = value.trim()

  if (!trimmed) {
    return DEFAULT_RUNTIME_TEMPLATE
  }

  if (hasRuntimeTokens(trimmed)) {
    return trimmed
  }

  return `${toLegacyPrefix(trimmed)}{days}天{hours}小时{minutes}分{seconds}秒`
}

export const formatRuntimeTemplate = (template: string, runtime: RuntimeCounter) => {
  const normalizedTemplate = normalizeRuntimeTemplate(template)

  return normalizedTemplate
    .replace(/\{days\}/g, String(runtime.days))
    .replace(/\{hours\}/g, String(runtime.hours))
    .replace(/\{minutes\}/g, String(runtime.minutes))
    .replace(/\{seconds\}/g, String(runtime.seconds))
}
