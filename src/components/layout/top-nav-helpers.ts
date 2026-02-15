import { normalizeNavTabs, siteNavRouteMetaMap } from '@/services/site-nav'
import type { SiteNavIcon, SiteNavRouteName, SiteNavTab } from '@/types/blog'

export interface NavItem {
  label: string
  icon: SiteNavIcon
  routeName: SiteNavRouteName
  description: string
}

export type RouteCommandItem = {
  id: string
  kind: 'route'
  label: string
  description: string
  routeName: NavItem['routeName']
}

export type PostCommandItem = {
  id: string
  kind: 'post'
  title: string
  summary: string
  category: string
  tagsText: string
  postId: string
}

export type RecentSearchCommandItem = {
  id: string
  kind: 'recent'
  searchTerm: string
}

export type CommandItem = RouteCommandItem | PostCommandItem | RecentSearchCommandItem

export interface CommandSearchResult {
  item: CommandItem
  score: number
}

export const buildNavItems = (navTabs: SiteNavTab[] | undefined): NavItem[] => {
  return normalizeNavTabs(navTabs).map((tab) => ({
    label: tab.label,
    icon: tab.icon,
    routeName: tab.routeName,
    description: siteNavRouteMetaMap[tab.routeName].description,
  }))
}

export const buildSearchFields = (item: RouteCommandItem | PostCommandItem) => {
  if (item.kind === 'route') {
    return [
      { text: item.label, weight: 0.46 },
      { text: item.description, weight: 0.22 },
    ]
  }

  return [
    { text: item.title, weight: 0.44 },
    { text: item.summary, weight: 0.24 },
    { text: item.category, weight: 0.14 },
    { text: item.tagsText, weight: 0.12 },
  ]
}

export const isExternalHttpLink = (href: string) => /^https?:\/\//i.test(href)

export const isDisabledSocialLink = (href: string) => {
  return href.trim() === '' || href.trim() === '#'
}

const escapeHtml = (value: string) => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export const buildHighlightedHtml = (value: string, ranges: ReadonlyArray<readonly [number, number]>) => {
  if (ranges.length === 0) {
    return escapeHtml(value)
  }

  let cursor = 0
  let html = ''

  ranges
    .slice()
    .sort((a, b) => a[0] - b[0])
    .forEach(([start, end]) => {
      const safeStart = Math.max(0, start)
      const safeEnd = Math.min(value.length - 1, end)

      if (safeStart > cursor) {
        html += escapeHtml(value.slice(cursor, safeStart))
      }

      html += `<mark>${escapeHtml(value.slice(safeStart, safeEnd + 1))}</mark>`
      cursor = safeEnd + 1
    })

  if (cursor < value.length) {
    html += escapeHtml(value.slice(cursor))
  }

  return html
}

export const getCommandTypeLabel = (item: CommandItem) => {
  if (item.kind === 'route') {
    return '页面'
  }

  if (item.kind === 'post') {
    return '文章'
  }

  return '历史'
}
