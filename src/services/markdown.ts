import MarkdownIt from 'markdown-it'
import DOMPurify, { type Config as DOMPurifyConfig } from 'dompurify'
import markdownItAnchor from 'markdown-it-anchor'
import { full as markdownItEmoji } from 'markdown-it-emoji'
import markdownItFootnote from 'markdown-it-footnote'
import markdownItKatex from 'markdown-it-katex'
import markdownItTaskLists from 'markdown-it-task-lists'
import markdownItTocDoneRight from 'markdown-it-toc-done-right'
import 'katex/dist/katex.min.css'

import type { BlogPostSection } from '@/types/blog'

const markdownFeaturePattern =
  /(^|\n)\s*(?:#{1,6}\s|`{3,}|[-*_]{3,}\s*$|!\[[^\]]*]\([^)]+\)|\[\^[^\]]+](?::|\s|$)|\|.+\||(?:-|\*|\+)\s+\[[ xX]\]|\[(?: |x|X)\]\s+)/m
const inlineMarkdownPattern = /(?:\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|\[[^\]]+\]\([^)]+\)|\\[*_])/m
const markdownHtmlPattern = /<!--[\s\S]*?-->|<\/?[a-zA-Z][^>\n]*>/m
const markdownMathPattern = /(^|\n)\s*\$\$[\s\S]*?\$\$\s*($|\n)|(^|[^\\])\$[^$\n]+?\$/m
const markdownTocPattern = /(^|\n)\s*\[(?:_?toc_?)\]\s*($|\n)/im
const markdownEmojiPattern = /:[a-z0-9_+\-]+:/i
const markdownAutolinkPattern = /(?:https?:\/\/|www\.)[^\s<]+/i

