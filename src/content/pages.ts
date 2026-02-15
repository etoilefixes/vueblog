import type { AboutSection, FriendLink } from '@/types/blog'

export const friendLinks: FriendLink[] = [
  {
    id: 'evan-note',
    name: 'Evan Note',
    url: 'https://evan-note.dev',
    description: '专注前端工程化与代码审美，更新频率高，文章短而实用。',
    tags: ['前端', '工程化'],
  },
  {
    id: 'pixel-archive',
    name: 'Pixel Archive',
    url: 'https://pixel-archive.dev',
    description: '交互动效和视觉系统为主的设计工程博客，案例拆解很详细。',
    tags: ['动效', '设计系统'],
  },
  {
    id: 'ts-lab',
    name: 'TS Lab',
    url: 'https://ts-lab.dev',
    description: 'TypeScript 实战与类型体操专题站，涵盖大量真实业务题。',
    tags: ['TypeScript', '架构'],
  },
  {
    id: 'node-corner',
    name: 'Node Corner',
    url: 'https://node-corner.dev',
    description: 'Node 服务端与性能分析专栏，包含从 0 到 1 的工程模板。',
    tags: ['Node.js', '性能'],
  },
]

export const aboutSections: AboutSection[] = [
  {
    id: 'intro',
    title: '我是谁',
    content:
      '一名前端工程师，长期关注工程效能、设计系统、交互动效，把“写得快”和“写得稳”放在同一个目标里。',
  },
  {
    id: 'focus',
    title: '当前关注',
    content:
      'Vue 生态工程化、跨端体验一致性、组件边界设计，以及面向内容创作者的后台交互体验。',
  },
  {
    id: 'workflow',
    title: '工作流',
    content:
      '习惯先建立领域模型，再做视觉层；坚持样式分层、状态单一来源、页面纯展示的可维护方式。',
  },
]
