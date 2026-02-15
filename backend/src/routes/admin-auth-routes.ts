import type { FastifyInstance, FastifyRequest } from 'fastify'

import { env } from '../config/env.js'
import {
  adminLoginInputSchema,
  adminLogoutInputSchema,
  adminRefreshInputSchema,
} from '../modules/admin/contracts.js'
import {
  addAuditLog,
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  toAccessClaims,
  verifyBootstrapCredentials,
} from '../modules/admin/state.js'

type OkResponder = <T>(request: FastifyRequest, data: T) => {
  data: T
  message: string
  requestId: string
}

interface RegisterAdminAuthRoutesOptions {
  ok: OkResponder
}

export const registerAdminAuthRoutes = (
  server: FastifyInstance,
  { ok }: RegisterAdminAuthRoutesOptions,
) => {
  server.post('/api/admin/auth/login', async (request, reply) => {
    const input = adminLoginInputSchema.parse(request.body ?? {})
    const user = verifyBootstrapCredentials(input.email, input.password)

    if (!user) {
      return reply.status(401).send({
        code: 'INVALID_CREDENTIALS',
        message: '邮箱或密码错误',
        requestId: request.id,
      })
    }

    const accessToken = server.jwt.sign(toAccessClaims(user), {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    })
    const refresh = await issueRefreshToken(user, {
      ip: request.ip,
      userAgent: String(request.headers['user-agent'] ?? 'unknown'),
    })

    await addAuditLog({
      actorName: user.displayName,
      action: 'auth.login',
      targetType: 'session',
      targetId: user.id,
      summary: '管理员登录',
      ip: request.ip,
      requestId: request.id,
    })

    return ok(request, {
      user,
      tokens: {
        accessToken,
        refreshToken: refresh.refreshToken,
        expiresAt: refresh.expiresAt,
      },
    })
  })

  server.post('/api/admin/auth/refresh', async (request, reply) => {
    const input = adminRefreshInputSchema.parse(request.body ?? {})
    const user = await rotateRefreshToken(input.refreshToken)

    if (!user) {
      return reply.status(401).send({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'refreshToken 无效或已过期',
        requestId: request.id,
      })
    }

    const accessToken = server.jwt.sign(toAccessClaims(user), {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    })
    const refresh = await issueRefreshToken(user, {
      ip: request.ip,
      userAgent: String(request.headers['user-agent'] ?? 'unknown'),
    })

    await addAuditLog({
      actorName: user.displayName,
      action: 'auth.refresh',
      targetType: 'session',
      targetId: user.id,
      summary: '刷新登录态',
      ip: request.ip,
      requestId: request.id,
    })

    return ok(request, {
      accessToken,
      refreshToken: refresh.refreshToken,
      expiresAt: refresh.expiresAt,
    })
  })

  server.post('/api/admin/auth/logout', async (request) => {
    const input = adminLogoutInputSchema.parse(request.body ?? {})

    if (input.refreshToken) {
      await revokeRefreshToken(input.refreshToken)
    }

    return ok(request, null)
  })
}
