import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

import { env } from '../../config/env.js'
import { pgPool } from '../../db/client.js'
import { redis } from '../../infra/redis/client.js'
import { parseDurationToMs } from '../../utils/parse-duration.js'
import { sanitizePlainText } from '../../utils/sanitize.js'

type AdminRoleCode = 'admin' | 'editor' | 'operator' | 'viewer'

const validRoles: readonly AdminRoleCode[] = ['admin', 'editor', 'operator', 'viewer']
const refreshRedisKeyPrefix = 'auth:refresh:'
const auditRecentRedisKey = 'audit:recent:v1'
const refreshSessionTtlMs = parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN)
const refreshSessionTtlSeconds = Math.max(1, Math.ceil(refreshSessionTtlMs / 1_000))

let adminStorageReady = false

const isAdminRole = (value: string): value is AdminRoleCode =>
  validRoles.includes(value as AdminRoleCode)

const parseCsvValues = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const parseRoleArray = (value: unknown): AdminRoleCode[] => {
  if (!Array.isArray(value)) {
    return ['viewer']
  }

  const parsed = value.filter((item): item is AdminRoleCode => {
    return typeof item === 'string' && isAdminRole(item)
  })

  return parsed.length > 0 ? parsed : ['viewer']
}

const parsePermissionArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const parsed = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)

  return Array.from(new Set(parsed))
}

const parsedRoles = parseCsvValues(env.ADMIN_BOOTSTRAP_ROLES).filter(isAdminRole)
const parsedPermissions = parseCsvValues(env.ADMIN_BOOTSTRAP_PERMISSIONS)

export interface AdminUser {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  roles: AdminRoleCode[]
  permissions: string[]
}

export interface AdminAuthClaims {
  sub: string
  email: string
  displayName: string
  roles: AdminRoleCode[]
  permissions: string[]
  tokenType: 'access'
}

export interface AdminAuditLogEntry {
  id: string
  actorName: string
  action: string
  targetType: string
  targetId: string
  summary: string
  createdAt: string
  ip: string
  requestId: string
}

export interface SiteFooterInfo {
  icp: string
  icpLink?: string
  icpLocked?: boolean
  runtime: string
  runtimeMode?: 'manual' | 'auto'
  runtimeStartedAt?: string
  poweredBy: string
  copyright: string
}

const bootstrapUser: AdminUser = {
  id: 'bootstrap-admin',
  email: env.ADMIN_BOOTSTRAP_EMAIL.trim().toLowerCase(),
  displayName: env.ADMIN_BOOTSTRAP_DISPLAY_NAME.trim(),
  avatarUrl: '/avatar.svg',
  roles: parsedRoles.length > 0 ? parsedRoles : ['admin'],
  permissions: parsedPermissions.length > 0 ? parsedPermissions : ['dashboard:read'],
}

if (env.NODE_ENV === 'production' && env.ADMIN_BOOTSTRAP_PASSWORD === 'change-me-please') {
  throw new Error('ADMIN_BOOTSTRAP_PASSWORD must be overridden in production')
}

const bootstrapPasswordHash = createHash('sha256')
  .update(env.ADMIN_BOOTSTRAP_PASSWORD, 'utf8')
  .digest()

const siteFooterState: SiteFooterInfo = {
  icp: '',
  icpLink: 'https://beian.miit.gov.cn/',
  icpLocked: true,
  runtime: '本站运行中',
  runtimeMode: 'auto',
  runtimeStartedAt: new Date().toISOString(),
  poweredBy: 'Powered By',
  copyright: `© ${new Date().getFullYear()}`,
}

const clone = <T>(value: T): T => {
  return globalThis.structuredClone(value)
}

const hashRefreshToken = (refreshToken: string) =>
  createHmac('sha256', env.JWT_REFRESH_SECRET).update(refreshToken).digest('hex')

const compareDigest = (input: string, expected: Buffer) => {
  const inputDigest = createHash('sha256').update(input, 'utf8').digest()

  if (inputDigest.length !== expected.length) {
    return false
  }

  return timingSafeEqual(inputDigest, expected)
}

