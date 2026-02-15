import type { BlogPostSection, BlogSectionImage } from '@/types/blog'

export interface EditorSectionDraft {
  uid: string
  id: string
  title: string
  paragraphsText: string
  highlightsText: string
  imagesText: string
  snippetLanguage: string
  snippetCode: string
}

export const parseTagsText = (value: string) =>
  value
    .split(/[,\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean)

export const uniqTags = (tags: string[]) => {
  const seen = new Set<string>()
  const next: string[] = []

  for (const tag of tags) {
    if (seen.has(tag)) {
      continue
    }

    seen.add(tag)
    next.push(tag)
  }

  return next
}

const serializeImageLine = (image: BlogSectionImage) => {
  const src = image.src.trim()
  const alt = image.alt.trim()
  const caption = image.caption?.trim() ?? ''

  if (!src) {
    return ''
  }

  if (caption) {
    return `${src} | ${alt || '插图'} | ${caption}`
  }

  if (alt) {
    return `${src} | ${alt}`
  }

  return src
}

const parseImageLine = (line: string): BlogSectionImage | null => {
  const parts = line
    .split('|')
    .map((part) => part.trim())
    .filter((part, index) => index === 0 || part.length > 0)

  const src = parts[0] ?? ''

  if (!src) {
    return null
  }

  const alt = parts[1] ?? '插图'
  const caption = parts.slice(2).join(' | ').trim()

  return {
    src,
    alt,
    caption: caption || undefined,
  }
}

const parseImagesText = (value: string) => {
  return splitLines(value)
    .map((line) => parseImageLine(line))
    .filter((item): item is BlogSectionImage => item !== null)
}

export const sectionIdFromTitle = (text: string) => {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (normalized) {
    return normalized
  }

  return `section-${Date.now().toString(36)}`
}

export const createSectionDraft = (section?: BlogPostSection): EditorSectionDraft => {
  return {
    uid: `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    id: section?.id ?? '',
    title: section?.title ?? '',
    paragraphsText: section?.paragraphs.join('\n') ?? '',
    highlightsText: section?.highlights?.join('\n') ?? '',
    imagesText: section?.images?.map((image) => serializeImageLine(image)).filter(Boolean).join('\n') ?? '',
    snippetLanguage: section?.snippet?.language ?? '',
    snippetCode: section?.snippet?.code ?? '',
  }
}

export const splitLines = (value: string) =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)

export const buildStructuredSections = (drafts: EditorSectionDraft[]): BlogPostSection[] => {
  return drafts
    .map((draft) => {
      const sectionTitle = draft.title.trim()
      const paragraphs = splitLines(draft.paragraphsText)
      const highlights = splitLines(draft.highlightsText)
      const images = parseImagesText(draft.imagesText)

      if (!sectionTitle || paragraphs.length === 0) {
        return null
      }

      const section: BlogPostSection = {
        id: draft.id.trim() || sectionIdFromTitle(sectionTitle),
        title: sectionTitle,
        paragraphs,
      }

      if (highlights.length > 0) {
        section.highlights = highlights
      }

      if (images.length > 0) {
        section.images = images
      }

      if (draft.snippetLanguage.trim() && draft.snippetCode.trim()) {
        section.snippet = {
          language: draft.snippetLanguage.trim(),
          code: draft.snippetCode.trim(),
        }
      }

      return section
    })
    .filter((item): item is BlogPostSection => item !== null)
}
