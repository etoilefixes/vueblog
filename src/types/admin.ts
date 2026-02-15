import type { BlogComment, BlogCommentStatus } from '@/types/blog'
export type AdminRoleCode = 'admin' | 'editor' | 'operator' | 'viewer'

export interface AdminUser {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  roles: AdminRoleCode[]
  permissions: string[]
}

export interface AdminAuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface AdminLoginInput {
  email: string
  password: string
}

export interface AdminRefreshInput {
  refreshToken: string
}

export interface AdminAuthPayload {
  user: AdminUser
  tokens: AdminAuthTokens
}

export interface AdminTrendPoint {
  date: string
  pv: number
  uv: number
  publishedPosts: number
}

export interface AdminTopItem {
  id: string
  title: string
  value: number
}

export interface AdminDashboardOverview {
  summary: {
    totalPosts: number
    totalViews: number
    totalComments: number
    publishedToday: number
  }
  trends: AdminTrendPoint[]
  topPosts: AdminTopItem[]
  topTags: AdminTopItem[]
  system: {
    apiP95Ms: number
    errorRate: number
    slowQueries: number
  }
}

export interface AdminThemeTokens {
  brand: string
  brandStrong: string
  accent: string
  bgMain: string
  ink: string
  surfaceGlass: string
  line: string
}

export interface AdminThemeRevision {
  id: string
  name: string
  tokens: AdminThemeTokens
  isActive: boolean
  createdAt: string
  createdBy: string
}

export interface AdminCreateThemeRevisionInput {
  name: string
  tokens: AdminThemeTokens
}

export interface AdminAuditLog {
  id: string
  actorName: string
  action: string
  targetType: string
  targetId: string
  summary: string
  createdAt: string
  ip?: string
}

export interface AdminAuditLogQuery {
  keyword?: string
  action?: string
  targetType?: string
  limit?: number
}

export type AdminPublishSource = 'publish' | 'rollback'

export interface AdminPublishSummary {
  posts: number
  comments: number
  links: number
}

export interface AdminPublishRecord {
  id: string
  version: string
  source: AdminPublishSource
  note: string
  createdAt: string
  actorName: string
  summary: AdminPublishSummary
}

export interface AdminCreatePublishPreviewInput {
  expiresInMinutes?: number
}

export interface AdminPublishPreviewPayload {
  previewUrl: string
  token: string
  expiresAt: string
}

export interface AdminCommitPublishInput {
  version: string
  note: string
}

export interface AdminRollbackPublishInput {
  targetRecordId: string
  reason: string
}

export interface AdminMediaItem {
  id: string
  name: string
  url: string
  mimeType: string
  size: number
  width?: number
  height?: number
  uploadedAt: string
  uploadedBy: string
  inUse?: boolean
  usageCount?: number
}

export interface AdminMediaQuery {
  keyword?: string
  mimeType?: string
  limit?: number
}

export interface AdminUploadMediaInput {
  name: string
  url: string
  mimeType: string
  size: number
  width?: number
  height?: number
}

export interface AdminSignedUploadUrlInput {
  name: string
  mimeType: string
  size: number
  width?: number
  height?: number
}

export interface AdminSignedUploadUrlPayload {
  uploadUrl: string
  objectKey: string
  publicUrl: string
  expiresAt: string
}

export interface AdminMultipartUploadInitInput {
  name: string
  mimeType: string
  size: number
  width?: number
  height?: number
  partSize?: number
  totalParts?: number
}

export interface AdminMultipartUploadInitPayload {
  sessionId: string
  objectKey: string
  publicUrl: string
  partSize: number
  totalParts: number
  expiresAt: string
}

export interface AdminMultipartPresignPartInput {
  sessionId: string
  partNumber: number
}

export interface AdminMultipartPresignPartPayload {
  sessionId: string
  partNumber: number
  uploadUrl: string
  expiresAt: string
}

export interface AdminMultipartCompletePart {
  partNumber: number
  etag?: string
}

export interface AdminMultipartCompleteInput {
  sessionId: string
  parts: AdminMultipartCompletePart[]
}

export interface AdminMultipartAbortInput {
  sessionId: string
}

export interface AdminDeleteMediaInput {
  force?: boolean
  reason?: string
}

export interface AdminDeleteMediaResult {
  id: string
  deletedAt?: string
  forced: boolean
  usageCount: number
}

export interface AdminCleanupMediaInput {
  dryRun?: boolean
}

export interface AdminCleanupMediaFailure {
  mediaId?: string
  fileName?: string
  reason: string
}

export interface AdminCleanupMediaResult {
  dryRun: boolean
  processedDeletedRecords: number
  removedMetadataRecords: number
  removedLocalFiles: number
  removedMinioObjects?: number
  orphanLocalFilesDetected: number
  orphanLocalFilesRemoved: number
  orphanMinioObjectsDetected?: number
  orphanMinioObjectsRemoved?: number
  orphanMultipartUploadsDetected?: number
  orphanMultipartUploadsAborted?: number
  failures: AdminCleanupMediaFailure[]
}

export interface AdminAccessUser {
  id: string
  email: string
  displayName: string
  roles: AdminRoleCode[]
  permissions: string[]
  disabled?: boolean
  updatedAt: string
}

export interface AdminAccessSnapshot {
  users: AdminAccessUser[]
  rolePermissions: Record<AdminRoleCode, string[]>
  availablePermissions: string[]
}

export interface AdminUpdateUserAccessInput {
  userId: string
  roles: AdminRoleCode[]
  permissions: string[]
  disabled: boolean
}

export interface AdminPostQuery {
  keyword?: string
  category?: string
  tag?: string
  limit?: number
}

export interface AdminCommentQuery {
  keyword?: string
  postId?: string
  status?: BlogCommentStatus
  limit?: number
}

export interface AdminCommentListItem extends BlogComment {
  postId: string
  postTitle: string
}

export interface AdminBatchCommentStatusItem {
  postId: string
  commentId: string
  status: BlogCommentStatus
}

export interface AdminBatchCommentDeleteItem {
  postId: string
  commentId: string
}

export interface AdminBatchCommentStatusInput {
  items: AdminBatchCommentStatusItem[]
}

export interface AdminBatchCommentDeleteInput {
  items: AdminBatchCommentDeleteItem[]
}

export interface AdminBatchCommentStatusResult {
  updatedCount: number
}

export interface AdminBatchCommentDeleteResult {
  deletedCount: number
}

export interface AdminApiResponse<T> {
  data: T
  message?: string
  requestId?: string
}
