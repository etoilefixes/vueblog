# 博客后台实施设计文档 v1

文档版本：`v1.0`  
创建日期：`2026-02-13`  
关联文档：

- `docs/admin-backoffice-plan.md`
- `docs/backend-api-contract.md`

## 1. 目标与实施边界

本设计文档用于指导后台系统从 0 到 1 的落地开发，目标是：

- 后台可覆盖前台绝大部分可配置内容（内容、结构、主题、运营位）。
- 提供移动端可用的管理体验（手机可完成核心管理动作）。
- 建立可追溯、可回滚、可审计的发布体系。

实施边界（v1）：

- 包含：管理后台、后台 API、数据库结构、发布流程、权限、日志、移动端适配。
- 不包含：多租户、复杂审批流、国际化翻译平台。

## 2. 技术落地方案

## 2.1 前端（Admin）

- Vue 3 + TypeScript + Vite
- Vue Router + Pinia
- 图表：ECharts（移动端开启精简模式）
- 表单校验：zod（建议）
- UI 结构：`Mobile First`，桌面增强

## 2.2 后端

- Node.js + NestJS（建议）或 Express + Fastify
- ORM：Prisma（建议）或 Drizzle
- 数据库：PostgreSQL
- 缓存：Redis（会话、热点统计、频控）
- 文件存储：S3 兼容对象存储（MinIO/OSS/COS）

## 2.3 前台与后台关系

- 前台继续通过 `src/services/blog-api.ts` 对接数据。
- 后台所有写操作走 `admin` 命名空间接口。
- 发布成功后刷新前台缓存（CDN 或 Redis key 失效）。

## 3. 后台信息架构（IA）

## 3.1 页面结构

- `/admin/login` 登录
- `/admin` 仪表盘
- `/admin/posts` 文章列表
- `/admin/posts/new` 新建文章
- `/admin/posts/:id/edit` 编辑文章
- `/admin/comments` 评论管理
- `/admin/site/profile` 站点资料
- `/admin/site/navigation` 导航配置
- `/admin/site/home-modules` 首页模块
- `/admin/site/about` 关于页配置
- `/admin/site/links` 友链管理
- `/admin/site/footer` 页脚配置
- `/admin/theme` 主题 Token
- `/admin/media` 媒体库
- `/admin/publish` 发布中心
- `/admin/audit-logs` 操作日志
- `/admin/settings/roles` 角色权限

## 3.2 手机端导航策略

- 主导航：底部 5 项（仪表盘/内容/配置/发布/我的）
- 二级页面：顶部返回 + 固定底部操作栏（保存/发布）
- 列表默认卡片化，提供“切换表格”开关（仅大屏启用）

## 4. 数据模型与数据库设计

说明：以下为 PostgreSQL 逻辑模型，字段命名采用 `snake_case`。

## 4.1 用户与权限

### `admin_users`

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | pk | 用户 ID |
| email | varchar(120) | unique, not null | 登录账号 |
| password_hash | varchar(255) | not null | 密码哈希 |
| display_name | varchar(60) | not null | 显示名 |
| avatar_url | varchar(255) |  | 头像 |
| status | smallint | not null default 1 | 1 正常 0 禁用 |
| last_login_at | timestamptz |  | 最近登录 |
| created_at | timestamptz | not null | 创建时间 |
| updated_at | timestamptz | not null | 更新时间 |

### `admin_roles`

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | pk | 角色 ID |
| code | varchar(40) | unique, not null | `admin/editor/operator/viewer` |
| name | varchar(60) | not null | 角色名 |
| created_at | timestamptz | not null | 创建时间 |
| updated_at | timestamptz | not null | 更新时间 |

### `admin_permissions`

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | pk | 权限 ID |
| resource | varchar(80) | not null | 资源，例如 `post` |
| action | varchar(40) | not null | 动作，例如 `write` |
| code | varchar(120) | unique | `post:write` |
| created_at | timestamptz | not null | 创建时间 |

### `admin_user_roles`

| 字段 | 类型 | 约束 |
|---|---|---|
| user_id | uuid | fk -> admin_users.id |
| role_id | uuid | fk -> admin_roles.id |

联合主键：`(user_id, role_id)`

### `admin_role_permissions`

| 字段 | 类型 | 约束 |
|---|---|---|
| role_id | uuid | fk -> admin_roles.id |
| permission_id | uuid | fk -> admin_permissions.id |

联合主键：`(role_id, permission_id)`

## 4.2 内容模型

