# 博客后端接口契约（完整对接版）

文档版本：`v1.0.0`  
适用前端版本：`vue-blog-single-store`（2026-02-13）

## 1. 目标与范围

本契约用于对接当前前端已接入的网关层：

- `src/services/blog-api.ts`
- `src/types/api.ts`
- `src/stores/blog.ts`

覆盖能力：

- 全站启动数据加载
- 文章新增/更新/删除
- 评论发布与点赞
- 站点资料更新
- 友链/关于/项目批量更新

## 2. 基础约定

### 2.1 Base URL

- 默认前端配置：`/api`
- 生产可通过 `VITE_BLOG_API_BASE_URL` 覆盖

完整路径示例：

- `/api/blog/bootstrap`
- `/api/blog/posts`

### 2.2 Content-Type

- 请求：`application/json`
- 响应：`application/json; charset=utf-8`

### 2.3 鉴权（建议）

前端当前未强制鉴权，但后端建议：

- 只读接口：可匿名访问
- 写接口（POST/PUT/PATCH/DELETE）：建议 `Bearer Token` 或 Session

### 2.4 响应包装兼容

前端同时兼容以下两种响应格式：

1. 统一包装：

```json
{
  "data": { "...": "..." },
  "message": "ok"
}
```

2. 直接对象：

```json
{
  "...": "..."
}
```

建议后端统一使用格式 1。

## 3. 统一错误模型

建议错误响应：

```json
{
  "code": "VALIDATION_ERROR",
  "message": "评论内容不能为空",
  "details": {
    "field": "content"
  },
  "requestId": "req_9b7f9e3b"
}
```

建议状态码：

| 状态码 | 场景 |
|---|---|
| 400 | 参数错误、字段缺失 |
| 401 | 未登录或 token 无效 |
| 403 | 无写权限 |
| 404 | 文章/评论不存在 |
| 409 | 资源冲突（如 slug 重复） |
| 422 | 业务校验失败 |
| 429 | 频率限制 |
| 500 | 服务端异常 |

## 4. 领域数据结构

### 4.1 BlogSnippet

```json
{
  "language": "ts",
  "code": "const a = 1"
}
```

### 4.2 BlogPostSection

```json
{
  "id": "build-baseline",
  "title": "先做基线",
  "paragraphs": ["段落1", "段落2"],
  "highlights": ["要点1", "要点2"],
  "snippet": {
    "language": "ts",
    "code": "const a = 1"
  }
}
```

### 4.3 BlogPost

```json
{
  "id": "vite-build-performance",
  "title": "Vite 构建提速",
  "summary": "摘要",
  "lead": "导语",
  "tags": ["Vite", "Performance"],
  "category": "工程效能",
  "highlight": "Hot",
  "views": 3678,
  "comments": 52,
  "noticeTitle": "构建优化快照",
  "noticeLines": ["构建时间下降 78%"],
  "quote": "console.log('hi')",
  "publishedAt": "2026-01-22",
  "readingMinutes": 8,
  "contentSections": []
}
```

### 4.4 BlogComment

```json
{
  "id": "c-vite-1",
  "author": "mereiith",
  "role": "作者",
  "content": "评论内容",
  "createdAt": "2026-02-10T21:12:00+08:00",
  "likes": 18,
  "likedByViewer": false
}
```

### 4.5 SiteProfile

```json
{
  "name": "mereiith",
  "motto": "life is strange",
  "avatar": "/avatar.svg",
  "homePageMaxPosts": 5,
  "navTabs": [
    {
      "routeName": "home",
      "label": "首页",
      "icon": "home"
    },
    {
      "routeName": "tags",
      "label": "标签",
      "icon": "tag"
    },
    {
      "routeName": "categories",
      "label": "分类",
      "icon": "folder"
    },
    {
      "routeName": "timeline",
      "label": "时间线",
      "icon": "history"
    },
    {
      "routeName": "links",
      "label": "友链",
      "icon": "link"
    },
    {
      "routeName": "about",
      "label": "关于",
      "icon": "user"
    }
  ],
  "socials": [
    {
      "label": "Github",
      "href": "https://github.com",
      "icon": "github"
    }
  ]
}
```

### 4.6 SiteFooterInfo

```json
{
  "icp": "ICP 编号: 京ICP备18064122号",
  "icpLink": "https://beian.miit.gov.cn/",
  "icpLocked": true,
  "runtime": "本站居然运行了{days}天{hours}小时{minutes}分{seconds}秒",
  "runtimeMode": "auto",
  "runtimeStartedAt": "2022-08-16T05:22:45.000Z",
  "poweredBy": "Powered By",
  "copyright": "© 2022 - 2026"
}
```

