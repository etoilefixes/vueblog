import { getPersistedAccessToken, tryRefreshAccessToken } from '@/services/auth-session'
import type { BlogApiResponse } from '@/types/api'

const API_BASE_URL = String(import.meta.env.VITE_BLOG_API_BASE_URL ?? '/api').replace(/\/+$/, '')
const ADMIN_API_BASE_URL = String(import.meta.env.VITE_ADMIN_API_BASE_URL ?? '/api/admin').replace(
  /\/+$/,
  '',
)
const ADMIN_REFRESH_ENDPOINT = `${ADMIN_API_BASE_URL}/auth/refresh`

const buildEndpoint = (path: string) => {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalized}`
}

export const blogApiEndpoints = {
  bootstrap: buildEndpoint('/blog/bootstrap'),
  posts: buildEndpoint('/blog/posts'),
  postById: (postId: string) => buildEndpoint(`/blog/posts/${encodeURIComponent(postId)}`),
  comments: (postId: string) => buildEndpoint(`/blog/posts/${encodeURIComponent(postId)}/comments`),
  commentById: (postId: string, commentId: string) =>
    buildEndpoint(`/blog/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`),
  commentLike: (postId: string, commentId: string) =>
    buildEndpoint(
      `/blog/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/like`,
    ),
  profile: buildEndpoint('/blog/site/profile'),
  footer: buildEndpoint('/blog/site/footer'),
  links: buildEndpoint('/blog/site/links'),
  about: buildEndpoint('/blog/site/about'),
  projects: buildEndpoint('/blog/site/projects'),
}

const createHeaders = (init: RequestInit, accessTokenOverride?: string) => {
  const headers = new Headers(init.headers ?? undefined)

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (!headers.has('Authorization')) {
    const token = accessTokenOverride ?? getPersistedAccessToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }

  return headers
}

const readApiErrorMessage = async (response: Response) => {
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

const unwrapResponse = <T>(payload: unknown): T => {
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    (payload as BlogApiResponse<T>).data !== undefined
  ) {
    return (payload as BlogApiResponse<T>).data
  }

  return payload as T
}

export const requestJson = async <T>(url: string, init: RequestInit = {}): Promise<T> => {
  const execute = async (accessTokenOverride?: string) => {
    return fetch(url, {
      ...init,
      headers: createHeaders(init, accessTokenOverride),
    })
  }

  let response = await execute()

  if (response.status === 401) {
    const refreshedToken = await tryRefreshAccessToken(ADMIN_REFRESH_ENDPOINT)
    if (refreshedToken) {
      response = await execute(refreshedToken)
    }
  }

  if (!response.ok) {
    const message = await readApiErrorMessage(response)
    throw new Error(`请求失败: ${message}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()

  if (!text) {
    return undefined as T
  }

  const parsed = JSON.parse(text) as unknown
  return unwrapResponse<T>(parsed)
}
