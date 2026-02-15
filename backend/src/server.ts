import 'dotenv/config'

import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import sensible from '@fastify/sensible'
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import { ZodError } from 'zod'

import { env } from './config/env.js'
import { pgPool } from './db/client.js'
import { readServiceMetrics, recordRequestMetric } from './infra/metrics/request-metrics.js'
import { minio } from './infra/minio/client.js'
import { redis } from './infra/redis/client.js'
import {
  adminAuditLogQuerySchema,
  adminCleanupMediaInputSchema,
  adminCommitPublishInputSchema,
  adminCreateThemeRevisionInputSchema,
  adminDeleteMediaInputSchema,
  adminMediaQuerySchema,
  adminMultipartAbortInputSchema,
  adminMultipartCompleteInputSchema,
  adminMultipartPresignPartInputSchema,
  adminMultipartUploadInitInputSchema,
  adminPublishPreviewInputSchema,
  adminRollbackPublishInputSchema,
  adminSignedUploadUrlInputSchema,
  adminUpdateUserAccessInputSchema,
  adminUploadMediaInputSchema,
  siteFooterPatchSchema,
} from './modules/admin/contracts.js'
import {
  addAuditLog,
  ensureAdminPersistence,
  hasPermission,
  queryAuditLogs,
  type AdminAuthClaims,
} from './modules/admin/state.js'
import {
  activateThemeRevision,
  commitPublish,
  createMultipartUploadSession,
  createPublishPreview,
  createThemeRevision,
  deleteMedia,
  cleanupMediaOrphans,
  ensureAdminRuntimePersistence,
  getAccessSnapshot,
  getMediaList,
  getPublishHistory,
  removeMultipartUploadSession,
  resolveMultipartUploadSession,
  getThemeRevisions,
  rollbackPublish,
  updateUserAccess,
  uploadMedia,
} from './modules/admin/runtime-state.js'
import {
  ensureBlogPersistence,
  getBlogBootstrapData,
  updateSiteFooter as updateBlogSiteFooter,
} from './modules/blog/state.js'
import { registerAdminAuthRoutes } from './routes/admin-auth-routes.js'
import { registerAdminContentRoutes } from './routes/admin-content-routes.js'
import { registerBlogRoutes } from './routes/blog-routes.js'
import { registerHealthRoutes } from './routes/health-routes.js'
import { registerLocalMediaRoutes } from './routes/media-routes.js'
import { RequestRateLimiter, type RateLimitResult } from './security/rate-limit.js'

const server = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    transport:
      env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  },
  requestTimeout: env.REQUEST_TIMEOUT_MS,
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'requestId',
})

await server.register(cors, {
  origin: env.CORS_ORIGIN,
  credentials: true,
})

await server.register(sensible)

await server.register(multipart, {
  limits: {
    files: 1,
    fileSize: env.MEDIA_LOCAL_MAX_SIZE_BYTES,
  },
})

await server.register(jwt, {
  secret: env.JWT_ACCESS_SECRET,
})

await ensureAdminPersistence()
await ensureAdminRuntimePersistence()
await ensureBlogPersistence()

const requestStartedAt = new WeakMap<FastifyRequest, bigint>()

const rateLimiter = new RequestRateLimiter([
  {
    id: 'login',
    max: env.RATE_LIMIT_LOGIN_MAX,
    windowMs: env.RATE_LIMIT_LOGIN_WINDOW_MS,
    matcher: (request) =>
      request.method.toUpperCase() === 'POST' && request.url.startsWith('/api/admin/auth/login'),
  },
  {
    id: 'write',
    max: env.RATE_LIMIT_WRITE_MAX,
    windowMs: env.RATE_LIMIT_WRITE_WINDOW_MS,
    matcher: (request) => {
      const method = request.method.toUpperCase()

      if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return false
      }

      return !request.url.startsWith('/health')
    },
  },
])

const withRateLimitHeaders = (reply: FastifyReply, result: RateLimitResult) => {
  reply.header('x-ratelimit-limit', String(result.limit))
  reply.header('x-ratelimit-remaining', String(result.remaining))
  reply.header('retry-after', String(result.retryAfterSeconds))
}

server.addHook('onRequest', async (request, reply) => {
  requestStartedAt.set(request, process.hrtime.bigint())

  const result = rateLimiter.check(request)

  if (!result) {
    return
  }

  withRateLimitHeaders(reply, result)

  if (result.allowed) {
    return
  }

  return reply.status(429).send({
    code: 'RATE_LIMITED',
    message: 'Too many requests',
    details: {
      retryAfterSeconds: result.retryAfterSeconds,
    },
    requestId: request.id,
  })
})