### 4.7 FriendLink

```json
{
  "id": "evan-note",
  "name": "Evan Note",
  "url": "https://evan-note.dev",
  "description": "站点描述",
  "tags": ["前端", "工程化"]
}
```

### 4.8 AboutSection

```json
{
  "id": "intro",
  "title": "我是谁",
  "content": "内容"
}
```

### 4.9 CustomProject

```json
{
  "id": "motion-kit",
  "name": "Motion Kit",
  "status": "进行中",
  "summary": "项目简介",
  "techStack": ["Vue", "TypeScript"]
}
```

## 5. 接口清单（当前前端已接入）

## 5.1 全站启动数据

### `GET /blog/bootstrap`

用途：一次性返回首页、详情页、评论、侧栏等所需核心数据。

响应体：

```json
{
  "data": {
    "profile": {},
    "footerInfo": {},
    "posts": [],
    "links": [],
    "about": [],
    "projects": [],
    "commentsByPost": {
      "post-id": []
    }
  }
}
```

后端要求：

- `posts` 按 `publishedAt` 倒序返回更佳（前端会再排序）
- `commentsByPost[postId]` 建议按时间倒序（新到旧）

## 5.2 新增文章

### `POST /blog/posts`

请求体：`UpsertBlogPostInput`（不传 `id`）

```json
{
  "title": "新文章",
  "summary": "摘要",
  "lead": "导语",
  "tags": ["Vue"],
  "category": "工程",
  "publishedAt": "2026-02-13",
  "readingMinutes": 6,
  "contentSections": []
}
```

响应：`BlogPost`

## 5.3 更新文章

### `PUT /blog/posts/{postId}`

请求体：`UpsertBlogPostInput`（允许包含 `id`，建议以后端 path 为准）

响应：`BlogPost`

## 5.4 删除文章

### `DELETE /blog/posts/{postId}`

响应：

- `204 No Content` 或
- `200 { "data": null }`

说明：删除文章时建议同时删除该文章评论集合。

## 5.5 发布评论

### `POST /blog/posts/{postId}/comments`

请求体：

```json
{
  "author": "访客A",
  "content": "写得很好"
}
```

响应：`BlogComment`

校验建议：

- `content` 去空格后不能为空
- `content` 最大长度建议 220
- `author` 为空时后端可兜底为“匿名读者”

## 5.6 评论点赞/取消点赞

### `PATCH /blog/posts/{postId}/comments/{commentId}/like`

请求体：

```json
{
  "likedByViewer": true
}
```

响应：更新后的 `BlogComment`

后端规则建议：

- `likedByViewer=true` 时 `likes +1`
- `likedByViewer=false` 时 `likes -1`
- `likes` 最小值为 `0`

## 5.7 更新评论（审核/内容修正）

### `PATCH /blog/posts/{postId}/comments/{commentId}`

请求体：`UpdateCommentInput`

```json
{
  "status": "hidden",
  "content": "这条评论内容已被管理员修正"
}
```

响应：更新后的 `BlogComment`

说明：

- `status` 可选值：`visible` / `pending` / `hidden`
- `content` 可选；若传入则建议做非空校验

## 5.8 删除评论

### `DELETE /blog/posts/{postId}/comments/{commentId}`

响应：

- `204 No Content` 或
- `200 { "data": null }`

## 5.9 更新站点资料

### `PATCH /blog/site/profile`

请求体：`Partial<SiteProfile>`

```json
{
  "name": "mereiith",
  "motto": "new motto",
  "avatar": "/avatar.svg",
  "homePageMaxPosts": 5,
  "navTabs": [
    {
      "routeName": "home",
      "label": "首页",
      "icon": "home"
    },
    {
      "routeName": "tags",
      "label": "话题",
      "icon": "tag"
    },
    {
      "routeName": "categories",
      "label": "专题",
      "icon": "folder"
    },
    {
      "routeName": "timeline",
      "label": "时间线",
      "icon": "history"
    },
    {
      "routeName": "links",
      "label": "友链",
      "icon": "link"
    },
    {
      "routeName": "about",
      "label": "关于",
      "icon": "user"
    }
  ]
}
```

响应：`SiteProfile`

说明：

