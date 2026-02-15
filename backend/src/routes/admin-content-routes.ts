import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import {
  adminBatchCommentDeleteInputSchema,
  adminBatchCommentStatusInputSchema,
  adminCommentListQuerySchema,
  adminPostListQuerySchema,
} from '../modules/admin/contracts.js'
import { addAuditLog, type AdminAuthClaims } from '../modules/admin/state.js'
import { upsertBlogPostInputSchema, updateCommentInputSchema } from '../modules/blog/contracts.js'
import {
  createBlogPost,
  deleteBlogComment,
  deleteBlogPost,
  getBlogBootstrapData,
  updateBlogComment,
  updateBlogPost,
} from '../modules/blog/state.js'

type EnsureAccessClaims = (
  request: FastifyRequest,
  reply: FastifyReply,
  requiredPermission?: string,
) => Promise<AdminAuthClaims | null>

type OkResponder = <T>(request: FastifyRequest, data: T) => {
  data: T
  message: string
  requestId: string
}

interface RegisterAdminContentRoutesOptions {
  ensureAccessClaims: EnsureAccessClaims
  ok: OkResponder
}

const readParam = (request: FastifyRequest, key: string) => {
  const raw = (request.params as Record<string, unknown> | undefined)?.[key]
  return String(raw ?? '').trim()
}

const buildCommentSearchText = (input: {
  author: string
  content: string
  postTitle: string
  postId: string
}) => {
  return `${input.author} ${input.content} ${input.postTitle} ${input.postId}`.toLowerCase()
}