server.addHook('onResponse', async (request, reply) => {
  const startedAt = requestStartedAt.get(request)

  if (!startedAt) {
    return
  }

  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000
  const route = request.routeOptions.url || request.url.split('?')[0] || 'unknown'

  recordRequestMetric({
    method: request.method,
    route,
    statusCode: reply.statusCode,
    durationMs,
  })
})

server.setErrorHandler((error, request, reply) => {
  if (reply.sent) {
    return
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
      requestId: request.id,
    })
  }

  const statusCode =
    typeof (error as { statusCode?: unknown }).statusCode === 'number'
      ? Number((error as { statusCode: number }).statusCode)
      : 500
  const isServerError = statusCode >= 500
  const errorMessage = error instanceof Error ? error.message : 'Request failed'

  if (isServerError) {
    request.log.error({ err: error }, 'Unhandled request error')
  }

  return reply.status(statusCode).send({
    code: isServerError ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
    message: errorMessage,
    requestId: request.id,
  })
})

const withTimeout = async (work: () => Promise<unknown>, timeoutMs: number) => {
  return await Promise.race<boolean>([
    work()
      .then(() => true)
      .catch(() => false),
    new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), timeoutMs)
    }),
  ])
}

const runReadinessChecks = async () => {
  const checks = {
    postgres: false,
    redis: false,
    minio: false,
  }

  checks.postgres = await withTimeout(async () => {
    await pgPool.query('select 1')
  }, env.READINESS_CHECK_TIMEOUT_MS)

  checks.redis = await withTimeout(async () => {
    if (redis.status === 'wait') {
      await redis.connect()
    }

    await redis.ping()
  }, env.READINESS_CHECK_TIMEOUT_MS)

  checks.minio = await withTimeout(async () => {
    await minio.bucketExists(env.MINIO_BUCKET_PUBLIC)
  }, env.READINESS_CHECK_TIMEOUT_MS)

  return {
    checks,
    ready: Object.values(checks).every(Boolean),
  }
}

const ensureAccessClaims = async (
  request: FastifyRequest,
  reply: FastifyReply,
  requiredPermission?: string,
) => {
  let claims: AdminAuthClaims

  try {
    claims = await request.jwtVerify<AdminAuthClaims>()
  } catch {
    reply.status(401).send({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
      requestId: request.id,
    })
    return null
  }

  if (claims.tokenType !== 'access') {
    reply.status(401).send({
      code: 'UNAUTHORIZED',
      message: 'Invalid access token',
      requestId: request.id,
    })
    return null
  }

  if (requiredPermission && !hasPermission(claims, requiredPermission)) {
    reply.status(403).send({
      code: 'FORBIDDEN',
      message: `Missing permission: ${requiredPermission}`,
      requestId: request.id,
    })
    return null
  }

  return claims
}

const ok = <T>(request: FastifyRequest, data: T) => ({
  data,
  message: 'ok',
  requestId: request.id,
})

const backendRootPath = resolve(fileURLToPath(new URL('..', import.meta.url)))
const localMediaStorageRoot = resolve(backendRootPath, env.MEDIA_LOCAL_UPLOAD_DIR)
const localMediaMimeByExtension: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
}
const localMediaExtensionByMime = new Map<string, string>(
  Object.entries(localMediaMimeByExtension).map(([extension, mimeType]) => [mimeType, extension]),
)
const minioSignedUploadExpiresSeconds = 15 * 60
const multipartSessionExpiresSeconds = 60 * 60
const multipartMinPartSizeBytes = 5 * 1024 * 1024
const multipartDefaultPartSizeBytes = 8 * 1024 * 1024
const multipartMaxParts = 10_000
const minioTmpMultipartPrefix = 'admin/tmp/multipart/'
const minioLiveMultipartPrefix = 'admin/live/multipart/'
const minioExtensionByMime = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/svg+xml', '.svg'],
  ['image/avif', '.avif'],
  ['image/heic', '.heic'],
  ['image/heif', '.heif'],
  ['video/mp4', '.mp4'],
  ['application/pdf', '.pdf'],
  ['text/markdown', '.md'],
])

const minioPublicOrigin = (() => {
  const fallbackProtocol = env.MINIO_USE_SSL ? 'https:' : 'http:'
  const rawEndpoint = env.MINIO_ENDPOINT.trim()
  const withProtocol = /^https?:\/\//i.test(rawEndpoint)
    ? rawEndpoint
    : `${fallbackProtocol}//${rawEndpoint}`
  const parsed = new URL(withProtocol)
  const defaultPort = env.MINIO_USE_SSL ? 443 : 80
  const configuredPort = Number(parsed.port || env.MINIO_PORT)
  const portSegment = configuredPort === defaultPort ? '' : `:${configuredPort}`
  return `${parsed.protocol}//${parsed.hostname}${portSegment}`
})()

