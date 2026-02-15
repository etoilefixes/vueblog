import type {
  AdminCleanupMediaInput,
  AdminCleanupMediaResult,
  AdminDeleteMediaInput,
  AdminDeleteMediaResult,
  AdminMediaItem,
  AdminMediaQuery,
  AdminMultipartAbortInput,
  AdminMultipartCompleteInput,
  AdminMultipartPresignPartInput,
  AdminMultipartPresignPartPayload,
  AdminMultipartUploadInitInput,
  AdminMultipartUploadInitPayload,
  AdminSignedUploadUrlInput,
  AdminSignedUploadUrlPayload,
  AdminUploadMediaInput,
} from '@/types/admin'
import { adminApiEndpoints, requestJson } from './core'

export const createAdminMediaApi = () => {
  return {
    async getMediaList(query: AdminMediaQuery = {}): Promise<AdminMediaItem[]> {
      const params = new URLSearchParams()

      if (query.keyword?.trim()) {
        params.set('keyword', query.keyword.trim())
      }

      if (query.mimeType?.trim()) {
        params.set('mimeType', query.mimeType.trim())
      }

      if (query.limit !== undefined) {
        params.set('limit', String(query.limit))
      }

      const search = params.toString()
      const endpoint = search
        ? `${adminApiEndpoints.mediaList}?${search}`
        : adminApiEndpoints.mediaList

      return requestJson<AdminMediaItem[]>(endpoint)
    },

    async uploadMedia(input: AdminUploadMediaInput): Promise<AdminMediaItem> {
      return requestJson<AdminMediaItem>(adminApiEndpoints.mediaUpload, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    async createSignedUploadUrl(
      input: AdminSignedUploadUrlInput,
    ): Promise<AdminSignedUploadUrlPayload> {
      return requestJson<AdminSignedUploadUrlPayload>(adminApiEndpoints.mediaUploadSignedUrl, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    async initMultipartUpload(
      input: AdminMultipartUploadInitInput,
    ): Promise<AdminMultipartUploadInitPayload> {
      return requestJson<AdminMultipartUploadInitPayload>(adminApiEndpoints.mediaMultipartInit, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    async presignMultipartPart(
      input: AdminMultipartPresignPartInput,
    ): Promise<AdminMultipartPresignPartPayload> {
      return requestJson<AdminMultipartPresignPartPayload>(
        adminApiEndpoints.mediaMultipartPresignPart,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      )
    },

    async completeMultipartUpload(input: AdminMultipartCompleteInput): Promise<AdminMediaItem> {
      return requestJson<AdminMediaItem>(adminApiEndpoints.mediaMultipartComplete, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    async abortMultipartUpload(
      input: AdminMultipartAbortInput,
    ): Promise<{ sessionId: string; aborted: boolean }> {
      return requestJson<{ sessionId: string; aborted: boolean }>(
        adminApiEndpoints.mediaMultipartAbort,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      )
    },

    async uploadLocalMedia(
      file: File,
      input: { name?: string; width?: number; height?: number } = {},
    ): Promise<AdminMediaItem> {
      const payload = new FormData()
      payload.set('file', file, file.name)

      if (input.name?.trim()) {
        payload.set('name', input.name.trim())
      }

      if (input.width && Number.isFinite(input.width) && input.width > 0) {
        payload.set('width', String(Math.trunc(input.width)))
      }

      if (input.height && Number.isFinite(input.height) && input.height > 0) {
        payload.set('height', String(Math.trunc(input.height)))
      }

      return requestJson<AdminMediaItem>(adminApiEndpoints.mediaUploadLocal, {
        method: 'POST',
        body: payload,
      })
    },

    async deleteMedia(mediaId: string, input: AdminDeleteMediaInput = {}): Promise<AdminDeleteMediaResult> {
      return requestJson<AdminDeleteMediaResult>(adminApiEndpoints.mediaById(mediaId), {
        method: 'DELETE',
        body: JSON.stringify(input),
      })
    },

    async cleanupMediaOrphans(
      input: AdminCleanupMediaInput = { dryRun: true },
    ): Promise<AdminCleanupMediaResult> {
      return requestJson<AdminCleanupMediaResult>(adminApiEndpoints.mediaCleanupOrphans, {
        method: 'POST',
        body: JSON.stringify({
          dryRun: input.dryRun ?? true,
        }),
      })
    },
  }
}
