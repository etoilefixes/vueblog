export interface BlogSnippet {
  language: string
  code: string
}

export interface BlogSectionImage {
  src: string
  alt: string
  caption?: string
}

export interface BlogPostSection {
  id: string
  title: string
  paragraphs: string[]
  highlights?: string[]
  snippet?: BlogSnippet
  images?: BlogSectionImage[]
}

export interface BlogPost {
  id: string
  title: string
  summary: string
  lead: string
  tags: string[]
  category: string
  highlight?: string
  views?: number
  comments?: number
  noticeTitle?: string
  noticeLines?: string[]
  quote?: string
  publishedAt: string
  readingMinutes: number
  contentSections: BlogPostSection[]
}

export interface ProfileStat {
  label: string
  value: number
}

export interface SocialLink {
  label: string
  href: string
  icon: 'github' | 'email' | 'bilibili' | 'wechat'
}

export type SiteNavRouteName = 'home' | 'tags' | 'categories' | 'timeline' | 'links' | 'about'

export type SiteNavIcon =
  | 'home'
  | 'tag'
  | 'folder'
  | 'history'
  | 'link'
  | 'user'
  | 'grid'
  | 'sparkles'
  | 'compass'
  | 'book'

export interface SiteNavTab {
  routeName: SiteNavRouteName
  label: string
  icon: SiteNavIcon
}

export interface SiteProfile {
  name: string
  motto: string
  avatar: string
  homePageMaxPosts: number
  socials: SocialLink[]
  navTabs: SiteNavTab[]
}

export interface SiteFooterInfo {
  icp: string
  icpLink?: string
  icpLocked?: boolean
  runtime: string
  runtimeMode?: 'manual' | 'auto'
  runtimeStartedAt?: string
  poweredBy: string
  copyright: string
}

export interface FriendLink {
  id: string
  name: string
  url: string
  description: string
  tags: string[]
}

export interface AboutSection {
  id: string
  title: string
  content: string
}

export interface CustomProject {
  id: string
  name: string
  status: string
  summary: string
  techStack: string[]
}

export type BlogCommentStatus = 'visible' | 'pending' | 'hidden'

export interface BlogComment {
  id: string
  author: string
  role?: '作者' | '访客'
  content: string
  createdAt: string
  likes: number
  likedByViewer?: boolean
  status?: BlogCommentStatus
}
