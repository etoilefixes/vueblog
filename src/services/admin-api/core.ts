import { getPersistedAccessToken, tryRefreshAccessToken } from '@/services/auth-session'
import type { AdminApiResponse } from '@/types/admin'

const ADMIN_API_BASE_URL = String(import.meta.env.VITE_ADMIN_API_BASE_URL ?? '/api/admin').replace(
  /\/+$/,
  '',
)

const buildAdminEndpoint = (path: string) => {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${ADMIN_API_BASE_URL}${normalized}`
}

export const adminApiEndpoints = {
  login: buildAdminEndpoint('/auth/login'),
  refresh: buildAdminEndpoint('/auth/refresh'),
  logout: buildAdminEndpoint('/auth/logout'),
  dashboardOverview: buildAdminEndpoint('/dashboard/overview'),
  themeRevisions: buildAdminEndpoint('/theme/revisions'),
  activateThemeRevision: (revisionId: string) =>
    buildAdminEndpoint(`/theme/revisions/${encodeURIComponent(revisionId)}/activate`),
  auditLogs: buildAdminEndpoint('/audit-logs'),
  siteFooter: buildAdminEndpoint('/site/footer'),
  posts: buildAdminEndpoint('/posts'),
  postById: (postId: string) => buildAdminEndpoint(`/posts/${encodeURIComponent(postId)}`),
  comments: buildAdminEndpoint('/comments'),
  commentById: (postId: string, commentId: string) =>
    buildAdminEndpoint(
      `/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
    ),
  commentsBatchStatus: buildAdminEndpoint('/comments/batch-status'),
  commentsBatchDelete: buildAdminEndpoint('/comments/batch-delete'),
  publishHistory: buildAdminEndpoint('/publish/history'),
  publishPreview: buildAdminEndpoint('/publish/preview'),
  publishCommit: buildAdminEndpoint('/publish/commit'),
  publishRollback: buildAdminEndpoint('/publish/rollback'),
  mediaList: buildAdminEndpoint('/media/list'),
  mediaUpload: buildAdminEndpoint('/media/upload'),
  mediaUploadSignedUrl: buildAdminEndpoint('/media/upload-signed-url'),
  mediaUploadLocal: buildAdminEndpoint('/media/upload-local'),
  mediaMultipartInit: buildAdminEndpoint('/media/multipart/init'),
  mediaMultipartPresignPart: buildAdminEndpoint('/media/multipart/presign-part'),
  mediaMultipartComplete: buildAdminEndpoint('/media/multipart/complete'),
  mediaMultipartAbort: buildAdminEndpoint('/media/multipart/abort'),
  mediaById: (mediaId: string) => buildAdminEndpoint(`/media/${encodeURIComponent(mediaId)}`),
  mediaCleanupOrphans: buildAdminEndpoint('/media/cleanup-orphans'),
  accessSnapshot: buildAdminEndpoint('/access/snapshot'),
  accessUsers: buildAdminEndpoint('/access/users'),
}

const ADMIN_REFRESH_ENDPOINT = adminApiEndpoints.refresh

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

const parseErrorMessage = async (response: Response) => {
  const fallback = `${response.status} ${response.statusText}`

  try {
    const text = await response.text()

    if (!text) {
      return fallback
    }

    const parsed = JSON.parse(text) as { message?: string }
    return parsed.message ?? fallback
  } catch {
    return fallback
  }
}

interface RequestJsonOptions {
  withAuth?: boolean
  retryOnUnauthorized?: boolean
}

export const requestJson = async <T>(
  url: string,
  init: RequestInit = {},
  options: RequestJsonOptions = {},
) => {
  const withAuth = options.withAuth ?? true
  const retryOnUnauthorized = options.retryOnUnauthorized ?? withAuth

  const execute = async (accessTokenOverride?: string) => {
    const headers = new Headers(init.headers ?? undefined)
    const isFormDataBody = typeof FormData !== 'undefined' && init.body instanceof FormData

    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json')
    }

    if (init.body && !isFormDataBody && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    if (withAuth && !headers.has('Authorization')) {
      const token = accessTokenOverride ?? getPersistedAccessToken()
      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }
    }

    return fetch(url, {
      ...init,
      headers,
    })
  }

  let response = await execute()

  if (response.status === 401 && retryOnUnauthorized && withAuth) {
    const refreshedToken = await tryRefreshAccessToken(ADMIN_REFRESH_ENDPOINT)

    if (refreshedToken) {
      response = await execute(refreshedToken)
    }
  }

  if (!response.ok) {
    throw new Error(`请求失败: ${await parseErrorMessage(response)}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()

  if (!text) {
    return undefined as T
  }

  return unwrapResponse<T>(JSON.parse(text) as unknown)
}
