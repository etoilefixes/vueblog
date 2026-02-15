<script setup lang="ts">
import { useBlogStore } from '@/stores/blog'

const blogStore = useBlogStore()

const getPostRoute = (id: string) => ({
  name: 'post-detail' as const,
  params: { id },
})
</script>

<template>
  <main class="page-shell page-shell--tags">
    <header class="page-head">
      <p class="page-kicker">TAG SPACE</p>
      <h1 class="page-title">标签页</h1>
      <p class="page-subtitle">
        按主题快速定位文章，优先查看高频标签和近期内容。
      </p>
    </header>

    <section class="tags-grid" aria-label="标签统计">
      <article v-for="tag in blogStore.tagStats" :key="tag.tag" class="tag-card">
        <header class="tag-card__head">
          <h2>#{{ tag.tag }}</h2>
          <span>{{ tag.count }} 篇</span>
        </header>
        <RouterLink
          v-for="sample in tag.samplePosts"
          :key="sample.id"
          class="tag-card__line tag-card__line-link"
          :to="getPostRoute(sample.id)"
        >
          {{ sample.title }}
        </RouterLink>
      </article>
    </section>
  </main>
</template>