const buildMinioPublicUrl = (objectKey: string) => {
  const encodedObjectKey = objectKey
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `${minioPublicOrigin}/${encodeURIComponent(env.MINIO_BUCKET_PUBLIC)}/${encodedObjectKey}`
}

const normalizeUploadName = (value: string) => {
  const trimmed = value.trim()

  if (!trimmed) {
    return ''
  }

  return trimmed
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 110)
}

const extractFileExtension = (fileName: string, mimeType: string) => {
  const extensionMatch = fileName.trim().toLowerCase().match(/\.([a-z0-9]{1,10})$/)

  if (extensionMatch) {
    return `.${extensionMatch[1]}`
  }

  return minioExtensionByMime.get(mimeType.toLowerCase()) ?? ''
}

const buildMinioObjectKey = (
  fileName: string,
  mimeType: string,
  mode: 'single' | 'multipart-temp' | 'multipart-final',
) => {
  const now = new Date()
  const year = String(now.getFullYear())
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const baseRaw = fileName.replace(/\.[^./\\]+$/, '')
  const baseName = normalizeUploadName(baseRaw).toLowerCase() || `media-${Date.now().toString(36)}`
  const compactBaseName = baseName.slice(0, 48)
  const extension = extractFileExtension(fileName, mimeType)
  const pathPrefix =
    mode === 'single'
      ? 'admin/live/single'
      : mode === 'multipart-temp'
        ? 'admin/tmp/multipart'
        : 'admin/live/multipart'
  const marker = mode.startsWith('multipart') ? 'multipart' : 'single'

  return `${pathPrefix}/${year}/${month}/${day}/${marker}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}-${compactBaseName}${extension}`
}

const buildFinalMultipartObjectKey = (sessionObjectKey: string, fileName: string, mimeType: string) => {
  const normalized = sessionObjectKey.trim()

  if (normalized.startsWith(minioTmpMultipartPrefix)) {
    return `${minioLiveMultipartPrefix}${normalized.slice(minioTmpMultipartPrefix.length)}`
  }

  return buildMinioObjectKey(fileName, mimeType, 'multipart-final')
}

const normalizeEtag = (value: string) => {
  return value.trim().replace(/^"+|"+$/g, '')
}

const readMultipartFieldValue = (field: unknown): string => {
  if (!field) {
    return ''
  }

  if (Array.isArray(field)) {
    return readMultipartFieldValue(field[0])
  }

  if (typeof field === 'object' && field !== null && 'value' in field) {
    const value = (field as { value?: unknown }).value

    if (typeof value === 'string') {
      return value.trim()
    }
  }

  return ''
}

const parseOptionalPositiveInt = (value: string, max: number) => {
  if (!value) {
    return undefined
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) {
    return undefined
  }

  return parsed
}

const isLocalUploadTooLargeError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false
  }

  const code = (error as { code?: unknown }).code
  return code === 'FST_REQ_FILE_TOO_LARGE'
}

const resolveMultipartSessionOrReply = async (
  request: FastifyRequest,
  reply: FastifyReply,
  sessionId: string,
  actorUserId: string,
) => {
  const resolved = await resolveMultipartUploadSession({
    sessionId,
    actorUserId,
  })

  if (resolved.status === 'ok') {
    return resolved.session
  }

  if (resolved.status === 'expired') {
    reply.status(410).send({
      code: 'MULTIPART_SESSION_EXPIRED',
      message: '分片会话已过期，请重新初始化上传',
      requestId: request.id,
    })
    return null
  }

  if (resolved.status === 'forbidden') {
    reply.status(403).send({
      code: 'FORBIDDEN',
      message: '无权访问该分片上传会话',
      requestId: request.id,
    })
    return null
  }

  reply.status(404).send({
    code: 'MULTIPART_SESSION_NOT_FOUND',
    message: '分片上传会话不存在',
    requestId: request.id,
  })
  return null
}

await mkdir(localMediaStorageRoot, { recursive: true })

const buildRecentTrend = () => {
  const today = new Date()

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))

    return {
      date: date.toISOString().slice(0, 10),
      pv: 0,
      uv: 0,
      publishedPosts: 0,
    }
  })
}

registerHealthRoutes(server, {
  runReadinessChecks,
  readinessCacheTtlMs: env.READINESS_CACHE_TTL_MS,
})

registerLocalMediaRoutes(server, {
  localMediaStorageRoot,
  localMediaMimeByExtension,
})

registerBlogRoutes(server, {
  ensureAccessClaims,
  ok,
})

registerAdminAuthRoutes(server, {
  ok,
})

registerAdminContentRoutes(server, {
  ensureAccessClaims,
  ok,
})

