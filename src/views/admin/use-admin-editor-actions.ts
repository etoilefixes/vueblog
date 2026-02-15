import type { ComputedRef, Ref } from 'vue'

import type { UpsertBlogPostInput } from '@/types/api'
import type { BlogPost, BlogPostSection } from '@/types/blog'
import {
  buildStructuredSections,
  createSectionDraft,
  parseMarkdownSections,
  parseTagsText,
  serializeSectionsToMarkdown,
  type EditorSectionDraft,
} from './content-editor-helpers'

interface EditorFormState {
  id: string
  title: string
  summary: string
  lead: string
  category: string
  tagsText: string
  highlight: string
  publishedAt: string
  readingMinutes: number
  views: number
  noticeTitle: string
  noticeLinesText: string
  quote: string
}

interface UseAdminEditorActionsOptions {
  editorForm: EditorFormState
  editorMode: Ref<'create' | 'edit'>
  editorView: Ref<'edit' | 'preview'>
  editorContentMode: Ref<'structured' | 'markdown'>
  editorError: Ref<string>
  editorOpen: Ref<boolean>
  sectionDrafts: Ref<EditorSectionDraft[]>
  markdownDraft: Ref<string>
  editorSections: ComputedRef<BlogPostSection[]>
  selectedPostIds: Ref<string[]>
  saving: Ref<boolean>
  setErrorText: (value: string) => void
  showFeedback: (text: string) => Promise<void>
  closeMediaPicker: () => void
  savePost: (payload: UpsertBlogPostInput) => Promise<unknown>
  removePost: (postId: string) => Promise<unknown>
  getPostById: (postId: string) => BlogPost | null | undefined
}