- `homePageMaxPosts` 表示首页每页最多展示文章数，建议范围 `1-20`。
- `navTabs` 用于控制顶部标签页文案和图标，必须覆盖固定路由：`home` / `tags` / `categories` / `timeline` / `links` / `about`。
- `navTabs.icon` 当前支持：`home` / `tag` / `folder` / `history` / `link` / `user` / `grid` / `sparkles` / `compass` / `book`。

## 5.10 更新页脚信息

### `PATCH /blog/site/footer`

请求体：`Partial<SiteFooterInfo>`

```json
{
  "icp": "ICP 编号: 京ICP备18064122号",
  "icpLink": "https://beian.miit.gov.cn/",
  "icpLocked": true,
  "runtimeMode": "auto",
  "runtimeStartedAt": "2022-08-16T05:22:45.000Z",
  "runtime": "本站居然运行了{days}天{hours}小时{minutes}分{seconds}秒",
  "poweredBy": "Powered By VanBlog v0.54.0"
}
```

响应：`SiteFooterInfo`

说明：

- `runtimeMode=manual` 时，前端直接展示 `runtime` 文本。
- `runtimeMode=auto` 时，前端根据 `runtimeStartedAt` 实时计算时长，并用 `runtime` 作为模板渲染。
- 模板支持占位符：`{days}`、`{hours}`、`{minutes}`、`{seconds}`，可自由增删文本。
- `icpLocked=true` 时，前台显示锁定标识；后台建议仍允许管理员解锁后再改文案。

## 5.11 覆盖友链

### `PUT /blog/site/links`

请求体：

```json
{
  "links": []
}
```

响应：`FriendLink[]`

## 5.12 覆盖关于页区块

### `PUT /blog/site/about`

请求体：

```json
{
  "sections": []
}
```

响应：`AboutSection[]`

## 5.13 覆盖自定义项目列表

### `PUT /blog/site/projects`

请求体：

```json
{
  "projects": []
}
```

响应：`CustomProject[]`

## 6. 字段约束建议（后端校验）

| 字段 | 建议规则 |
|---|---|
| `post.id` | 小写字母/数字/短横线，长度 `3-80` |
| `post.title` | 必填，长度 `1-120` |
| `post.summary` | 必填，长度 `1-300` |
| `post.tags` | 每项长度 `1-20`，建议最多 `8` 个 |
| `post.category` | 必填，长度 `1-30` |
| `post.publishedAt` | `YYYY-MM-DD` |
| `comment.content` | 必填，长度 `1-220` |
| `siteProfile.homePageMaxPosts` | 整数，范围 `1-20` |
| `siteProfile.navTabs` | 固定 6 项，routeName 必须完整且唯一 |
| `siteProfile.navTabs.label` | 必填，长度 `1-24` |
| `friendLink.url` | 必须为合法 URL |
| `project.status` | 枚举：`进行中` / `已上线` / `规划中` |

## 7. 并发与一致性建议

- 评论点赞建议按“用户 + 评论”去重，避免重复累加。
- `PUT /blog/site/*` 为覆盖写入，建议使用乐观锁字段（如 `version`）避免误覆盖。
- 返回数据建议包含 `updatedAt`，便于前端后续做冲突提示（当前前端可忽略该字段）。

## 8. 前端兼容与回退逻辑

当前前端行为：

- `VITE_USE_BACKEND_API=true` 时调用以上接口
- 若 `GET /blog/bootstrap` 失败，前端自动回退本地内容数据（不会白屏）
- 评论与点赞为“乐观更新 + 同步后端”，失败时会保留或回滚前端状态

## 9. 推荐联调顺序

1. 先打通 `GET /blog/bootstrap`
2. 再联调 `POST comments` 与 `PATCH like`
3. 最后联调内容管理类写接口（文章/站点资料/友链/项目）

## 10. 最小可用联调样例（curl）

```bash
curl -X GET "http://localhost:3000/api/blog/bootstrap"
```

```bash
curl -X POST "http://localhost:3000/api/blog/posts/vite-build-performance/comments" \
  -H "Content-Type: application/json" \
  -d '{"author":"jun","content":"很实用"}'
```

```bash
curl -X PATCH "http://localhost:3000/api/blog/posts/vite-build-performance/comments/c-vite-1/like" \
  -H "Content-Type: application/json" \
  -d '{"likedByViewer":true}'
```

```bash
curl -X PATCH "http://localhost:3000/api/blog/site/profile" \
  -H "Content-Type: application/json" \
  -d '{"motto":"new motto"}'
```

