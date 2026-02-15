<script setup lang="ts">
import { useBlogStore } from '@/stores/blog'

const blogStore = useBlogStore()

const getPostRoute = (id: string) => ({
  name: 'post-detail' as const,
  params: { id },
})
</script>

<template>
  <main class="page-shell page-shell--timeline">
    <header class="page-head">
      <p class="page-kicker">TIMELINE</p>
      <h1 class="page-title">时间线</h1>
      <p class="page-subtitle">
        按发布时间查看更新节奏，快速回顾近期迭代。
      </p>
    </header>

    <section class="timeline" aria-label="文章时间线">
      <article
        v-for="item in blogStore.timelineItems"
        :key="item.id"
        class="timeline-item"
      >
        <div class="timeline-item__date">
          <strong>{{ item.year }}</strong>
          <span>{{ item.monthDay }}</span>
        </div>
        <div class="timeline-item__body">
          <h2>
            <RouterLink class="timeline-item__title-link" :to="getPostRoute(item.id)">
              {{ item.title }}
            </RouterLink>
          </h2>
          <p>{{ item.summary }}</p>
        </div>
      </article>
    </section>
  </main>
</template>
