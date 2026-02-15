<script setup lang="ts">
import { RefreshCw, Save, ShieldCheck, UserRound } from 'lucide-vue-next'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import { adminApi } from '@/services/admin-api'
import { useAdminAuthStore } from '@/stores/admin-auth'
import type { AdminAccessSnapshot, AdminRoleCode } from '@/types/admin'

const adminAuth = useAdminAuthStore()

const loading = ref(false)
const pending = ref(false)
const errorText = ref('')
const feedback = ref('')
const snapshot = ref<AdminAccessSnapshot | null>(null)
const selectedUserId = ref('')

const editor = reactive({
  roles: [] as AdminRoleCode[],
  permissions: [] as string[],
  disabled: false,
})

const roleOptions: Array<{ code: AdminRoleCode; label: string }> = [
  { code: 'admin', label: '管理员' },
  { code: 'editor', label: '编辑' },
  { code: 'operator', label: '运营' },
  { code: 'viewer', label: '只读' },
]

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const users = computed(() => snapshot.value?.users ?? [])

const selectedUser = computed(() => {
  return users.value.find((item) => item.id === selectedUserId.value) ?? null
})

const metrics = computed(() => {
  const totalUsers = users.value.length
  const disabledCount = users.value.filter((item) => item.disabled).length
  const availablePerms = snapshot.value?.availablePermissions.length ?? 0
  const roleCount = Object.keys(snapshot.value?.rolePermissions ?? {}).length

  return [
    { id: 'users', label: '成员数', value: totalUsers },
    { id: 'disabled', label: '禁用成员', value: disabledCount },
    { id: 'roles', label: '角色数', value: roleCount },
    { id: 'permissions', label: '权限项', value: availablePerms },
  ]
})

const showFeedback = async (text: string) => {
  feedback.value = text
  await sleep(1400)

  if (feedback.value === text) {
    feedback.value = ''
  }
}

const syncEditorFromSelected = () => {
  const target = selectedUser.value

  if (!target) {
    editor.roles = []
    editor.permissions = []
    editor.disabled = false
    return
  }

  editor.roles = [...target.roles]
  editor.permissions = [...target.permissions]
  editor.disabled = Boolean(target.disabled)
}

const ensureSelectedUser = () => {
  if (!users.value.length) {
    selectedUserId.value = ''
    return
  }

  const current = users.value.find((item) => item.id === selectedUserId.value)

  if (!current) {
    const firstUser = users.value[0]

    if (firstUser) {
      selectedUserId.value = firstUser.id
    }
  }
}

const loadSnapshot = async () => {
  loading.value = true
  errorText.value = ''

  try {
    snapshot.value = await adminApi.getAccessSnapshot()
    ensureSelectedUser()
    syncEditorFromSelected()
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '权限数据加载失败'
  } finally {
    loading.value = false
  }
}

const hasRole = (role: AdminRoleCode) => editor.roles.includes(role)

const hasPermission = (permission: string) => editor.permissions.includes(permission)

const toggleRole = (role: AdminRoleCode) => {
  if (hasRole(role)) {
    editor.roles = editor.roles.filter((item) => item !== role)
    return
  }

  editor.roles = [...editor.roles, role]
}

const togglePermission = (permission: string) => {
  if (hasPermission(permission)) {
    editor.permissions = editor.permissions.filter((item) => item !== permission)
    return
  }

  editor.permissions = [...editor.permissions, permission]
}

const saveUserAccess = async () => {
  const target = selectedUser.value

  if (!target || pending.value) {
    return
  }

  pending.value = true
  errorText.value = ''

  try {
    const nextSnapshot = await adminApi.updateUserAccess({
      userId: target.id,
      roles: editor.roles,
      permissions: editor.permissions,
      disabled: editor.disabled,
    })

    snapshot.value = nextSnapshot
    ensureSelectedUser()
    syncEditorFromSelected()

    if (adminAuth.user?.id === target.id) {
      adminAuth.user = {
        ...adminAuth.user,
        roles: [...editor.roles],
        permissions: [...editor.permissions],
      }
    }

    await showFeedback('权限已更新')
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '权限保存失败'
  } finally {
    pending.value = false
  }
}

