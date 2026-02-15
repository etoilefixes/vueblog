<script setup lang="ts">
import {
  Activity,
  Clock3,
  History,
  Link2,
  RefreshCcw,
  RefreshCw,
  Save,
} from 'lucide-vue-next'
import { computed, onMounted, reactive, ref } from 'vue'

import { adminApi } from '@/services/admin-api'
import { useBlogStore } from '@/stores/blog'
import type { AdminPublishPreviewPayload, AdminPublishRecord } from '@/types/admin'

const blogStore = useBlogStore()

const loading = ref(false)
const pendingAction = ref<'none' | 'preview' | 'commit' | 'rollback'>('none')
const errorText = ref('')
const feedback = ref('')
const publishHistory = ref<AdminPublishRecord[]>([])
const previewPayload = ref<AdminPublishPreviewPayload | null>(null)

const form = reactive({
  previewMinutes: 30,
  version: '',
  note: '',
  rollbackTargetId: '',
  rollbackReason: '',
})

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

const publishedRecords = computed(() => {
  return publishHistory.value.filter((item) => item.source === 'publish')
})

const latestPublishedRecord = computed(() => {
  return publishedRecords.value[0] ?? null
})

const draftSummary = computed(() => {
  return {
    posts: blogStore.posts.length,
    comments: blogStore.totalComments,
    links: blogStore.links.length,
  }
})

const metrics = computed(() => {
  const total = publishHistory.value.length
  const publishCount = publishHistory.value.filter((item) => item.source === 'publish').length
  const rollbackCount = publishHistory.value.filter((item) => item.source === 'rollback').length
  const lastTime = publishHistory.value[0]?.createdAt

  return [
    { id: 'total', label: '发布记录', value: total },
    { id: 'publish', label: '正式发布', value: publishCount },
    { id: 'rollback', label: '回滚次数', value: rollbackCount },
    { id: 'last', label: '最近操作', value: lastTime ? formatDateTime(lastTime) : '--' },
  ]
})