const taskListLinePattern = /^(\s*)\[( |x|X)\]\s+/gm
const anchorAttributePattern = /\sid="([^"]+)"/g
const hashHrefAttributePattern = /\shref="#([^"]+)"/g
const fenceLinePattern = /^\s*```/
const externalHttpUrlPattern = /^https?:\/\//i
const youtubeHostPattern = /(?:^|\.)youtube\.com$|(?:^|\.)youtu\.be$/i
const bilibiliHostPattern = /(?:^|\.)bilibili\.com$/i
const bilibiliShortHostPattern = /(?:^|\.)b23\.tv$/i
const videoIdPattern = /^[A-Za-z0-9_-]{6,}$/

interface SocialProvider {
  id: string
  label: string
  domains: string[]
}

const socialProviders: SocialProvider[] = [
  { id: 'bilibili', label: 'Bilibili', domains: ['bilibili.com', 'b23.tv'] },
  { id: 'youtube', label: 'YouTube', domains: ['youtube.com', 'youtu.be'] },
  { id: 'x', label: 'X', domains: ['x.com', 'twitter.com'] },
  { id: 'github', label: 'GitHub', domains: ['github.com'] },
  { id: 'zhihu', label: '知乎', domains: ['zhihu.com'] },
  { id: 'weibo', label: '微博', domains: ['weibo.com'] },
  { id: 'xiaohongshu', label: '小红书', domains: ['xiaohongshu.com', 'xhslink.com'] },
  { id: 'douyin', label: '抖音', domains: ['douyin.com'] },
  { id: 'tiktok', label: 'TikTok', domains: ['tiktok.com'] },
  { id: 'instagram', label: 'Instagram', domains: ['instagram.com'] },
  { id: 'facebook', label: 'Facebook', domains: ['facebook.com'] },
  { id: 'linkedin', label: 'LinkedIn', domains: ['linkedin.com'] },
  { id: 'telegram', label: 'Telegram', domains: ['t.me'] },
]

const markdownSanitizeConfig: DOMPurifyConfig = {
  USE_PROFILES: {
    html: true,
    svg: true,
    mathMl: true,
  },
  ADD_TAGS: ['iframe', 'video', 'audio', 'source', 'details', 'summary', 'kbd'],
  ADD_ATTR: [
    'allow',
    'allowfullscreen',
    'autoplay',
    'controls',
    'height',
    'loading',
    'loop',
    'muted',
    'open',
    'playsinline',
    'poster',
    'preload',
    'referrerpolicy',
    'sandbox',
    'target',
    'width',
  ],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'style', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'option'],
}

export interface RenderMarkdownOptions {
  anchorIdPrefix?: string
}

const slugifyHeading = (value: string) => {
  return encodeURIComponent(String(value).trim().toLowerCase().replace(/\s+/g, '-'))
}

const normalizeAnchorPrefix = (value?: string) => {
  if (!value) {
    return ''
  }

  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

const withPrefixedAnchors = (html: string, rawPrefix?: string) => {
  const prefix = normalizeAnchorPrefix(rawPrefix)

  if (!prefix) {
    return html
  }

  const scopedPrefix = `${prefix}-`

  return html
    .replace(anchorAttributePattern, (_match, id: string) => ` id="${scopedPrefix}${id}"`)
    .replace(hashHrefAttributePattern, (_match, id: string) => ` href="#${scopedPrefix}${id}"`)
}

const normalizeHostName = (value: string) => {
  return value.trim().toLowerCase()
}

const hostMatchesDomain = (host: string, domain: string) => {
  return host === domain || host.endsWith(`.${domain}`)
}

const parseHttpUrl = (value: string) => {
  const raw = value.trim()
  if (!raw) {
    return null
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`

  try {
    const parsed = new URL(withProtocol)
    if (!externalHttpUrlPattern.test(parsed.protocol + '//')) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

const trimSocialText = (value: string, max = 78) => {
  if (value.length <= max) {
    return value
  }

  return `${value.slice(0, max - 1)}…`
}

const buildSocialLinkText = (url: URL) => {
  const host = normalizeHostName(url.hostname).replace(/^www\./, '')
  const pathname = `${url.pathname || ''}${url.search || ''}`.replace(/\/+$/, '')
  if (!pathname || pathname === '/') {
    return host
  }

  return trimSocialText(`${host}${pathname}`)
}

const resolveSocialProvider = (url: URL) => {
  const host = normalizeHostName(url.hostname)
  return socialProviders.find((provider) => provider.domains.some((domain) => hostMatchesDomain(host, domain))) ?? null
}

const readYouTubeVideoId = (url: URL) => {
  const host = normalizeHostName(url.hostname)
  if (!youtubeHostPattern.test(host)) {
    return null
  }

  if (hostMatchesDomain(host, 'youtu.be')) {
    const id = url.pathname.split('/').filter(Boolean)[0] ?? ''
    return videoIdPattern.test(id) ? id : null
  }

  const pathSegments = url.pathname.split('/').filter(Boolean)

  if (url.pathname === '/watch') {
    const id = (url.searchParams.get('v') ?? '').trim()
    return videoIdPattern.test(id) ? id : null
  }

  if (pathSegments.length >= 2 && ['shorts', 'embed', 'live'].includes(pathSegments[0] ?? '')) {
    const id = (pathSegments[1] ?? '').trim()
    return videoIdPattern.test(id) ? id : null
  }

  return null
}

const buildYouTubeEmbedUrl = (videoId: string) => {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0`
}

const buildBilibiliEmbedUrl = (url: URL) => {
  const host = normalizeHostName(url.hostname)
  if (!bilibiliHostPattern.test(host)) {
    return null
  }

  const pageRaw = Number(url.searchParams.get('p') ?? '1')
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.trunc(pageRaw) : 1
  const path = url.pathname

  const bvidMatch = path.match(/\/video\/(BV[0-9A-Za-z]+)/i)
  if (bvidMatch?.[1]) {
    return `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvidMatch[1])}&page=${page}&high_quality=1&as_wide=1`
  }

  const aidMatch = path.match(/\/video\/av(\d+)/i)
  if (aidMatch?.[1]) {
    return `https://player.bilibili.com/player.html?aid=${encodeURIComponent(aidMatch[1])}&page=${page}&high_quality=1&as_wide=1`
  }

  return null
}