### `posts`

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | pk | 主键 |
| slug | varchar(120) | unique, not null | 对应前台 `postId` |
| title | varchar(160) | not null | 标题 |
| summary | varchar(500) | not null | 摘要 |
| lead | text | not null | 导语 |
| category_id | uuid | fk | 分类 |
| highlight | varchar(40) |  | Hot / New |
| views | integer | not null default 0 | 阅读量 |
| comments_count | integer | not null default 0 | 评论数 |
| reading_minutes | integer | not null | 阅读时长 |
| published_at | date |  | 发布时间 |
| status | smallint | not null default 0 | 0 草稿 1 已发布 2 下线 |
| current_revision_id | uuid | fk | 当前版本 |
| created_by | uuid | fk | 创建人 |
| created_at | timestamptz | not null | 创建时间 |
| updated_at | timestamptz | not null | 更新时间 |

索引：

- `idx_posts_status_published_at(status, published_at desc)`
- `idx_posts_category_id(category_id)`

### `post_revisions`

| 字段 | 类型 | 约束 |
|---|---|---|
| id | uuid | pk |
| post_id | uuid | fk -> posts.id |
| content_json | jsonb | not null（含 sections/highlights/snippet） |
| notice_title | varchar(120) |  |
| notice_lines | jsonb |  |
| quote | text |  |
| tags_json | jsonb | not null |
| seo_json | jsonb |  |
| version | integer | not null |
| is_published | boolean | not null default false |
| created_by | uuid | fk |
| created_at | timestamptz | not null |

### `categories`

| 字段 | 类型 | 约束 |
|---|---|---|
| id | uuid | pk |
| name | varchar(60) | unique, not null |
| sort_order | integer | default 0 |
| created_at | timestamptz | not null |

### `tags`

| 字段 | 类型 | 约束 |
|---|---|---|
| id | uuid | pk |
| name | varchar(40) | unique, not null |
| created_at | timestamptz | not null |

### `post_tags`

| 字段 | 类型 | 约束 |
|---|---|---|
| post_id | uuid | fk -> posts.id |
| tag_id | uuid | fk -> tags.id |

联合主键：`(post_id, tag_id)`

## 4.3 评论与审核

### `comments`

| 字段 | 类型 | 约束 |
|---|---|---|
| id | uuid | pk |
| post_id | uuid | fk -> posts.id |
| author | varchar(80) | not null |
| role_label | varchar(20) |  |
| content | varchar(400) | not null |
| likes | integer | not null default 0 |
| liked_by_viewer | boolean | not null default false（前台兼容字段） |
| status | smallint | not null default 1（0 隐藏 1 可见 2 待审） |
| created_at | timestamptz | not null |
| updated_at | timestamptz | not null |

索引：

- `idx_comments_post_id_created_at(post_id, created_at desc)`
- `idx_comments_status_created_at(status, created_at desc)`

## 4.4 站点配置

### `site_profile`

单行表（固定主键）：

| 字段 | 类型 | 约束 |
|---|---|---|
| id | smallint | pk, default 1 |
| name | varchar(80) | not null |
| motto | varchar(160) | not null |
| avatar | varchar(255) | not null |
| socials_json | jsonb | not null |
| updated_by | uuid | fk |
| updated_at | timestamptz | not null |

### `site_footer`

| 字段 | 类型 | 约束 |
|---|---|---|
| id | smallint | pk, default 1 |
| icp | varchar(120) | not null |
| runtime | varchar(160) | not null |
| powered_by | varchar(160) | not null |
| copyright | varchar(120) | not null |
| updated_by | uuid | fk |
| updated_at | timestamptz | not null |

### `site_navigation_items`

| 字段 | 类型 | 约束 |
|---|---|---|
| id | uuid | pk |
| label | varchar(40) | not null |
| route_name | varchar(40) | not null |
| description | varchar(120) |  |
| visible | boolean | not null default true |
| sort_order | integer | not null default 0 |
| updated_at | timestamptz | not null |

### `site_links`

| 字段 | 类型 | 约束 |
|---|---|---|
| id | uuid | pk |
| name | varchar(80) | not null |
| url | varchar(255) | not null |
| description | varchar(240) | not null |
| tags_json | jsonb | not null |
| sort_order | integer | not null default 0 |
| enabled | boolean | not null default true |
| updated_at | timestamptz | not null |

### `site_about_sections`

