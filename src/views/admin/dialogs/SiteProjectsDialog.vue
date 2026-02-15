<script setup lang="ts">
import { FilePlus2, GripVertical, X } from 'lucide-vue-next'
import { computed } from 'vue'

import AdminDialog from '@/components/admin/AdminDialog.vue'
import type { CustomProject } from '@/types/blog'

interface Props {
  projects: CustomProject[]
  loading?: boolean
  error?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:projects': [projects: CustomProject[]]
  save: []
  cancel: []
}>()

const updateProjects = (projects: CustomProject[]) => {
  emit('update:projects', projects)
}

const addProject = () => {
  const newProject = {
    id: `project-${Date.now()}`,
    name: '',
    status: '',
    summary: '',
    techStack: [] as string[],
  }
  updateProjects([...props.projects, newProject])
}

const removeProject = (index: number) => {
  updateProjects(props.projects.filter((_, i) => i !== index))
}

const updateProject = (index: number, field: keyof CustomProject, value: string | string[]) => {
  const newProjects = props.projects.map((project, i) =>
    i === index ? { ...project, [field]: value } : project
  )
  updateProjects(newProjects)
}

const moveProject = (index: number, direction: -1 | 1) => {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= props.projects.length) return

  const newProjects = [...props.projects]
  const current = newProjects[index]!
  const target = newProjects[newIndex]!
  newProjects[index] = target
  newProjects[newIndex] = current
  updateProjects(newProjects)
}

const parseTechStack = (value: string): string[] => {
  return value
    .split(/[,，]/)
    .map(t => t.trim())
    .filter(Boolean)
}

const formatTechStack = (stack: string[]): string => {
  return stack.join(', ')
}

const validateAndSave = () => {
  // 验证所有项目都有必填字段
  for (const project of props.projects) {
    if (!project.id.trim() || !project.name.trim() || !project.status.trim() || !project.summary.trim()) {
      return
    }
  }

  // 验证ID唯一性
  const ids = props.projects.map(p => p.id)
  if (new Set(ids).size !== ids.length) {
    return
  }

  emit('save')
}
</script>

<template>
  <AdminDialog
    :open="true"
    title="编辑项目展示"
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
        <button type="button" class="admin-action-btn icon-host" @click="addProject">
          <FilePlus2 class="icon icon--sm" aria-hidden="true" />
          添加项目
        </button>
      </div>

      <div class="projects-list">
        <article
          v-for="(project, index) in projects"
          :key="`project-${index}`"
          class="project-item"
        >
          <div class="project-item__header">
            <div class="project-drag">
              <GripVertical class="icon icon--sm" aria-hidden="true" />
              <span class="project-number">#{{ index + 1 }}</span>
            </div>
            <div class="project-actions">
              <button
                type="button"
                class="btn-move"
                :disabled="index === 0"
                @click="moveProject(index, -1)"
              >
                ↑
              </button>
              <button
                type="button"
                class="btn-move"
                :disabled="index === projects.length - 1"
                @click="moveProject(index, 1)"
              >
                ↓
              </button>
              <button
                type="button"
                class="btn-remove"
                @click="removeProject(index)"
              >
                <X class="icon icon--xs" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div class="project-item__fields">
            <label class="admin-field">
              <span>项目 ID *</span>
              <input
                :value="project.id"
                type="text"
                placeholder="unique-id"
                @input="updateProject(index, 'id', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label class="admin-field">
              <span>项目名称 *</span>
              <input
                :value="project.name"
                type="text"
                placeholder="项目名称"
                @input="updateProject(index, 'name', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label class="admin-field">
              <span>状态 *</span>
              <input
                :value="project.status"
                type="text"
                placeholder="进行中 / 已完成 / 维护中"
                @input="updateProject(index, 'status', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label class="admin-field admin-field--full">
              <span>简介 *</span>
              <textarea
                :value="project.summary"
                rows="3"
                placeholder="项目简介"
                @input="updateProject(index, 'summary', ($event.target as HTMLTextAreaElement).value)"
              />
            </label>
            <label class="admin-field admin-field--full">
              <span>技术栈</span>
              <input
                :value="formatTechStack(project.techStack)"
                type="text"
                placeholder="Vue, TypeScript, Node.js"
                @input="updateProject(index, 'techStack', parseTechStack(($event.target as HTMLInputElement).value))"
              />
            </label>
          </div>
        </article>

        <div v-if="projects.length === 0" class="empty-state">
          <p>暂无项目，点击上方按钮添加</p>
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

.projects-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.project-item {
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  border: 1px solid var(--admin-border);
  background: var(--admin-surface);
}

.project-item__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.project-drag {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--admin-text-muted);
}

.project-number {
  font-size: 0.85rem;
  font-weight: 600;
}

.project-actions {
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

.project-item__fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

.empty-state {
  text-align: center;
  padding: var(--space-xl);
  color: var(--admin-text-muted);
}

@media (max-width: 600px) {
  .project-item__fields {
    grid-template-columns: 1fr;
  }
  
  .project-actions {
    gap: 2px;
  }
  
  .btn-move,
  .btn-remove {
    width: 28px;
    height: 28px;
  }
}
</style>
