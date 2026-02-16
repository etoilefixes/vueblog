import type { SocialLink } from '@/types/blog'

const socialIconCodeSet = new Set<SocialLink['icon']>(['github', 'email', 'bilibili', 'wechat'])

const inferSocialIconCode = (searchText: string): SocialLink['icon'] => {
  if (searchText.includes('bilibili') || searchText.includes('blibli') || searchText.includes('b23.tv')) {
    return 'bilibili'
  }

  if (
    searchText.includes('wechat') ||
    searchText.includes('weixin') ||
    searchText.includes('wx.qq.com') ||
    searchText.includes('weixin.qq.com')
  ) {
    return 'wechat'
  }

  if (
    searchText.includes('mailto:') ||
    searchText.includes('email') ||
    searchText.includes('mail') ||
    searchText.includes('@')
  ) {
    return 'email'
  }

  if (searchText.includes('github') || searchText.includes('github.com')) {
    return 'github'
  }

  return 'github'
}

export const normalizeSocialIconCode = (
  value: string | undefined,
  fallbackSearchText = '',
): SocialLink['icon'] => {
  const normalized = value?.trim().toLowerCase() ?? ''

  if (normalized === 'blibli') {
    return 'bilibili'
  }

  if (socialIconCodeSet.has(normalized as SocialLink['icon'])) {
    return normalized as SocialLink['icon']
  }

  return inferSocialIconCode(fallbackSearchText.toLowerCase())
}
