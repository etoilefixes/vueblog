<script setup lang="ts">
import { Copy, Image, Link2, RefreshCw, Save, Search, Trash2, Upload } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

import { adminApi } from '@/services/admin-api'
import type { AdminMediaItem } from '@/types/admin'

const loading = ref(false)
const pending = ref(false)
const errorText = ref('')
const feedback = ref('')
const mediaList = ref<AdminMediaItem[]>([])
const localUploadFile = ref<File | null>(null)
const localUploadPreviewUrl = ref('')
const localUploadName = ref('')
const localUploadWidth = ref<number | undefined>(undefined)
const localUploadHeight = ref<number | undefined>(undefined)
const localUploadInputRef = ref<HTMLInputElement | null>(null)
const minioUploadMode = ref<'single' | 'multipart'>('single')
const minioUploadFile = ref<File | null>(null)
const minioUploadPreviewUrl = ref('')
const minioUploadName = ref('')
const minioUploadWidth = ref<number | undefined>(undefined)
const minioUploadHeight = ref<number | undefined>(undefined)
const minioUploadInputRef = ref<HTMLInputElement | null>(null)
const multipartChunkSizeMb = ref(8)
const uploadProgressText = ref('')
const cleanupDryRun = ref(true)
const LOCAL_UPLOAD_MAX_SIZE = 10 * 1024 * 1024
const MULTIPART_MIN_CHUNK_MB = 5
const MULTIPART_MAX_CHUNK_MB = 64

const filters = reactive({
  keyword: '',
  mimeType: 'all',
  limit: 80,
})

const uploadDraft = reactive({
  name: '',
  url: '',
  mimeType: 'image/svg+xml',
  size: 1024,
  width: 1200,
  height: 630,
})

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

