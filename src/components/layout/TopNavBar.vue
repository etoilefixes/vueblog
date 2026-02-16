<script setup lang="ts">
import {
  BookOpen,
  ChevronRight,
  Cloud,
  Compass,
  FileText,
  FolderTree,
  Github,
  History,
  House,
  LayoutGrid,
  Link2,
  Mail,
  MessageSquare,
  RefreshCw,
  Rss,
  Search,
  Sparkles,
  SunMoon,
  Tag,
  TriangleAlert,
  Tv,
  UserRound,
  X,
} from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  applyAppearanceMode,
  getAppliedAppearanceMode,
  persistAppearanceMode,
  type AppearanceMode,
} from '@/services/appearance-runtime'
import { collectKeywordMatchRanges, scoreWeightedSearch } from '@/services/light-search'
import { normalizeSocialIconCode } from '@/services/social-icon'
import { useBlogStore } from '@/stores/blog'
import type { SiteNavIcon, SocialLink } from '@/types/blog'
import {
  buildNavItems,
  buildHighlightedHtml,
  buildSearchFields,
  getCommandTypeLabel,
  isDisabledSocialLink,
  isExternalHttpLink,
  type CommandItem,
  type CommandSearchResult,
  type RecentSearchCommandItem,
  type PostCommandItem,
  type RouteCommandItem,
  type NavItem,
} from './top-nav-helpers'

const route = useRoute()
const router = useRouter()
const blogStore = useBlogStore()

const commandIconMap: Record<CommandItem['kind'], Component> = {
  route: Search,
  post: FileText,
  recent: History,
}

const navIconMap: Record<SiteNavIcon, Component> = {
  home: House,
  tag: Tag,
  folder: FolderTree,
  history: History,
  link: Link2,
  user: UserRound,
  grid: LayoutGrid,
  sparkles: Sparkles,
  compass: Compass,
  book: BookOpen,
}

const socialIconMap: Record<SocialLink['icon'], Component> = {
  github: Github,
  email: Mail,
  bilibili: Tv,
  wechat: MessageSquare,
}

const isPaletteOpen = ref(false)
const commandInput = ref('')
const activeCommandIndex = ref(0)
const commandInputRef = ref<HTMLInputElement | null>(null)
const isMacPlatform = ref(false)
const appearanceMode = ref<AppearanceMode>('light')
const isUserPanelOpen = ref(false)
const userPanelContainerRef = ref<HTMLElement | null>(null)
const navMenuRef = ref<HTMLElement | null>(null)
const canScrollRight = ref(false)
const isExtraSmallScreen = ref(false)

const syncLabel = computed(() => {
  if (blogStore.isInitializing) {
    return '同步中'
  }

  if (blogStore.loadError) {
    return '同步异常'
  }

  if (!blogStore.lastSyncedAt) {
    return '等待同步'
  }

  const target = new Date(blogStore.lastSyncedAt)

  return `已同步 ${new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(target)}`
})

const syncModeLabel = computed(() => 'API')

const syncStatusClass = computed(() => {
  if (blogStore.loadError) {
    return 'top-nav__sync--error'
  }

  if (blogStore.isInitializing) {
    return 'top-nav__sync--loading'
  }

  return 'top-nav__sync--ok'
})

const shortcutLabel = computed(() => (isMacPlatform.value ? 'Cmd + K' : 'Ctrl + K'))
const appearanceToggleLabel = computed(() => {
  if (appearanceMode.value === 'night') {
    return '切换到浅色模式'
  }

  return '切换到夜间模式'
})
const canClearRecentSearches = computed(
  () => blogStore.recentSearches.length > 0 && !commandInput.value.trim(),
)
const userProfile = computed(() => blogStore.profile)
const userProfileStats = computed(() => blogStore.profileStats.slice(0, 3))
const userPanelToggleLabel = computed(() => (isUserPanelOpen.value ? '关闭用户中心' : '打开用户中心'))
const navigationItems = computed<NavItem[]>(() => buildNavItems(blogStore.profile.navTabs))
const topNavAvatarSrc = computed(() => {
  const avatar = userProfile.value.avatar?.trim()
  return avatar || '/avatar.svg'
})

// 检测是否为超小屏幕（< 400px）
const checkScreenSize = () => {
  isExtraSmallScreen.value = window.innerWidth < 400
}

