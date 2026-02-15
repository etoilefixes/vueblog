import type { FastifyInstance } from 'fastify'

interface ReadinessChecks {
  postgres: boolean
  redis: boolean
  minio: boolean
}

interface RegisterHealthRoutesOptions {
  readinessCacheTtlMs: number
  runReadinessChecks: () => Promise<{
    checks: ReadinessChecks
    ready: boolean
  }>
}

let readinessCache:
  | {
      checkedAt: number
      checks: ReadinessChecks
      ready: boolean
    }
  | null = null

export const registerHealthRoutes = (
  server: FastifyInstance,
  { readinessCacheTtlMs, runReadinessChecks }: RegisterHealthRoutesOptions,
) => {
  server.get('/health/live', async () => {
    return {
      data: {
        status: 'ok',
      },
      message: 'ok',
    }
  })

  server.get('/health/ready', async (request, reply) => {
    const now = Date.now()
    const cacheValid = readinessCache !== null && now - readinessCache.checkedAt <= readinessCacheTtlMs

    const checkResult = cacheValid && readinessCache ? readinessCache : await runReadinessChecks()

    if (!cacheValid) {
      readinessCache = {
        checkedAt: now,
        checks: checkResult.checks,
        ready: checkResult.ready,
      }
    }

    if (!checkResult.ready) {
      return reply.status(503).send({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Dependency check failed',
        details: checkResult.checks,
        requestId: request.id,
      })
    }

    return {
      data: {
        status: 'ok',
        checks: checkResult.checks,
      },
      message: 'ok',
      requestId: request.id,
    }
  })
}
