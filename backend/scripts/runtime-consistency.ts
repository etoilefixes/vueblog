import 'dotenv/config'

import { pgPool } from '../src/db/client.js'
import { redis } from '../src/infra/redis/client.js'
import { ensureAdminRuntimePersistence } from '../src/modules/admin/runtime-state.js'
import { ensureBlogPersistence } from '../src/modules/blog/state.js'

const readCount = async (tableName: string) => {
  const result = await pgPool.query<{ count: string }>(
    `select count(*)::text as count from ${tableName}`,
  )
  return Number(result.rows[0]?.count ?? '0')
}

const readAdminSnapshotShape = async () => {
  const result = await pgPool.query<{ payload: unknown }>(
    `
      select payload
      from admin_runtime_snapshots
      where id = 1
      limit 1
    `,
  )

  const payload = result.rows[0]?.payload
  const safePayload = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const safeAccess =
    safePayload.accessSnapshot && typeof safePayload.accessSnapshot === 'object'
      ? (safePayload.accessSnapshot as Record<string, unknown>)
      : {}

  const multipartUploadSessions =
    safePayload.multipartUploadSessions && Array.isArray(safePayload.multipartUploadSessions)
      ? safePayload.multipartUploadSessions
      : []

  return {
    rowExists: result.rowCount > 0,
    themeRevisions: Array.isArray(safePayload.themeRevisions) ? safePayload.themeRevisions.length : 0,
    publishHistory: Array.isArray(safePayload.publishHistory) ? safePayload.publishHistory.length : 0,
    mediaList: Array.isArray(safePayload.mediaList) ? safePayload.mediaList.length : 0,
    multipartUploadSessions: multipartUploadSessions.length,
    accessUsers: Array.isArray(safeAccess.users) ? safeAccess.users.length : 0,
  }
}

const readBlogSnapshotShape = async () => {
  const result = await pgPool.query<{ payload: unknown }>(
    `
      select payload
      from blog_snapshots
      where id = 1
      limit 1
    `,
  )

  const payload = result.rows[0]?.payload
  const safePayload = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const commentsByPost =
    safePayload.commentsByPost && typeof safePayload.commentsByPost === 'object'
      ? (safePayload.commentsByPost as Record<string, unknown>)
      : {}

  const totalComments = Object.values(commentsByPost).reduce((sum, value) => {
    if (!Array.isArray(value)) {
      return sum
    }
    return sum + value.length
  }, 0)

  return {
    rowExists: result.rowCount > 0,
    posts: Array.isArray(safePayload.posts) ? safePayload.posts.length : 0,
    comments: totalComments,
  }
}

const run = async () => {
  await ensureAdminRuntimePersistence()
  await ensureBlogPersistence()

  const [
    adminSnapshot,
    blogSnapshot,
    themeCount,
    publishCount,
    accessUserCount,
    accessStateCount,
    mediaCount,
    multipartCount,
    enabledAdminCount,
    blogPostCount,
    blogCommentCount,
    blogSiteStateCount,
  ] = await Promise.all([
    readAdminSnapshotShape(),
    readBlogSnapshotShape(),
    readCount('admin_theme_revisions'),
    readCount('admin_publish_records'),
    readCount('admin_access_users'),
    readCount('admin_access_state'),
    readCount('admin_media_assets'),
    readCount('admin_multipart_upload_sessions'),
    readCount("admin_access_users where disabled = false and roles ? 'admin'"),
    readCount('blog_posts'),
    readCount('blog_comments'),
    readCount('blog_site_state'),
  ])

  const issues: string[] = []

  if (!adminSnapshot.rowExists) {
    issues.push('admin_runtime_snapshots missing id=1 row')
  }

  if (!blogSnapshot.rowExists) {
    issues.push('blog_snapshots missing id=1 row')
  }

  if (themeCount < 1) {
    issues.push('admin_theme_revisions must have at least 1 revision')
  }

  if (accessUserCount < 1) {
    issues.push('admin_access_users must have at least 1 user')
  }

  if (accessStateCount < 1) {
    issues.push('admin_access_state must have at least 1 row')
  }

  if (enabledAdminCount < 1) {
    issues.push('at least 1 enabled admin user is required')
  }

  if (blogSiteStateCount < 1) {
    issues.push('blog_site_state must have at least 1 row')
  }

  const strictChecks: Array<[string, number, number]> = [
    ['theme revisions', adminSnapshot.themeRevisions, themeCount],
    ['publish records', adminSnapshot.publishHistory, publishCount],
    ['access users', adminSnapshot.accessUsers, accessUserCount],
    ['media items', adminSnapshot.mediaList, mediaCount],
    ['multipart sessions', adminSnapshot.multipartUploadSessions, multipartCount],
    ['blog posts', blogSnapshot.posts, blogPostCount],
    ['blog comments', blogSnapshot.comments, blogCommentCount],
  ]

  for (const [label, snapshotValue, domainValue] of strictChecks) {
    if (snapshotValue !== domainValue) {
      issues.push(`${label} mismatch: snapshot=${snapshotValue} domain=${domainValue}`)
    }
  }

  console.log(`[runtime-consistency] admin_theme_revisions=${themeCount}`)
  console.log(`[runtime-consistency] admin_publish_records=${publishCount}`)
  console.log(`[runtime-consistency] admin_access_users=${accessUserCount}`)
  console.log(`[runtime-consistency] admin_access_state=${accessStateCount}`)
  console.log(`[runtime-consistency] admin_media_assets=${mediaCount}`)
  console.log(`[runtime-consistency] admin_multipart_upload_sessions=${multipartCount}`)
  console.log(`[runtime-consistency] blog_posts=${blogPostCount}`)
  console.log(`[runtime-consistency] blog_comments=${blogCommentCount}`)
  console.log(`[runtime-consistency] blog_site_state=${blogSiteStateCount}`)

  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`[runtime-consistency] FAIL: ${issue}`)
    }
    console.error('[runtime-consistency] RUNTIME_CONSISTENCY=FAIL')
    process.exitCode = 1
    return
  }

  console.log('[runtime-consistency] RUNTIME_CONSISTENCY=PASS')
}

run()
  .catch((error) => {
    console.error('[runtime-consistency] failed')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pgPool.end()

    if (redis.status !== 'end') {
      await redis.quit().catch(() => undefined)
    }
  })
