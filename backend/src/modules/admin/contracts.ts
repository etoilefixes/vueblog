import { z } from 'zod'

export const adminLoginInputSchema = z.object({
  email: z.email().max(120),
  password: z.string().min(8).max(128),
})

export const adminRefreshInputSchema = z.object({
  refreshToken: z.string().min(20).max(300),
})

export const adminLogoutInputSchema = z.object({
  refreshToken: z.string().min(20).max(300).optional(),
})

export const adminAuditLogQuerySchema = z.object({
  keyword: z.string().trim().min(1).max(120).optional(),
  action: z.string().trim().min(1).max(80).optional(),
  targetType: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().positive().max(100).default(40),
})

const adminThemeTokensSchema = z.object({
  brand: z.string().trim().min(1).max(60),
  brandStrong: z.string().trim().min(1).max(60),
  accent: z.string().trim().min(1).max(60),
  bgMain: z.string().trim().min(1).max(60),
  ink: z.string().trim().min(1).max(60),
  surfaceGlass: z.string().trim().min(1).max(120),
  line: z.string().trim().min(1).max(120),
})

export const adminCreateThemeRevisionInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  tokens: adminThemeTokensSchema,
})

export const adminPublishPreviewInputSchema = z.object({
  expiresInMinutes: z.coerce.number().int().min(5).max(180).optional(),
})

export const adminCommitPublishInputSchema = z.object({
  version: z.string().trim().min(2).max(60),
  note: z.string().trim().min(4).max(300),
})

export const adminRollbackPublishInputSchema = z.object({
  targetRecordId: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(4).max(300),
})

export const adminMediaQuerySchema = z.object({
  keyword: z.string().trim().min(1).max(120).optional(),
  mimeType: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().positive().max(200).default(80),
})

export const adminUploadMediaInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  url: z.string().trim().min(1).max(300),
  mimeType: z.string().trim().min(1).max(80),
  size: z.coerce.number().int().positive().max(2_000_000_000),
  width: z.coerce.number().int().positive().max(20_000).optional(),
  height: z.coerce.number().int().positive().max(20_000).optional(),
})

const adminUploadMediaMetaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  mimeType: z.string().trim().min(1).max(80),
  size: z.coerce.number().int().positive().max(2_000_000_000),
  width: z.coerce.number().int().positive().max(20_000).optional(),
  height: z.coerce.number().int().positive().max(20_000).optional(),
})

export const adminSignedUploadUrlInputSchema = adminUploadMediaMetaSchema

export const adminMultipartUploadInitInputSchema = adminUploadMediaMetaSchema.extend({
  partSize: z.coerce.number().int().min(5 * 1024 * 1024).max(128 * 1024 * 1024).optional(),
  totalParts: z.coerce.number().int().positive().max(10_000).optional(),
})

export const adminMultipartPresignPartInputSchema = z.object({
  sessionId: z.string().trim().min(1).max(120),
  partNumber: z.coerce.number().int().positive().max(10_000),
})

export const adminMultipartCompleteInputSchema = z.object({
  sessionId: z.string().trim().min(1).max(120),
  parts: z
    .array(
      z.object({
        partNumber: z.coerce.number().int().positive().max(10_000),
        etag: z.string().trim().min(1).max(200).optional(),
      }),
    )
    .min(1)
    .max(10_000),
})

export const adminMultipartAbortInputSchema = z.object({
  sessionId: z.string().trim().min(1).max(120),
})

export const adminDeleteMediaInputSchema = z.object({
  force: z.coerce.boolean().optional(),
  reason: z.string().trim().max(300).optional(),
})

export const adminCleanupMediaInputSchema = z.object({
  dryRun: z.coerce.boolean().default(true),
})

export const adminUpdateUserAccessInputSchema = z.object({
  userId: z.string().trim().min(1).max(80),
  roles: z.array(z.enum(['admin', 'editor', 'operator', 'viewer'])).max(8),
  permissions: z.array(z.string().trim().min(1).max(80)).max(200),
  disabled: z.boolean(),
})

const adminCommentStatusSchema = z.enum(['visible', 'pending', 'hidden'])

export const adminPostListQuerySchema = z.object({
  keyword: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  tag: z.string().trim().min(1).max(40).optional(),
  limit: z.coerce.number().int().positive().max(200).default(80),
})

export const adminCommentListQuerySchema = z.object({
  keyword: z.string().trim().min(1).max(120).optional(),
  postId: z.string().trim().min(1).max(120).optional(),
  status: adminCommentStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(500).default(120),
})

export const adminBatchCommentStatusInputSchema = z.object({
  items: z
    .array(
      z.object({
        postId: z.string().trim().min(1).max(120),
        commentId: z.string().trim().min(1).max(120),
        status: adminCommentStatusSchema,
      }),
    )
    .min(1)
    .max(200),
})

export const adminBatchCommentDeleteInputSchema = z.object({
  items: z
    .array(
      z.object({
        postId: z.string().trim().min(1).max(120),
        commentId: z.string().trim().min(1).max(120),
      }),
    )
    .min(1)
    .max(200),
})

export const siteFooterPatchSchema = z
  .object({
    icp: z.string().max(120).optional(),
    icpLink: z.url().max(240).optional(),
    icpLocked: z.boolean().optional(),
    runtime: z.string().max(240).optional(),
    runtimeMode: z.enum(['manual', 'auto']).optional(),
    runtimeStartedAt: z.iso.datetime().optional(),
    poweredBy: z.string().max(80).optional(),
    copyright: z.string().max(80).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })
