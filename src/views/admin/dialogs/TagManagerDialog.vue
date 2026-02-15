<script setup lang="ts">
import { FilePlus2, Pencil, Search, Tag, Trash2, X } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import AdminDialog from '@/components/admin/AdminDialog.vue'

interface TagUsageRecord {
  tag: string
  count: number
}

interface Props {
  open: boolean
  editorOpen: boolean
  selectedCount: number
  tagManagePending: boolean
  tagUsageRecords: TagUsageRecord[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'add-selected': [tag: string]
  'append-current': [tag: string]
  'rename-global': [source: string, target: string]
  'delete-global': [tag: string]
}>()

// 本地状态
const activeTab = ref<'list' | 'add' | 'rename' | 'delete'>('list')
const tagSearch = ref('')
const tagQuickAdd = ref('')
const tagRenameSource = ref('')
const tagRenameTarget = ref('')
const tagDeleteTarget = ref('')

// 过滤后的标签列表
const filteredTags = computed(() => {
  if (!tagSearch.value.trim()) return props.tagUsageRecords
  const search = tagSearch.value.toLowerCase()
  return props.tagUsageRecords.filter(item => 
    item.tag.toLowerCase().includes(search)
  )
})

// 关闭弹窗
const handleClose = () => {
  emit('update:open', false)
  resetForm()
}

// 重置表单
const resetForm = () => {
  activeTab.value = 'list'
  tagSearch.value = ''
  tagQuickAdd.value = ''
  tagRenameSource.value = ''
  tagRenameTarget.value = ''
  tagDeleteTarget.value = ''
}

// 添加标签到选中文章
const handleAddToSelected = () => {
  if (!tagQuickAdd.value.trim()) return
  emit('add-selected', tagQuickAdd.value.trim())
  tagQuickAdd.value = ''
}

// 添加到当前编辑器
const handleAppendToCurrent = () => {
  if (!tagQuickAdd.value.trim()) return
  emit('append-current', tagQuickAdd.value.trim())
  tagQuickAdd.value = ''
}

// 重命名标签
const handleRename = () => {
  if (!tagRenameSource.value || !tagRenameTarget.value.trim()) return
  emit('rename-global', tagRenameSource.value, tagRenameTarget.value.trim())
  tagRenameSource.value = ''
  tagRenameTarget.value = ''
  activeTab.value = 'list'
}

// 删除标签
const handleDelete = () => {
  if (!tagDeleteTarget.value) return
  emit('delete-global', tagDeleteTarget.value)
  tagDeleteTarget.value = ''
  activeTab.value = 'list'
}

// 删除确认
const confirmDelete = () => {
  if (!tagDeleteTarget.value) return
  const record = props.tagUsageRecords.find(r => r.tag === tagDeleteTarget.value)
  if (record && confirm(`确定要删除标签 "#${record.tag}" 吗？这将会从 ${record.count} 篇文章中移除该标签。`)) {
    handleDelete()
  }
}
</script>

<template>
  <AdminDialog
    :open="open"
    title="标签管理"
    :description="tagManagePending ? '正在处理...' : undefined"
    :confirm-text="activeTab === 'delete' ? '删除' : '关闭'"
    :cancel-text="activeTab === 'list' ? '关闭' : '返回'"
    :show-cancel="true"
    :loading="tagManagePending"
    :type="activeTab === 'delete' ? 'danger' : 'info'"
    @confirm="activeTab === 'delete' ? confirmDelete() : handleClose()"
    @cancel="activeTab === 'list' ? handleClose() : activeTab = 'list'"
    @close="handleClose"
  >
    <div class="tag-manager-dialog">
      <!-- 标签列表视图 -->
      <template v-if="activeTab === 'list'">
        <div class="tab-buttons">
          <button 
            type="button" 
            class="tab-btn"
            :disabled="selectedCount === 0"
            @click="activeTab = 'add'"
          >
            <FilePlus2 class="icon icon--sm" />
            <span>添加标签</span>
            <small v-if="selectedCount > 0">({{ selectedCount }}篇选中)</small>
          </button>
          <button type="button" class="tab-btn" @click="activeTab = 'rename'">
            <Pencil class="icon icon--sm" />
            <span>重命名</span>
          </button>
          <button type="button" class="tab-btn tab-btn--danger" @click="activeTab = 'delete'">
            <Trash2 class="icon icon--sm" />
            <span>删除标签</span>
          </button>
        </div>