server.get('/api/admin/dashboard/overview', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, 'dashboard:read')

  if (!claims) {
    return
  }

  const bootstrap = await getBlogBootstrapData()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const metrics = readServiceMetrics()
  const trends = buildRecentTrend().map((item) => {
    const matchingPosts = bootstrap.posts.filter((post) => post.publishedAt === item.date)
    const pv = matchingPosts.reduce((sum, post) => sum + (post.views ?? 0), 0)
    const uv = Math.round(pv * 0.62)

    return {
      date: item.date,
      pv,
      uv,
      publishedPosts: matchingPosts.length,
    }
  })

  const topPosts = [...bootstrap.posts]
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 5)
    .map((post) => ({
      id: post.id,
      title: post.title,
      value: post.views ?? 0,
    }))

  const tagCount = new Map<string, number>()
  for (const post of bootstrap.posts) {
    for (const tag of post.tags) {
      const current = tagCount.get(tag) ?? 0
      tagCount.set(tag, current + 1)
    }
  }

  const topTags = [...tagCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([title, value], index) => ({
      id: `tag-${index + 1}`,
      title,
      value,
    }))

  const totalComments = Object.values(bootstrap.commentsByPost).reduce((sum, items) => sum + items.length, 0)

  return ok(request, {
    summary: {
      totalPosts: bootstrap.posts.length,
      totalViews: bootstrap.posts.reduce((sum, post) => sum + (post.views ?? 0), 0),
      totalComments,
      publishedToday: bootstrap.posts.filter((post) => post.publishedAt === today).length,
    },
    trends,
    topPosts,
    topTags,
    system: metrics,
  })
})

server.get('/api/admin/theme/revisions', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, 'theme:write')

  if (!claims) {
    return
  }

  const revisions = await getThemeRevisions()
  return ok(request, revisions)
})

server.post('/api/admin/theme/revisions', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, 'theme:write')

  if (!claims) {
    return
  }

  const input = adminCreateThemeRevisionInputSchema.parse(request.body ?? {})
  const revision = await createThemeRevision(input, claims.displayName)

  await addAuditLog({
    actorName: claims.displayName,
    action: 'theme.create_revision',
    targetType: 'theme',
    targetId: revision.id,
    summary: `创建主题版本 ${revision.name}`,
    ip: request.ip,
    requestId: request.id,
  })

  return ok(request, revision)
})

server.post('/api/admin/theme/revisions/:revisionId/activate', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, 'theme:write')

  if (!claims) {
    return
  }

  const revisionId = String((request.params as { revisionId?: string }).revisionId ?? '').trim()
  const revision = await activateThemeRevision(revisionId)

  if (!revision) {
    return reply.status(404).send({
      code: 'THEME_REVISION_NOT_FOUND',
      message: '主题版本不存在',
      requestId: request.id,
    })
  }

  await addAuditLog({
    actorName: claims.displayName,
    action: 'theme.activate',
    targetType: 'theme',
    targetId: revision.id,
    summary: `激活主题版本 ${revision.name}`,
    ip: request.ip,
    requestId: request.id,
  })

  return ok(request, revision)
})

server.get('/api/admin/audit-logs', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, 'audit:read')

  if (!claims) {
    return
  }

  const query = adminAuditLogQuerySchema.parse(request.query ?? {})
  const logs = await queryAuditLogs({
    keyword: query.keyword,
    action: query.action,
    targetType: query.targetType,
    limit: query.limit,
  })

  return ok(request, logs)
})

server.get('/api/admin/site/footer', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, 'site:read')

  if (!claims) {
    return
  }

  const bootstrap = await getBlogBootstrapData()
  return ok(request, bootstrap.footerInfo)
})

server.patch('/api/admin/site/footer', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, 'site:write')

  if (!claims) {
    return
  }

  const payload = siteFooterPatchSchema.parse(request.body ?? {})
  const nextFooter = await updateBlogSiteFooter(payload)

  await addAuditLog({
    actorName: claims.displayName,
    action: 'site.footer.update',
    targetType: 'site',
    targetId: 'footer',
    summary: '更新页脚配置',
    ip: request.ip,
    requestId: request.id,
  })

  return ok(request, nextFooter)
})

server.get('/api/admin/publish/history', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, 'publish:manage')

  if (!claims) {
    return
  }

  const history = await getPublishHistory()
  return ok(request, history)
})

server.post('/api/admin/publish/preview', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, 'publish:manage')

  if (!claims) {
    return
  }

  const input = adminPublishPreviewInputSchema.parse(request.body ?? {})
  const origin = String(request.headers.origin ?? env.CORS_ORIGIN)
  const preview = await createPublishPreview(input, origin)

  await addAuditLog({
    actorName: claims.displayName,
    action: 'publish.preview',
    targetType: 'publish',
    targetId: preview.token,
    summary: '创建发布预览链接',
    ip: request.ip,
    requestId: request.id,
  })

  return ok(request, preview)
})

