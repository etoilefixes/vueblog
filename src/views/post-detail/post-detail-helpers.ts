import { Flame, Handshake, Sparkles, Target, ThumbsUp } from 'lucide-vue-next'
import type { Component } from 'vue'

export interface QuickInsertAction {
  id: string
  label: string
  text: string
  icon: Component
}

export const quickInsertActions: QuickInsertAction[] = [
  {
    id: 'insight',
    label: '有启发',
    text: '这段很有启发，准备落地实践。',
    icon: Sparkles,
  },
  {
    id: 'agree',
    label: '赞同',
    text: '很赞同这个思路，清晰而且可执行。',
    icon: ThumbsUp,
  },
  {
    id: 'focus',
    label: '命中痛点',
    text: '这个点正好命中我当前遇到的问题。',
    icon: Target,
  },
  {
    id: 'thanks',
    label: '感谢',
    text: '感谢分享，细节非常有帮助。',
    icon: Handshake,
  },
  {
    id: 'try',
    label: '想试试',
    text: '这个方案很有意思，准备今晚试一版。',
    icon: Flame,
  },
]

const codeKeywords: Record<string, string[]> = {
  ts: ['const', 'let', 'var', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'import', 'from', 'export', 'default', 'type', 'interface', 'extends', 'new', 'async', 'await'],
  js: ['const', 'let', 'var', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'import', 'from', 'export', 'default', 'new', 'async', 'await'],
  css: ['display', 'position', 'color', 'background', 'border', 'padding', 'margin', 'animation', 'transition', 'transform', 'width', 'height', 'grid', 'flex', 'absolute', 'relative', 'fixed', 'sticky', 'linear-gradient', 'radial-gradient'],
  vue: ['template', 'script', 'style', 'setup', 'defineProps', 'defineEmits', 'computed', 'ref', 'watch', 'onMounted', 'onBeforeUnmount'],
}

const escapeRegExp = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const escapeHtml = (value: string) => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const highlightSnippet = (source: string, language: string) => {
  const placeholderTokens: string[] = []

  const stash = (value: string, className: string) => {
    const token = `@@TOKEN_${placeholderTokens.length}@@`
    placeholderTokens.push(`<span class="code-token ${className}">${escapeHtml(value)}</span>`)
    return token
  }

  let working = source

  working = working.replace(/`(?:\\.|[^`\\])*`/g, (value) => stash(value, 'code-token--string'))
  working = working.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, (value) =>
    stash(value, 'code-token--string'),
  )
  working = working.replace(/\/\*[\s\S]*?\*\//g, (value) => stash(value, 'code-token--comment'))
  working = working.replace(/\/\/[^\n]*/g, (value) => stash(value, 'code-token--comment'))

  let escaped = escapeHtml(working)

  const keywords = codeKeywords[language] ?? codeKeywords.ts ?? []
  const keywordSet = new Set(keywords)
  const tokenPattern = new RegExp(
    `\\b(${keywords.map(escapeRegExp).join('|')})\\b|\\b\\d+(?:\\.\\d+)?\\b|\\b[A-Za-z_$][\\w$]*\\b(?=\\s*\\()`,
    'g',
  )

  escaped = escaped.replace(tokenPattern, (value) => {
    if (keywordSet.has(value)) {
      return `<span class="code-token code-token--keyword">${value}</span>`
    }

    if (/^\d/.test(value)) {
      return `<span class="code-token code-token--number">${value}</span>`
    }

    return `<span class="code-token code-token--function">${value}</span>`
  })

  return escaped.replace(/@@TOKEN_(\d+)@@/g, (_, index) => {
    return placeholderTokens[Number(index)] ?? ''
  })
}

export const getSnippetLines = (source: string, language: string) => {
  return source.split('\n').map((line) => {
    const highlighted = highlightSnippet(line, language)
    return highlighted || '&nbsp;'
  })
}

export const formatCommentTime = (value: string) => {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export const getCommentAvatar = (author: string) => {
  return author.slice(0, 1).toUpperCase()
}
