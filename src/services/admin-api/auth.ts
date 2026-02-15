import type { AdminAuthPayload, AdminAuthTokens, AdminLoginInput, AdminRefreshInput } from '@/types/admin'
import { adminApiEndpoints, requestJson } from './core'

export const createAdminAuthApi = () => {
  return {
    async login(input: AdminLoginInput): Promise<AdminAuthPayload> {
      return requestJson<AdminAuthPayload>(
        adminApiEndpoints.login,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
        { withAuth: false, retryOnUnauthorized: false },
      )
    },

    async refresh(input: AdminRefreshInput): Promise<AdminAuthTokens> {
      return requestJson<AdminAuthTokens>(
        adminApiEndpoints.refresh,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
        { withAuth: false, retryOnUnauthorized: false },
      )
    },

    async logout(input: { refreshToken?: string }): Promise<void> {
      await requestJson<void>(
        adminApiEndpoints.logout,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
        { withAuth: false, retryOnUnauthorized: false },
      )
    },
  }
}
