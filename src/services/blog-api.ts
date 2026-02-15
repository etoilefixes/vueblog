import { createBlogContentApi } from './blog-api/content'
import { blogApiEndpoints } from './blog-api/core'

import type {
  AboutSection,
  BlogComment,
  BlogPost,
  CustomProject,
  FriendLink,
  SiteFooterInfo,
  SiteProfile,
} from '@/types/blog'
import type {
  BlogBootstrapPayload,
  CreateCommentInput,
  ToggleCommentLikeInput,
  UpdateCommentInput,
  UpdateSiteFooterInput,
  UpdateSiteProfileInput,
  UpsertBlogPostInput,
} from '@/types/api'

export interface BlogApiService {
  readonly useBackendApi: boolean
  readonly endpoints: typeof blogApiEndpoints
  getBootstrapData(): Promise<BlogBootstrapPayload>
  createComment(postId: string, input: CreateCommentInput): Promise<BlogComment>
  toggleCommentLike(
    postId: string,
    commentId: string,
    input: ToggleCommentLikeInput,
  ): Promise<BlogComment>
  updateComment(postId: string, commentId: string, input: UpdateCommentInput): Promise<BlogComment>
  deleteComment(postId: string, commentId: string): Promise<void>
  upsertPost(input: UpsertBlogPostInput): Promise<BlogPost>
  deletePost(postId: string): Promise<void>
  updateSiteProfile(input: UpdateSiteProfileInput): Promise<SiteProfile>
  updateSiteFooter(input: UpdateSiteFooterInput): Promise<SiteFooterInfo>
  replaceFriendLinks(links: FriendLink[]): Promise<FriendLink[]>
  replaceAboutSections(sections: AboutSection[]): Promise<AboutSection[]>
  replaceProjects(projects: CustomProject[]): Promise<CustomProject[]>
}

export { blogApiEndpoints }

const contentApi = createBlogContentApi()

export const blogApi: BlogApiService = {
  useBackendApi: true,
  endpoints: blogApiEndpoints,
  ...contentApi,
}