const isStandaloneAnchor = (anchor: HTMLAnchorElement) => {
  const parent = anchor.parentElement
  if (!parent || parent.tagName !== 'P') {
    return false
  }

  const meaningfulNodes = Array.from(parent.childNodes).filter((node) => {
    return !(node.nodeType === Node.TEXT_NODE && !(node.textContent ?? '').trim())
  })

  return meaningfulNodes.length === 1 && meaningfulNodes[0] === anchor
}

const replaceAnchorParagraphWithIframe = (anchor: HTMLAnchorElement, src: string, title: string) => {
  const paragraph = anchor.parentElement
  if (!paragraph) {
    return
  }

  const iframe = anchor.ownerDocument.createElement('iframe')
  iframe.setAttribute('src', src)
  iframe.setAttribute('title', title)
  paragraph.replaceWith(iframe)
  sanitizeIframeNode(iframe)
}

const decorateSocialAnchorCard = (anchor: HTMLAnchorElement, provider: SocialProvider, url: URL) => {
  anchor.classList.add('md-social-link', `md-social-link--${provider.id}`)
  anchor.replaceChildren()

  const badge = anchor.ownerDocument.createElement('span')
  badge.className = 'md-social-link__badge'
  badge.textContent = provider.label

  const text = anchor.ownerDocument.createElement('span')
  text.className = 'md-social-link__text'
  text.textContent = buildSocialLinkText(url)

  anchor.append(badge, text)
}

const sanitizeMarkdownHtml = (html: string) => {
  return DOMPurify.sanitize(html, markdownSanitizeConfig)
}

const normalizeEmbedRatio = (widthRaw: string | null, heightRaw: string | null) => {
  const width = Number(widthRaw)
  const height = Number(heightRaw)

  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return `${width} / ${height}`
  }

  return '16 / 9'
}

const wrapEmbedElement = (node: HTMLElement, className: string, ratio: string) => {
  const parent = node.parentElement
  if (parent?.classList.contains('md-embed') && parent.classList.contains(className)) {
    parent.style.setProperty('--md-embed-ratio', ratio)
    return
  }

  const wrapper = node.ownerDocument.createElement('div')
  wrapper.className = `md-embed ${className}`
  wrapper.style.setProperty('--md-embed-ratio', ratio)

  node.parentNode?.insertBefore(wrapper, node)
  wrapper.appendChild(node)
}

const sanitizeIframeNode = (iframe: HTMLIFrameElement) => {
  const src = (iframe.getAttribute('src') ?? '').trim()
  if (!externalHttpUrlPattern.test(src)) {
    iframe.remove()
    return
  }

  iframe.classList.add('md-embed-frame')
  iframe.setAttribute('loading', iframe.getAttribute('loading') || 'lazy')
  iframe.setAttribute(
    'referrerpolicy',
    iframe.getAttribute('referrerpolicy') || 'strict-origin-when-cross-origin',
  )
  iframe.setAttribute(
    'sandbox',
    iframe.getAttribute('sandbox') || 'allow-scripts allow-same-origin allow-popups allow-presentation',
  )
  if (!iframe.hasAttribute('allowfullscreen')) {
    iframe.setAttribute('allowfullscreen', '')
  }

  const ratio = normalizeEmbedRatio(iframe.getAttribute('width'), iframe.getAttribute('height'))
  iframe.removeAttribute('width')
  iframe.removeAttribute('height')
  wrapEmbedElement(iframe, 'md-embed--iframe', ratio)
}

const sanitizeMediaNode = (media: HTMLMediaElement, className: string) => {
  media.classList.add('md-embed-media')
  if (!media.hasAttribute('controls')) {
    media.setAttribute('controls', '')
  }

  if (!media.hasAttribute('preload')) {
    media.setAttribute('preload', 'metadata')
  }

  const ratio = normalizeEmbedRatio(media.getAttribute('width'), media.getAttribute('height'))
  media.removeAttribute('width')
  media.removeAttribute('height')
  wrapEmbedElement(media, className, ratio)
}

