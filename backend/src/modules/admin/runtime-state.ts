import { randomUUID } from 'node:crypto'
import { readdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

import { env } from '../../config/env.js'
import { pgPool } from '../../db/client.js'
import { minio } from '../../infra/minio/client.js'
import { redis } from '../../infra/redis/client.js'
import { sanitizePlainText } from '../../utils/sanitize.js'
import { getBlogBootstrapData } from '../blog/state.js'

type AdminRoleCode = 'admin' | 'editor' | 'operator' | 'viewer'

interface AdminThemeTokens {
  brand: string
  brandStrong: string
  accent: string
  bgMain: string
  ink: string
  surfaceGlass: string
  line: string
}

interface AdminThemeRevision {
  id: string
  name: string
  tokens: AdminThemeTokens
  isActive: boolean
  createdAt: string
  createdBy: string
}

interface AdminPublishSummary {
  posts: number
  comments: number
  links: number
}

interface AdminPublishRecord {
  id: string
  version: string
  source: 'publish' | 'rollback'
  note: string
  createdAt: string
  actorName: string
  summary: AdminPublishSummary
}

interface AdminPublishPreviewPayload {
  previewUrl: string
  token: string
  expiresAt: string
}

interface AdminMediaItem {
  id: string
  name: string
  url: string
  mimeType: string
  size: number
  width?: number
  height?: number
  uploadedAt: string
  uploadedBy: string
  deletedAt?: string
  deletedBy?: string
  deletedReason?: string
  usageCount?: number
  inUse?: boolean
}

interface AdminMediaReference {
  kind: 'post-image' | 'profile-avatar'
  targetId: string
  targetLabel: string
}

interface AdminMultipartUploadSession {
  id: string
  uploadId: string
  objectKey: string
  name: string
  mimeType: string
  size: number
  width?: number
  height?: number
  partSize: number
  totalParts: number
  actorUserId: string
  actorName: string
  createdAt: string
  expiresAt: string
}

interface AdminAccessUser {
  id: string
  email: string
  displayName: string
  roles: AdminRoleCode[]
  permissions: string[]
  disabled?: boolean
  updatedAt: string
}

interface AdminAccessSnapshot {
  users: AdminAccessUser[]
  rolePermissions: Record<AdminRoleCode, string[]>
  availablePermissions: string[]
}

interface AdminRuntimeSnapshot {
  themeRevisions: AdminThemeRevision[]
  publishHistory: AdminPublishRecord[]
  mediaList: AdminMediaItem[]
  multipartUploadSessions: AdminMultipartUploadSession[]
  accessSnapshot: AdminAccessSnapshot
}

interface CreateThemeRevisionInput {
  name: string
  tokens: AdminThemeTokens
}

interface CommitPublishInput {
  version: string
  note: string
}

interface RollbackPublishInput {
  targetRecordId: string
  reason: string
}

interface CreatePublishPreviewInput {
  expiresInMinutes?: number
}

interface MediaQuery {
  keyword?: string
  mimeType?: string
  limit: number
}

interface UploadMediaInput {
  name: string
  url: string
  mimeType: string
  size: number
  width?: number
  height?: number
}

interface DeleteMediaInput {
  mediaId: string
  actorName: string
  force: boolean
  reason?: string
}

interface CleanupMediaInput {
  dryRun: boolean
  localMediaStorageRoot: string
}

interface CleanupFailure {
  mediaId?: string
  fileName?: string
  objectKey?: string
  reason: string
}

interface CleanupMediaReport {
  dryRun: boolean
  processedDeletedRecords: number
  removedMetadataRecords: number
  removedLocalFiles: number
  removedMinioObjects: number
  orphanLocalFilesDetected: number
  orphanLocalFilesRemoved: number
  orphanMinioObjectsDetected: number
  orphanMinioObjectsRemoved: number
  orphanMultipartUploadsDetected: number
  orphanMultipartUploadsAborted: number
  failures: CleanupFailure[]
}

interface CreateMultipartUploadSessionInput {
  uploadId: string
  objectKey: string
  name: string
  mimeType: string
  size: number
  width?: number
  height?: number
  partSize: number
  totalParts: number
  actorUserId: string
  actorName: string
  expiresAt: string
}

interface ResolveMultipartUploadSessionInput {
  sessionId: string
  actorUserId: string
}

type ResolveMultipartUploadSessionResult =
  | {
      status: 'ok'
      session: AdminMultipartUploadSession
    }
  | {
      status: 'not_found'
    }
  | {
      status: 'forbidden'
    }
  | {
      status: 'expired'
    }

type DeleteMediaResult =
  | {
      status: 'not_found'
    }
  | {
      status: 'in_use'
      item: AdminMediaItem
      references: AdminMediaReference[]
    }
  | {
      status: 'deleted'
      item: AdminMediaItem
      references: AdminMediaReference[]
      forced: boolean
    }

interface UpdateUserAccessInput {
  userId: string
  roles: AdminRoleCode[]
  permissions: string[]
  disabled: boolean
}

interface AdminMediaRow {
  id: string
  name: string
  url: string
  mime_type: string
  size: string | number
  width: number | null
  height: number | null
  uploaded_at: string | Date
  uploaded_by: string
  deleted_at: string | Date | null
  deleted_by: string | null
  deleted_reason: string | null
}

interface AdminMultipartSessionRow {
  id: string
  upload_id: string
  object_key: string
  name: string
  mime_type: string
  size: string | number
  width: number | null
  height: number | null
  part_size: number
  total_parts: number
  actor_user_id: string
  actor_name: string
  created_at: string | Date
  expires_at: string | Date
}

interface AdminThemeRevisionRow {
  id: string
  name: string
  tokens: unknown
  is_active: boolean
  created_at: string | Date
  created_by: string
}

interface AdminPublishRecordRow {
  id: string
  version: string
  source: string
  note: string
  created_at: string | Date
  actor_name: string
  summary: unknown
}

interface AdminAccessUserRow {
  id: string
  email: string
  display_name: string
  roles: unknown
  permissions: unknown
  disabled: boolean
  updated_at: string | Date
}

interface AdminAccessStateRow {
  role_permissions: unknown
  available_permissions: unknown
}

const runtimeSnapshotId = 1
const runtimeSnapshotRedisKey = 'admin:runtime:snapshot:v1'
let runtimeReady = false
const localMediaUrlPrefix = '/api/media/local/'
const localMediaFileNamePattern = /^[a-z0-9][a-z0-9._-]{5,120}$/i
const maxMultipartUploadSessions = 400
const minioManagedPrefix = 'admin/'
const mediaAssetTableName = 'admin_media_assets'
const multipartSessionTableName = 'admin_multipart_upload_sessions'
const themeRevisionTableName = 'admin_theme_revisions'
const publishRecordTableName = 'admin_publish_records'
const accessUserTableName = 'admin_access_users'
const accessStateTableName = 'admin_access_state'
const defaultThemeTokens: AdminThemeTokens = {
  brand: '#0f8f95',
  brandStrong: '#0d5e7f',
  accent: '#ff7a46',
  bgMain: '#edf2f7',
  ink: '#1d2a3d',
  surfaceGlass: 'rgba(255, 255, 255, 0.74)',
  line: 'rgba(51, 86, 117, 0.18)',
}
const defaultRolePermissions: Record<AdminRoleCode, string[]> = {
  admin: ['*'],
  editor: ['post:read', 'post:write', 'comment:moderate', 'site:read'],
  operator: ['dashboard:read', 'comment:moderate', 'audit:read'],
  viewer: ['dashboard:read'],
}
const defaultAvailablePermissions = [
  'dashboard:read',
  'post:read',
  'post:write',
  'site:read',
  'site:write',
  'comment:moderate',
  'theme:write',
  'audit:read',
  'publish:manage',
  'media:write',
  'access:write',
  '*',
]

const nowIso = () => new Date().toISOString()

const normalizePermissions = (permissions: string[]) => {
  return Array.from(
    new Set(
      permissions
        .map((item) => sanitizePlainText(item, { maxLength: 80, allowNewlines: false }))
        .filter(Boolean),
    ),
  )
}

const normalizeRoles = (roles: AdminRoleCode[]) => {
  const unique = Array.from(new Set(roles))
  return unique.length > 0 ? unique : (['viewer'] as AdminRoleCode[])
}

const parseRolesFromUnknown = (value: unknown) => {
  if (!Array.isArray(value)) {
    return ['viewer'] as AdminRoleCode[]
  }

  const parsed: AdminRoleCode[] = []

  for (const item of value) {
    if (typeof item !== 'string') {
      continue
    }

    const normalized = item.trim().toLowerCase()

    if (
      normalized === 'admin' ||
      normalized === 'editor' ||
      normalized === 'operator' ||
      normalized === 'viewer'
    ) {
      parsed.push(normalized)
    }
  }

  return normalizeRoles(parsed)
}

const parsePermissionsFromUnknown = (value: unknown, fallback: string[] = []) => {
  if (!Array.isArray(value)) {
    return fallback.length > 0 ? normalizePermissions(fallback) : []
  }

  const parsed = normalizePermissions(
    value.filter((item): item is string => typeof item === 'string'),
  )

  if (parsed.length > 0) {
    return parsed
  }

  return fallback.length > 0 ? normalizePermissions(fallback) : []
}

const clone = <T>(value: T): T => globalThis.structuredClone(value)

const sanitizeThemeTokens = (value: unknown, fallback: AdminThemeTokens): AdminThemeTokens => {
  const raw = value && typeof value === 'object' ? (value as Partial<Record<keyof AdminThemeTokens, unknown>>) : {}

  const readToken = (
    key: keyof AdminThemeTokens,
    maxLength: number,
    fallbackValue: string,
  ) => {
    if (typeof raw[key] !== 'string') {
      return fallbackValue
    }

    const sanitized = sanitizePlainText(raw[key], {
      maxLength,
      allowNewlines: false,
    })

    return sanitized || fallbackValue
  }

  return {
    brand: readToken('brand', 60, fallback.brand),
    brandStrong: readToken('brandStrong', 60, fallback.brandStrong),
    accent: readToken('accent', 60, fallback.accent),
    bgMain: readToken('bgMain', 60, fallback.bgMain),
    ink: readToken('ink', 60, fallback.ink),
    surfaceGlass: readToken('surfaceGlass', 120, fallback.surfaceGlass),
    line: readToken('line', 120, fallback.line),
  }
}

const normalizeMediaUrl = (value: string) => sanitizePlainText(value, { maxLength: 300, allowNewlines: false })

const parseLocalFileNameFromUrl = (url: string) => {
  const normalized = url.trim()

  if (!normalized.startsWith(localMediaUrlPrefix)) {
    return null
  }

  const fileName = normalized.slice(localMediaUrlPrefix.length).trim()

  if (!localMediaFileNamePattern.test(fileName)) {
    return null
  }

  return fileName
}

const parseMinioObjectKeyFromUrl = (url: string) => {
  const normalized = normalizeMediaUrl(url)

  if (!normalized || normalized.startsWith('/')) {
    return null
  }

  let parsed: URL

  try {
    parsed = new URL(normalized)
  } catch {
    return null
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    return null
  }

  let pathSegments: string[]

  try {
    pathSegments = parsed.pathname
      .split('/')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => decodeURIComponent(item))
  } catch {
    return null
  }

  if (pathSegments.length < 2) {
    return null
  }

  const [bucketName, ...objectSegments] = pathSegments

  if (bucketName !== env.MINIO_BUCKET_PUBLIC) {
    return null
  }

  const objectKey = objectSegments.join('/').trim()

  if (!objectKey || !objectKey.startsWith(minioManagedPrefix)) {
    return null
  }

  return objectKey
}

