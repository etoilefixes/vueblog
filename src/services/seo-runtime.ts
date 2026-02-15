export interface RuntimeSeoMetaInput {
  title: string
  description: string
  canonicalUrl: string
  openGraphType: 'website' | 'article'
  imageUrl: string
  keywords?: string
  publishedTime?: string
  tags?: string[]
}

const ensureMeta = (selector: string, attributes: Record<string, string>) => {
  let element = document.head.querySelector(selector) as HTMLMetaElement | null

  if (!element) {
    element = document.createElement('meta')
    document.head.appendChild(element)
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element?.setAttribute(key, value)
  })
}

const ensureCanonical = (href: string) => {
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null

  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.appendChild(link)
  }

  link.href = href
}

const clearDynamicArticleTags = () => {
  document.head.querySelectorAll('meta[data-seo-article-tag="true"]').forEach((node) => {
    node.remove()
  })
}

const appendArticleTags = (tags: string[]) => {
  clearDynamicArticleTags()

  tags
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((tag) => {
      const meta = document.createElement('meta')
      meta.setAttribute('property', 'article:tag')
      meta.setAttribute('content', tag)
      meta.setAttribute('data-seo-article-tag', 'true')
      document.head.appendChild(meta)
    })
}

export const applyRuntimeSeoMeta = (input: RuntimeSeoMetaInput) => {
  document.title = input.title
  ensureCanonical(input.canonicalUrl)

  ensureMeta('meta[name="description"]', {
    name: 'description',
    content: input.description,
  })

  ensureMeta('meta[name="keywords"]', {
    name: 'keywords',
    content: input.keywords?.trim() || '',
  })

  ensureMeta('meta[property="og:title"]', {
    property: 'og:title',
    content: input.title,
  })
  ensureMeta('meta[property="og:description"]', {
    property: 'og:description',
    content: input.description,
  })
  ensureMeta('meta[property="og:type"]', {
    property: 'og:type',
    content: input.openGraphType,
  })
  ensureMeta('meta[property="og:url"]', {
    property: 'og:url',
    content: input.canonicalUrl,
  })
  ensureMeta('meta[property="og:image"]', {
    property: 'og:image',
    content: input.imageUrl,
  })

  ensureMeta('meta[name="twitter:card"]', {
    name: 'twitter:card',
    content: 'summary_large_image',
  })
  ensureMeta('meta[name="twitter:title"]', {
    name: 'twitter:title',
    content: input.title,
  })
  ensureMeta('meta[name="twitter:description"]', {
    name: 'twitter:description',
    content: input.description,
  })
  ensureMeta('meta[name="twitter:image"]', {
    name: 'twitter:image',
    content: input.imageUrl,
  })

  if (input.openGraphType === 'article' && input.publishedTime) {
    ensureMeta('meta[property="article:published_time"]', {
      property: 'article:published_time',
      content: input.publishedTime,
    })
    appendArticleTags(input.tags ?? [])
  } else {
    const published = document.head.querySelector('meta[property="article:published_time"]')
    published?.remove()
    clearDynamicArticleTags()
  }
}
