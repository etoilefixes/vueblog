<script setup lang="ts">
import {
  Activity,
  ArrowUpRight,
  ChartLine,
  Clock,
  Eye,
  FileText,
  MessageCircle,
  Router,
  TrendingUp,
  Zap,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import type { Component } from 'vue'

import { adminApi } from '@/services/admin-api'
import { useBlogStore } from '@/stores/blog'

interface DashboardMetric {
  id: string
  label: string
  value: number
  icon: Component
  trend?: number
  color: string
}

const blogStore = useBlogStore()

const loading = ref(false)
const loadError = ref('')

const dashboardMetrics = ref<DashboardMetric[]>([])
const topPosts = ref<Array<{ id: string; title: string; value: number }>>([])
const topTags = ref<Array<{ id: string; title: string; value: number }>>([])
const trends = ref<Array<{ date: string; pv: number; uv: number; publishedPosts: number }>>([])
const systemOverview = ref({
  apiP95Ms: 0,
  errorRate: 0,
  slowQueries: 0,
})

const trendMaxPv = computed(() => {
  return Math.max(...trends.value.map((item) => item.pv), 1)
})

// 计算趋势数据点，用于绘制SVG折线图
const trendPoints = computed(() => {
  if (trends.value.length === 0) return ''
  const width = 100
  const height = 50
  const max = trendMaxPv.value
  const len = trends.value.length

  return trends.value
    .map((item, i) => {
      const x = (i / (len - 1)) * width
      const y = height - (item.pv / max) * height
      return `${x},${y}`
    })
    .join(' ')
})

// 趋势图总面积点
const trendAreaPoints = computed(() => {
  if (trends.value.length === 0) return ''
  const width = 100
  const height = 50
  const max = trendMaxPv.value
  const len = trends.value.length

  const points = trends.value.map((item, i) => {
    const x = (i / (len - 1)) * width
    const y = height - (item.pv / max) * height
    return `${x},${y}`
  })

  // 添加底部两点形成闭合区域
  return `0,${height} ${points.join(' ')} ${width},${height}`
})

// 获取指标卡片的颜色类
const getMetricColorClass = (color: string) => {
  const colorMap: Record<string, string> = {
    blue: 'admin-metric-card--blue',
    green: 'admin-metric-card--green',
    orange: 'admin-metric-card--orange',
    purple: 'admin-metric-card--purple',
  }
  return colorMap[color] || ''
}

// 格式化大数字
const formatNumber = (num: number): string => {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k'
  }
  return num.toString()
}

const hydrateFromBlogStore = () => {
  dashboardMetrics.value = [
    { id: 'posts', label: '文章总数', value: blogStore.postCount, icon: FileText, color: 'blue' },
    { id: 'views', label: '累计阅读', value: blogStore.totalViews, icon: Eye, color: 'green' },
    { id: 'comments', label: '累计评论', value: blogStore.totalComments, icon: MessageCircle, color: 'orange' },
    { id: 'minutes', label: '总阅读时长', value: blogStore.totalReadingMinutes, icon: Clock, color: 'purple' },
  ]
}

const loadOverview = async () => {
  loading.value = true
  loadError.value = ''

  try {
    const overview = await adminApi.getDashboardOverview()

    dashboardMetrics.value = [
      { id: 'posts', label: '文章总数', value: overview.summary.totalPosts, icon: FileText, color: 'blue' },
      { id: 'views', label: '累计阅读', value: overview.summary.totalViews, icon: Eye, color: 'green' },
      { id: 'comments', label: '累计评论', value: overview.summary.totalComments, icon: MessageCircle, color: 'orange' },
      { id: 'today', label: '今日发布', value: overview.summary.publishedToday, icon: Router, color: 'purple' },
    ]
    topPosts.value = overview.topPosts
    topTags.value = overview.topTags
    trends.value = overview.trends
    systemOverview.value = overview.system
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '数据加载失败'
    hydrateFromBlogStore()
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (!blogStore.isHydrated && !blogStore.isInitializing) {
    await blogStore.initialize()
  }

  hydrateFromBlogStore()
  await loadOverview()
})
</script>