const numberFromUnknown = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const normalizeMultipartSessionId = (value: string) => {
  return sanitizePlainText(value, { maxLength: 120, allowNewlines: false })
}

const normalizeMultipartActorUserId = (value: string) => {
  return sanitizePlainText(value, { maxLength: 120, allowNewlines: false })
}

const parseIsoTimestamp = (value: string) => {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const isMultipartSessionExpired = (session: AdminMultipartUploadSession, now = Date.now()) => {
  return parseIsoTimestamp(session.expiresAt) <= now
}

const readString = (value: unknown) => (typeof value === 'string' ? value : '')

const readPositiveInt = (value: unknown, fallback: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.max(1, Math.trunc(value))
}

const sanitizeMultipartUploadSession = (
  input: Partial<AdminMultipartUploadSession> | null | undefined,
): AdminMultipartUploadSession => {
  const width =
    typeof input?.width === 'number' && Number.isFinite(input.width) && input.width > 0
      ? Math.trunc(input.width)
      : undefined
  const height =
    typeof input?.height === 'number' && Number.isFinite(input.height) && input.height > 0
      ? Math.trunc(input.height)
      : undefined

  return {
    id: normalizeMultipartSessionId(readString(input?.id)),
    uploadId: sanitizePlainText(readString(input?.uploadId), { maxLength: 200, allowNewlines: false }),
    objectKey: sanitizePlainText(readString(input?.objectKey), { maxLength: 300, allowNewlines: false }),
    name: sanitizePlainText(readString(input?.name), { maxLength: 120, allowNewlines: false }),
    mimeType: sanitizePlainText(readString(input?.mimeType), { maxLength: 80, allowNewlines: false }),
    size: readPositiveInt(input?.size, 1),
    width,
    height,
    partSize: readPositiveInt(input?.partSize, 1),
    totalParts: readPositiveInt(input?.totalParts, 1),
    actorUserId: normalizeMultipartActorUserId(readString(input?.actorUserId)),
    actorName: sanitizePlainText(readString(input?.actorName), { maxLength: 60, allowNewlines: false }),
    createdAt: sanitizePlainText(readString(input?.createdAt), { maxLength: 40, allowNewlines: false }),
    expiresAt: sanitizePlainText(readString(input?.expiresAt), { maxLength: 40, allowNewlines: false }),
  }
}

const mapMediaRowToItem = (row: AdminMediaRow): AdminMediaItem => {
  const width =
    typeof row.width === 'number' && Number.isFinite(row.width) && row.width > 0
      ? Math.trunc(row.width)
      : undefined
  const height =
    typeof row.height === 'number' && Number.isFinite(row.height) && row.height > 0
      ? Math.trunc(row.height)
      : undefined
  const deletedAtIso = row.deleted_at ? new Date(row.deleted_at).toISOString() : undefined

  return {
    id: sanitizePlainText(String(row.id ?? ''), { maxLength: 120, allowNewlines: false }),
    name: sanitizePlainText(String(row.name ?? ''), { maxLength: 120, allowNewlines: false }),
    url: sanitizePlainText(String(row.url ?? ''), { maxLength: 300, allowNewlines: false }),
    mimeType: sanitizePlainText(String(row.mime_type ?? ''), { maxLength: 80, allowNewlines: false }),
    size: Math.max(1, Math.trunc(numberFromUnknown(row.size, 1))),
    width,
    height,
    uploadedAt: new Date(row.uploaded_at).toISOString(),
    uploadedBy: sanitizePlainText(String(row.uploaded_by ?? ''), { maxLength: 60, allowNewlines: false }),
    deletedAt: deletedAtIso,
    deletedBy: row.deleted_by
      ? sanitizePlainText(String(row.deleted_by), { maxLength: 60, allowNewlines: false })
      : undefined,
    deletedReason: row.deleted_reason
      ? sanitizePlainText(String(row.deleted_reason), { maxLength: 300, allowNewlines: false })
      : undefined,
  }
}

const mapMultipartSessionRowToItem = (row: AdminMultipartSessionRow): AdminMultipartUploadSession => {
  return sanitizeMultipartUploadSession({
    id: row.id,
    uploadId: row.upload_id,
    objectKey: row.object_key,
    name: row.name,
    mimeType: row.mime_type,
    size: Math.max(1, Math.trunc(numberFromUnknown(row.size, 1))),
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    partSize: row.part_size,
    totalParts: row.total_parts,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
  })
}

const mapThemeRevisionRowToItem = (row: AdminThemeRevisionRow): AdminThemeRevision => {
  const rawTokens =
    row.tokens && typeof row.tokens === 'object'
      ? (row.tokens as Partial<Record<keyof AdminThemeTokens, unknown>>)
      : {}

  return {
    id: sanitizePlainText(String(row.id ?? ''), { maxLength: 120, allowNewlines: false }),
    name: sanitizePlainText(String(row.name ?? ''), { maxLength: 80, allowNewlines: false }),
    tokens: sanitizeThemeTokens(rawTokens, defaultThemeTokens),
    isActive: Boolean(row.is_active),
    createdAt: new Date(row.created_at).toISOString(),
    createdBy: sanitizePlainText(String(row.created_by ?? ''), { maxLength: 60, allowNewlines: false }),
  }
}

const mapPublishSummaryFromUnknown = (value: unknown): AdminPublishSummary => {
  const fallback: AdminPublishSummary = {
    posts: 0,
    comments: 0,
    links: 0,
  }

  if (!value || typeof value !== 'object') {
    return fallback
  }

  const raw = value as Partial<Record<keyof AdminPublishSummary, unknown>>

  return {
    posts: Math.max(0, Math.trunc(numberFromUnknown(raw.posts, 0))),
    comments: Math.max(0, Math.trunc(numberFromUnknown(raw.comments, 0))),
    links: Math.max(0, Math.trunc(numberFromUnknown(raw.links, 0))),
  }
}

const mapPublishRecordRowToItem = (row: AdminPublishRecordRow): AdminPublishRecord => {
  const source = row.source === 'rollback' ? 'rollback' : 'publish'

  return {
    id: sanitizePlainText(String(row.id ?? ''), { maxLength: 120, allowNewlines: false }),
    version: sanitizePlainText(String(row.version ?? ''), { maxLength: 60, allowNewlines: false }),
    source,
    note: sanitizePlainText(String(row.note ?? ''), { maxLength: 300 }),
    createdAt: new Date(row.created_at).toISOString(),
    actorName: sanitizePlainText(String(row.actor_name ?? ''), { maxLength: 60, allowNewlines: false }),
    summary: mapPublishSummaryFromUnknown(row.summary),
  }
}

const mapAccessUserRowToItem = (row: AdminAccessUserRow): AdminAccessUser => {
  const roles = parseRolesFromUnknown(row.roles)
  const permissions = parsePermissionsFromUnknown(row.permissions, ['dashboard:read'])

  return {
    id: sanitizePlainText(String(row.id ?? ''), { maxLength: 120, allowNewlines: false }),
    email: sanitizePlainText(String(row.email ?? ''), { maxLength: 200, allowNewlines: false }).toLowerCase(),
    displayName: sanitizePlainText(String(row.display_name ?? ''), { maxLength: 80, allowNewlines: false }),
    roles,
    permissions: permissions.length > 0 ? permissions : ['dashboard:read'],
    disabled: Boolean(row.disabled),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

const parseRolePermissionsFromUnknown = (
  value: unknown,
  fallback: Record<AdminRoleCode, string[]>,
): Record<AdminRoleCode, string[]> => {
  const raw =
    value && typeof value === 'object'
      ? (value as Partial<Record<AdminRoleCode, unknown>>)
      : ({} as Partial<Record<AdminRoleCode, unknown>>)

  return {
    admin: parsePermissionsFromUnknown(raw.admin, fallback.admin),
    editor: parsePermissionsFromUnknown(raw.editor, fallback.editor),
    operator: parsePermissionsFromUnknown(raw.operator, fallback.operator),
    viewer: parsePermissionsFromUnknown(raw.viewer, fallback.viewer),
  }
}

const parseAvailablePermissionsFromUnknown = (value: unknown, fallback: string[]) => {
  const parsed = parsePermissionsFromUnknown(value)
  return parsed.length > 0 ? parsed : normalizePermissions(fallback)
}

const listThemeRevisionsFromTable = async () => {
  const result = await pgPool.query<AdminThemeRevisionRow>(
    `
      select
        id,
        name,
        tokens,
        is_active,
        created_at,
        created_by
      from ${themeRevisionTableName}
      order by created_at desc
      limit 5000
    `,
  )

  const revisions = result.rows
    .map((row) => mapThemeRevisionRowToItem(row))
    .filter((item) => Boolean(item.id) && Boolean(item.name))

  if (!revisions.some((item) => item.isActive) && revisions[0]) {
    revisions[0].isActive = true
  }

  return revisions
}

const listPublishRecordsFromTable = async () => {
  const result = await pgPool.query<AdminPublishRecordRow>(
    `
      select
        id,
        version,
        source,
        note,
        created_at,
        actor_name,
        summary
      from ${publishRecordTableName}
      order by created_at desc
      limit 5000
    `,
  )

  return result.rows
    .map((row) => mapPublishRecordRowToItem(row))
    .filter((item) => Boolean(item.id) && Boolean(item.version))
}

const listAccessUsersFromTable = async () => {
  const result = await pgPool.query<AdminAccessUserRow>(
    `
      select
        id,
        email,
        display_name,
        roles,
        permissions,
        disabled,
        updated_at
      from ${accessUserTableName}
      order by updated_at desc
      limit 5000
    `,
  )

  return result.rows
    .map((row) => mapAccessUserRowToItem(row))
    .filter((item) => Boolean(item.id) && Boolean(item.email))
}

const readAccessSnapshotFromTables = async (): Promise<AdminAccessSnapshot | null> => {
  const stateResult = await pgPool.query<AdminAccessStateRow>(
    `
      select
        role_permissions,
        available_permissions
      from ${accessStateTableName}
      where id = 1
      limit 1
    `,
  )

  const stateRow = stateResult.rows[0]
  if (!stateRow) {
    return null
  }

  const users = await listAccessUsersFromTable()

  if (users.length === 0) {
    return null
  }

  return {
    users,
    rolePermissions: parseRolePermissionsFromUnknown(
      stateRow.role_permissions,
      defaultRolePermissions,
    ),
    availablePermissions: parseAvailablePermissionsFromUnknown(
      stateRow.available_permissions,
      defaultAvailablePermissions,
    ),
  }
}

const listMediaItemsFromTable = async () => {
  const result = await pgPool.query<AdminMediaRow>(
    `
      select
        id,
        name,
        url,
        mime_type,
        size,
        width,
        height,
        uploaded_at,
        uploaded_by,
        deleted_at,
        deleted_by,
        deleted_reason
      from ${mediaAssetTableName}
      order by uploaded_at desc
      limit 5000
    `,
  )

  return result.rows.map((row) => mapMediaRowToItem(row))
}

const getMediaItemByIdFromTable = async (mediaId: string) => {
  const result = await pgPool.query<AdminMediaRow>(
    `
      select
        id,
        name,
        url,
        mime_type,
        size,
        width,
        height,
        uploaded_at,
        uploaded_by,
        deleted_at,
        deleted_by,
        deleted_reason
      from ${mediaAssetTableName}
      where id = $1
      limit 1
    `,
    [mediaId],
  )

  const row = result.rows[0]
  return row ? mapMediaRowToItem(row) : null
}

const insertMediaItemToTable = async (item: AdminMediaItem) => {
  await pgPool.query(
    `
      insert into ${mediaAssetTableName} (
        id,
        name,
        url,
        mime_type,
        size,
        width,
        height,
        uploaded_at,
        uploaded_by,
        deleted_at,
        deleted_by,
        deleted_reason
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10::timestamptz, $11, $12)
      on conflict (id) do update set
        name = excluded.name,
        url = excluded.url,
        mime_type = excluded.mime_type,
        size = excluded.size,
        width = excluded.width,
        height = excluded.height,
        uploaded_at = excluded.uploaded_at,
        uploaded_by = excluded.uploaded_by,
        deleted_at = excluded.deleted_at,
        deleted_by = excluded.deleted_by,
        deleted_reason = excluded.deleted_reason
    `,
    [
      item.id,
      item.name,
      item.url,
      item.mimeType,
      item.size,
      item.width ?? null,
      item.height ?? null,
      item.uploadedAt,
      item.uploadedBy,
      item.deletedAt ?? null,
      item.deletedBy ?? null,
      item.deletedReason ?? null,
    ],
  )
}

const markMediaItemDeletedInTable = async (input: {
  mediaId: string
  deletedAt: string
  deletedBy: string
  deletedReason?: string
}) => {
  await pgPool.query(
    `
      update ${mediaAssetTableName}
      set
        deleted_at = $2::timestamptz,
        deleted_by = $3,
        deleted_reason = $4
      where id = $1
    `,
    [input.mediaId, input.deletedAt, input.deletedBy, input.deletedReason ?? null],
  )
}

const removeMediaItemsFromTable = async (mediaIds: string[]) => {
  if (mediaIds.length === 0) {
    return
  }

  await pgPool.query(
    `
      delete from ${mediaAssetTableName}
      where id = any($1::text[])
    `,
    [mediaIds],
  )
}

const pruneExpiredMultipartSessionsInTable = async () => {
  await pgPool.query(
    `
      delete from ${multipartSessionTableName}
      where expires_at <= now()
    `,
  )
}

const insertMultipartSessionToTable = async (session: AdminMultipartUploadSession) => {
  await pgPool.query(
    `
      insert into ${multipartSessionTableName} (
        id,
        upload_id,
        object_key,
        name,
        mime_type,
        size,
        width,
        height,
        part_size,
        total_parts,
        actor_user_id,
        actor_name,
        created_at,
        expires_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz, $14::timestamptz)
      on conflict (id) do update set
        upload_id = excluded.upload_id,
        object_key = excluded.object_key,
        name = excluded.name,
        mime_type = excluded.mime_type,
        size = excluded.size,
        width = excluded.width,
        height = excluded.height,
        part_size = excluded.part_size,
        total_parts = excluded.total_parts,
        actor_user_id = excluded.actor_user_id,
        actor_name = excluded.actor_name,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at
    `,
    [
      session.id,
      session.uploadId,
      session.objectKey,
      session.name,
      session.mimeType,
      session.size,
      session.width ?? null,
      session.height ?? null,
      session.partSize,
      session.totalParts,
      session.actorUserId,
      session.actorName,
      session.createdAt,
      session.expiresAt,
    ],
  )
}

const getMultipartSessionByIdFromTable = async (sessionId: string) => {
  const result = await pgPool.query<AdminMultipartSessionRow>(
    `
      select
        id,
        upload_id,
        object_key,
        name,
        mime_type,
        size,
        width,
        height,
        part_size,
        total_parts,
        actor_user_id,
        actor_name,
        created_at,
        expires_at
      from ${multipartSessionTableName}
      where id = $1
      limit 1
    `,
    [sessionId],
  )

  const row = result.rows[0]
  return row ? mapMultipartSessionRowToItem(row) : null
}

const listMultipartSessionsFromTable = async () => {
  const result = await pgPool.query<AdminMultipartSessionRow>(
    `
      select
        id,
        upload_id,
        object_key,
        name,
        mime_type,
        size,
        width,
        height,
        part_size,
        total_parts,
        actor_user_id,
        actor_name,
        created_at,
        expires_at
      from ${multipartSessionTableName}
      order by created_at desc
      limit 5000
    `,
  )

  return result.rows.map((row) => mapMultipartSessionRowToItem(row))
}

const removeMultipartSessionFromTable = async (sessionId: string) => {
  const result = await pgPool.query<AdminMultipartSessionRow>(
    `
      delete from ${multipartSessionTableName}
      where id = $1
      returning
        id,
        upload_id,
        object_key,
        name,
        mime_type,
        size,
        width,
        height,
        part_size,
        total_parts,
        actor_user_id,
        actor_name,
        created_at,
        expires_at
    `,
    [sessionId],
  )

  const row = result.rows[0]
  return row ? mapMultipartSessionRowToItem(row) : null
}

const listManagedMinioObjectKeys = async () => {
  const objectKeys: string[] = []

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const stream = minio.listObjects(env.MINIO_BUCKET_PUBLIC, minioManagedPrefix, true)

    stream.on('data', (item: { name?: string }) => {
      const key = typeof item.name === 'string' ? item.name.trim() : ''

      if (!key || !key.startsWith(minioManagedPrefix)) {
        return
      }

      objectKeys.push(key)
    })

    stream.on('error', (error: unknown) => {
      rejectPromise(error)
    })

    stream.on('end', () => {
      resolvePromise()
    })
  })

  return objectKeys
}

const listIncompleteMultipartUploads = async () => {
  const uploads: Array<{ key: string; uploadId: string }> = []

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const stream = minio.listIncompleteUploads(env.MINIO_BUCKET_PUBLIC, minioManagedPrefix, true)

    stream.on('data', (item: { key?: string; uploadId?: string }) => {
      const key = typeof item.key === 'string' ? item.key.trim() : ''
      const uploadId = typeof item.uploadId === 'string' ? item.uploadId.trim() : ''

      if (!key || !uploadId || !key.startsWith(minioManagedPrefix)) {
        return
      }

      uploads.push({ key, uploadId })
    })

    stream.on('error', (error: unknown) => {
      rejectPromise(error)
    })

    stream.on('end', () => {
      resolvePromise()
    })
  })

  return uploads
}

