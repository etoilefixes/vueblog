<script setup lang="ts">
const props = defineProps<{
  keyword: string
  tags: string[]
  activeTag: string
  resultCount: number
}>()

const emit = defineEmits<{
  (event: 'update-keyword', value: string): void
  (event: 'update-tag', value: string): void
  (event: 'clear'): void
}>()

const onInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update-keyword', target.value)
}
</script>

<template>
  <section class="blog-filters" aria-label="文章筛选">
    <div class="blog-filters__head">
      <label class="blog-filters__input-wrap">
        <span class="blog-filters__search">关键词搜索</span>
        <input
          class="blog-filters__input"
          type="search"
          :value="props.keyword"
          placeholder="输入标题、标签或分类"
          @input="onInput"
        />
      </label>
      <p class="blog-filters__count">当前命中 {{ props.resultCount }} 篇</p>
    </div>

    <div class="blog-filters__actions">
      <button
        v-for="tag in props.tags"
        :key="tag"
        type="button"
        class="blog-filters__tag"
        :class="{ 'blog-filters__tag--active': tag === props.activeTag }"
        @click="emit('update-tag', tag)"
      >
        {{ tag }}
      </button>
      <button type="button" class="blog-filters__clear" @click="emit('clear')">
        重置
      </button>
    </div>
  </section>
</template>
