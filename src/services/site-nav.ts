import type { SiteNavIcon, SiteNavRouteName, SiteNavTab } from '@/types/blog'

export interface SiteNavRouteMeta {
  defaultLabel: string
  description: string
  defaultIcon: SiteNavIcon
}

export const siteNavRouteOrder: SiteNavRouteName[] = [
  'home',
  'tags',
  'categories',
  'timeline',
  'links',
  'about',
]

export const siteNavIconOptions: Array<{ value: SiteNavIcon; label: string }> = [
  { value: 'home', label: '首页' },
  { value: 'tag', label: '标签' },
  { value: 'folder', label: '分类' },
  { value: 'history', label: '时间线' },
  { value: 'link', label: '链接' },
  { value: 'user', label: '用户' },
  { value: 'grid', label: '网格' },
  { value: 'sparkles', label: '灵感' },
  { value: 'compass', label: '探索' },
  { value: 'book', label: '内容' },
]

export const siteNavRouteMetaMap: Record<SiteNavRouteName, SiteNavRouteMeta> = {
  home: {
    defaultLabel: '首页',
    description: '内容流与站点概览',
    defaultIcon: 'home',
  },
  tags: {
    defaultLabel: '标签',
    description: '按主题浏览文章',
    defaultIcon: 'tag',
  },
  categories: {
    defaultLabel: '分类',
    description: '按领域查看内容',
    defaultIcon: 'folder',
  },
  timeline: {
    defaultLabel: '时间线',
    description: '按时间回顾更新',
    defaultIcon: 'history',
  },
  links: {
    defaultLabel: '友链',
    description: '技术创作者推荐',
    defaultIcon: 'link',
  },
  about: {
    defaultLabel: '关于',
    description: '个人介绍与统计',
    defaultIcon: 'user',
  },
}

const navIconSet = new Set<SiteNavIcon>(siteNavIconOptions.map((item) => item.value))

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isSiteNavRouteName = (value: unknown): value is SiteNavRouteName => {
  return typeof value === 'string' && siteNavRouteOrder.includes(value as SiteNavRouteName)
}

const normalizeNavLabel = (value: unknown, routeName: SiteNavRouteName) => {
  if (typeof value !== 'string') {
    return siteNavRouteMetaMap[routeName].defaultLabel
  }

  const normalized = value.trim()
  return normalized || siteNavRouteMetaMap[routeName].defaultLabel
}

const normalizeNavIcon = (value: unknown, routeName: SiteNavRouteName): SiteNavIcon => {
  if (typeof value === 'string' && navIconSet.has(value as SiteNavIcon)) {
    return value as SiteNavIcon
  }

  return siteNavRouteMetaMap[routeName].defaultIcon
}

export const createDefaultNavTabs = (): SiteNavTab[] => {
  return siteNavRouteOrder.map((routeName) => ({
    routeName,
    label: siteNavRouteMetaMap[routeName].defaultLabel,
    icon: siteNavRouteMetaMap[routeName].defaultIcon,
  }))
}

export const normalizeNavTabs = (input: unknown): SiteNavTab[] => {
  const draftByRoute = new Map<SiteNavRouteName, SiteNavTab>()

  if (Array.isArray(input)) {
    for (const item of input) {
      if (!isRecord(item)) {
        continue
      }

      const routeNameValue = item.routeName
      if (!isSiteNavRouteName(routeNameValue) || draftByRoute.has(routeNameValue)) {
        continue
      }

      draftByRoute.set(routeNameValue, {
        routeName: routeNameValue,
        label: normalizeNavLabel(item.label, routeNameValue),
        icon: normalizeNavIcon(item.icon, routeNameValue),
      })
    }
  }

  return siteNavRouteOrder.map((routeName) => {
    const current = draftByRoute.get(routeName)

    if (current) {
      return current
    }

    return {
      routeName,
      label: siteNavRouteMetaMap[routeName].defaultLabel,
      icon: siteNavRouteMetaMap[routeName].defaultIcon,
    }
  })
}