const buildReferenceMap = async () => {
  const bootstrap = await getBlogBootstrapData()
  const map = new Map<string, AdminMediaReference[]>()

  const addReference = (url: string, reference: AdminMediaReference) => {
    const normalized = normalizeMediaUrl(url)

    if (!normalized) {
      return
    }

    const list = map.get(normalized) ?? []
    list.push(reference)
    map.set(normalized, list)
  }

  const avatarUrl = bootstrap.profile.avatar?.trim()
  if (avatarUrl) {
    addReference(avatarUrl, {
      kind: 'profile-avatar',
      targetId: 'profile.avatar',
      targetLabel: '站点头像',
    })
  }

  for (const post of bootstrap.posts) {
    for (const section of post.contentSections) {
      for (const image of section.images ?? []) {
        addReference(image.src, {
          kind: 'post-image',
          targetId: post.id,
          targetLabel: post.title,
        })
      }
    }
  }

  return map
}

const defaultRuntimeSnapshot = (): AdminRuntimeSnapshot => {
  const timestamp = nowIso()

  return {
    themeRevisions: [
      {
        id: 'theme-v1',
        name: 'Aqua Glass',
        tokens: { ...defaultThemeTokens },
        isActive: true,
        createdAt: timestamp,
        createdBy: '系统管理员',
      },
    ],
    publishHistory: [],
    mediaList: [],
    multipartUploadSessions: [],
    accessSnapshot: {
      users: [
        {
          id: 'bootstrap-admin',
          email: env.ADMIN_BOOTSTRAP_EMAIL.trim().toLowerCase(),
          displayName: env.ADMIN_BOOTSTRAP_DISPLAY_NAME.trim(),
          roles: ['admin'],
          permissions: ['*'],
          disabled: false,
          updatedAt: timestamp,
        },
      ],
      rolePermissions: {
        admin: [...defaultRolePermissions.admin],
        editor: [...defaultRolePermissions.editor],
        operator: [...defaultRolePermissions.operator],
        viewer: [...defaultRolePermissions.viewer],
      },
      availablePermissions: [...defaultAvailablePermissions],
    },
  }
}

