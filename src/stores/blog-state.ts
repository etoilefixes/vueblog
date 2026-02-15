import { computed, ref, type Ref, type ComputedRef } from 'vue'

import { blogApi } from '@/services/blog-api'
import { scoreWeightedSearch } from '@/services/light-search'
import {
  ALL_TAG_LABEL,
  DEFAULT_PAGE_SIZE,
  MAX_RECENT_SEARCH_COUNT,
  SEARCH_HISTORY_STORAGE_KEY,
  createEmptyFooterInfo,
  createEmptyProfile,
  isCommentVisible,
  normalizeCommentStatus,
  normalizeHomePageMaxPosts,
  readRecentSearchesFromStorage,
  sortPostsByDate,
} from './blog-store-helpers'
import type { BlogBootstrapPayload } from '@/types/api'
import type {
  AboutSection,
  BlogComment,
  BlogPost,
  CustomProject,
  FriendLink,
  ProfileStat,
  SiteFooterInfo,
  SiteProfile,
} from '@/types/blog'

export interface BlogState {
  keyword: Ref<string>
  activeTag: Ref<string>
  currentPage: Ref<number>
  pageSize: Ref<number>
  recentSearches: Ref<string[]>
  isInitializing: Ref<boolean>
  isHydrated: Ref<boolean>
  loadError: Ref<string>
  lastSyncedAt: Ref<string>
  useBackendApi: typeof blogApi.useBackendApi
  posts: Ref<BlogPost[]>
  profile: Ref<SiteProfile>
  footerInfo: Ref<SiteFooterInfo>
  links: Ref<FriendLink[]>
  about: Ref<AboutSection[]>
  projects: Ref<CustomProject[]>
  commentsByPost: Ref<Record<string, BlogComment[]>>
}

export const createBlogState = (): BlogState => {
  const keyword = ref('')
  const activeTag = ref(ALL_TAG_LABEL)
  const currentPage = ref(1)
  const pageSize = ref(DEFAULT_PAGE_SIZE)
  const recentSearches = ref<string[]>(readRecentSearchesFromStorage())

  const isInitializing = ref(false)
  const isHydrated = ref(false)
  const loadError = ref('')
  const lastSyncedAt = ref('')
  const useBackendApi = blogApi.useBackendApi

  const posts = ref<BlogPost[]>([])
  const profile = ref<SiteProfile>(createEmptyProfile())
  const footerInfo = ref<SiteFooterInfo>(createEmptyFooterInfo())
  const links = ref<FriendLink[]>([])
  const about = ref<AboutSection[]>([])
  const projects = ref<CustomProject[]>([])
  const commentsByPost = ref<Record<string, BlogComment[]>>({})

  return {
    keyword,
    activeTag,
    currentPage,
    pageSize,
    recentSearches,
    isInitializing,
    isHydrated,
    loadError,
    lastSyncedAt,
    useBackendApi,
    posts,
    profile,
    footerInfo,
    links,
    about,
    projects,
    commentsByPost,
  }
}

