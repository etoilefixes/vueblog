<script setup lang="ts">
import { Eye, Github, Lock, Mail, MessageCircle, MessageSquare, Timer, Tv } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Component, CSSProperties } from 'vue'

import { formatRuntimeTemplate } from '@/services/runtime-template'
import { highlightSearchKeyword } from '@/services/search-highlight'
import { normalizeSocialIconCode } from '@/services/social-icon'
import { useBlogStore } from '@/stores/blog'
import type { SocialLink } from '@/types/blog'

const blogStore = useBlogStore()
const runtimeNow = ref(Date.now())

const getCardStyle = (index: number): CSSProperties => {
  return {
    '--card-delay': `${index * 90}ms`,
  }
}

const isExternalUrl = (url: string) => {
  return url.startsWith('http') || url.startsWith('mailto:')
}

const getPostRoute = (id: string) => ({
  name: 'post-detail' as const,
  params: { id },
})

const getHighlightedText = (value: string) => {
  return highlightSearchKeyword(value, blogStore.keyword)
}

const socialIconMap: Record<SocialLink['icon'], Component> = {
  github: Github,
  email: Mail,
  bilibili: Tv,
  wechat: MessageSquare,
}

const getSocialIcon = (icon: SocialLink['icon'] | string) => {
  return socialIconMap[normalizeSocialIconCode(icon)] ?? Github
}

const icpHref = computed(() => {
  return blogStore.footerInfo.icpLink?.trim() ?? ''
})

