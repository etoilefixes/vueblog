import { z } from 'zod'

export const blogSnippetSchema = z.object({
  language: z.string().trim().min(1).max(24),
  code: z.string().trim().min(1).max(8_000),
})

export const blogSectionImageSchema = z.object({
  src: z.string().trim().min(1).max(300),
  alt: z.string().trim().min(1).max(120),
  caption: z.string().trim().max(240).optional(),
})

export const blogPostSectionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  paragraphs: z.array(z.string().max(4_000)).max(100),
  highlights: z.array(z.string().max(240)).max(20).optional(),
  snippet: blogSnippetSchema.optional(),
  images: z.array(blogSectionImageSchema).max(20).optional(),
})

export const blogPostSchema = z.object({
  id: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(800),
  lead: z.string().trim().min(1).max(2_000),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  category: z.string().trim().min(1).max(80),
  highlight: z.string().trim().max(80).optional(),
  views: z.number().int().min(0).optional(),
  comments: z.number().int().min(0).optional(),
  noticeTitle: z.string().trim().max(120).optional(),
  noticeLines: z.array(z.string().trim().max(200)).max(12).optional(),
  quote: z.string().trim().max(1_000).optional(),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  readingMinutes: z.number().int().positive().max(240),
  contentSections: z.array(blogPostSectionSchema).max(80),
})

const socialIconCodeSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value
  }

  const normalized = value.trim().toLowerCase()

  if (normalized === 'blibli') {
    return 'bilibili'
  }

  return normalized
}, z.enum(['github', 'email', 'bilibili', 'wechat']))

export const socialLinkSchema = z.object({
  label: z.string().trim().min(1).max(40),
  href: z.string().trim().min(1).max(300),
  icon: socialIconCodeSchema.default('github'),
  iconUrl: z.string().trim().max(300).optional(),
})

export const siteNavRouteNameValues = [
  'home',
  'tags',
  'categories',
  'timeline',
  'links',
  'about',
] as const

export const siteNavIconValues = [
  'home',
  'tag',
  'folder',
  'history',
  'link',
  'user',
  'grid',
  'sparkles',
  'compass',
  'book',
] as const

export const siteNavRouteNameSchema = z.enum(siteNavRouteNameValues)
export const siteNavIconSchema = z.enum(siteNavIconValues)
export const siteNavTabSchema = z.object({
  routeName: siteNavRouteNameSchema,
  label: z.string().trim().min(1).max(24),
  icon: siteNavIconSchema,
})

export const defaultSiteNavTabs = [
  {
    routeName: 'home',
    label: '首页',
    icon: 'home',
  },
  {
    routeName: 'tags',
    label: '标签',
    icon: 'tag',
  },
  {
    routeName: 'categories',
    label: '分类',
    icon: 'folder',
  },
  {
    routeName: 'timeline',
    label: '时间线',
    icon: 'history',
  },
  {
    routeName: 'links',
    label: '友链',
    icon: 'link',
  },
  {
    routeName: 'about',
    label: '关于',
    icon: 'user',
  },
] as const

export const siteNavTabsSchema = z
  .array(siteNavTabSchema)
  .length(siteNavRouteNameValues.length)
  .superRefine((items, ctx) => {
    const routeNames = new Set(items.map((item) => item.routeName))

    for (const routeName of siteNavRouteNameValues) {
      if (!routeNames.has(routeName)) {
        ctx.addIssue({
          code: 'custom',
          message: `Missing nav route: ${routeName}`,
        })
      }
    }
  })
  .default(defaultSiteNavTabs.map((item) => ({ ...item })))

export const siteProfileSchema = z.object({
  title: z.string().trim().min(1).max(120).default('mereiith Blog'),
  favicon: z.string().trim().min(1).max(300).default('/favicon.ico'),
  name: z.string().trim().min(1).max(80),
  motto: z.string().trim().min(1).max(200),
  avatar: z.string().trim().min(1).max(300),
  homePageMaxPosts: z.number().int().min(1).max(20).default(5),
  socials: z.array(socialLinkSchema).max(20),
  navTabs: siteNavTabsSchema,
})

