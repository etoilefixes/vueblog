import { createRouter, createWebHistory } from 'vue-router'
import type { RouteLocationNormalizedLoaded, RouteRecordRaw } from 'vue-router'

const siteRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { tone: 'home' },
  },
  {
    path: '/tags',
    name: 'tags',
    component: () => import('@/views/TagsView.vue'),
    meta: { tone: 'tags' },
  },
  {
    path: '/categories',
    name: 'categories',
    component: () => import('@/views/CategoriesView.vue'),
    meta: { tone: 'categories' },
  },
  {
    path: '/timeline',
    name: 'timeline',
    component: () => import('@/views/TimelineView.vue'),
    meta: { tone: 'timeline' },
  },
  {
    path: '/links',
    name: 'links',
    component: () => import('@/views/LinksView.vue'),
    meta: { tone: 'links' },
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/AboutView.vue'),
    meta: { tone: 'about' },
  },
  {
    path: '/post/:id',
    name: 'post-detail',
    component: () => import('@/views/PostDetailView.vue'),
    meta: { tone: 'post' },
  },
]

const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('@/views/admin/AdminLoginView.vue'),
    meta: {
      adminRoute: true,
      adminTitle: '后台登录',
    },
  },
  {
    path: '/admin/forbidden',
    name: 'admin-forbidden',
    component: () => import('@/views/admin/AdminForbiddenView.vue'),
    meta: {
      adminRoute: true,
      requiresAdminAuth: true,
      adminTitle: '权限不足',
    },
  },
  {
    path: '/admin',
    component: () => import('@/components/admin/AdminShell.vue'),
    meta: {
      adminRoute: true,
      requiresAdminAuth: true,
    },
    children: [
      {
        path: '',
        name: 'admin-dashboard',
        component: () => import('@/views/admin/AdminDashboardView.vue'),
        meta: {
          adminRoute: true,
          requiresAdminAuth: true,
          adminTitle: '运营总览',
        },
      },
      {
        path: 'content',
        name: 'admin-content',
        component: () => import('@/views/admin/AdminContentView.vue'),
        meta: {
          adminRoute: true,
          requiresAdminAuth: true,
          adminTitle: '内容管理',
          adminPermissions: ['post:read'],
        },
      },
      {
        path: 'site',
        name: 'admin-site',
        component: () => import('@/views/admin/AdminSiteConfigView.vue'),
        meta: {
          adminRoute: true,
          requiresAdminAuth: true,
          adminTitle: '站点配置',
          adminPermissions: ['site:read'],
        },
      },
      {
        path: 'comments',
        name: 'admin-comments',
        component: () => import('@/views/admin/AdminCommentsView.vue'),
        meta: {
          adminRoute: true,
          requiresAdminAuth: true,
          adminTitle: '评论管理',
          adminPermissions: ['comment:moderate'],
        },
      },
      {
        path: 'media',
        name: 'admin-media',
        component: () => import('@/views/admin/AdminMediaView.vue'),
        meta: {
          adminRoute: true,
          requiresAdminAuth: true,
          adminTitle: '媒体库',
          adminPermissions: ['media:write'],
        },
      },
      {
        path: 'theme',
        name: 'admin-theme',
        component: () => import('@/views/admin/AdminThemeView.vue'),
        meta: {
          adminRoute: true,
          requiresAdminAuth: true,
          adminTitle: '主题管理',
          adminPermissions: ['theme:write'],
        },
      },
      {
        path: 'publish',
        name: 'admin-publish',
        component: () => import('@/views/admin/AdminPublishView.vue'),
        meta: {
          adminRoute: true,
          requiresAdminAuth: true,
          adminTitle: '发布中心',
          adminPermissions: ['publish:manage'],
        },
      },
      {
        path: 'access',
        name: 'admin-access',
        component: () => import('@/views/admin/AdminAccessView.vue'),
        meta: {
          adminRoute: true,
          requiresAdminAuth: true,
          adminTitle: '角色权限',
          adminPermissions: ['*'],
        },
      },
      {
        path: 'logs',
        name: 'admin-logs',
        component: () => import('@/views/admin/AdminLogsView.vue'),
        meta: {
          adminRoute: true,
          requiresAdminAuth: true,
          adminTitle: '操作日志',
          adminPermissions: ['audit:read'],
        },
      },
    ],
  },
]

const routes: RouteRecordRaw[] = [...siteRoutes, ...adminRoutes]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }

    const isAdminRoute = to.matched.some((record) => Boolean(record.meta?.adminRoute))

    if (isAdminRoute) {
      return { top: 0 }
    }

    return { top: 0, behavior: 'smooth' }
  },
})

const collectRequiredPermissions = (to: RouteLocationNormalizedLoaded) => {
  return to.matched.flatMap((record) => {
    const permissions = record.meta?.adminPermissions
    return Array.isArray(permissions) ? permissions : []
  })
}

router.beforeEach(async (to) => {
  const isAdminRoute = to.matched.some((record) => Boolean(record.meta?.adminRoute))

  if (!isAdminRoute) {
    return true
  }

  const { useAdminAuthStore } = await import('@/stores/admin-auth')
  const adminAuth = useAdminAuthStore()
  adminAuth.ensureHydrated()

  if (to.name === 'admin-login' && adminAuth.isAuthenticated) {
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '/admin'
    return redirect
  }

  const requiresAdminAuth = to.matched.some((record) => Boolean(record.meta?.requiresAdminAuth))

  if (!requiresAdminAuth) {
    return true
  }

  if (!adminAuth.isAuthenticated) {
    const refreshed = await adminAuth.refreshSession()

    if (!refreshed && !adminAuth.isAuthenticated) {
      return {
        name: 'admin-login',
        query: { redirect: to.fullPath },
      }
    }
  }

  const requiredPermissions = collectRequiredPermissions(to)

  if (requiredPermissions.length > 0 && !adminAuth.hasAnyPermission(requiredPermissions)) {
    if (to.name !== 'admin-forbidden') {
      return { name: 'admin-forbidden' }
    }
  }

  return true
})

export default router