const normalizeAuditLog = (input: Omit<AdminAuditLogEntry, 'id' | 'createdAt'>) => {
  return {
    actorName: sanitizePlainText(input.actorName, { maxLength: 80, allowNewlines: false }),
    action: sanitizePlainText(input.action, { maxLength: 80, allowNewlines: false }),
    targetType: sanitizePlainText(input.targetType, { maxLength: 80, allowNewlines: false }),
    targetId: sanitizePlainText(input.targetId, { maxLength: 120, allowNewlines: false }),
    summary: sanitizePlainText(input.summary, { maxLength: 300, allowNewlines: false }),
    ip: sanitizePlainText(input.ip, { maxLength: 64, allowNewlines: false }),
    requestId: sanitizePlainText(input.requestId, { maxLength: 80, allowNewlines: false }),
  }
}

const sanitizeAuditLimit = (limit: number) => {
  return Math.max(1, Math.min(100, limit))
}

const toRedisRefreshKey = (tokenHash: string) => `${refreshRedisKeyPrefix}${tokenHash}`

export const ensureAdminPersistence = async () => {
  if (adminStorageReady) {
    return
  }

  await pgPool.query(`
    create table if not exists admin_refresh_sessions (
      token_hash varchar(128) primary key,
      user_id varchar(64) not null,
      email varchar(120) not null,
      display_name varchar(120) not null,
      avatar_url varchar(255),
      roles jsonb not null,
      permissions jsonb not null,
      ip varchar(64) not null,
      user_agent varchar(255) not null,
      created_at timestamptz not null,
      expires_at timestamptz not null
    )
  `)

  await pgPool.query(`
    create index if not exists idx_admin_refresh_sessions_expires_at
    on admin_refresh_sessions (expires_at)
  `)

  await pgPool.query(`
    create table if not exists admin_audit_logs (
      id varchar(64) primary key,
      actor_name varchar(120) not null,
      action varchar(120) not null,
      target_type varchar(120) not null,
      target_id varchar(180) not null,
      summary varchar(600) not null,
      ip varchar(64) not null,
      request_id varchar(120) not null,
      created_at timestamptz not null default now()
    )
  `)

  await pgPool.query(`
    create index if not exists idx_admin_audit_logs_created_at
    on admin_audit_logs (created_at desc)
  `)

  await pgPool.query(`
    create index if not exists idx_admin_audit_logs_action_target
    on admin_audit_logs (action, target_type)
  `)

  adminStorageReady = true
}

export const toAccessClaims = (user: AdminUser): AdminAuthClaims => {
  return {
    sub: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: [...user.roles],
    permissions: [...user.permissions],
    tokenType: 'access',
  }
}

export const verifyBootstrapCredentials = (email: string, password: string): AdminUser | null => {
  const normalizedEmail = email.trim().toLowerCase()

  if (normalizedEmail !== bootstrapUser.email) {
    return null
  }

  if (!compareDigest(password, bootstrapPasswordHash)) {
    return null
  }

  return clone(bootstrapUser)
}

export const issueRefreshToken = async (
  user: AdminUser,
  context: { ip: string; userAgent: string },
) => {
  await ensureAdminPersistence()

  const createdAt = Date.now()
  const expiresAt = createdAt + refreshSessionTtlMs
  const refreshToken = `${randomUUID()}.${randomUUID()}`
  const tokenHash = hashRefreshToken(refreshToken)
  const createdAtIso = new Date(createdAt).toISOString()
  const expiresAtIso = new Date(expiresAt).toISOString()

  await pgPool.query(
    `
      insert into admin_refresh_sessions (
        token_hash,
        user_id,
        email,
        display_name,
        avatar_url,
        roles,
        permissions,
        ip,
        user_agent,
        created_at,
        expires_at
      ) values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::jsonb,
        $7::jsonb,
        $8,
        $9,
        $10::timestamptz,
        $11::timestamptz
      )
      on conflict (token_hash) do update set
        user_id = excluded.user_id,
        email = excluded.email,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        roles = excluded.roles,
        permissions = excluded.permissions,
        ip = excluded.ip,
        user_agent = excluded.user_agent,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at
    `,
    [
      tokenHash,
      user.id,
      user.email,
      user.displayName,
      user.avatarUrl ?? null,
      JSON.stringify(user.roles),
      JSON.stringify(user.permissions),
      sanitizePlainText(context.ip, { maxLength: 64, allowNewlines: false }),
      sanitizePlainText(context.userAgent, { maxLength: 255, allowNewlines: false }),
      createdAtIso,
      expiresAtIso,
    ],
  )

  await redis.set(toRedisRefreshKey(tokenHash), '1', 'EX', refreshSessionTtlSeconds)

  // Keep table compact under high auth churn.
  await pgPool.query(
    'delete from admin_refresh_sessions where expires_at < now() - interval \'5 minutes\'',
  )

  return {
    refreshToken,
    expiresAt,
  }
}

