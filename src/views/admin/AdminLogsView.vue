<script setup lang="ts">
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  TerminalSquare,
  X,
} from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

import { adminApi } from '@/services/admin-api'
import type { AdminAuditLog } from '@/types/admin'

const loading = ref(false)
const errorText = ref('')
const feedback = ref('')
const logs = ref<AdminAuditLog[]>([])
const selectedLog = ref<AdminAuditLog | null>(null)
const currentPage = ref(1)
const pageSize = ref(12)

const filters = reactive({
  keyword: '',
  action: 'all',
  targetType: 'all',
  limit: 60,
})

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))

const actionOptions = computed(() => {
  const defaults = ['post.update', 'comment.batch_status', 'site.update', 'theme.activate']
  const values = new Set<string>(defaults)
  logs.value.forEach((item) => values.add(item.action))
  return Array.from(values)
})

const targetTypeOptions = computed(() => {
  const defaults = ['post', 'comment', 'site', 'theme']
  const values = new Set<string>(defaults)
  logs.value.forEach((item) => values.add(item.targetType))
  return Array.from(values)
})

const metrics = computed(() => {
  const actors = new Set(logs.value.map((item) => item.actorName)).size
  const actions = new Set(logs.value.map((item) => item.action)).size
  const latest = logs.value[0]?.createdAt ?? ''

  return [
    { id: 'total', label: '日志条数', value: logs.value.length },
    { id: 'actors', label: '操作者', value: actors },
    { id: 'actions', label: '动作类型', value: actions },
    { id: 'latest', label: '最新记录', value: latest ? formatDateTime(latest) : '--' },
  ]
})

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(logs.value.length / pageSize.value))
})

const pageStartIndex = computed(() => {
  return (currentPage.value - 1) * pageSize.value
})

const pageEndIndex = computed(() => {
  return pageStartIndex.value + pageSize.value
})

const pagedLogs = computed(() => {
  return logs.value.slice(pageStartIndex.value, pageEndIndex.value)
})

const pageSummary = computed(() => {
  if (logs.value.length === 0) {
    return '0 / 0'
  }

  const from = pageStartIndex.value + 1
  const to = Math.min(pageEndIndex.value, logs.value.length)

  return `${from}-${to} / ${logs.value.length}`
})

const canPrevPage = computed(() => currentPage.value > 1)
const canNextPage = computed(() => currentPage.value < totalPages.value)

const pageNumbers = computed(() => {
  const total = totalPages.value
  const current = currentPage.value

  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  if (current <= 4) {
    return [1, 2, 3, 4, 5, total]
  }

  if (current >= total - 3) {
    return [1, total - 4, total - 3, total - 2, total - 1, total]
  }

  return [1, current - 1, current, current + 1, total]
})

const queryPayload = () => {
  return {
    keyword: filters.keyword.trim() || undefined,
    action: filters.action !== 'all' ? filters.action : undefined,
    targetType: filters.targetType !== 'all' ? filters.targetType : undefined,
    limit: filters.limit,
  }
}

const setPage = (page: number) => {
  const safe = Math.min(Math.max(page, 1), totalPages.value)
  currentPage.value = safe
}

const goPrevPage = () => {
  if (!canPrevPage.value) {
    return
  }

  setPage(currentPage.value - 1)
}

const goNextPage = () => {
  if (!canNextPage.value) {
    return
  }

  setPage(currentPage.value + 1)
}

