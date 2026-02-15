import type { FastifyRequest } from 'fastify'

interface RateLimitPolicy {
  readonly id: string
  readonly max: number
  readonly windowMs: number
  readonly matcher: (request: FastifyRequest) => boolean
}

interface RateLimitState {
  count: number
  resetAt: number
}

interface RateLimitResult {
  readonly allowed: boolean
  readonly limit: number
  readonly remaining: number
  readonly retryAfterSeconds: number
}

const keyForRequest = (policyId: string, request: FastifyRequest) => {
  const ip = request.ip || 'unknown'
  return `${policyId}:${ip}`
}

export class RequestRateLimiter {
  private readonly store = new Map<string, RateLimitState>()
  private sweepCursor = 0

  constructor(private readonly policies: readonly RateLimitPolicy[]) {}

  check(request: FastifyRequest): RateLimitResult | null {
    const policy = this.policies.find((item) => item.matcher(request))

    if (!policy) {
      return null
    }

    const now = Date.now()
    const key = keyForRequest(policy.id, request)
    const current = this.store.get(key)

    if (!current || current.resetAt <= now) {
      this.store.set(key, {
        count: 1,
        resetAt: now + policy.windowMs,
      })

      this.sweepOccasionally(now)
      return {
        allowed: true,
        limit: policy.max,
        remaining: Math.max(0, policy.max - 1),
        retryAfterSeconds: Math.ceil(policy.windowMs / 1_000),
      }
    }

    current.count += 1

    const remaining = Math.max(0, policy.max - current.count)
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1_000))

    this.sweepOccasionally(now)

    if (current.count > policy.max) {
      return {
        allowed: false,
        limit: policy.max,
        remaining,
        retryAfterSeconds,
      }
    }

    return {
      allowed: true,
      limit: policy.max,
      remaining,
      retryAfterSeconds,
    }
  }

  private sweepOccasionally(now: number) {
    this.sweepCursor += 1

    if (this.sweepCursor % 250 !== 0) {
      return
    }

    for (const [key, value] of this.store.entries()) {
      if (value.resetAt <= now) {
        this.store.delete(key)
      }
    }
  }
}

export type { RateLimitPolicy, RateLimitResult }