server.post('/api/admin/publish/commit', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, 'publish:manage')

  if (!claims) {
    return
  }

  const input = adminCommitPublishInputSchema.parse(request.body ?? {})
  const record = await commitPublish(input, claims.displayName)

  await addAuditLog({
    actorName: claims.displayName,
    action: 'publish.commit',
    targetType: 'publish',
    targetId: record.id,
    summary: `发布版本 ${record.version}`,
    ip: request.ip,
    requestId: request.id,
  })

  return ok(request, record)
})

server.post('/api/admin/publish/rollback', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, 'publish:manage')

  if (!claims) {
    return
  }

  const input = adminRollbackPublishInputSchema.parse(request.body ?? {})
  const record = await rollbackPublish(input, claims.displayName)

  if (!record) {
    return reply.status(404).send({
      code: 'PUBLISH_RECORD_NOT_FOUND',
      message: '回滚目标不存在',
      requestId: request.id,
    })
  }

  await addAuditLog({
    actorName: claims.displayName,
    action: 'publish.rollback',
    targetType: 'publish',
    targetId: record.id,
    summary: `回滚到版本 ${record.version}`,
    ip: request.ip,
    requestId: request.id,
  })

  return ok(request, record)
})

server.get('/api/admin/media/list', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, 'media:write')

  if (!claims) {
    return
  }

  const query = adminMediaQuerySchema.parse(request.query ?? {})
  const list = await getMediaList(query)
  return ok(request, list)
})

server.post('/api/admin/media/upload', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, 'media:write')

  if (!claims) {
    return
  }

  const input = adminUploadMediaInputSchema.parse(request.body ?? {})
  const created = await uploadMedia(input, claims.displayName)

  await addAuditLog({
    actorName: claims.displayName,
    action: 'media.upload',
    targetType: 'media',
    targetId: created.id,
    summary: `上传资源 ${created.name}`,
    ip: request.ip,
    requestId: request.id,
  })

  return ok(request, created)
})

server.post('/api/admin/media/upload-signed-url', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, 'media:write')

  if (!claims) {
    return
  }

  const input = adminSignedUploadUrlInputSchema.parse(request.body ?? {})
  const objectKey = buildMinioObjectKey(input.name, input.mimeType, 'single')
  const uploadUrl = await minio.presignedPutObject(
    env.MINIO_BUCKET_PUBLIC,
    objectKey,
    minioSignedUploadExpiresSeconds,
  )
  const expiresAt = new Date(Date.now() + minioSignedUploadExpiresSeconds * 1_000).toISOString()
  const publicUrl = buildMinioPublicUrl(objectKey)

  await addAuditLog({
    actorName: claims.displayName,
    action: 'media.sign_upload',
    targetType: 'media',
    targetId: objectKey,
    summary: `生成签名上传链接 ${input.name}`,
    ip: request.ip,
    requestId: request.id,
  })

  return ok(request, {
    uploadUrl,
    objectKey,
    publicUrl,
    expiresAt,
  })
})

server.post('/api/admin/media/multipart/init', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, 'media:write')

  if (!claims) {
    return
  }

  const input = adminMultipartUploadInitInputSchema.parse(request.body ?? {})
  const partSize = Math.max(multipartMinPartSizeBytes, input.partSize ?? multipartDefaultPartSizeBytes)
  const totalParts = Math.ceil(input.size / partSize)

  if (totalParts > multipartMaxParts) {
    return reply.status(422).send({
      code: 'MULTIPART_TOO_MANY_PARTS',
      message: `分片数量超过上限 ${multipartMaxParts}，请增大 partSize`,
      requestId: request.id,
    })
  }

  if (input.totalParts !== undefined && input.totalParts !== totalParts) {
    return reply.status(422).send({
      code: 'MULTIPART_TOTAL_PARTS_MISMATCH',
      message: 'totalParts 与 size/partSize 计算结果不一致',
      details: {
        expected: totalParts,
      },
      requestId: request.id,
    })
  }

  const objectKey = buildMinioObjectKey(input.name, input.mimeType, 'multipart-temp')
  const uploadId = await minio.initiateNewMultipartUpload(env.MINIO_BUCKET_PUBLIC, objectKey, {
    'Content-Type': input.mimeType,
  })
  const expiresAt = new Date(Date.now() + multipartSessionExpiresSeconds * 1_000).toISOString()
  const session = await createMultipartUploadSession({
    uploadId,
    objectKey,
    name: input.name,
    mimeType: input.mimeType,
    size: input.size,
    width: input.width,
    height: input.height,
    partSize,
    totalParts,
    actorUserId: claims.sub,
    actorName: claims.displayName,
    expiresAt,
  })

  await addAuditLog({
    actorName: claims.displayName,
    action: 'media.multipart.init',
    targetType: 'media',
    targetId: session.id,
    summary: `初始化分片上传 ${input.name}（${totalParts} 片）`,
    ip: request.ip,
    requestId: request.id,
  })

  return ok(request, {
    sessionId: session.id,
    objectKey: session.objectKey,
    publicUrl: buildMinioPublicUrl(session.objectKey),
    partSize: session.partSize,
    totalParts: session.totalParts,
    expiresAt: session.expiresAt,
  })
})

