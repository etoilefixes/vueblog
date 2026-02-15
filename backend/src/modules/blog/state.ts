import { randomUUID } from 'node:crypto'

import { pgPool } from '../../db/client.js'
import { redis } from '../../infra/redis/client.js'
import { sanitizePlainText } from '../../utils/sanitize.js'
import {
  blogBootstrapSchema,
  defaultSiteNavTabs,
  siteNavRouteNameValues,
  type AboutSection,
  type BlogBootstrapPayload,
  type BlogComment,
  type BlogPost,
  type CreateCommentInput,
  type CustomProject,
  type FriendLink,
  type ToggleCommentLikeInput,
  type UpdateCommentInput,
  type UpdateSiteFooterInput,
  type UpdateSiteProfileInput,
  type UpsertBlogPostInput,
} from './contracts.js'

const snapshotId = 1
const snapshotRedisKey = 'blog:snapshot:v1'
let blogStorageReady = false
const blogPostsTableName = 'blog_posts'
const blogCommentsTableName = 'blog_comments'
const blogSiteStateTableName = 'blog_site_state'
const MIN_HOME_PAGE_MAX_POSTS = 1
const MAX_HOME_PAGE_MAX_POSTS = 20
type SiteNavRouteName = (typeof siteNavRouteNameValues)[number]
type SiteNavTab = BlogBootstrapPayload['profile']['navTabs'][number]

interface BlogPayloadRow {
  payload: unknown
}

interface BlogCommentPayloadRow {
  post_id: string
  payload: unknown
}

interface BlogSiteStateRow {
  profile: unknown
  footer_info: unknown
  links: unknown
  about: unknown
  projects: unknown
}

const normalizeHomePageMaxPosts = (value: number) => {
  const rounded = Math.trunc(value)
  return Math.min(MAX_HOME_PAGE_MAX_POSTS, Math.max(MIN_HOME_PAGE_MAX_POSTS, rounded))
}

const defaultSiteNavTabByRoute = defaultSiteNavTabs.reduce<Record<SiteNavRouteName, SiteNavTab>>(
  (acc, item) => {
    acc[item.routeName] = { ...item }
    return acc
  },
  {} as Record<SiteNavRouteName, SiteNavTab>,
)

const sanitizeNavTabs = (tabs: ReadonlyArray<SiteNavTab>): SiteNavTab[] => {
  const currentByRoute = new Map<SiteNavRouteName, SiteNavTab>()

  for (const tab of tabs) {
    if (!currentByRoute.has(tab.routeName)) {
      currentByRoute.set(tab.routeName, tab)
    }
  }

  return siteNavRouteNameValues.map((routeName) => {
    const fallback = defaultSiteNavTabByRoute[routeName]
    const current = currentByRoute.get(routeName)
    const label = sanitizePlainText(current?.label ?? fallback.label, {
      maxLength: 24,
      allowNewlines: false,
    })

    return {
      routeName,
      label: label || fallback.label,
      icon: current?.icon ?? fallback.icon,
    }
  })
}

const createDefaultBootstrapState = (): BlogBootstrapPayload => {
  const nowIso = new Date().toISOString()
  const today = nowIso.slice(0, 10)

  return {
    profile: {
      name: 'mereiith',
      motto: 'life is strange',
      avatar: '/avatar.svg',
      homePageMaxPosts: 5,
      socials: [
        {
          label: 'Github',
          href: 'https://github.com',
          icon: 'github',
        },
      ],
      navTabs: defaultSiteNavTabs.map((item) => ({ ...item })),
    },
    footerInfo: {
      icp: 'ICP 编号：待补充',
      icpLink: 'https://beian.miit.gov.cn/',
      icpLocked: true,
      runtime: '本站运行中',
      runtimeMode: 'auto',
      runtimeStartedAt: nowIso,
      poweredBy: 'Powered By',
      copyright: `© ${new Date().getFullYear()}`,
    },
    posts: [
      {
        id: 'welcome-post',
        title: '博客后台已接入',
        summary: '后端接口已启用，后续内容可在后台直接维护。',
        lead: '如果你看到这篇文章，说明 /api/blog/bootstrap 已经打通。',
        tags: ['backend', 'integration'],
        category: '工程',
        publishedAt: today,
        readingMinutes: 2,
        views: 0,
        comments: 0,
        contentSections: [
          {
            id: 'ready',
            title: '当前状态',
            paragraphs: ['博客接口已可用，支持文章与评论读写。'],
          },
        ],
      },
    ],
    links: [],
    about: [],
    projects: [],
    commentsByPost: {
      'welcome-post': [],
    },
  }
}

