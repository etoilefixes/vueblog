import type {
  BlogComment,
  BlogCommentStatus,
  BlogPost,
  SiteFooterInfo,
  SiteProfile,
} from '@/types/blog'
import { createDefaultNavTabs } from '@/services/site-nav'
import { normalizeSocialIconCode } from '@/services/social-icon'

export const ALL_TAG_LABEL = '全部'
export const DEFAULT_PAGE_SIZE = 5
const MIN_HOME_PAGE_MAX_POSTS = 1
const MAX_HOME_PAGE_MAX_POSTS = 20
export const SEARCH_HISTORY_STORAGE_KEY = 'blog.recent-searches'
export const MAX_RECENT_SEARCH_COUNT = 8

export const normalizeHomePageMaxPosts = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_PAGE_SIZE
  }

  const rounded = Math.trunc(value)
  return Math.min(MAX_HOME_PAGE_MAX_POSTS, Math.max(MIN_HOME_PAGE_MAX_POSTS, rounded))
}

export const readRecentSearchesFromStorage = () => {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY)

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, MAX_RECENT_SEARCH_COUNT)
  } catch {
    return []
  }
}

export const sortPostsByDate = (items: BlogPost[]) => {
  return [...items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

export const normalizeCommentStatus = (status: BlogComment['status']): BlogCommentStatus => {
  if (status === 'pending' || status === 'hidden') {
    return status
  }

  return 'visible'
}

export const isCommentVisible = (comment: BlogComment) => normalizeCommentStatus(comment.status) !== 'hidden'

export const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return '请求失败，请稍后重试'
}

export const createEmptyProfile = (): SiteProfile => ({
  title: 'Blog',
  favicon: '/favicon.ico',
  name: '',
  motto: '',
  avatar: '/avatar.svg',
  homePageMaxPosts: DEFAULT_PAGE_SIZE,
  socials: [],
  navTabs: createDefaultNavTabs(),
})

export const normalizeSiteProfile = (profile: SiteProfile): SiteProfile => {
  const avatar = profile.avatar.trim() || '/avatar.svg'

  return {
    ...profile,
    avatar,
    socials: profile.socials.map((social) => {
      const iconUrl = social.iconUrl?.trim()
      const searchText = `${social.label} ${social.href} ${iconUrl ?? ''}`

      return {
        ...social,
        icon: normalizeSocialIconCode(social.icon, searchText),
        iconUrl: iconUrl || undefined,
      }
    }),
  }
}

export const createEmptyFooterInfo = (): SiteFooterInfo => ({
  icp: '',
  icpLink: 'https://beian.miit.gov.cn/',
  icpLocked: true,
  runtime: '',
  runtimeMode: 'manual',
  runtimeStartedAt: '',
  poweredBy: '',
  copyright: '',
})
