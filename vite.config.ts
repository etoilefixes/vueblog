import { fileURLToPath, URL } from 'node:url'

import type { PluginOption } from 'vite'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const SITE_URL = String(process.env.VITE_SITE_URL ?? 'https://example.com').replace(/\/+$/, '')
const SITE_TITLE = String(process.env.VITE_SITE_TITLE ?? 'Blog').trim() || 'Blog'
const SITE_DESCRIPTION =
  String(process.env.VITE_SITE_DESCRIPTION ?? 'Personal blog powered by API-first content pipeline.').trim() ||
  'Personal blog powered by API-first content pipeline.'
const DEV_API_PROXY_TARGET = String(process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
)
const DEV_SERVER_HOST = String(process.env.VITE_DEV_SERVER_HOST ?? '127.0.0.1').trim() || '127.0.0.1'
const DEV_SERVER_PORT = Number(process.env.VITE_DEV_SERVER_PORT ?? 5173) || 5173

const formatDateToRss = (value: string) => {
  return new Date(value).toUTCString()
}

const escapeXml = (value: string) => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const wrapText = (value: string, maxLength: number) => {
  const chars = [...value]
  const lines: string[] = []

  for (let index = 0; index < chars.length; index += maxLength) {
    lines.push(chars.slice(index, index + maxLength).join(''))
  }

  return lines
}

const buildOpenGraphSvg = (title: string, subtitle: string, tag: string) => {
  const titleLines = wrapText(title, 16).slice(0, 2)
  const subtitleLines = wrapText(subtitle, 24).slice(0, 2)
  const safeTitleLines = titleLines.map((line) => escapeXml(line))
  const safeSubtitleLines = subtitleLines.map((line) => escapeXml(line))
  const safeTag = escapeXml(tag)

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f6f92"/>
      <stop offset="55%" stop-color="#20a294"/>
      <stop offset="100%" stop-color="#ff965e"/>
    </linearGradient>
    <radialGradient id="orbA" cx="20%" cy="15%" r="60%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.35)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#orbA)"/>
  <rect x="58" y="56" width="1084" height="518" rx="30" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)"/>
  <text x="92" y="126" fill="rgba(255,255,255,0.86)" font-size="34" font-family="'Segoe UI', 'PingFang SC', sans-serif">${safeTag}</text>
  <text x="92" y="248" fill="#ffffff" font-size="68" font-family="'Segoe UI', 'PingFang SC', sans-serif" font-weight="700">${safeTitleLines[0] ?? ''}</text>
  <text x="92" y="326" fill="#ffffff" font-size="68" font-family="'Segoe UI', 'PingFang SC', sans-serif" font-weight="700">${safeTitleLines[1] ?? ''}</text>
  <text x="92" y="424" fill="rgba(235,246,255,0.95)" font-size="33" font-family="'Segoe UI', 'PingFang SC', sans-serif">${safeSubtitleLines[0] ?? ''}</text>
  <text x="92" y="472" fill="rgba(235,246,255,0.95)" font-size="33" font-family="'Segoe UI', 'PingFang SC', sans-serif">${safeSubtitleLines[1] ?? ''}</text>
  <text x="92" y="548" fill="rgba(235,246,255,0.82)" font-size="28" font-family="'Segoe UI', 'PingFang SC', sans-serif">${escapeXml(SITE_TITLE)}</text>
</svg>`
}

const buildSitemapXml = () => {
  const staticRoutes = ['/', '/tags', '/categories', '/timeline', '/links', '/about']
  const today = new Date().toISOString().slice(0, 10)
  const routeEntries = staticRoutes.map((routePath) => {
    return `<url><loc>${SITE_URL}${routePath}</loc><lastmod>${today}</lastmod></url>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routeEntries.join('\n')}
</urlset>`
}

const buildRssXml = () => {
  const now = new Date().toISOString()

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${escapeXml(SITE_TITLE)}</title>
  <link>${SITE_URL}</link>
  <description>${escapeXml(SITE_DESCRIPTION)}</description>
  <language>zh-CN</language>
  <lastBuildDate>${formatDateToRss(now)}</lastBuildDate>
</channel>
</rss>`
}

const buildRobotsTxt = () => {
  return `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`
}

const seoArtifactsPlugin = (): PluginOption => {
  return {
    name: 'blog-seo-artifacts',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: buildSitemapXml(),
      })

      this.emitFile({
        type: 'asset',
        fileName: 'rss.xml',
        source: buildRssXml(),
      })

      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: buildRobotsTxt(),
      })

      this.emitFile({
        type: 'asset',
        fileName: 'og/default.svg',
        source: buildOpenGraphSvg('站点内容由后台实时驱动', SITE_DESCRIPTION, 'BLOG'),
      })

      this.emitFile({
        type: 'asset',
        fileName: 'og/home.svg',
        source: buildOpenGraphSvg(SITE_TITLE, SITE_DESCRIPTION, 'HOME'),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const plugins: PluginOption[] = [vue(), seoArtifactsPlugin()]
  const alias: Record<string, string> = {
    '@': fileURLToPath(new URL('./src', import.meta.url)),
  }

  if (command === 'serve') {
    plugins.push(vueDevTools())
  } else {
    alias['vue-router'] = 'vue-router/dist/vue-router.esm-browser.prod.js'
  }

  return {
    define: {
      __VUE_OPTIONS_API__: false,
      __VUE_PROD_DEVTOOLS__: false,
    },
    server: {
      host: DEV_SERVER_HOST,
      port: DEV_SERVER_PORT,
      strictPort: true,
      hmr: {
        host: DEV_SERVER_HOST,
        clientPort: DEV_SERVER_PORT,
        protocol: 'ws',
      },
      proxy: {
        '/api': {
          target: DEV_API_PROXY_TARGET,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/lucide-vue-next/dist/esm/icons/')) {
              return 'lucide-icons'
            }

            if (id.includes('node_modules/lucide-vue-next/dist/esm/')) {
              return 'lucide-core'
            }

            if (id.includes('node_modules/markdown-it/')) {
              return 'markdown-it-core'
            }

            if (id.includes('node_modules/markdown-it-')) {
              return 'markdown-it-plugins'
            }

            if (id.includes('node_modules/katex')) {
              return 'markdown-katex'
            }

            if (id.includes('node_modules/dompurify')) {
              return 'markdown-sanitize'
            }

            return undefined
          },
        },
      },
    },
    plugins,
    resolve: {
      alias,
    },
  }
})
