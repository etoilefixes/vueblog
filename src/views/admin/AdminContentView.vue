<script setup lang="ts">
import {
  FilePlus2,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

import { useBlogStore } from '@/stores/blog'
import { renderMarkdownToHtml } from '@/services/markdown'
import type { BlogPostSection, BlogSectionImage } from '@/types/blog'
import AdminContentMediaPicker from './AdminContentMediaPicker.vue'
import AdminContentPostList from './AdminContentPostList.vue'
import TagManagerDialog from './dialogs/TagManagerDialog.vue'
import {
  buildStructuredSections,
  parseMarkdownSections,
  parseTagsText,
  splitLines,
  type EditorSectionDraft,
} from './content-editor-helpers'
import { useAdminEditorActions } from './use-admin-editor-actions'
import { useAdminMediaPicker } from './use-admin-media-picker'
import { useAdminTagActions } from './use-admin-tag-actions'

interface EditorPreviewSection {
  id: string
  title: string
  paragraphs: string[]
  highlights: string[]
  images: BlogSectionImage[]
  snippet?: {
    language: string
    code: string
  }
}

interface EditorPreviewData {
  title: string
  summary: string
  lead: string
  category: string
  tags: string[]
  highlight: string
  publishedAt: string
  readingMinutes: number
  noticeTitle: string
  noticeLines: string[]
  quote: string
  sections: EditorPreviewSection[]
}

const blogStore = useBlogStore()

const loading = ref(false)
const saving = ref(false)
const keyword = ref('')
const activeCategory = ref('all')
const activeTag = ref('all')
const selectedPostIds = ref<string[]>([])
const feedback = ref('')
const errorText = ref('')

const tagManagerOpen = ref(false)
const editorOpen = ref(false)
const editorMode = ref<'create' | 'edit'>('create')
const editorView = ref<'edit' | 'preview'>('edit')
const editorContentMode = ref<'structured' | 'markdown'>('structured')
const isDesktopSplitPreview = ref(false)
const editorError = ref('')
const sectionDrafts = ref<EditorSectionDraft[]>([])
const markdownDraft = ref('')
const desktopSplitMediaQuery = '(min-width: 1280px)'
let editorSplitMedia: MediaQueryList | null = null

const editorForm = reactive({
  id: '',
  title: '',
  summary: '',
  lead: '',
  category: '',
  tagsText: '',
  highlight: '',
  publishedAt: '',
  readingMinutes: 6,
  views: 0,
  noticeTitle: '',
  noticeLinesText: '',
  quote: '',
})

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const allPosts = computed(() => {
  return [...blogStore.posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
})

const categoryOptions = computed(() => {
  const values = new Set<string>()
  allPosts.value.forEach((post) => values.add(post.category))
  return ['all', ...Array.from(values)]
})

const tagOptions = computed(() => {
  const values = new Set<string>()
  allPosts.value.forEach((post) => post.tags.forEach((tag) => values.add(tag)))
  return ['all', ...Array.from(values)]
})

const filteredPosts = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase()

  return allPosts.value.filter((post) => {
    if (activeCategory.value !== 'all' && post.category !== activeCategory.value) {
      return false
    }

    if (activeTag.value !== 'all' && !post.tags.includes(activeTag.value)) {
      return false
    }

    if (!normalizedKeyword) {
      return true
    }

    const searchable = `${post.title} ${post.summary} ${post.tags.join(' ')} ${post.category}`.toLowerCase()
    return searchable.includes(normalizedKeyword)
  })
})

const selectedCount = computed(() => selectedPostIds.value.length)

const allFilteredSelected = computed(() => {
  if (filteredPosts.value.length === 0) {
    return false
  }

  return filteredPosts.value.every((post) => selectedPostIds.value.includes(post.id))
})

const editorTitle = computed(() =>
  editorMode.value === 'create' ? '新建文章' : `编辑文章: ${editorForm.title || '未命名'}`,
)

const editorSections = computed<BlogPostSection[]>(() => {
  if (editorContentMode.value === 'markdown') {
    return parseMarkdownSections(markdownDraft.value)
  }

  return buildStructuredSections(sectionDrafts.value)
})