const ensureCommentStatus = (status: BlogComment['status']) => {
  if (status === 'pending' || status === 'hidden') {
    return status
  }

  return 'visible'
}

const isCommentVisible = (comment: BlogComment) => ensureCommentStatus(comment.status) !== 'hidden'

const normalizeId = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (normalized) {
    return normalized
  }

  return `post-${Date.now().toString(36)}`
}

const sanitizeStringArray = (input: readonly string[], maxLength: number, allowNewlines = false) =>
  input
    .map((item) => sanitizePlainText(item, { maxLength, allowNewlines }))
    .filter(Boolean)

const sanitizePost = (input: UpsertBlogPostInput): BlogPost => {
  const id = input.id?.trim() || normalizeId(input.title)

  return {
    id,
    title: sanitizePlainText(input.title, { maxLength: 120, allowNewlines: false }),
    summary: sanitizePlainText(input.summary, { maxLength: 800 }),
    lead: sanitizePlainText(input.lead, { maxLength: 2_000 }),
    tags: sanitizeStringArray(input.tags, 40, false),
    category: sanitizePlainText(input.category, { maxLength: 80, allowNewlines: false }),
    highlight: input.highlight
      ? sanitizePlainText(input.highlight, { maxLength: 80, allowNewlines: false })
      : undefined,
    views: input.views ?? 0,
    comments: input.comments ?? 0,
    noticeTitle: input.noticeTitle
      ? sanitizePlainText(input.noticeTitle, { maxLength: 120, allowNewlines: false })
      : undefined,
    noticeLines: input.noticeLines ? sanitizeStringArray(input.noticeLines, 200) : undefined,
    quote: input.quote ? sanitizePlainText(input.quote, { maxLength: 1_000 }) : undefined,
    publishedAt: input.publishedAt,
    readingMinutes: input.readingMinutes,
    contentSections: input.contentSections.map((section) => ({
      id: normalizeId(section.id),
      title: sanitizePlainText(section.title, { maxLength: 120, allowNewlines: false }),
      paragraphs: sanitizeStringArray(section.paragraphs, 4_000, true),
      highlights: section.highlights ? sanitizeStringArray(section.highlights, 240) : undefined,
      snippet: section.snippet
        ? {
            language: sanitizePlainText(section.snippet.language, {
              maxLength: 24,
              allowNewlines: false,
            }),
            code: sanitizePlainText(section.snippet.code, { maxLength: 8_000 }),
          }
        : undefined,
      images: section.images?.map((image) => ({
        src: sanitizePlainText(image.src, { maxLength: 300, allowNewlines: false }),
        alt: sanitizePlainText(image.alt, { maxLength: 120, allowNewlines: false }),
        caption: image.caption
          ? sanitizePlainText(image.caption, { maxLength: 240, allowNewlines: false })
          : undefined,
      })),
    })),
  }
}

const sanitizeProfilePatch = (
  current: BlogBootstrapPayload['profile'],
  input: UpdateSiteProfileInput,
) => {
  return {
    name:
      input.name !== undefined
        ? sanitizePlainText(input.name, { maxLength: 80, allowNewlines: false })
        : current.name,
    motto: input.motto !== undefined ? sanitizePlainText(input.motto, { maxLength: 200 }) : current.motto,
    avatar:
      input.avatar !== undefined
        ? sanitizePlainText(input.avatar, { maxLength: 300, allowNewlines: false })
        : current.avatar,
    homePageMaxPosts:
      input.homePageMaxPosts !== undefined
        ? normalizeHomePageMaxPosts(input.homePageMaxPosts)
        : normalizeHomePageMaxPosts(current.homePageMaxPosts),
    socials:
      input.socials !== undefined
        ? input.socials.map((item) => ({
            label: sanitizePlainText(item.label, { maxLength: 40, allowNewlines: false }),
            href: sanitizePlainText(item.href, { maxLength: 300, allowNewlines: false }),
            icon: item.icon,
          }))
        : current.socials,
    navTabs:
      input.navTabs !== undefined
        ? sanitizeNavTabs(input.navTabs)
        : sanitizeNavTabs(current.navTabs),
  }
}

