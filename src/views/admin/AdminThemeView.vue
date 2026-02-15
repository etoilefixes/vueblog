<script setup lang="ts">
import {
  CheckCircle2,
  CircleDashed,
  Eye,
  Palette,
  RefreshCcw,
  Save,
  Sparkles,
} from 'lucide-vue-next'
import { computed, onMounted, reactive, ref } from 'vue'
import type { CSSProperties } from 'vue'

import { adminApi } from '@/services/admin-api'
import { applyThemeTokens, persistActiveThemeTokens } from '@/services/theme-runtime'
import type { AdminThemeRevision, AdminThemeTokens } from '@/types/admin'

interface TokenField {
  key: keyof AdminThemeTokens
  label: string
  hint: string
  supportsColor: boolean
}

const tokenFields: TokenField[] = [
  { key: 'brand', label: 'Brand 主色', hint: '导航、按钮主色', supportsColor: true },
  { key: 'brandStrong', label: 'Brand 深色', hint: '强调态和渐变尾色', supportsColor: true },
  { key: 'accent', label: 'Accent 点缀', hint: '高亮与强调标签', supportsColor: true },
  { key: 'bgMain', label: '背景底色', hint: '全站主背景基色', supportsColor: true },
  { key: 'ink', label: '正文主色', hint: '主文本与标题颜色', supportsColor: true },
  {
    key: 'surfaceGlass',
    label: '玻璃层底色',
    hint: '建议使用 rgba，例如 rgba(255, 255, 255, 0.74)',
    supportsColor: false,
  },
  {
    key: 'line',
    label: '分割线颜色',
    hint: '建议使用 rgba，例如 rgba(51, 86, 117, 0.18)',
    supportsColor: false,
  },
]

const loading = ref(false)
const pending = ref(false)
const errorText = ref('')
const feedback = ref('')
const draftName = ref('')
const revisions = ref<AdminThemeRevision[]>([])

const draftTokens = reactive<AdminThemeTokens>({
  brand: '#0f8f95',
  brandStrong: '#0d5e7f',
  accent: '#ff7a46',
  bgMain: '#edf2f7',
  ink: '#1d2a3d',
  surfaceGlass: 'rgba(255, 255, 255, 0.74)',
  line: 'rgba(51, 86, 117, 0.18)',
})

const activeRevision = computed(() => revisions.value.find((item) => item.isActive) ?? null)

const metrics = computed(() => {
  return [
    {
      id: 'total',
      label: '主题版本',
      value: revisions.value.length,
    },
    {
      id: 'active',
      label: '当前激活',
      value: activeRevision.value ? 1 : 0,
    },
    {
      id: 'draft',
      label: '草稿版本',
      value: revisions.value.filter((item) => !item.id.startsWith('theme-v')).length,
    },
  ]
})

const previewStyle = computed<CSSProperties>(() => {
  return {
    '--theme-brand': draftTokens.brand,
    '--theme-brand-strong': draftTokens.brandStrong,
    '--theme-accent': draftTokens.accent,
    '--theme-bg-main': draftTokens.bgMain,
    '--theme-ink': draftTokens.ink,
    '--theme-surface-glass': draftTokens.surfaceGlass,
    '--theme-line': draftTokens.line,
  }
})

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

const getDraftTokens = (): AdminThemeTokens => ({
  brand: draftTokens.brand.trim(),
  brandStrong: draftTokens.brandStrong.trim(),
  accent: draftTokens.accent.trim(),
  bgMain: draftTokens.bgMain.trim(),
  ink: draftTokens.ink.trim(),
  surfaceGlass: draftTokens.surfaceGlass.trim(),
  line: draftTokens.line.trim(),
})

const setDraftTokens = (tokens: AdminThemeTokens) => {
  draftTokens.brand = tokens.brand
  draftTokens.brandStrong = tokens.brandStrong
  draftTokens.accent = tokens.accent
  draftTokens.bgMain = tokens.bgMain
  draftTokens.ink = tokens.ink
  draftTokens.surfaceGlass = tokens.surfaceGlass
  draftTokens.line = tokens.line
}

