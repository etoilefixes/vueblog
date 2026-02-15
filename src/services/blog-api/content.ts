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
import { blogApiEndpoints, requestJson } from './core'

export const createBlogContentApi = () => {
  return {
    async getBootstrapData(): Promise<BlogBootstrapPayload> {
      return requestJson<BlogBootstrapPayload>(blogApiEndpoints.bootstrap)
    },

    async createComment(postId: string, input: CreateCommentInput): Promise<BlogComment> {
      return requestJson<BlogComment>(blogApiEndpoints.comments(postId), {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    async toggleCommentLike(
      postId: string,
      commentId: string,
      input: ToggleCommentLikeInput,
    ): Promise<BlogComment> {
      return requestJson<BlogComment>(blogApiEndpoints.commentLike(postId, commentId), {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
    },

    async updateComment(
      postId: string,
      commentId: string,
      input: UpdateCommentInput,
    ): Promise<BlogComment> {
      return requestJson<BlogComment>(blogApiEndpoints.commentById(postId, commentId), {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
    },

    async deleteComment(postId: string, commentId: string): Promise<void> {
      await requestJson<void>(blogApiEndpoints.commentById(postId, commentId), {
        method: 'DELETE',
      })
    },

    async upsertPost(input: UpsertBlogPostInput): Promise<BlogPost> {
      if (input.id) {
        return requestJson<BlogPost>(blogApiEndpoints.postById(input.id), {
          method: 'PUT',
          body: JSON.stringify(input),
        })
      }

      return requestJson<BlogPost>(blogApiEndpoints.posts, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    async deletePost(postId: string): Promise<void> {
      await requestJson<void>(blogApiEndpoints.postById(postId), {
        method: 'DELETE',
      })
    },

    async updateSiteProfile(input: UpdateSiteProfileInput): Promise<SiteProfile> {
      return requestJson<SiteProfile>(blogApiEndpoints.profile, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
    },

    async updateSiteFooter(input: UpdateSiteFooterInput): Promise<SiteFooterInfo> {
      return requestJson<SiteFooterInfo>(blogApiEndpoints.footer, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
    },

    async replaceFriendLinks(links: FriendLink[]): Promise<FriendLink[]> {
      return requestJson<FriendLink[]>(blogApiEndpoints.links, {
        method: 'PUT',
        body: JSON.stringify({ links }),
      })
    },

    async replaceAboutSections(sections: AboutSection[]): Promise<AboutSection[]> {
      return requestJson<AboutSection[]>(blogApiEndpoints.about, {
        method: 'PUT',
        body: JSON.stringify({ sections }),
      })
    },

    async replaceProjects(projects: CustomProject[]): Promise<CustomProject[]> {
      return requestJson<CustomProject[]>(blogApiEndpoints.projects, {
        method: 'PUT',
        body: JSON.stringify({ projects }),
      })
    },
  }
}
