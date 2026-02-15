<script setup lang="ts">
import { FilePlus2, X } from 'lucide-vue-next'
import { computed } from 'vue'

import AdminDialog from '@/components/admin/AdminDialog.vue'
import {
  createDefaultNavTabs,
  siteNavIconOptions,
  siteNavRouteMetaMap,
  siteNavRouteOrder,
} from '@/services/site-nav'
import type { SiteNavIcon, SiteNavRouteName, SiteNavTab, SiteProfile } from '@/types/blog'

interface Props {
  profile: SiteProfile
  loading?: boolean
  error?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:profile': [profile: SiteProfile]
  save: []
  cancel: []
}>()

const MIN_HOME_PAGE_MAX_POSTS = 1
const MAX_HOME_PAGE_MAX_POSTS = 20

const navIconLabelMap = computed(() => {
  return siteNavIconOptions.reduce<Record<SiteNavIcon, string>>((acc, item) => {
    acc[item.value] = item.label
    return acc
  }, {} as Record<SiteNavIcon, string>)
})

const getRouteLabel = (routeName: SiteNavRouteName) => {
  return siteNavRouteMetaMap[routeName].defaultLabel
}

const getRouteDescription = (routeName: SiteNavRouteName) => {
  return siteNavRouteMetaMap[routeName].description
}

const updateField = <K extends keyof SiteProfile>(field: K, value: SiteProfile[K]) => {
  emit('update:profile', { ...props.profile, [field]: value })
}

const updateNavTab = (routeName: SiteNavRouteName, updates: Partial<SiteNavTab>) => {
  const newNavTabs = props.profile.navTabs.map(tab =>
    tab.routeName === routeName ? { ...tab, ...updates } : tab
  )
  updateField('navTabs', newNavTabs)
}

const addSocialItem = () => {
  const newSocials = [
    ...props.profile.socials,
    { label: '', href: '', icon: 'github' as const },
  ]
  updateField('socials', newSocials)
}

const removeSocialItem = (index: number) => {
  const newSocials = props.profile.socials.filter((_, i) => i !== index)
  updateField('socials', newSocials)
}

const updateSocialItem = (index: number, field: string, value: string) => {
  const newSocials = props.profile.socials.map((item, i) =>
    i === index ? { ...item, [field]: value } : item
  )
  updateField('socials', newSocials)
}

const validateAndSave = () => {
  // 验证必填字段
  if (!props.profile.name.trim()) {
    return
  }
  if (!props.profile.motto.trim()) {
    return
  }
  if (!props.profile.avatar.trim()) {
    return
  }

  // 验证导航标签
  for (const tab of props.profile.navTabs) {
    if (!tab.label.trim()) {
      return
    }
  }

  emit('save')
}
</script>

<template>
  <AdminDialog
    :open="true"
    title="编辑站点资料"
    :description="error"
    confirm-text="保存"
    cancel-text="取消"
    :loading="loading"
    :show-cancel="true"
    @confirm="validateAndSave"
    @cancel="$emit('cancel')"
    @close="$emit('cancel')"
  >
    <div class="site-profile-form">
      <section class="form-section">
        <h4>基本信息</h4>
        <label class="admin-field">
          <span>站点名称 *</span>
          <input
            :value="profile.name"
            type="text"
            maxlength="80"
            @input="updateField('name', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="admin-field">
          <span>签名 *</span>
          <input
            :value="profile.motto"
            type="text"
            maxlength="160"
            @input="updateField('motto', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="admin-field">
          <span>头像 URL *</span>
          <input
            :value="profile.avatar"
            type="url"
            @input="updateField('avatar', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="admin-field">
          <span>首页每页文章数</span>
          <input
            :value="profile.homePageMaxPosts"
            type="number"
            step="1"
            :min="MIN_HOME_PAGE_MAX_POSTS"
            :max="MAX_HOME_PAGE_MAX_POSTS"
            @input="updateField('homePageMaxPosts', Number(($event.target as HTMLInputElement).value))"
          />
        </label>
      </section>

      <section class="form-section">
        <h4>导航配置</h4>
        <div class="nav-tabs-list">
          <article
            v-for="item in profile.navTabs"
            :key="item.routeName"
            class="nav-tab-item"
          >
            <div class="nav-tab-info">
              <strong>{{ getRouteLabel(item.routeName) }}</strong>
              <small>{{ getRouteDescription(item.routeName) }}</small>
            </div>
            <label class="admin-field">
              <span>标签文案</span>
              <input
                :value="item.label"
                type="text"
                maxlength="24"
                @input="updateNavTab(item.routeName, { label: ($event.target as HTMLInputElement).value })"
              />
            </label>
            <label class="admin-field">
              <span>图标</span>
              <select
                :value="item.icon"
                class="admin-select"
                @change="updateNavTab(item.routeName, { icon: ($event.target as HTMLSelectElement).value as SiteNavIcon })"
              >
                <option v-for="iconOption in siteNavIconOptions" :key="iconOption.value" :value="iconOption.value">
                  {{ iconOption.label }}
                </option>
              </select>
            </label>
          </article>
        </div>
      </section>

      <section class="form-section">
        <div class="section-header">
          <h4>社交链接</h4>
          <button type="button" class="admin-action-btn icon-host" @click="addSocialItem">
            <FilePlus2 class="icon icon--xs" aria-hidden="true" />
            添加
          </button>
        </div>
        <div class="social-list">
          <article
            v-for="(item, index) in profile.socials"
            :key="`social-${index}`"
            class="social-item"
          >
            <label class="admin-field">
              <span>名称</span>
              <input
                :value="item.label"
                type="text"
                maxlength="40"
                @input="updateSocialItem(index, 'label', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label class="admin-field">
              <span>链接</span>
              <input
                :value="item.href"
                type="text"
                @input="updateSocialItem(index, 'href', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label class="admin-field">
              <span>图标</span>
              <select
                :value="item.icon"
                class="admin-select"
                @change="updateSocialItem(index, 'icon', ($event.target as HTMLSelectElement).value)"
              >
                <option value="github">GitHub</option>
                <option value="email">Email</option>
                <option value="bilibili">Bilibili</option>
                <option value="wechat">WeChat</option>
              </select>
            </label>
            <button
              type="button"
              class="btn-remove"
              @click="removeSocialItem(index)"
            >
              <X class="icon icon--xs" aria-hidden="true" />
            </button>
          </article>
        </div>
      </section>
    </div>
  </AdminDialog>
</template>

<style scoped>
.site-profile-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.form-section h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--admin-text-primary);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-tabs-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.nav-tab-item {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: var(--space-md);
  padding: var(--space-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--admin-border);
  background: var(--admin-surface);
}

.nav-tab-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-tab-info strong {
  font-size: 0.95rem;
  color: var(--admin-text-primary);
}

.nav-tab-info small {
  font-size: 0.8rem;
  color: var(--admin-text-muted);
}

.social-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.social-item {
  display: grid;
  grid-template-columns: 1fr 1fr auto auto;
  gap: var(--space-sm);
  align-items: end;
  padding: var(--space-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--admin-border);
  background: var(--admin-surface);
}

.btn-remove {
  width: 36px;
  height: 36px;
  border: 1px solid var(--admin-border);
  border-radius: var(--radius-md);
  background: var(--admin-surface);
  color: var(--admin-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.btn-remove:hover {
  border-color: var(--admin-danger);
  color: var(--admin-danger);
  background: var(--admin-danger-light);
}

@media (max-width: 600px) {
  .nav-tab-item {
    grid-template-columns: 1fr;
  }
  
  .social-item {
    grid-template-columns: 1fr auto;
  }
}
</style>
