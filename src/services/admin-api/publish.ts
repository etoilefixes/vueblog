import type {
  AdminCommitPublishInput,
  AdminCreatePublishPreviewInput,
  AdminPublishPreviewPayload,
  AdminPublishRecord,
  AdminRollbackPublishInput,
} from '@/types/admin'
import { adminApiEndpoints, requestJson } from './core'

export const createAdminPublishApi = () => {
  return {
    async getPublishHistory(): Promise<AdminPublishRecord[]> {
      return requestJson<AdminPublishRecord[]>(adminApiEndpoints.publishHistory)
    },

    async createPublishPreview(
      input: AdminCreatePublishPreviewInput = {},
    ): Promise<AdminPublishPreviewPayload> {
      return requestJson<AdminPublishPreviewPayload>(adminApiEndpoints.publishPreview, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    async commitPublish(input: AdminCommitPublishInput): Promise<AdminPublishRecord> {
      return requestJson<AdminPublishRecord>(adminApiEndpoints.publishCommit, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    async rollbackPublish(input: AdminRollbackPublishInput): Promise<AdminPublishRecord> {
      return requestJson<AdminPublishRecord>(adminApiEndpoints.publishRollback, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },
  }
}