const showFeedback = async (text: string) => {
  feedback.value = text
  await sleep(1600)

  if (feedback.value === text) {
    feedback.value = ''
  }
}

const updateTokenFromInput = (key: keyof AdminThemeTokens, event: Event) => {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  draftTokens[key] = target.value
}

const syncDraftFromRevision = (revision: AdminThemeRevision | null) => {
  if (!revision) {
    return
  }

  setDraftTokens(revision.tokens)
  draftName.value = `${revision.name} Copy`
}

const loadRevisions = async () => {
  loading.value = true
  errorText.value = ''

  try {
    revisions.value = await adminApi.getThemeRevisions()
    const active = revisions.value.find((item) => item.isActive) ?? revisions.value[0] ?? null
    syncDraftFromRevision(active)

    if (active) {
      applyThemeTokens(active.tokens)
      persistActiveThemeTokens(active.tokens, {
        revisionId: active.id,
        name: active.name,
      })
    }
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '主题数据加载失败'
  } finally {
    loading.value = false
  }
}

const applyPreviewToSite = async () => {
  applyThemeTokens(getDraftTokens())
  await showFeedback('已将草稿应用到全站预览')
}

const resetToActive = async () => {
  const active = activeRevision.value

  if (!active) {
    return
  }

  setDraftTokens(active.tokens)
  applyThemeTokens(active.tokens)
  await showFeedback('已恢复为当前激活版本')
}

const createRevision = async () => {
  if (pending.value) {
    return
  }

  const nextName = draftName.value.trim()

  if (nextName.length < 2) {
    errorText.value = '版本名称至少 2 个字符'
    return
  }

  const tokens = getDraftTokens()
  const hasEmpty = Object.values(tokens).some((value) => !value)

  if (hasEmpty) {
    errorText.value = 'Token 不能为空'
    return
  }

  pending.value = true
  errorText.value = ''

  try {
    const created = await adminApi.createThemeRevision({
      name: nextName,
      tokens,
    })
    revisions.value = [created, ...revisions.value]
    draftName.value = `${created.name} Copy`
    await showFeedback('新主题版本已创建')
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '创建主题版本失败'
  } finally {
    pending.value = false
  }
}

const activateRevision = async (revisionId: string) => {
  if (pending.value) {
    return
  }

  pending.value = true
  errorText.value = ''

  try {
    const activated = await adminApi.activateThemeRevision(revisionId)
    revisions.value = revisions.value.map((item) => ({
      ...item,
      isActive: item.id === activated.id,
    }))
    syncDraftFromRevision(activated)
    applyThemeTokens(activated.tokens)
    persistActiveThemeTokens(activated.tokens, {
      revisionId: activated.id,
      name: activated.name,
    })
    await showFeedback(`已激活主题: ${activated.name}`)
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '激活主题失败'
  } finally {
    pending.value = false
  }
}

const loadRevisionToDraft = (revision: AdminThemeRevision) => {
  setDraftTokens(revision.tokens)
  draftName.value = `${revision.name} Copy`
}

onMounted(async () => {
  await loadRevisions()
})
</script>