const formatSize = (value: number) => {
  if (value < 1024) {
    return `${value} B`
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

const metrics = computed(() => {
  const totalCount = mediaList.value.length
  const imageCount = mediaList.value.filter((item) => item.mimeType.startsWith('image/')).length
  const totalSize = mediaList.value.reduce((sum, item) => sum + item.size, 0)
  const latest = mediaList.value[0]?.uploadedAt

  return [
    { id: 'total', label: '资源总数', value: totalCount },
    { id: 'image', label: '图片资源', value: imageCount },
    { id: 'size', label: '总大小', value: formatSize(totalSize) },
    { id: 'latest', label: '最近上传', value: latest ? formatDateTime(latest) : '--' },
  ]
})

const showFeedback = async (text: string) => {
  feedback.value = text
  await sleep(1400)

  if (feedback.value === text) {
    feedback.value = ''
  }
}

const loadMedia = async () => {
  loading.value = true
  errorText.value = ''

  try {
    mediaList.value = await adminApi.getMediaList({
      keyword: filters.keyword.trim() || undefined,
      mimeType: filters.mimeType !== 'all' ? filters.mimeType : undefined,
      limit: filters.limit,
    })
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '媒体列表加载失败'
  } finally {
    loading.value = false
  }
}

const resetLocalUpload = () => {
  if (localUploadPreviewUrl.value) {
    URL.revokeObjectURL(localUploadPreviewUrl.value)
  }

  localUploadFile.value = null
  localUploadPreviewUrl.value = ''
  localUploadName.value = ''
  localUploadWidth.value = undefined
  localUploadHeight.value = undefined

  if (localUploadInputRef.value) {
    localUploadInputRef.value.value = ''
  }
}

const readLocalImageDimensions = async (file: File) => {
  return await new Promise<{ width?: number; height?: number }>((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new window.Image()

    image.onload = () => {
      const width = Number.isFinite(image.naturalWidth) ? image.naturalWidth : undefined
      const height = Number.isFinite(image.naturalHeight) ? image.naturalHeight : undefined
      URL.revokeObjectURL(objectUrl)
      resolve({ width, height })
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({})
    }

    image.src = objectUrl
  })
}

const selectLocalUploadFile = async (event: Event) => {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0] ?? null

  if (!file) {
    resetLocalUpload()
    return
  }

  if (!file.type.startsWith('image/')) {
    errorText.value = '仅支持上传图片文件'
    resetLocalUpload()
    return
  }

  if (file.size > LOCAL_UPLOAD_MAX_SIZE) {
    errorText.value = `图片大小不能超过 ${(LOCAL_UPLOAD_MAX_SIZE / (1024 * 1024)).toFixed(0)} MB`
    resetLocalUpload()
    return
  }

  if (localUploadPreviewUrl.value) {
    URL.revokeObjectURL(localUploadPreviewUrl.value)
  }

  const extensionLessName = file.name.replace(/\.[^./\\]+$/, '').trim()
  localUploadFile.value = file
  localUploadName.value = extensionLessName
  localUploadPreviewUrl.value = URL.createObjectURL(file)

  const dimensions = await readLocalImageDimensions(file)
  localUploadWidth.value = dimensions.width
  localUploadHeight.value = dimensions.height
}

const uploadLocalMedia = async () => {
  if (pending.value || !localUploadFile.value) {
    return
  }

  pending.value = true
  errorText.value = ''

  try {
    const created = await adminApi.uploadLocalMedia(localUploadFile.value, {
      name: localUploadName.value.trim() || undefined,
      width: localUploadWidth.value,
      height: localUploadHeight.value,
    })

    mediaList.value = [created, ...mediaList.value]
    resetLocalUpload()
    await showFeedback('本地图片上传成功')
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '本地上传失败'
  } finally {
    pending.value = false
  }
}

const clampMultipartChunkSizeMb = () => {
  const value = Math.trunc(Number(multipartChunkSizeMb.value) || MULTIPART_MIN_CHUNK_MB)
  const normalized = Math.max(MULTIPART_MIN_CHUNK_MB, Math.min(MULTIPART_MAX_CHUNK_MB, value))
  multipartChunkSizeMb.value = normalized
  return normalized
}

const resetMinioUpload = () => {
  if (minioUploadPreviewUrl.value) {
    URL.revokeObjectURL(minioUploadPreviewUrl.value)
  }

  minioUploadFile.value = null
  minioUploadPreviewUrl.value = ''
  minioUploadName.value = ''
  minioUploadWidth.value = undefined
  minioUploadHeight.value = undefined
  uploadProgressText.value = ''

  if (minioUploadInputRef.value) {
    minioUploadInputRef.value.value = ''
  }
}

const selectMinioUploadFile = async (event: Event) => {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0] ?? null

  if (!file) {
    resetMinioUpload()
    return
  }

  if (file.size <= 0 || file.size > 2_000_000_000) {
    errorText.value = '文件大小必须在 1B 到 2GB 之间'
    resetMinioUpload()
    return
  }

  if (minioUploadPreviewUrl.value) {
    URL.revokeObjectURL(minioUploadPreviewUrl.value)
  }

  minioUploadFile.value = file
  minioUploadName.value = file.name

  if (file.type.startsWith('image/')) {
    minioUploadPreviewUrl.value = URL.createObjectURL(file)
    const dimensions = await readLocalImageDimensions(file)
    minioUploadWidth.value = dimensions.width
    minioUploadHeight.value = dimensions.height
  } else {
    minioUploadPreviewUrl.value = ''
    minioUploadWidth.value = undefined
    minioUploadHeight.value = undefined
  }
}

const uploadWithSignedUrl = async (uploadUrl: string, payload: Blob, mimeType: string) => {
  const headers = new Headers()

  if (mimeType) {
    headers.set('Content-Type', mimeType)
  }

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: payload,
    headers,
  })

  if (!response.ok) {
    throw new Error(`上传到对象存储失败（${response.status} ${response.statusText}）`)
  }

  return response
}

const uploadMinioSingle = async (file: File) => {
  const mimeType = file.type || 'application/octet-stream'
  const name = minioUploadName.value.trim() || file.name
  uploadProgressText.value = '申请签名地址...'
  const signed = await adminApi.createSignedUploadUrl({
    name,
    mimeType,
    size: file.size,
    width: minioUploadWidth.value,
    height: minioUploadHeight.value,
  })

  uploadProgressText.value = '上传文件到 MinIO...'
  await uploadWithSignedUrl(signed.uploadUrl, file, mimeType)
  uploadProgressText.value = '写入媒体库记录...'

  const created = await adminApi.uploadMedia({
    name,
    url: signed.publicUrl,
    mimeType,
    size: file.size,
    width: minioUploadWidth.value,
    height: minioUploadHeight.value,
  })

  mediaList.value = [created, ...mediaList.value]
}

