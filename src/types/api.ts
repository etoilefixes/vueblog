import type {
  AboutSection,
  BlogComment,
  BlogCommentStatus,
  BlogPost,
  CustomProject,
  FriendLink,
  SiteFooterInfo,
  SiteProfile,
} from '@/types/blog'

export interface BlogBootstrapPayload {
  profile: SiteProfile
  footerInfo: SiteFooterInfo
  posts: BlogPost[]
  links: FriendLink[]
  about: AboutSection[]
  projects: CustomProject[]
  commentsByPost: Record<string, BlogComment[]>
}

export interface CreateCommentInput {
  author: string
  content: string
}

export interface ToggleCommentLikeInput {
  likedByViewer: boolean
}

export interface UpdateCommentInput {
  content?: string
  status?: BlogCommentStatus
}

export type UpsertBlogPostInput = Omit<BlogPost, 'id'> & { id?: string }

export type UpdateSiteProfileInput = Partial<SiteProfile>

export type UpdateSiteFooterInput = Partial<SiteFooterInfo>

export interface BlogApiResponse<T> {
  data: T
  message?: string
}
