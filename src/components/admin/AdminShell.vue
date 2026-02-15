<script setup lang="ts">
import {
  BellRing,
  Check,
  ChartColumnBig,
  ChevronRight,
  ClipboardList,
  FilePenLine,
  House,
  Image,
  LogOut,
  Menu,
  Palette,
  PencilLine,
  Rocket,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import '@/assets/styles/admin.css'
import { useAdminAuthStore } from '@/stores/admin-auth'

// Viewport height fix for mobile browsers
const updateViewportHeight = () => {
  const vh = window.innerHeight * 0.01
  document.documentElement.style.setProperty('--vh', `${vh}px`)
}

// Visual viewport API for keyboard detection
const updateVisualViewport = () => {
  if (window.visualViewport) {
    const keyboardHeight = window.innerHeight - window.visualViewport.height
    document.documentElement.style.setProperty('--keyboard-height', `${Math.max(0, keyboardHeight)}px`)
  }
}

interface AdminNavItem {
  label: string
  type: string
  icon: Component
  title: string
  routeName: string
}

const adminAuth = useAdminAuthStore()
const route = useRoute()
const router = useRouter()

const isMobileMenuOpen = ref(false)
const isSidebarCollapsed = ref(true)
const isProfileEditorOpen = ref(false)
const profileError = ref('')
const profileDraft = reactive({
  displayName: '',
  avatarUrl: '',
})

// 导航配置
const navItems: AdminNavItem[] = [
  { label: '仪表盘', type: 'dashboard', icon: House, title: '运营总览', routeName: 'admin-dashboard' },
  { label: '内容管理', type: 'content', icon: FilePenLine, title: '内容管理', routeName: 'admin-content' },
  { label: '站点配置', type: 'site', icon: Settings2, title: '站点配置', routeName: 'admin-site' },
  { label: '评论管理', type: 'comments', icon: BellRing, title: '评论管理', routeName: 'admin-comments' },
  { label: '主题管理', type: 'theme', icon: Palette, title: '主题管理', routeName: 'admin-theme' },
  { label: '发布中心', type: 'publish', icon: Rocket, title: '发布中心', routeName: 'admin-publish' },
  { label: '媒体库', type: 'media', icon: Image, title: '媒体库', routeName: 'admin-media' },
  { label: '角色权限', type: 'access', icon: ShieldCheck, title: '角色权限', routeName: 'admin-access' },
  { label: '操作日志', type: 'logs', icon: ClipboardList, title: '操作日志', routeName: 'admin-logs' },
]

const profileDisplayName = computed(() => {
  return adminAuth.user?.displayName ?? '访客'
})

// 当前页面标题
const pageTitle = computed(() => {
  return String(route.meta?.adminTitle ?? '后台管理')
})

// 检查当前路由是否是激活的导航项
const isActiveRoute = (item: AdminNavItem) => {
  return route.name === item.routeName
}

const profileAvatarUrl = computed(() => {
  return adminAuth.user?.avatarUrl || '/avatar.svg'
})

// 处理导航点击
const handleNav = async (item: AdminNavItem) => {
  isMobileMenuOpen.value = false
  await router.push({ name: item.routeName })
}

const handleLogout = async () => {
  await adminAuth.logout()
  await router.replace({ name: 'admin-login' })
}

const resetProfileDraft = () => {
  profileDraft.displayName = adminAuth.user?.displayName ?? ''
  profileDraft.avatarUrl = adminAuth.user?.avatarUrl ?? ''
}

const isValidAvatarUrl = (value: string) => {
  if (!value) return true
  if (value.startsWith('/')) return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const openProfileEditor = () => {
  profileError.value = ''
  resetProfileDraft()
  isProfileEditorOpen.value = true
}

const closeProfileEditor = () => {
  isProfileEditorOpen.value = false
  profileError.value = ''
}

const saveProfile = () => {
  profileError.value = ''

  const displayName = profileDraft.displayName.trim()
  const avatarUrl = profileDraft.avatarUrl.trim()

  if (displayName.length < 2) {
    profileError.value = '管理员名称至少 2 个字符'
    return
  }

  if (!isValidAvatarUrl(avatarUrl)) {
    profileError.value = '头像地址仅支持 http(s) 或站内相对路径'
    return
  }

  const updated = adminAuth.updateProfile({
    displayName,
    avatarUrl: avatarUrl || undefined,
  })

  if (!updated) {
    profileError.value = '资料更新失败，请重试'
    return
  }

  isProfileEditorOpen.value = false
}

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

// Lifecycle hooks for viewport handling
onMounted(() => {
  // Initial viewport height calculation
  updateViewportHeight()

  // Listen for resize events
  window.addEventListener('resize', updateViewportHeight)
  window.addEventListener('orientationchange', updateViewportHeight)

  // Visual viewport API for keyboard detection (modern browsers)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateVisualViewport)
    window.visualViewport.addEventListener('scroll', updateVisualViewport)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateViewportHeight)
  window.removeEventListener('orientationchange', updateViewportHeight)

  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', updateVisualViewport)
    window.visualViewport.removeEventListener('scroll', updateVisualViewport)
  }
})
</script>