## 11. 后续可扩展接口（可选）

当前前端未强依赖，但建议预留：

- `GET /blog/posts?keyword=&tag=&page=&pageSize=`
- `GET /blog/posts/{postId}`
- `GET /blog/posts/{postId}/comments`
- `POST /blog/uploads`（头像/封面上传）

## 12. 后台专用接口补充（页脚配置）

当你使用后台管理系统（`/admin/site`）保存“页脚配置”时，前端支持调用后台专用接口：

### `PATCH /admin/site/footer`

请求体：`Partial<SiteFooterInfo>`

```json
{
  "icp": "ICP 编号: 京ICP备18064122号",
  "icpLink": "https://beian.miit.gov.cn/",
  "icpLocked": true,
  "runtimeMode": "auto",
  "runtimeStartedAt": "2022-08-16T05:22:45.000Z",
  "runtime": "本站居然运行了{days}天{hours}小时{minutes}分{seconds}秒",
  "poweredBy": "Powered By VanBlog v0.54.0",
  "copyright": "© 2022 - 2026"
}
```

响应：`SiteFooterInfo`

说明：

- 建议后端持久化后返回完整页脚对象（含 `icpLink`、`icpLocked`、`runtimeMode`、`runtimeStartedAt`）。
- 推荐同时写入审计日志，例如：`site.footer.update`。

## 13. 后台专用接口补充（内容 / 评论 / 发布 / 媒体 / 权限）

以下接口已被当前前端后台页面使用：

- `src/views/admin/AdminContentView.vue`
- `src/views/admin/AdminCommentsView.vue`
- `src/views/admin/AdminPublishView.vue`
- `src/views/admin/AdminMediaView.vue`
- `src/views/admin/AdminAccessView.vue`

### 13.1 发布中心

#### `GET /admin/publish/history`

响应：`AdminPublishRecord[]`

```json
[
  {
    "id": "pub-20260213-001",
    "version": "v2026.02.13-1",
    "source": "publish",
    "note": "完成后台站点配置首版上线",
    "createdAt": "2026-02-13T09:40:00.000Z",
    "actorName": "系统管理员",
    "summary": {
      "posts": 6,
      "comments": 20,
      "links": 6,
      "projects": 4
    }
  }
]
```

`source` 枚举：`publish` / `rollback`

#### `POST /admin/publish/preview`

请求体：`AdminCreatePublishPreviewInput`

```json
{
  "expiresInMinutes": 30
}
```

响应：`AdminPublishPreviewPayload`

```json
{
  "previewUrl": "https://example.com/?preview=preview_xxx",
  "token": "preview_xxx",
  "expiresAt": "2026-02-13T10:10:00.000Z"
}
```

#### `POST /admin/publish/commit`

请求体：`AdminCommitPublishInput`

```json
{
  "version": "v2026.02.13-2",
  "note": "完成文章与页脚配置发布"
}
```

响应：`AdminPublishRecord`

#### `POST /admin/publish/rollback`

请求体：`AdminRollbackPublishInput`

```json
{
  "targetRecordId": "pub-20260213-001",
  "reason": "线上样式异常，先回滚稳定版本"
}
```

响应：`AdminPublishRecord`

---

### 13.2 媒体库

#### `GET /admin/media/list?keyword=&mimeType=&limit=`

响应：`AdminMediaItem[]`

```json
[
  {
    "id": "media-avatar-main",
    "name": "avatar-main.svg",
    "url": "/avatar.svg",
    "mimeType": "image/svg+xml",
    "size": 16428,
    "width": 512,
    "height": 512,
    "uploadedAt": "2026-02-13T09:18:00.000Z",
    "uploadedBy": "系统管理员"
  }
]
```

说明：

- `mimeType` 建议支持前缀筛选（如 `image/`）。
- `limit` 建议最大 `200`。
- 响应建议包含引用态字段：`inUse`、`usageCount`（用于后台删除前提示）。

#### `POST /admin/media/upload`

请求体：`AdminUploadMediaInput`

```json
{
  "name": "hero-cover.webp",
  "url": "https://cdn.example.com/hero-cover.webp",
  "mimeType": "image/webp",
  "size": 294312,
  "width": 1600,
  "height": 900
}
```

响应：`AdminMediaItem`

#### `POST /admin/media/upload-signed-url`

请求体：`AdminSignedUploadUrlInput`