| 字段 | 类型 | 约束 |
|---|---|---|
| id | uuid | pk |
| title | varchar(80) | not null |
| content | text | not null |
| sort_order | integer | not null default 0 |
| enabled | boolean | not null default true |
| updated_at | timestamptz | not null |

### `site_projects`

| 字段 | 类型 | 约束 |
|---|---|---|
| id | uuid | pk |
| name | varchar(80) | not null |
| status | varchar(20) | not null |
| summary | text | not null |
| tech_stack_json | jsonb | not null |
| sort_order | integer | not null default 0 |
| enabled | boolean | not null default true |
| updated_at | timestamptz | not null |

## 4.5 主题、媒体、日志

### `theme_revisions`

| 字段 | 类型 | 约束 |
|---|---|---|
| id | uuid | pk |
| name | varchar(80) | not null |
| tokens_json | jsonb | not null |
| is_active | boolean | not null default false |
| created_by | uuid | fk |
| created_at | timestamptz | not null |

### `media_assets`

| 字段 | 类型 | 约束 |
|---|---|---|
| id | uuid | pk |
| file_name | varchar(180) | not null |
| mime_type | varchar(80) | not null |
| size_bytes | bigint | not null |
| url | varchar(255) | not null |
| width | integer |  |
| height | integer |  |
| uploaded_by | uuid | fk |
| created_at | timestamptz | not null |

### `audit_logs`

| 字段 | 类型 | 约束 |
|---|---|---|
| id | uuid | pk |
| actor_user_id | uuid | fk |
| action | varchar(80) | not null |
| target_type | varchar(40) | not null |
| target_id | varchar(80) | not null |
| before_json | jsonb |  |
| after_json | jsonb |  |
| ip | varchar(64) |  |
| user_agent | varchar(255) |  |
| request_id | varchar(80) |  |
| created_at | timestamptz | not null |

## 5. API 设计（字段级）

说明：统一前缀 `/api/admin`，响应格式建议：

```json
{
  "data": {},
  "message": "ok",
  "requestId": "req_xxx"
}
```

## 5.1 鉴权

### `POST /admin/auth/login`

请求：

| 字段 | 类型 | 必填 |
|---|---|---|
| email | string | 是 |
| password | string | 是 |

响应：

| 字段 | 类型 |
|---|---|
| accessToken | string |
| refreshToken | string |
| expiresIn | number |
| user | object |

### `POST /admin/auth/refresh`

请求：`{ "refreshToken": "..." }`  
响应：新 token 对。

### `POST /admin/auth/logout`

请求：可选 `refreshToken`，服务端拉黑会话。

## 5.2 仪表盘

### `GET /admin/dashboard/overview?range=7d|30d`

响应字段：

- `summary`: pv/uv/posts/comments/errors
- `trends`: 按天聚合数组
- `topPosts`: 热门文章列表
- `topTags`: 热门标签列表
- `system`: p95 延迟/错误率

## 5.3 文章管理

### `GET /admin/posts`

查询参数：

- `keyword`
- `categoryId`
- `tag`
- `status`
- `page`
- `pageSize`

响应：

- `items: PostListItem[]`
- `total`
- `page`
- `pageSize`

### `GET /admin/posts/{id}`

响应：

- `post`
- `revision`
- `tags`
- `category`

### `POST /admin/posts`

请求字段（核心）：

- `title`, `summary`, `lead`
- `categoryId`
- `tags`
- `readingMinutes`
- `contentSections`
- `noticeTitle`, `noticeLines`, `quote`
- `seo`

响应：`post + revision`

### `PUT /admin/posts/{id}`

同创建字段，返回最新版本。

### `POST /admin/posts/{id}/publish`

请求：

- `publishAt`（可选，定时发布）
- `note`（发布备注）

响应：

- `publishedRevisionId`
- `publishedAt`

### `POST /admin/posts/{id}/rollback`

请求：`{ "toRevisionId": "uuid" }`  
响应：回滚后的版本信息。

### `DELETE /admin/posts/{id}`

逻辑删除（推荐）：

- 响应 `204`。

## 5.4 评论管理

### `GET /admin/comments`

查询：

- `postId`
- `status`
- `keyword`
- `page/pageSize`

### `PATCH /admin/comments/{id}/status`

请求：

- `status`: `visible|hidden|pending`

### `POST /admin/comments/batch-status`

请求：

- `ids: string[]`
- `status`

## 5.5 站点配置

### `GET /admin/site/config`

一次性返回：

- `profile`
- `footer`
- `navigationItems`
- `homeModules`
- `aboutSections`
- `links`
- `projects`

