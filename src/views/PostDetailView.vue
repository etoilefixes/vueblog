<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Heart,
  Maximize2,
  MessageCircle,
  Minimize2,
  X,
} from 'lucide-vue-next'
import type { CSSProperties } from 'vue'
import { useRoute } from 'vue-router'

import '@/assets/styles/article.css'
import {
  buildSectionMarkdown,
  renderMarkdownToHtml,
  shouldRenderSectionAsMarkdown,
} from '@/services/markdown'
import { useBlogStore } from '@/stores/blog'
import type { BlogPostSection, BlogSectionImage } from '@/types/blog'
import {
  formatCommentTime,
  getCommentAvatar,
  getSnippetLines,
  quickInsertActions,
} from './post-detail/post-detail-helpers'

const route = useRoute()
const blogStore = useBlogStore()

const readingProgress = ref(0)
const activeSectionAnchor = ref('')
const activeParagraphAnchor = ref('')
const copiedSnippetId = ref('')
const commentLikePulseId = ref('')
const commentSubmitting = ref(false)
const commentFeedback = ref('')
const commentError = ref('')
const commentFormInvalid = ref(false)
const collapsedSnippetIds = ref<string[]>([])
const lightboxImages = ref<BlogSectionImage[]>([])
const lightboxIndex = ref(0)
const previousBodyOverflow = ref('')

const commentDraft = reactive({
  author: '',
  content: '',
})

const articleHeroRef = ref<HTMLElement | null>(null)
const articleCommentsRef = ref<HTMLElement | null>(null)

const postId = computed(() => String(route.params.id ?? ''))
const post = computed(() => blogStore.getPostById(postId.value))
const adjacentPosts = computed(() => blogStore.getAdjacentPosts(postId.value))
const relatedPosts = computed(() => blogStore.getRelatedPosts(postId.value, 3))
const comments = computed(() => blogStore.getCommentsByPost(postId.value))
const readingPercent = computed(() => Math.round(readingProgress.value * 100))
const activeLightboxImage = computed(() => {
  return lightboxImages.value[lightboxIndex.value] ?? null
})
const readingRemainingMinutes = computed(() => {
  if (!post.value) {
    return 0
  }

  return Math.max(Math.ceil(post.value.readingMinutes * (1 - readingProgress.value)), 0)
})
const readingRemainingLabel = computed(() => {
  if (!post.value) {
    return '阅读数据加载中'
  }

  if (readingRemainingMinutes.value <= 0) {
    return '阅读完成'
  }

  return `剩余约 ${readingRemainingMinutes.value} 分钟`
})

const getMarkdownSectionKey = (section: BlogPostSection, index: number) => `${section.id}-${index}`

const isMarkdownSection = (section: BlogPostSection) => shouldRenderSectionAsMarkdown(section)

const markdownSectionHtmlMap = computed(() => {
  if (!post.value) {
    return {}
  }

  const entries = post.value.contentSections
    .map((section, index) => {
      if (!isMarkdownSection(section)) {
        return null
      }

      const key = getMarkdownSectionKey(section, index)
      const html = renderMarkdownToHtml(buildSectionMarkdown(section), {
        anchorIdPrefix: `post-${postId.value}-${section.id}-${index + 1}`,
      })
      return [key, html] as const
    })
    .filter((item): item is readonly [string, string] => item !== null)

  return Object.fromEntries(entries)
})

const getSectionMarkdownHtml = (section: BlogPostSection, index: number) => {
  return markdownSectionHtmlMap.value[getMarkdownSectionKey(section, index)] ?? ''
}

