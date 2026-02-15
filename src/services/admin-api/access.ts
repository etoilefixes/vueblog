import type { AdminAccessSnapshot, AdminUpdateUserAccessInput } from '@/types/admin'
import { adminApiEndpoints, requestJson } from './core'

export const createAdminAccessApi = () => {
  return {
    async getAccessSnapshot(): Promise<AdminAccessSnapshot> {
      return requestJson<AdminAccessSnapshot>(adminApiEndpoints.accessSnapshot)
    },

    async updateUserAccess(input: AdminUpdateUserAccessInput): Promise<AdminAccessSnapshot> {
      return requestJson<AdminAccessSnapshot>(adminApiEndpoints.accessUsers, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
    },
  }
}
