import type { SiteFooterInfo, SiteProfile } from '@/types/blog'
import { createDefaultNavTabs } from '@/services/site-nav'

export const siteProfile: SiteProfile = {
  name: 'mereiith',
  motto: 'life is strange',
  avatar: '/avatar.svg',
  homePageMaxPosts: 5,
  socials: [
    {
      label: 'Github',
      href: 'https://github.com',
      icon: 'github',
    },
    {
      label: 'Email',
      href: 'mailto:hello@example.com',
      icon: 'email',
    },
    {
      label: 'Bilibili',
      href: 'https://www.bilibili.com',
      icon: 'bilibili',
    },
    {
      label: 'Wechat',
      href: '#',
      icon: 'wechat',
    },
  ],
  navTabs: createDefaultNavTabs(),
}

export const siteFooterInfo: SiteFooterInfo = {
  icp: 'ICP 编号: 京ICP备18064122号',
  icpLink: 'https://beian.miit.gov.cn/',
  icpLocked: false,
  runtime: '本站居然运行了{days}天{hours}小时{minutes}分{seconds}秒',
  runtimeMode: 'auto',
  runtimeStartedAt: '2022-08-16T13:22:45+08:00',
  poweredBy: 'Powered By VanBlog v0.54.0',
  copyright: '© 2022 - 2026',
}