server.post('/api/admin/media/multipart/presign-part', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, 'media:write')

  if (!claims) {
    return
  }

  const input = adminMultipartPresignPartInputSchema.parse(request.body ?? {})
  const session = await resolveMultipartSessionOrReply(request, reply, input.sessionId, claims.sub)

  if (!session) {
    return
  }

  if (input.partNumber > session.totalParts) {
    return reply.status(422).send({
      code: 'MULTIPART_PART_OUT_OF_RANGE',
      message: `partNumber 超出范围，最大为 ${session.totalParts}`,
      requestId: request.id,
    })
  }

  const uploadUrl = await minio.presignedUrl(
    'PUT',
    env.MINIO_BUCKET_PUBLIC,
    session.objectKey,
    minioSignedUploadExpiresSeconds,
    {
      partNumber: String(input.partNumber),
      uploadId: session.uploadId,
    },
  )
  const expiresAt = new Date(Date.now() + minioSignedUploadExpiresSeconds * 1_000).toISOString()

  return ok(request, {
    sessionId: session.id,
    partNumber: input.partNumber,
    uploadUrl,
    expiresAt,
  })
})

server.post('/api/admin/media/multipart/complete', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, 'media:write')

  if (!claims) {
    return
  }

  const input = adminMultipartCompleteInputSchema.parse(request.body ?? {})
  const session = await resolveMultipartSessionOrReply(request, reply, input.sessionId, claims.sub)

  if (!session) {
    return
  }

  const uniqueParts = new Map<number, string | undefined>()

  for (const item of input.parts) {
    if (item.partNumber > session.totalParts) {
      return reply.status(422).send({
        code: 'MULTIPART_PART_OUT_OF_RANGE',
        message: `partNumber 超出范围，最大为 ${session.totalParts}`,
        requestId: request.id,
      })
    }

    if (uniqueParts.has(item.partNumber)) {
      return reply.status(400).send({
        code: 'MULTIPART_PART_DUPLICATED',
        message: `partNumber ${item.partNumber} 重复提交`,
        requestId: request.id,
      })
    }

    uniqueParts.set(item.partNumber, item.etag ? normalizeEtag(item.etag) : undefined)
  }

  if (uniqueParts.size !== session.totalParts) {
    return reply.status(422).send({
      code: 'MULTIPART_PARTS_INCOMPLETE',
      message: `分片数量不完整，期望 ${session.totalParts} 片，实际 ${uniqueParts.size} 片`,
      requestId: request.id,
    })
  }

  const uploadedPartList = await (
    minio as unknown as {
      listParts?: (
        bucketName: string,
        objectName: string,
        uploadId: string,
      ) => Promise<Array<{ part?: number; etag?: string }>>
    }
  ).listParts?.(env.MINIO_BUCKET_PUBLIC, session.objectKey, session.uploadId)
  const uploadedPartMap = new Map<number, string>()

  for (const part of uploadedPartList ?? []) {
    if (typeof part.part !== 'number' || !part.etag) {
      continue
    }

    uploadedPartMap.set(part.part, normalizeEtag(part.etag))
  }

  const missingEtags: number[] = []
  const etagsForComplete = Array.from(uniqueParts.keys())
    .sort((a, b) => a - b)
    .map((partNumber) => {
      const directEtag = uniqueParts.get(partNumber)
      const etag = directEtag || uploadedPartMap.get(partNumber)

      if (!etag) {
        missingEtags.push(partNumber)
      }

      return {
        part: partNumber,
        etag,
      }
    })

  if (missingEtags.length > 0) {
    return reply.status(422).send({
      code: 'MULTIPART_ETAG_MISSING',
      message: '部分分片缺少 ETag，无法完成合并',
      details: {
        missingParts: missingEtags,
      },
      requestId: request.id,
    })
  }

  await minio.completeMultipartUpload(
    env.MINIO_BUCKET_PUBLIC,
    session.objectKey,
    session.uploadId,
    etagsForComplete,
  )

  let finalObjectKey = buildFinalMultipartObjectKey(session.objectKey, session.name, session.mimeType)

  if (finalObjectKey !== session.objectKey) {
    try {
      const copySource = `/${env.MINIO_BUCKET_PUBLIC}/${session.objectKey}`
      await (
        minio as unknown as {
          copyObject: (
            bucketName: string,
            objectName: string,
            sourceObject: string,
            conditions?: Record<string, string>,
          ) => Promise<unknown>
        }
      ).copyObject(env.MINIO_BUCKET_PUBLIC, finalObjectKey, copySource)

      try {
        await minio.removeObject(env.MINIO_BUCKET_PUBLIC, session.objectKey)
      } catch {
        // ignore cleanup errors; orphan sweeper and lifecycle policy will reconcile leftovers
      }
    } catch {
      // fallback to temporary object path to avoid breaking upload completion flow
      finalObjectKey = session.objectKey
    }
  }

  const created = await uploadMedia(
    {
      name: session.name,
      url: buildMinioPublicUrl(finalObjectKey),
      mimeType: session.mimeType,
      size: session.size,
      width: session.width,
      height: session.height,
    },
    claims.displayName,
  )
  await removeMultipartUploadSession(session.id)

  await addAuditLog({
    actorName: claims.displayName,
    action: 'media.multipart.complete',
    targetType: 'media',
    targetId: created.id,
    summary: `完成分片上传 ${created.name}`,
    ip: request.ip,
    requestId: request.id,
  })

  return ok(request, created)
})

