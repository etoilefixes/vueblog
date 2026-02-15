declare module 'markdown-it-footnote' {
  import type MarkdownIt from 'markdown-it'

  const plugin: MarkdownIt.PluginSimple
  export default plugin
}

declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it'

  interface TaskListOptions {
    enabled?: boolean
    label?: boolean
    labelAfter?: boolean
  }

  const plugin: (md: MarkdownIt, options?: TaskListOptions) => void
  export default plugin
}

declare module 'markdown-it-katex' {
  import type MarkdownIt from 'markdown-it'

  interface MarkdownItKatexOptions {
    throwOnError?: boolean
    errorColor?: string
    [key: string]: unknown
  }

  const plugin: (md: MarkdownIt, options?: MarkdownItKatexOptions) => void
  export default plugin
}
