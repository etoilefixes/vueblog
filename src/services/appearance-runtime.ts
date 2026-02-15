export type AppearanceMode = 'light' | 'night'

const APPEARANCE_STORAGE_KEY = 'blog_appearance_mode_v1'
const APPEARANCE_ATTRIBUTE = 'data-appearance'

const isValidAppearanceMode = (value: unknown): value is AppearanceMode => {
  return value === 'light' || value === 'night'
}

const canUseStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

export const getSystemAppearanceMode = (): AppearanceMode => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'light'
}

export const applyAppearanceMode = (mode: AppearanceMode) => {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  root.setAttribute(APPEARANCE_ATTRIBUTE, mode)
  root.style.colorScheme = mode === 'night' ? 'dark' : 'light'
}

export const getAppliedAppearanceMode = (): AppearanceMode => {
  if (typeof document === 'undefined') {
    return 'light'
  }

  const current = document.documentElement.getAttribute(APPEARANCE_ATTRIBUTE)

  if (isValidAppearanceMode(current)) {
    return current
  }

  return getSystemAppearanceMode()
}

export const readPersistedAppearanceMode = (): AppearanceMode | null => {
  if (!canUseStorage()) {
    return null
  }

  const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY)

  if (!raw) {
    return null
  }

  return isValidAppearanceMode(raw) ? raw : null
}

export const persistAppearanceMode = (mode: AppearanceMode) => {
  if (!canUseStorage()) {
    return
  }

  localStorage.setItem(APPEARANCE_STORAGE_KEY, mode)
}

export const clearPersistedAppearanceMode = () => {
  if (!canUseStorage()) {
    return
  }

  localStorage.removeItem(APPEARANCE_STORAGE_KEY)
}

export const hydrateAppearanceModeFromStorage = () => {
  const persisted = readPersistedAppearanceMode()
  const mode = persisted ?? getSystemAppearanceMode()

  applyAppearanceMode(mode)
  return mode
}