server.post('/api/admin/media/multipart/abort', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, 'media:write')

  if (!claims) {
    return
  }

  const input = adminMultipartAbortInputSchema.parse(request.body ?? {})
  const session = await resolveMultipartSessionOrReply(request, reply, input.sessionId, claims.sub)

  if (!session) {
    return
  }

  try {
    await minio.abortMultipartUpload(env.MINIO_BUCKET_PUBLIC, session.objectKey, session.uploadId)
  } catch {
    // ignore abort errors to keep endpoint idempotent
  }

  await removeMultipartUploadSession(session.id)

  await addAuditLog({
    actorName: claims.displayName,
    action: 'media.multipart.abort',
    targetType: 'media',
    targetId: session.id,
    summary: `取消分片上传 ${session.name}`,
    ip: request.ip,
    requestId: request.id,
  })

  return ok(request, {
    sessionId: session.id,
    aborted: true,
  })
})

server.post('/api/admin/media/upload-local', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, 'media:write')

  if (!claims) {
    return
  }

  if (!request.isMultipart()) {
    return reply.status(415).send({
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: '请求必须为 multipart/form-data',
      requestId: request.id,
    })
  }

  const part = await request.file({
    limits: {
      files: 1,
      fileSize: env.MEDIA_LOCAL_MAX_SIZE_BYTES,
    },
  })

  if (!part) {
    return reply.status(400).send({
      code: 'MEDIA_FILE_REQUIRED',
      message: '请上传图片文件',
      requestId: request.id,
    })
  }

  const mimeType = String(part.mimetype ?? '').trim().toLowerCase()
  const extension = localMediaExtensionByMime.get(mimeType)

  if (!extension) {
    part.file.resume()
    return reply.status(415).send({
      code: 'MEDIA_TYPE_NOT_ALLOWED',
      message: '仅支持 jpg、png、webp、gif、svg、avif 图片',
      requestId: request.id,
    })
  }

  let buffer: Buffer

  try {
    buffer = await part.toBuffer()
  } catch (error) {
    if (isLocalUploadTooLargeError(error)) {
      return reply.status(413).send({
        code: 'MEDIA_FILE_TOO_LARGE',
        message: `图片大小不能超过 ${env.MEDIA_LOCAL_MAX_SIZE_BYTES} 字节`,
        requestId: request.id,
      })
    }

    throw error
  }

  if (buffer.length === 0) {
    return reply.status(400).send({
      code: 'MEDIA_FILE_EMPTY',
      message: '上传文件为空',
      requestId: request.id,
    })
  }

  if (buffer.length > env.MEDIA_LOCAL_MAX_SIZE_BYTES) {
    return reply.status(413).send({
      code: 'MEDIA_FILE_TOO_LARGE',
      message: `图片大小不能超过 ${env.MEDIA_LOCAL_MAX_SIZE_BYTES} 字节`,
      requestId: request.id,
    })
  }

  const fieldName = readMultipartFieldValue(part.fields.name)
  const requestedName = normalizeUploadName(fieldName)
  const fileNameBase = normalizeUploadName(part.filename ? part.filename.replace(/\.[^./\\]+$/, '') : '')
  const safeName = requestedName || fileNameBase || `image-${Date.now().toString(36)}`
  const savedFileName = `local-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}${extension}`
  const outputPath = resolve(localMediaStorageRoot, savedFileName)

  await writeFile(outputPath, buffer, { flag: 'wx' })

  const width = parseOptionalPositiveInt(readMultipartFieldValue(part.fields.width), 20_000)
  const height = parseOptionalPositiveInt(readMultipartFieldValue(part.fields.height), 20_000)

  const created = await uploadMedia(
    {
      name: safeName,
      url: `/api/media/local/${savedFileName}`,
      mimeType,
      size: buffer.length,
      width,
      height,
    },
    claims.displayName,
  )

  await addAuditLog({
    actorName: claims.displayName,
    action: 'media.upload',
    targetType: 'media',
    targetId: created.id,
    summary: `上传本地图片 ${created.name}`,
    ip: request.ip,
    requestId: request.id,
  })

  return ok(request, created)
})

