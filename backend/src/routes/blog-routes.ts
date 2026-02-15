import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import {
  createCommentInputSchema,
  replaceAboutSectionsInputSchema,
  replaceFriendLinksInputSchema,
  replaceProjectsInputSchema,
  toggleCommentLikeInputSchema,
  updateCommentInputSchema,
  updateSiteFooterInputSchema,
  updateSiteProfileInputSchema,
  upsertBlogPostInputSchema,
} from '../modules/blog/contracts.js'
import {
  createBlogComment,
  createBlogPost,
  deleteBlogComment,
  deleteBlogPost,
  getBlogBootstrapData,
  replaceAboutSections,
  replaceFriendLinks,
  replaceProjects,
  toggleBlogCommentLike,
  updateBlogComment,
  updateBlogPost,
  updateSiteFooter as updateBlogSiteFooter,
  updateSiteProfile as updateBlogSiteProfile,
} from '../modules/blog/state.js'
import { addAuditLog, type AdminAuthClaims } from '../modules/admin/state.js'

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

interface RegisterBlogRoutesOptions {
  ensureAccessClaims: EnsureAccessClaims
  ok: OkResponder
}

export const registerBlogRoutes = (
  server: FastifyInstance,
  { ensureAccessClaims, ok }: RegisterBlogRoutesOptions,
) => {
  server.get('/api/blog/bootstrap', async (request) => {
    const payload = await getBlogBootstrapData()
    return ok(request, payload)
  })

  server.post('/api/blog/posts', async (request, reply) => {
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

  server.put('/api/blog/posts/:postId', async (request, reply) => {
    const claims = await ensureAccessClaims(request, reply, 'post:write')

    if (!claims) {
      return
    }

    const postId = String((request.params as { postId?: string }).postId ?? '').trim()

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

  server.delete('/api/blog/posts/:postId', async (request, reply) => {
    const claims = await ensureAccessClaims(request, reply, 'post:write')

    if (!claims) {
      return
    }

    const postId = String((request.params as { postId?: string }).postId ?? '').trim()
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

  server.post('/api/blog/posts/:postId/comments', async (request, reply) => {
    const postId = String((request.params as { postId?: string }).postId ?? '').trim()
    const input = createCommentInputSchema.parse(request.body ?? {})
    const created = await createBlogComment(postId, input)

    if (!created) {
      return reply.status(404).send({
        code: 'POST_NOT_FOUND',
        message: '文章不存在',
        requestId: request.id,
      })
    }

    return ok(request, created)
  })

  server.patch('/api/blog/posts/:postId/comments/:commentId/like', async (request, reply) => {
    const params = request.params as { postId?: string; commentId?: string }
    const postId = String(params.postId ?? '').trim()
    const commentId = String(params.commentId ?? '').trim()
    const input = toggleCommentLikeInputSchema.parse(request.body ?? {})
    const next = await toggleBlogCommentLike(postId, commentId, input)

    if (!next) {
      return reply.status(404).send({
        code: 'COMMENT_NOT_FOUND',
        message: '评论不存在',
        requestId: request.id,
      })
    }

    return ok(request, next)
  })

  server.patch('/api/blog/posts/:postId/comments/:commentId', async (request, reply) => {
    const claims = await ensureAccessClaims(request, reply, 'comment:moderate')

    if (!claims) {
      return
    }

    const params = request.params as { postId?: string; commentId?: string }
    const postId = String(params.postId ?? '').trim()
    const commentId = String(params.commentId ?? '').trim()
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

  server.delete('/api/blog/posts/:postId/comments/:commentId', async (request, reply) => {
    const claims = await ensureAccessClaims(request, reply, 'comment:moderate')

    if (!claims) {
      return
    }

    const params = request.params as { postId?: string; commentId?: string }
    const postId = String(params.postId ?? '').trim()
    const commentId = String(params.commentId ?? '').trim()
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

  server.patch('/api/blog/site/profile', async (request, reply) => {
    const claims = await ensureAccessClaims(request, reply, 'site:write')

    if (!claims) {
      return
    }

    const input = updateSiteProfileInputSchema.parse(request.body ?? {})
    const next = await updateBlogSiteProfile(input)

    await addAuditLog({
      actorName: claims.displayName,
      action: 'site.profile.update',
      targetType: 'site',
      targetId: 'profile',
      summary: '更新站点资料',
      ip: request.ip,
      requestId: request.id,
    })

    return ok(request, next)
  })

  server.patch('/api/blog/site/footer', async (request, reply) => {
    const claims = await ensureAccessClaims(request, reply, 'site:write')

    if (!claims) {
      return
    }

    const input = updateSiteFooterInputSchema.parse(request.body ?? {})
    const next = await updateBlogSiteFooter(input)

    await addAuditLog({
      actorName: claims.displayName,
      action: 'site.footer.update',
      targetType: 'site',
      targetId: 'footer',
      summary: '更新前台页脚配置',
      ip: request.ip,
      requestId: request.id,
    })

    return ok(request, next)
  })

  server.put('/api/blog/site/links', async (request, reply) => {
    const claims = await ensureAccessClaims(request, reply, 'site:write')

    if (!claims) {
      return
    }

    const input = replaceFriendLinksInputSchema.parse(request.body ?? {})
    const next = await replaceFriendLinks(input.links)

    await addAuditLog({
      actorName: claims.displayName,
      action: 'site.links.replace',
      targetType: 'site',
      targetId: 'links',
      summary: `替换友链 ${next.length} 条`,
      ip: request.ip,
      requestId: request.id,
    })

    return ok(request, next)
  })

  server.put('/api/blog/site/about', async (request, reply) => {
    const claims = await ensureAccessClaims(request, reply, 'site:write')

    if (!claims) {
      return
    }

    const input = replaceAboutSectionsInputSchema.parse(request.body ?? {})
    const next = await replaceAboutSections(input.sections)

    await addAuditLog({
      actorName: claims.displayName,
      action: 'site.about.replace',
      targetType: 'site',
      targetId: 'about',
      summary: `替换关于区块 ${next.length} 条`,
      ip: request.ip,
      requestId: request.id,
    })

    return ok(request, next)
  })

  server.put('/api/blog/site/projects', async (request, reply) => {
    const claims = await ensureAccessClaims(request, reply, 'site:write')

    if (!claims) {
      return
    }

    const input = replaceProjectsInputSchema.parse(request.body ?? {})
    const next = await replaceProjects(input.projects)

    await addAuditLog({
      actorName: claims.displayName,
      action: 'site.projects.replace',
      targetType: 'site',
      targetId: 'projects',
      summary: `替换项目配置 ${next.length} 条`,
      ip: request.ip,
      requestId: request.id,
    })

    return ok(request, next)
  })
}
