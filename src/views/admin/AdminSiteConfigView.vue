<script setup lang="ts">
import {
  FilePlus2,
  LayoutPanelTop,
  Link2,
  Pencil,
  Save,
  Sparkles,
  Trash2,
  UserRoundCog,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'

import AdminDialog from '@/components/admin/AdminDialog.vue'
import { adminApi } from '@/services/admin-api'
import { useBlogStore } from '@/stores/blog'
import type {
  AboutSection,
  CustomProject,
  FriendLink,
  SiteFooterInfo,
  SiteProfile,
} from '@/types/blog'

import SiteAboutDialog from './dialogs/SiteAboutDialog.vue'
import SiteFooterDialog from './dialogs/SiteFooterDialog.vue'
import SiteLinksDialog from './dialogs/SiteLinksDialog.vue'
import SiteProfileDialog from './dialogs/SiteProfileDialog.vue'
import SiteProjectsDialog from './dialogs/SiteProjectsDialog.vue'

type DialogType = 'profile' | 'footer' | 'links' | 'about' | 'projects' | null
type ConfigCardId = 'profile' | 'footer' | 'links' | 'about' | 'projects'

interface ConfigCard {
  id: ConfigCardId
  title: string
  description: string
  icon: typeof UserRoundCog
  count?: number
  preview?: string
}

const blogStore = useBlogStore()

const loading = ref(false)
const activeDialog = ref<DialogType>(null)
const dialogLoading = ref(false)
const dialogError = ref('')

// 原始数据（从 store 加载）
const originalProfile = ref<SiteProfile | null>(null)
const originalFooter = ref<SiteFooterInfo | null>(null)
const originalLinks = ref<FriendLink[]>([])
const originalAbout = ref<AboutSection[]>([])
const originalProjects = ref<CustomProject[]>([])

// 对话框编辑中的数据
const editProfile = ref<SiteProfile | null>(null)
const editFooter = ref<SiteFooterInfo | null>(null)
const editLinks = ref<FriendLink[]>([])
const editAbout = ref<AboutSection[]>([])
const editProjects = ref<CustomProject[]>([])

const configCards = computed<ConfigCard[]>(() => [
  {
    id: 'profile',
    title: '站点资料',
    description: '站点名称、签名、头像、导航和社交链接',
    icon: UserRoundCog,
    preview: originalProfile.value
      ? `${originalProfile.value.name} · ${originalProfile.value.motto}`
      : undefined,
  },
  {
    id: 'footer',
    title: '页脚配置',
    description: '备案信息、运行时间、版权和技术支持声明',
    icon: LayoutPanelTop,
    preview: originalFooter.value
      ? `${originalFooter.value.icp || '未设置备案'} · ${originalFooter.value.copyright || '未设置版权'}`
      : undefined,
  },
  {
    id: 'links',
    title: '友情链接',
    description: '友链列表管理，支持标签筛选',
    icon: Link2,
    count: originalLinks.value.length,
    preview: originalLinks.value.length > 0
      ? `${originalLinks.value.length} 个友链`
      : '暂无友链',
  },
  {
    id: 'about',
    title: '关于页面',
    description: '关于页面的内容区块配置',
    icon: Sparkles,
    count: originalAbout.value.length,
    preview: originalAbout.value.length > 0
      ? `${originalAbout.value.length} 个区块`
      : '暂无区块',
  },
  {
    id: 'projects',
    title: '项目展示',
    description: '自定义项目列表，展示技术栈和项目状态',
    icon: FilePlus2,
    count: originalProjects.value.length,
    preview: originalProjects.value.length > 0
      ? `${originalProjects.value.length} 个项目`
      : '暂无项目',
  },
])

const openDialog = (type: ConfigCardId) => {

  // 复制当前数据到编辑状态
  switch (type) {
    case 'profile':
      editProfile.value = originalProfile.value
        ? { ...originalProfile.value, socials: [...originalProfile.value.socials], navTabs: [...originalProfile.value.navTabs] }
        : null
      break
    case 'footer':
      editFooter.value = originalFooter.value ? { ...originalFooter.value } : null
      break
    case 'links':
      editLinks.value = originalLinks.value.map(link => ({ ...link, tags: [...link.tags] }))
      break
    case 'about':
      editAbout.value = originalAbout.value.map(section => ({ ...section }))
      break
    case 'projects':
      editProjects.value = originalProjects.value.map(project => ({ ...project, techStack: [...project.techStack] }))
      break
  }

  activeDialog.value = type
  dialogError.value = ''
}

const closeDialog = () => {
  activeDialog.value = null
  dialogError.value = ''
}

const handleSave = async () => {
  dialogLoading.value = true
  dialogError.value = ''

  try {
    switch (activeDialog.value) {
      case 'profile':
        if (editProfile.value) {
          await blogStore.updateProfile(editProfile.value)
          originalProfile.value = { ...editProfile.value }
        }
        break
      case 'footer':
        if (editFooter.value) {
          const nextFooter = await adminApi.updateSiteFooter(editFooter.value)
          blogStore.footerInfo = nextFooter
          originalFooter.value = { ...editFooter.value }
        }
        break
      case 'links':
        await blogStore.saveLinks(editLinks.value)
        originalLinks.value = [...editLinks.value]
        break
      case 'about':
        await blogStore.saveAboutSections(editAbout.value)
        originalAbout.value = [...editAbout.value]
        break
      case 'projects':
        await blogStore.saveProjects(editProjects.value)
        originalProjects.value = [...editProjects.value]
        break
    }

    closeDialog()
  } catch (error) {
    dialogError.value = error instanceof Error ? error.message : '保存失败'
  } finally {
    dialogLoading.value = false
  }
}

const handleCancel = () => {
  closeDialog()
}

const hydrateData = () => {
  if (blogStore.profile) {
    originalProfile.value = {
      ...blogStore.profile,
      socials: [...blogStore.profile.socials],
      navTabs: [...blogStore.profile.navTabs],
    }
  }

  if (blogStore.footerInfo) {
    originalFooter.value = { ...blogStore.footerInfo }
  }

  originalLinks.value = blogStore.links.map(link => ({ ...link, tags: [...link.tags] }))
  originalAbout.value = (blogStore.about || []).map((section: AboutSection) => ({ ...section }))
  originalProjects.value = blogStore.projects.map(project => ({ ...project, techStack: [...project.techStack] }))
}

onMounted(async () => {
  loading.value = true

  if (!blogStore.isHydrated && !blogStore.isInitializing) {
    await blogStore.initialize()
  }

  hydrateData()
  loading.value = false
})
</script>

<template>
  <section class="admin-page admin-site-page">
    <header class="admin-page__head">
      <p>SITE CONFIG</p>
      <h2>站点配置</h2>
      <span>点击卡片打开对应配置的编辑对话框，支持单独保存每项配置。</span>
    </header>

    <p v-if="loading" class="admin-page__hint">配置数据加载中...</p>

    <section v-else class="admin-site-cards">
      <article
        v-for="card in configCards"
        :key="card.id"
        class="admin-site-card"
        @click="openDialog(card.id)"
      >
        <header class="admin-site-card__header">
          <component :is="card.icon" class="admin-site-card__icon" aria-hidden="true" />
          <h3 class="admin-site-card__title">{{ card.title }}</h3>
          <span v-if="card.count !== undefined" class="admin-site-card__count">{{ card.count }}</span>
        </header>
        <p class="admin-site-card__desc">{{ card.description }}</p>
        <footer class="admin-site-card__footer">
          <span class="admin-site-card__preview">{{ card.preview }}</span>
          <button type="button" class="admin-site-card__edit">
            <Pencil class="icon icon--xs" aria-hidden="true" />
            编辑
          </button>
        </footer>
      </article>
    </section>

    <!-- 站点资料对话框 -->
    <SiteProfileDialog
      v-if="activeDialog === 'profile' && editProfile"
      :profile="editProfile"
      :loading="dialogLoading"
      :error="dialogError"
      @update:profile="editProfile = $event"
      @save="handleSave"
      @cancel="handleCancel"
    />

    <!-- 页脚配置对话框 -->
    <SiteFooterDialog
      v-if="activeDialog === 'footer' && editFooter"
      :footer="editFooter"
      :loading="dialogLoading"
      :error="dialogError"
      @update:footer="editFooter = $event"
      @save="handleSave"
      @cancel="handleCancel"
    />

    <!-- 友情链接对话框 -->
    <SiteLinksDialog
      v-if="activeDialog === 'links'"
      :links="editLinks"
      :loading="dialogLoading"
      :error="dialogError"
      @update:links="editLinks = $event"
      @save="handleSave"
      @cancel="handleCancel"
    />

    <!-- 关于页面对话框 -->
    <SiteAboutDialog
      v-if="activeDialog === 'about'"
      :sections="editAbout"
      :loading="dialogLoading"
      :error="dialogError"
      @update:sections="editAbout = $event"
      @save="handleSave"
      @cancel="handleCancel"
    />

    <!-- 项目展示对话框 -->
    <SiteProjectsDialog
      v-if="activeDialog === 'projects'"
      :projects="editProjects"
      :loading="dialogLoading"
      :error="dialogError"
      @update:projects="editProjects = $event"
      @save="handleSave"
      @cancel="handleCancel"
    />
  </section>
</template>

<style scoped>
.admin-site-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-lg);
}