const formattedDate = computed(() => {
  if (!post.value) {
    return ''
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${post.value.publishedAt}T00:00:00`))
})

const getSectionAnchor = (sectionId: string) => `post-${postId.value}-${sectionId}`
const getParagraphAnchor = (sectionId: string, paragraphIndex: number) =>
  `post-${postId.value}-${sectionId}-p${paragraphIndex + 1}`

const tocItems = computed(() => {
  if (!post.value) {
    return []
  }

  return post.value.contentSections.map((section, index) => ({
    anchor: getSectionAnchor(section.id),
    title: section.title,
    index: index + 1,
  }))
})

const activeSectionTitle = computed(() => {
  return tocItems.value.find((item) => item.anchor === activeSectionAnchor.value)?.title ?? '文章开场'
})

const activeParagraphLabel = computed(() => {
  if (!post.value || !activeParagraphAnchor.value) {
    return '段落未定位'
  }

  for (const section of post.value.contentSections) {
    if (isMarkdownSection(section)) {
      continue
    }

    for (let paragraphIndex = 0; paragraphIndex < section.paragraphs.length; paragraphIndex += 1) {
      if (getParagraphAnchor(section.id, paragraphIndex) === activeParagraphAnchor.value) {
        return `${section.title} · 第 ${paragraphIndex + 1} 段`
      }
    }
  }

  return '段落未定位'
})

const getPostRoute = (id: string) => ({
  name: 'post-detail' as const,
  params: { id },
})

const getSectionStyle = (index: number): CSSProperties => ({
  '--section-delay': `${120 + index * 90}ms`,
})

const getRelatedCardStyle = (index: number): CSSProperties => ({
  '--related-delay': `${80 + index * 80}ms`,
})

const getCommentStyle = (index: number): CSSProperties => ({
  '--comment-delay': `${100 + index * 75}ms`,
})

const updateReadingProgress = () => {
  const heroElement = articleHeroRef.value
  const commentsElement = articleCommentsRef.value

  if (!heroElement || !commentsElement) {
    readingProgress.value = 0
    return
  }

  const start = window.scrollY + heroElement.getBoundingClientRect().top
  const end = window.scrollY + commentsElement.getBoundingClientRect().top
  const range = Math.max(end - start, 1)
  const marker = window.scrollY + window.innerHeight * 0.4
  const nextProgress = (marker - start) / range

  readingProgress.value = Math.min(Math.max(nextProgress, 0), 1)
}

let readingProgressFrameId = 0

const scheduleReadingProgressUpdate = () => {
  if (readingProgressFrameId) {
    return
  }

  readingProgressFrameId = window.requestAnimationFrame(() => {
    readingProgressFrameId = 0
    updateReadingProgress()
  })
}

let sectionObserver: IntersectionObserver | null = null
let paragraphObserver: IntersectionObserver | null = null

const disconnectSectionObserver = () => {
  if (!sectionObserver) {
    return
  }

  sectionObserver.disconnect()
  sectionObserver = null
}

const disconnectParagraphObserver = () => {
  if (!paragraphObserver) {
    return
  }

  paragraphObserver.disconnect()
  paragraphObserver = null
}

const observeParagraphs = async () => {
  disconnectParagraphObserver()
  await nextTick()

  if (!post.value) {
    return
  }

  const paragraphs = post.value.contentSections
    .flatMap((section) =>
      isMarkdownSection(section)
        ? []
        : section.paragraphs.map((_, paragraphIndex) =>
            document.getElementById(getParagraphAnchor(section.id, paragraphIndex)),
          ),
    )
    .filter((node): node is HTMLElement => node instanceof HTMLElement)

  if (paragraphs.length === 0) {
    return
  }

  const firstParagraph = paragraphs[0]

  if (!firstParagraph) {
    return
  }

  activeParagraphAnchor.value = firstParagraph.id
  paragraphObserver = new IntersectionObserver(
    (entries) => {
      const target = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]

      if (!target) {
        return
      }

      activeParagraphAnchor.value = (target.target as HTMLElement).id
    },
    {
      rootMargin: '-28% 0px -50% 0px',
      threshold: [0.2, 0.45, 0.68],
    },
  )

  paragraphs.forEach((paragraph) => paragraphObserver?.observe(paragraph))
}

const observeSections = async () => {
  disconnectSectionObserver()
  await nextTick()

  if (!post.value || tocItems.value.length === 0) {
    return
  }

  const sections = tocItems.value
    .map((item) => document.getElementById(item.anchor))
    .filter((section): section is HTMLElement => section instanceof HTMLElement)

  if (sections.length === 0) {
    return
  }

  const firstSection = sections[0]

  if (!firstSection) {
    return
  }

  activeSectionAnchor.value = firstSection.id
  sectionObserver = new IntersectionObserver(
    (entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]

      if (!visibleEntry) {
        return
      }

      activeSectionAnchor.value = (visibleEntry.target as HTMLElement).id
    },
    {
      rootMargin: '-22% 0px -58% 0px',
      threshold: [0.15, 0.35, 0.65],
    },
  )

  sections.forEach((section) => sectionObserver?.observe(section))

  const hash = decodeURIComponent(window.location.hash.replace('#', ''))

  if (!hash) {
    return
  }

  const target = document.getElementById(hash)

  if (!target) {
    return
  }

  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  activeSectionAnchor.value = hash
}

const onTocClick = (anchor: string) => {
  const target = document.getElementById(anchor)

  if (!target) {
    return
  }

  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  activeSectionAnchor.value = anchor
  window.history.replaceState(null, '', `#${anchor}`)
}

const copyWithFallback = (value: string) => {
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()

  let copied = false

  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }

  document.body.removeChild(textarea)
  return copied
}

const copySnippet = async (sectionId: string, code: string) => {
  let copied = false

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(code)
      copied = true
    } catch {
      copied = false
    }
  }

  if (!copied) {
    copied = copyWithFallback(code)
  }

  if (!copied) {
    return
  }

  copiedSnippetId.value = sectionId

  window.setTimeout(() => {
    if (copiedSnippetId.value === sectionId) {
      copiedSnippetId.value = ''
    }
  }, 1500)
}

