import { adminApi } from '@/services/admin-api'
import { blogApi } from '@/services/blog-api'
import type {
  ToggleCommentLikeInput,
  UpdateCommentInput,
} from '@/types/api'
import type {
  BlogComment,
  BlogCommentStatus,
} from '@/types/blog'
import { isCommentVisible } from './blog-store-helpers'
import type { BlogState, BlogHelpers } from './blog-state'

export interface BlogCommentsOptions {
  state: BlogState
  helpers: BlogHelpers
}

export const createBlogComments = (options: BlogCommentsOptions) => {
  const { state, helpers } = options

  const getCommentsForAdmin = (postId: string) => {
    return state.commentsByPost.value[postId] ?? []
  }

  const getCommentsByPost = (postId: string) => {
    return getCommentsForAdmin(postId).filter((comment) => isCommentVisible(comment))
  }

  const replaceCommentInStore = (postId: string, nextComment: BlogComment) => {
    const current = getCommentsForAdmin(postId)

    helpers.setCommentsForPost(
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
    helpers.setCommentsForPost(
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
    helpers.setCommentsForPost(postId, [serverComment, ...getCommentsForAdmin(postId)])
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

    helpers.setCommentsForPost(postId, optimisticComments)

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

      helpers.setCommentsForPost(postId, replaced)
    } catch (error) {
      console.warn('[blog-store] 点赞同步失败，已回滚。', error)
      helpers.setCommentsForPost(postId, current)
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

      helpers.setCommentsForPost(postId, next)
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
      helpers.setCommentsForPost(postId, next)
    }
  }

  return {
    getCommentsForAdmin,
    getCommentsByPost,
    replaceCommentInStore,
    removeCommentInStore,
    addComment,
    toggleCommentLike,
    updateComment,
    removeComment,
    batchUpdateCommentStatus,
    batchRemoveComments,
  }
}

export type BlogComments = ReturnType<typeof createBlogComments>