export const createBlogGetters = (state: BlogState) => {
  const tags = computed(() => {
    const tagSet = new Set<string>()

    state.posts.value.forEach((post) => {
      post.tags.forEach((tag) => tagSet.add(tag))
    })

    return [ALL_TAG_LABEL, ...Array.from(tagSet)]
  })

  const postsByTag = computed(() => {
    if (state.activeTag.value === ALL_TAG_LABEL) {
      return state.posts.value
    }

    return state.posts.value.filter((post) => post.tags.includes(state.activeTag.value))
  })

  const filteredPosts = computed(() => {
    const normalizedKeyword = state.keyword.value.trim()

    if (!normalizedKeyword) {
      return postsByTag.value
    }

    return postsByTag.value
      .map((post) => {
        const score = scoreWeightedSearch(
          [
            { text: post.title, weight: 0.34 },
            { text: post.summary, weight: 0.24 },
            { text: post.lead, weight: 0.18 },
            { text: post.tags.join(' '), weight: 0.12 },
            { text: post.category, weight: 0.08 },
            { text: post.contentSections.map((section) => section.title).join(' '), weight: 0.03 },
            {
              text: post.contentSections
                .flatMap((section) => section.paragraphs)
                .join(' '),
              weight: 0.01,
            },
          ],
          normalizedKeyword,
        )

        return {
          post,
          score,
        }
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score
        }

        return b.post.publishedAt.localeCompare(a.post.publishedAt)
      })
      .map((item) => item.post)
  })

  const totalPages = computed(() => {
    return Math.max(1, Math.ceil(filteredPosts.value.length / state.pageSize.value))
  })

  const pageNumbers = computed(() => {
    return Array.from({ length: totalPages.value }, (_, index) => index + 1)
  })

  const canPrevPage = computed(() => state.currentPage.value > 1)
  const canNextPage = computed(() => state.currentPage.value < totalPages.value)

  const paginatedPosts = computed(() => {
    const page = Math.min(state.currentPage.value, totalPages.value)
    const start = (page - 1) * state.pageSize.value
    const end = start + state.pageSize.value

    return filteredPosts.value.slice(start, end)
  })

  const featuredPost = computed(() => {
    return filteredPosts.value.find((post) => post.highlight) ?? filteredPosts.value[0] ?? null
  })

  const hotTags = computed(() => {
    const frequencyMap = new Map<string, number>()

    filteredPosts.value.forEach((post) => {
      post.tags.forEach((tag) => {
        const count = frequencyMap.get(tag) ?? 0
        frequencyMap.set(tag, count + 1)
      })
    })

    return [...frequencyMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([tag]) => tag)
  })

  const categoryStats = computed(() => {
    const categoryMap = new Map<string, number>()

    state.posts.value.forEach((post) => {
      const count = categoryMap.get(post.category) ?? 0
      categoryMap.set(post.category, count + 1)
    })

    return [...categoryMap.entries()].sort((a, b) => b[1] - a[1])
  })

  const categoryCards = computed(() => {
    return categoryStats.value.map(([category, count]) => {
      const categoryPosts = state.posts.value.filter((post) => post.category === category)
      const readingMinutes = categoryPosts.reduce(
        (total, post) => total + post.readingMinutes,
        0,
      )

      return {
        category,
        count,
        readingMinutes,
        latestPostId: categoryPosts[0]?.id ?? '',
        latestPostTitle: categoryPosts[0]?.title ?? '暂无',
      }
    })
  })

  const tagStats = computed(() => {
    const tagMap = new Map<string, { id: string; title: string }[]>()

    state.posts.value.forEach((post) => {
      post.tags.forEach((tag) => {
        const items = tagMap.get(tag) ?? []
        items.push({
          id: post.id,
          title: post.title,
        })
        tagMap.set(tag, items)
      })
    })

    return [...tagMap.entries()]
      .map(([tag, items]) => ({
        tag,
        count: items.length,
        samplePosts: items.slice(0, 2),
      }))
      .sort((a, b) => b.count - a.count)
  })

  const timelineItems = computed(() => {
    return state.posts.value.map((post) => {
      const [year, month, day] = post.publishedAt.split('-')

      return {
        ...post,
        year,
        monthDay: `${month}.${day}`,
      }
    })
  })

  const totalReadingMinutes = computed(() => {
    return filteredPosts.value.reduce((total, post) => total + post.readingMinutes, 0)
  })

  const totalViews = computed(() => {
    return state.posts.value.reduce((total, post) => total + (post.views ?? 0), 0)
  })

  const totalComments = computed(() => {
    return state.posts.value.reduce((total, post) => total + (post.comments ?? 0), 0)
  })

  const postCount = computed(() => state.posts.value.length)

  const profileStats = computed<ProfileStat[]>(() => {
    const categories = new Set(state.posts.value.map((post) => post.category)).size
    const tagsCount = new Set(state.posts.value.flatMap((post) => post.tags)).size

    return [
      { label: '日志', value: state.posts.value.length },
      { label: '分类', value: categories },
      { label: '标签', value: tagsCount },
    ]
  })

  return {
    tags,
    postsByTag,
    filteredPosts,
    totalPages,
    pageNumbers,
    canPrevPage,
    canNextPage,
    paginatedPosts,
    featuredPost,
    hotTags,
    categoryStats,
    categoryCards,
    tagStats,
    timelineItems,
    totalReadingMinutes,
    totalViews,
    totalComments,
    postCount,
    profileStats,
  }
}

export type BlogGetters = ReturnType<typeof createBlogGetters>