const optimizeEmbeddedHtml = (html: string) => {
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return html
  }

  const parser = new window.DOMParser()
  const documentNode = parser.parseFromString(`<div id="markdown-root">${html}</div>`, 'text/html')
  const root = documentNode.getElementById('markdown-root')

  if (!root) {
    return html
  }

  const standaloneAnchors = Array.from(root.querySelectorAll('a[href]')).filter((node): node is HTMLAnchorElement => {
    return node instanceof HTMLAnchorElement && isStandaloneAnchor(node)
  })

  standaloneAnchors.forEach((anchor) => {
    const href = (anchor.getAttribute('href') ?? '').trim()
    const parsedUrl = parseHttpUrl(href)
    if (!parsedUrl) {
      return
    }

    const host = normalizeHostName(parsedUrl.hostname)

    const youtubeVideoId = readYouTubeVideoId(parsedUrl)
    if (youtubeVideoId) {
      replaceAnchorParagraphWithIframe(anchor, buildYouTubeEmbedUrl(youtubeVideoId), 'YouTube 视频')
      return
    }

    if (bilibiliShortHostPattern.test(host)) {
      const provider = resolveSocialProvider(parsedUrl)
      if (provider) {
        decorateSocialAnchorCard(anchor, provider, parsedUrl)
      }
      return
    }

    const bilibiliEmbedUrl = buildBilibiliEmbedUrl(parsedUrl)
    if (bilibiliEmbedUrl) {
      replaceAnchorParagraphWithIframe(anchor, bilibiliEmbedUrl, '哔哩哔哩视频')
      return
    }

    const provider = resolveSocialProvider(parsedUrl)
    if (provider) {
      decorateSocialAnchorCard(anchor, provider, parsedUrl)
    }
  })

  root.querySelectorAll('iframe').forEach((node) => sanitizeIframeNode(node as HTMLIFrameElement))
  root.querySelectorAll('video').forEach((node) => sanitizeMediaNode(node as HTMLVideoElement, 'md-embed--video'))
  root.querySelectorAll('audio').forEach((node) => sanitizeMediaNode(node as HTMLAudioElement, 'md-embed--audio'))

  root.querySelectorAll('a[href]').forEach((node) => {
    const href = (node.getAttribute('href') ?? '').trim()
    const parsedUrl = parseHttpUrl(href)
    if (!parsedUrl) {
      return
    }

    const normalizedHref = parsedUrl.toString()
    node.setAttribute('href', normalizedHref)

    if (!node.hasAttribute('target')) {
      node.setAttribute('target', '_blank')
    }

    const rel = node.getAttribute('rel') ?? ''
    const relParts = new Set(rel.split(/\s+/).map((item) => item.trim()).filter(Boolean))
    relParts.add('noopener')
    relParts.add('noreferrer')
    node.setAttribute('rel', Array.from(relParts).join(' '))
  })

  return root.innerHTML
}

const createMarkdownRenderer = () => {
  const renderer = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  })

  renderer.use(markdownItFootnote)
  renderer.use(markdownItTaskLists, {
    enabled: true,
    label: true,
    labelAfter: true,
  })
  renderer.use(markdownItEmoji)
  renderer.use(markdownItKatex, {
    throwOnError: false,
    errorColor: '#cc0000',
  })
  renderer.use(markdownItAnchor, {
    level: [1, 2, 3, 4, 5, 6],
    slugify: slugifyHeading,
    uniqueSlugStartIndex: 1,
  })
  renderer.use(markdownItTocDoneRight, {
    slugify: slugifyHeading,
    uniqueSlugStartIndex: 1,
    level: [1, 2, 3, 4, 5, 6],
    listType: 'ul',
    containerClass: 'md-toc',
    listClass: 'md-toc__list',
    itemClass: 'md-toc__item',
    linkClass: 'md-toc__link',
  })

  return renderer
}

const markdownRenderer = createMarkdownRenderer()