const isSnippetCollapsed = (sectionId: string) => {
  return collapsedSnippetIds.value.includes(sectionId)
}

const toggleSnippetCollapse = (sectionId: string) => {
  if (isSnippetCollapsed(sectionId)) {
    collapsedSnippetIds.value = collapsedSnippetIds.value.filter((id) => id !== sectionId)
    return
  }

  collapsedSnippetIds.value = [...collapsedSnippetIds.value, sectionId]
}

const isParagraphActive = (anchor: string) => {
  return activeParagraphAnchor.value === anchor
}

const openLightbox = (images: BlogSectionImage[], index: number) => {
  if (images.length === 0) {
    return
  }

  previousBodyOverflow.value = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  lightboxImages.value = images
  lightboxIndex.value = Math.min(Math.max(index, 0), images.length - 1)
}

const closeLightbox = () => {
  lightboxImages.value = []
  lightboxIndex.value = 0
  document.body.style.overflow = previousBodyOverflow.value
}

const moveLightbox = (step: number) => {
  if (lightboxImages.value.length <= 1) {
    return
  }

  const total = lightboxImages.value.length
  const nextIndex = (lightboxIndex.value + step + total) % total
  lightboxIndex.value = nextIndex
}

const onWindowKeydown = (event: KeyboardEvent) => {
  if (!activeLightboxImage.value) {
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closeLightbox()
    return
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    moveLightbox(-1)
    return
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    moveLightbox(1)
  }
}

const appendQuickText = (text: string) => {
  const current = commentDraft.content.trim()
  commentDraft.content = current ? `${current} ${text}` : text
}

const triggerCommentInvalid = () => {
  commentFormInvalid.value = false

  requestAnimationFrame(() => {
    commentFormInvalid.value = true

    window.setTimeout(() => {
      commentFormInvalid.value = false
    }, 460)
  })
}