<template>
  <div class="admin-shell" :class="{ 'admin-shell--sidebar-collapsed': isSidebarCollapsed }">
    <aside class="admin-shell__sidebar" :class="{ 'admin-shell__sidebar--collapsed': isSidebarCollapsed }">
      <header class="admin-shell__sidebar-head">
        <button
          type="button"
          class="admin-shell__brand admin-shell__brand-action icon-host"
          :aria-label="isSidebarCollapsed ? '展开侧边导航' : '收起侧边导航'"
          :aria-expanded="!isSidebarCollapsed"
          @click="toggleSidebar"
        >
          <span class="admin-shell__brand-main">
            <ChartColumnBig
              class="icon icon--sm icon--stroke-strong icon--react admin-shell__brand-mark"
              aria-hidden="true"
            />
            <span class="admin-shell__brand-label">Blog Console</span>
          </span>
          <ChevronRight
            class="icon icon--sm icon--stroke-strong icon--react admin-shell__brand-chevron"
            aria-hidden="true"
          />
        </button>
      </header>

      <nav class="admin-shell__menu" aria-label="后台导航">
        <button
          v-for="item in navItems"
          :key="item.type"
          type="button"
          class="admin-shell__menu-item icon-host"
          :class="{ 'admin-shell__menu-item--active': isActiveRoute(item) }"
          :title="item.label"
          :aria-label="item.label"
          :data-label="item.label"
          @click="handleNav(item)"
        >
          <component
            :is="item.icon"
            class="icon icon--sm icon--stroke-strong icon--react"
            aria-hidden="true"
          />
          <span class="admin-shell__menu-label">{{ item.label }}</span>
        </button>
      </nav>
    </aside>

    <div class="admin-shell__main-wrap">
      <header class="admin-shell__topbar">
        <button
          type="button"
          class="admin-shell__mobile-trigger icon-host"
          aria-label="展开菜单"
          @click="isMobileMenuOpen = true"
        >
          <Menu class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
        </button>
        <h1>{{ pageTitle }}</h1>
      </header>

      <main class="admin-shell__main">
        <RouterView />
      </main>
    </div>

    <aside class="admin-shell__profile-float">
      <section class="admin-shell__profile-card">
        <header class="admin-shell__profile-head">
          <img class="admin-shell__profile-avatar" :src="profileAvatarUrl" alt="管理员头像" />
          <div class="admin-shell__profile-meta">
            <strong>{{ profileDisplayName }}</strong>
            <span>{{ adminAuth.roleLabel || '未登录' }}</span>
          </div>
          <button
            class="admin-shell__profile-edit icon-host"
            type="button"
            aria-label="编辑管理员资料"
            @click="openProfileEditor"
          >
            <PencilLine class="icon icon--xs icon--stroke-strong icon--react" aria-hidden="true" />
          </button>
          <button
            class="admin-shell__logout icon-host"
            type="button"
            aria-label="退出登录"
            @click="handleLogout"
          >
            <LogOut class="icon icon--xs icon--stroke-strong icon--react" aria-hidden="true" />
          </button>
        </header>

        <form v-if="isProfileEditorOpen" class="admin-shell__profile-form" @submit.prevent="saveProfile">
          <label class="admin-shell__profile-field">
            <span>管理员名称</span>
            <input v-model="profileDraft.displayName" type="text" maxlength="80" placeholder="请输入管理员名称" />
          </label>
          <label class="admin-shell__profile-field">
            <span>头像地址</span>
            <input
              v-model="profileDraft.avatarUrl"
              type="text"
              placeholder="https://example.com/avatar.png 或 /avatar.svg"
            />
          </label>
          <p v-if="profileError" class="admin-shell__profile-feedback admin-shell__profile-feedback--error">
            {{ profileError }}
          </p>
          <div class="admin-shell__profile-actions">
            <button type="button" class="admin-action-btn icon-host" @click="closeProfileEditor">
              <X class="icon icon--xs icon--stroke-strong icon--react" aria-hidden="true" />
              取消
            </button>
            <button type="submit" class="admin-action-btn admin-action-btn--strong icon-host">
              <Check class="icon icon--xs icon--stroke-strong icon--react" aria-hidden="true" />
              保存
            </button>
          </div>
        </form>
      </section>
    </aside>

    <Teleport to="body">
      <Transition name="admin-drawer">
        <div
          v-if="isMobileMenuOpen"
          class="admin-shell__mobile-overlay"
          @click.self="isMobileMenuOpen = false"
        >
          <section class="admin-shell__mobile-drawer">
            <header class="admin-shell__mobile-head">
              <strong>后台菜单</strong>
              <button
                type="button"
                class="admin-shell__mobile-close icon-host"
                aria-label="关闭菜单"
                @click="isMobileMenuOpen = false"
              >
                <X class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
              </button>
            </header>

            <nav class="admin-shell__mobile-menu">
              <button
                v-for="item in navItems"
                :key="`${item.type}-mobile`"
                type="button"
                class="admin-shell__mobile-item icon-host"
                :class="{ 'admin-shell__mobile-item--active': isActiveRoute(item) }"
                @click="handleNav(item)"
              >
                <component
                  :is="item.icon"
                  class="icon icon--sm icon--stroke-strong icon--react"
                  aria-hidden="true"
                />
                <span>{{ item.label }}</span>
              </button>
            </nav>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
