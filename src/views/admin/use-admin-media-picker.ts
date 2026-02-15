import { onUnmounted, ref, watch, type Ref } from 'vue'

import { adminApi } from '@/services/admin-api'
import type { AdminMediaItem } from '@/types/admin'
import type { EditorSectionDraft } from './content-editor-helpers'

export type MediaPickerTarget = { mode: 'section'; sectionUid: string } | { mode: 'markdown' }

interface UseAdminMediaPickerOptions {
  sectionDrafts: Ref<EditorSectionDraft[]>
  markdownDraft: Ref<string>
  showFeedback: (text: string) => Promise<void>
}

export const useAdminMediaPicker = ({
  sectionDrafts,
  markdownDraft,
  showFeedback,
}: UseAdminMediaPickerOptions) => {
  const mediaPickerOpen = ref(false)
  const mediaPickerLoading = ref(false)
  const mediaPickerError = ref('')
  const mediaPickerKeyword = ref('')
  const mediaPickerItems = ref<AdminMediaItem[]>([])
  const mediaPickerTarget = ref<MediaPickerTarget | null>(null)
  let mediaPickerDebounceTimer = 0

  const closeMediaPicker = () => {
    mediaPickerOpen.value = false
    mediaPickerTarget.value = null
    mediaPickerError.value = ''
  }

  const loadMediaPicker = async () => {
    mediaPickerLoading.value = true
    mediaPickerError.value = ''

    try {
      mediaPickerItems.value = await adminApi.getMediaList({
        keyword: mediaPickerKeyword.value.trim() || undefined,
        mimeType: 'image/',
        limit: 80,
      })
    } catch (error) {
      mediaPickerError.value = error instanceof Error ? error.message : '媒体列表加载失败'
    } finally {
      mediaPickerLoading.value = false
    }
  }

  const openMediaPickerForSection = async (sectionUid: string) => {
    mediaPickerTarget.value = { mode: 'section', sectionUid }
    mediaPickerKeyword.value = ''
    mediaPickerOpen.value = true
    await loadMediaPicker()
  }

  const openMediaPickerForMarkdown = async () => {
    mediaPickerTarget.value = { mode: 'markdown' }
    mediaPickerKeyword.value = ''
    mediaPickerOpen.value = true
    await loadMediaPicker()
  }

  const appendImageLineToSection = (sectionUid: string, line: string) => {
    const section = sectionDrafts.value.find((item) => item.uid === sectionUid)
    if (!section) {
      return
    }

    section.imagesText = section.imagesText.trim() ? `${section.imagesText.trim()}\n${line}` : line
  }

  const insertMediaFromPicker = async (item: AdminMediaItem) => {
    const target = mediaPickerTarget.value

    if (!target) {
      return
    }

    const safeAlt = item.name.trim().replace(/[\[\]]/g, '') || '插图'
    const dimensionText = item.width && item.height ? `${item.width} × ${item.height}` : ''

    if (target.mode === 'markdown') {
      const markdownLine = dimensionText
        ? `![${safeAlt}](${item.url} "${dimensionText}")`
        : `![${safeAlt}](${item.url})`
      markdownDraft.value = markdownDraft.value.trim()
        ? `${markdownDraft.value.trim()}\n\n${markdownLine}`
        : markdownLine
    } else {
      const line = dimensionText ? `${item.url} | ${safeAlt} | ${dimensionText}` : `${item.url} | ${safeAlt}`
      appendImageLineToSection(target.sectionUid, line)
    }

    closeMediaPicker()
    await showFeedback('图片已插入编辑器')
  }

  watch(mediaPickerKeyword, () => {
    if (!mediaPickerOpen.value) {
      return
    }

    window.clearTimeout(mediaPickerDebounceTimer)
    mediaPickerDebounceTimer = window.setTimeout(() => {
      void loadMediaPicker()
    }, 220)
  })

  watch(mediaPickerOpen, (open) => {
    if (!open) {
      window.clearTimeout(mediaPickerDebounceTimer)
    }
  })

  onUnmounted(() => {
    window.clearTimeout(mediaPickerDebounceTimer)
  })

  return {
    closeMediaPicker,
    insertMediaFromPicker,
    loadMediaPicker,
    mediaPickerError,
    mediaPickerItems,
    mediaPickerKeyword,
    mediaPickerLoading,
    mediaPickerOpen,
    openMediaPickerForMarkdown,
    openMediaPickerForSection,
  }
}
