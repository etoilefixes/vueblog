<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { computed } from 'vue'

interface Props {
  open: boolean
  title: string
  description?: string
  type?: 'info' | 'danger' | 'warning'
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'info',
  confirmText: '确认',
  cancelText: '取消',
  showCancel: true,
  loading: false,
})

const emit = defineEmits<{
  confirm: []
  cancel: []
  close: []
}>()

const dialogClass = computed(() => {
  return {
    'admin-dialog': true,
    'admin-dialog--danger': props.type === 'danger',
    'admin-dialog--warning': props.type === 'warning',
  }
})

const handleConfirm = () => {
  if (!props.loading) {
    emit('confirm')
  }
}

const handleCancel = () => {
  if (!props.loading) {
    emit('cancel')
  }
}

const handleOverlayClick = () => {
  if (!props.loading) {
    emit('close')
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="admin-fade">
      <div
        v-if="open"
        class="admin-dialog-overlay"
        @click.self="handleOverlayClick"
      >
        <Transition name="admin-scale">
          <div v-if="open" :class="dialogClass">
            <header class="admin-dialog__header">
              <h3>{{ title }}</h3>
              <button
                type="button"
                class="admin-dialog__close"
                :disabled="loading"
                @click="handleCancel"
              >
                <X class="icon icon--sm" aria-hidden="true" />
              </button>
            </header>
            <div v-if="description" class="admin-dialog__body">
              <p>{{ description }}</p>
            </div>
            <div class="admin-dialog__content">
              <slot />
            </div>
            <div class="admin-dialog__footer">
              <button
                v-if="showCancel"
                type="button"
                class="admin-btn"
                :disabled="loading"
                @click="handleCancel"
              >
                {{ cancelText }}
              </button>
              <button
                type="button"
                class="admin-btn"
                :class="type === 'danger' ? 'admin-btn--danger' : 'admin-btn--primary'"
                :disabled="loading"
                @click="handleConfirm"
              >
                <span v-if="loading">处理中...</span>
                <span v-else>{{ confirmText }}</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.admin-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal, 300);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg, 24px);
  background: rgba(30, 27, 75, 0.5);
  backdrop-filter: blur(6px);
}

.admin-dialog {
  width: 90%;
  max-width: 800px;
  border-radius: var(--radius-xl, 20px);
  border: 1px solid rgba(255, 255, 255, 0.55);
  background: linear-gradient(150deg, rgba(255, 255, 255, 0.92), rgba(238, 243, 255, 0.88));
  box-shadow: var(--shadow-xl, 0 24px 52px rgba(31, 26, 74, 0.26));
  backdrop-filter: blur(16px);
  overflow: hidden;
}

.admin-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md, 16px);
  padding: var(--space-xl, 32px) var(--space-xl, 32px) var(--space-md, 16px);
}

.admin-dialog__header h3 {
  margin: 0;
  color: var(--admin-text-primary, #1a3a52);
  font-size: 1.2rem;
  font-weight: 600;
}

.admin-dialog--danger .admin-dialog__header h3 {
  color: var(--admin-danger, #9c3e57);
}

.admin-dialog--warning .admin-dialog__header h3 {
  color: var(--admin-warning, #e65100);
}

.admin-dialog__close {
  width: 44px;
  height: 44px;
  border: 1px solid transparent;
  border-radius: var(--radius-md, 12px);
  background: rgba(99, 102, 241, 0.08);
  color: var(--admin-text-tertiary, #7a8fa3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
  transition:
    background var(--transition-fast, 150ms ease),
    color var(--transition-fast, 150ms ease),
    border-color var(--transition-fast, 150ms ease),
    transform var(--transition-fast, 150ms ease);
}

.admin-dialog__close:active:not(:disabled) {
  transform: scale(0.95);
}

.admin-dialog__close:hover:not(:disabled) {
  border-color: var(--admin-border-strong, rgba(79, 70, 229, 0.26));
  background: rgba(99, 102, 241, 0.16);
  color: var(--admin-primary, #6366f1);
}

.admin-dialog__body {
  padding: 0 var(--space-xl, 32px) var(--space-lg, 24px);
}

.admin-dialog__body p {
  margin: 0;
  color: var(--admin-text-secondary, #4a6278);
  font-size: 0.95rem;
  line-height: 1.6;
}

.admin-dialog__content {
  padding: 0 var(--space-xl, 32px) var(--space-lg, 24px);
  max-height: 75vh;
  overflow-y: auto;
}

.admin-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md, 16px);
  padding: var(--space-md, 16px) var(--space-xl, 32px) var(--space-xl, 32px);
  border-top: 1px solid var(--admin-border, rgba(79, 70, 229, 0.14));
  background: linear-gradient(180deg, rgba(245, 243, 255, 0.22), rgba(245, 243, 255, 0.72));
}

.admin-dialog__close:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--admin-focus-ring, rgba(99, 102, 241, 0.2));
}

/* Transitions */
.admin-fade-enter-active,
.admin-fade-leave-active {
  transition: opacity 250ms ease;
}

.admin-fade-enter-from,
.admin-fade-leave-to {
  opacity: 0;
}

.admin-scale-enter-active,
.admin-scale-leave-active {
  transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1);
}

.admin-scale-enter-from,
.admin-scale-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

@media (max-width: 639px) {
  .admin-dialog-overlay {
    padding: 0;
    align-items: flex-end;
  }

  .admin-dialog {
    width: 100%;
    max-width: 100%;
    max-height: 90dvh;
    border-radius: 20px 20px 0 0;
    display: flex;
    flex-direction: column;
    animation: slide-up 300ms cubic-bezier(0.32, 0.72, 0, 1);
  }

  .admin-dialog__header {
    padding: 20px 16px 12px;
    position: sticky;
    top: 0;
    background: inherit;
    border-radius: 20px 20px 0 0;
    z-index: 1;
  }

  .admin-dialog__body,
  .admin-dialog__content {
    padding: 0 16px 16px;
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }

  .admin-dialog__footer {
    position: sticky;
    bottom: 0;
    padding: 12px 16px;
    padding-bottom: calc(16px + env(safe-area-inset-bottom, 0));
    flex-direction: column-reverse;
    gap: 10px;
    background: linear-gradient(180deg, rgba(245, 243, 255, 0.85), rgba(245, 243, 255, 0.98));
    backdrop-filter: blur(8px);
    z-index: 1;
  }

  .admin-dialog__footer .admin-btn {
    width: 100%;
    min-height: 48px;
    font-size: 1rem;
    justify-content: center;
  }

  .admin-dialog__header h3 {
    font-size: 1.1rem;
  }

  /* Drag indicator for bottom sheet */
  .admin-dialog::before {
    content: '';
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: rgba(30, 27, 75, 0.15);
  }
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Large screen optimization */
@media (min-width: 1024px) {
  .admin-dialog {
    max-width: 640px;
  }

  .admin-dialog__content {
    max-height: 60vh;
  }
}

@media (min-width: 1280px) {
  .admin-dialog {
    max-width: 720px;
  }
}
</style>
