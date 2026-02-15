import type { AdminApiResponse, AdminAuthTokens, AdminUser } from '@/types/admin'

const AUTH_STORAGE_KEY = 'blog_admin_auth_v1'
export const ADMIN_AUTH_SYNC_EVENT = 'blog-admin-auth-sync'

export interface PersistedAuthState {
  user: AdminUser
  tokens: AdminAuthTokens
}

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage)

const unwrapResponse = <T>(payload: unknown): T => {
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    (payload as AdminApiResponse<T>).data !== undefined
  ) {
    return (payload as AdminApiResponse<T>).data
  }

  return payload as T
}

export const readPersistedAuthState = (): PersistedAuthState | null => {
  if (!canUseStorage()) {
    return null
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as PersistedAuthState
    if (!parsed?.user || !parsed?.tokens) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export const writePersistedAuthState = (state: PersistedAuthState | null) => {
  if (!canUseStorage()) {
    return
  }

  if (!state) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    window.dispatchEvent(
      new CustomEvent<PersistedAuthState | null>(ADMIN_AUTH_SYNC_EVENT, { detail: null }),
    )
    return
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state))
  window.dispatchEvent(
    new CustomEvent<PersistedAuthState | null>(ADMIN_AUTH_SYNC_EVENT, { detail: state }),
  )
}

export const getPersistedAccessToken = () => {
  const state = readPersistedAuthState()
  if (!state) {
    return null
  }

  if (!state.tokens.accessToken || state.tokens.expiresAt <= Date.now()) {
    return null
  }

  return state.tokens.accessToken
}

export const tryRefreshAccessToken = async (refreshEndpoint: string): Promise<string | null> => {
  const state = readPersistedAuthState()
  if (!state?.tokens.refreshToken) {
    return null
  }

  try {
    const response = await fetch(refreshEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken: state.tokens.refreshToken,
      }),
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        writePersistedAuthState(null)
      }
      return null
    }

    const text = await response.text()
    if (!text) {
      return null
    }

    const tokens = unwrapResponse<AdminAuthTokens>(JSON.parse(text) as unknown)
    writePersistedAuthState({
      ...state,
      tokens,
    })

    return tokens.accessToken
  } catch {
    return null
  }
}
