# Backend Setup (Fastify + Drizzle)

## 1. 需要安装的软件

- Node.js 22+
- Yarn 1.22+
- Docker Engine / Docker Desktop
- Docker Compose v2

## 2. 启动依赖服务（PostgreSQL / Redis / MinIO）

在仓库根目录执行：

```bash
docker compose -f docker-compose.backend.yml up -d
bash ./scripts/minio-lifecycle-policy.sh --apply
```

服务端口：

- PostgreSQL: `5432`
- Redis: `6379`
- MinIO API: `9000`
- MinIO Console: `9001`

## 3. 配置环境变量

在 `backend/` 目录执行：

```bash
cp .env.example .env
```

默认配置已对齐 `docker-compose.backend.yml`，本地无需额外改动。

## 4. 安装依赖并启动后端

在 `backend/` 目录执行：

```bash
yarn
yarn dev
```

也可以在仓库根目录一键执行：

```bash
./backend/scripts/setup.sh
```

## 5. 健康检查

- `GET http://localhost:3000/health/live`
- `GET http://localhost:3000/health/ready`

`/health/ready` 会检查 PostgreSQL、Redis、MinIO 是否可用。

## 6. 管理员引导账号

- 默认账号：`ADMIN_BOOTSTRAP_EMAIL=admin@example.com`
- 默认密码：`ADMIN_BOOTSTRAP_PASSWORD=change-me-please`
- 生产环境必须覆盖默认密码，否则服务会拒绝启动

建议本地 `.env` 至少覆盖：

```bash
ADMIN_BOOTSTRAP_PASSWORD=<your-strong-password>
```

## 7. 已实现的 Admin 基础接口

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/refresh`
- `POST /api/admin/auth/logout`
- `GET /api/admin/dashboard/overview`（需 `dashboard:read`）
- `GET /api/admin/theme/revisions`（需 `theme:write`）
- `POST /api/admin/theme/revisions`（需 `theme:write`）
- `POST /api/admin/theme/revisions/{revisionId}/activate`（需 `theme:write`）
- `GET /api/admin/audit-logs`（需 `audit:read`）
- `GET /api/admin/site/footer`（需 `site:read`）
- `PATCH /api/admin/site/footer`（需 `site:write`）
- `GET /api/admin/publish/history`（需 `publish:manage`）
- `POST /api/admin/publish/preview`（需 `publish:manage`）
- `POST /api/admin/publish/commit`（需 `publish:manage`）
- `POST /api/admin/publish/rollback`（需 `publish:manage`）
- `GET /api/admin/media/list`（需 `media:write`）
- `POST /api/admin/media/upload`（需 `media:write`）
- `POST /api/admin/media/upload-signed-url`（需 `media:write`，生成 MinIO 单文件签名直传 URL）
- `POST /api/admin/media/multipart/init`（需 `media:write`，初始化 MinIO 分片上传会话）
- `POST /api/admin/media/multipart/presign-part`（需 `media:write`，为指定分片生成签名 URL）
- `POST /api/admin/media/multipart/complete`（需 `media:write`，完成分片合并并自动写入媒体库）
- `POST /api/admin/media/multipart/abort`（需 `media:write`，取消分片上传并清理会话）
- `POST /api/admin/media/upload-local`（需 `media:write`，`multipart/form-data`）
- `DELETE /api/admin/media/{mediaId}`（需 `media:write`，支持 `force`）
- `POST /api/admin/media/cleanup-orphans`（需 `media:write`，支持 `dryRun`）
- `GET /api/media/local/{fileName}`（公开访问本地媒体文件）
- `GET /api/admin/access/snapshot`（需 `*`）
- `PATCH /api/admin/access/users`（需 `*`）

## 8. 已实现的 Blog 接口（对接前端 store）

- `GET /api/blog/bootstrap`
- `POST /api/blog/posts`（需 `post:write`）
- `PUT /api/blog/posts/{postId}`（需 `post:write`）
- `DELETE /api/blog/posts/{postId}`（需 `post:write`）
- `POST /api/blog/posts/{postId}/comments`
- `PATCH /api/blog/posts/{postId}/comments/{commentId}/like`
- `PATCH /api/blog/posts/{postId}/comments/{commentId}`（需 `comment:moderate`）
- `DELETE /api/blog/posts/{postId}/comments/{commentId}`（需 `comment:moderate`）
- `PATCH /api/blog/site/profile`（需 `site:write`）
- `PATCH /api/blog/site/footer`（需 `site:write`）
- `PUT /api/blog/site/links`（需 `site:write`）
- `PUT /api/blog/site/about`（需 `site:write`）
- `PUT /api/blog/site/projects`（需 `site:write`）

## 9. 持久化与缓存

说明：

- 关键写接口启用了 IP 级限流。
- `PATCH /api/admin/site/footer` 会进行文本清洗并写入审计日志。
- 所有错误响应包含 `requestId`，便于追踪。
- 刷新会话写入 PostgreSQL（`admin_refresh_sessions`）并同步 Redis 索引（`auth:refresh:*`）。
- 审计日志写入 PostgreSQL（`admin_audit_logs`）并维护 Redis 最近日志缓存（`audit:recent:v1`）。
- 后台运行态采用“领域表主读 + 快照兜底”：`admin_theme_revisions`、`admin_publish_records`、`admin_access_users`、`admin_access_state`（兼容 `admin_runtime_snapshots`）。
- 媒体域采用领域表：`admin_media_assets`（媒体记录）与 `admin_multipart_upload_sessions`（分片会话），启动时会从历史快照自动回填。
- 博客内容域已切换为领域表主读：`blog_posts`、`blog_comments`、`blog_site_state`（同时保留 `blog_snapshots` 兜底与回填）。
- MinIO 对象路径采用分层：直传落在 `admin/live/single/`，分片上传先落在 `admin/tmp/multipart/`，完成后提升到 `admin/live/multipart/`。
- 存储侧生命周期策略由 `scripts/minio-lifecycle-policy.sh` 管理（默认规则：`admin/tmp/` 前缀过期）。
- 本地上传媒体文件落盘在 `MEDIA_LOCAL_UPLOAD_DIR`，大小限制由 `MEDIA_LOCAL_MAX_SIZE_BYTES` 控制。
- 媒体治理清理会统一处理本地文件与 MinIO（`MINIO_BUCKET_PUBLIC` 中 `admin/` 前缀对象）。
- 清理任务会扫描并中止孤儿分片上传（未被后台分片会话表追踪的 uploadId）。

## 10. 常用命令

```bash
# 类型检查
yarn type-check

# 生成 migration
yarn db:generate

# 执行 migration
yarn db:migrate

# 媒体孤儿清理（默认 dry-run）
yarn media:gc

# 真正执行清理
yarn media:gc --apply

# 运行态域表与快照一致性检查
yarn runtime:consistency

# 发布前回滚目标检查（默认 latest）
yarn rollback:target -- latest

# （仓库根目录）校验 MinIO 生命周期策略
cd ..
yarn minio:lifecycle:verify
```
