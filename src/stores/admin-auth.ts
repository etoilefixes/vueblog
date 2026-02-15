import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { adminApi } from '@/services/admin-api'
import {
  ADMIN_AUTH_SYNC_EVENT,
  readPersistedAuthState,
  writePersistedAuthState,
  type PersistedAuthState,
} from '@/services/auth-session'
import type { AdminAuthTokens, AdminLoginInput, AdminUser } from '@/types/admin'

let syncListenerBound = false

const parseErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return '认证失败，请稍后重试'
}

const sanitizeDisplayName = (value: string) => {
  return value.trim().slice(0, 80)
}

const sanitizeAvatarUrl = (value: string | undefined) => {
  const normalized = value?.trim() ?? ''
  return normalized || undefined
}

export const useAdminAuthStore = defineStore('admin-auth', () => {
  const hydrated = ref(false)
  const isAuthenticating = ref(false)
  const authError = ref('')
  const user = ref<AdminUser | null>(null)
  const tokens = ref<AdminAuthTokens | null>(null)

  const isAuthenticated = computed(() => {
    if (!user.value || !tokens.value) {
      return false
    }

    return tokens.value.expiresAt > Date.now()
  })

  const roleLabel = computed(() => {
    if (!user.value) {
      return ''
    }

    return user.value.roles.join(' / ')
  })

  const persist = () => {
    if (!user.value || !tokens.value) {
      writePersistedAuthState(null)
      return
    }

    const payload: PersistedAuthState = {
      user: user.value,
      tokens: tokens.value,
    }

    writePersistedAuthState(payload)
  }

  const clearAuth = () => {
    user.value = null
    tokens.value = null
    authError.value = ''
    writePersistedAuthState(null)
  }

  const ensureHydrated = () => {
    if (hydrated.value) {
      return
    }

    try {
      const parsed = readPersistedAuthState()

      if (!parsed) {
        hydrated.value = true
        return
      }

      user.value = parsed.user
      tokens.value = parsed.tokens

      if (!isAuthenticated.value) {
        clearAuth()
      }
    } catch {
      clearAuth()
    } finally {
      hydrated.value = true
    }
  }

  if (typeof window !== 'undefined' && !syncListenerBound) {
    syncListenerBound = true

    window.addEventListener(ADMIN_AUTH_SYNC_EVENT, (event) => {
      const detail = (event as CustomEvent<PersistedAuthState | null>).detail

      if (!detail) {
        user.value = null
        tokens.value = null
        authError.value = ''
        return
      }

      user.value = detail.user
      tokens.value = detail.tokens
    })
  }

  const login = async (payload: AdminLoginInput) => {
    isAuthenticating.value = true
    authError.value = ''

    try {
      const result = await adminApi.login(payload)
      user.value = result.user
      tokens.value = result.tokens
      persist()
      return result.user
    } catch (error) {
      authError.value = parseErrorMessage(error)
      throw error
    } finally {
      isAuthenticating.value = false
    }
  }

  const refreshSession = async () => {
    if (!tokens.value?.refreshToken) {
      return false
    }

    try {
      const nextTokens = await adminApi.refresh({
        refreshToken: tokens.value.refreshToken,
      })
      tokens.value = nextTokens
      persist()
      return true
    } catch {
      clearAuth()
      return false
    }
  }

  const logout = async () => {
    const refreshToken = tokens.value?.refreshToken
    clearAuth()

    try {
      await adminApi.logout({ refreshToken })
    } catch {
      // ignore logout network errors in client
    }
  }

  const hasPermission = (permission: string) => {
    if (!isAuthenticated.value || !user.value) {
      return false
    }

    if (user.value.permissions.includes('*')) {
      return true
    }

    return user.value.permissions.includes(permission)
  }

  const hasAnyPermission = (permissions: string[]) => {
    if (permissions.length === 0) {
      return true
    }

    return permissions.some((permission) => hasPermission(permission))
  }

  const updateProfile = (payload: { displayName: string; avatarUrl?: string }) => {
    if (!user.value) {
      return null
    }

    const nextDisplayName = sanitizeDisplayName(payload.displayName)

    if (!nextDisplayName) {
      return null
    }

    user.value = {
      ...user.value,
      displayName: nextDisplayName,
      avatarUrl: sanitizeAvatarUrl(payload.avatarUrl),
    }
    persist()

    return user.value
  }

  return {
    hydrated,
    user,
    tokens,
    authError,
    isAuthenticating,
    isAuthenticated,
    roleLabel,
    ensureHydrated,
    login,
    refreshSession,
    logout,
    hasPermission,
    hasAnyPermission,
    updateProfile,
  }
})