        <div class="search-box">
          <Search class="icon icon--sm" aria-hidden="true" />
          <input 
            v-model="tagSearch" 
            type="search" 
            placeholder="搜索标签..."
          />
        </div>

        <div class="tags-grid">
          <article 
            v-for="item in filteredTags" 
            :key="item.tag"
            class="tag-card"
          >
            <div class="tag-info">
              <span class="tag-name">#{{ item.tag }}</span>
              <span class="tag-count">{{ item.count }} 篇文章</span>
            </div>
            <div class="tag-actions">
              <button 
                type="button" 
                class="btn-icon"
                :disabled="tagManagePending || !editorOpen"
                @click="$emit('append-current', item.tag)"
                title="添加到当前编辑器"
              >
                <FilePlus2 class="icon icon--xs" />
              </button>
            </div>
          </article>
        </div>

        <p v-if="filteredTags.length === 0" class="empty-text">
          {{ tagSearch ? '未找到匹配的标签' : '暂无标签' }}
        </p>
      </template>

      <!-- 添加标签视图 -->
      <template v-if="activeTab === 'add'">
        <div class="form-section">
          <h4>添加新标签</h4>
          <label class="field-row">
            <span>标签名称</span>
            <input 
              v-model="tagQuickAdd" 
              type="text" 
              maxlength="40" 
              placeholder="输入标签名称"
              @keyup.enter="handleAddToSelected"
            />
          </label>
          <div class="action-row">
            <button 
              type="button" 
              class="btn-primary"
              :disabled="tagManagePending || selectedCount === 0 || !tagQuickAdd.trim()"
              @click="handleAddToSelected"
            >
              <Tag class="icon icon--sm" />
              应用到 {{ selectedCount }} 篇选中文章
            </button>
            <button 
              type="button" 
              class="btn-secondary"
              :disabled="tagManagePending || !editorOpen || !tagQuickAdd.trim()"
              @click="handleAppendToCurrent"
            >
              加入当前编辑器
            </button>
          </div>
        </div>
      </template>

      <!-- 重命名视图 -->
      <template v-if="activeTab === 'rename'">
        <div class="form-section">
          <h4>重命名标签</h4>
          <label class="field-row">
            <span>选择标签</span>
            <select v-model="tagRenameSource">
              <option value="">请选择</option>
              <option v-for="item in tagUsageRecords" :key="item.tag" :value="item.tag">
                #{{ item.tag }} ({{ item.count }}篇)
              </option>
            </select>
          </label>
          <label class="field-row">
            <span>新名称</span>
            <input 
              v-model="tagRenameTarget" 
              type="text" 
              maxlength="40" 
              placeholder="输入新标签名称"
              @keyup.enter="handleRename"
            />
          </label>
          <div class="action-row">
            <button 
              type="button" 
              class="btn-primary"
              :disabled="tagManagePending || !tagRenameSource || !tagRenameTarget.trim()"
              @click="handleRename"
            >
              <Pencil class="icon icon--sm" />
              全局重命名
            </button>
          </div>
        </div>
      </template>