// 检测导航是否可以向右滚动
const checkScrollable = () => {
  if (!navMenuRef.value) return
  const { scrollWidth, clientWidth, scrollLeft } = navMenuRef.value
  canScrollRight.value = scrollWidth > clientWidth && scrollLeft + clientWidth < scrollWidth - 5
}

const handleNavScroll = () => {
  checkScrollable()
}

// 监听导航项变化，重新检测是否可以滚动
watch(navigationItems, () => {
  nextTick(() => {
    checkScrollable()
  })
}, { immediate: true })

const routeCommandItems = computed<RouteCommandItem[]>(() => {
  return navigationItems.value.map((item) => ({
    id: `route:${item.routeName}`,
    kind: 'route',
    label: item.label,
    description: item.description,
    routeName: item.routeName,
  }))
})

const postCommandItems = computed<PostCommandItem[]>(() => {
  return blogStore.posts.map((post) => ({
    id: `post:${post.id}`,
    kind: 'post',
    title: post.title,
    summary: post.summary,
    category: post.category,
    tagsText: post.tags.join(' '),
    postId: post.id,
  }))
})

const recentSearchCommandItems = computed<RecentSearchCommandItem[]>(() => {
  return blogStore.recentSearches.map((term, index) => ({
    id: `recent:${index}:${term}`,
    kind: 'recent',
    searchTerm: term,
  }))
})

const searchableCommandItems = computed<Array<RouteCommandItem | PostCommandItem>>(() => {
  return [...routeCommandItems.value, ...postCommandItems.value]
})

const commandResults = computed<CommandSearchResult[]>(() => {
  const keyword = commandInput.value.trim()

  if (!keyword) {
    const fallbackItems: CommandItem[] = [
      ...recentSearchCommandItems.value,
      ...routeCommandItems.value,
      ...postCommandItems.value.slice(0, 4),
    ]

    return fallbackItems.slice(0, 14).map((item, index) => ({
      item,
      score: fallbackItems.length - index,
    }))
  }

  return searchableCommandItems.value
    .map((item) => ({
      item,
      score: scoreWeightedSearch(buildSearchFields(item), keyword),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score
      }

      return a.item.id.localeCompare(b.item.id)
    })
    .slice(0, 14)
})

const isActive = (routeName: NavItem['routeName']) => route.name === routeName

const triggerDataSync = async () => {
  if (blogStore.isInitializing) {
    return
  }

  await blogStore.refresh()
}

const toggleAppearanceMode = () => {
  const nextMode: AppearanceMode = appearanceMode.value === 'night' ? 'light' : 'night'

  appearanceMode.value = nextMode
  applyAppearanceMode(nextMode)
  persistAppearanceMode(nextMode)
}

const closeUserPanel = () => {
  isUserPanelOpen.value = false
}

const toggleUserPanel = () => {
  const nextOpen = !isUserPanelOpen.value

  if (nextOpen) {
    closePalette()
  }

  isUserPanelOpen.value = nextOpen
}

const onUserPanelPointerDownOutside = (event: PointerEvent) => {
  if (!isUserPanelOpen.value) {
    return
  }

  if (!(event.target instanceof Node)) {
    return
  }

  if (userPanelContainerRef.value?.contains(event.target)) {
    return
  }

  closeUserPanel()
}

const openPalette = async () => {
  closeUserPanel()
  isPaletteOpen.value = true
  commandInput.value = ''
  activeCommandIndex.value = 0
  await nextTick()
  commandInputRef.value?.focus()
}

const closePalette = () => {
  isPaletteOpen.value = false
}

const navigateToRoute = async (routeName: NavItem['routeName']) => {
  closeUserPanel()
  closePalette()

  if (route.name === routeName) {
    return
  }

  await router.push({ name: routeName })
}

const navigateToPost = async (postId: string) => {
  closeUserPanel()
  closePalette()
  await router.push({ name: 'post-detail', params: { id: postId } })
}

const navigateToAdminLogin = async () => {
  closeUserPanel()
  closePalette()
  await router.push({ name: 'admin-login' })
}

const quickFillRecentSearch = async (searchTerm: string) => {
  commandInput.value = searchTerm
  activeCommandIndex.value = 0
  await nextTick()
  commandInputRef.value?.focus()
}

