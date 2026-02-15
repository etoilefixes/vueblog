<script setup lang="ts">
import { Eye, PencilLine, SquarePen, Tag, Trash2 } from 'lucide-vue-next'

import type { BlogPost } from '@/types/blog'

const props = defineProps<{
  filteredPosts: BlogPost[]
  selectedPostIds: string[]
  selectedCount: number
  allFilteredSelected: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  'toggle-select-all': []
  'toggle-select': [postId: string]
  'delete-selected': []
  'open-preview': [post: BlogPost]
  'open-edit': [post: BlogPost]
  'delete-post': [postId: string]
}>()

const isSelected = (postId: string) => props.selectedPostIds.includes(postId)
</script>

<template>
  <section v-if="filteredPosts.length > 0" class="admin-content-selection">
    <label>
      <input :checked="allFilteredSelected" type="checkbox" @change="emit('toggle-select-all')" />
      <span>当前筛选全选</span>
    </label>

    <Transition name="admin-soft-fade">
      <div v-if="selectedCount > 0" class="admin-content-bulk">
        <span>已选 {{ selectedCount }} 篇</span>
        <button
          type="button"
          class="admin-action-btn icon-host"
          :disabled="saving"
          @click="emit('delete-selected')"
        >
          <Trash2 class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
          <span>批量删除</span>
        </button>
      </div>
    </Transition>
  </section>

  <TransitionGroup v-if="filteredPosts.length > 0" name="admin-list-shift" tag="ul" class="admin-content-list">
    <li
      v-for="post in filteredPosts"
      :key="post.id"
      class="admin-content-card"
      :class="{ 'admin-content-card--selected': isSelected(post.id) }"
    >
      <header class="admin-content-card__head">
        <label class="admin-content-card__check">
          <input :checked="isSelected(post.id)" type="checkbox" @change="emit('toggle-select', post.id)" />
        </label>
        <div>
          <h3>{{ post.title }}</h3>
          <p>{{ post.summary }}</p>
        </div>
        <small v-if="post.highlight" class="admin-content-card__badge">{{ post.highlight }}</small>
      </header>

      <ul class="admin-content-card__meta">
        <li>{{ post.category }}</li>
        <li>{{ post.publishedAt }}</li>
        <li>{{ post.readingMinutes }} min</li>
        <li>{{ post.comments ?? 0 }} 评论</li>
        <li>{{ post.views ?? 0 }} 阅读</li>
      </ul>

      <div class="admin-content-card__tags">
        <span v-for="tagItem in post.tags" :key="`${post.id}-${tagItem}`">
          <Tag class="icon icon--xs icon--stroke-strong" aria-hidden="true" />
          #{{ tagItem }}
        </span>
      </div>

      <footer class="admin-content-card__actions">
        <button type="button" class="admin-action-btn icon-host" @click="emit('open-preview', post)">
          <Eye class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
          <span>预览编辑</span>
        </button>
        <button type="button" class="admin-action-btn icon-host" @click="emit('open-edit', post)">
          <SquarePen class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
          <span>编辑</span>
        </button>
        <button
          type="button"
          class="admin-action-btn admin-action-btn--danger icon-host"
          :disabled="saving"
          @click="emit('delete-post', post.id)"
        >
          <Trash2 class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
          <span>删除</span>
        </button>
      </footer>
    </li>
  </TransitionGroup>

  <article v-else class="admin-empty-card">
    <PencilLine class="icon icon--lg icon--stroke-strong" aria-hidden="true" />
    <h3>当前筛选没有结果</h3>
    <p>调整筛选条件或新建一篇文章。</p>
  </article>
</template>