const uploadMinioMultipart = async (file: File) => {
  const mimeType = file.type || 'application/octet-stream'
  const name = minioUploadName.value.trim() || file.name
  const chunkSize = clampMultipartChunkSizeMb() * 1024 * 1024
  const totalParts = Math.ceil(file.size / chunkSize)

  if (totalParts > 10_000) {
    throw new Error('分片数量超过上限，请增大分片大小')
  }

  uploadProgressText.value = '初始化分片上传...'
  const initResult = await adminApi.initMultipartUpload({
    name,
    mimeType,
    size: file.size,
    width: minioUploadWidth.value,
    height: minioUploadHeight.value,
    partSize: chunkSize,
    totalParts,
  })

  const uploadedParts: Array<{ partNumber: number; etag?: string }> = []
  let needAbort = true

  try {
    for (let partNumber = 1; partNumber <= initResult.totalParts; partNumber += 1) {
      uploadProgressText.value = `上传分片 ${partNumber}/${initResult.totalParts}...`
      const partSigned = await adminApi.presignMultipartPart({
        sessionId: initResult.sessionId,
        partNumber,
      })

      const start = (partNumber - 1) * initResult.partSize
      const end = Math.min(file.size, start + initResult.partSize)
      const chunk = file.slice(start, end)
      const response = await uploadWithSignedUrl(partSigned.uploadUrl, chunk, mimeType)
      const etag = response.headers.get('etag')?.replace(/^"+|"+$/g, '') || undefined
      uploadedParts.push({
        partNumber,
        etag,
      })
    }

    uploadProgressText.value = '合并分片并写入媒体库...'
    const created = await adminApi.completeMultipartUpload({
      sessionId: initResult.sessionId,
      parts: uploadedParts,
    })
    needAbort = false
    mediaList.value = [created, ...mediaList.value]
  } finally {
    if (needAbort) {
      try {
        await adminApi.abortMultipartUpload({
          sessionId: initResult.sessionId,
        })
      } catch {
        // ignore abort failures and keep original upload error
      }
    }
  }
}

const uploadMinioMedia = async () => {
  if (pending.value || !minioUploadFile.value) {
    return
  }

  pending.value = true
  errorText.value = ''
  uploadProgressText.value = ''

  try {
    if (minioUploadMode.value === 'multipart') {
      await uploadMinioMultipart(minioUploadFile.value)
      await showFeedback('MinIO 分片上传成功')
    } else {
      await uploadMinioSingle(minioUploadFile.value)
      await showFeedback('MinIO 签名直传成功')
    }

    resetMinioUpload()
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : 'MinIO 上传失败'
  } finally {
    pending.value = false
    uploadProgressText.value = ''
  }
}

const uploadMedia = async () => {
  if (pending.value) {
    return
  }

  pending.value = true
  errorText.value = ''

  try {
    const created = await adminApi.uploadMedia({
      name: uploadDraft.name.trim(),
      url: uploadDraft.url.trim(),
      mimeType: uploadDraft.mimeType.trim(),
      size: Math.max(1, Number(uploadDraft.size) || 1),
      width: Number(uploadDraft.width) || undefined,
      height: Number(uploadDraft.height) || undefined,
    })
    mediaList.value = [created, ...mediaList.value]
    uploadDraft.name = ''
    uploadDraft.url = ''
    uploadDraft.size = 1024
    await showFeedback('媒体已入库')
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '上传失败'
  } finally {
    pending.value = false
  }
}

const removeMediaItem = (mediaId: string) => {
  mediaList.value = mediaList.value.filter((item) => item.id !== mediaId)
}