const submitComment = async () => {
  if (!post.value || commentSubmitting.value) {
    return
  }

  commentFeedback.value = ''
  commentError.value = ''

  if (!commentDraft.content.trim()) {
    commentError.value = '评论内容不能为空'
    triggerCommentInvalid()
    return
  }

  commentSubmitting.value = true
  await new Promise((resolve) => window.setTimeout(resolve, 280))

  try {
    await blogStore.addComment(postId.value, {
      author: commentDraft.author,
      content: commentDraft.content,
    })

    commentDraft.content = ''
    commentFeedback.value = '评论已发布'
    requestAnimationFrame(updateReadingProgress)

    window.setTimeout(() => {
      commentFeedback.value = ''
    }, 1800)
  } catch (error) {
    commentError.value = error instanceof Error ? error.message : '评论提交失败，请稍后重试'
  } finally {
    commentSubmitting.value = false
  }
}

const toggleCommentLike = async (commentId: string) => {
  await blogStore.toggleCommentLike(postId.value, commentId)
  commentLikePulseId.value = commentId

  window.setTimeout(() => {
    if (commentLikePulseId.value === commentId) {
      commentLikePulseId.value = ''
    }
  }, 360)
}


watch(
  () => route.fullPath,
  () => {
    readingProgress.value = 0
    copiedSnippetId.value = ''
    collapsedSnippetIds.value = []
    commentFeedback.value = ''
    commentError.value = ''
    commentFormInvalid.value = false
    activeParagraphAnchor.value = ''
    closeLightbox()
    scheduleReadingProgressUpdate()
  },
)

watch(
  () => postId.value,
  () => {
    activeSectionAnchor.value = ''
    activeParagraphAnchor.value = ''
    void observeSections()
    void observeParagraphs()
  },
)

watch(
  () => post.value?.contentSections.length ?? 0,
  () => {
    void observeSections()
    void observeParagraphs()
  },
)

watch(
  () => comments.value.length,
  () => {
    scheduleReadingProgressUpdate()
  },
)

onMounted(() => {
  scheduleReadingProgressUpdate()
  window.addEventListener('scroll', scheduleReadingProgressUpdate, { passive: true })
  window.addEventListener('resize', scheduleReadingProgressUpdate)
  window.addEventListener('keydown', onWindowKeydown)
  void observeSections()
  void observeParagraphs()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', scheduleReadingProgressUpdate)
  window.removeEventListener('resize', scheduleReadingProgressUpdate)
  window.removeEventListener('keydown', onWindowKeydown)

  if (readingProgressFrameId) {
    window.cancelAnimationFrame(readingProgressFrameId)
    readingProgressFrameId = 0
  }

  disconnectSectionObserver()
  disconnectParagraphObserver()
  closeLightbox()
})
</script>

