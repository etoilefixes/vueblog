<script setup lang="ts">
import { Search, Tag, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'

interface TagUsageRecord {
  tag: string
  count: number
}

const props = defineProps<{
  editorOpen: boolean
  selectedCount: number
  tagManagePending: boolean
  tagQuickAdd: string
  tagRenameSource: string
  tagRenameTarget: string
  tagDeleteTarget: string
  tagSearch: string
  tagUsageRecords: TagUsageRecord[]
  filteredTagUsageRecords: TagUsageRecord[]
}>()

const emit = defineEmits<{
  'update:tagQuickAdd': [value: string]
  'update:tagRenameSource': [value: string]
  'update:tagRenameTarget': [value: string]
  'update:tagDeleteTarget': [value: string]
  'update:tagSearch': [value: string]
  'add-selected': []
  'append-current': []
  'rename-global': []
  'delete-global': []
}>()

const tagQuickAddModel = computed({
  get: () => props.tagQuickAdd,
  set: (value: string) => emit('update:tagQuickAdd', value),
})

const tagRenameSourceModel = computed({
  get: () => props.tagRenameSource,
  set: (value: string) => emit('update:tagRenameSource', value),
})

const tagRenameTargetModel = computed({
  get: () => props.tagRenameTarget,
  set: (value: string) => emit('update:tagRenameTarget', value),
})

const tagDeleteTargetModel = computed({
  get: () => props.tagDeleteTarget,
  set: (value: string) => emit('update:tagDeleteTarget', value),
})

const tagSearchModel = computed({
  get: () => props.tagSearch,
  set: (value: string) => emit('update:tagSearch', value),
})
</script>

<template>
  <section class="admin-tag-manager">
    <header>
      <h3>标签管理</h3>
      <small>支持批量重命名、删除和给选中文章打标签。</small>
    </header>

    <div class="admin-tag-manager__actions">
      <label class="admin-field">
        <span>新增标签（应用到选中文章）</span>
        <input v-model="tagQuickAddModel" type="text" maxlength="40" placeholder="例如：Vue3" />
      </label>
      <button
        type="button"
        class="admin-action-btn icon-host"
        :disabled="tagManagePending || selectedCount === 0"
        @click="emit('add-selected')"
      >
        <Tag class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
        <span>应用到已选</span>
      </button>
      <button
        type="button"
        class="admin-action-btn icon-host"
        :disabled="!editorOpen || !tagQuickAdd.trim()"
        @click="emit('append-current')"
      >
        <Tag class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
        <span>加入当前编辑器</span>
      </button>
    </div>

    <div class="admin-tag-manager__actions">
      <label class="admin-field">
        <span>重命名标签</span>
        <select v-model="tagRenameSourceModel" class="admin-select">
          <option v-for="item in tagUsageRecords" :key="`rename-${item.tag}`" :value="item.tag">
            #{{ item.tag }}（{{ item.count }}）
          </option>
        </select>
      </label>
      <label class="admin-field">
        <span>新标签名</span>
        <input v-model="tagRenameTargetModel" type="text" maxlength="40" placeholder="输入新名称" />
      </label>
      <button
        type="button"
        class="admin-action-btn icon-host"
        :disabled="tagManagePending || !tagRenameSource || !tagRenameTarget.trim()"
        @click="emit('rename-global')"
      >
        <span>全局重命名</span>
      </button>
    </div>

    <div class="admin-tag-manager__actions">
      <label class="admin-field">
        <span>删除标签</span>
        <select v-model="tagDeleteTargetModel" class="admin-select">
          <option v-for="item in tagUsageRecords" :key="`delete-${item.tag}`" :value="item.tag">
            #{{ item.tag }}（{{ item.count }}）
          </option>
        </select>
      </label>
      <button
        type="button"
        class="admin-action-btn admin-action-btn--danger icon-host"
        :disabled="tagManagePending || !tagDeleteTarget"
        @click="emit('delete-global')"
      >
        <Trash2 class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
        <span>全局删除</span>
      </button>
    </div>

    <label class="admin-input-wrap admin-input-wrap--search">
      <Search class="icon icon--sm icon--stroke-strong" aria-hidden="true" />
      <input v-model="tagSearchModel" type="search" placeholder="搜索标签..." />
    </label>

    <ul v-if="filteredTagUsageRecords.length > 0" class="admin-tag-manager__list">
      <li v-for="item in filteredTagUsageRecords" :key="item.tag">
        <span>#{{ item.tag }}</span>
        <small>{{ item.count }} 篇</small>
      </li>
    </ul>
    <p v-else class="admin-page__hint">当前没有可管理的标签。</p>
  </section>
</template>