export const createBlogHelpers = (state: BlogState) => {
  const syncPostCommentCount = (postId: string) => {
    const nextCount =
      state.commentsByPost.value[postId]?.filter((comment) => isCommentVisible(comment)).length ?? 0

    state.posts.value = state.posts.value.map((post) => {
      if (post.id !== postId) {
        return post
      }

      return {
        ...post,
        comments: nextCount,
      }
    })
  }

  const syncAllPostCommentCounts = () => {
    state.posts.value = state.posts.value.map((post) => {
      const fallback = post.comments ?? 0
      const nextCount =
        state.commentsByPost.value[post.id]?.filter((comment) => isCommentVisible(comment)).length ??
        fallback

      return {
        ...post,
        comments: nextCount,
      }
    })
  }

  const applyBootstrapData = (payload: BlogBootstrapPayload) => {
    const normalizedCommentsByPost = Object.fromEntries(
      Object.entries(payload.commentsByPost).map(([postId, items]) => [
        postId,
        items.map((comment) => ({
          ...comment,
          status: normalizeCommentStatus(comment.status),
        })),
      ]),
    )

    state.posts.value = sortPostsByDate(payload.posts)
    state.profile.value = payload.profile
    state.pageSize.value = normalizeHomePageMaxPosts(payload.profile.homePageMaxPosts)
    state.currentPage.value = 1
    state.footerInfo.value = payload.footerInfo
    state.links.value = payload.links
    state.about.value = payload.about
    state.projects.value = payload.projects
    state.commentsByPost.value = normalizedCommentsByPost
    syncAllPostCommentCounts()
  }

  const setCommentsForPost = (postId: string, nextComments: BlogComment[]) => {
    state.commentsByPost.value = {
      ...state.commentsByPost.value,
      [postId]: nextComments.map((comment) => ({
        ...comment,
        status: normalizeCommentStatus(comment.status),
      })),
    }

    syncPostCommentCount(postId)
  }

  const upsertPostInStore = (post: BlogPost) => {
    const existingIndex = state.posts.value.findIndex((item) => item.id === post.id)

    if (existingIndex < 0) {
      state.posts.value = sortPostsByDate([post, ...state.posts.value])
    } else {
      const nextPosts = [...state.posts.value]
      nextPosts[existingIndex] = post
      state.posts.value = sortPostsByDate(nextPosts)
    }
  }

  const removePostInStore = (postId: string) => {
    state.posts.value = state.posts.value.filter((post) => post.id !== postId)

    if (state.commentsByPost.value[postId]) {
      const nextMap = { ...state.commentsByPost.value }
      delete nextMap[postId]
      state.commentsByPost.value = nextMap
    }
  }

  const persistRecentSearches = () => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(
      SEARCH_HISTORY_STORAGE_KEY,
      JSON.stringify(state.recentSearches.value.slice(0, MAX_RECENT_SEARCH_COUNT)),
    )
  }

  const getPostById = (id: string) => {
    return state.posts.value.find((post) => post.id === id) ?? null
  }

  const getAdjacentPosts = (id: string) => {
    const index = state.posts.value.findIndex((post) => post.id === id)

    if (index < 0) {
      return {
        previous: null,
        next: null,
      }
    }

    return {
      previous: state.posts.value[index + 1] ?? null,
      next: state.posts.value[index - 1] ?? null,
    }
  }

  const getRelatedPosts = (id: string, limit = 3) => {
    const target = getPostById(id)

    if (!target) {
      return []
    }

    return state.posts.value
      .filter((post) => post.id !== id)
      .map((post) => {
        const sharedTagCount = post.tags.filter((tag) => target.tags.includes(tag)).length
        const sameCategoryScore = post.category === target.category ? 2 : 0

        return {
          post,
          score: sharedTagCount * 4 + sameCategoryScore,
        }
      })
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score
        }

        return b.post.publishedAt.localeCompare(a.post.publishedAt)
      })
      .slice(0, limit)
      .map((item) => item.post)
  }

  return {
    syncPostCommentCount,
    syncAllPostCommentCounts,
    applyBootstrapData,
    setCommentsForPost,
    upsertPostInStore,
    removePostInStore,
    persistRecentSearches,
    getPostById,
    getAdjacentPosts,
    getRelatedPosts,
  }
}

export type BlogHelpers = ReturnType<typeof createBlogHelpers>