const sanitizeFooterPatch = (
  current: BlogBootstrapPayload['footerInfo'],
  input: UpdateSiteFooterInput,
) => {
  return {
    icp: input.icp !== undefined ? sanitizePlainText(input.icp, { maxLength: 120 }) : current.icp,
    icpLink:
      input.icpLink !== undefined
        ? sanitizePlainText(input.icpLink, { maxLength: 300, allowNewlines: false })
        : current.icpLink,
    icpLocked: input.icpLocked !== undefined ? input.icpLocked : current.icpLocked,
    runtime:
      input.runtime !== undefined ? sanitizePlainText(input.runtime, { maxLength: 300 }) : current.runtime,
    runtimeMode: input.runtimeMode !== undefined ? input.runtimeMode : current.runtimeMode,
    runtimeStartedAt:
      input.runtimeStartedAt !== undefined
        ? sanitizePlainText(input.runtimeStartedAt, { maxLength: 60, allowNewlines: false })
        : current.runtimeStartedAt,
    poweredBy:
      input.poweredBy !== undefined
        ? sanitizePlainText(input.poweredBy, { maxLength: 80, allowNewlines: false })
        : current.poweredBy,
    copyright:
      input.copyright !== undefined
        ? sanitizePlainText(input.copyright, { maxLength: 80, allowNewlines: false })
        : current.copyright,
  }
}

const syncPostCommentCount = (state: BlogBootstrapPayload, postId: string) => {
  const comments = state.commentsByPost[postId] ?? []
  const count = comments.filter((item) => isCommentVisible(item)).length

  state.posts = state.posts.map((post) => {
    if (post.id !== postId) {
      return post
    }

    return {
      ...post,
      comments: count,
    }
  })
}

const parseSnapshot = (value: unknown) => {
  const parsed = blogBootstrapSchema.safeParse(value)
  if (parsed.success) {
    return parsed.data
  }

  return createDefaultBootstrapState()
}

const readStateFromPostgres = async () => {
  const result = await pgPool.query<{
    payload: unknown
  }>(
    `
      select payload
      from blog_snapshots
      where id = $1
      limit 1
    `,
    [snapshotId],
  )

  const row = result.rows[0]
  if (!row) {
    const fallback = createDefaultBootstrapState()
    await pgPool.query(
      `
        insert into blog_snapshots (id, payload, updated_at)
        values ($1, $2::jsonb, now())
        on conflict (id) do update set
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `,
      [snapshotId, JSON.stringify(fallback)],
    )
    return fallback
  }

  return parseSnapshot(row.payload)
}