<template>
  <section class="admin-page">
    <header class="admin-page__head admin-page__head--dashboard">
      <div class="admin-page__head-content">
        <p>DASHBOARD</p>
        <h2>运营总览</h2>
        <span>聚合关键数据，快速识别内容与系统状态。</span>
      </div>
      <div class="admin-page__head-decoration">
        <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M0 100 Q30 80 50 90 T100 60 T150 40 T200 20"
            stroke="rgba(255,255,255,0.15)"
            stroke-width="2"
            fill="none"
          />
          <path
            d="M0 110 Q40 90 70 95 T120 70 T170 50 T200 35"
            stroke="rgba(255,255,255,0.1)"
            stroke-width="3"
            fill="none"
          />
          <circle cx="180" cy="25" r="8" fill="rgba(255,255,255,0.1)" />
          <circle cx="160" cy="45" r="5" fill="rgba(255,255,255,0.08)" />
        </svg>
      </div>
    </header>

    <p v-if="loadError" class="admin-page__hint admin-page__hint--warn">{{ loadError }}</p>
    <p v-else-if="loading" class="admin-page__hint">看板数据加载中...</p>

    <section class="admin-metric-grid">
      <article
        v-for="(metric, index) in dashboardMetrics"
        :key="metric.id"
        class="admin-metric-card"
        :class="getMetricColorClass(metric.color)"
        :style="{ '--delay': `${index * 0.08}s` }"
      >
        <div class="admin-metric-card__icon-wrap">
          <component :is="metric.icon" class="admin-metric-card__icon" aria-hidden="true" />
        </div>
        <div class="admin-metric-card__content">
          <strong class="admin-metric-card__value">{{ formatNumber(metric.value) }}</strong>
          <span class="admin-metric-card__label">{{ metric.label }}</span>
        </div>
        <div v-if="metric.trend" class="admin-metric-card__trend">
          <ArrowUpRight class="icon icon--xs" />
          <span>{{ metric.trend }}%</span>
        </div>
      </article>
    </section>

    <section class="admin-insight-grid">
      <article class="admin-panel admin-panel--trend">
        <header>
          <h3>
            <TrendingUp class="icon icon--sm icon--stroke-strong" />
            阅读趋势（7 天）
          </h3>
          <div class="admin-panel__badge">PV / UV</div>
        </header>
        <div class="admin-trend-chart">
          <svg
            class="admin-trend-chart__area"
            viewBox="0 0 100 50"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="rgba(46, 163, 170, 0.3)" />
                <stop offset="100%" stop-color="rgba(46, 163, 170, 0)" />
              </linearGradient>
            </defs>
            <polygon :points="trendAreaPoints" fill="url(#trendGradient)" />
            <polyline
              :points="trendPoints"
              fill="none"
              stroke="rgba(46, 163, 170, 0.8)"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <div class="admin-trend-chart__summary">
            <span>最高 {{ Math.max(...trends.map((t) => t.pv), 0) }} PV</span>
            <span>平均 {{ Math.round(trends.reduce((a, t) => a + t.pv, 0) / (trends.length || 1)) }} PV</span>
          </div>
        </div>
        <ul class="admin-trend-list">
          <li v-for="item in trends" :key="item.date">
            <strong>{{ item.date }}</strong>
            <div class="admin-trend-bar">
              <span
                class="admin-trend-bar__value"
                :style="{ width: `${Math.max(8, (item.pv / trendMaxPv) * 100)}%` }"
              />
            </div>
            <small>{{ item.pv }} / {{ item.uv }}</small>
          </li>
        </ul>
      </article>

      <article class="admin-panel">
        <header>
          <h3>
            <FileText class="icon icon--sm icon--stroke-strong" />
            热门文章
          </h3>
        </header>
        <ul class="admin-rank-list">
          <li v-for="(item, index) in topPosts" :key="item.id">
            <span class="admin-rank-list__rank">{{ index + 1 }}</span>
            <span class="admin-rank-list__title">{{ item.title }}</span>
            <strong class="admin-rank-list__value">{{ formatNumber(item.value) }}</strong>
          </li>
        </ul>
      </article>

      <article class="admin-panel">
        <header>
          <h3>
            <Activity class="icon icon--sm icon--stroke-strong" />
            热门标签
          </h3>
        </header>
        <div class="admin-tag-cloud">
          <span
            v-for="item in topTags"
            :key="item.id"
            class="admin-tag-cloud__item"
            :style="{ '--size': `${Math.min(1.2, 0.8 + (item.value / (topTags[0]?.value || 1)) * 0.4)}rem` }"
          >
            #{{ item.title }}
          </span>
        </div>
      </article>
    </section>

    <section class="admin-system-panel">
      <header>
        <ChartLine class="icon icon--sm icon--stroke-strong" aria-hidden="true" />
        <h3>系统状态</h3>
      </header>
      <div class="admin-system-grid">
        <div class="admin-system-item">
          <Zap class="admin-system-item__icon admin-system-item__icon--fast" />
          <div class="admin-system-item__content">
            <span class="admin-system-item__label">API P95</span>
            <strong class="admin-system-item__value">{{ systemOverview.apiP95Ms }} ms</strong>
          </div>
        </div>
        <div class="admin-system-item">
          <Activity class="admin-system-item__icon admin-system-item__icon--stable" />
          <div class="admin-system-item__content">
            <span class="admin-system-item__label">错误率</span>
            <strong class="admin-system-item__value">{{ systemOverview.errorRate }}%</strong>
          </div>
        </div>
        <div class="admin-system-item">
          <Clock class="admin-system-item__icon admin-system-item__icon--slow" />
          <div class="admin-system-item__content">
            <span class="admin-system-item__label">慢查询</span>
            <strong class="admin-system-item__value">{{ systemOverview.slowQueries }}</strong>
          </div>
        </div>
      </div>
    </section>
  </section>
</template>