      <!-- 删除视图 -->
      <template v-if="activeTab === 'delete'">
        <div class="form-section">
          <h4>删除标签</h4>
          <p class="warning-text">
            <Trash2 class="icon icon--sm" />
            删除后将无法恢复，标签会从所有文章中移除
          </p>
          <label class="field-row">
            <span>选择要删除的标签</span>
            <select v-model="tagDeleteTarget">
              <option value="">请选择</option>
              <option v-for="item in tagUsageRecords" :key="item.tag" :value="item.tag">
                #{{ item.tag }} ({{ item.count }}篇)
              </option>
            </select>
          </label>
          <div v-if="tagDeleteTarget" class="delete-preview">
            <strong>即将删除：</strong>
            <span class="tag-badge">#{{ tagDeleteTarget }}</span>
            <span>将从 {{ tagUsageRecords.find(r => r.tag === tagDeleteTarget)?.count }} 篇文章中移除</span>
          </div>
        </div>
      </template>
    </div>
  </AdminDialog>
</template>

<style scoped>
.tag-manager-dialog {
  min-width: 480px;
  max-width: 600px;
}

/* 标签列表样式 */
.tab-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.tab-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-md);
  border: 1px solid var(--admin-border);
  border-radius: var(--radius-lg);
  background: var(--admin-surface);
  color: var(--admin-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab-btn:hover:not(:disabled) {
  border-color: var(--admin-primary);
  background: rgba(99, 102, 241, 0.05);
  color: var(--admin-primary);
}

.tab-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tab-btn--danger:hover {
  border-color: var(--admin-danger);
  background: var(--admin-danger-light);
  color: var(--admin-danger);
}

.tab-btn .icon {
  width: 20px;
  height: 20px;
}

.tab-btn span {
  font-size: 0.9rem;
  font-weight: 500;
}

.tab-btn small {
  font-size: 0.75rem;
  color: var(--admin-text-muted);
}

/* 搜索框 */
.search-box {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--admin-border);
  border-radius: var(--radius-lg);
  background: var(--admin-surface);
  margin-bottom: var(--space-md);
}

.search-box input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  outline: none;
}

/* 标签网格 */
.tags-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-sm);
  max-height: 300px;
  overflow-y: auto;
}

.tag-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--admin-border);
  border-radius: var(--radius-md);
  background: var(--admin-surface);
  transition: all var(--transition-fast);
}

.tag-card:hover {
  border-color: var(--admin-primary);
  background: rgba(99, 102, 241, 0.05);
}

.tag-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tag-name {
  font-weight: 600;
  color: var(--admin-text-primary);
}

.tag-count {
  font-size: 0.8rem;
  color: var(--admin-text-muted);
}

.tag-actions {
  display: flex;
  gap: var(--space-xs);
}

.btn-icon {
  width: 28px;
  height: 28px;
  border: 1px solid var(--admin-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--admin-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.btn-icon:hover:not(:disabled) {
  border-color: var(--admin-primary);
  color: var(--admin-primary);
}

/* 表单样式 */
.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.form-section h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--admin-text-primary);
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.field-row span {
  font-size: 0.9rem;
  color: var(--admin-text-secondary);
}

.field-row input,
.field-row select {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--admin-border);
  border-radius: var(--radius-md);
  background: var(--admin-surface);
  font-size: 0.95rem;
  outline: none;
  transition: border-color var(--transition-fast);
}

.field-row input:focus,
.field-row select:focus {
  border-color: var(--admin-primary);
}

.action-row {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary {
  border: 1px solid var(--admin-primary);
  background: var(--admin-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--admin-primary-hover, #5558e3);
}

.btn-secondary {
  border: 1px solid var(--admin-border);
  background: var(--admin-surface);
  color: var(--admin-text-secondary);
}

.btn-secondary:hover:not(:disabled) {
  border-color: var(--admin-primary);
  color: var(--admin-primary);
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 删除警告 */
.warning-text {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  border-radius: var(--radius-md);
  background: var(--admin-danger-light);
  color: var(--admin-danger);
  font-size: 0.9rem;
  margin: 0;
}

.delete-preview {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  border: 1px dashed var(--admin-danger);
  border-radius: var(--radius-md);
  background: var(--admin-danger-light);
}

.tag-badge {
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--admin-danger);
  color: white;
  font-size: 0.85rem;
  font-weight: 500;
}

.empty-text {
  text-align: center;
  padding: var(--space-xl);
  color: var(--admin-text-muted);
}

@media (max-width: 560px) {
  .tag-manager-dialog {
    min-width: auto;
  }
  
  .tab-buttons {
    grid-template-columns: 1fr;
  }
  
  .tab-btn {
    flex-direction: row;
    justify-content: center;
  }
  
  .tags-grid {
    grid-template-columns: 1fr;
  }
}
</style>