const selectCommand = async (result: CommandSearchResult) => {
  const item = result.item

  if (item.kind === 'recent') {
    await quickFillRecentSearch(item.searchTerm)
    return
  }

  const searchTerm = commandInput.value.trim()

  if (searchTerm) {
    blogStore.recordRecentSearch(searchTerm)
  }

  if (item.kind === 'route') {
    await navigateToRoute(item.routeName)
    return
  }

  await navigateToPost(item.postId)
}

const moveActiveIndex = (step: number) => {
  if (commandResults.value.length === 0) {
    return
  }

  const max = commandResults.value.length - 1
  let next = activeCommandIndex.value + step

  if (next > max) {
    next = 0
  }

  if (next < 0) {
    next = max
  }

  activeCommandIndex.value = next
}

const executeActiveCommand = () => {
  const result = commandResults.value[activeCommandIndex.value]

  if (result) {
    void selectCommand(result)
  }
}

const onCommandInputKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveActiveIndex(1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveActiveIndex(-1)
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    executeActiveCommand()
  }
}

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  const tagName = target.tagName
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true
  }

  return Boolean(target.closest('[contenteditable="true"]'))
}

const onWindowKeydown = (event: KeyboardEvent) => {
  const isOpenShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'
  const shouldKeepNativeShortcut = isEditableTarget(event.target) && !isPaletteOpen.value

  if (isOpenShortcut && !shouldKeepNativeShortcut) {
    event.preventDefault()

    if (isPaletteOpen.value) {
      closePalette()
    } else {
      void openPalette()
    }

    return
  }

  if (event.key === 'Escape') {
    if (isPaletteOpen.value) {
      closePalette()
    }

    if (isUserPanelOpen.value) {
      closeUserPanel()
    }
  }
}

const visibleSocialLinks = computed(() => {
  return userProfile.value.socials.filter((social) => !isDisabledSocialLink(social.href))
})

const getCommandLabelHtml = (result: CommandSearchResult) => {
  const item = result.item
  const keyword = commandInput.value.trim()

  if (item.kind === 'route') {
    return buildHighlightedHtml(item.label, collectKeywordMatchRanges(item.label, keyword))
  }

  if (item.kind === 'post') {
    return buildHighlightedHtml(item.title, collectKeywordMatchRanges(item.title, keyword))
  }

  return buildHighlightedHtml(item.searchTerm, collectKeywordMatchRanges(item.searchTerm, keyword))
}

const getCommandDescHtml = (result: CommandSearchResult) => {
  const item = result.item
  const keyword = commandInput.value.trim()

  if (item.kind === 'route') {
    return buildHighlightedHtml(item.description, collectKeywordMatchRanges(item.description, keyword))
  }

  if (item.kind === 'post') {
    const preview = `${item.category} · ${item.summary}`
    return buildHighlightedHtml(preview, collectKeywordMatchRanges(preview, keyword))
  }

  return '点击继续检索'
}

const getCommandIcon = (item: CommandItem) => {
  return commandIconMap[item.kind]
}

const getNavIcon = (icon: SiteNavIcon) => {
  return navIconMap[icon]
}

const getSocialIcon = (icon: SocialLink['icon'] | string) => {
  return socialIconMap[normalizeSocialIconCode(icon)] ?? Github
}

watch(commandResults, (items) => {
  if (items.length === 0) {
    activeCommandIndex.value = 0
    return
  }

  if (activeCommandIndex.value >= items.length) {
    activeCommandIndex.value = 0
  }
})

watch(isPaletteOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

watch(
  () => route.fullPath,
  () => {
    closeUserPanel()
  },
)

onMounted(() => {
  isMacPlatform.value = /mac/i.test(navigator.platform)
  appearanceMode.value = getAppliedAppearanceMode()
  checkScreenSize()
  checkScrollable()
  window.addEventListener('keydown', onWindowKeydown)
  window.addEventListener('pointerdown', onUserPanelPointerDownOutside)
  window.addEventListener('resize', checkScreenSize)
  window.addEventListener('resize', checkScrollable)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown)
  window.removeEventListener('pointerdown', onUserPanelPointerDownOutside)
  window.removeEventListener('resize', checkScreenSize)
  window.removeEventListener('resize', checkScrollable)
  document.body.style.overflow = ''
})
</script>

