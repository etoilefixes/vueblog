import type { BlogComment } from '@/types/blog'

export const blogCommentsByPost: Record<string, BlogComment[]> = {
  'vite-build-performance': [
    {
      id: 'c-vite-1',
      author: 'mereiith',
      role: '作者',
      content: '这篇后续会补一版 CI 阶段的产物阈值校验模版，方便直接落地。',
      createdAt: '2026-02-10T21:12:00+08:00',
      likes: 18,
      likedByViewer: false,
    },
    {
      id: 'c-vite-2',
      author: 'Nina',
      role: '访客',
      content: '路由分包后的首屏差异很明显，想看你后续的 perf-watch 面板。',
      createdAt: '2026-02-11T09:38:00+08:00',
      likes: 7,
      likedByViewer: false,
    },
  ],
  'vue-component-boundary': [
    {
      id: 'c-boundary-1',
      author: 'Leo',
      role: '访客',
      content: '容器层和展示层分离后，联调时真的少了很多“顺手改一下”的副作用。',
      createdAt: '2026-01-28T14:22:00+08:00',
      likes: 11,
      likedByViewer: false,
    },
  ],
  'pinia-single-store': [
    {
      id: 'c-pinia-1',
      author: 'mereiith',
      role: '作者',
      content: '单模块并不是终点，关键是先把状态职责梳理清楚。',
      createdAt: '2026-01-22T19:05:00+08:00',
      likes: 15,
      likedByViewer: false,
    },
  ],
  'css-system-design': [
    {
      id: 'c-css-1',
      author: 'Ariel',
      role: '访客',
      content: 'Token + Base + Feature 这个分层太实用了，已经在项目里照搬。',
      createdAt: '2026-01-16T10:44:00+08:00',
      likes: 9,
      likedByViewer: false,
    },
  ],
  'animation-without-library': [
    {
      id: 'c-motion-1',
      author: 'Yuki',
      role: '访客',
      content: '错峰入场控制在 80ms 左右确实最舒服，再大就拖沓。',
      createdAt: '2026-01-09T17:20:00+08:00',
      likes: 6,
      likedByViewer: false,
    },
  ],
  'content-driven-ui': [
    {
      id: 'c-content-1',
      author: 'Kai',
      role: '访客',
      content: '字段模型先行这一点很关键，后续扩展推荐和搜索都会轻松很多。',
      createdAt: '2026-01-05T22:10:00+08:00',
      likes: 8,
      likedByViewer: false,
    },
  ],
}
