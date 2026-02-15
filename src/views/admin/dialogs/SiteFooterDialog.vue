<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import AdminDialog from '@/components/admin/AdminDialog.vue'
import { DEFAULT_RUNTIME_TEMPLATE, normalizeRuntimeTemplate } from '@/services/runtime-template'
import type { SiteFooterInfo } from '@/types/blog'

interface Props {
  footer: SiteFooterInfo
  loading?: boolean
  error?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:footer': [footer: SiteFooterInfo]
  save: []
  cancel: []
}>()

const runtimeTokenOptions = ['{days}', '{hours}', '{minutes}', '{seconds}']

// 本地编辑状态
const localFooter = computed({
  get: () => props.footer,
  set: (value) => emit('update:footer', value),
})

const updateField = <K extends keyof SiteFooterInfo>(field: K, value: SiteFooterInfo[K]) => {
  emit('update:footer', { ...props.footer, [field]: value })
}

const formatDateTimeLocal = (iso: string): string => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

const toIsoFromDateTimeLocal = (value: string): string => {
  if (!value) return ''
  try {
    return new Date(value).toISOString()
  } catch {
    return ''
  }
}

const validateAndSave = () => {
  // 验证必填字段
  if (!props.footer.icp.trim()) {
    return
  }
  if (!props.footer.poweredBy.trim()) {
    return
  }
  if (!props.footer.copyright.trim()) {
    return
  }

  // 验证锁定备案
  if (props.footer.icpLocked && !(props.footer.icpLink || '').trim()) {
    return
  }

  // 验证运行时间模式
  if (props.footer.runtimeMode === 'manual' && !props.footer.runtime.trim()) {
    return
  }
  if (props.footer.runtimeMode === 'auto' && !props.footer.runtimeStartedAt) {
    return
  }

  emit('save')
}

const insertRuntimeToken = (token: string) => {
  const current = props.footer.runtime || DEFAULT_RUNTIME_TEMPLATE
  updateField('runtime', current + token)
}
</script>

<template>
  <AdminDialog
    :open="true"
    title="编辑页脚配置"
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
      <section class="form-section">
        <h4>备案信息</h4>
        <label class="admin-field">
          <span>备案号 *</span>
          <input
            :value="footer.icp"
            type="text"
            @input="updateField('icp', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="admin-field">
          <span>备案链接</span>
          <input
            :value="footer.icpLink"
            type="text"
            placeholder="https://beian.miit.gov.cn/"
            @input="updateField('icpLink', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="admin-field admin-field--checkbox">
          <input
            :checked="footer.icpLocked"
            type="checkbox"
            @change="updateField('icpLocked', ($event.target as HTMLInputElement).checked)"
          />
          <span>锁定备案信息（前台不可编辑）</span>
        </label>
      </section>

      <section class="form-section">
        <h4>运行时间</h4>
        <div class="radio-group">
          <label class="radio-label">
            <input
              type="radio"
              value="manual"
              :checked="footer.runtimeMode === 'manual'"
              @change="updateField('runtimeMode', 'manual')"
            />
            <span>手动模式</span>
          </label>
          <label class="radio-label">
            <input
              type="radio"
              value="auto"
              :checked="footer.runtimeMode === 'auto'"
              @change="updateField('runtimeMode', 'auto')"
            />
            <span>自动计算</span>
          </label>
        </div>

        <template v-if="footer.runtimeMode === 'manual'">
          <label class="admin-field">
            <span>运行信息 *</span>
            <textarea
              :value="footer.runtime"
              rows="3"
              @input="updateField('runtime', ($event.target as HTMLTextAreaElement).value)"
            />
          </label>
          <div class="token-buttons">
            <button
              v-for="token in runtimeTokenOptions"
              :key="token"
              type="button"
              class="token-btn"
              @click="insertRuntimeToken(token)"
            >
              {{ token }}
            </button>
          </div>
        </template>

        <template v-if="footer.runtimeMode === 'auto'">
          <label class="admin-field">
            <span>上线时间 *</span>
            <input
              :value="formatDateTimeLocal(footer.runtimeStartedAt || '')"
              type="datetime-local"
              @input="updateField('runtimeStartedAt', toIsoFromDateTimeLocal(($event.target as HTMLInputElement).value || ''))"
            />
          </label>
          <label class="admin-field">
            <span>模板</span>
            <textarea
              :value="footer.runtime || DEFAULT_RUNTIME_TEMPLATE"
              rows="2"
              @input="updateField('runtime', normalizeRuntimeTemplate(($event.target as HTMLTextAreaElement).value || ''))"
            />
          </label>
        </template>
      </section>

      <section class="form-section">
        <h4>其他信息</h4>
        <label class="admin-field">
          <span>技术支持 *</span>
          <input
            :value="footer.poweredBy"
            type="text"
            @input="updateField('poweredBy', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="admin-field">
          <span>版权声明 *</span>
          <input
            :value="footer.copyright"
            type="text"
            @input="updateField('copyright', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </section>
    </div>
  </AdminDialog>
</template>

<style scoped>
.form-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

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

.radio-group {
  display: flex;
  gap: var(--space-lg);
}

.radio-label {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  cursor: pointer;
}

.radio-label input[type="radio"] {
  width: 18px;
  height: 18px;
  accent-color: var(--admin-primary);
}

.token-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.token-btn {
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--admin-border);
  background: var(--admin-surface);
  color: var(--admin-text-secondary);
  font-size: 0.8rem;
  font-family: monospace;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.token-btn:hover {
  border-color: var(--admin-primary);
  background: rgba(99, 102, 241, 0.1);
  color: var(--admin-primary);
}

.admin-field--checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
}

.admin-field--checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--admin-primary);
}

@media (max-width: 480px) {
  .radio-group {
    flex-direction: column;
    gap: var(--space-sm);
  }
}
</style>
