<script setup lang="ts">
import { LogIn, ShieldCheck } from 'lucide-vue-next'
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import '@/assets/styles/admin.css'
import { useAdminAuthStore } from '@/stores/admin-auth'

const route = useRoute()
const router = useRouter()
const adminAuth = useAdminAuthStore()

const loginForm = reactive({
  email: 'admin@example.com',
  password: 'change-me-please',
})

const localError = ref('')
const loginHint = '请使用 backend/.env 中的 ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD 登录'

const submitLogin = async () => {
  localError.value = ''

  try {
    await adminAuth.login({
      email: loginForm.email.trim(),
      password: loginForm.password,
    })

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''

    if (redirect && redirect.startsWith('/admin')) {
      await router.replace(redirect)
      return
    }

    await router.replace({ name: 'admin-dashboard' })
  } catch (error) {
    localError.value = error instanceof Error ? error.message : '登录失败，请稍后重试'
  }
}
</script>

<template>
  <main class="admin-login-page">
    <section class="admin-login-card">
      <header class="admin-login-card__head">
        <p>ADMIN SYSTEM</p>
        <h1>后台管理登录</h1>
        <span>{{ loginHint }}</span>
      </header>

      <form class="admin-login-form" @submit.prevent="submitLogin">
        <label>
          <span>账号</span>
          <input v-model="loginForm.email" type="email" autocomplete="username" required />
        </label>

        <label>
          <span>密码</span>
          <input
            v-model="loginForm.password"
            type="password"
            autocomplete="current-password"
            minlength="8"
            required
          />
        </label>

        <p v-if="localError || adminAuth.authError" class="admin-login-form__error">
          {{ localError || adminAuth.authError }}
        </p>

        <button
          type="submit"
          class="admin-login-form__submit icon-host"
          :disabled="adminAuth.isAuthenticating"
        >
          <LogIn class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
          <span>{{ adminAuth.isAuthenticating ? '登录中...' : '进入后台' }}</span>
        </button>
      </form>

      <footer class="admin-login-card__foot">
        <ShieldCheck class="icon icon--sm icon--stroke-strong" aria-hidden="true" />
        <span>已启用角色权限中间件与会话持久化</span>
      </footer>
    </section>
  </main>
</template>