const editorPreview = computed<EditorPreviewData>(() => {
  const sections = editorSections.value.map((section) => ({
    id: section.id,
    title: section.title,
    paragraphs: [...section.paragraphs],
    highlights: [...(section.highlights ?? [])],
    images: [...(section.images ?? [])],
    snippet: section.snippet
      ? {
          language: section.snippet.language,
          code: section.snippet.code,
        }
      : undefined,
  }))

  return {
    title: editorForm.title.trim(),
    summary: editorForm.summary.trim(),
    lead: editorForm.lead.trim(),
    category: editorForm.category.trim(),
    tags: parseTagsText(editorForm.tagsText),
    highlight: editorForm.highlight.trim(),
    publishedAt: editorForm.publishedAt || new Date().toISOString().slice(0, 10),
    readingMinutes: Math.max(1, Number(editorForm.readingMinutes) || 1),
    noticeTitle: editorForm.noticeTitle.trim(),
    noticeLines: splitLines(editorForm.noticeLinesText),
    quote: editorForm.quote.trim(),
    sections,
  }
})

const markdownPreviewHtml = computed(() => {
  if (editorContentMode.value !== 'markdown') {
    return ''
  }

  return renderMarkdownToHtml(markdownDraft.value)
})

const showEditorViewSwitch = computed(() => !isDesktopSplitPreview.value)
const showEditPane = computed(() => isDesktopSplitPreview.value || editorView.value === 'edit')
const showPreviewPane = computed(() => isDesktopSplitPreview.value || editorView.value === 'preview')

const metrics = computed(() => {
  const categories = new Set(blogStore.posts.map((post) => post.category)).size
  const tags = new Set(blogStore.posts.flatMap((post) => post.tags)).size
  const totalViews = blogStore.posts.reduce((sum, item) => sum + (item.views ?? 0), 0)

  return [
    { id: 'posts', label: '文章', value: blogStore.posts.length },
    { id: 'categories', label: '分类', value: categories },
    { id: 'tags', label: '标签', value: tags },
    { id: 'views', label: '阅读量', value: totalViews },
  ]
})

const showFeedback = async (text: string) => {
  feedback.value = text
  await sleep(1800)

  if (feedback.value === text) {
    feedback.value = ''
  }
}

const {
  closeMediaPicker,
  insertMediaFromPicker,
  mediaPickerError,
  mediaPickerItems,
  mediaPickerKeyword,
  mediaPickerLoading,
  mediaPickerOpen,
  openMediaPickerForMarkdown,
  openMediaPickerForSection,
} = useAdminMediaPicker({
  sectionDrafts,
  markdownDraft,
  showFeedback,
})

const {
  addTagToSelectedPosts,
  appendTagToEditor,
  deleteTagGlobally,
  renameTagGlobally,
  tagUsageRecords,
  tagManagePending,
} = useAdminTagActions({
  allPosts,
  selectedPostIds,
  saving,
  editorOpen,
  activeTag,
  editorForm,
  showFeedback,
  setErrorText: (value) => {
    errorText.value = value
  },
  savePost: (payload) => blogStore.savePost(payload),
})

const toggleSelectPost = (postId: string) => {
  if (selectedPostIds.value.includes(postId)) {
    selectedPostIds.value = selectedPostIds.value.filter((id) => id !== postId)
    return
  }

  selectedPostIds.value = [...selectedPostIds.value, postId]
}

const toggleSelectAllFiltered = () => {
  if (allFilteredSelected.value) {
    selectedPostIds.value = selectedPostIds.value.filter(
      (id) => !filteredPosts.value.some((post) => post.id === id),
    )
    return
  }

  const merged = new Set([...selectedPostIds.value, ...filteredPosts.value.map((post) => post.id)])
  selectedPostIds.value = Array.from(merged)
}

const {
  addSectionDraft,
  closeEditor,
  deletePost,
  deleteSelectedPosts,
  insertMarkdownSnippet,
  openCreateEditor,
  openEditEditor,
  openPreviewEditor,
  removeSectionDraft,
  setEditorContentMode,
  submitEditor,
} = useAdminEditorActions({
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
  setErrorText: (value) => {
    errorText.value = value
  },
  showFeedback,
  closeMediaPicker,
  savePost: (payload) => blogStore.savePost(payload),
  removePost: (postId) => blogStore.removePost(postId),
  getPostById: (postId) => blogStore.getPostById(postId),
})

