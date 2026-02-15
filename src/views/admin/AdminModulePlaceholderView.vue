<script setup lang="ts">
import { Wrench } from 'lucide-vue-next'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const title = computed(() => String(route.meta?.adminTitle ?? '模块建设中'))
const description = computed(() => String(route.meta?.adminDesc ?? '该模块将在后续迭代中完整接入。'))
</script>

<template>
  <section class="admin-page admin-placeholder-page">
    <header class="admin-page__head">
      <p>MODULE</p>
      <h2>{{ title }}</h2>
      <span>{{ description }}</span>
    </header>

    <article class="admin-placeholder-card">
      <Wrench class="icon icon--lg icon--stroke-strong" aria-hidden="true" />
      <p>当前已完成后台骨架、鉴权与权限中间件。该模块将按迭代计划继续完善。</p>
    </article>
  </section>
</template>