const parseRuntimeSnapshot = (payload: unknown): AdminRuntimeSnapshot => {
  if (!payload || typeof payload !== 'object') {
    return defaultRuntimeSnapshot()
  }

  const raw = payload as Partial<AdminRuntimeSnapshot>
  const fallback = defaultRuntimeSnapshot()
  const accessRaw =
    raw.accessSnapshot && typeof raw.accessSnapshot === 'object'
      ? (raw.accessSnapshot as Partial<AdminAccessSnapshot>)
      : null
  const accessUsers = Array.isArray(accessRaw?.users)
    ? (accessRaw.users as AdminAccessUser[])
    : fallback.accessSnapshot.users

  return {
    themeRevisions: Array.isArray(raw.themeRevisions) ? (raw.themeRevisions as AdminThemeRevision[]) : fallback.themeRevisions,
    publishHistory: Array.isArray(raw.publishHistory) ? (raw.publishHistory as AdminPublishRecord[]) : fallback.publishHistory,
    mediaList: Array.isArray(raw.mediaList) ? (raw.mediaList as AdminMediaItem[]) : fallback.mediaList,
    multipartUploadSessions: Array.isArray(raw.multipartUploadSessions)
      ? (raw.multipartUploadSessions as AdminMultipartUploadSession[])
          .map((item) => sanitizeMultipartUploadSession(item))
          .filter((item) => Boolean(item.id) && Boolean(item.actorUserId) && Boolean(item.uploadId))
      : fallback.multipartUploadSessions,
    accessSnapshot: {
      users: accessUsers,
      rolePermissions: parseRolePermissionsFromUnknown(
        accessRaw?.rolePermissions,
        fallback.accessSnapshot.rolePermissions,
      ),
      availablePermissions: parseAvailablePermissionsFromUnknown(
        accessRaw?.availablePermissions,
        fallback.accessSnapshot.availablePermissions,
      ),
    },
  }
}

const sanitizeThemeRevisionForWrite = (
  value: AdminThemeRevision,
  fallbackTimestamp: string,
): AdminThemeRevision => {
  const createdAtValue =
    typeof value.createdAt === 'string' && parseIsoTimestamp(value.createdAt) > 0
      ? value.createdAt
      : fallbackTimestamp

  return {
    id: sanitizePlainText(readString(value.id), { maxLength: 120, allowNewlines: false }),
    name: sanitizePlainText(readString(value.name), { maxLength: 80, allowNewlines: false }),
    tokens: sanitizeThemeTokens(value.tokens, defaultThemeTokens),
    isActive: Boolean(value.isActive),
    createdAt: createdAtValue,
    createdBy:
      sanitizePlainText(readString(value.createdBy), {
        maxLength: 60,
        allowNewlines: false,
      }) || '系统管理员',
  }
}