const escapeCsvCell = (value: unknown) => {
  const normalized = String(value ?? '')

  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`
  }

  return normalized
}

const exportLogsCsv = async () => {
  if (logs.value.length === 0) {
    feedback.value = '当前筛选无日志可导出'
    await sleep(1200)

    if (feedback.value === '当前筛选无日志可导出') {
      feedback.value = ''
    }
    return
  }

  const headers = ['id', 'actorName', 'action', 'targetType', 'targetId', 'summary', 'createdAt', 'ip']
  const lines = [headers.join(',')]

  logs.value.forEach((item) => {
    const row = [
      item.id,
      item.actorName,
      item.action,
      item.targetType,
      item.targetId,
      item.summary,
      item.createdAt,
      item.ip ?? '',
    ]
      .map((cell) => escapeCsvCell(cell))
      .join(',')

    lines.push(row)
  })

  const bom = '\uFEFF'
  const blob = new Blob([`${bom}${lines.join('\n')}`], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const dateKey = new Date().toISOString().slice(0, 10)

  anchor.href = url
  anchor.download = `admin-audit-logs-${dateKey}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)

  feedback.value = 'CSV 已导出'
  await sleep(1200)

  if (feedback.value === 'CSV 已导出') {
    feedback.value = ''
  }
}

const loadLogs = async (showToast = false) => {
  loading.value = true
  errorText.value = ''

  try {
    logs.value = await adminApi.getAuditLogs(queryPayload())
    setPage(currentPage.value)

    if (showToast) {
      feedback.value = '日志已刷新'
      await sleep(1200)

      if (feedback.value === '日志已刷新') {
        feedback.value = ''
      }
    }
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '日志加载失败'
  } finally {
    loading.value = false
  }
}

let debounceTimer = 0

watch(
  () => [filters.keyword, filters.action, filters.targetType, filters.limit],
  () => {
    currentPage.value = 1
    window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => {
      void loadLogs()
    }, 220)
  },
)

watch(pageSize, () => {
  currentPage.value = 1
})

watch(selectedLog, (value) => {
  document.body.style.overflow = value ? 'hidden' : ''
})

const openDetail = (item: AdminAuditLog) => {
  selectedLog.value = item
}

const closeDetail = () => {
  selectedLog.value = null
}

onMounted(async () => {
  await loadLogs()
})

onUnmounted(() => {
  window.clearTimeout(debounceTimer)
  document.body.style.overflow = ''
})
</script>

