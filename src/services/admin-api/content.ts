import type {
  AdminAuditLog,
  AdminAuditLogQuery,
  AdminBatchCommentDeleteInput,
  AdminBatchCommentDeleteResult,
  AdminBatchCommentStatusInput,
  AdminBatchCommentStatusResult,
  AdminCommentListItem,
  AdminCommentQuery,
  AdminCreateThemeRevisionInput,
  AdminDashboardOverview,
  AdminPostQuery,
  AdminThemeRevision,
} from '@/types/admin'
import type { UpdateCommentInput, UpsertBlogPostInput } from '@/types/api'
import type { BlogComment, BlogPost, SiteFooterInfo } from '@/types/blog'
import { adminApiEndpoints, requestJson } from './core'

export const createAdminContentApi = () => {
  return {
    async getDashboardOverview(): Promise<AdminDashboardOverview> {
      return requestJson<AdminDashboardOverview>(adminApiEndpoints.dashboardOverview)
    },

    async getThemeRevisions(): Promise<AdminThemeRevision[]> {
      return requestJson<AdminThemeRevision[]>(adminApiEndpoints.themeRevisions)
    },

    async createThemeRevision(input: AdminCreateThemeRevisionInput): Promise<AdminThemeRevision> {
      return requestJson<AdminThemeRevision>(adminApiEndpoints.themeRevisions, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    async activateThemeRevision(revisionId: string): Promise<AdminThemeRevision> {
      return requestJson<AdminThemeRevision>(adminApiEndpoints.activateThemeRevision(revisionId), {
        method: 'POST',
      })
    },

    async getAuditLogs(query: AdminAuditLogQuery = {}): Promise<AdminAuditLog[]> {
      const params = new URLSearchParams()

      if (query.keyword?.trim()) {
        params.set('keyword', query.keyword.trim())
      }

      if (query.action?.trim()) {
        params.set('action', query.action.trim())
      }

      if (query.targetType?.trim()) {
        params.set('targetType', query.targetType.trim())
      }

      if (query.limit !== undefined) {
        params.set('limit', String(query.limit))
      }

      const search = params.toString()
      const endpoint = search
        ? `${adminApiEndpoints.auditLogs}?${search}`
        : adminApiEndpoints.auditLogs

      return requestJson<AdminAuditLog[]>(endpoint)
    },

    async updateSiteFooter(input: Partial<SiteFooterInfo>): Promise<SiteFooterInfo> {
      return requestJson<SiteFooterInfo>(adminApiEndpoints.siteFooter, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
    },

    async getPosts(query: AdminPostQuery = {}): Promise<BlogPost[]> {
      const params = new URLSearchParams()

      if (query.keyword?.trim()) {
        params.set('keyword', query.keyword.trim())
      }

      if (query.category?.trim()) {
        params.set('category', query.category.trim())
      }

      if (query.tag?.trim()) {
        params.set('tag', query.tag.trim())
      }

      if (query.limit !== undefined) {
        params.set('limit', String(query.limit))
      }

      const search = params.toString()
      const endpoint = search ? `${adminApiEndpoints.posts}?${search}` : adminApiEndpoints.posts
      return requestJson<BlogPost[]>(endpoint)
    },

    async getPostById(postId: string): Promise<BlogPost> {
      return requestJson<BlogPost>(adminApiEndpoints.postById(postId))
    },

    async createPost(input: UpsertBlogPostInput): Promise<BlogPost> {
      return requestJson<BlogPost>(adminApiEndpoints.posts, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    async updatePost(postId: string, input: UpsertBlogPostInput): Promise<BlogPost> {
      return requestJson<BlogPost>(adminApiEndpoints.postById(postId), {
        method: 'PUT',
        body: JSON.stringify(input),
      })
    },

    async deletePost(postId: string): Promise<void> {
      await requestJson<void>(adminApiEndpoints.postById(postId), {
        method: 'DELETE',
      })
    },

    async getComments(query: AdminCommentQuery = {}): Promise<AdminCommentListItem[]> {
      const params = new URLSearchParams()

      if (query.keyword?.trim()) {
        params.set('keyword', query.keyword.trim())
      }

      if (query.postId?.trim()) {
        params.set('postId', query.postId.trim())
      }

      if (query.status?.trim()) {
        params.set('status', query.status.trim())
      }

      if (query.limit !== undefined) {
        params.set('limit', String(query.limit))
      }

      const search = params.toString()
      const endpoint = search
        ? `${adminApiEndpoints.comments}?${search}`
        : adminApiEndpoints.comments
      return requestJson<AdminCommentListItem[]>(endpoint)
    },

    async updateComment(
      postId: string,
      commentId: string,
      input: UpdateCommentInput,
    ): Promise<BlogComment> {
      return requestJson<BlogComment>(adminApiEndpoints.commentById(postId, commentId), {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
    },

    async deleteComment(postId: string, commentId: string): Promise<void> {
      await requestJson<void>(adminApiEndpoints.commentById(postId, commentId), {
        method: 'DELETE',
      })
    },

    async batchUpdateCommentStatus(
      input: AdminBatchCommentStatusInput,
    ): Promise<AdminBatchCommentStatusResult> {
      return requestJson<AdminBatchCommentStatusResult>(adminApiEndpoints.commentsBatchStatus, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    async batchDeleteComments(
      input: AdminBatchCommentDeleteInput,
    ): Promise<AdminBatchCommentDeleteResult> {
      return requestJson<AdminBatchCommentDeleteResult>(adminApiEndpoints.commentsBatchDelete, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },
  }
}