const sanitizePublishRecordForWrite = (
  value: AdminPublishRecord,
  fallbackTimestamp: string,
): AdminPublishRecord => {
  const source = value.source === 'rollback' ? 'rollback' : 'publish'
  const createdAtValue =
    typeof value.createdAt === 'string' && parseIsoTimestamp(value.createdAt) > 0
      ? value.createdAt
      : fallbackTimestamp

  return {
    id: sanitizePlainText(readString(value.id), { maxLength: 120, allowNewlines: false }),
    version: sanitizePlainText(readString(value.version), { maxLength: 60, allowNewlines: false }),
    source,
    note: sanitizePlainText(readString(value.note), { maxLength: 300 }),
    createdAt: createdAtValue,
    actorName:
      sanitizePlainText(readString(value.actorName), {
        maxLength: 60,
        allowNewlines: false,
      }) || '系统管理员',
    summary: mapPublishSummaryFromUnknown(value.summary),
  }
}

const sanitizeAccessUserForWrite = (
  value: AdminAccessUser,
  fallbackTimestamp: string,
): AdminAccessUser => {
  const permissions = parsePermissionsFromUnknown(value.permissions, ['dashboard:read'])
  const updatedAtValue =
    typeof value.updatedAt === 'string' && parseIsoTimestamp(value.updatedAt) > 0
      ? value.updatedAt
      : fallbackTimestamp

  return {
    id: sanitizePlainText(readString(value.id), { maxLength: 120, allowNewlines: false }),
    email: sanitizePlainText(readString(value.email), { maxLength: 200, allowNewlines: false }).toLowerCase(),
    displayName: sanitizePlainText(readString(value.displayName), { maxLength: 80, allowNewlines: false }),
    roles: parseRolesFromUnknown(value.roles),
    permissions: permissions.length > 0 ? permissions : ['dashboard:read'],
    disabled: Boolean(value.disabled),
    updatedAt: updatedAtValue,
  }
}