export const registerAdminContentRoutes = (
  server: FastifyInstance,
  { ensureAccessClaims, ok }: RegisterAdminContentRoutesOptions,
) => {
  server.get('/api/admin/posts', async (request, reply) => {
    const claims = await ensureAccessClaims(request, reply, 'post:read')

    if (!claims) {
      return
    }

    const query = adminPostListQuerySchema.parse(request.query ?? {})
    const keyword = query.keyword?.trim().toLowerCase() ?? ''
    const category = query.category?.trim() ?? ''
    const tag = query.tag?.trim() ?? ''
    const bootstrap = await getBlogBootstrapData()

    const posts = [...bootstrap.posts]
      .filter((post) => {
        if (category && post.category !== category) {
          return false
        }

        if (tag && !post.tags.includes(tag)) {
          return false
        }

        if (!keyword) {
          return true
        }

        const searchable = `${post.title} ${post.summary} ${post.tags.join(' ')} ${post.category}`.toLowerCase()
        return searchable.includes(keyword)
      })
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, query.limit)

    return ok(request, posts)
  })

  server.get('/api/admin/posts/:postId', async (request, reply) => {
    const claims = await ensureAccessClaims(request, reply, 'post:read')

    if (!claims) {
      return
    }

    const postId = readParam(request, 'postId')

    if (!postId) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'postId is required',
        requestId: request.id,
      })
    }

    const bootstrap = await getBlogBootstrapData()
    const post = bootstrap.posts.find((item) => item.id === postId)

    if (!post) {
      return reply.status(404).send({
        code: 'POST_NOT_FOUND',
        message: '文章不存在',
        requestId: request.id,
      })
    }

    return ok(request, post)
  })

  server.post('/api/admin/posts', async (request, reply) => {
    const claims = await ensureAccessClaims(request, reply, 'post:write')

    if (!claims) {
      return
    }

    const input = upsertBlogPostInputSchema.parse(request.body ?? {})
    const created = await createBlogPost(input)

    if (!created) {
      return reply.status(409).send({
        code: 'POST_CONFLICT',
        message: '文章 ID 已存在',
        requestId: request.id,
      })
    }

    await addAuditLog({
      actorName: claims.displayName,
      action: 'post.create',
      targetType: 'post',
      targetId: created.id,
      summary: `创建文章 ${created.title}`,
      ip: request.ip,
      requestId: request.id,
    })

    return ok(request, created)
  })

  server.put('/api/admin/posts/:postId', async (request, reply) => {
    const claims = await ensureAccessClaims(request, reply, 'post:write')

    if (!claims) {
      return
    }

    const postId = readParam(request, 'postId')

    if (!postId) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'postId is required',
        requestId: request.id,
      })
    }

    const input = upsertBlogPostInputSchema.parse(request.body ?? {})
    const updated = await updateBlogPost(postId, input)

    if (!updated) {
      return reply.status(404).send({
        code: 'POST_NOT_FOUND',
        message: '文章不存在',
        requestId: request.id,
      })
    }

    await addAuditLog({
      actorName: claims.displayName,
      action: 'post.update',
      targetType: 'post',
      targetId: updated.id,
      summary: `更新文章 ${updated.title}`,
      ip: request.ip,
      requestId: request.id,
    })

    return ok(request, updated)
  })

  server.delete('/api/admin/posts/:postId', async (request, reply) => {
    const claims = await ensureAccessClaims(request, reply, 'post:write')

    if (!claims) {
      return
    }

    const postId = readParam(request, 'postId')
    const removed = await deleteBlogPost(postId)

    if (!removed) {
      return reply.status(404).send({
        code: 'POST_NOT_FOUND',
        message: '文章不存在',
        requestId: request.id,
      })
    }

    await addAuditLog({
      actorName: claims.displayName,
      action: 'post.delete',
      targetType: 'post',
      targetId: postId,
      summary: `删除文章 ${postId}`,
      ip: request.ip,
      requestId: request.id,
    })

    return ok(request, null)
  })

  server.get('/api/admin/comments', async (request, reply) => {
    const claims = await ensureAccessClaims(request, reply, 'comment:moderate')

    if (!claims) {
      return
    }

    const query = adminCommentListQuerySchema.parse(request.query ?? {})
    const keyword = query.keyword?.trim().toLowerCase() ?? ''
    const bootstrap = await getBlogBootstrapData()

    const comments = bootstrap.posts
      .flatMap((post) => {
        const postComments = bootstrap.commentsByPost[post.id] ?? []

        return postComments.map((comment) => ({
          postId: post.id,
          postTitle: post.title,
          id: comment.id,
          author: comment.author,
          content: comment.content,
          createdAt: comment.createdAt,
          likes: comment.likes,
          likedByViewer: comment.likedByViewer,
          status: comment.status ?? 'visible',
        }))
      })
      .filter((comment) => {
        if (query.postId && comment.postId !== query.postId) {
          return false
        }

        if (query.status && comment.status !== query.status) {
          return false
        }

        if (!keyword) {
          return true
        }

        return buildCommentSearchText(comment).includes(keyword)
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, query.limit)

    return ok(request, comments)
  })

  server.patch('/api/admin/posts/:postId/comments/:commentId', async (request, reply) => {
    const claims = await ensureAccessClaims(request, reply, 'comment:moderate')

    if (!claims) {
      return
    }

    const postId = readParam(request, 'postId')
    const commentId = readParam(request, 'commentId')
    const input = updateCommentInputSchema.parse(request.body ?? {})
    const updated = await updateBlogComment(postId, commentId, input)

    if (!updated) {
      return reply.status(404).send({
        code: 'COMMENT_NOT_FOUND',
        message: '评论不存在',
        requestId: request.id,
      })
    }

    await addAuditLog({
      actorName: claims.displayName,
      action: 'comment.update',
      targetType: 'comment',
      targetId: commentId,
      summary: `更新评论 ${commentId}`,
      ip: request.ip,
      requestId: request.id,
    })

    return ok(request, updated)
  })

  server.delete('/api/admin/posts/:postId/comments/:commentId', async (request, reply) => {
    const claims = await ensureAccessClaims(request, reply, 'comment:moderate')

    if (!claims) {
      return
    }

    const postId = readParam(request, 'postId')
    const commentId = readParam(request, 'commentId')
    const removed = await deleteBlogComment(postId, commentId)

    if (!removed) {
      return reply.status(404).send({
        code: 'COMMENT_NOT_FOUND',
        message: '评论不存在',
        requestId: request.id,
      })
    }

    await addAuditLog({
      actorName: claims.displayName,
      action: 'comment.delete',
      targetType: 'comment',
      targetId: commentId,
      summary: `删除评论 ${commentId}`,
      ip: request.ip,
      requestId: request.id,
    })

    return ok(request, null)
  })

  server.post('/api/admin/comments/batch-status', async (request, reply) => {
    const claims = await ensureAccessClaims(request, reply, 'comment:moderate')

    if (!claims) {
      return
    }

    const input = adminBatchCommentStatusInputSchema.parse(request.body ?? {})

    const results = await Promise.all(
      input.items.map(async (item) => {
        const updated = await updateBlogComment(item.postId, item.commentId, {
          status: item.status,
        })

        return {
          ...item,
          found: Boolean(updated),
        }
      }),
    )

    const missing = results.filter((item) => !item.found)

    if (missing.length > 0) {
      return reply.status(404).send({
        code: 'COMMENT_NOT_FOUND',
        message: `存在 ${missing.length} 条评论未找到`,
        details: {
          missing,
        },
        requestId: request.id,
      })
    }

    await addAuditLog({
      actorName: claims.displayName,
      action: 'comment.batch_status',
      targetType: 'comment',
      targetId: `batch-${Date.now().toString(36)}`,
      summary: `批量更新评论状态 ${results.length} 条`,
      ip: request.ip,
      requestId: request.id,
    })

    return ok(request, {
      updatedCount: results.length,
    })
  })

  server.post('/api/admin/comments/batch-delete', async (request, reply) => {
    const claims = await ensureAccessClaims(request, reply, 'comment:moderate')

    if (!claims) {
      return
    }

    const input = adminBatchCommentDeleteInputSchema.parse(request.body ?? {})

    const results = await Promise.all(
      input.items.map(async (item) => {
        const deleted = await deleteBlogComment(item.postId, item.commentId)

        return {
          ...item,
          found: deleted,
        }
      }),
    )

    const missing = results.filter((item) => !item.found)

    if (missing.length > 0) {
      return reply.status(404).send({
        code: 'COMMENT_NOT_FOUND',
        message: `存在 ${missing.length} 条评论未找到`,
        details: {
          missing,
        },
        requestId: request.id,
      })
    }

    await addAuditLog({
      actorName: claims.displayName,
      action: 'comment.batch_delete',
      targetType: 'comment',
      targetId: `batch-${Date.now().toString(36)}`,
      summary: `批量删除评论 ${results.length} 条`,
      ip: request.ip,
      requestId: request.id,
    })

    return ok(request, {
      deletedCount: results.length,
    })
  })
}