.admin-site-card {
  display: flex;
  flex-direction: column;
  padding: var(--space-xl);
  border-radius: var(--radius-xl);
  border: 1px solid var(--admin-border);
  background: var(--admin-surface);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.admin-site-card:hover {
  border-color: var(--admin-primary);
  background: rgba(99, 102, 241, 0.05);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.admin-site-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.admin-site-card__icon {
  width: 24px;
  height: 24px;
  color: var(--admin-primary);
}

.admin-site-card__title {
  flex: 1;
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--admin-text-primary);
}

.admin-site-card__count {
  padding: 2px 8px;
  border-radius: 12px;
  background: rgba(99, 102, 241, 0.1);
  color: var(--admin-primary);
  font-size: 0.8rem;
  font-weight: 600;
}

.admin-site-card__desc {
  margin: 0 0 var(--space-md);
  color: var(--admin-text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.admin-site-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: var(--space-md);
  border-top: 1px solid var(--admin-border);
}

.admin-site-card__preview {
  color: var(--admin-text-muted);
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.admin-site-card__edit {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--admin-border);
  background: var(--admin-surface-elevated);
  color: var(--admin-text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.admin-site-card:hover .admin-site-card__edit {
  border-color: var(--admin-primary);
  background: rgba(99, 102, 241, 0.1);
  color: var(--admin-primary);
}

@media (max-width: 640px) {
  .admin-site-cards {
    grid-template-columns: 1fr;
  }
}
</style>
