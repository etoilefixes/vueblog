<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import TopNavBar from '@/components/layout/TopNavBar.vue'
import { applyRuntimeSeoMeta } from '@/services/seo-runtime'
import { useBlogStore } from '@/stores/blog'
import { useRoute } from 'vue-router'

const route = useRoute()
const blogStore = useBlogStore()
const isAdminRoute = computed(() => route.path.startsWith('/admin'))
const showPageOpenIntro = ref(false)
let introTimer = 0

const routeOrderMap: Record<string, number> = {
  home: 0,
  tags: 1,
  categories: 2,
  timeline: 3,
  links: 4,
  about: 5,
  'post-detail': 6,
}

const transitionName = ref<'route-forward' | 'route-backward' | 'route-fade'>('route-fade')
let previousName = String(route.name ?? 'home')
let previousOrder = routeOrderMap[previousName] ?? 0

watch(
  () => route.fullPath,
  () => {
    const toName = String(route.name ?? 'home')
    const toOrder = routeOrderMap[toName] ?? previousOrder
    const fromIsAdmin = previousName.startsWith('admin-')
    const toIsAdmin = toName.startsWith('admin-')

    if (fromIsAdmin || toIsAdmin) {
      transitionName.value = 'route-fade'
    } else if (toName === previousName || toOrder === previousOrder) {
      transitionName.value = 'route-fade'
    } else {
      transitionName.value = toOrder > previousOrder ? 'route-forward' : 'route-backward'
    }

    previousName = toName
    previousOrder = toOrder
  },
)

const appShellClass = computed(() => {
  const name = String(route.name ?? 'home')
  const tone = String(route.meta?.tone ?? 'home')

  return [`app-shell--${name}`, `app-shell--tone-${tone}`]
})

const showBootMask = computed(() => blogStore.isInitializing && !blogStore.isHydrated)
const showBootError = computed(() => Boolean(blogStore.loadError) && !blogStore.isHydrated)
const siteName = computed(() => {
  const normalized = blogStore.profile.name.trim()
  return normalized ? `${normalized} Blog` : 'Blog'
})
const siteDescription = computed(() => {
  const normalized = blogStore.profile.motto.trim()
  return normalized || '个性化前端博客，聚焦工程化、动效设计与内容体验。'
})
const siteUrl = String(import.meta.env.VITE_SITE_URL ?? 'https://example.com').replace(/\/+$/, '')

const getPageDescription = (routeName: string) => {
  const descriptionMap: Partial<Record<string, string>> = {
    home: siteDescription.value,
    tags: '按标签聚合文章，快速检索主题脉络与实践记录。',
    categories: '按分类浏览工程、架构、动效等内容，提升检索效率。',
    timeline: '通过时间线回顾站点更新，快速定位历史版本与文章发布节奏。',
    links: '精选技术创作者与站点推荐，扩展阅读视野。',
    about: '了解作者背景、站点定位和长期创作方向。',
  }

  return descriptionMap[routeName] ?? siteDescription.value
}

const getPageTitle = (routeName: string) => {
  const titleMap: Partial<Record<string, string>> = {
    home: siteName.value,
    tags: `标签 · ${siteName.value}`,
    categories: `分类 · ${siteName.value}`,
    timeline: `时间线 · ${siteName.value}`,
    links: `友链 · ${siteName.value}`,
    about: `关于 · ${siteName.value}`,
  }

  return titleMap[routeName] ?? siteName.value
}

const retryBootstrap = async () => {
  await blogStore.refresh()
}

const ensureBlogBootstrap = async () => {
  if (blogStore.isHydrated || blogStore.isInitializing) {
    return
  }

  await blogStore.initialize()
}

watch(isAdminRoute, (value) => {
  if (!value) {
    void ensureBlogBootstrap()
  }
})

watch(
  () => [route.fullPath, blogStore.isHydrated, blogStore.posts.length],
  () => {
    if (isAdminRoute.value) {
      return
    }

    const routeName = String(route.name ?? 'home')
    const canonicalUrl = `${siteUrl}${route.path}`

    if (routeName === 'post-detail') {
      const postId = String(route.params.id ?? '')
      const post = blogStore.getPostById(postId)

      if (!post) {
        applyRuntimeSeoMeta({
          title: `文章不存在 · ${siteName.value}`,
          description: `你访问的文章标识 ${postId} 暂不可用，请返回首页继续浏览。`,
          canonicalUrl,
          openGraphType: 'website',
          imageUrl: `${siteUrl}/og/default.svg`,
          keywords: '博客,前端,文章',
        })
        return
      }

      applyRuntimeSeoMeta({
        title: `${post.title} · ${siteName.value}`,
        description: post.summary || post.lead,
        canonicalUrl,
        openGraphType: 'article',
        imageUrl: `${siteUrl}/og/${post.id}.svg`,
        keywords: [post.category, ...post.tags].join(','),
        publishedTime: new Date(`${post.publishedAt}T00:00:00+08:00`).toISOString(),
        tags: post.tags,
      })
      return
    }

    applyRuntimeSeoMeta({
      title: getPageTitle(routeName),
      description: getPageDescription(routeName),
      canonicalUrl,
      openGraphType: 'website',
      imageUrl: `${siteUrl}/og/default.svg`,
      keywords: '前端博客,Vue3,TypeScript,Vite',
    })
  },
  {
    immediate: true,
  },
)

onMounted(() => {
  if (!isAdminRoute.value) {
    showPageOpenIntro.value = true

    introTimer = window.setTimeout(() => {
      showPageOpenIntro.value = false
    }, 960)
  }

  if (!isAdminRoute.value) {
    void ensureBlogBootstrap()
  }
})

onBeforeUnmount(() => {
  window.clearTimeout(introTimer)
})
</script>

<template>
  <div class="site-shell" :class="{ 'site-shell--admin': isAdminRoute }">
    <Transition name="page-open-fade">
      <div v-if="showPageOpenIntro" class="page-open" aria-hidden="true">
        <div class="page-open__brand">
          <span class="page-open__pulse" />
          <strong>mereiith Blog</strong>
        </div>
      </div>
    </Transition>

    <template v-if="!isAdminRoute">
      <TopNavBar />
      <div class="app-shell" :class="appShellClass">
        <Transition name="app-boot-fade">
          <div v-if="showBootMask" class="app-boot-mask" aria-live="polite">
            <div class="app-boot-card">
              <p class="app-boot-card__kicker">BLOG BOOTSTRAP</p>
              <h2 class="app-boot-card__title">正在准备页面数据...</h2>
              <p class="app-boot-card__desc">首次进入会同步文章、评论和站点配置。</p>
              <div class="app-boot-card__pulse" />
            </div>
          </div>
        </Transition>

        <Transition name="app-boot-toast">
          <section v-if="showBootError" class="app-boot-error" aria-live="assertive">
            <h2>数据初始化失败</h2>
            <p>{{ blogStore.loadError }}</p>
            <button type="button" @click="retryBootstrap">重试同步</button>
          </section>
        </Transition>

        <RouterView v-slot="{ Component, route: viewRoute }">
          <Transition :name="transitionName" mode="out-in">
            <component :is="Component" :key="viewRoute.fullPath" />
          </Transition>
        </RouterView>
      </div>
    </template>

    <RouterView v-else v-slot="{ Component, route: viewRoute }">
      <Transition name="route-fade" mode="out-in">
        <component :is="Component" :key="viewRoute.matched[0]?.path ?? viewRoute.path" />
      </Transition>
    </RouterView>
  </div>
</template>
