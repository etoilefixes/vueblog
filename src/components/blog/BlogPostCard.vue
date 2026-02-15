<script setup lang="ts">
import { computed } from 'vue'
import type { CSSProperties } from 'vue'

import type { BlogPost } from '@/types/blog'

const props = defineProps<{
  post: BlogPost
  index: number
}>()

const formattedDate = computed(() => {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${props.post.publishedAt}T00:00:00`))
})

const cardStyle = computed<CSSProperties>(() => ({
  '--card-delay': `${props.index * 90}ms`,
}))
</script>

<template>
  <article class="blog-card" :style="cardStyle">
    <header class="blog-card__head">
      <p class="blog-card__kicker">
        <span class="blog-card__category">{{ props.post.category }}</span>
        <span v-if="props.post.highlight" class="blog-card__badge">{{ props.post.highlight }}</span>
      </p>
      <h2 class="blog-card__title">{{ props.post.title }}</h2>
      <p class="blog-card__meta">{{ formattedDate }} · {{ props.post.readingMinutes }} 分钟</p>
    </header>

    <p class="blog-card__summary">{{ props.post.summary }}</p>

    <div class="blog-card__tags">
      <span v-for="tag in props.post.tags" :key="tag" class="blog-card__tag">
        #{{ tag }}
      </span>
    </div>
  </article>
</template>
