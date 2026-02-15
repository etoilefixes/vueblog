<script setup lang="ts">
import { ShieldX } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

import '@/assets/styles/admin.css'

const router = useRouter()

const goDashboard = async () => {
  await router.replace({ name: 'admin-dashboard' })
}
</script>

<template>
  <main class="admin-forbidden-page">
    <section class="admin-forbidden-card">
      <ShieldX class="icon icon--lg icon--stroke-strong" aria-hidden="true" />
      <h1>无访问权限</h1>
      <p>当前账号没有访问该后台模块的权限，请联系管理员开通。</p>
      <button type="button" class="admin-action-btn admin-action-btn--strong" @click="goDashboard">
        返回仪表盘
      </button>
    </section>
  </main>
</template>