const escapeImageTitle = (value: string) => {
  return value.replace(/"/g, '\\"')
}

const normalizeTaskListLine = (line: string) => {
  if (/^\[(?: |x|X)\]\s+/.test(line)) {
    return `- ${line}`
  }

  return line
}

const normalizeMalformedHtmlCommentLine = (line: string) => {
  let normalized = line.replace(/^(\s*)!--/, '$1<!--')

  if (/^\s*<!--/.test(normalized) && !/-->/.test(normalized)) {
    normalized = normalized.replace(/(?:--|–)(\s*)$/, '-->$1')
  }

  return normalized
}

const normalizeMalformedHtmlComments = (input: string) => {
  const lines = input.split('\n')
  let inFence = false

  return lines
    .map((line) => {
      if (fenceLinePattern.test(line)) {
        inFence = !inFence
        return line
      }

      if (inFence) {
        return line
      }

      return normalizeMalformedHtmlCommentLine(line)
    })
    .join('\n')
}

export const normalizeMarkdownInput = (input: string) => {
  const normalizedLineBreaks = input.replace(/\r\n?/g, '\n')
  const normalizedComments = normalizeMalformedHtmlComments(normalizedLineBreaks)
  return normalizedComments.replace(taskListLinePattern, '$1- [$2] ')
}

export const shouldRenderSectionAsMarkdown = (section: BlogPostSection) => {
  if (section.highlights?.some((item) => /^\[(?: |x|X)\]\s+/.test(item.trim()))) {
    return true
  }

  const body = section.paragraphs.join('\n')
  return (
    markdownFeaturePattern.test(body) ||
    inlineMarkdownPattern.test(body) ||
    markdownHtmlPattern.test(body) ||
    markdownMathPattern.test(body) ||
    markdownTocPattern.test(body) ||
    markdownEmojiPattern.test(body) ||
    markdownAutolinkPattern.test(body)
  )
}

export const buildSectionMarkdown = (section: BlogPostSection, compactParagraphs?: boolean) => {
  const blocks: string[] = []
  const shouldCompactParagraphs =
    compactParagraphs !== undefined ? compactParagraphs : !section.paragraphs.some((item) => item.includes('\n'))
  const paragraphJoiner = shouldCompactParagraphs ? '\n' : '\n\n'
  const paragraphBlock = section.paragraphs
    .map((item) => item.trimEnd())
    .filter(Boolean)
    .join(paragraphJoiner)

  if (paragraphBlock) {
    blocks.push(paragraphBlock)
  }

  if (section.highlights?.length) {
    const highlightBlock = section.highlights
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        if (/^[-*+]\s+/.test(item) || /^\d+\.\s+/.test(item)) {
          return item
        }

        const normalizedTaskLine = normalizeTaskListLine(item)
        return normalizedTaskLine.startsWith('- ') ? normalizedTaskLine : `- ${item}`
      })
      .join('\n')

    if (highlightBlock) {
      blocks.push(highlightBlock)
    }
  }

  if (section.images?.length) {
    const imageBlocks = section.images
      .map((image) => {
        const src = image.src.trim()
        if (!src) {
          return ''
        }

        const alt = (image.alt || '插图').trim()
        const caption = image.caption?.trim()
        if (caption) {
          return `![${alt}](${src} "${escapeImageTitle(caption)}")`
        }

        return `![${alt}](${src})`
      })
      .filter(Boolean)

    if (imageBlocks.length) {
      blocks.push(imageBlocks.join('\n'))
    }
  }

  if (section.snippet?.code.trim()) {
    const language = section.snippet.language?.trim() || 'text'
    blocks.push(`\`\`\`${language}\n${section.snippet.code.trimEnd()}\n\`\`\``)
  }

  return normalizeMarkdownInput(blocks.join('\n\n'))
}

export const renderMarkdownToHtml = (input: string, options: RenderMarkdownOptions = {}) => {
  const normalized = normalizeMarkdownInput(input).trim()
  if (!normalized) {
    return ''
  }

  const rendered = markdownRenderer.render(normalized)
  const sanitized = sanitizeMarkdownHtml(rendered)
  const optimized = optimizeEmbeddedHtml(sanitized)
  return withPrefixedAnchors(optimized, options.anchorIdPrefix)
}