const runtimeText = computed(() => {
  const footer = blogStore.footerInfo

  if (footer.runtimeMode !== 'auto' || !footer.runtimeStartedAt) {
    return footer.runtime
  }

  const startedAt = new Date(footer.runtimeStartedAt).getTime()

  if (Number.isNaN(startedAt)) {
    return footer.runtime
  }

  const diffMs = Math.max(runtimeNow.value - startedAt, 0)
  const totalSeconds = Math.floor(diffMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return formatRuntimeTemplate(footer.runtime, {
    days,
    hours,
    minutes,
    seconds,
  })
})

let runtimeTimer = 0

onMounted(() => {
  if (blogStore.keyword.trim()) {
    blogStore.setKeyword('')
  }

  runtimeTimer = window.setInterval(() => {
    runtimeNow.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  window.clearInterval(runtimeTimer)
})
</script>

<template>
  <main class="home-page">
    <section class="home-layout">
      <section class="home-feed" aria-label="文章列表">
        <header class="home-hero">
          <p class="home-hero__eyebrow">PERSONAL FRONTEND PLAYGROUND</p>
          <h1 class="home-hero__title">个性前端日志，持续迭代</h1>
          <p class="home-hero__desc">
            记录工程化、交互动效和内容体验设计，把想法变成可复用的前端资产。
          </p>

          <div class="home-hero__tags" aria-label="标签筛选">
            <button
              v-for="tag in blogStore.tags"
              :key="tag"
              type="button"
              class="home-hero__tag"
              :class="{ 'home-hero__tag--active': tag === blogStore.activeTag }"
              @click="blogStore.setActiveTag(tag)"
            >
              {{ tag }}
            </button>
          </div>
        </header>

        <article
          v-for="(post, index) in blogStore.paginatedPosts"
          :key="post.id"
          class="post-card"
          :style="getCardStyle(index)"
        >
          <header class="post-card__head">
            <h2 class="post-card__title">
              <RouterLink class="post-card__title-link" :to="getPostRoute(post.id)">
                <span v-html="getHighlightedText(post.title)" />
              </RouterLink>
            </h2>
            <span v-if="post.highlight" class="post-card__badge">{{ post.highlight }}</span>
          </header>

          <p class="post-card__meta">
            <span>{{ post.publishedAt }}</span>
            <span>{{ post.category }}</span>
            <span class="post-card__meta-item">
              <Eye class="icon icon--xs icon--stroke-strong" aria-hidden="true" />
              <span>{{ post.views ?? 0 }}</span>
            </span>
            <span class="post-card__meta-item">
              <MessageCircle class="icon icon--xs icon--stroke-strong" aria-hidden="true" />
              <span>{{ post.comments ?? 0 }}</span>
            </span>
          </p>

          <p class="post-card__excerpt" v-html="getHighlightedText(post.summary)" />

          <section v-if="post.noticeTitle || post.noticeLines" class="post-card__tip">
            <h3>{{ post.noticeTitle ?? '重点说明' }}</h3>
            <p v-for="line in post.noticeLines ?? []" :key="line">{{ line }}</p>
          </section>

          <blockquote v-if="post.quote" class="post-card__quote">
            {{ post.quote }}
          </blockquote>

          <footer class="post-card__footer">
            <span class="post-card__reading">{{ post.readingMinutes }} 分钟阅读</span>
            <RouterLink class="post-card__read" :to="getPostRoute(post.id)">
              阅读全文
            </RouterLink>
          </footer>
        </article>

        <p v-if="blogStore.paginatedPosts.length === 0" class="post-empty">
          没有命中内容，试试切换标签。
        </p>

        <nav class="home-pagination" aria-label="分页导航">
          <button
            type="button"
            class="home-pagination__btn"
            :disabled="!blogStore.canPrevPage"
            @click="blogStore.prevPage"
          >
            ‹
          </button>
          <button
            v-for="page in blogStore.pageNumbers"
            :key="page"
            type="button"
            class="home-pagination__btn"
            :class="{ 'home-pagination__btn--active': page === blogStore.currentPage }"
            @click="blogStore.setPage(page)"
          >
            {{ page }}
          </button>
          <button
            type="button"
            class="home-pagination__btn"
            :disabled="!blogStore.canNextPage"
            @click="blogStore.nextPage"
          >
            ›
          </button>
        </nav>
      </section>

      <aside class="home-side" aria-label="个人信息">
        <section class="profile-card">
          <img
            class="profile-card__avatar"
            :src="blogStore.profile.avatar"
            :alt="`${blogStore.profile.name} 头像`"
          />
          <h2 class="profile-card__name">{{ blogStore.profile.name }}</h2>
          <p class="profile-card__motto">{{ blogStore.profile.motto }}</p>

          <div class="profile-card__stats">
            <article
              v-for="item in blogStore.profileStats"
              :key="item.label"
              class="profile-card__stat"
            >
              <strong>{{ item.value }}</strong>
              <span>{{ item.label }}</span>
            </article>
          </div>

          <ul class="profile-card__socials">
            <li v-for="social in blogStore.profile.socials" :key="social.label">
              <a
                class="profile-card__social icon-host"
                :href="social.href"
                :target="isExternalUrl(social.href) ? '_blank' : undefined"
                :rel="isExternalUrl(social.href) ? 'noreferrer' : undefined"
              >
                <img
                  v-if="social.iconUrl"
                  class="profile-card__social-icon-image"
                  :src="social.iconUrl"
                  :alt="`${social.label} 图标`"
                  loading="lazy"
                />
                <component
                  v-else
                  :is="getSocialIcon(social.icon)"
                  class="icon icon--md icon--stroke-strong icon--react"
                  aria-hidden="true"
                />
                <span>{{ social.label }}</span>
              </a>
            </li>
          </ul>
        </section>

        <section class="profile-glance">
          <h3 class="profile-glance__title">精选文章</h3>
          <RouterLink
            v-if="blogStore.featuredPost"
            class="profile-glance__text profile-glance__text-link"
            :to="getPostRoute(blogStore.featuredPost.id)"
          >
            {{ blogStore.featuredPost.title }}
          </RouterLink>
          <p v-else class="profile-glance__text">暂无精选内容</p>
          <div class="profile-glance__tags">
            <span v-for="tag in blogStore.hotTags" :key="tag">#{{ tag }}</span>
          </div>
        </section>
      </aside>
    </section>

    <footer class="home-footer" aria-label="站点信息">
      <p class="home-footer__line">
        <a
          v-if="icpHref"
          class="home-footer__icp-link icon-host"
          :href="icpHref"
          target="_blank"
          rel="noreferrer"
        >
          <span>{{ blogStore.footerInfo.icp }}</span>
        </a>
        <span v-else>{{ blogStore.footerInfo.icp }}</span>
        <Lock
          v-if="blogStore.footerInfo.icpLocked"
          class="icon icon--xs icon--stroke-strong home-footer__lock"
          aria-label="备案信息已锁定"
        />
      </p>
      <p class="home-footer__line">
        <Timer class="icon icon--xs icon--stroke-strong" aria-hidden="true" />
        <span>{{ runtimeText }}</span>
      </p>
      <p>{{ blogStore.footerInfo.poweredBy }}</p>
      <p>{{ blogStore.footerInfo.copyright }}</p>
    </footer>
  </main>
</template>