export const rotateRefreshToken = async (refreshToken: string): Promise<AdminUser | null> => {
  await ensureAdminPersistence()

  const tokenHash = hashRefreshToken(refreshToken.trim())
  const redisKey = toRedisRefreshKey(tokenHash)

  const inRedis = await redis.get(redisKey)
  if (!inRedis) {
    // Fallback to DB in case Redis data has expired unexpectedly.
    const fallback = await pgPool.query<{
      user_id: string
      email: string
      display_name: string
      avatar_url: string | null
      roles: unknown
      permissions: unknown
      expires_at: string | Date
    }>(
      `
        select user_id, email, display_name, avatar_url, roles, permissions, expires_at
        from admin_refresh_sessions
        where token_hash = $1
        limit 1
      `,
      [tokenHash],
    )

    if (fallback.rowCount === 0) {
      return null
    }
  }

  const result = await pgPool.query<{
    user_id: string
    email: string
    display_name: string
    avatar_url: string | null
    roles: unknown
    permissions: unknown
    expires_at: string | Date
  }>(
    `
      delete from admin_refresh_sessions
      where token_hash = $1
      returning user_id, email, display_name, avatar_url, roles, permissions, expires_at
    `,
    [tokenHash],
  )

  await redis.del(redisKey)

  const row = result.rows[0]
  if (!row) {
    return null
  }

  const expiresAtMs = new Date(row.expires_at).getTime()
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return null
  }

  return {
    id: row.user_id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? undefined,
    roles: parseRoleArray(row.roles),
    permissions: parsePermissionArray(row.permissions),
  }
}

export const revokeRefreshToken = async (refreshToken: string) => {
  await ensureAdminPersistence()

  const tokenHash = hashRefreshToken(refreshToken.trim())
  const redisKey = toRedisRefreshKey(tokenHash)

  const result = await pgPool.query(
    `
      delete from admin_refresh_sessions
      where token_hash = $1
    `,
    [tokenHash],
  )

  await redis.del(redisKey)
  return (result.rowCount ?? 0) > 0
}

export const hasPermission = (claims: Pick<AdminAuthClaims, 'permissions'>, required: string) => {
  return claims.permissions.includes('*') || claims.permissions.includes(required)
}

export const addAuditLog = async (
  input: Omit<AdminAuditLogEntry, 'id' | 'createdAt' | 'summary'> & { summary: string },
) => {
  await ensureAdminPersistence()

  const timestamp = Date.now()
  const id = `log-${timestamp}-${Math.random().toString(36).slice(2, 8)}`
  const createdAt = new Date(timestamp).toISOString()
  const normalized = normalizeAuditLog(input)

  const entry: AdminAuditLogEntry = {
    id,
    createdAt,
    ...normalized,
  }

  await pgPool.query(
    `
      insert into admin_audit_logs (
        id,
        actor_name,
        action,
        target_type,
        target_id,
        summary,
        ip,
        request_id,
        created_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz
      )
    `,
    [
      entry.id,
      entry.actorName,
      entry.action,
      entry.targetType,
      entry.targetId,
      entry.summary,
      entry.ip,
      entry.requestId,
      entry.createdAt,
    ],
  )

  await redis
    .multi()
    .lpush(auditRecentRedisKey, JSON.stringify(entry))
    .ltrim(auditRecentRedisKey, 0, env.ADMIN_AUDIT_LOG_LIMIT - 1)
    .exec()

  return entry
}

