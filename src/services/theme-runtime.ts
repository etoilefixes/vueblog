import type { AdminThemeTokens } from '@/types/admin'

interface PersistedThemePayload {
  tokens: AdminThemeTokens
  revisionId?: string
  name?: string
  updatedAt: string
}

const THEME_STORAGE_KEY = 'blog_theme_active_tokens_v1'

const TOKEN_CSS_VAR_MAP: Record<keyof AdminThemeTokens, string> = {
  brand: '--brand',
  brandStrong: '--brand-strong',
  accent: '--accent',
  bgMain: '--bg-main',
  ink: '--ink',
  surfaceGlass: '--surface-glass',
  line: '--line',
}

const isValidTokenPayload = (value: unknown): value is AdminThemeTokens => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (Object.keys(TOKEN_CSS_VAR_MAP) as Array<keyof AdminThemeTokens>).every((key) => {
    return typeof candidate[key] === 'string' && candidate[key].trim().length > 0
  })
}

const canUseStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

export const applyThemeTokens = (tokens: AdminThemeTokens) => {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement

  ;(Object.keys(TOKEN_CSS_VAR_MAP) as Array<keyof AdminThemeTokens>).forEach((key) => {
    root.style.setProperty(TOKEN_CSS_VAR_MAP[key], tokens[key])
  })
}

export const readPersistedThemePayload = (): PersistedThemePayload | null => {
  if (!canUseStorage()) {
    return null
  }

  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)

    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<PersistedThemePayload>

    if (!parsed || !isValidTokenPayload(parsed.tokens)) {
      return null
    }

    return {
      tokens: parsed.tokens,
      revisionId: typeof parsed.revisionId === 'string' ? parsed.revisionId : undefined,
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
      updatedAt:
        typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export const persistActiveThemeTokens = (
  tokens: AdminThemeTokens,
  meta: { revisionId?: string; name?: string } = {},
) => {
  if (!canUseStorage()) {
    return
  }

  const payload: PersistedThemePayload = {
    tokens,
    revisionId: meta.revisionId,
    name: meta.name,
    updatedAt: new Date().toISOString(),
  }

  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(payload))
}

export const clearPersistedThemeTokens = () => {
  if (!canUseStorage()) {
    return
  }

  localStorage.removeItem(THEME_STORAGE_KEY)
}

export const hydrateThemeTokensFromStorage = () => {
  const persisted = readPersistedThemePayload()

  if (!persisted) {
    return null
  }

  applyThemeTokens(persisted.tokens)
  return persisted
}
