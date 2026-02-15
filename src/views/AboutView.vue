<script setup lang="ts">
import { useBlogStore } from '@/stores/blog'

const blogStore = useBlogStore()

const resolveProjectStatusClass = (status: string) => {
  const normalized = status.trim().toLowerCase()

  if (normalized.includes('已上线') || normalized.includes('完成') || normalized.includes('done')) {
    return 'project-card__status--done'
  }

  if (normalized.includes('规划') || normalized.includes('计划') || normalized.includes('plan')) {
    return 'project-card__status--plan'
  }

  return ''
}
</script>

<template>
  <main class="page-shell page-shell--about">
    <header class="page-head">
      <p class="page-kicker">ABOUT ME</p>
      <h1 class="page-title">关于</h1>
      <p class="page-subtitle">
        关注工程质量、交互体验和长期可维护性的前端实践者。
      </p>
    </header>

    <section class="about-grid">
      <article class="about-card about-card--profile">
        <img :src="blogStore.profile.avatar" :alt="`${blogStore.profile.name} 头像`" />
        <h2>{{ blogStore.profile.name }}</h2>
        <p>{{ blogStore.profile.motto }}</p>
      </article>

      <article class="about-card" v-for="section in blogStore.about" :key="section.id">
        <h2>{{ section.title }}</h2>
        <p>{{ section.content }}</p>
      </article>
    </section>

    <section class="about-metrics">
      <article>
        <strong>{{ blogStore.postCount }}</strong>
        <span>文章总数</span>
      </article>
      <article>
        <strong>{{ blogStore.totalViews }}</strong>
        <span>累计阅读</span>
      </article>
      <article>
        <strong>{{ blogStore.totalComments }}</strong>
        <span>累计评论</span>
      </article>
    </section>

    <section v-if="blogStore.projects.length > 0" class="about-projects">
      <header class="about-projects__head">
        <h2>项目</h2>
        <p>以下内容由站点配置后台实时维护。</p>
      </header>

      <div class="about-projects__grid">
        <article v-for="item in blogStore.projects" :key="item.id" class="project-card">
          <div class="project-card__head">
            <h3>{{ item.name }}</h3>
            <span class="project-card__status" :class="resolveProjectStatusClass(item.status)">
              {{ item.status }}
            </span>
          </div>
          <p>{{ item.summary }}</p>
          <div v-if="item.techStack.length > 0" class="project-card__stack">
            <span v-for="tech in item.techStack" :key="`${item.id}-${tech}`">{{ tech }}</span>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>
