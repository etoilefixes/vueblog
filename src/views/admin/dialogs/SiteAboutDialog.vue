<script setup lang="ts">
import { FilePlus2, GripVertical, X } from 'lucide-vue-next'
import { computed } from 'vue'

import AdminDialog from '@/components/admin/AdminDialog.vue'
import type { AboutSection } from '@/types/blog'

interface Props {
  sections: AboutSection[]
  loading?: boolean
  error?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:sections': [sections: AboutSection[]]
  save: []
  cancel: []
}>()

const updateSections = (sections: AboutSection[]) => {
  emit('update:sections', sections)
}

const addSection = () => {
  const newSection = {
    id: `section-${Date.now()}`,
    title: '',
    content: '',
  }
  updateSections([...props.sections, newSection])
}

const removeSection = (index: number) => {
  updateSections(props.sections.filter((_, i) => i !== index))
}

const updateSection = (index: number, field: keyof AboutSection, value: string) => {
  const newSections = props.sections.map((section, i) =>
    i === index ? { ...section, [field]: value } : section
  )
  updateSections(newSections)
}

const moveSection = (index: number, direction: -1 | 1) => {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= props.sections.length) return

  const newSections = [...props.sections]
  const current = newSections[index]!
  const target = newSections[newIndex]!
  newSections[index] = target
  newSections[newIndex] = current
  updateSections(newSections)
}

const validateAndSave = () => {
  // 验证所有区块都有必填字段
  for (const section of props.sections) {
    if (!section.id.trim() || !section.title.trim() || !section.content.trim()) {
      return
    }
  }

  // 验证ID唯一性
  const ids = props.sections.map(s => s.id)
  if (new Set(ids).size !== ids.length) {
    return
  }

  emit('save')
}
</script>

<template>
  <AdminDialog
    :open="true"
    title="编辑关于页面"
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
        <button type="button" class="admin-action-btn icon-host" @click="addSection">
          <FilePlus2 class="icon icon--sm" aria-hidden="true" />
          添加区块
        </button>
      </div>

      <div class="sections-list">
        <article
          v-for="(section, index) in sections"
          :key="`section-${index}`"
          class="section-item"
        >
          <div class="section-item__header">
            <div class="section-drag">
              <GripVertical class="icon icon--sm" aria-hidden="true" />
              <span class="section-number">#{{ index + 1 }}</span>
            </div>
            <div class="section-actions">
              <button
                type="button"
                class="btn-move"
                :disabled="index === 0"
                @click="moveSection(index, -1)"
              >
                ↑
              </button>
              <button
                type="button"
                class="btn-move"
                :disabled="index === sections.length - 1"
                @click="moveSection(index, 1)"
              >
                ↓
              </button>
              <button
                type="button"
                class="btn-remove"
                @click="removeSection(index)"
              >
                <X class="icon icon--xs" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div class="section-item__fields">
            <label class="admin-field">
              <span>区块 ID *</span>
              <input
                :value="section.id"
                type="text"
                placeholder="unique-id"
                @input="updateSection(index, 'id', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label class="admin-field">
              <span>标题 *</span>
              <input
                :value="section.title"
                type="text"
                placeholder="区块标题"
                @input="updateSection(index, 'title', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label class="admin-field admin-field--full">
              <span>内容 *</span>
              <textarea
                :value="section.content"
                rows="4"
                placeholder="支持 Markdown 格式"
                @input="updateSection(index, 'content', ($event.target as HTMLTextAreaElement).value)"
              />
            </label>
          </div>
        </article>

        <div v-if="sections.length === 0" class="empty-state">
          <p>暂无内容区块，点击上方按钮添加</p>
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

.sections-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.section-item {
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  border: 1px solid var(--admin-border);
  background: var(--admin-surface);
}

.section-item__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.section-drag {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--admin-text-muted);
}

.section-number {
  font-size: 0.85rem;
  font-weight: 600;
}

.section-actions {
  display: flex;
  gap: var(--space-xs);
}

.btn-move,
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

.btn-move:hover:not(:disabled) {
  border-color: var(--admin-primary);
  color: var(--admin-primary);
  background: rgba(99, 102, 241, 0.1);
}

.btn-move:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-remove:hover {
  border-color: var(--admin-danger);
  color: var(--admin-danger);
  background: var(--admin-danger-light);
}

.section-item__fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.empty-state {
  text-align: center;
  padding: var(--space-xl);
  color: var(--admin-text-muted);
}

@media (max-width: 480px) {
  .section-actions {
    gap: 2px;
  }
  
  .btn-move,
  .btn-remove {
    width: 28px;
    height: 28px;
  }
}
</style>