```json
{
  "name": "hero-cover.webp",
  "mimeType": "image/webp",
  "size": 294312,
  "width": 1600,
  "height": 900
}
```

响应：`AdminSignedUploadUrlPayload`

```json
{
  "uploadUrl": "http://localhost:9000/blog-public/admin/live/single/2026/02/14/single-xxx-hero-cover.webp?...",
  "objectKey": "admin/live/single/2026/02/14/single-xxx-hero-cover.webp",
  "publicUrl": "http://localhost:9000/blog-public/admin/live/single/2026/02/14/single-xxx-hero-cover.webp",
  "expiresAt": "2026-02-14T13:30:00.000Z"
}
```

说明：

- 客户端收到 `uploadUrl` 后执行 `PUT` 直传到 MinIO。
- 直传成功后仍需调用 `POST /admin/media/upload` 写入媒体元数据。

#### `POST /admin/media/multipart/init`

请求体：`AdminMultipartUploadInitInput`

```json
{
  "name": "homepage-banner.avif",
  "mimeType": "image/avif",
  "size": 18420831,
  "width": 2400,
  "height": 1200,
  "partSize": 8388608,
  "totalParts": 3
}
```

响应：`AdminMultipartUploadInitPayload`

```json
{
  "sessionId": "mpu-m7x3xw3i-a31f9c22",
  "objectKey": "admin/tmp/multipart/2026/02/14/multipart-xxx-homepage-banner.avif",
  "publicUrl": "http://localhost:9000/blog-public/admin/tmp/multipart/2026/02/14/multipart-xxx-homepage-banner.avif",
  "partSize": 8388608,
  "totalParts": 3,
  "expiresAt": "2026-02-14T14:20:00.000Z"
}
```

#### `POST /admin/media/multipart/presign-part`

请求体：`AdminMultipartPresignPartInput`

```json
{
  "sessionId": "mpu-m7x3xw3i-a31f9c22",
  "partNumber": 1
}
```

响应：`AdminMultipartPresignPartPayload`

```json
{
  "sessionId": "mpu-m7x3xw3i-a31f9c22",
  "partNumber": 1,
  "uploadUrl": "http://localhost:9000/blog-public/admin/tmp/multipart/2026/02/14/multipart-xxx-homepage-banner.avif?uploadId=...&partNumber=1&...",
  "expiresAt": "2026-02-14T13:35:00.000Z"
}
```

#### `POST /admin/media/multipart/complete`

请求体：`AdminMultipartCompleteInput`

```json
{
  "sessionId": "mpu-m7x3xw3i-a31f9c22",
  "parts": [
    { "partNumber": 1, "etag": "a7d1..." },
    { "partNumber": 2, "etag": "0f2c..." },
    { "partNumber": 3, "etag": "f81b..." }
  ]
}
```

响应：`AdminMediaItem`

说明：

- `parts` 需要覆盖 `init` 阶段返回的全部分片编号。
- `etag` 建议传入；若浏览器拿不到响应头，后端会尝试从 MinIO 查询已上传分片并补全。
- 完成合并后会自动写入媒体库记录，无需再调用 `/admin/media/upload`。
- 完成合并后，后端会把临时对象从 `admin/tmp/multipart/` 复制到 `admin/live/multipart/`，并清理临时对象。

#### `POST /admin/media/multipart/abort`

请求体：`AdminMultipartAbortInput`

```json
{
  "sessionId": "mpu-m7x3xw3i-a31f9c22"
}
```

响应：

```json
{
  "sessionId": "mpu-m7x3xw3i-a31f9c22",
  "aborted": true
}
```

#### `DELETE /admin/media/{mediaId}`

请求体（可选）：

```json
{
  "force": false,
  "reason": "管理员手动删除"
}
```

响应：

```json
{
  "id": "media-xxx",
  "deletedAt": "2026-02-14T12:18:00.000Z",
  "forced": false,
  "usageCount": 0
}
```

说明：

- 默认执行“软删除”，由清理任务执行物理删除。
- 若资源仍被文章/站点引用且 `force=false`，返回 `409 MEDIA_IN_USE` 并附带 `references`。
- `force=true` 可强制移除媒体记录（仍建议随后执行清理任务）。

#### `POST /admin/media/cleanup-orphans`

请求体：

```json
{
  "dryRun": true
}
```

响应：`AdminCleanupMediaResult`