export const siteFooterSchema = z.object({
  icp: z.string().trim().min(1).max(120),
  icpLink: z.string().trim().max(300).optional(),
  icpLocked: z.boolean().optional(),
  runtime: z.string().trim().min(1).max(300),
  runtimeMode: z.enum(['manual', 'auto']).optional(),
  runtimeStartedAt: z.iso.datetime().optional(),
  poweredBy: z.string().trim().min(1).max(80),
  copyright: z.string().trim().min(1).max(80),
})

export const friendLinkSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  url: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(300),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
})

export const aboutSectionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(6_000),
})

export const customProjectSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  status: z.string().trim().min(1).max(40),
  summary: z.string().trim().min(1).max(800),
  techStack: z.array(z.string().trim().min(1).max(40)).max(30),
})

export const blogCommentSchema = z.object({
  id: z.string().trim().min(1).max(120),
  author: z.string().trim().min(1).max(60),
  role: z.enum(['作者', '访客']).optional(),
  content: z.string().trim().min(1).max(2_000),
  createdAt: z.iso.datetime(),
  likes: z.number().int().min(0),
  likedByViewer: z.boolean().optional(),
  status: z.enum(['visible', 'pending', 'hidden']).optional(),
})

export const blogBootstrapSchema = z.object({
  profile: siteProfileSchema,
  footerInfo: siteFooterSchema,
  posts: z.array(blogPostSchema).max(2_000),
  links: z.array(friendLinkSchema).max(2_000),
  about: z.array(aboutSectionSchema).max(2_000),
  projects: z.array(customProjectSchema).max(2_000).default([]),
  commentsByPost: z.record(z.string(), z.array(blogCommentSchema).max(2_000)),
})

export const createCommentInputSchema = z.object({
  author: z.string().trim().max(60).default('匿名读者'),
  content: z.string().trim().min(1).max(2_000),
})

export const toggleCommentLikeInputSchema = z.object({
  likedByViewer: z.boolean(),
})

export const updateCommentInputSchema = z
  .object({
    content: z.string().trim().min(1).max(2_000).optional(),
    status: z.enum(['visible', 'pending', 'hidden']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export const upsertBlogPostInputSchema = blogPostSchema.omit({ id: true }).extend({
  id: z.string().trim().min(1).max(120).optional(),
})

export const updateSiteProfileInputSchema = siteProfileSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export const updateSiteFooterInputSchema = siteFooterSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export const replaceFriendLinksInputSchema = z.object({
  links: z.array(friendLinkSchema).max(2_000),
})

export const replaceAboutSectionsInputSchema = z.object({
  sections: z.array(aboutSectionSchema).max(2_000),
})

export const replaceProjectsInputSchema = z.object({
  projects: z.array(customProjectSchema).max(2_000),
})

export type BlogBootstrapPayload = z.infer<typeof blogBootstrapSchema>
export type BlogPost = z.infer<typeof blogPostSchema>
export type BlogComment = z.infer<typeof blogCommentSchema>
export type CreateCommentInput = z.infer<typeof createCommentInputSchema>
export type ToggleCommentLikeInput = z.infer<typeof toggleCommentLikeInputSchema>
export type UpdateCommentInput = z.infer<typeof updateCommentInputSchema>
export type UpsertBlogPostInput = z.infer<typeof upsertBlogPostInputSchema>
export type UpdateSiteProfileInput = z.infer<typeof updateSiteProfileInputSchema>
export type UpdateSiteFooterInput = z.infer<typeof updateSiteFooterInputSchema>
export type FriendLink = z.infer<typeof friendLinkSchema>
export type AboutSection = z.infer<typeof aboutSectionSchema>
export type CustomProject = z.infer<typeof customProjectSchema>