### `PATCH /admin/site/profile`

字段：

- `name`
- `motto`
- `avatar`
- `socials`
- `navTabs[]`（固定 routeName，支持配置 label 和 icon）

### `PATCH /admin/site/footer`

字段：

- `icp`
- `runtime`
- `poweredBy`
- `copyright`

### `PUT /admin/site/navigation`

字段：`items[]`（排序、可见性、routeName）

### `PUT /admin/site/home-modules`

字段：模块列表 `modules[]`，包含：

- `moduleType`
- `enabled`
- `sortOrder`
- `config`

### `PUT /admin/site/links`

字段：`links[]`

### `PUT /admin/site/about`

字段：`sections[]`

### `PUT /admin/site/projects`

字段：`projects[]`

## 5.6 主题管理

### `GET /admin/theme/revisions`

返回历史版本列表。

### `POST /admin/theme/revisions`

请求：

- `name`
- `tokens`

### `POST /admin/theme/revisions/{id}/activate`

激活主题版本并刷新前台缓存。

## 5.7 媒体库

### `POST /admin/media/upload`

`multipart/form-data`：

- `file`
- `folder`（可选）

响应：

- `id`
- `url`
- `width/height`
- `sizeBytes`

### `GET /admin/media/list`

查询：

- `keyword`
- `mimeType`
- `page/pageSize`

### `DELETE /admin/media/{id}`

逻辑删除或物理删除（按策略）。

## 5.8 审计日志

### `GET /admin/audit-logs`

查询：

- `actorUserId`
- `action`
- `targetType`
- `dateFrom/dateTo`
- `page/pageSize`

## 6. 前端 Admin 工程结构

建议目录：

```txt
src-admin/
  api/                 # 后台接口封装
  stores/              # 鉴权/内容/配置/发布
  views/
    dashboard/
    posts/
    comments/
    site/
    theme/
    media/
    publish/
    settings/
  components/
    mobile/
    charts/
    forms/
    tables/
  styles/
    tokens.css
    base.css
    admin.css
```

状态管理建议：

- `authStore`: 登录态、角色、权限
- `contentStore`: 文章/分类/标签
- `siteStore`: 配置项（profile/footer/navigation/home）
- `themeStore`: 主题版本
- `dashboardStore`: 指标缓存

## 7. 手机端适配设计规范

断点：

- `<= 640px`: 手机
- `641px - 1024px`: 平板
- `> 1024px`: 桌面

规范：

- 表格 -> 卡片布局，批量操作放入底部抽屉
- 表单字段上下排布，按钮高度 >= 40px
- 固定底部操作栏：`保存草稿` / `发布`
- 图表默认显示关键 3 指标，可展开更多
- 弹窗尽量改抽屉，减少遮挡与误触

## 8. 安全与合规

- 密码哈希：`argon2` 或 `bcrypt`
- 刷新 token 持久化 + 失效机制
- 写操作必须写入 `audit_logs`
- 接口限流：登录、评论、上传
- 输入校验：zod/class-validator 双层校验
- XSS 过滤：富文本内容白名单

## 9. 性能与稳定性指标

- 后台首屏接口 P95 < 400ms（内网）
- 列表接口分页查询 P95 < 250ms
- 移动端首屏可交互 < 2.5s
- 发布成功率 > 99.9%

## 10. 开发任务拆分（可直接排期）

## 10.1 后端任务

1. 建表与迁移脚本（按第 4 章）
2. 鉴权与权限中间件
3. 内容 CRUD + 发布 + 回滚接口
4. 站点配置接口
5. 主题/媒体/日志接口
6. 仪表盘聚合接口

## 10.2 前端任务

1. Admin 工程初始化与登录页
2. 移动端骨架（底部导航 + 顶栏）
3. 文章/评论管理页面
4. 站点配置页面（profile/footer/navigation/home）
5. 主题与发布中心页面
6. 媒体库与审计日志页面

## 10.3 联调任务

1. 先打通 `auth + dashboard + posts list`
2. 再打通 `post edit + publish + rollback`
3. 最后联调 `site/theme/media/logs`

## 11. 验收清单（实施版）

- 手机端能完成：文章编辑、导航修改、主题切换、发布回滚
- 关键写操作有审计日志
- 配置变更可以回滚
- API 错误可追踪 `requestId`
- 前后台字段映射与契约一致

## 12. 下一步执行

按本设计文档进入开发。  
建议先落地 `M1-M2`（鉴权 + 内容管理）后再进入主题和发布体系。
