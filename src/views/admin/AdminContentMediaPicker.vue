<script setup lang="ts">
import { Search, X } from 'lucide-vue-next'
import { computed } from 'vue'

import type { AdminMediaItem } from '@/types/admin'

const props = defineProps<{
  open: boolean
  keyword: string
  loading: boolean
  error: string
  items: AdminMediaItem[]
}>()

const emit = defineEmits<{
  close: []
  'update:keyword': [value: string]
  insert: [item: AdminMediaItem]
}>()

const keywordModel = computed({
  get: () => props.keyword,
  set: (value: string) => emit('update:keyword', value),
})
</script>

<template>
  <Teleport to="body">
    <Transition name="admin-float-panel">
      <div v-if="open" class="admin-float-overlay admin-float-overlay--center" @click.self="emit('close')">
        <section class="admin-media-picker">
          <header>
            <div>
              <p>MEDIA PICKER</p>
              <h4>插入图片</h4>
            </div>
            <button type="button" class="admin-shell__mobile-close icon-host" aria-label="关闭" @click="emit('close')">
              <X class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
            </button>
          </header>

          <label class="admin-input-wrap admin-input-wrap--search">
            <Search class="icon icon--sm icon--stroke-strong" aria-hidden="true" />
            <input v-model="keywordModel" type="search" placeholder="搜索图片名称、URL..." />
          </label>

          <p v-if="loading" class="admin-page__hint">图片加载中...</p>
          <p v-if="error" class="admin-page__hint admin-page__hint--warn">{{ error }}</p>

          <ul v-if="items.length > 0" class="admin-media-picker__list">
            <li v-for="item in items" :key="item.id">
              <div class="admin-media-picker__thumb">
                <img :src="item.url" :alt="item.name" loading="lazy" />
              </div>
              <div class="admin-media-picker__meta">
                <strong>{{ item.name }}</strong>
                <span>{{ item.url }}</span>
              </div>
              <button type="button" class="admin-action-btn admin-action-btn--strong icon-host" @click="emit('insert', item)">
                <span>插入</span>
              </button>
            </li>
          </ul>
          <p v-else-if="!loading" class="admin-page__hint">没有匹配的图片资源。</p>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
