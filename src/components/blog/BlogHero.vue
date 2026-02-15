<script setup lang="ts">
defineProps<{
  totalPosts: number
  totalReadingMinutes: number
  featuredTitle: string
  hotTags: string[]
}>()
</script>

<template>
  <header class="blog-hero">
    <div class="blog-hero__grain" aria-hidden="true" />
    <p class="blog-hero__eyebrow">JUN'S FRONTEND NOTEBOOK</p>
    <h1 class="blog-hero__title">写代码，也写审美</h1>
    <p class="blog-hero__subtitle">
      这里聚焦工程化、交互动效和架构实践。用内容驱动界面，用细节表达个性。
    </p>

    <div class="blog-hero__ticker" aria-label="热点标签">
      <span v-for="tag in hotTags" :key="tag" class="blog-hero__chip">#{{ tag }}</span>
    </div>

    <div class="blog-hero__stats">
      <article class="blog-hero__stat">
        <strong>{{ totalPosts }}</strong>
        <span>可读文章</span>
      </article>
      <article class="blog-hero__stat">
        <strong>{{ totalReadingMinutes }} min</strong>
        <span>预计阅读</span>
      </article>
      <article class="blog-hero__stat blog-hero__stat--wide">
        <strong>精选</strong>
        <span>{{ featuredTitle }}</span>
      </article>
    </div>
  </header>
</template>