const deleteMediaItem = async (item: AdminMediaItem) => {
  if (pending.value) {
    return
  }

  const confirmed = window.confirm(`确认删除资源「${item.name}」？`)

  if (!confirmed) {
    return
  }

  pending.value = true
  errorText.value = ''

  try {
    await adminApi.deleteMedia(item.id)
    removeMediaItem(item.id)
    await showFeedback('资源已删除（待清理）')
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除失败'

    if (message.includes('被引用')) {
      const forceConfirmed = window.confirm(`${message}\n是否强制删除元数据并加入清理队列？`)

      if (forceConfirmed) {
        try {
          await adminApi.deleteMedia(item.id, {
            force: true,
            reason: '管理员强制删除媒体记录',
          })
          removeMediaItem(item.id)
          await showFeedback('资源已强制删除（待清理）')
          return
        } catch (forceError) {
          errorText.value = forceError instanceof Error ? forceError.message : '强制删除失败'
          return
        }
      }
    }

    errorText.value = message
  } finally {
    pending.value = false
  }
}

const runMediaCleanup = async () => {
  if (pending.value) {
    return
  }

  pending.value = true
  errorText.value = ''

  try {
    const report = await adminApi.cleanupMediaOrphans({
      dryRun: cleanupDryRun.value,
    })

    const minioDeleted = report.removedMinioObjects ?? 0
    const minioOrphans = report.orphanMinioObjectsDetected ?? 0
    const minioOrphansRemoved = report.orphanMinioObjectsRemoved ?? 0
    const multipartOrphans = report.orphanMultipartUploadsDetected ?? 0
    const multipartAborted = report.orphanMultipartUploadsAborted ?? 0
    const summary = cleanupDryRun.value
      ? `预演完成：待清理记录 ${report.removedMetadataRecords} 条，孤儿文件 ${report.orphanLocalFilesDetected} 个，孤儿对象 ${minioOrphans} 个，孤儿分片 ${multipartOrphans} 个`
      : `清理完成：移除记录 ${report.removedMetadataRecords} 条，删除文件 ${report.removedLocalFiles + report.orphanLocalFilesRemoved} 个，删除对象 ${minioDeleted + minioOrphansRemoved} 个，中止分片 ${multipartAborted} 个`

    await showFeedback(summary)

    if (!cleanupDryRun.value) {
      await loadMedia()
    }
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '清理执行失败'
  } finally {
    pending.value = false
  }
}

const copyMediaUrl = async (url: string) => {
  try {
    await navigator.clipboard.writeText(url)
    await showFeedback('资源链接已复制')
  } catch {
    const input = document.createElement('input')
    input.value = url
    document.body.appendChild(input)
    input.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(input)

    if (copied) {
      await showFeedback('资源链接已复制')
      return
    }

    errorText.value = '复制失败，请手动复制'
  }
}

let debounceTimer = 0

watch(
  () => [filters.keyword, filters.mimeType, filters.limit],
  () => {
    window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => {
      void loadMedia()
    }, 220)
  },
)

onMounted(async () => {
  await loadMedia()
})

onUnmounted(() => {
  window.clearTimeout(debounceTimer)
  if (localUploadPreviewUrl.value) {
    URL.revokeObjectURL(localUploadPreviewUrl.value)
  }
  if (minioUploadPreviewUrl.value) {
    URL.revokeObjectURL(minioUploadPreviewUrl.value)
  }
})
</script>

