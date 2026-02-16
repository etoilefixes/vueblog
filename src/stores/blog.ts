import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { adminApi } from '@/services/admin-api'
import { blogApi } from '@/services/blog-api'
import { scoreWeightedSearch } from '@/services/light-search'
import {
  ALL_TAG_LABEL,
  DEFAULT_PAGE_SIZE,
  MAX_RECENT_SEARCH_COUNT,
  SEARCH_HISTORY_STORAGE_KEY,
  createEmptyFooterInfo,
  createEmptyProfile,
  getErrorMessage,
  isCommentVisible,
  normalizeCommentStatus,
  normalizeHomePageMaxPosts,
  normalizeSiteProfile,
  readRecentSearchesFromStorage,
  sortPostsByDate,
} from './blog-store-helpers'
import type {
  BlogBootstrapPayload,
  ToggleCommentLikeInput,
  UpdateCommentInput,
  UpdateSiteFooterInput,
  UpdateSiteProfileInput,
  UpsertBlogPostInput,
} from '@/types/api'
import type {
  AboutSection,
  BlogComment,
  BlogCommentStatus,
  BlogPost,
  CustomProject,
  FriendLink,
  ProfileStat,
  SiteFooterInfo,
  SiteProfile,
} from '@/types/blog'

export const useBlogStore = defineStore('blog', () => {
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

  const syncPostCommentCount = (postId: string) => {
    const nextCount =
      commentsByPost.value[postId]?.filter((comment) => isCommentVisible(comment)).length ?? 0

    posts.value = posts.value.map((post) => {
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
    posts.value = posts.value.map((post) => {
      const fallback = post.comments ?? 0
      const nextCount =
        commentsByPost.value[post.id]?.filter((comment) => isCommentVisible(comment)).length ??
        fallback

      return {
        ...post,
        comments: nextCount,
      }
    })
  }

  const applyBootstrapData = (payload: BlogBootstrapPayload) => {
    const normalizedProfile = normalizeSiteProfile(payload.profile)
    const normalizedCommentsByPost = Object.fromEntries(
      Object.entries(payload.commentsByPost).map(([postId, items]) => [
        postId,
        items.map((comment) => ({
          ...comment,
          status: normalizeCommentStatus(comment.status),
        })),
      ]),
    )

    posts.value = sortPostsByDate(payload.posts)
    profile.value = normalizedProfile
    pageSize.value = normalizeHomePageMaxPosts(normalizedProfile.homePageMaxPosts)
    currentPage.value = 1
    footerInfo.value = payload.footerInfo
    links.value = payload.links
    about.value = payload.about
    projects.value = payload.projects
    commentsByPost.value = normalizedCommentsByPost
    syncAllPostCommentCounts()
  }

  const setCommentsForPost = (postId: string, nextComments: BlogComment[]) => {
    commentsByPost.value = {
      ...commentsByPost.value,
      [postId]: nextComments.map((comment) => ({
        ...comment,
        status: normalizeCommentStatus(comment.status),
      })),
    }

    syncPostCommentCount(postId)
  }

  const upsertPostInStore = (post: BlogPost) => {
    const existingIndex = posts.value.findIndex((item) => item.id === post.id)

    if (existingIndex < 0) {
      posts.value = sortPostsByDate([post, ...posts.value])
    } else {
      const nextPosts = [...posts.value]
      nextPosts[existingIndex] = post
      posts.value = sortPostsByDate(nextPosts)
    }
  }

  const removePostInStore = (postId: string) => {
    posts.value = posts.value.filter((post) => post.id !== postId)

    if (commentsByPost.value[postId]) {
      const nextMap = { ...commentsByPost.value }
      delete nextMap[postId]
      commentsByPost.value = nextMap
    }
  }

  const initialize = async (force = false) => {
    if (isInitializing.value) {
      return false
    }

    if (isHydrated.value && !force) {
      return true
    }

    isInitializing.value = true
    loadError.value = ''

    try {
      const payload = await blogApi.getBootstrapData()
      applyBootstrapData(payload)
      isHydrated.value = true
      lastSyncedAt.value = new Date().toISOString()
      return true
    } catch (error) {
      loadError.value = getErrorMessage(error)
      return false
    } finally {
      isInitializing.value = false
    }
  }

  const refresh = async () => {
    return initialize(true)
  }

  const persistRecentSearches = () => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(
      SEARCH_HISTORY_STORAGE_KEY,
      JSON.stringify(recentSearches.value.slice(0, MAX_RECENT_SEARCH_COUNT)),
    )
  }

  const recordRecentSearch = (term: string) => {
    const normalized = term.trim()

    if (!normalized) {
      return
    }

    const normalizedLower = normalized.toLowerCase()
    const nextSearches = [
      normalized,
      ...recentSearches.value.filter((item) => item.toLowerCase() !== normalizedLower),
    ].slice(0, MAX_RECENT_SEARCH_COUNT)

    recentSearches.value = nextSearches
    persistRecentSearches()
  }

  const removeRecentSearch = (term: string) => {
    const normalizedLower = term.trim().toLowerCase()

    if (!normalizedLower) {
      return
    }

    recentSearches.value = recentSearches.value.filter(
      (item) => item.toLowerCase() !== normalizedLower,
    )
    persistRecentSearches()
  }

  const clearRecentSearches = () => {
    if (recentSearches.value.length === 0) {
      return
    }

    recentSearches.value = []
    persistRecentSearches()
  }

  const tags = computed(() => {
    const tagSet = new Set<string>()

    posts.value.forEach((post) => {
      post.tags.forEach((tag) => tagSet.add(tag))
    })

    return [ALL_TAG_LABEL, ...Array.from(tagSet)]
  })

  const postsByTag = computed(() => {
    if (activeTag.value === ALL_TAG_LABEL) {
      return posts.value
    }

    return posts.value.filter((post) => post.tags.includes(activeTag.value))
  })

  const filteredPosts = computed(() => {
    const normalizedKeyword = keyword.value.trim()

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
    return Math.max(1, Math.ceil(filteredPosts.value.length / pageSize.value))
  })

  const pageNumbers = computed(() => {
    return Array.from({ length: totalPages.value }, (_, index) => index + 1)
  })

  const canPrevPage = computed(() => currentPage.value > 1)
  const canNextPage = computed(() => currentPage.value < totalPages.value)

  const paginatedPosts = computed(() => {
    const page = Math.min(currentPage.value, totalPages.value)
    const start = (page - 1) * pageSize.value
    const end = start + pageSize.value

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

    posts.value.forEach((post) => {
      const count = categoryMap.get(post.category) ?? 0
      categoryMap.set(post.category, count + 1)
    })

    return [...categoryMap.entries()].sort((a, b) => b[1] - a[1])
  })

  const categoryCards = computed(() => {
    return categoryStats.value.map(([category, count]) => {
      const categoryPosts = posts.value.filter((post) => post.category === category)
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

    posts.value.forEach((post) => {
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
    return posts.value.map((post) => {
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
    return posts.value.reduce((total, post) => total + (post.views ?? 0), 0)
  })

  const totalComments = computed(() => {
    return posts.value.reduce((total, post) => total + (post.comments ?? 0), 0)
  })

  const postCount = computed(() => posts.value.length)

  const profileStats = computed<ProfileStat[]>(() => {
    const categories = new Set(posts.value.map((post) => post.category)).size
    const tagsCount = new Set(posts.value.flatMap((post) => post.tags)).size

    return [
      { label: '日志', value: posts.value.length },
      { label: '分类', value: categories },
      { label: '标签', value: tagsCount },
    ]
  })

  const getPostById = (id: string) => {
    return posts.value.find((post) => post.id === id) ?? null
  }

  const getAdjacentPosts = (id: string) => {
    const index = posts.value.findIndex((post) => post.id === id)

    if (index < 0) {
      return {
        previous: null,
        next: null,
      }
    }

    return {
      previous: posts.value[index + 1] ?? null,
      next: posts.value[index - 1] ?? null,
    }
  }

  const getRelatedPosts = (id: string, limit = 3) => {
    const target = getPostById(id)

    if (!target) {
      return []
    }

    return posts.value
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

  const getCommentsForAdmin = (postId: string) => {
    return commentsByPost.value[postId] ?? []
  }

  const getCommentsByPost = (postId: string) => {
    return getCommentsForAdmin(postId).filter((comment) => isCommentVisible(comment))
  }

  const replaceCommentInStore = (postId: string, nextComment: BlogComment) => {
    const current = getCommentsForAdmin(postId)

    setCommentsForPost(
      postId,
      current.map((comment) => {
        if (comment.id !== nextComment.id) {
          return comment
        }

        return nextComment
      }),
    )
  }

  const removeCommentInStore = (postId: string, commentId: string) => {
    const current = getCommentsForAdmin(postId)
    setCommentsForPost(
      postId,
      current.filter((comment) => comment.id !== commentId),
    )
  }

  const addComment = async (postId: string, payload: { author: string; content: string }) => {
    const content = payload.content.trim()

    if (!content) {
      return null
    }

    const author = payload.author.trim() || '匿名读者'
    const serverComment = await blogApi.createComment(postId, { author, content })
    setCommentsForPost(postId, [serverComment, ...getCommentsForAdmin(postId)])
    return serverComment
  }

  const toggleCommentLike = async (postId: string, commentId: string) => {
    const current = getCommentsForAdmin(postId)

    if (current.length === 0) {
      return
    }

    const target = current.find((comment) => comment.id === commentId)

    if (!target) {
      return
    }

    const likedByViewer = !target.likedByViewer
    const optimisticComments = current.map((comment) => {
      if (comment.id !== commentId) {
        return comment
      }

      return {
        ...comment,
        likedByViewer,
        likes: Math.max(0, comment.likes + (likedByViewer ? 1 : -1)),
      }
    })

    setCommentsForPost(postId, optimisticComments)

    try {
      const serverComment = await blogApi.toggleCommentLike(postId, commentId, {
        likedByViewer,
      } satisfies ToggleCommentLikeInput)

      const replaced = getCommentsForAdmin(postId).map((comment) => {
        if (comment.id !== commentId) {
          return comment
        }

        return serverComment
      })

      setCommentsForPost(postId, replaced)
    } catch (error) {
      console.warn('[blog-store] 点赞同步失败，已回滚。', error)
      setCommentsForPost(postId, current)
    }
  }

  const updateComment = async (postId: string, commentId: string, input: UpdateCommentInput) => {
    const updated = await adminApi.updateComment(postId, commentId, input)
    replaceCommentInStore(postId, updated)
    return updated
  }

  const removeComment = async (postId: string, commentId: string) => {
    await adminApi.deleteComment(postId, commentId)
    removeCommentInStore(postId, commentId)
  }

  const batchUpdateCommentStatus = async (
    updates: Array<{ postId: string; commentId: string; status: BlogCommentStatus }>,
  ) => {
    const normalized = updates.filter((item) => item.postId && item.commentId)

    if (normalized.length === 0) {
      return
    }

    await adminApi.batchUpdateCommentStatus({
      items: normalized,
    })

    const groupedByPost = new Map<string, Array<{ commentId: string; status: BlogCommentStatus }>>()

    for (const item of normalized) {
      const list = groupedByPost.get(item.postId) ?? []
      list.push({
        commentId: item.commentId,
        status: item.status,
      })
      groupedByPost.set(item.postId, list)
    }

    for (const [postId, updatesByPost] of groupedByPost.entries()) {
      const statusByCommentId = new Map(updatesByPost.map((item) => [item.commentId, item.status]))
      const next = getCommentsForAdmin(postId).map((comment) => {
        const status = statusByCommentId.get(comment.id)

        if (!status) {
          return comment
        }

        return {
          ...comment,
          status,
        }
      })

      setCommentsForPost(postId, next)
    }
  }

  const batchRemoveComments = async (targets: Array<{ postId: string; commentId: string }>) => {
    const normalized = targets.filter((item) => item.postId && item.commentId)

    if (normalized.length === 0) {
      return
    }

    await adminApi.batchDeleteComments({
      items: normalized,
    })

    const groupedByPost = new Map<string, Set<string>>()

    for (const item of normalized) {
      const ids = groupedByPost.get(item.postId) ?? new Set<string>()
      ids.add(item.commentId)
      groupedByPost.set(item.postId, ids)
    }

    for (const [postId, commentIds] of groupedByPost.entries()) {
      const next = getCommentsForAdmin(postId).filter((comment) => !commentIds.has(comment.id))
      setCommentsForPost(postId, next)
    }
  }

  const savePost = async (input: UpsertBlogPostInput) => {
    const post = input.id
      ? await adminApi.updatePost(input.id, input)
      : await adminApi.createPost(input)
    upsertPostInStore(post)
    return post
  }

  const removePost = async (postId: string) => {
    await adminApi.deletePost(postId)
    removePostInStore(postId)
  }

  const updateProfile = async (input: UpdateSiteProfileInput) => {
    const next = normalizeSiteProfile(await blogApi.updateSiteProfile(input))
    profile.value = next
    pageSize.value = normalizeHomePageMaxPosts(next.homePageMaxPosts)
    currentPage.value = 1
    return next
  }

  const updateFooter = async (input: UpdateSiteFooterInput) => {
    const next = await blogApi.updateSiteFooter(input)
    footerInfo.value = next
    return next
  }

  const saveLinks = async (nextLinks: FriendLink[]) => {
    const next = await blogApi.replaceFriendLinks(nextLinks)
    links.value = next
    return next
  }

  const saveAboutSections = async (nextSections: AboutSection[]) => {
    const next = await blogApi.replaceAboutSections(nextSections)
    about.value = next
    return next
  }

  const saveProjects = async (nextProjects: CustomProject[]) => {
    const next = await blogApi.replaceProjects(nextProjects)
    projects.value = next
    return next
  }

  const setKeyword = (value: string) => {
    keyword.value = value
    currentPage.value = 1
  }

  const setActiveTag = (tag: string) => {
    activeTag.value = tag
    currentPage.value = 1
  }

  const clearFilters = () => {
    keyword.value = ''
    activeTag.value = ALL_TAG_LABEL
    currentPage.value = 1
  }

  const setPage = (page: number) => {
    const safePage = Math.min(Math.max(page, 1), totalPages.value)
    currentPage.value = safePage
  }

  const prevPage = () => {
    if (canPrevPage.value) {
      currentPage.value -= 1
    }
  }

  const nextPage = () => {
    if (canNextPage.value) {
      currentPage.value += 1
    }
  }

  return {
    allTagLabel: ALL_TAG_LABEL,
    keyword,
    activeTag,
    currentPage,
    recentSearches,
    posts,
    profile,
    footerInfo,
    links,
    about,
    projects,
    isInitializing,
    isHydrated,
    loadError,
    lastSyncedAt,
    useBackendApi,
    tags,
    filteredPosts,
    paginatedPosts,
    pageNumbers,
    totalPages,
    canPrevPage,
    canNextPage,
    featuredPost,
    hotTags,
    categoryStats,
    categoryCards,
    tagStats,
    timelineItems,
    postCount,
    totalReadingMinutes,
    totalViews,
    totalComments,
    profileStats,
    initialize,
    refresh,
    getPostById,
    getAdjacentPosts,
    getRelatedPosts,
    getCommentsForAdmin,
    getCommentsByPost,
    addComment,
    toggleCommentLike,
    updateComment,
    removeComment,
    batchUpdateCommentStatus,
    batchRemoveComments,
    savePost,
    removePost,
    updateProfile,
    updateFooter,
    saveLinks,
    saveAboutSections,
    saveProjects,
    setKeyword,
    setActiveTag,
    recordRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    clearFilters,
    setPage,
    prevPage,
    nextPage,
  }
})