watch(selectedUserId, () => {
  syncEditorFromSelected()
})

onMounted(async () => {
  await loadSnapshot()
})
</script>

<template>
  <section class="admin-page admin-access-page">
    <header class="admin-page__head">
      <p>ACCESS CONTROL</p>
      <h2>角色权限</h2>
      <span>按用户配置角色与权限，支持禁用状态管理与即时更新。</span>
    </header>

    <section class="admin-access-toolbar">
      <button type="button" class="admin-action-btn icon-host" @click="loadSnapshot">
        <RefreshCw class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
        <span>刷新权限快照</span>
      </button>
    </section>

    <p v-if="loading" class="admin-page__hint">权限数据加载中...</p>
    <p v-if="errorText" class="admin-page__hint admin-page__hint--warn">{{ errorText }}</p>
    <p v-if="feedback" class="admin-page__hint">{{ feedback }}</p>

    <section class="admin-access-metrics">
      <article v-for="item in metrics" :key="item.id" class="admin-access-metric">
        <strong>{{ item.value }}</strong>
        <span>{{ item.label }}</span>
      </article>
    </section>

    <section class="admin-access-layout">
      <article class="admin-access-panel">
        <header>
          <h3>用户列表</h3>
          <small>选择成员进行权限编辑</small>
        </header>

        <ul class="admin-access-user-list">
          <li
            v-for="item in users"
            :key="item.id"
            class="admin-access-user-card"
            :class="{ 'admin-access-user-card--active': item.id === selectedUserId }"
          >
            <button type="button" class="admin-access-user-btn" @click="selectedUserId = item.id">
              <span class="admin-access-user-avatar">
                <UserRound class="icon icon--sm icon--stroke-strong" aria-hidden="true" />
              </span>
              <span class="admin-access-user-main">
                <strong>{{ item.displayName }}</strong>
                <small>{{ item.email }}</small>
              </span>
              <span class="admin-access-user-state" :class="{ 'admin-access-user-state--disabled': item.disabled }">
                {{ item.disabled ? '已禁用' : '正常' }}
              </span>
            </button>
          </li>
        </ul>
      </article>

      <article class="admin-access-panel">
        <header>
          <h3>权限编辑</h3>
          <small v-if="selectedUser">{{ selectedUser.displayName }}</small>
        </header>

        <template v-if="selectedUser && snapshot">
          <section class="admin-access-group">
            <h4>角色</h4>
            <div class="admin-access-chip-list">
              <button
                v-for="item in roleOptions"
                :key="item.code"
                type="button"
                class="admin-site-tab"
                :class="{ 'admin-site-tab--active': hasRole(item.code) }"
                @click="toggleRole(item.code)"
              >
                <ShieldCheck class="icon icon--xs icon--stroke-strong" aria-hidden="true" />
                <span>{{ item.label }}</span>
              </button>
            </div>
          </section>

          <section class="admin-access-group">
            <h4>权限</h4>
            <div class="admin-access-perm-grid">
              <label v-for="permission in snapshot.availablePermissions" :key="permission" class="admin-access-perm-item">
                <input
                  type="checkbox"
                  :checked="hasPermission(permission)"
                  @change="togglePermission(permission)"
                />
                <span>{{ permission }}</span>
              </label>
            </div>
          </section>

          <section class="admin-access-group">
            <h4>状态</h4>
            <button
              type="button"
              class="admin-switch"
              :class="{ 'admin-switch--active': editor.disabled }"
              @click="editor.disabled = !editor.disabled"
            >
              {{ editor.disabled ? '已禁用（点击恢复）' : '正常（点击禁用）' }}
            </button>
          </section>

          <footer class="admin-site-actions">
            <button
              type="button"
              class="admin-action-btn admin-action-btn--strong icon-host"
              :disabled="pending"
              @click="saveUserAccess"
            >
              <Save class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
              <span>{{ pending ? '保存中...' : '保存权限' }}</span>
            </button>
          </footer>
        </template>

        <article v-else class="admin-empty-card">
          <h3>暂无可编辑用户</h3>
          <p>请先在后端接入用户数据后再分配权限。</p>
        </article>
      </article>
    </section>
  </section>
</template>