```json
{
  "dryRun": true,
  "processedDeletedRecords": 3,
  "removedMetadataRecords": 3,
  "removedLocalFiles": 2,
  "removedMinioObjects": 1,
  "orphanLocalFilesDetected": 1,
  "orphanLocalFilesRemoved": 0,
  "orphanMinioObjectsDetected": 2,
  "orphanMinioObjectsRemoved": 0,
  "orphanMultipartUploadsDetected": 1,
  "orphanMultipartUploadsAborted": 0,
  "failures": []
}
```

说明：

- `dryRun=true` 只输出报告，不会实际删除。
- 清理任务会同时覆盖本地文件与 MinIO 对象（`admin/` 前缀）。
- 清理任务会检测并可中止“孤儿分片上传会话”（不在后台会话表中的 uploadId）。
- 清理任务应优先删除物理文件/对象，再移除对应元数据，避免失去追踪。
- 存储侧建议启用 `admin/tmp/` 生命周期过期策略，作为应用层清理之外的兜底。

---

### 13.3 角色权限

#### `GET /admin/access/snapshot`

响应：`AdminAccessSnapshot`

```json
{
  "users": [
    {
      "id": "u-admin-001",
      "email": "admin@example.com",
      "displayName": "系统管理员",
      "roles": ["admin"],
      "permissions": ["*"],
      "disabled": false,
      "updatedAt": "2026-02-13T16:08:00.000Z"
    }
  ],
  "rolePermissions": {
    "admin": ["*"],
    "editor": ["post:read", "post:write", "comment:moderate", "site:read"],
    "operator": ["dashboard:read", "comment:moderate", "audit:read"],
    "viewer": ["dashboard:read"]
  },
  "availablePermissions": [
    "dashboard:read",
    "post:read",
    "post:write",
    "site:read",
    "site:write",
    "comment:moderate",
    "theme:write",
    "audit:read",
    "publish:manage",
    "media:write"
  ]
}
```

#### `PATCH /admin/access/users`

请求体：`AdminUpdateUserAccessInput`

```json
{
  "userId": "u-editor-001",
  "roles": ["editor", "operator"],
  "permissions": ["post:read", "post:write", "comment:moderate", "audit:read"],
  "disabled": false
}
```

响应：`AdminAccessSnapshot`（更新后完整快照）

说明：

- 建议后端做角色与权限白名单校验，拒绝未知权限码。
- 建议保留超管保护策略：最后一个 `admin` 账号不可被降权或禁用。
- 建议写入审计日志：`access.update_user`。

---

### 13.4 内容管理与评论管理

#### `GET /admin/posts?keyword=&category=&tag=&limit=`

响应：`BlogPost[]`

说明：

- 按发布时间倒序返回。
- `keyword` 建议匹配标题、摘要、标签、分类。
- `limit` 建议最大 `200`。

#### `GET /admin/posts/{postId}`

响应：`BlogPost`

#### `POST /admin/posts`

请求体：`UpsertBlogPostInput`

响应：`BlogPost`

#### `PUT /admin/posts/{postId}`

请求体：`UpsertBlogPostInput`

响应：`BlogPost`

#### `DELETE /admin/posts/{postId}`

响应：`null`（包裹在统一响应 `data` 内）

---

#### `GET /admin/comments?keyword=&postId=&status=&limit=`

响应：`AdminCommentListItem[]`

```json
[
  {
    "postId": "welcome-post",
    "postTitle": "博客后台已接入",
    "id": "c-1739477044077-08fbb0af",
    "author": "jun",
    "content": "评论示例",
    "createdAt": "2026-02-14T11:24:04.077Z",
    "likes": 2,
    "likedByViewer": false,
    "status": "pending"
  }
]
```

`status` 枚举：`visible` / `pending` / `hidden`

#### `PATCH /admin/posts/{postId}/comments/{commentId}`

请求体：`UpdateCommentInput`

响应：`BlogComment`

#### `DELETE /admin/posts/{postId}/comments/{commentId}`

响应：`null`（包裹在统一响应 `data` 内）

#### `POST /admin/comments/batch-status`

请求体：

```json
{
  "items": [
    {
      "postId": "welcome-post",
      "commentId": "c-1",
      "status": "visible"
    }
  ]
}
```

响应：

```json
{
  "updatedCount": 1
}
```

#### `POST /admin/comments/batch-delete`

请求体：

```json
{
  "items": [
    {
      "postId": "welcome-post",
      "commentId": "c-1"
    }
  ]
}
```

响应：

```json
{
  "deletedCount": 1
}
```