const syncCoreDomainTablesFromSnapshot = async (snapshot: AdminRuntimeSnapshot) => {
  const fallbackSnapshot = defaultRuntimeSnapshot()
  const fallbackTimestamp = nowIso()

  const themeRevisions = snapshot.themeRevisions
    .map((item) => sanitizeThemeRevisionForWrite(item, fallbackTimestamp))
    .filter((item) => Boolean(item.id) && Boolean(item.name))

  if (themeRevisions.length === 0) {
    const fallbackTheme = fallbackSnapshot.themeRevisions[0]

    if (fallbackTheme) {
      themeRevisions.push(fallbackTheme)
    }
  }

  if (!themeRevisions.some((item) => item.isActive) && themeRevisions[0]) {
    themeRevisions[0].isActive = true
  }

  const publishHistory = snapshot.publishHistory
    .map((item) => sanitizePublishRecordForWrite(item, fallbackTimestamp))
    .filter((item) => Boolean(item.id) && Boolean(item.version))

  const accessUsers = snapshot.accessSnapshot.users
    .map((item) => sanitizeAccessUserForWrite(item, fallbackTimestamp))
    .filter((item) => Boolean(item.id) && Boolean(item.email))

  if (accessUsers.length === 0) {
    const fallbackUser = fallbackSnapshot.accessSnapshot.users[0]

    if (fallbackUser) {
      accessUsers.push(fallbackUser)
    }
  }

  const rolePermissions = parseRolePermissionsFromUnknown(
    snapshot.accessSnapshot.rolePermissions,
    fallbackSnapshot.accessSnapshot.rolePermissions,
  )
  const availablePermissions = parseAvailablePermissionsFromUnknown(
    snapshot.accessSnapshot.availablePermissions,
    fallbackSnapshot.accessSnapshot.availablePermissions,
  )

  const client = await pgPool.connect()

  try {
    await client.query('begin')
    await client.query(`delete from ${themeRevisionTableName}`)

    for (const item of themeRevisions) {
      await client.query(
        `
          insert into ${themeRevisionTableName} (
            id,
            name,
            tokens,
            is_active,
            created_at,
            created_by
          )
          values ($1, $2, $3::jsonb, $4, $5::timestamptz, $6)
        `,
        [
          item.id,
          item.name,
          JSON.stringify(item.tokens),
          item.isActive,
          item.createdAt,
          item.createdBy,
        ],
      )
    }

    await client.query(`delete from ${publishRecordTableName}`)

    for (const item of publishHistory) {
      await client.query(
        `
          insert into ${publishRecordTableName} (
            id,
            version,
            source,
            note,
            created_at,
            actor_name,
            summary
          )
          values ($1, $2, $3, $4, $5::timestamptz, $6, $7::jsonb)
        `,
        [
          item.id,
          item.version,
          item.source,
          item.note,
          item.createdAt,
          item.actorName,
          JSON.stringify(item.summary),
        ],
      )
    }

    await client.query(`delete from ${accessUserTableName}`)

    for (const user of accessUsers) {
      await client.query(
        `
          insert into ${accessUserTableName} (
            id,
            email,
            display_name,
            roles,
            permissions,
            disabled,
            updated_at
          )
          values ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7::timestamptz)
        `,
        [
          user.id,
          user.email,
          user.displayName,
          JSON.stringify(user.roles),
          JSON.stringify(user.permissions),
          user.disabled ?? false,
          user.updatedAt,
        ],
      )
    }

    await client.query(
      `
        insert into ${accessStateTableName} (
          id,
          role_permissions,
          available_permissions,
          updated_at
        )
        values (1, $1::jsonb, $2::jsonb, now())
        on conflict (id) do update set
          role_permissions = excluded.role_permissions,
          available_permissions = excluded.available_permissions,
          updated_at = excluded.updated_at
      `,
      [JSON.stringify(rolePermissions), JSON.stringify(availablePermissions)],
    )

    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

const readSnapshotFromDomainTables = async (): Promise<AdminRuntimeSnapshot | null> => {
  await pruneExpiredMultipartSessionsInTable()

  const [themeRevisions, publishHistory, mediaList, multipartUploadSessions, accessSnapshot] =
    await Promise.all([
      listThemeRevisionsFromTable(),
      listPublishRecordsFromTable(),
      listMediaItemsFromTable(),
      listMultipartSessionsFromTable(),
      readAccessSnapshotFromTables(),
    ])

  if (themeRevisions.length === 0 || !accessSnapshot) {
    return null
  }

  return parseRuntimeSnapshot({
    themeRevisions,
    publishHistory,
    mediaList,
    multipartUploadSessions,
    accessSnapshot,
  })
}

const readSnapshotFromPostgres = async () => {
  const result = await pgPool.query<{ payload: unknown }>(
    `
      select payload
      from admin_runtime_snapshots
      where id = $1
      limit 1
    `,
    [runtimeSnapshotId],
  )

  const row = result.rows[0]

  if (!row) {
    const next = defaultRuntimeSnapshot()
    await pgPool.query(
      `
        insert into admin_runtime_snapshots (id, payload, updated_at)
        values ($1, $2::jsonb, now())
      `,
      [runtimeSnapshotId, JSON.stringify(next)],
    )
    return next
  }

  return parseRuntimeSnapshot(row.payload)
}

const readSnapshot = async () => {
  const cached = await redis.get(runtimeSnapshotRedisKey)
  if (cached) {
    try {
      return parseRuntimeSnapshot(JSON.parse(cached))
    } catch {
      // fallback to database
    }
  }

  const domainSnapshot = await readSnapshotFromDomainTables()

  if (domainSnapshot) {
    await redis.set(runtimeSnapshotRedisKey, JSON.stringify(domainSnapshot))
    return domainSnapshot
  }

  const snapshot = await readSnapshotFromPostgres()
  await syncCoreDomainTablesFromSnapshot(snapshot)
  await backfillDomainTablesFromSnapshot(snapshot, { skipCoreBackfill: true })
  await redis.set(runtimeSnapshotRedisKey, JSON.stringify(snapshot))
  return snapshot
}

const writeSnapshot = async (snapshot: AdminRuntimeSnapshot) => {
  const safe = parseRuntimeSnapshot(snapshot)
  await syncCoreDomainTablesFromSnapshot(safe)

  await pgPool.query(
    `
      insert into admin_runtime_snapshots (id, payload, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (id) do update set
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `,
    [runtimeSnapshotId, JSON.stringify(safe)],
  )

  await redis.set(runtimeSnapshotRedisKey, JSON.stringify(safe))
  return safe
}

const buildPublishSummary = async (): Promise<AdminPublishSummary> => {
  const bootstrap = await getBlogBootstrapData()
  const posts = bootstrap.posts.length
  const comments = Object.values(bootstrap.commentsByPost).reduce((sum, items) => sum + items.length, 0)
  const links = bootstrap.links.length

  return { posts, comments, links }
}

const backfillDomainTablesFromSnapshot = async (
  seedSnapshot?: AdminRuntimeSnapshot,
  options?: { skipCoreBackfill?: boolean },
) => {
  const [
    mediaCountResult,
    sessionCountResult,
    themeCountResult,
    publishCountResult,
    accessUserCountResult,
    accessStateCountResult,
  ] = await Promise.all([
    pgPool.query<{ count: string }>(`select count(*)::text as count from ${mediaAssetTableName}`),
    pgPool.query<{ count: string }>(`select count(*)::text as count from ${multipartSessionTableName}`),
    pgPool.query<{ count: string }>(`select count(*)::text as count from ${themeRevisionTableName}`),
    pgPool.query<{ count: string }>(`select count(*)::text as count from ${publishRecordTableName}`),
    pgPool.query<{ count: string }>(`select count(*)::text as count from ${accessUserTableName}`),
    pgPool.query<{ count: string }>(`select count(*)::text as count from ${accessStateTableName}`),
  ])

  const mediaCount = Number(mediaCountResult.rows[0]?.count ?? '0')
  const sessionCount = Number(sessionCountResult.rows[0]?.count ?? '0')
  const themeCount = Number(themeCountResult.rows[0]?.count ?? '0')
  const publishCount = Number(publishCountResult.rows[0]?.count ?? '0')
  const accessUserCount = Number(accessUserCountResult.rows[0]?.count ?? '0')
  const accessStateCount = Number(accessStateCountResult.rows[0]?.count ?? '0')

  const snapshot = seedSnapshot ?? (await readSnapshotFromPostgres())
  const needsCoreBackfill =
    themeCount === 0 ||
    accessUserCount === 0 ||
    accessStateCount === 0 ||
    (publishCount === 0 && snapshot.publishHistory.length > 0)

  if (needsCoreBackfill && !options?.skipCoreBackfill) {
    await syncCoreDomainTablesFromSnapshot(snapshot)
  }

  if (mediaCount === 0 && snapshot.mediaList.length > 0) {
    for (const item of snapshot.mediaList) {
      await insertMediaItemToTable({
        id: sanitizePlainText(item.id, { maxLength: 120, allowNewlines: false }),
        name: sanitizePlainText(item.name, { maxLength: 120, allowNewlines: false }),
        url: sanitizePlainText(item.url, { maxLength: 300, allowNewlines: false }),
        mimeType: sanitizePlainText(item.mimeType, { maxLength: 80, allowNewlines: false }),
        size: Math.max(1, Math.trunc(item.size)),
        width: item.width,
        height: item.height,
        uploadedAt: item.uploadedAt,
        uploadedBy: sanitizePlainText(item.uploadedBy, { maxLength: 60, allowNewlines: false }),
        deletedAt: item.deletedAt,
        deletedBy: item.deletedBy,
        deletedReason: item.deletedReason,
      })
    }
  }

  if (sessionCount === 0 && snapshot.multipartUploadSessions.length > 0) {
    for (const item of snapshot.multipartUploadSessions) {
      const session = sanitizeMultipartUploadSession(item)

      if (!session.id || !session.uploadId || !session.actorUserId || !session.objectKey) {
        continue
      }

      await insertMultipartSessionToTable(session)
    }
  }

  await pruneExpiredMultipartSessionsInTable()
}

export const ensureAdminRuntimePersistence = async () => {
  if (runtimeReady) {
    return
  }

  await pgPool.query(`
    create table if not exists admin_runtime_snapshots (
      id smallint primary key,
      payload jsonb not null,
      updated_at timestamptz not null
    )
  `)

  const existing = await pgPool.query('select 1 from admin_runtime_snapshots where id = $1', [
    runtimeSnapshotId,
  ])

  if (existing.rowCount === 0) {
    const seed = defaultRuntimeSnapshot()
    await pgPool.query(
      `
        insert into admin_runtime_snapshots (id, payload, updated_at)
        values ($1, $2::jsonb, now())
      `,
      [runtimeSnapshotId, JSON.stringify(seed)],
    )
  }

  await pgPool.query(`
    create table if not exists ${themeRevisionTableName} (
      id varchar(120) primary key,
      name varchar(120) not null,
      tokens jsonb not null,
      is_active boolean not null default false,
      created_at timestamptz not null,
      created_by varchar(120) not null
    )
  `)

  await pgPool.query(`
    create index if not exists idx_admin_theme_revisions_created_at
    on ${themeRevisionTableName} (created_at desc)
  `)

  await pgPool.query(`
    create index if not exists idx_admin_theme_revisions_active
    on ${themeRevisionTableName} (is_active)
  `)

  await pgPool.query(`
    create table if not exists ${publishRecordTableName} (
      id varchar(120) primary key,
      version varchar(80) not null,
      source varchar(20) not null,
      note varchar(600) not null,
      created_at timestamptz not null,
      actor_name varchar(120) not null,
      summary jsonb not null
    )
  `)

  await pgPool.query(`
    create index if not exists idx_admin_publish_records_created_at
    on ${publishRecordTableName} (created_at desc)
  `)

  await pgPool.query(`
    create table if not exists ${accessUserTableName} (
      id varchar(120) primary key,
      email varchar(200) not null,
      display_name varchar(120) not null,
      roles jsonb not null,
      permissions jsonb not null,
      disabled boolean not null default false,
      updated_at timestamptz not null
    )
  `)

  await pgPool.query(`
    create index if not exists idx_admin_access_users_email
    on ${accessUserTableName} (email)
  `)

  await pgPool.query(`
    create index if not exists idx_admin_access_users_updated_at
    on ${accessUserTableName} (updated_at desc)
  `)

  await pgPool.query(`
    create table if not exists ${accessStateTableName} (
      id smallint primary key,
      role_permissions jsonb not null,
      available_permissions jsonb not null,
      updated_at timestamptz not null
    )
  `)

  await pgPool.query(`
    create table if not exists ${mediaAssetTableName} (
      id varchar(120) primary key,
      name varchar(160) not null,
      url varchar(500) not null,
      mime_type varchar(120) not null,
      size bigint not null,
      width integer,
      height integer,
      uploaded_at timestamptz not null,
      uploaded_by varchar(120) not null,
      deleted_at timestamptz,
      deleted_by varchar(120),
      deleted_reason varchar(600)
    )
  `)

  await pgPool.query(`
    create index if not exists idx_admin_media_assets_uploaded_at
    on ${mediaAssetTableName} (uploaded_at desc)
  `)

  await pgPool.query(`
    create index if not exists idx_admin_media_assets_deleted_at
    on ${mediaAssetTableName} (deleted_at)
  `)

  await pgPool.query(`
    create table if not exists ${multipartSessionTableName} (
      id varchar(120) primary key,
      upload_id varchar(200) not null,
      object_key varchar(300) not null,
      name varchar(120) not null,
      mime_type varchar(80) not null,
      size bigint not null,
      width integer,
      height integer,
      part_size integer not null,
      total_parts integer not null,
      actor_user_id varchar(120) not null,
      actor_name varchar(120) not null,
      created_at timestamptz not null,
      expires_at timestamptz not null
    )
  `)

  await pgPool.query(`
    create index if not exists idx_admin_multipart_sessions_expires_at
    on ${multipartSessionTableName} (expires_at)
  `)

  await pgPool.query(`
    create index if not exists idx_admin_multipart_sessions_actor_user
    on ${multipartSessionTableName} (actor_user_id)
  `)

  await backfillDomainTablesFromSnapshot()

  runtimeReady = true
}

export const getThemeRevisions = async () => {
  await ensureAdminRuntimePersistence()
  const snapshot = await readSnapshot()

  return clone(
    [...snapshot.themeRevisions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  )
}

export const createThemeRevision = async (input: CreateThemeRevisionInput, actorName: string) => {
  await ensureAdminRuntimePersistence()
  const snapshot = await readSnapshot()

  const revision: AdminThemeRevision = {
    id: `theme-${Date.now().toString(36)}`,
    name: sanitizePlainText(input.name, { maxLength: 80, allowNewlines: false }),
    tokens: {
      brand: sanitizePlainText(input.tokens.brand, { maxLength: 60, allowNewlines: false }),
      brandStrong: sanitizePlainText(input.tokens.brandStrong, { maxLength: 60, allowNewlines: false }),
      accent: sanitizePlainText(input.tokens.accent, { maxLength: 60, allowNewlines: false }),
      bgMain: sanitizePlainText(input.tokens.bgMain, { maxLength: 60, allowNewlines: false }),
      ink: sanitizePlainText(input.tokens.ink, { maxLength: 60, allowNewlines: false }),
      surfaceGlass: sanitizePlainText(input.tokens.surfaceGlass, {
        maxLength: 120,
        allowNewlines: false,
      }),
      line: sanitizePlainText(input.tokens.line, { maxLength: 120, allowNewlines: false }),
    },
    isActive: false,
    createdAt: nowIso(),
    createdBy: sanitizePlainText(actorName, { maxLength: 60, allowNewlines: false }),
  }

  snapshot.themeRevisions.unshift(revision)
  await writeSnapshot(snapshot)
  return clone(revision)
}

export const activateThemeRevision = async (revisionId: string) => {
  await ensureAdminRuntimePersistence()
  const snapshot = await readSnapshot()

  const target = snapshot.themeRevisions.find((item) => item.id === revisionId)
  if (!target) {
    return null
  }

  snapshot.themeRevisions = snapshot.themeRevisions.map((item) => ({
    ...item,
    isActive: item.id === revisionId,
  }))

  await writeSnapshot(snapshot)
  return clone(snapshot.themeRevisions.find((item) => item.id === revisionId) ?? target)
}

export const getPublishHistory = async () => {
  await ensureAdminRuntimePersistence()
  const snapshot = await readSnapshot()
  return clone([...snapshot.publishHistory].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
}

export const createPublishPreview = async (
  input: CreatePublishPreviewInput,
  origin: string,
): Promise<AdminPublishPreviewPayload> => {
  const expiresInMinutes = Math.max(5, Math.min(180, input.expiresInMinutes ?? 30))
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1_000).toISOString()
  const token = `preview_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const base = origin.trim().replace(/\/+$/, '') || 'http://localhost:5173'

  return {
    previewUrl: `${base}/?preview=${token}`,
    token,
    expiresAt,
  }
}

export const commitPublish = async (input: CommitPublishInput, actorName: string) => {
  await ensureAdminRuntimePersistence()
  const snapshot = await readSnapshot()
  const summary = await buildPublishSummary()
  const now = nowIso()

  const record: AdminPublishRecord = {
    id: `pub-${Date.now().toString(36)}`,
    version: sanitizePlainText(input.version, { maxLength: 60, allowNewlines: false }),
    source: 'publish',
    note: sanitizePlainText(input.note, { maxLength: 300 }),
    createdAt: now,
    actorName: sanitizePlainText(actorName, { maxLength: 60, allowNewlines: false }),
    summary,
  }

  snapshot.publishHistory.unshift(record)
  await writeSnapshot(snapshot)
  return clone(record)
}

export const rollbackPublish = async (input: RollbackPublishInput, actorName: string) => {
  await ensureAdminRuntimePersistence()
  const snapshot = await readSnapshot()

  const target = snapshot.publishHistory.find((item) => item.id === input.targetRecordId)
  if (!target) {
    return null
  }

  const summary = await buildPublishSummary()
  const record: AdminPublishRecord = {
    id: `pub-${Date.now().toString(36)}`,
    version: target.version,
    source: 'rollback',
    note: sanitizePlainText(input.reason, { maxLength: 300 }),
    createdAt: nowIso(),
    actorName: sanitizePlainText(actorName, { maxLength: 60, allowNewlines: false }),
    summary,
  }

  snapshot.publishHistory.unshift(record)
  await writeSnapshot(snapshot)
  return clone(record)
}

export const getMediaList = async (query: MediaQuery) => {
  await ensureAdminRuntimePersistence()
  const mediaList = await listMediaItemsFromTable()
  const referenceMap = await buildReferenceMap()

  const keyword = query.keyword?.trim().toLowerCase() ?? ''
  const mimeType = query.mimeType?.trim().toLowerCase() ?? ''

  return clone(
    mediaList
      .filter((item) => {
        if (item.deletedAt) {
          return false
        }

        if (mimeType && !item.mimeType.toLowerCase().startsWith(mimeType)) {
          return false
        }

        if (!keyword) {
          return true
        }

        const searchable = `${item.name} ${item.url} ${item.uploadedBy}`.toLowerCase()
        return searchable.includes(keyword)
      })
      .map((item) => {
        const usageCount = referenceMap.get(normalizeMediaUrl(item.url))?.length ?? 0

        return {
          ...item,
          usageCount,
          inUse: usageCount > 0,
        }
      })
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
      .slice(0, query.limit),
  )
}

export const uploadMedia = async (input: UploadMediaInput, actorName: string) => {
  await ensureAdminRuntimePersistence()

  const now = nowIso()
  const record: AdminMediaItem = {
    id: `media-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`,
    name: sanitizePlainText(input.name, { maxLength: 120, allowNewlines: false }),
    url: sanitizePlainText(input.url, { maxLength: 300, allowNewlines: false }),
    mimeType: sanitizePlainText(input.mimeType, { maxLength: 80, allowNewlines: false }),
    size: Math.max(1, Math.trunc(input.size)),
    width: input.width,
    height: input.height,
    uploadedAt: now,
    uploadedBy: sanitizePlainText(actorName, { maxLength: 60, allowNewlines: false }),
  }

  await insertMediaItemToTable(record)
  return clone(record)
}

export const createMultipartUploadSession = async (input: CreateMultipartUploadSessionInput) => {
  await ensureAdminRuntimePersistence()
  await pruneExpiredMultipartSessionsInTable()

  const session = sanitizeMultipartUploadSession({
    id: `mpu-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
    uploadId: input.uploadId,
    objectKey: input.objectKey,
    name: input.name,
    mimeType: input.mimeType,
    size: input.size,
    width: input.width,
    height: input.height,
    partSize: input.partSize,
    totalParts: input.totalParts,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    createdAt: nowIso(),
    expiresAt: input.expiresAt,
  })

  if (!session.id || !session.actorUserId || !session.objectKey || !session.uploadId) {
    throw new Error('Invalid multipart upload session payload')
  }

  await insertMultipartSessionToTable(session)
  await pgPool.query(
    `
      delete from ${multipartSessionTableName}
      where id in (
        select id
        from ${multipartSessionTableName}
        order by created_at desc
        offset $1
      )
    `,
    [maxMultipartUploadSessions],
  )

  return clone(session)
}

export const resolveMultipartUploadSession = async (
  input: ResolveMultipartUploadSessionInput,
): Promise<ResolveMultipartUploadSessionResult> => {
  await ensureAdminRuntimePersistence()
  await pruneExpiredMultipartSessionsInTable()

  const sessionId = normalizeMultipartSessionId(input.sessionId)
  const actorUserId = normalizeMultipartActorUserId(input.actorUserId)

  if (!sessionId || !actorUserId) {
    return {
      status: 'not_found',
    }
  }

  const target = await getMultipartSessionByIdFromTable(sessionId)

  if (!target) {
    return {
      status: 'not_found',
    }
  }

  if (target.actorUserId !== actorUserId) {
    return {
      status: 'forbidden',
    }
  }

  if (isMultipartSessionExpired(target, Date.now())) {
    await removeMultipartSessionFromTable(target.id)
    return {
      status: 'expired',
    }
  }

  return {
    status: 'ok',
    session: clone(target),
  }
}

export const removeMultipartUploadSession = async (sessionId: string) => {
  await ensureAdminRuntimePersistence()
  const normalizedSessionId = normalizeMultipartSessionId(sessionId)

  if (!normalizedSessionId) {
    return null
  }

  await pruneExpiredMultipartSessionsInTable()
  const removed = await removeMultipartSessionFromTable(normalizedSessionId)
  return removed ? clone(removed) : null
}

export const deleteMedia = async (input: DeleteMediaInput): Promise<DeleteMediaResult> => {
  await ensureAdminRuntimePersistence()
  const mediaId = sanitizePlainText(input.mediaId, { maxLength: 120, allowNewlines: false })
  const target = await getMediaItemByIdFromTable(mediaId)

  if (!target || target.deletedAt) {
    return {
      status: 'not_found',
    }
  }

  const referenceMap = await buildReferenceMap()
  const references = clone(referenceMap.get(normalizeMediaUrl(target.url)) ?? [])

  if (references.length > 0 && !input.force) {
    return {
      status: 'in_use',
      item: clone(target),
      references,
    }
  }

  const deletedAt = nowIso()
  const deletedBy = sanitizePlainText(input.actorName, { maxLength: 60, allowNewlines: false })
  const deletedReason = input.reason
    ? sanitizePlainText(input.reason, { maxLength: 300, allowNewlines: false })
    : undefined
  target.deletedAt = deletedAt
  target.deletedBy = deletedBy
  target.deletedReason = deletedReason
  delete target.inUse
  delete target.usageCount

  await markMediaItemDeletedInTable({
    mediaId: target.id,
    deletedAt,
    deletedBy,
    deletedReason,
  })

  return {
    status: 'deleted',
    item: clone(target),
    references,
    forced: Boolean(input.force),
  }
}

export const cleanupMediaOrphans = async (
  input: CleanupMediaInput,
): Promise<CleanupMediaReport> => {
  await ensureAdminRuntimePersistence()
  const mediaList = await listMediaItemsFromTable()
  const dryRun = Boolean(input.dryRun)
  const failures: CleanupFailure[] = []

  const activeLocalFiles = new Set<string>()
  const activeMinioObjects = new Set<string>()
  const deletedRecords = mediaList.filter((item) => Boolean(item.deletedAt))
  const deletedMetadataIdsToPurge: string[] = []

  let removedMetadataRecords = 0
  let removedLocalFiles = 0
  let removedMinioObjects = 0
  let orphanLocalFilesDetected = 0
  let orphanLocalFilesRemoved = 0
  let orphanMinioObjectsDetected = 0
  let orphanMinioObjectsRemoved = 0
  let orphanMultipartUploadsDetected = 0
  let orphanMultipartUploadsAborted = 0

  for (const item of mediaList) {
    const localFileName = parseLocalFileNameFromUrl(item.url)
    const minioObjectKey = parseMinioObjectKeyFromUrl(item.url)

    if (!item.deletedAt) {
      if (localFileName) {
        activeLocalFiles.add(localFileName)
      }

      if (minioObjectKey) {
        activeMinioObjects.add(minioObjectKey)
      }

      continue
    }

    if (!localFileName && !minioObjectKey) {
      removedMetadataRecords += 1
      deletedMetadataIdsToPurge.push(item.id)
      continue
    }

    if (dryRun) {
      removedMetadataRecords += 1
      deletedMetadataIdsToPurge.push(item.id)

      if (localFileName) {
        removedLocalFiles += 1
      }

      if (minioObjectKey) {
        removedMinioObjects += 1
      }

      continue
    }

    if (localFileName) {
      const absolutePath = resolve(input.localMediaStorageRoot, localFileName)

      try {
        await rm(absolutePath, { force: true })
        removedLocalFiles += 1
      } catch (error) {
        failures.push({
          mediaId: item.id,
          fileName: localFileName,
          reason: error instanceof Error ? error.message : '删除本地文件失败',
        })
        continue
      }
    }

    if (minioObjectKey) {
      try {
        await minio.removeObject(env.MINIO_BUCKET_PUBLIC, minioObjectKey)
        removedMinioObjects += 1
      } catch (error) {
        failures.push({
          mediaId: item.id,
          objectKey: minioObjectKey,
          reason: error instanceof Error ? error.message : '删除 MinIO 对象失败',
        })
        continue
      }
    }

    removedMetadataRecords += 1
    deletedMetadataIdsToPurge.push(item.id)
  }

  const localFilesInStorage = await readdir(input.localMediaStorageRoot, { withFileTypes: true }).catch(() => [])

  const knownLocalFiles = new Set<string>()
  for (const item of mediaList) {
    const localFileName = parseLocalFileNameFromUrl(item.url)

    if (localFileName) {
      knownLocalFiles.add(localFileName)
    }
  }

  for (const entry of localFilesInStorage) {
    if (!entry.isFile()) {
      continue
    }

    const fileName = entry.name

    if (!localMediaFileNamePattern.test(fileName)) {
      continue
    }

    if (activeLocalFiles.has(fileName) || knownLocalFiles.has(fileName)) {
      continue
    }

    orphanLocalFilesDetected += 1

    if (dryRun) {
      continue
    }

    const absolutePath = resolve(input.localMediaStorageRoot, fileName)

    try {
      await rm(absolutePath, { force: true })
      orphanLocalFilesRemoved += 1
    } catch (error) {
      failures.push({
        fileName,
        reason: error instanceof Error ? error.message : '删除孤儿文件失败',
      })
    }
  }

  const knownMinioObjects = new Set<string>()
  for (const item of mediaList) {
    const objectKey = parseMinioObjectKeyFromUrl(item.url)

    if (objectKey) {
      knownMinioObjects.add(objectKey)
    }
  }

  try {
    const minioObjectKeys = await listManagedMinioObjectKeys()

    for (const objectKey of minioObjectKeys) {
      if (activeMinioObjects.has(objectKey) || knownMinioObjects.has(objectKey)) {
        continue
      }

      orphanMinioObjectsDetected += 1

      if (dryRun) {
        continue
      }

      try {
        await minio.removeObject(env.MINIO_BUCKET_PUBLIC, objectKey)
        orphanMinioObjectsRemoved += 1
      } catch (error) {
        failures.push({
          objectKey,
          reason: error instanceof Error ? error.message : '删除 MinIO 孤儿对象失败',
        })
      }
    }
  } catch (error) {
    failures.push({
      reason: error instanceof Error ? error.message : '列出 MinIO 对象失败',
    })
  }

  try {
    const activeSessions = await listMultipartSessionsFromTable()
    const activeSessionSet = new Set(activeSessions.map((item) => `${item.objectKey}::${item.uploadId}`))
    const incompleteUploads = await listIncompleteMultipartUploads()

    for (const upload of incompleteUploads) {
      if (activeSessionSet.has(`${upload.key}::${upload.uploadId}`)) {
        continue
      }

      orphanMultipartUploadsDetected += 1

      if (dryRun) {
        continue
      }

      try {
        await minio.abortMultipartUpload(env.MINIO_BUCKET_PUBLIC, upload.key, upload.uploadId)
        orphanMultipartUploadsAborted += 1
      } catch (error) {
        failures.push({
          objectKey: upload.key,
          reason: error instanceof Error ? error.message : '中止孤儿分片上传失败',
        })
      }
    }
  } catch (error) {
    failures.push({
      reason: error instanceof Error ? error.message : '列出分片上传会话失败',
    })
  }

  if (!dryRun && deletedMetadataIdsToPurge.length > 0) {
    const failedMediaIds = new Set(failures.map((item) => item.mediaId).filter((item): item is string => Boolean(item)))
    const idsToDelete = deletedMetadataIdsToPurge.filter((id) => !failedMediaIds.has(id))

    if (idsToDelete.length > 0) {
      await removeMediaItemsFromTable(idsToDelete)
    }
  }

  return {
    dryRun,
    processedDeletedRecords: deletedRecords.length,
    removedMetadataRecords,
    removedLocalFiles,
    removedMinioObjects,
    orphanLocalFilesDetected,
    orphanLocalFilesRemoved,
    orphanMinioObjectsDetected,
    orphanMinioObjectsRemoved,
    orphanMultipartUploadsDetected,
    orphanMultipartUploadsAborted,
    failures,
  }
}

export const getAccessSnapshot = async () => {
  await ensureAdminRuntimePersistence()
  const snapshot = await readSnapshot()
  return clone(snapshot.accessSnapshot)
}

export const updateUserAccess = async (input: UpdateUserAccessInput) => {
  await ensureAdminRuntimePersistence()
  const snapshot = await readSnapshot()

  const users = snapshot.accessSnapshot.users
  const target = users.find((item) => item.id === input.userId)

  if (!target) {
    return null
  }

  const nextRoles = normalizeRoles(input.roles)
  const nextPermissions = normalizePermissions(input.permissions)
  const nextDisabled = Boolean(input.disabled)

  const enabledAdminUsers = users.filter((item) => !item.disabled && item.roles.includes('admin'))
  const targetWasEnabledAdmin = !target.disabled && target.roles.includes('admin')
  const targetWillBeEnabledAdmin = !nextDisabled && nextRoles.includes('admin')

  if (targetWasEnabledAdmin && !targetWillBeEnabledAdmin && enabledAdminUsers.length <= 1) {
    return {
      errorCode: 'LAST_ADMIN_LOCKOUT',
      snapshot: clone(snapshot.accessSnapshot),
    } as const
  }

  target.roles = nextRoles
  target.permissions = nextPermissions.length > 0 ? nextPermissions : ['dashboard:read']
  target.disabled = nextDisabled
  target.updatedAt = nowIso()

  await writeSnapshot(snapshot)
  return {
    snapshot: clone(snapshot.accessSnapshot),
  } as const
}
