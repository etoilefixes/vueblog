import { blogApi } from '@/services/blog-api'
import { adminApi } from '@/services/admin-api'
import {
  ALL_TAG_LABEL,
  MAX_RECENT_SEARCH_COUNT,
  getErrorMessage,
} from './blog-store-helpers'
import type {
  BlogBootstrapPayload,
  UpdateSiteFooterInput,
  UpdateSiteProfileInput,
  UpsertBlogPostInput,
} from '@/types/api'
import type {
  AboutSection,
  BlogComment,
  BlogPost,
  CustomProject,
  FriendLink,
} from '@/types/blog'
import type { BlogState, BlogHelpers } from './blog-state'

export interface BlogActionsOptions {
  state: BlogState
  helpers: BlogHelpers
}

export const createBlogActions = (options: BlogActionsOptions) => {
  const { state, helpers } = options

  const initialize = async (force = false) => {
    if (state.isInitializing.value) {
      return false
    }

    if (state.isHydrated.value && !force) {
      return true
    }

    state.isInitializing.value = true
    state.loadError.value = ''

    try {
      const payload = await blogApi.getBootstrapData()
      helpers.applyBootstrapData(payload)
      state.isHydrated.value = true
      state.lastSyncedAt.value = new Date().toISOString()
      return true
    } catch (error) {
      state.loadError.value = getErrorMessage(error)
      return false
    } finally {
      state.isInitializing.value = false
    }
  }

  const refresh = async () => {
    return initialize(true)
  }

  const recordRecentSearch = (term: string) => {
    const normalized = term.trim()

    if (!normalized) {
      return
    }

    const normalizedLower = normalized.toLowerCase()
    const nextSearches = [
      normalized,
      ...state.recentSearches.value.filter((item) => item.toLowerCase() !== normalizedLower),
    ].slice(0, MAX_RECENT_SEARCH_COUNT)

    state.recentSearches.value = nextSearches
    helpers.persistRecentSearches()
  }

  const removeRecentSearch = (term: string) => {
    const normalizedLower = term.trim().toLowerCase()

    if (!normalizedLower) {
      return
    }

    state.recentSearches.value = state.recentSearches.value.filter(
      (item) => item.toLowerCase() !== normalizedLower,
    )
    helpers.persistRecentSearches()
  }

  const clearRecentSearches = () => {
    if (state.recentSearches.value.length === 0) {
      return
    }

    state.recentSearches.value = []
    helpers.persistRecentSearches()
  }

  const savePost = async (input: UpsertBlogPostInput) => {
    const post = input.id
      ? await adminApi.updatePost(input.id, input)
      : await adminApi.createPost(input)
    helpers.upsertPostInStore(post)
    return post
  }

  const removePost = async (postId: string) => {
    await adminApi.deletePost(postId)
    helpers.removePostInStore(postId)
  }

  const updateProfile = async (input: UpdateSiteProfileInput) => {
    const { normalizeHomePageMaxPosts } = await import('./blog-store-helpers')
    const next = await blogApi.updateSiteProfile(input)
    state.profile.value = next
    state.pageSize.value = normalizeHomePageMaxPosts(next.homePageMaxPosts)
    state.currentPage.value = 1
    return next
  }

  const updateFooter = async (input: UpdateSiteFooterInput) => {
    const next = await blogApi.updateSiteFooter(input)
    state.footerInfo.value = next
    return next
  }

  const saveLinks = async (nextLinks: FriendLink[]) => {
    const next = await blogApi.replaceFriendLinks(nextLinks)
    state.links.value = next
    return next
  }

  const saveAboutSections = async (nextSections: AboutSection[]) => {
    const next = await blogApi.replaceAboutSections(nextSections)
    state.about.value = next
    return next
  }

  const saveProjects = async (nextProjects: CustomProject[]) => {
    const next = await blogApi.replaceProjects(nextProjects)
    state.projects.value = next
    return next
  }

  const setKeyword = (value: string) => {
    state.keyword.value = value
    state.currentPage.value = 1
  }

  const setActiveTag = (tag: string) => {
    state.activeTag.value = tag
    state.currentPage.value = 1
  }

  const clearFilters = () => {
    state.keyword.value = ''
    state.activeTag.value = ALL_TAG_LABEL
    state.currentPage.value = 1
  }

  const setPage = (page: number) => {
    const totalPages = Math.max(
      1,
      Math.ceil(state.posts.value.length / state.pageSize.value)
    )
    const safePage = Math.min(Math.max(page, 1), totalPages)
    state.currentPage.value = safePage
  }

  const prevPage = () => {
    if (state.currentPage.value > 1) {
      state.currentPage.value -= 1
    }
  }

  const nextPage = () => {
    const totalPages = Math.max(
      1,
      Math.ceil(state.posts.value.length / state.pageSize.value)
    )
    if (state.currentPage.value < totalPages) {
      state.currentPage.value += 1
    }
  }

  return {
    initialize,
    refresh,
    recordRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    savePost,
    removePost,
    updateProfile,
    updateFooter,
    saveLinks,
    saveAboutSections,
    saveProjects,
    setKeyword,
    setActiveTag,
    clearFilters,
    setPage,
    prevPage,
    nextPage,
  }
}

export type BlogActions = ReturnType<typeof createBlogActions>
