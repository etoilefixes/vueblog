<script setup lang="ts">
import { useBlogStore } from '@/stores/blog'

const blogStore = useBlogStore()

const getPostRoute = (id: string) => ({
  name: 'post-detail' as const,
  params: { id },
})
</script>

<template>
  <main class="page-shell page-shell--categories">
    <header class="page-head">
      <p class="page-kicker">CATEGORY ARCHIVE</p>
      <h1 class="page-title">分类页</h1>
      <p class="page-subtitle">
        用领域视角组织内容，阅读路径更清晰。
      </p>
    </header>

    <section class="category-grid" aria-label="分类列表">
      <article
        v-for="category in blogStore.categoryCards"
        :key="category.category"
        class="category-card"
      >
        <h2>{{ category.category }}</h2>
        <p class="category-card__meta">
          {{ category.count }} 篇 · {{ category.readingMinutes }} 分钟
        </p>
        <RouterLink
          v-if="category.latestPostId"
          class="category-card__latest category-card__latest-link"
          :to="getPostRoute(category.latestPostId)"
        >
          {{ category.latestPostTitle }}
        </RouterLink>
        <p v-else class="category-card__latest">{{ category.latestPostTitle }}</p>
      </article>
    </section>
  </main>
</template>