const syncEditorSplitMode = () => {
  if (!editorSplitMedia) {
    return
  }

  isDesktopSplitPreview.value = editorSplitMedia.matches
}

watch(
  filteredPosts,
  (posts) => {
    const idSet = new Set(posts.map((post) => post.id))
    selectedPostIds.value = selectedPostIds.value.filter((id) => idSet.has(id))
  },
  { deep: true },
)

watch(editorOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

onUnmounted(() => {
  if (editorSplitMedia) {
    editorSplitMedia.removeEventListener('change', syncEditorSplitMode)
    editorSplitMedia = null
  }

  document.body.style.overflow = ''
})

onMounted(async () => {
  editorSplitMedia = window.matchMedia(desktopSplitMediaQuery)
  syncEditorSplitMode()
  editorSplitMedia.addEventListener('change', syncEditorSplitMode)

  if (blogStore.isHydrated || blogStore.isInitializing) {
    return
  }

  loading.value = true
  await blogStore.initialize()
  loading.value = false
})
</script>

<template>
  <section class="admin-page admin-content-page">
    <header class="admin-page__head">
      <p>CONTENT STUDIO</p>
      <h2>内容管理</h2>
      <span>支持文章筛选、批量操作与移动端编辑抽屉。</span>
    </header>

    <section class="admin-content-toolbar">
      <label class="admin-input-wrap admin-input-wrap--search">
        <Search class="icon icon--sm icon--stroke-strong" aria-hidden="true" />
        <input v-model="keyword" type="search" placeholder="搜索标题、摘要、标签..." />
      </label>

      <select v-model="activeCategory" class="admin-select">
        <option value="all">全部分类</option>
        <option v-for="item in categoryOptions.slice(1)" :key="item" :value="item">
          {{ item }}
        </option>
      </select>

      <select v-model="activeTag" class="admin-select">
        <option value="all">全部标签</option>
        <option v-for="item in tagOptions.slice(1)" :key="item" :value="item">#{{ item }}</option>
      </select>

      <button type="button" class="admin-action-btn admin-action-btn--strong icon-host" @click="openCreateEditor">
        <FilePlus2 class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
        <span>新建文章</span>
      </button>
    </section>

    <p v-if="loading" class="admin-page__hint">正在载入内容数据...</p>
    <p v-if="errorText" class="admin-page__hint admin-page__hint--warn">{{ errorText }}</p>
    <p v-if="feedback" class="admin-page__hint">{{ feedback }}</p>

    <section class="admin-content-metrics">
      <article v-for="item in metrics" :key="item.id" class="admin-content-metric">
        <strong>{{ item.value }}</strong>
        <span>{{ item.label }}</span>
      </article>
    </section>

    <!-- 标签管理按钮 -->
    <section class="admin-content-toolbar">
      <button 
        type="button" 
        class="admin-action-btn icon-host"
        @click="tagManagerOpen = true"
      >
        <Tag class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
        <span>标签管理</span>
        <small v-if="tagUsageRecords.length > 0">({{ tagUsageRecords.length }})</small>
      </button>
    </section>

    <!-- 标签管理弹窗 -->
    <TagManagerDialog
      v-model:open="tagManagerOpen"
      :editor-open="editorOpen"
      :selected-count="selectedCount"
      :tag-manage-pending="tagManagePending"
      :tag-usage-records="tagUsageRecords"
      @add-selected="addTagToSelectedPosts"
      @append-current="appendTagToEditor"
      @rename-global="renameTagGlobally"
      @delete-global="deleteTagGlobally"
    />

    <AdminContentPostList
      :filtered-posts="filteredPosts"
      :selected-post-ids="selectedPostIds"
      :selected-count="selectedCount"
      :all-filtered-selected="allFilteredSelected"
      :saving="saving"
      @toggle-select-all="toggleSelectAllFiltered"
      @toggle-select="toggleSelectPost"
      @delete-selected="deleteSelectedPosts"
      @open-preview="openPreviewEditor"
      @open-edit="openEditEditor"
      @delete-post="deletePost"
    />
  </section>

  <Teleport to="body">
    <Transition name="admin-float-panel">
      <div v-if="editorOpen" class="admin-float-overlay" @click.self="closeEditor">
        <section class="admin-editor-panel">
          <header class="admin-editor-panel__head">
            <div class="admin-editor-panel__head-main">
              <p>POST EDITOR</p>
              <h3>{{ editorTitle }}</h3>
              <div
                v-if="showEditorViewSwitch"
                class="admin-editor-panel__switch"
                role="tablist"
                aria-label="编辑器视图"
              >
                <button
                  type="button"
                  class="icon-host"
                  :class="{ 'admin-editor-panel__switch-btn--active': editorView === 'edit' }"
                  role="tab"
                  :aria-selected="editorView === 'edit'"
                  @click="editorView = 'edit'"
                >
                  编辑
                </button>
                <button
                  type="button"
                  class="icon-host"
                  :class="{ 'admin-editor-panel__switch-btn--active': editorView === 'preview' }"
                  role="tab"
                  :aria-selected="editorView === 'preview'"
                  @click="editorView = 'preview'"
                >
                  预览
                </button>
              </div>
            </div>
            <button type="button" class="admin-shell__mobile-close icon-host" aria-label="关闭" @click="closeEditor">
              <X class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
            </button>
          </header>

          <form
            class="admin-editor-form"
            :class="{ 'admin-editor-form--split': isDesktopSplitPreview }"
            @submit.prevent="submitEditor"
          >
            <section v-if="showEditPane" class="admin-editor-pane admin-editor-pane--edit">
              <section class="admin-editor-mode">
                <p>正文模式</p>
                <div class="admin-editor-mode__switch">
                  <button
                    type="button"
                    class="icon-host"
                    :class="{ 'admin-editor-mode__switch-btn--active': editorContentMode === 'structured' }"
                    @click="setEditorContentMode('structured')"
                  >
                    结构化编辑
                  </button>
                  <button
                    type="button"
                    class="icon-host"
                    :class="{ 'admin-editor-mode__switch-btn--active': editorContentMode === 'markdown' }"
                    @click="setEditorContentMode('markdown')"
                  >
                    Markdown
                  </button>
                </div>
                <small>结构化适合精细排版，Markdown 适合快速写作，均可实时预览。</small>
              </section>

              <section class="admin-editor-grid">
                <label class="admin-field admin-field--full">
                  <span>标题</span>
                  <input v-model="editorForm.title" type="text" maxlength="120" required />
                </label>

                <label class="admin-field admin-field--full">
                  <span>摘要</span>
                  <textarea v-model="editorForm.summary" rows="2" maxlength="240" required />
                </label>

                <label class="admin-field admin-field--full">
                  <span>导语</span>
                  <textarea v-model="editorForm.lead" rows="3" maxlength="500" required />
                </label>

                <label class="admin-field">
                  <span>分类</span>
                  <input v-model="editorForm.category" type="text" maxlength="30" required />
                </label>

                <label class="admin-field">
                  <span>标签（逗号分隔）</span>
                  <input v-model="editorForm.tagsText" type="text" maxlength="140" />
                </label>

                <label class="admin-field">
                  <span>高亮标记</span>
                  <input
                    v-model="editorForm.highlight"
                    type="text"
                    maxlength="30"
                    placeholder="Hot / New / Editor Choice"
                  />
                </label>

                <label class="admin-field">
                  <span>发布时间</span>
                  <input v-model="editorForm.publishedAt" type="date" required />
                </label>

                <label class="admin-field">
                  <span>阅读分钟</span>
                  <input v-model.number="editorForm.readingMinutes" type="number" min="1" max="120" required />
                </label>

                <label class="admin-field">
                  <span>阅读量</span>
                  <input v-model.number="editorForm.views" type="number" min="0" />
                </label>

                <label class="admin-field admin-field--full">
                  <span>通知标题</span>
                  <input v-model="editorForm.noticeTitle" type="text" maxlength="120" />
                </label>

                <label class="admin-field admin-field--full">
                  <span>通知内容（每行一条）</span>
                  <textarea v-model="editorForm.noticeLinesText" rows="2" />
                </label>

                <label class="admin-field admin-field--full">
                  <span>引用</span>
                  <textarea v-model="editorForm.quote" rows="2" />
                </label>
              </section>

              <section v-if="editorContentMode === 'structured'" class="admin-editor-sections">
                <header>
                  <h4>正文章节</h4>
                  <button type="button" class="admin-action-btn icon-host" @click="addSectionDraft">
                    <FilePlus2 class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
                    <span>新增章节</span>
                  </button>
                </header>

                <article
                  v-for="(section, index) in sectionDrafts"
                  :key="section.uid"
                  class="admin-editor-section-card"
                >
                  <header>
                    <strong>章节 {{ index + 1 }}</strong>
                    <button
                      type="button"
                      class="admin-action-btn admin-action-btn--danger icon-host"
                      :disabled="sectionDrafts.length <= 1"
                      @click="removeSectionDraft(section.uid)"
                    >
                      <Trash2 class="icon icon--xs icon--stroke-strong icon--react" aria-hidden="true" />
                      <span>删除</span>
                    </button>
                  </header>

                  <label class="admin-field admin-field--full">
                    <span>章节标题</span>
                    <input v-model="section.title" type="text" maxlength="80" required />
                  </label>

                  <label class="admin-field">
                    <span>锚点 id（可选）</span>
                    <input v-model="section.id" type="text" maxlength="80" placeholder="默认自动生成" />
                  </label>

                  <label class="admin-field admin-field--full">
                    <span>段落（每行一段）</span>
                    <textarea v-model="section.paragraphsText" rows="4" required />
                  </label>

                  <label class="admin-field admin-field--full">
                    <span>高亮要点（每行一条，可选）</span>
                    <textarea v-model="section.highlightsText" rows="2" />
                  </label>

                  <label class="admin-field admin-field--full">
                    <span>插图（每行一张：URL | alt | caption）</span>
                    <textarea
                      v-model="section.imagesText"
                      rows="3"
                      placeholder="https://cdn.example.com/image.webp | 首页横幅 | 1200 × 630"
                    />
                  </label>

                  <div class="admin-editor-inline-actions">
                    <button type="button" class="admin-action-btn icon-host" @click="openMediaPickerForSection(section.uid)">
                      <span>从媒体库插图</span>
                    </button>
                  </div>

                  <label class="admin-field">
                    <span>代码语言（可选）</span>
                    <input
                      v-model="section.snippetLanguage"
                      type="text"
                      maxlength="20"
                      placeholder="ts / css / vue"
                    />
                  </label>

                  <label class="admin-field admin-field--full">
                    <span>代码片段（可选）</span>
                    <textarea v-model="section.snippetCode" rows="4" />
                  </label>
                </article>
              </section>

              <section v-else class="admin-editor-markdown">
                <header>
                  <h4>Markdown 正文</h4>
                  <div class="admin-editor-inline-actions">
                    <button type="button" class="admin-action-btn icon-host" @click="insertMarkdownSnippet('heading')">
                      <span>插入章节标题</span>
                    </button>
                    <button type="button" class="admin-action-btn icon-host" @click="openMediaPickerForMarkdown">
                      <span>插入图片</span>
                    </button>
                    <button type="button" class="admin-action-btn icon-host" @click="insertMarkdownSnippet('code')">
                      <span>插入代码块</span>
                    </button>
                  </div>
                </header>

                <textarea
                  v-model="markdownDraft"
                  rows="18"
                  placeholder="## 章节标题&#10;第一段正文&#10;- 要点&#10;![alt](https://cdn.example.com/image.webp &quot;caption&quot;)&#10;```ts&#10;const hello = 'world'&#10;```"
                />
                <p class="admin-runtime-template-hint">
                  支持标题、表格、任务列表、脚注、分割线、转义字符、图片与代码块。预览与保存会自动转成站点文章结构。
                </p>
              </section>
            </section>

            <section v-if="showPreviewPane" class="admin-editor-pane admin-editor-pane--preview">
              <section class="admin-editor-preview">
                <header class="admin-editor-preview__head">
                  <p>{{ editorPreview.category || '未分类' }}</p>
                  <h4>{{ editorPreview.title || '未命名文章' }}</h4>
                  <small>
                    {{ editorPreview.publishedAt }} · {{ editorPreview.readingMinutes }} min ·
                    {{
                      editorPreview.tags.length > 0
                        ? editorPreview.tags.map((tag) => `#${tag}`).join(' ')
                        : '未设置标签'
                    }}
                  </small>
                </header>

                <p class="admin-editor-preview__summary">
                  {{ editorPreview.summary || '请填写摘要以展示在列表和搜索结果中。' }}
                </p>
                <p class="admin-editor-preview__lead">
                  {{ editorPreview.lead || '请填写导语，突出这篇文章的核心观点。' }}
                </p>

                <p v-if="editorPreview.highlight" class="admin-editor-preview__badge">
                  {{ editorPreview.highlight }}
                </p>

                <section
                  v-if="editorPreview.noticeTitle || editorPreview.noticeLines.length > 0"
                  class="admin-editor-preview__notice"
                >
                  <strong>{{ editorPreview.noticeTitle || '公告' }}</strong>
                  <ul v-if="editorPreview.noticeLines.length > 0">
                    <li v-for="line in editorPreview.noticeLines" :key="line">{{ line }}</li>
                  </ul>
                </section>

                <blockquote v-if="editorPreview.quote" class="admin-editor-preview__quote">
                  {{ editorPreview.quote }}
                </blockquote>

                <div
                  v-if="editorContentMode === 'markdown' && markdownPreviewHtml"
                  class="admin-editor-preview__markdown"
                  v-html="markdownPreviewHtml"
                />
                <p v-else-if="editorContentMode === 'markdown'" class="admin-editor-preview__empty">
                  暂无有效 Markdown 内容，请先在左侧输入正文。
                </p>

                <template v-else>
                  <article
                    v-for="(section, index) in editorPreview.sections"
                    :key="`${section.id}-${index}`"
                    class="admin-editor-preview__section"
                  >
                    <h5>{{ section.title }}</h5>
                    <ul v-if="section.highlights.length > 0" class="admin-editor-preview__highlights">
                      <li v-for="item in section.highlights" :key="`${section.id}-highlight-${item}`">{{ item }}</li>
                    </ul>
                    <div v-if="section.images.length > 0" class="admin-editor-preview__media">
                      <figure v-for="(image, imageIndex) in section.images" :key="`${section.id}-image-${imageIndex}`">
                        <img :src="image.src" :alt="image.alt" loading="lazy" />
                        <figcaption v-if="image.caption">{{ image.caption }}</figcaption>
                      </figure>
                    </div>
                    <p
                      v-for="(paragraph, paragraphIndex) in section.paragraphs"
                      :key="`${section.id}-${paragraphIndex}`"
                    >
                      {{ paragraph }}
                    </p>
                    <pre v-if="section.snippet"><code>{{ section.snippet.code }}</code></pre>
                  </article>

                  <p v-if="editorPreview.sections.length === 0" class="admin-editor-preview__empty">
                    暂无有效章节，请先在编辑视图补充章节标题与正文段落。
                  </p>
                </template>
              </section>
            </section>

            <p v-if="editorError" class="admin-page__hint admin-page__hint--warn">{{ editorError }}</p>

            <footer class="admin-editor-panel__foot">
              <button
                v-if="editorView === 'preview' && !isDesktopSplitPreview"
                type="button"
                class="admin-action-btn"
                @click="editorView = 'edit'"
              >
                返回编辑
              </button>
              <button type="button" class="admin-action-btn" @click="closeEditor">取消</button>
              <button type="submit" class="admin-action-btn admin-action-btn--strong" :disabled="saving">
                {{ saving ? '保存中...' : editorMode === 'create' ? '创建文章' : '保存变更' }}
              </button>
            </footer>
          </form>
        </section>
      </div>
    </Transition>
  </Teleport>

  <AdminContentMediaPicker
    :open="mediaPickerOpen"
    :loading="mediaPickerLoading"
    :error="mediaPickerError"
    :items="mediaPickerItems"
    v-model:keyword="mediaPickerKeyword"
    @close="closeMediaPicker"
    @insert="insertMediaFromPicker"
  />
</template>
