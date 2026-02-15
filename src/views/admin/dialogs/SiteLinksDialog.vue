<script setup lang="ts">
import { FilePlus2, X } from 'lucide-vue-next'
import { computed } from 'vue'

import AdminDialog from '@/components/admin/AdminDialog.vue'
import type { FriendLink } from '@/types/blog'

interface Props {
  links: FriendLink[]
  loading?: boolean
  error?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:links': [links: FriendLink[]]
  save: []
  cancel: []
}>()

const updateLinks = (links: FriendLink[]) => {
  emit('update:links', links)
}

const addLink = () => {
  const newLink: FriendLink = {
    id: `link-${Date.now()}`,
    name: '',
    url: '',
    description: '',
    tags: [],
  }
  updateLinks([...props.links, newLink])
}

const removeLink = (index: number) => {
  updateLinks(props.links.filter((_, i) => i !== index))
}

const updateLink = (index: number, field: keyof FriendLink, value: string | string[]) => {
  const newLinks = props.links.map((link, i) =>
    i === index ? { ...link, [field]: value } : link
  )
  updateLinks(newLinks)
}

const parseTags = (value: string): string[] => {
  return value
    .split(/[,，]/)
    .map(t => t.trim())
    .filter(Boolean)
}

const formatTags = (tags: string[]): string => {
  return tags.join(', ')
}

const validateAndSave = () => {
  // 验证所有链接都有必填字段
  for (const link of props.links) {
    if (!link.id.trim() || !link.name.trim() || !link.url.trim() || !link.description.trim()) {
      return
    }
  }

  // 验证ID唯一性
  const ids = props.links.map(l => l.id)
  if (new Set(ids).size !== ids.length) {
    return
  }

  emit('save')
}
</script>

<template>
  <AdminDialog
    :open="true"
    title="编辑友情链接"
    :description="error"
    confirm-text="保存"
    cancel-text="取消"
    :loading="loading"
    :show-cancel="true"
    @confirm="validateAndSave"
    @cancel="$emit('cancel')"
    @close="$emit('cancel')"
  >
    <div class="form-container">
      <div class="dialog-header-actions">
        <button type="button" class="admin-action-btn icon-host" @click="addLink">
          <FilePlus2 class="icon icon--sm" aria-hidden="true" />
          添加友链
        </button>
      </div>

      <div class="links-list">
        <article
          v-for="(link, index) in links"
          :key="`link-${index}`"
          class="link-item"
        >
          <div class="link-item__header">
            <span class="link-number">#{{ index + 1 }}</span>
            <button
              type="button"
              class="btn-remove"
              @click="removeLink(index)"
            >
              <X class="icon icon--xs" aria-hidden="true" />
            </button>
          </div>

          <div class="link-item__fields">
            <label class="admin-field">
              <span>ID *</span>
              <input
                :value="link.id"
                type="text"
                placeholder="unique-id"
                @input="updateLink(index, 'id', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label class="admin-field">
              <span>名称 *</span>
              <input
                :value="link.name"
                type="text"
                placeholder="站点名称"
                @input="updateLink(index, 'name', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label class="admin-field admin-field--full">
              <span>链接 *</span>
              <input
                :value="link.url"
                type="url"
                placeholder="https://example.com"
                @input="updateLink(index, 'url', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label class="admin-field admin-field--full">
              <span>描述 *</span>
              <input
                :value="link.description"
                type="text"
                placeholder="站点描述"
                @input="updateLink(index, 'description', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label class="admin-field admin-field--full">
              <span>标签</span>
              <input
                :value="formatTags(link.tags)"
                type="text"
                placeholder="标签1, 标签2, 标签3"
                @input="updateLink(index, 'tags', parseTags(($event.target as HTMLInputElement).value))"
              />
            </label>
          </div>
        </article>

        <div v-if="links.length === 0" class="empty-state">
          <p>暂无友链，点击上方按钮添加</p>
        </div>
      </div>
    </div>
  </AdminDialog>
</template>

<style scoped>
.form-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.dialog-header-actions {
  display: flex;
  justify-content: flex-end;
}

.links-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.link-item {
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  border: 1px solid var(--admin-border);
  background: var(--admin-surface);
}

.link-item__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.link-number {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--admin-text-muted);
}

.link-item__fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

.btn-remove {
  width: 32px;
  height: 32px;
  border: 1px solid var(--admin-border);
  border-radius: var(--radius-md);
  background: var(--admin-surface);
  color: var(--admin-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.btn-remove:hover {
  border-color: var(--admin-danger);
  color: var(--admin-danger);
  background: var(--admin-danger-light);
}

.empty-state {
  text-align: center;
  padding: var(--space-xl);
  color: var(--admin-text-muted);
}

@media (max-width: 600px) {
  .link-item__fields {
    grid-template-columns: 1fr;
  }
}
</style>