const readStateFromDomainTables = async (): Promise<BlogBootstrapPayload | null> => {
  const siteResult = await pgPool.query<BlogSiteStateRow>(
    `
      select
        profile,
        footer_info,
        links,
        about,
        projects
      from ${blogSiteStateTableName}
      where id = 1
      limit 1
    `,
  )
  const siteRow = siteResult.rows[0]

  if (!siteRow) {
    return null
  }

  const postsResult = await pgPool.query<BlogPayloadRow>(
    `
      select payload
      from ${blogPostsTableName}
      order by updated_at desc
      limit 5000
    `,
  )
  const commentsResult = await pgPool.query<BlogCommentPayloadRow>(
    `
      select post_id, payload
      from ${blogCommentsTableName}
      order by updated_at desc
      limit 20000
    `,
  )

  const posts = postsResult.rows.map((row) => row.payload)
  const commentsByPost: Record<string, unknown[]> = {}

  for (const row of commentsResult.rows) {
    const postId = sanitizePlainText(String(row.post_id ?? ''), { maxLength: 120, allowNewlines: false })

    if (!postId) {
      continue
    }

    const list = commentsByPost[postId] ?? []
    list.push(row.payload)
    commentsByPost[postId] = list
  }

  for (const post of posts) {
    if (!post || typeof post !== 'object') {
      continue
    }

    const postId = sanitizePlainText(String((post as { id?: unknown }).id ?? ''), {
      maxLength: 120,
      allowNewlines: false,
    })

    if (!postId) {
      continue
    }

    if (!commentsByPost[postId]) {
      commentsByPost[postId] = []
    }
  }

  const assembled = {
    profile: siteRow.profile,
    footerInfo: siteRow.footer_info,
    posts,
    links: siteRow.links,
    about: siteRow.about,
    projects: siteRow.projects,
    commentsByPost,
  }
  const parsed = blogBootstrapSchema.safeParse(assembled)

  if (!parsed.success) {
    return null
  }

  const snapshot = parsed.data
  snapshot.posts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

  for (const comments of Object.values(snapshot.commentsByPost)) {
    comments.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  return snapshot
}

const readState = async () => {
  const cached = await redis.get(snapshotRedisKey)

  if (cached) {
    try {
      return parseSnapshot(JSON.parse(cached))
    } catch {
      // ignore malformed cache and fallback to database.
    }
  }

  const domainState = await readStateFromDomainTables()

  if (domainState) {
    await redis.set(snapshotRedisKey, JSON.stringify(domainState))
    return domainState
  }

  const snapshot = await readStateFromPostgres()
  await syncBlogDomainTables(snapshot)
  await redis.set(snapshotRedisKey, JSON.stringify(snapshot))
  return snapshot
}

const writeState = async (state: BlogBootstrapPayload) => {
  const valid = blogBootstrapSchema.parse(state)
  await syncBlogDomainTables(valid)

  await pgPool.query(
    `
      insert into blog_snapshots (id, payload, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (id) do update set
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `,
    [snapshotId, JSON.stringify(valid)],
  )

  await redis.set(snapshotRedisKey, JSON.stringify(valid))
  return valid
}

const syncBlogDomainTables = async (state: BlogBootstrapPayload) => {
  const client = await pgPool.connect()

  try {
    await client.query('begin')
    await client.query(`delete from ${blogPostsTableName}`)

    for (const post of state.posts) {
      await client.query(
        `
          insert into ${blogPostsTableName} (
            id,
            payload,
            updated_at
          )
          values ($1, $2::jsonb, now())
        `,
        [post.id, JSON.stringify(post)],
      )
    }

    await client.query(`delete from ${blogCommentsTableName}`)

    for (const [postId, comments] of Object.entries(state.commentsByPost)) {
      for (const comment of comments) {
        await client.query(
          `
            insert into ${blogCommentsTableName} (
              post_id,
              comment_id,
              payload,
              updated_at
            )
            values ($1, $2, $3::jsonb, now())
          `,
          [postId, comment.id, JSON.stringify(comment)],
        )
      }
    }

    await client.query(
      `
        insert into ${blogSiteStateTableName} (
          id,
          profile,
          footer_info,
          links,
          about,
          projects,
          updated_at
        )
        values (1, $1::jsonb, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, now())
        on conflict (id) do update set
          profile = excluded.profile,
          footer_info = excluded.footer_info,
          links = excluded.links,
          about = excluded.about,
          projects = excluded.projects,
          updated_at = excluded.updated_at
      `,
      [
        JSON.stringify(state.profile),
        JSON.stringify(state.footerInfo),
        JSON.stringify(state.links),
        JSON.stringify(state.about),
        JSON.stringify(state.projects),
      ],
    )

    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

const backfillBlogDomainTablesFromSnapshot = async () => {
  const siteStateCountResult = await pgPool.query<{ count: string }>(
    `select count(*)::text as count from ${blogSiteStateTableName}`,
  )

  const siteStateCount = Number(siteStateCountResult.rows[0]?.count ?? '0')

  if (siteStateCount > 0) {
    return
  }

  const snapshot = await readStateFromPostgres()
  await syncBlogDomainTables(snapshot)
}

export const ensureBlogPersistence = async () => {
  if (blogStorageReady) {
    return
  }

  await pgPool.query(`
    create table if not exists blog_snapshots (
      id smallint primary key,
      payload jsonb not null,
      updated_at timestamptz not null
    )
  `)

  const exists = await pgPool.query('select 1 from blog_snapshots where id = $1', [snapshotId])
  if (exists.rowCount === 0) {
    const snapshot = createDefaultBootstrapState()
    await pgPool.query(
      `
        insert into blog_snapshots (id, payload, updated_at)
        values ($1, $2::jsonb, now())
      `,
      [snapshotId, JSON.stringify(snapshot)],
    )
  }

  await pgPool.query(`
    create table if not exists ${blogPostsTableName} (
      id varchar(160) primary key,
      payload jsonb not null,
      updated_at timestamptz not null
    )
  `)

  await pgPool.query(`
    create index if not exists idx_blog_posts_updated_at
    on ${blogPostsTableName} (updated_at desc)
  `)

  await pgPool.query(`
    create table if not exists ${blogCommentsTableName} (
      post_id varchar(160) not null,
      comment_id varchar(160) not null,
      payload jsonb not null,
      updated_at timestamptz not null,
      primary key (post_id, comment_id)
    )
  `)

  await pgPool.query(`
    create index if not exists idx_blog_comments_post
    on ${blogCommentsTableName} (post_id, updated_at desc)
  `)

  await pgPool.query(`
    create table if not exists ${blogSiteStateTableName} (
      id smallint primary key,
      profile jsonb not null,
      footer_info jsonb not null,
      links jsonb not null,
      about jsonb not null,
      projects jsonb not null,
      updated_at timestamptz not null
    )
  `)

  await backfillBlogDomainTablesFromSnapshot()

  blogStorageReady = true
}

export const getBlogBootstrapData = async () => {
  await ensureBlogPersistence()
  return await readState()
}

export const createBlogPost = async (input: UpsertBlogPostInput): Promise<BlogPost | null> => {
  await ensureBlogPersistence()

  const state = await readState()
  const next = sanitizePost(input)

  if (state.posts.some((item) => item.id === next.id)) {
    return null
  }

  state.posts = [next, ...state.posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  if (!state.commentsByPost[next.id]) {
    state.commentsByPost[next.id] = []
  }

  await writeState(state)
  return next
}

export const updateBlogPost = async (
  postId: string,
  input: UpsertBlogPostInput,
): Promise<BlogPost | null> => {
  await ensureBlogPersistence()

  const state = await readState()
  const target = state.posts.find((item) => item.id === postId)
  if (!target) {
    return null
  }

  const next = sanitizePost({
    ...input,
    id: postId,
    comments: target.comments,
    views: target.views,
  })

  state.posts = state.posts.map((item) => (item.id === postId ? next : item))
  state.posts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

  await writeState(state)
  return next
}

export const deleteBlogPost = async (postId: string): Promise<boolean> => {
  await ensureBlogPersistence()

  const state = await readState()
  const exists = state.posts.some((item) => item.id === postId)

  if (!exists) {
    return false
  }

  state.posts = state.posts.filter((item) => item.id !== postId)
  if (state.commentsByPost[postId]) {
    delete state.commentsByPost[postId]
  }

  await writeState(state)
  return true
}

export const createBlogComment = async (
  postId: string,
  input: CreateCommentInput,
): Promise<BlogComment | null> => {
  await ensureBlogPersistence()

  const state = await readState()
  const postExists = state.posts.some((item) => item.id === postId)
  if (!postExists) {
    return null
  }

  const comment: BlogComment = {
    id: `c-${Date.now()}-${randomUUID().slice(0, 8)}`,
    author: sanitizePlainText(input.author || '匿名读者', { maxLength: 60, allowNewlines: false }),
    role: '访客',
    content: sanitizePlainText(input.content, { maxLength: 2_000 }),
    createdAt: new Date().toISOString(),
    likes: 0,
    likedByViewer: false,
    status: 'visible',
  }

  const current = state.commentsByPost[postId] ?? []
  state.commentsByPost[postId] = [comment, ...current]
  syncPostCommentCount(state, postId)

  await writeState(state)
  return comment
}

export const toggleBlogCommentLike = async (
  postId: string,
  commentId: string,
  input: ToggleCommentLikeInput,
): Promise<BlogComment | null> => {
  await ensureBlogPersistence()

  const state = await readState()
  const current = state.commentsByPost[postId] ?? []
  const target = current.find((item) => item.id === commentId)
  if (!target) {
    return null
  }

  const next: BlogComment = {
    ...target,
    likedByViewer: input.likedByViewer,
    likes: Math.max(0, target.likes + (input.likedByViewer ? 1 : -1)),
  }

  state.commentsByPost[postId] = current.map((item) => (item.id === commentId ? next : item))
  await writeState(state)
  return next
}

export const updateBlogComment = async (
  postId: string,
  commentId: string,
  input: UpdateCommentInput,
): Promise<BlogComment | null> => {
  await ensureBlogPersistence()

  const state = await readState()
  const current = state.commentsByPost[postId] ?? []
  const target = current.find((item) => item.id === commentId)
  if (!target) {
    return null
  }

  const next: BlogComment = {
    ...target,
    content:
      input.content !== undefined
        ? sanitizePlainText(input.content, { maxLength: 2_000 })
        : target.content,
    status: input.status !== undefined ? input.status : ensureCommentStatus(target.status),
  }

  state.commentsByPost[postId] = current.map((item) => (item.id === commentId ? next : item))
  syncPostCommentCount(state, postId)

  await writeState(state)
  return next
}

export const deleteBlogComment = async (postId: string, commentId: string): Promise<boolean> => {
  await ensureBlogPersistence()

  const state = await readState()
  const current = state.commentsByPost[postId] ?? []
  const exists = current.some((item) => item.id === commentId)

  if (!exists) {
    return false
  }

  state.commentsByPost[postId] = current.filter((item) => item.id !== commentId)
  syncPostCommentCount(state, postId)

  await writeState(state)
  return true
}

export const updateSiteProfile = async (input: UpdateSiteProfileInput) => {
  await ensureBlogPersistence()

  const state = await readState()
  state.profile = sanitizeProfilePatch(state.profile, input)
  await writeState(state)
  return state.profile
}

export const updateSiteFooter = async (input: UpdateSiteFooterInput) => {
  await ensureBlogPersistence()

  const state = await readState()
  state.footerInfo = sanitizeFooterPatch(state.footerInfo, input)
  await writeState(state)
  return state.footerInfo
}

export const replaceFriendLinks = async (links: FriendLink[]) => {
  await ensureBlogPersistence()

  const state = await readState()
  state.links = links.map((item) => ({
    id: normalizeId(item.id || item.name),
    name: sanitizePlainText(item.name, { maxLength: 80, allowNewlines: false }),
    url: sanitizePlainText(item.url, { maxLength: 300, allowNewlines: false }),
    description: sanitizePlainText(item.description, { maxLength: 300 }),
    tags: sanitizeStringArray(item.tags, 40, false),
  }))

  await writeState(state)
  return state.links
}

export const replaceAboutSections = async (sections: AboutSection[]) => {
  await ensureBlogPersistence()

  const state = await readState()
  state.about = sections.map((item) => ({
    id: normalizeId(item.id || item.title),
    title: sanitizePlainText(item.title, { maxLength: 120, allowNewlines: false }),
    content: sanitizePlainText(item.content, { maxLength: 6_000 }),
  }))

  await writeState(state)
  return state.about
}

export const replaceProjects = async (projects: CustomProject[]) => {
  await ensureBlogPersistence()

  const state = await readState()
  state.projects = projects.map((item) => ({
    id: normalizeId(item.id || item.name),
    name: sanitizePlainText(item.name, { maxLength: 120, allowNewlines: false }),
    status: sanitizePlainText(item.status, { maxLength: 40, allowNewlines: false }),
    summary: sanitizePlainText(item.summary, { maxLength: 800 }),
    techStack: sanitizeStringArray(item.techStack, 40, false),
  }))

  await writeState(state)
  return state.projects
}