server.delete('/api/admin/media/:mediaId', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, 'media:write')

  if (!claims) {
    return
  }

  const mediaId = String((request.params as { mediaId?: string }).mediaId ?? '').trim()

  if (!mediaId) {
    return reply.status(400).send({
      code: 'VALIDATION_ERROR',
      message: 'mediaId is required',
      requestId: request.id,
    })
  }

  const input = adminDeleteMediaInputSchema.parse(request.body ?? {})
  const result = await deleteMedia({
    mediaId,
    actorName: claims.displayName,
    force: Boolean(input.force),
    reason: input.reason,
  })

  if (result.status === 'not_found') {
    return reply.status(404).send({
      code: 'MEDIA_NOT_FOUND',
      message: '媒体资源不存在',
      requestId: request.id,
    })
  }

  if (result.status === 'in_use') {
    return reply.status(409).send({
      code: 'MEDIA_IN_USE',
      message: '媒体资源仍被引用，请先移除引用或使用 force 删除',
      details: {
        mediaId: result.item.id,
        usageCount: result.references.length,
        references: result.references,
      },
      requestId: request.id,
    })
  }

  await addAuditLog({
    actorName: claims.displayName,
    action: 'media.delete',
    targetType: 'media',
    targetId: result.item.id,
    summary: result.forced ? `强制删除媒体 ${result.item.name}` : `删除媒体 ${result.item.name}`,
    ip: request.ip,
    requestId: request.id,
  })

  return ok(request, {
    id: result.item.id,
    deletedAt: result.item.deletedAt,
    forced: result.forced,
    usageCount: result.references.length,
  })
})

server.post('/api/admin/media/cleanup-orphans', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, 'media:write')

  if (!claims) {
    return
  }

  const input = adminCleanupMediaInputSchema.parse(request.body ?? {})
  const report = await cleanupMediaOrphans({
    dryRun: input.dryRun,
    localMediaStorageRoot,
  })

  await addAuditLog({
    actorName: claims.displayName,
    action: 'media.cleanup',
    targetType: 'media',
    targetId: `cleanup-${Date.now().toString(36)}`,
    summary: input.dryRun
      ? `预演孤儿媒体清理，文件 ${report.orphanLocalFilesDetected} 个，对象 ${(report.orphanMinioObjectsDetected ?? 0)} 个`
      : `执行孤儿媒体清理，移除记录 ${report.removedMetadataRecords} 条`,
    ip: request.ip,
    requestId: request.id,
  })

  return ok(request, report)
})

server.get('/api/admin/access/snapshot', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, '*')

  if (!claims) {
    return
  }

  const snapshot = await getAccessSnapshot()
  return ok(request, snapshot)
})

server.patch('/api/admin/access/users', async (request, reply) => {
  const claims = await ensureAccessClaims(request, reply, '*')

  if (!claims) {
    return
  }

  const input = adminUpdateUserAccessInputSchema.parse(request.body ?? {})
  const result = await updateUserAccess(input)

  if (!result) {
    return reply.status(404).send({
      code: 'USER_NOT_FOUND',
      message: '用户不存在',
      requestId: request.id,
    })
  }

  if ('errorCode' in result) {
    return reply.status(422).send({
      code: result.errorCode,
      message: '至少需要保留一个可用管理员账号',
      requestId: request.id,
    })
  }

  await addAuditLog({
    actorName: claims.displayName,
    action: 'access.update_user',
    targetType: 'auth',
    targetId: input.userId,
    summary: `更新用户权限 ${input.userId}`,
    ip: request.ip,
    requestId: request.id,
  })

  return ok(request, result.snapshot)
})

const start = async () => {
  try {
    await server.listen({
      host: '0.0.0.0',
      port: env.PORT,
    })
  } catch (error) {
    server.log.error(error)
    process.exit(1)
  }
}

const shutdown = async (signal: NodeJS.Signals) => {
  server.log.info({ signal }, 'Shutting down server')

  await server.close()
  await pgPool.end()

  if (redis.status !== 'end') {
    await redis.quit()
  }

  process.exit(0)
}

process.on('SIGINT', () => {
  void shutdown('SIGINT')
})

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})

await start()