<template>
  <header class="top-nav">
    <div class="top-nav__inner">
      <RouterLink class="top-nav__avatar-link" :to="{ name: 'home' }" aria-label="返回首页">
        <img class="top-nav__avatar" :src="topNavAvatarSrc" :alt="`${userProfile.name || '站点'} 头像`" />
      </RouterLink>

      <nav
        ref="navMenuRef"
        class="top-nav__menu"
        :class="{
          'top-nav__menu--compact': isExtraSmallScreen,
          'top-nav__menu--scrollable': canScrollRight,
        }"
        aria-label="主导航"
        @scroll="handleNavScroll"
      >
        <RouterLink
          v-for="item in navigationItems"
          :key="item.routeName"
          :to="{ name: item.routeName }"
          class="top-nav__link"
          :class="{
            'top-nav__link--active': isActive(item.routeName),
            'top-nav__link--icon-only': isExtraSmallScreen,
          }"
          :title="item.label"
        >
          <component
            :is="getNavIcon(item.icon)"
            class="icon icon--xs icon--stroke-strong icon--react top-nav__link-icon"
            :class="{ 'icon--sm': isExtraSmallScreen }"
            aria-hidden="true"
          />
          <span v-if="!isExtraSmallScreen" class="top-nav__link-label">{{ item.label }}</span>
        </RouterLink>
        <span v-if="canScrollRight" class="top-nav__scroll-indicator" aria-hidden="true">
          <ChevronRight class="icon icon--xs" />
        </span>
      </nav>

      <div class="top-nav__actions">
        <button
          class="top-nav__sync icon-host"
          :class="syncStatusClass"
          type="button"
          :aria-label="`数据状态：${syncLabel}`"
          @click="triggerDataSync"
        >
          <span class="top-nav__sync-icon-wrap" aria-hidden="true">
            <RefreshCw
              v-if="blogStore.isInitializing"
              class="icon icon--sm icon--stroke-strong top-nav__sync-spinner"
            />
            <TriangleAlert
              v-else-if="blogStore.loadError"
              class="icon icon--sm icon--stroke-strong icon--react"
            />
            <Cloud
              v-else
              class="icon icon--sm icon--stroke-strong icon--react"
            />
          </span>
          <span class="top-nav__sync-meta">
            <strong>{{ syncModeLabel }}</strong>
            <small>{{ syncLabel }}</small>
          </span>
        </button>

        <button class="top-nav__icon-btn icon-host" type="button" aria-label="搜索" @click="openPalette">
          <Search class="icon icon--md icon--stroke-strong icon--react" aria-hidden="true" />
        </button>
        <button
          class="top-nav__shortcut"
          type="button"
          aria-label="打开命令面板"
          :aria-expanded="isPaletteOpen"
          @click="openPalette"
        >
          {{ shortcutLabel }}
        </button>
        <button
          class="top-nav__icon-btn top-nav__icon-btn--theme icon-host"
          :class="{ 'top-nav__icon-btn--active': appearanceMode === 'night' }"
          type="button"
          :aria-label="appearanceToggleLabel"
          :title="appearanceToggleLabel"
          :aria-pressed="appearanceMode === 'night'"
          @click="toggleAppearanceMode"
        >
          <SunMoon class="icon icon--md icon--stroke-strong icon--react" aria-hidden="true" />
        </button>
        <a class="top-nav__icon-btn icon-host" href="/rss.xml" aria-label="RSS 订阅">
          <Rss class="icon icon--md icon--stroke-strong icon--react" aria-hidden="true" />
        </a>
        <div ref="userPanelContainerRef" class="top-nav__user">
          <button
            class="top-nav__icon-btn top-nav__user-toggle icon-host"
            :class="{ 'top-nav__icon-btn--active': isUserPanelOpen }"
            type="button"
            :aria-label="userPanelToggleLabel"
            :title="userPanelToggleLabel"
            aria-haspopup="dialog"
            :aria-expanded="isUserPanelOpen"
            aria-controls="user-center-panel"
            @click="toggleUserPanel"
          >
            <UserRound class="icon icon--md icon--stroke-strong icon--react" aria-hidden="true" />
          </button>

          <Transition name="user-pop">
            <section
              v-if="isUserPanelOpen"
              id="user-center-panel"
              class="top-nav__user-panel"
              role="dialog"
              aria-label="用户中心"
            >
              <header class="top-nav__user-head">
                <img class="top-nav__user-avatar" :src="topNavAvatarSrc" alt="用户头像" />
                <div class="top-nav__user-meta">
                  <strong>{{ userProfile.name }}</strong>
                  <p>{{ userProfile.motto }}</p>
                </div>
              </header>

              <ul class="top-nav__user-stats">
                <li v-for="item in userProfileStats" :key="item.label">
                  <small>{{ item.label }}</small>
                  <strong>{{ item.value }}</strong>
                </li>
              </ul>

              <nav class="top-nav__user-actions" aria-label="用户中心快捷入口">
                <button type="button" @click="navigateToRoute('about')">关于作者</button>
                <button type="button" @click="navigateToRoute('timeline')">更新动态</button>
                <button type="button" @click="navigateToAdminLogin">后台登录</button>
              </nav>

              <ul class="top-nav__user-socials" aria-label="社交链接">
                <li v-for="social in visibleSocialLinks" :key="social.label">
                  <a
                    :href="social.href"
                    :target="isExternalHttpLink(social.href) ? '_blank' : undefined"
                    :rel="isExternalHttpLink(social.href) ? 'noreferrer noopener' : undefined"
                  >
                    <span>{{ social.label }}</span>
                    <span class="top-nav__user-social-icon">
                      <img
                        v-if="social.iconUrl"
                        :src="social.iconUrl"
                        :alt="`${social.label} 图标`"
                        loading="lazy"
                      />
                      <component
                        v-else
                        :is="getSocialIcon(social.icon)"
                        class="icon icon--xs icon--stroke-strong icon--react"
                        aria-hidden="true"
                      />
                    </span>
                  </a>
                </li>
                <li v-if="visibleSocialLinks.length === 0" class="top-nav__user-social-empty">
                  暂无公开社交账号
                </li>
              </ul>
            </section>
          </Transition>
        </div>
      </div>
    </div>
  </header>

  <Teleport to="body">
    <Transition name="palette-pop">
      <div v-if="isPaletteOpen" class="command-overlay" @click.self="closePalette">
        <section class="command-panel" aria-label="命令面板">
          <header class="command-panel__head">
            <input
              ref="commandInputRef"
              v-model="commandInput"
              class="command-panel__input"
              type="search"
              placeholder="搜索页面、文章标题、摘要或标签..."
              @keydown="onCommandInputKeydown"
            />
            <button
              v-if="canClearRecentSearches"
              type="button"
              class="command-panel__clear-history"
              @click="blogStore.clearRecentSearches()"
            >
              清空历史
            </button>
            <button type="button" class="command-panel__close" @click="closePalette">
              Esc
            </button>
          </header>

          <div
            v-if="!commandInput.trim() && blogStore.recentSearches.length > 0"
            class="command-panel__recent"
          >
            <strong>最近搜索</strong>
            <div class="command-panel__recent-list">
              <span
                v-for="term in blogStore.recentSearches"
                :key="`recent-chip:${term}`"
                class="command-panel__recent-chip"
              >
                <button type="button" class="command-panel__recent-chip-action" @click="quickFillRecentSearch(term)">
                  <History class="icon icon--xs icon--stroke-strong" aria-hidden="true" />
                  <span>{{ term }}</span>
                </button>
                <button
                  type="button"
                  class="command-panel__recent-chip-remove icon-host"
                  :aria-label="`删除搜索词：${term}`"
                  @click="blogStore.removeRecentSearch(term)"
                >
                  <X class="icon icon--xs icon--stroke-strong" aria-hidden="true" />
                </button>
              </span>
            </div>
          </div>

          <ul class="command-panel__list" role="listbox">
            <li v-if="commandResults.length === 0" class="command-panel__empty">
              未找到匹配页面或文章
            </li>
            <li v-for="(result, index) in commandResults" :key="result.item.id">
              <button
                type="button"
                class="command-panel__item"
                :class="{ 'command-panel__item--active': index === activeCommandIndex }"
                @mouseenter="activeCommandIndex = index"
                @click="selectCommand(result)"
              >
                <span class="command-panel__item-prefix">
                  <component
                    :is="getCommandIcon(result.item)"
                    class="icon icon--sm icon--stroke-strong icon--react"
                    aria-hidden="true"
                  />
                </span>
                <span class="command-panel__item-main">
                  <span class="command-panel__item-label" v-html="getCommandLabelHtml(result)" />
                  <span class="command-panel__item-desc" v-html="getCommandDescHtml(result)" />
                </span>
                <span class="command-panel__item-type">{{ getCommandTypeLabel(result.item) }}</span>
              </button>
            </li>
          </ul>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