<template>
  <main class="article-page">
    <div class="article-progress" aria-hidden="true">
      <span class="article-progress__value" :style="{ width: `${readingPercent}%` }" />
    </div>

    <template v-if="post">
      <div class="article-layout">
        <section class="article-main">
          <header ref="articleHeroRef" class="article-hero">
            <p class="article-hero__kicker">{{ post.category }} · {{ formattedDate }}</p>
            <h1 class="article-hero__title">{{ post.title }}</h1>
            <p class="article-hero__lead">{{ post.lead }}</p>

            <div class="article-hero__meta" aria-label="文章元信息">
              <span>{{ post.readingMinutes }} 分钟阅读</span>
              <span class="article-hero__meta-item">
                <Clock3 class="icon icon--xs icon--stroke-strong" aria-hidden="true" />
                <span>{{ readingRemainingLabel }}</span>
              </span>
              <span class="article-hero__meta-item">
                <Eye class="icon icon--xs icon--stroke-strong" aria-hidden="true" />
                <span>{{ post.views ?? 0 }}</span>
              </span>
              <span class="article-hero__meta-item">
                <MessageCircle class="icon icon--xs icon--stroke-strong" aria-hidden="true" />
                <span>{{ post.comments ?? 0 }}</span>
              </span>
            </div>

            <div class="article-hero__tags" aria-label="文章标签">
              <span v-for="tag in post.tags" :key="tag">#{{ tag }}</span>
            </div>
          </header>

          <section class="article-content" aria-label="文章正文">
            <article
              v-for="(section, index) in post.contentSections"
              :id="getSectionAnchor(section.id)"
              :key="section.id"
              class="article-section"
              :style="getSectionStyle(index)"
            >
              <h2 class="article-section__title">{{ section.title }}</h2>

              <div
                v-if="isMarkdownSection(section)"
                class="article-section__markdown"
                v-html="getSectionMarkdownHtml(section, index)"
              />

              <template v-else>
                <p
                  v-for="(paragraph, paragraphIndex) in section.paragraphs"
                  :id="getParagraphAnchor(section.id, paragraphIndex)"
                  :key="`${section.id}-paragraph-${paragraphIndex}`"
                  class="article-section__paragraph"
                  :class="{
                    'article-section__paragraph--active': isParagraphActive(getParagraphAnchor(section.id, paragraphIndex)),
                  }"
                >
                  {{ paragraph }}
                </p>

                <ul v-if="section.highlights?.length" class="article-section__highlights">
                  <li v-for="item in section.highlights" :key="item">{{ item }}</li>
                </ul>

                <div v-if="section.images?.length" class="article-media">
                  <button
                    v-for="(image, imageIndex) in section.images"
                    :key="`${section.id}-image-${imageIndex}`"
                    type="button"
                    class="article-media__item"
                    @click="openLightbox(section.images ?? [], imageIndex)"
                  >
                    <img :src="image.src" :alt="image.alt" loading="lazy" />
                    <span v-if="image.caption">{{ image.caption }}</span>
                  </button>
                </div>

                <div v-if="section.snippet" class="article-code">
                  <header class="article-code__head">
                    <span class="article-code__lang">{{ section.snippet.language.toUpperCase() }}</span>
                    <div class="article-code__actions">
                      <button
                        type="button"
                        class="article-code__copy"
                        :class="{ 'article-code__copy--done': copiedSnippetId === section.id }"
                        @click="copySnippet(section.id, section.snippet.code)"
                      >
                        {{ copiedSnippetId === section.id ? '已复制' : '复制代码' }}
                      </button>
                      <button
                        type="button"
                        class="article-code__toggle"
                        @click="toggleSnippetCollapse(section.id)"
                      >
                        <Minimize2
                          v-if="!isSnippetCollapsed(section.id)"
                          class="icon icon--xs icon--stroke-strong"
                          aria-hidden="true"
                        />
                        <Maximize2
                          v-else
                          class="icon icon--xs icon--stroke-strong"
                          aria-hidden="true"
                        />
                        <span>{{ isSnippetCollapsed(section.id) ? '展开' : '收起' }}</span>
                      </button>
                    </div>
                  </header>
                  <Transition name="snippet-collapse">
                    <pre v-if="!isSnippetCollapsed(section.id)" class="article-section__snippet">
                      <code>
                        <ol class="article-code__lines">
                          <li
                            v-for="(line, lineIndex) in getSnippetLines(section.snippet.code, section.snippet.language)"
                            :key="`${section.id}-line-${lineIndex}`"
                          >
                            <span class="article-code__line-number">{{ lineIndex + 1 }}</span>
                            <span class="article-code__line-content" v-html="line" />
                          </li>
                        </ol>
                      </code>
                    </pre>
                  </Transition>
                </div>
              </template>
            </article>
          </section>

          <section ref="articleCommentsRef" class="article-comments" aria-label="评论区">
            <header class="article-comments__head">
              <h2>评论区</h2>
              <p>{{ comments.length }} 条评论</p>
            </header>

            <form class="comment-form" :class="{ 'comment-form--invalid': commentFormInvalid }" @submit.prevent="submitComment">
              <div class="comment-form__top">
                <input
                  v-model="commentDraft.author"
                  type="text"
                  maxlength="20"
                  placeholder="你的昵称（可选）"
                />
                <button type="submit" :disabled="commentSubmitting">
                  {{ commentSubmitting ? '发布中...' : '发布评论' }}
                </button>
              </div>

              <textarea
                v-model="commentDraft.content"
                rows="4"
                maxlength="220"
                placeholder="写下你的想法..."
              />

              <div class="comment-form__bottom">
                <div class="comment-form__quick-actions">
                  <button
                    v-for="action in quickInsertActions"
                    :key="action.id"
                    type="button"
                    class="icon-host"
                    @click="appendQuickText(action.text)"
                  >
                    <component
                      :is="action.icon"
                      class="icon icon--xs icon--stroke-strong icon--react"
                      aria-hidden="true"
                    />
                    <span>{{ action.label }}</span>
                  </button>
                </div>

                <p v-if="commentError" class="comment-form__hint comment-form__hint--error">
                  {{ commentError }}
                </p>
                <p v-else-if="commentFeedback" class="comment-form__hint comment-form__hint--success">
                  {{ commentFeedback }}
                </p>
                <p v-else class="comment-form__hint">支持快捷语句和实时点赞反馈。</p>
              </div>
            </form>

            <TransitionGroup name="comment-stack" tag="ul" class="comment-list">
              <li
                v-for="(comment, index) in comments"
                :key="comment.id"
                class="comment-card"
                :style="getCommentStyle(index)"
              >
                <div class="comment-card__avatar">{{ getCommentAvatar(comment.author) }}</div>
                <div class="comment-card__body">
                  <header class="comment-card__head">
                    <div>
                      <strong>{{ comment.author }}</strong>
                      <span v-if="comment.role" class="comment-card__role">{{ comment.role }}</span>
                    </div>
                    <time>{{ formatCommentTime(comment.createdAt) }}</time>
                  </header>

                  <p>{{ comment.content }}</p>

                  <footer class="comment-card__foot">
                    <button
                      type="button"
                      class="comment-like icon-host"
                      :class="{
                        'comment-like--active': comment.likedByViewer,
                        'comment-like--pulse': commentLikePulseId === comment.id,
                      }"
                      @click="toggleCommentLike(comment.id)"
                    >
                      <Heart class="icon icon--xs icon--stroke-strong comment-like__icon icon--react" aria-hidden="true" />
                      <span>{{ comment.likes }}</span>
                    </button>
                  </footer>
                </div>
              </li>
            </TransitionGroup>
          </section>

          <section class="article-jump" aria-label="文章导航">
            <RouterLink
              v-if="adjacentPosts.next"
              class="article-jump__card"
              :to="getPostRoute(adjacentPosts.next.id)"
            >
              <span>下一篇</span>
              <strong>{{ adjacentPosts.next.title }}</strong>
            </RouterLink>

            <div v-else class="article-jump__card article-jump__card--empty">
              <span>下一篇</span>
              <strong>已经是最新文章</strong>
            </div>

            <RouterLink
              v-if="adjacentPosts.previous"
              class="article-jump__card"
              :to="getPostRoute(adjacentPosts.previous.id)"
            >
              <span>上一篇</span>
              <strong>{{ adjacentPosts.previous.title }}</strong>
            </RouterLink>

            <div v-else class="article-jump__card article-jump__card--empty">
              <span>上一篇</span>
              <strong>已经是最早文章</strong>
            </div>
          </section>

          <section class="article-related" aria-label="相关文章">
            <header class="article-related__head">
              <h2>继续阅读</h2>
              <RouterLink :to="{ name: 'home' }">返回首页</RouterLink>
            </header>

            <div class="article-related__grid">
              <RouterLink
                v-for="(related, index) in relatedPosts"
                :key="related.id"
                class="article-related__card"
                :to="getPostRoute(related.id)"
                :style="getRelatedCardStyle(index)"
              >
                <p>{{ related.category }} · {{ related.readingMinutes }} 分钟</p>
                <h3>{{ related.title }}</h3>
                <span>{{ related.summary }}</span>
              </RouterLink>
            </div>
          </section>
        </section>

        <aside class="article-side">
          <nav class="article-toc" aria-label="文章目录">
            <header class="article-toc__head">
              <h2>自动目录</h2>
              <p>{{ activeSectionTitle }}</p>
            </header>

            <ul class="article-toc__list">
              <li v-for="item in tocItems" :key="item.anchor" class="article-toc__item">
                <a
                  href="#"
                  class="article-toc__link"
                  :class="{ 'article-toc__link--active': activeSectionAnchor === item.anchor }"
                  @click.prevent="onTocClick(item.anchor)"
                >
                  <span>{{ item.index }}</span>
                  <em>{{ item.title }}</em>
                </a>
              </li>
            </ul>
          </nav>

          <section class="article-pulse" aria-label="实时状态">
            <p class="article-pulse__kicker">INTERACTION STATUS</p>
            <div class="article-pulse__row">
              <span>正文进度</span>
              <strong>{{ readingPercent }}%</strong>
            </div>
            <div class="article-pulse__row">
              <span>剩余阅读</span>
              <strong>{{ readingRemainingLabel }}</strong>
            </div>
            <div class="article-pulse__row">
              <span>当前段落</span>
              <strong>{{ activeSectionTitle }}</strong>
            </div>
            <div class="article-pulse__row">
              <span>段落定位</span>
              <strong>{{ activeParagraphLabel }}</strong>
            </div>
            <div class="article-pulse__row">
              <span>实时评论</span>
              <strong>{{ comments.length }} 条</strong>
            </div>
          </section>
        </aside>
      </div>
    </template>

    <section v-else class="article-empty">
      <p class="article-empty__kicker">404 POST</p>
      <h1 class="article-empty__title">文章不存在或已下线</h1>
      <p class="article-empty__desc">
        当前访问的文章标识是 <strong>{{ postId }}</strong>。
      </p>
      <div class="article-empty__actions">
        <RouterLink :to="{ name: 'home' }">回到首页</RouterLink>
        <RouterLink :to="{ name: 'timeline' }">查看时间线</RouterLink>
      </div>
    </section>

    <Teleport to="body">
      <Transition name="article-lightbox-fade">
        <section v-if="activeLightboxImage" class="article-lightbox" aria-label="图片预览" @click.self="closeLightbox">
          <button type="button" class="article-lightbox__close icon-host" @click="closeLightbox">
            <X class="icon icon--sm icon--stroke-strong" aria-hidden="true" />
            <span>关闭</span>
          </button>
          <button
            v-if="lightboxImages.length > 1"
            type="button"
            class="article-lightbox__nav article-lightbox__nav--prev icon-host"
            @click="moveLightbox(-1)"
          >
            <ChevronLeft class="icon icon--md icon--stroke-strong" aria-hidden="true" />
          </button>
          <figure class="article-lightbox__figure">
            <img :src="activeLightboxImage.src" :alt="activeLightboxImage.alt" />
            <figcaption>
              {{ activeLightboxImage.caption ?? activeLightboxImage.alt }}
            </figcaption>
          </figure>
          <button
            v-if="lightboxImages.length > 1"
            type="button"
            class="article-lightbox__nav article-lightbox__nav--next icon-host"
            @click="moveLightbox(1)"
          >
            <ChevronRight class="icon icon--md icon--stroke-strong" aria-hidden="true" />
          </button>
        </section>
      </Transition>
    </Teleport>
  </main>
</template>