export const queryAuditLogs = async (query: {
  keyword?: string
  action?: string
  targetType?: string
  limit: number
}) => {
  await ensureAdminPersistence()

  const limit = sanitizeAuditLimit(query.limit)
  const keyword = query.keyword?.trim().toLowerCase()
  const action = query.action?.trim().toLowerCase()
  const targetType = query.targetType?.trim().toLowerCase()
  const hasFilters = Boolean(keyword || action || targetType)

  if (!hasFilters) {
    const cached = await redis.lrange(auditRecentRedisKey, 0, limit - 1)

    if (cached.length > 0) {
      const parsed = cached
        .map((item) => {
          try {
            return JSON.parse(item) as AdminAuditLogEntry
          } catch {
            return null
          }
        })
        .filter((item): item is AdminAuditLogEntry => Boolean(item))

      if (parsed.length > 0) {
        return parsed
      }
    }
  }

  const params: unknown[] = []
  const where: string[] = []

  if (action) {
    params.push(action)
    where.push(`lower(action) = $${params.length}`)
  }

  if (targetType) {
    params.push(targetType)
    where.push(`lower(target_type) = $${params.length}`)
  }

  if (keyword) {
    params.push(`%${keyword}%`)
    where.push(
      `(lower(actor_name) like $${params.length} or lower(summary) like $${params.length} or lower(target_id) like $${params.length})`,
    )
  }

  params.push(limit)
  const sql = `
    select
      id,
      actor_name,
      action,
      target_type,
      target_id,
      summary,
      ip,
      request_id,
      created_at
    from admin_audit_logs
    ${where.length > 0 ? `where ${where.join(' and ')}` : ''}
    order by created_at desc
    limit $${params.length}
  `

  const result = await pgPool.query<{
    id: string
    actor_name: string
    action: string
    target_type: string
    target_id: string
    summary: string
    ip: string
    request_id: string
    created_at: string | Date
  }>(sql, params)

  const logs = result.rows.map((row) => ({
    id: row.id,
    actorName: row.actor_name,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    summary: row.summary,
    ip: row.ip,
    requestId: row.request_id,
    createdAt: new Date(row.created_at).toISOString(),
  }))

  if (!hasFilters && logs.length > 0) {
    const pipeline = redis.multi()

    pipeline.del(auditRecentRedisKey)
    for (const item of logs) {
      pipeline.rpush(auditRecentRedisKey, JSON.stringify(item))
    }
    pipeline.ltrim(auditRecentRedisKey, 0, env.ADMIN_AUDIT_LOG_LIMIT - 1)

    await pipeline.exec()
  }

  return logs
}

export const readSiteFooter = () => clone(siteFooterState)

export const patchSiteFooter = (input: Partial<SiteFooterInfo>) => {
  if (input.icp !== undefined) {
    siteFooterState.icp = sanitizePlainText(input.icp, { maxLength: 120, allowNewlines: false })
  }

  if (input.icpLink !== undefined) {
    siteFooterState.icpLink = sanitizePlainText(input.icpLink, {
      maxLength: 240,
      allowNewlines: false,
    })
  }

  if (input.icpLocked !== undefined) {
    siteFooterState.icpLocked = input.icpLocked
  }

  if (input.runtime !== undefined) {
    siteFooterState.runtime = sanitizePlainText(input.runtime, { maxLength: 240 })
  }

  if (input.runtimeMode !== undefined) {
    siteFooterState.runtimeMode = input.runtimeMode
  }

  if (input.runtimeStartedAt !== undefined) {
    siteFooterState.runtimeStartedAt = sanitizePlainText(input.runtimeStartedAt, {
      maxLength: 60,
      allowNewlines: false,
    })
  }

  if (input.poweredBy !== undefined) {
    siteFooterState.poweredBy = sanitizePlainText(input.poweredBy, {
      maxLength: 80,
      allowNewlines: false,
    })
  }

  if (input.copyright !== undefined) {
    siteFooterState.copyright = sanitizePlainText(input.copyright, {
      maxLength: 80,
      allowNewlines: false,
    })
  }

  return clone(siteFooterState)
}