const buildDefaultVersion = () => {
  const now = new Date()
  const dateKey = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(
    now.getDate(),
  ).padStart(2, '0')}`
  const sequence = publishedRecords.value.length + 1
  return `v${dateKey}-${sequence}`
}

const showFeedback = async (text: string) => {
  feedback.value = text
  await sleep(1600)

  if (feedback.value === text) {
    feedback.value = ''
  }
}

const loadPublishHistory = async () => {
  loading.value = true
  errorText.value = ''

  try {
    publishHistory.value = await adminApi.getPublishHistory()

    if (!form.version) {
      form.version = buildDefaultVersion()
    }

    if (!form.rollbackTargetId && publishedRecords.value.length > 0) {
      const firstPublished = publishedRecords.value[0]

      if (firstPublished) {
        form.rollbackTargetId = firstPublished.id
      }
    }
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '发布记录加载失败'
  } finally {
    loading.value = false
  }
}

const createPreview = async () => {
  if (pendingAction.value !== 'none') {
    return
  }

  pendingAction.value = 'preview'
  errorText.value = ''

  try {
    previewPayload.value = await adminApi.createPublishPreview({
      expiresInMinutes: form.previewMinutes,
    })
    await showFeedback('预览链接已生成')
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '预览链接生成失败'
  } finally {
    pendingAction.value = 'none'
  }
}

const copyPreviewUrl = async () => {
  const target = previewPayload.value?.previewUrl

  if (!target) {
    return
  }

  try {
    await navigator.clipboard.writeText(target)
    await showFeedback('预览链接已复制')
  } catch {
    const input = document.createElement('input')
    input.value = target
    document.body.appendChild(input)
    input.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(input)

    if (copied) {
      await showFeedback('预览链接已复制')
      return
    }

    errorText.value = '复制失败，请手动复制链接'
  }
}

const commitPublish = async () => {
  if (pendingAction.value !== 'none') {
    return
  }

  pendingAction.value = 'commit'
  errorText.value = ''

  try {
    const record = await adminApi.commitPublish({
      version: form.version.trim(),
      note: form.note.trim(),
    })
    publishHistory.value = [record, ...publishHistory.value]
    form.note = ''
    form.version = buildDefaultVersion()
    if (!form.rollbackTargetId) {
      form.rollbackTargetId = record.id
    }
    await showFeedback(`发布完成：${record.version}`)
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '发布失败'
  } finally {
    pendingAction.value = 'none'
  }
}

const rollbackPublish = async () => {
  if (pendingAction.value !== 'none') {
    return
  }

  pendingAction.value = 'rollback'
  errorText.value = ''

  try {
    const record = await adminApi.rollbackPublish({
      targetRecordId: form.rollbackTargetId,
      reason: form.rollbackReason.trim(),
    })
    publishHistory.value = [record, ...publishHistory.value]
    form.rollbackReason = ''
    await showFeedback(`回滚完成：${record.version}`)
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '回滚失败'
  } finally {
    pendingAction.value = 'none'
  }
}

onMounted(async () => {
  if (!blogStore.isHydrated && !blogStore.isInitializing) {
    await blogStore.initialize()
  }

  await loadPublishHistory()
})
</script>

<template>
  <section class="admin-page admin-publish-page">
    <header class="admin-page__head">
      <p>PUBLISH CENTER</p>
      <h2>发布中心</h2>
      <span>生成预览链接、执行正式发布，并在异常时快速回滚。</span>
    </header>

    <p v-if="loading" class="admin-page__hint">发布中心加载中...</p>
    <p v-if="errorText" class="admin-page__hint admin-page__hint--warn">{{ errorText }}</p>
    <p v-if="feedback" class="admin-page__hint">{{ feedback }}</p>

    <section class="admin-publish-metrics">
      <article v-for="item in metrics" :key="item.id" class="admin-publish-metric">
        <strong>{{ item.value }}</strong>
        <span>{{ item.label }}</span>
      </article>
    </section>

    <section class="admin-publish-layout">
      <article class="admin-publish-panel">
        <header>
          <h3>当前草稿快照</h3>
          <small>用于发布前确认数据规模</small>
        </header>

        <ul class="admin-publish-kv">
          <li>
            <Activity class="icon icon--xs icon--stroke-strong" aria-hidden="true" />
            <span>文章 {{ draftSummary.posts }} 篇</span>
          </li>
          <li>
            <Clock3 class="icon icon--xs icon--stroke-strong" aria-hidden="true" />
            <span>评论 {{ draftSummary.comments }} 条</span>
          </li>
          <li>
            <Link2 class="icon icon--xs icon--stroke-strong" aria-hidden="true" />
            <span>友链 {{ draftSummary.links }} 个</span>
          </li>
        </ul>

        <p class="admin-runtime-preview">
          <strong>最近正式发布：</strong>
          <span v-if="latestPublishedRecord">
            {{ latestPublishedRecord.version }} · {{ formatDateTime(latestPublishedRecord.createdAt) }}
          </span>
          <span v-else>暂无记录</span>
        </p>
      </article>

      <article class="admin-publish-panel">
        <header>
          <h3>预览链接</h3>
          <small>用于发布前验收页面效果</small>
        </header>

        <label class="admin-field">
          <span>链接有效期（分钟）</span>
          <select v-model.number="form.previewMinutes" class="admin-select">
            <option :value="15">15 分钟</option>
            <option :value="30">30 分钟</option>
            <option :value="60">60 分钟</option>
            <option :value="120">120 分钟</option>
          </select>
        </label>

        <div class="admin-publish-actions">
          <button type="button" class="admin-action-btn icon-host" :disabled="pendingAction !== 'none'" @click="createPreview">
            <RefreshCw class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
            <span>{{ pendingAction === 'preview' ? '生成中...' : '生成预览链接' }}</span>
          </button>
        </div>

        <div v-if="previewPayload" class="admin-publish-preview">
          <p>{{ previewPayload.previewUrl }}</p>
          <small>失效时间：{{ formatDateTime(previewPayload.expiresAt) }}</small>
          <button type="button" class="admin-action-btn icon-host" @click="copyPreviewUrl">复制链接</button>
        </div>
      </article>

      <article class="admin-publish-panel">
        <header>
          <h3>正式发布</h3>
          <small>将当前草稿提交为线上版本</small>
        </header>

        <label class="admin-field">
          <span>版本号</span>
          <input v-model="form.version" type="text" maxlength="40" />
        </label>

        <label class="admin-field">
          <span>发布说明</span>
          <textarea
            v-model="form.note"
            rows="3"
            maxlength="240"
            placeholder="说明本次改动范围与目标"
          />
        </label>

        <div class="admin-publish-actions">
          <button
            type="button"
            class="admin-action-btn admin-action-btn--strong icon-host"
            :disabled="pendingAction !== 'none'"
            @click="commitPublish"
          >
            <Save class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
            <span>{{ pendingAction === 'commit' ? '发布中...' : '确认发布' }}</span>
          </button>
        </div>
      </article>

      <article class="admin-publish-panel">
        <header>
          <h3>版本回滚</h3>
          <small>异常时快速恢复到历史稳定版本</small>
        </header>

        <label class="admin-field">
          <span>目标版本</span>
          <select v-model="form.rollbackTargetId" class="admin-select">
            <option value="" disabled>请选择回滚目标</option>
            <option v-for="item in publishedRecords" :key="item.id" :value="item.id">
              {{ item.version }} · {{ formatDateTime(item.createdAt) }}
            </option>
          </select>
        </label>

        <label class="admin-field">
          <span>回滚说明</span>
          <textarea
            v-model="form.rollbackReason"
            rows="3"
            maxlength="240"
            placeholder="说明触发回滚的原因"
          />
        </label>

        <div class="admin-publish-actions">
          <button
            type="button"
            class="admin-action-btn admin-action-btn--danger icon-host"
            :disabled="pendingAction !== 'none' || !form.rollbackTargetId"
            @click="rollbackPublish"
          >
            <RefreshCcw class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
            <span>{{ pendingAction === 'rollback' ? '回滚中...' : '执行回滚' }}</span>
          </button>
        </div>
      </article>
    </section>

    <section class="admin-publish-panel admin-publish-panel--history">
      <header>
        <h3>发布历史</h3>
        <small>记录谁在什么时间做了发布/回滚</small>
      </header>

      <TransitionGroup v-if="publishHistory.length > 0" name="admin-list-shift" tag="ul" class="admin-publish-history-list">
        <li v-for="item in publishHistory" :key="item.id" class="admin-publish-history-card">
          <header>
            <span
              class="admin-log-action"
              :class="{ 'admin-log-action--rollback': item.source === 'rollback' }"
            >
              <History class="icon icon--xs icon--stroke-strong" aria-hidden="true" />
              {{ item.source === 'publish' ? '发布' : '回滚' }}
            </span>
            <time>{{ formatDateTime(item.createdAt) }}</time>
          </header>
          <h4>{{ item.version }}</h4>
          <p>{{ item.note }}</p>
          <ul class="admin-publish-history-meta">
            <li>操作者：{{ item.actorName }}</li>
            <li>文章：{{ item.summary.posts }}</li>
            <li>评论：{{ item.summary.comments }}</li>
          </ul>
        </li>
      </TransitionGroup>

      <article v-else class="admin-empty-card">
        <h3>暂无发布记录</h3>
        <p>执行一次发布后，这里会自动展示完整历史。</p>
      </article>
    </section>
  </section>
</template>
