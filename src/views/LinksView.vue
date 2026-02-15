<script setup lang="ts">
import { useBlogStore } from '@/stores/blog'

const blogStore = useBlogStore()
</script>

<template>
  <main class="page-shell page-shell--links">
    <header class="page-head">
      <p class="page-kicker">FRIEND LINKS</p>
      <h1 class="page-title">友链</h1>
      <p class="page-subtitle">
        挑选值得长期关注的创作者站点和技术博客。
      </p>
    </header>

    <section class="links-grid" aria-label="友链列表">
      <a
        v-for="link in blogStore.links"
        :key="link.id"
        :href="link.url"
        class="link-card"
        target="_blank"
        rel="noreferrer"
      >
        <h2>{{ link.name }}</h2>
        <p>{{ link.description }}</p>
        <div class="link-card__tags">
          <span v-for="tag in link.tags" :key="tag">{{ tag }}</span>
        </div>
      </a>
    </section>
  </main>
</template>
