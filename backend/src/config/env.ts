import { z } from 'zod'

const envBoolean = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()

    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false
    }
  }

  return value
}, z.boolean())

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  MINIO_ENDPOINT: z.string().min(1, 'MINIO_ENDPOINT is required'),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_USE_SSL: envBoolean.default(false),
  MINIO_ACCESS_KEY: z.string().min(1, 'MINIO_ACCESS_KEY is required'),
  MINIO_SECRET_KEY: z.string().min(1, 'MINIO_SECRET_KEY is required'),
  MINIO_BUCKET_PUBLIC: z.string().min(1).default('blog-public'),
  MINIO_BUCKET_PRIVATE: z.string().min(1).default('blog-private'),

  MEDIA_LOCAL_UPLOAD_DIR: z.string().min(1).default('storage/media'),
  MEDIA_LOCAL_MAX_SIZE_BYTES: z.coerce.number().int().positive().max(50 * 1024 * 1024).default(10 * 1024 * 1024),

  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),

  READINESS_CHECK_TIMEOUT_MS: z.coerce.number().int().positive().default(1_000),
  READINESS_CACHE_TTL_MS: z.coerce.number().int().positive().default(1_000),

  RATE_LIMIT_WRITE_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WRITE_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(8),
  RATE_LIMIT_LOGIN_WINDOW_MS: z.coerce.number().int().positive().default(60_000),

  ADMIN_BOOTSTRAP_EMAIL: z.email().default('admin@example.com'),
  ADMIN_BOOTSTRAP_DISPLAY_NAME: z.string().min(1).max(60).default('系统管理员'),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(8).default('change-me-please'),
  ADMIN_BOOTSTRAP_ROLES: z.string().default('admin'),
  ADMIN_BOOTSTRAP_PERMISSIONS: z
    .string()
    .default(
      '*,dashboard:read,site:read,site:write,audit:read,publish:manage,theme:write,media:write,post:read,post:write,comment:moderate,access:write',
    ),
  ADMIN_AUDIT_LOG_LIMIT: z.coerce.number().int().positive().default(500),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n')

  throw new Error(`Invalid environment variables:\n${issues}`)
}

export const env = parsed.data