<template>
  <section class="admin-page admin-media-page">
    <header class="admin-page__head">
      <p>MEDIA LIBRARY</p>
      <h2>媒体库</h2>
      <span>统一管理资源链接，支持按类型筛选和快速复制。</span>
    </header>

    <section class="admin-media-toolbar">
      <label class="admin-input-wrap admin-input-wrap--search">
        <Search class="icon icon--sm icon--stroke-strong" aria-hidden="true" />
        <input v-model="filters.keyword" type="search" placeholder="搜索文件名、URL、上传人..." />
      </label>

      <select v-model="filters.mimeType" class="admin-select">
        <option value="all">全部类型</option>
        <option value="image/">图片</option>
        <option value="video/">视频</option>
        <option value="text/">文本</option>
      </select>

      <select v-model.number="filters.limit" class="admin-select">
        <option :value="40">最近 40 条</option>
        <option :value="80">最近 80 条</option>
        <option :value="120">最近 120 条</option>
      </select>

      <button type="button" class="admin-action-btn icon-host" @click="loadMedia">
        <RefreshCw class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
        <span>刷新</span>
      </button>

      <label class="admin-input-wrap admin-input-wrap--search admin-input-wrap--compact">
        <input v-model="cleanupDryRun" type="checkbox" />
        <span>{{ cleanupDryRun ? '预演清理' : '执行清理' }}</span>
      </label>

      <button type="button" class="admin-action-btn icon-host" :disabled="pending" @click="runMediaCleanup">
        <RefreshCw class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
        <span>{{ pending ? '处理中...' : cleanupDryRun ? '预演清理' : '执行清理' }}</span>
      </button>
    </section>

    <p v-if="loading" class="admin-page__hint">媒体数据加载中...</p>
    <p v-if="errorText" class="admin-page__hint admin-page__hint--warn">{{ errorText }}</p>
    <p v-if="feedback" class="admin-page__hint">{{ feedback }}</p>

    <section class="admin-media-metrics">
      <article v-for="item in metrics" :key="item.id" class="admin-media-metric">
        <strong>{{ item.value }}</strong>
        <span>{{ item.label }}</span>
      </article>
    </section>

    <section class="admin-media-layout">
      <article class="admin-media-panel">
        <header>
          <h3>新增资源</h3>
          <small>支持本地图片直传，也保留手动录入外链模式</small>
        </header>

        <div class="admin-media-form">
          <section class="admin-media-upload-block">
            <label class="admin-field admin-field--full">
              <span>本地图片上传</span>
              <input
                ref="localUploadInputRef"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/avif"
                @change="selectLocalUploadFile"
              />
            </label>
            <label class="admin-field">
              <span>资源名称（可选）</span>
              <input
                v-model="localUploadName"
                type="text"
                maxlength="120"
                placeholder="留空使用文件名"
              />
            </label>
            <p class="admin-runtime-template-hint">
              最大 {{ (LOCAL_UPLOAD_MAX_SIZE / (1024 * 1024)).toFixed(0) }} MB，上传后自动生成可访问链接并写入媒体库。
            </p>
            <div v-if="localUploadPreviewUrl" class="admin-media-local-preview">
              <img :src="localUploadPreviewUrl" :alt="localUploadName || 'local-upload-preview'" />
              <small>
                {{ localUploadFile?.name }} · {{ formatSize(localUploadFile?.size ?? 0) }}
                <template v-if="localUploadWidth && localUploadHeight">
                  · {{ localUploadWidth }} × {{ localUploadHeight }}
                </template>
              </small>
            </div>
            <button
              type="button"
              class="admin-action-btn admin-action-btn--strong icon-host"
              :disabled="pending || !localUploadFile"
              @click="uploadLocalMedia"
            >
              <Upload class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
              <span>{{ pending ? '上传中...' : '上传本地图片' }}</span>
            </button>
          </section>

          <section class="admin-media-upload-block">
            <header>
              <h4>MinIO 签名上传</h4>
            </header>
            <label class="admin-field admin-field--full">
              <span>选择文件</span>
              <input
                ref="minioUploadInputRef"
                type="file"
                @change="selectMinioUploadFile"
              />
            </label>
            <label class="admin-field">
              <span>媒体名称（可选）</span>
              <input
                v-model="minioUploadName"
                type="text"
                maxlength="120"
                placeholder="留空使用文件名"
              />
            </label>
            <label class="admin-field">
              <span>上传模式</span>
              <select v-model="minioUploadMode" class="admin-select">
                <option value="single">签名直传（单文件）</option>
                <option value="multipart">分片上传（大文件）</option>
              </select>
            </label>
            <label v-if="minioUploadMode === 'multipart'" class="admin-field">
              <span>分片大小（MB）</span>
              <input
                v-model.number="multipartChunkSizeMb"
                type="number"
                :min="MULTIPART_MIN_CHUNK_MB"
                :max="MULTIPART_MAX_CHUNK_MB"
              />
            </label>
            <p class="admin-runtime-template-hint">
              直传模式适合小文件；分片模式建议用于大文件并支持失败重试。
            </p>
            <p v-if="uploadProgressText" class="admin-runtime-template-hint">
              {{ uploadProgressText }}
            </p>
            <div v-if="minioUploadPreviewUrl" class="admin-media-local-preview">
              <img :src="minioUploadPreviewUrl" :alt="minioUploadName || 'minio-upload-preview'" />
              <small>
                {{ minioUploadFile?.name }} · {{ formatSize(minioUploadFile?.size ?? 0) }}
                <template v-if="minioUploadWidth && minioUploadHeight">
                  · {{ minioUploadWidth }} × {{ minioUploadHeight }}
                </template>
              </small>
            </div>
            <button
              type="button"
              class="admin-action-btn admin-action-btn--strong icon-host"
              :disabled="pending || !minioUploadFile"
              @click="uploadMinioMedia"
            >
              <Upload class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
              <span>
                {{
                  pending
                    ? '上传中...'
                    : minioUploadMode === 'multipart'
                      ? '分片上传到 MinIO'
                      : '签名直传到 MinIO'
                }}
              </span>
            </button>
          </section>

          <section class="admin-media-upload-block">
            <header>
              <h4>手动录入外链</h4>
            </header>
          <label class="admin-field">
            <span>文件名</span>
            <input v-model="uploadDraft.name" type="text" maxlength="120" placeholder="hero-cover.webp" />
          </label>
          <label class="admin-field admin-field--full">
            <span>资源 URL</span>
            <input v-model="uploadDraft.url" type="url" maxlength="240" placeholder="https://cdn.example.com/hero-cover.webp" />
          </label>
          <label class="admin-field">
            <span>MIME 类型</span>
            <input v-model="uploadDraft.mimeType" type="text" maxlength="80" placeholder="image/webp" />
          </label>
          <label class="admin-field">
            <span>大小（字节）</span>
            <input v-model.number="uploadDraft.size" type="number" min="1" />
          </label>
          <label class="admin-field">
            <span>宽度（可选）</span>
            <input v-model.number="uploadDraft.width" type="number" min="0" />
          </label>
          <label class="admin-field">
            <span>高度（可选）</span>
            <input v-model.number="uploadDraft.height" type="number" min="0" />
          </label>
          </section>
        </div>

        <footer class="admin-site-actions">
          <button
            type="button"
            class="admin-action-btn admin-action-btn--strong icon-host"
            :disabled="pending"
            @click="uploadMedia"
          >
            <Save class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
            <span>{{ pending ? '提交中...' : '保存资源' }}</span>
          </button>
        </footer>
      </article>

      <article class="admin-media-panel">
        <header>
          <h3>资源列表</h3>
          <small>共 {{ mediaList.length }} 条</small>
        </header>

        <TransitionGroup v-if="mediaList.length > 0" name="admin-list-shift" tag="ul" class="admin-media-list">
          <li v-for="item in mediaList" :key="item.id" class="admin-media-card">
            <div class="admin-media-thumb">
              <img v-if="item.mimeType.startsWith('image/')" :src="item.url" :alt="item.name" loading="lazy" />
              <Image v-else class="icon icon--md icon--stroke-strong" aria-hidden="true" />
            </div>

            <div class="admin-media-main">
              <h4>{{ item.name }}</h4>
              <p>{{ item.url }}</p>
              <ul class="admin-media-meta">
                <li>{{ item.mimeType }}</li>
                <li>{{ formatSize(item.size) }}</li>
                <li>{{ formatDateTime(item.uploadedAt) }}</li>
                <li>{{ item.inUse ? `已引用 ${item.usageCount ?? 1} 次` : '未引用' }}</li>
              </ul>
            </div>

            <div class="admin-media-actions">
              <button type="button" class="admin-action-btn icon-host" @click="copyMediaUrl(item.url)">
                <Copy class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
                <span>复制</span>
              </button>
              <a class="admin-action-btn icon-host" :href="item.url" target="_blank" rel="noopener noreferrer">
                <Link2 class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
                <span>打开</span>
              </a>
              <button
                type="button"
                class="admin-action-btn admin-action-btn--danger icon-host"
                :disabled="pending"
                @click="deleteMediaItem(item)"
              >
                <Trash2 class="icon icon--sm icon--stroke-strong icon--react" aria-hidden="true" />
                <span>删除</span>
              </button>
            </div>
          </li>
        </TransitionGroup>

        <article v-else class="admin-empty-card">
          <h3>暂无资源</h3>
          <p>录入第一条资源后，将在这里统一管理。</p>
        </article>
      </article>
    </section>
  </section>
</template>