<template>
  <section class="admin-page admin-theme-page">
    <header class="admin-page__head">
      <p>THEME LAB</p>
      <h2>主题管理</h2>
      <span>编辑 Token、生成版本并一键激活，全站立即生效。</span>
    </header>

    <p v-if="loading" class="admin-page__hint">正在加载主题版本...</p>
    <p v-if="errorText" class="admin-page__hint admin-page__hint--warn">{{ errorText }}</p>
    <p v-if="feedback" class="admin-page__hint">{{ feedback }}</p>

    <section class="admin-theme-metrics">
      <article v-for="item in metrics" :key="item.id" class="admin-theme-metric">
        <strong>{{ item.value }}</strong>
        <span>{{ item.label }}</span>
      </article>
    </section>

    <section class="admin-theme-layout">
      <article class="admin-theme-panel admin-theme-panel--editor">
        <header>
          <h3>Token 编辑器</h3>
          <small>修改草稿后可预览或生成版本</small>
        </header>

        <label class="admin-field admin-field--full">
          <span>版本名称</span>
          <input v-model="draftName" type="text" maxlength="60" placeholder="输入新版本名" />
        </label>

        <div class="admin-theme-token-grid">
          <label
            v-for="field in tokenFields"
            :key="field.key"
            class="admin-theme-token-field"
          >
            <span>{{ field.label }}</span>
            <div class="admin-theme-token-row">
              <input
                v-if="field.supportsColor"
                type="color"
                :value="draftTokens[field.key]"
                @input="updateTokenFromInput(field.key, $event)"
              />
              <input
                type="text"
                :value="draftTokens[field.key]"
                @input="updateTokenFromInput(field.key, $event)"
              />
            </div>
            <small>{{ field.hint }}</small>
          </label>
        </div>

        <footer class="admin-mobile-actionbar">
          <button type="button" class="admin-action-btn icon-host" @click="applyPreviewToSite">
            <Eye class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
            <span>应用预览</span>
          </button>
          <button type="button" class="admin-action-btn icon-host" @click="resetToActive">
            <RefreshCcw class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
            <span>恢复激活</span>
          </button>
          <button
            type="button"
            class="admin-action-btn admin-action-btn--strong icon-host"
            :disabled="pending"
            @click="createRevision"
          >
            <Save class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
            <span>{{ pending ? '创建中...' : '保存为版本' }}</span>
          </button>
        </footer>
      </article>

      <article class="admin-theme-panel admin-theme-panel--preview" :style="previewStyle">
        <header>
          <h3>实时预览</h3>
          <small>当前草稿渲染效果</small>
        </header>

        <div class="admin-theme-preview-card">
          <p>Blog Console</p>
          <h4>个性化主题预览卡片</h4>
          <span>Glass + Neumorphism + Motion</span>
          <div>
            <button type="button">主操作</button>
            <button type="button">次操作</button>
          </div>
        </div>
      </article>
    </section>

    <section class="admin-theme-panel admin-theme-panel--revisions">
      <header>
        <h3>主题版本历史</h3>
        <small>共 {{ revisions.length }} 个版本</small>
      </header>

      <TransitionGroup name="admin-list-shift" tag="ul" class="admin-theme-revision-list">
        <li
          v-for="item in revisions"
          :key="item.id"
          class="admin-theme-revision-card"
          :class="{ 'admin-theme-revision-card--active': item.isActive }"
        >
          <header>
            <div>
              <h4>{{ item.name }}</h4>
              <p>{{ item.createdBy }} · {{ formatDateTime(item.createdAt) }}</p>
            </div>
            <span v-if="item.isActive" class="admin-theme-revision-status">
              <CheckCircle2 class="icon icon--xs icon--stroke-strong" aria-hidden="true" />
              激活中
            </span>
            <span v-else class="admin-theme-revision-status admin-theme-revision-status--idle">
              <CircleDashed class="icon icon--xs icon--stroke-strong" aria-hidden="true" />
              未激活
            </span>
          </header>

          <ul class="admin-theme-swatch-list">
            <li>
              <small>Brand</small>
              <span :style="{ background: item.tokens.brand }" />
            </li>
            <li>
              <small>Accent</small>
              <span :style="{ background: item.tokens.accent }" />
            </li>
            <li>
              <small>Ink</small>
              <span :style="{ background: item.tokens.ink }" />
            </li>
          </ul>

          <footer>
            <button type="button" class="admin-action-btn icon-host" @click="loadRevisionToDraft(item)">
              <Sparkles class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
              <span>载入编辑器</span>
            </button>
            <button
              type="button"
              class="admin-action-btn admin-action-btn--strong icon-host"
              :disabled="item.isActive || pending"
              @click="activateRevision(item.id)"
            >
              <Palette class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
              <span>{{ item.isActive ? '已激活' : '激活版本' }}</span>
            </button>
          </footer>
        </li>
      </TransitionGroup>
    </section>
  </section>
</template>
