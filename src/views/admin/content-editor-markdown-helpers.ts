import type { BlogPostSection, BlogSectionImage } from '@/types/blog'
import { sectionIdFromTitle } from './content-editor-draft-helpers'

const parseMarkdownImage = (line: string): BlogSectionImage | null => {
  const match = line.match(/^!\[(.*?)\]\((.+)\)$/)

  if (!match) {
    return null
  }

  const alt = match[1]?.trim() || '插图'
  const body = match[2]?.trim() ?? ''

  if (!body) {
    return null
  }

  const withCaption = body.match(/^(\S+)\s+"(.+)"$/)
  if (withCaption) {
    const src = withCaption[1] ?? ''
    if (!src) {
      return null
    }

    const caption = (withCaption[2] ?? '').trim()

    return {
      src,
      alt,
      caption: caption || undefined,
    }
  }

  return {
    src: body,
    alt,
  }
}

const createUniqueSectionId = (title: string, index: number, seen: Set<string>) => {
  const base = sectionIdFromTitle(title) || `section-${index + 1}`
  let next = base
  let suffix = 2

  while (seen.has(next)) {
    next = `${base}-${suffix}`
    suffix += 1
  }

  seen.add(next)
  return next
}

export const parseMarkdownSections = (markdown: string): BlogPostSection[] => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const sections: Array<Omit<BlogPostSection, 'id'>> = []
  const defaultTitle = '正文'

  let current: Omit<BlogPostSection, 'id'> = {
    title: defaultTitle,
    paragraphs: [],
    highlights: [],
    images: [],
  }

  let codeLanguage = ''
  let codeLines: string[] | null = null
  let paragraphLines: string[] = []

  const flushParagraphLines = () => {
    if (paragraphLines.length === 0) {
      return
    }

    const paragraph = paragraphLines.join('\n').trim()
    paragraphLines = []

    if (!paragraph) {
      return
    }

    current.paragraphs = [...current.paragraphs, paragraph]
  }

  const pushCurrent = () => {
    flushParagraphLines()

    const hasContent =
      current.paragraphs.length > 0 ||
      (current.highlights?.length ?? 0) > 0 ||
      (current.images?.length ?? 0) > 0 ||
      Boolean(current.snippet)

    if (!hasContent) {
      return
    }

    const normalized: Omit<BlogPostSection, 'id'> = {
      title: current.title.trim() || defaultTitle,
      paragraphs: current.paragraphs,
    }

    if (current.highlights && current.highlights.length > 0) {
      normalized.highlights = current.highlights
    }

    if (current.images && current.images.length > 0) {
      normalized.images = current.images
    }

    if (current.snippet) {
      normalized.snippet = current.snippet
    }

    sections.push(normalized)
  }

  const resetCurrent = (title: string) => {
    current = {
      title,
      paragraphs: [],
      highlights: [],
      images: [],
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (codeLines) {
      if (line.startsWith('```')) {
        flushParagraphLines()
        const code = codeLines.join('\n').trimEnd()
        if (code) {
          current.snippet = {
            language: codeLanguage || 'text',
            code,
          }
        }
        codeLines = null
        codeLanguage = ''
        continue
      }

      codeLines.push(rawLine)
      continue
    }

    const headingMatch = line.match(/^#{1,2}\s+(.+)$/)
    if (headingMatch) {
      const headingText = headingMatch[1] ?? ''
      flushParagraphLines()
      pushCurrent()
      resetCurrent(headingText.trim())
      continue
    }

    const fenceMatch = line.match(/^```([\w-]*)\s*$/)
    if (fenceMatch) {
      flushParagraphLines()
      codeLanguage = fenceMatch[1] ?? ''
      codeLines = []
      continue
    }

    const image = parseMarkdownImage(line)
    if (image) {
      flushParagraphLines()
      current.images = [...(current.images ?? []), image]
      continue
    }

    const highlightMatch = line.match(/^[-*+]\s+(.+)$/)
    if (highlightMatch) {
      const highlightText = highlightMatch[1] ?? ''
      const normalizedHighlight = highlightText.trim()

      // Preserve Markdown task list syntax instead of downcasting to plain highlights.
      if (/^\[(?: |x|X)\]\s+/.test(normalizedHighlight)) {
        paragraphLines.push(line)
        continue
      }

      flushParagraphLines()

      if (normalizedHighlight) {
        current.highlights = [...(current.highlights ?? []), normalizedHighlight]
      }
      continue
    }

    if (!line) {
      flushParagraphLines()
      continue
    }

    paragraphLines.push(line)
  }

  flushParagraphLines()

  if (codeLines && codeLines.length > 0) {
    current.snippet = {
      language: codeLanguage || 'text',
      code: codeLines.join('\n').trimEnd(),
    }
  }

  pushCurrent()

  const seenIds = new Set<string>()

  return sections.map((section, index) => ({
    ...section,
    id: createUniqueSectionId(section.title, index, seenIds),
  }))
}

export const serializeSectionsToMarkdown = (sections: BlogPostSection[]) => {
  if (sections.length === 0) {
    return ''
  }

  return sections
    .map((section) => {
      const blocks: string[] = []
      blocks.push(`## ${section.title}`)

      for (const paragraph of section.paragraphs) {
        const normalizedParagraph = paragraph.trimEnd()
        if (normalizedParagraph) {
          blocks.push(normalizedParagraph)
        }
      }

      if (section.highlights?.length) {
        blocks.push(section.highlights.map((item) => `- ${item}`).join('\n'))
      }

      if (section.images?.length) {
        const imageBlock = section.images
          .map((image) => {
            const alt = image.alt?.trim() || '插图'
            const caption = image.caption?.trim()

            if (caption) {
              return `![${alt}](${image.src} "${caption}")`
            }

            return `![${alt}](${image.src})`
          })
          .join('\n')

        if (imageBlock) {
          blocks.push(imageBlock)
        }
      }

      if (section.snippet) {
        blocks.push(`\`\`\`${section.snippet.language || 'text'}\n${section.snippet.code}\n\`\`\``)
      }

      return blocks.join('\n\n')
    })
    .join('\n\n')
}
