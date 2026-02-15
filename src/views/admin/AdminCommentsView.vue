<script setup lang="ts">
import {
  CheckCheck,
  Clock3,
  Eye,
  EyeOff,
  Filter,
  MessageCircleMore,
  Search,
  Trash2,
} from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'

import { useBlogStore } from '@/stores/blog'
import type { BlogCommentStatus } from '@/types/blog'

interface FlatCommentItem {
  selectionKey: string
  postId: string
  postTitle: string
  commentId: string
  author: string
  content: string
  createdAt: string
  likes: number
  status: BlogCommentStatus
}

const blogStore = useBlogStore()

const loading = ref(false)
const pending = ref(false)
const filterKeyword = ref('')
const filterPostId = ref('all')
const filterStatus = ref<'all' | BlogCommentStatus>('all')
const selectedKeys = ref<string[]>([])
const errorText = ref('')
const feedback = ref('')

const statusLabelMap: Record<BlogCommentStatus, string> = {
  visible: '可见',
  pending: '待审',
  hidden: '隐藏',
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const toSelectionKey = (postId: string, commentId: string) => `${postId}::${commentId}`

const fromSelectionKey = (value: string) => {
  const [postId, commentId] = value.split('::')
  return {
    postId: postId ?? '',
    commentId: commentId ?? '',
  }
}

const commentList = computed<FlatCommentItem[]>(() => {
  return blogStore.posts
    .flatMap((post) => {
      return blogStore.getCommentsForAdmin(post.id).map((comment) => ({
        selectionKey: toSelectionKey(post.id, comment.id),
        postId: post.id,
        postTitle: post.title,
        commentId: comment.id,
        author: comment.author,
        content: comment.content,
        createdAt: comment.createdAt,
        likes: comment.likes,
        status: comment.status ?? 'visible',
      }))
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})

const postFilterOptions = computed(() => {
  return blogStore.posts
    .map((post) => ({
      id: post.id,
      title: post.title,
    }))
    .sort((a, b) => a.title.localeCompare(b.title))
})

const filteredComments = computed(() => {
  const normalizedKeyword = filterKeyword.value.trim().toLowerCase()

  return commentList.value.filter((item) => {
    if (filterPostId.value !== 'all' && item.postId !== filterPostId.value) {
      return false
    }

    if (filterStatus.value !== 'all' && item.status !== filterStatus.value) {
      return false
    }

    if (!normalizedKeyword) {
      return true
    }

    const searchText = `${item.author} ${item.content} ${item.postTitle}`.toLowerCase()
    return searchText.includes(normalizedKeyword)
  })
})

const selectedCount = computed(() => selectedKeys.value.length)

const allFilteredSelected = computed(() => {
  if (filteredComments.value.length === 0) {
    return false
  }

  return filteredComments.value.every((item) => selectedKeys.value.includes(item.selectionKey))
})

const stats = computed(() => {
  const total = commentList.value.length
  const visible = commentList.value.filter((item) => item.status === 'visible').length
  const pendingCount = commentList.value.filter((item) => item.status === 'pending').length
  const hidden = commentList.value.filter((item) => item.status === 'hidden').length

  return [
    { id: 'total', label: '总评论', value: total },
    { id: 'visible', label: '可见', value: visible },
    { id: 'pending', label: '待审', value: pendingCount },
    { id: 'hidden', label: '隐藏', value: hidden },
  ]
})

const formatDateTime = (value: string) => {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

const showFeedback = async (text: string) => {
  feedback.value = text
  await sleep(1600)

  if (feedback.value === text) {
    feedback.value = ''
  }
}

const isSelected = (selectionKey: string) => selectedKeys.value.includes(selectionKey)

const toggleSelect = (selectionKey: string) => {
  if (isSelected(selectionKey)) {
    selectedKeys.value = selectedKeys.value.filter((item) => item !== selectionKey)
    return
  }

  selectedKeys.value = [...selectedKeys.value, selectionKey]
}

const toggleSelectAllFiltered = () => {
  if (allFilteredSelected.value) {
    selectedKeys.value = selectedKeys.value.filter(
      (item) => !filteredComments.value.some((comment) => comment.selectionKey === item),
    )
    return
  }

  const merged = new Set([
    ...selectedKeys.value,
    ...filteredComments.value.map((comment) => comment.selectionKey),
  ])
  selectedKeys.value = Array.from(merged)
}

const updateCommentStatus = async (
  postId: string,
  commentId: string,
  status: BlogCommentStatus,
) => {
  if (pending.value) {
    return
  }

  errorText.value = ''
  pending.value = true

  try {
    await blogStore.updateComment(postId, commentId, { status })
    await showFeedback(`评论状态已更新为「${statusLabelMap[status]}」`)
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '评论状态更新失败'
  } finally {
    pending.value = false
  }
}

const deleteComment = async (postId: string, commentId: string, selectionKey: string) => {
  if (pending.value) {
    return
  }

  const confirmed = window.confirm('确认删除这条评论？')

  if (!confirmed) {
    return
  }

  errorText.value = ''
  pending.value = true

  try {
    await blogStore.removeComment(postId, commentId)
    selectedKeys.value = selectedKeys.value.filter((item) => item !== selectionKey)
    await showFeedback('评论已删除')
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '评论删除失败'
  } finally {
    pending.value = false
  }
}

const updateBatchStatus = async (status: BlogCommentStatus) => {
  if (selectedKeys.value.length === 0 || pending.value) {
    return
  }

  errorText.value = ''
  pending.value = true

  try {
    await blogStore.batchUpdateCommentStatus(
      selectedKeys.value.map((item) => {
        const parsed = fromSelectionKey(item)
        return {
          postId: parsed.postId,
          commentId: parsed.commentId,
          status,
        }
      }),
    )

    await showFeedback(`批量更新完成: ${statusLabelMap[status]}`)
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '批量状态更新失败'
  } finally {
    pending.value = false
  }
}

const deleteSelectedComments = async () => {
  if (selectedKeys.value.length === 0 || pending.value) {
    return
  }

  const confirmed = window.confirm(`确认删除选中的 ${selectedKeys.value.length} 条评论？`)

  if (!confirmed) {
    return
  }

  errorText.value = ''
  pending.value = true

  try {
    await blogStore.batchRemoveComments(
      selectedKeys.value.map((item) => {
        const parsed = fromSelectionKey(item)
        return {
          postId: parsed.postId,
          commentId: parsed.commentId,
        }
      }),
    )

    selectedKeys.value = []
    await showFeedback('批量删除完成')
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '批量删除失败'
  } finally {
    pending.value = false
  }
}

watch(
  filteredComments,
  (items) => {
    const keySet = new Set(items.map((item) => item.selectionKey))
    selectedKeys.value = selectedKeys.value.filter((item) => keySet.has(item))
  },
  { deep: true },
)

onMounted(async () => {
  if (blogStore.isHydrated || blogStore.isInitializing) {
    return
  }

  loading.value = true
  await blogStore.initialize()
  loading.value = false
})
</script>

<template>
  <section class="admin-page admin-comments-page">
    <header class="admin-page__head">
      <p>COMMENT CENTER</p>
      <h2>评论管理</h2>
      <span>按状态审核、隐藏和批量处理，操作会即时影响前台展示。</span>
    </header>

    <section class="admin-comments-toolbar">
      <label class="admin-input-wrap admin-input-wrap--search">
        <Search class="icon icon--sm icon--stroke-strong" aria-hidden="true" />
        <input v-model="filterKeyword" type="search" placeholder="搜索作者、内容、文章..." />
      </label>

      <select v-model="filterPostId" class="admin-select">
        <option value="all">全部文章</option>
        <option v-for="item in postFilterOptions" :key="item.id" :value="item.id">
          {{ item.title }}
        </option>
      </select>

      <select v-model="filterStatus" class="admin-select">
        <option value="all">全部状态</option>
        <option value="visible">可见</option>
        <option value="pending">待审</option>
        <option value="hidden">隐藏</option>
      </select>
    </section>

    <p v-if="loading" class="admin-page__hint">正在载入评论数据...</p>
    <p v-if="errorText" class="admin-page__hint admin-page__hint--warn">{{ errorText }}</p>
    <p v-if="feedback" class="admin-page__hint">{{ feedback }}</p>

    <section class="admin-comments-metrics">
      <article v-for="item in stats" :key="item.id" class="admin-comments-metric">
        <strong>{{ item.value }}</strong>
        <span>{{ item.label }}</span>
      </article>
    </section>

    <section v-if="filteredComments.length > 0" class="admin-comments-selection">
      <label>
        <input :checked="allFilteredSelected" type="checkbox" @change="toggleSelectAllFiltered" />
        <span>当前筛选全选</span>
      </label>

      <Transition name="admin-soft-fade">
        <div v-if="selectedCount > 0" class="admin-comments-bulk">
          <span>已选 {{ selectedCount }} 条</span>
          <button type="button" class="admin-action-btn icon-host" :disabled="pending" @click="updateBatchStatus('visible')">
            <CheckCheck class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
            <span>批量通过</span>
          </button>
          <button type="button" class="admin-action-btn icon-host" :disabled="pending" @click="updateBatchStatus('pending')">
            <Clock3 class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
            <span>批量待审</span>
          </button>
          <button type="button" class="admin-action-btn icon-host" :disabled="pending" @click="updateBatchStatus('hidden')">
            <EyeOff class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
            <span>批量隐藏</span>
          </button>
          <button
            type="button"
            class="admin-action-btn admin-action-btn--danger icon-host"
            :disabled="pending"
            @click="deleteSelectedComments"
          >
            <Trash2 class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
            <span>批量删除</span>
          </button>
        </div>
      </Transition>
    </section>

    <TransitionGroup
      v-if="filteredComments.length > 0"
      name="admin-list-shift"
      tag="ul"
      class="admin-comments-list"
    >
      <li
        v-for="item in filteredComments"
        :key="item.selectionKey"
        class="admin-comments-card"
        :class="`admin-comments-card--${item.status}`"
      >
        <header class="admin-comments-card__head">
          <label class="admin-comments-card__check">
            <input :checked="isSelected(item.selectionKey)" type="checkbox" @change="toggleSelect(item.selectionKey)" />
          </label>
          <div>
            <h3>{{ item.author }}</h3>
            <p>{{ item.postTitle }}</p>
          </div>
          <span class="admin-comments-status">
            <Filter class="icon icon--xs icon--stroke-strong" aria-hidden="true" />
            {{ statusLabelMap[item.status] }}
          </span>
        </header>

        <p class="admin-comments-card__content">{{ item.content }}</p>

        <ul class="admin-comments-card__meta">
          <li>{{ formatDateTime(item.createdAt) }}</li>
          <li>{{ item.likes }} 赞</li>
        </ul>

        <footer class="admin-comments-card__actions">
          <button
            type="button"
            class="admin-action-btn icon-host"
            :disabled="pending"
            @click="updateCommentStatus(item.postId, item.commentId, 'visible')"
          >
            <Eye class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
            <span>通过</span>
          </button>
          <button
            type="button"
            class="admin-action-btn icon-host"
            :disabled="pending"
            @click="updateCommentStatus(item.postId, item.commentId, 'pending')"
          >
            <Clock3 class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
            <span>待审</span>
          </button>
          <button
            type="button"
            class="admin-action-btn icon-host"
            :disabled="pending"
            @click="updateCommentStatus(item.postId, item.commentId, 'hidden')"
          >
            <EyeOff class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
            <span>隐藏</span>
          </button>
          <button
            type="button"
            class="admin-action-btn admin-action-btn--danger icon-host"
            :disabled="pending"
            @click="deleteComment(item.postId, item.commentId, item.selectionKey)"
          >
            <Trash2 class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
            <span>删除</span>
          </button>
        </footer>
      </li>
    </TransitionGroup>

    <article v-else class="admin-empty-card">
      <MessageCircleMore class="icon icon--lg icon--stroke-strong" aria-hidden="true" />
      <h3>暂无匹配评论</h3>
      <p>可以切换筛选或等待新的评论进入队列。</p>
    </article>
  </section>
</template>