<template>
  <section class="admin-page admin-logs-page">
    <header class="admin-page__head">
      <p>AUDIT LOGS</p>
      <h2>操作日志</h2>
      <span>关键写操作可追踪，支持按动作与资源过滤检索。</span>
    </header>

    <section class="admin-logs-toolbar">
      <label class="admin-input-wrap admin-input-wrap--search">
        <Search class="icon icon--sm icon--stroke-strong" aria-hidden="true" />
        <input v-model="filters.keyword" type="search" placeholder="搜索操作者、动作、资源、摘要..." />
      </label>

      <select v-model="filters.action" class="admin-select">
        <option value="all">全部动作</option>
        <option v-for="item in actionOptions" :key="item" :value="item">{{ item }}</option>
      </select>

      <select v-model="filters.targetType" class="admin-select">
        <option value="all">全部资源</option>
        <option v-for="item in targetTypeOptions" :key="item" :value="item">{{ item }}</option>
      </select>

      <select v-model.number="filters.limit" class="admin-select">
        <option :value="30">最近 30 条</option>
        <option :value="60">最近 60 条</option>
        <option :value="100">最近 100 条</option>
      </select>

      <select v-model.number="pageSize" class="admin-select">
        <option :value="8">每页 8 条</option>
        <option :value="12">每页 12 条</option>
        <option :value="20">每页 20 条</option>
      </select>

      <button type="button" class="admin-action-btn icon-host" @click="loadLogs(true)">
        <RefreshCw class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
        <span>刷新</span>
      </button>

      <button type="button" class="admin-action-btn icon-host" @click="exportLogsCsv">
        <Download class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
        <span>导出 CSV</span>
      </button>
    </section>

    <p v-if="loading" class="admin-page__hint">日志加载中...</p>
    <p v-if="errorText" class="admin-page__hint admin-page__hint--warn">{{ errorText }}</p>
    <p v-if="feedback" class="admin-page__hint">{{ feedback }}</p>

    <section class="admin-logs-metrics">
      <article v-for="item in metrics" :key="item.id" class="admin-logs-metric">
        <strong>{{ item.value }}</strong>
        <span>{{ item.label }}</span>
      </article>
    </section>

    <TransitionGroup
      v-if="logs.length > 0"
      name="admin-list-shift"
      tag="ul"
      class="admin-logs-list"
    >
      <li v-for="item in pagedLogs" :key="item.id" class="admin-log-card">
        <header>
          <span class="admin-log-action">
            <Filter class="icon icon--xs icon--stroke-strong" aria-hidden="true" />
            {{ item.action }}
          </span>
          <time>{{ formatDateTime(item.createdAt) }}</time>
        </header>

        <p class="admin-log-summary">{{ item.summary }}</p>

        <ul class="admin-log-meta">
          <li>
            <ShieldCheck class="icon icon--xs icon--stroke-strong" aria-hidden="true" />
            <span>{{ item.actorName }}</span>
          </li>
          <li>
            <Activity class="icon icon--xs icon--stroke-strong" aria-hidden="true" />
            <span>{{ item.targetType }} / {{ item.targetId }}</span>
          </li>
          <li v-if="item.ip">
            <TerminalSquare class="icon icon--xs icon--stroke-strong" aria-hidden="true" />
            <span>{{ item.ip }}</span>
          </li>
        </ul>

        <footer>
          <button type="button" class="admin-action-btn icon-host" @click="openDetail(item)">
            <Clock3 class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
            <span>查看详情</span>
          </button>
        </footer>
      </li>
    </TransitionGroup>

    <section v-if="logs.length > 0" class="admin-logs-pagination">
      <p>{{ pageSummary }}</p>
      <div>
        <button
          type="button"
          class="admin-action-btn icon-host"
          :disabled="!canPrevPage"
          @click="goPrevPage"
        >
          <ChevronLeft class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
          <span>上一页</span>
        </button>

        <button
          v-for="page in pageNumbers"
          :key="`page-${page}`"
          type="button"
          class="admin-action-btn admin-page-num-btn"
          :class="{ 'admin-page-num-btn--active': page === currentPage }"
          @click="setPage(page)"
        >
          {{ page }}
        </button>

        <button
          type="button"
          class="admin-action-btn icon-host"
          :disabled="!canNextPage"
          @click="goNextPage"
        >
          <span>下一页</span>
          <ChevronRight class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
        </button>
      </div>
    </section>

    <article v-else class="admin-empty-card">
      <TerminalSquare class="icon icon--lg icon--stroke-strong" aria-hidden="true" />
      <h3>暂无日志记录</h3>
      <p>当前筛选下没有匹配内容。</p>
    </article>
  </section>

  <Teleport to="body">
    <Transition name="admin-float-panel">
      <div v-if="selectedLog" class="admin-float-overlay" @click.self="closeDetail">
        <section class="admin-log-detail-panel">
          <header>
            <div>
              <p>LOG DETAIL</p>
              <h3>{{ selectedLog.action }}</h3>
            </div>
            <button type="button" class="admin-shell__mobile-close icon-host" aria-label="关闭" @click="closeDetail">
              <X class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
            </button>
          </header>

          <ul class="admin-log-detail-grid">
            <li>
              <strong>ID</strong>
              <span>{{ selectedLog.id }}</span>
            </li>
            <li>
              <strong>操作者</strong>
              <span>{{ selectedLog.actorName }}</span>
            </li>
            <li>
              <strong>资源</strong>
              <span>{{ selectedLog.targetType }} / {{ selectedLog.targetId }}</span>
            </li>
            <li>
              <strong>时间</strong>
              <span>{{ formatDateTime(selectedLog.createdAt) }}</span>
            </li>
            <li>
              <strong>IP</strong>
              <span>{{ selectedLog.ip || '--' }}</span>
            </li>
          </ul>

          <section class="admin-log-detail-summary">
            <h4>摘要</h4>
            <p>{{ selectedLog.summary }}</p>
          </section>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
