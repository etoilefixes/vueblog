import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

import type { UpsertBlogPostInput } from '@/types/api'
import type { BlogPost } from '@/types/blog'
import { parseTagsText, uniqTags } from './content-editor-helpers'

interface UseAdminTagActionsOptions {
  allPosts: ComputedRef<BlogPost[]>
  selectedPostIds: Ref<string[]>
  saving: Ref<boolean>
  editorOpen: Ref<boolean>
  activeTag: Ref<string>
  editorForm: {
    tagsText: string
  }
  showFeedback: (text: string) => Promise<void>
  setErrorText: (text: string) => void
  savePost: (input: UpsertBlogPostInput) => Promise<unknown>
}

interface TagUsageRecord {
  tag: string
  count: number
}

const toUpsertInputFromPost = (post: BlogPost, tags: string[]): UpsertBlogPostInput => ({
  id: post.id,
  title: post.title,
  summary: post.summary,
  lead: post.lead,
  tags,
  category: post.category,
  highlight: post.highlight,
  views: post.views ?? 0,
  comments: post.comments ?? 0,
  noticeTitle: post.noticeTitle,
  noticeLines: post.noticeLines ? [...post.noticeLines] : undefined,
  quote: post.quote,
  publishedAt: post.publishedAt,
  readingMinutes: post.readingMinutes,
  contentSections: post.contentSections.map((section) => ({
    ...section,
    paragraphs: [...section.paragraphs],
    highlights: section.highlights ? [...section.highlights] : undefined,
    images: section.images ? section.images.map((image) => ({ ...image })) : undefined,
    snippet: section.snippet ? { ...section.snippet } : undefined,
  })),
})

export const useAdminTagActions = ({
  allPosts,
  selectedPostIds,
  saving,
  editorOpen,
  activeTag,
  editorForm,
  showFeedback,
  setErrorText,
  savePost,
}: UseAdminTagActionsOptions) => {
  const tagManagePending = ref(false)
  const tagSearch = ref('')
  const tagRenameSource = ref('')
  const tagRenameTarget = ref('')
  const tagDeleteTarget = ref('')
  const tagQuickAdd = ref('')

  const tagUsageRecords = computed<TagUsageRecord[]>(() => {
    const map = new Map<string, number>()

    for (const post of allPosts.value) {
      for (const tag of post.tags) {
        map.set(tag, (map.get(tag) ?? 0) + 1)
      }
    }

    return [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
      .map(([tag, count]) => ({ tag, count }))
  })

  const filteredTagUsageRecords = computed(() => {
    const normalized = tagSearch.value.trim().toLowerCase()

    if (!normalized) {
      return tagUsageRecords.value
    }

    return tagUsageRecords.value.filter((item) => item.tag.toLowerCase().includes(normalized))
  })

  const appendTagToEditor = (tag: string) => {
    const normalized = tag.trim()

    if (!normalized) {
      return
    }

    const merged = uniqTags([...parseTagsText(editorForm.tagsText), normalized])
    editorForm.tagsText = merged.join(', ')
  }

  const mutateTagsAcrossPosts = async (
    mutate: (post: BlogPost) => string[] | null,
    successText: string,
  ): Promise<boolean> => {
    if (tagManagePending.value || saving.value) {
      return false
    }

    tagManagePending.value = true
    setErrorText('')

    try {
      const tasks: Promise<unknown>[] = []

      for (const post of allPosts.value) {
        const next = mutate(post)
        if (!next) {
          continue
        }

        const normalized = uniqTags(next.map((tag) => tag.trim()).filter(Boolean))
        if (normalized.join('\u0000') === post.tags.join('\u0000')) {
          continue
        }

        tasks.push(savePost(toUpsertInputFromPost(post, normalized)))
      }

      if (tasks.length === 0) {
        await showFeedback('没有需要更新的标签')
        return false
      }

      await Promise.all(tasks)
      await showFeedback(successText)
      return true
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : '标签操作失败')
      return false
    } finally {
      tagManagePending.value = false
    }
  }

  const addTagToSelectedPosts = async (tag?: string) => {
    const nextTag = (tag || tagQuickAdd.value).trim()

    if (!nextTag) {
      setErrorText('请先填写标签名称')
      return
    }

    if (selectedPostIds.value.length === 0) {
      setErrorText('请先勾选要操作的文章')
      return
    }

    const updated = await mutateTagsAcrossPosts(
      (post) => {
        if (!selectedPostIds.value.includes(post.id)) {
          return null
        }

        return [...post.tags, nextTag]
      },
      `已为选中文章添加 #${nextTag}`,
    )

    if (!updated) {
      return
    }

    if (editorOpen.value) {
      appendTagToEditor(nextTag)
    }

    tagQuickAdd.value = ''
  }

  const renameTagGlobally = async (source?: string, target?: string) => {
    const sourceTag = (source || tagRenameSource.value).trim()
    const targetTag = (target || tagRenameTarget.value).trim()

    if (!sourceTag || !targetTag) {
      setErrorText('请选择旧标签并填写新标签')
      return
    }

    if (sourceTag === targetTag) {
      setErrorText('新旧标签不能相同')
      return
    }

    const updated = await mutateTagsAcrossPosts(
      (post) => {
        if (!post.tags.includes(sourceTag)) {
          return null
        }

        return post.tags.map((tag) => (tag === sourceTag ? targetTag : tag))
      },
      `标签 #${sourceTag} 已重命名为 #${targetTag}`,
    )

    if (!updated) {
      return
    }

    if (editorOpen.value) {
      const nextEditorTags = uniqTags(
        parseTagsText(editorForm.tagsText).map((tag) => (tag === sourceTag ? targetTag : tag)),
      )
      editorForm.tagsText = nextEditorTags.join(', ')
    }

    if (activeTag.value === sourceTag) {
      activeTag.value = targetTag
    }

    if (!source) {
      tagRenameTarget.value = ''
    }
  }

  const deleteTagGlobally = async (target?: string) => {
    const targetTag = (target || tagDeleteTarget.value).trim()

    if (!targetTag) {
      setErrorText('请选择要删除的标签')
      return
    }

    const updated = await mutateTagsAcrossPosts(
      (post) => {
        if (!post.tags.includes(targetTag)) {
          return null
        }

        return post.tags.filter((tag) => tag !== targetTag)
      },
      `标签 #${targetTag} 已从相关文章移除`,
    )

    if (!updated) {
      return
    }

    if (editorOpen.value) {
      const nextEditorTags = parseTagsText(editorForm.tagsText).filter((tag) => tag !== targetTag)
      editorForm.tagsText = nextEditorTags.join(', ')
    }

    if (activeTag.value === targetTag) {
      activeTag.value = 'all'
    }
  }



  return {
    addTagToSelectedPosts,
    appendTagToEditor,
    deleteTagGlobally,
    filteredTagUsageRecords,
    renameTagGlobally,
    tagUsageRecords,
    tagDeleteTarget,
    tagManagePending,
    tagQuickAdd,
    tagRenameSource,
    tagRenameTarget,
    tagSearch,
  }
}