export const useAdminEditorActions = ({
  editorForm,
  editorMode,
  editorView,
  editorContentMode,
  editorError,
  editorOpen,
  sectionDrafts,
  markdownDraft,
  editorSections,
  selectedPostIds,
  saving,
  setErrorText,
  showFeedback,
  closeMediaPicker,
  savePost,
  removePost,
  getPostById,
}: UseAdminEditorActionsOptions) => {
  const resetEditor = () => {
    editorForm.id = ''
    editorForm.title = ''
    editorForm.summary = ''
    editorForm.lead = ''
    editorForm.category = ''
    editorForm.tagsText = ''
    editorForm.highlight = ''
    editorForm.publishedAt = new Date().toISOString().slice(0, 10)
    editorForm.readingMinutes = 6
    editorForm.views = 0
    editorForm.noticeTitle = ''
    editorForm.noticeLinesText = ''
    editorForm.quote = ''
    editorContentMode.value = 'structured'
    sectionDrafts.value = [createSectionDraft()]
    markdownDraft.value = ''
  }

  const openCreateEditor = () => {
    editorMode.value = 'create'
    editorView.value = 'edit'
    editorError.value = ''
    resetEditor()
    editorOpen.value = true
  }

  const openEditEditor = (post: BlogPost) => {
    editorMode.value = 'edit'
    editorView.value = 'edit'
    editorContentMode.value = 'structured'
    editorError.value = ''

    editorForm.id = post.id
    editorForm.title = post.title
    editorForm.summary = post.summary
    editorForm.lead = post.lead
    editorForm.category = post.category
    editorForm.tagsText = post.tags.join(', ')
    editorForm.highlight = post.highlight ?? ''
    editorForm.publishedAt = post.publishedAt
    editorForm.readingMinutes = post.readingMinutes
    editorForm.views = post.views ?? 0
    editorForm.noticeTitle = post.noticeTitle ?? ''
    editorForm.noticeLinesText = post.noticeLines?.join('\n') ?? ''
    editorForm.quote = post.quote ?? ''
    sectionDrafts.value =
      post.contentSections.length > 0
        ? post.contentSections.map((section) => createSectionDraft(section))
        : [createSectionDraft()]
    markdownDraft.value = serializeSectionsToMarkdown(post.contentSections)

    editorOpen.value = true
  }

  const openPreviewEditor = (post: BlogPost) => {
    openEditEditor(post)
    editorView.value = 'preview'
  }

  const closeEditor = () => {
    editorOpen.value = false
    editorView.value = 'edit'
    editorError.value = ''
    closeMediaPicker()
  }

  const addSectionDraft = () => {
    sectionDrafts.value = [...sectionDrafts.value, createSectionDraft()]
  }

  const removeSectionDraft = (uid: string) => {
    if (sectionDrafts.value.length <= 1) {
      return
    }

    sectionDrafts.value = sectionDrafts.value.filter((item) => item.uid !== uid)
  }

  const setEditorContentMode = (mode: 'structured' | 'markdown') => {
    if (editorContentMode.value === mode) {
      return
    }

    if (mode === 'markdown') {
      markdownDraft.value = serializeSectionsToMarkdown(buildStructuredSections(sectionDrafts.value))
    } else {
      const parsed = parseMarkdownSections(markdownDraft.value)
      sectionDrafts.value =
        parsed.length > 0 ? parsed.map((section) => createSectionDraft(section)) : [createSectionDraft()]
    }

    editorContentMode.value = mode
  }

  const insertMarkdownSnippet = (kind: 'heading' | 'code') => {
    if (kind === 'heading') {
      const insertion = '\n## 新章节\n'
      markdownDraft.value = `${markdownDraft.value}${insertion}`.trimStart()
      return
    }

    const insertion = '\n```ts\n// 在这里写代码\n```\n'
    markdownDraft.value = `${markdownDraft.value}${insertion}`.trimStart()
  }

  const buildPayload = (): UpsertBlogPostInput => {
    const title = editorForm.title.trim()
    const summary = editorForm.summary.trim()
    const lead = editorForm.lead.trim()
    const category = editorForm.category.trim()
    const tags = parseTagsText(editorForm.tagsText)
    const noticeLines = editorForm.noticeLinesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    if (!title || !summary || !lead || !category) {
      throw new Error('标题、摘要、导语、分类不能为空')
    }

    const sections = editorSections.value

    if (sections.length === 0) {
      throw new Error(
        editorContentMode.value === 'markdown'
          ? 'Markdown 正文为空，请至少写一个章节并包含段落'
          : '至少保留 1 个有效内容章节（有标题和段落）',
      )
    }

    return {
      id: editorMode.value === 'edit' ? editorForm.id : undefined,
      title,
      summary,
      lead,
      category,
      tags,
      highlight: editorForm.highlight.trim() || undefined,
      views: Math.max(0, Number(editorForm.views) || 0),
      comments: editorMode.value === 'edit' ? getPostById(editorForm.id)?.comments ?? 0 : 0,
      noticeTitle: editorForm.noticeTitle.trim() || undefined,
      noticeLines: noticeLines.length > 0 ? noticeLines : undefined,
      quote: editorForm.quote.trim() || undefined,
      publishedAt: editorForm.publishedAt || new Date().toISOString().slice(0, 10),
      readingMinutes: Math.max(1, Number(editorForm.readingMinutes) || 1),
      contentSections: sections,
    }
  }

  const submitEditor = async () => {
    if (saving.value) {
      return
    }

    editorError.value = ''
    setErrorText('')
    saving.value = true

    try {
      const payload = buildPayload()
      await savePost(payload)
      closeEditor()
      selectedPostIds.value = []
      await showFeedback(editorMode.value === 'create' ? '文章创建成功' : '文章更新成功')
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败'
      editorError.value = message
    } finally {
      saving.value = false
    }
  }

  const deletePost = async (postId: string) => {
    if (saving.value) {
      return
    }

    const confirmed = window.confirm('确认删除这篇文章？该操作会同步删除文章评论。')

    if (!confirmed) {
      return
    }

    setErrorText('')
    saving.value = true

    try {
      await removePost(postId)
      selectedPostIds.value = selectedPostIds.value.filter((id) => id !== postId)
      await showFeedback('文章已删除')
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : '删除失败')
    } finally {
      saving.value = false
    }
  }

  const deleteSelectedPosts = async () => {
    if (selectedPostIds.value.length === 0 || saving.value) {
      return
    }

    const confirmed = window.confirm(`确认删除选中的 ${selectedPostIds.value.length} 篇文章？`)

    if (!confirmed) {
      return
    }

    setErrorText('')
    saving.value = true

    try {
      await Promise.all(selectedPostIds.value.map((postId) => removePost(postId)))
      selectedPostIds.value = []
      await showFeedback('批量删除完成')
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : '批量删除失败')
    } finally {
      saving.value = false
    }
  }

  return {
    addSectionDraft,
    closeEditor,
    deletePost,
    deleteSelectedPosts,
    insertMarkdownSnippet,
    openCreateEditor,
    openEditEditor,
    openPreviewEditor,
    removeSectionDraft,
    resetEditor,
    setEditorContentMode,
    submitEditor,
  }
}
