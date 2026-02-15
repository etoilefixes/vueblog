/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_BACKEND_API?: string
  readonly VITE_BLOG_API_BASE_URL?: string
  readonly VITE_USE_ADMIN_BACKEND_API?: string
  readonly VITE_ADMIN_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
