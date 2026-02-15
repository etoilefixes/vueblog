# 博客后端规划文档（Fastify + Drizzle 方案）

文档版本：`v1.0`  
创建日期：`2026-02-13`  
适用项目：`vue-blog-single-store`  
关联文档：

- `docs/backend-api-contract.md`
- `docs/admin-backoffice-plan.md`
- `docs/admin-backoffice-design-v1.md`

## 1. 目标与边界

目标：

- 基于既有前端契约快速落地可用后端，优先打通前台读写与后台核心管理能力。
- 建立可持续扩展的后端工程骨架，支持后续仪表盘、主题系统、发布回滚与审计追踪。
- 保证移动端管理路径对应接口可用、稳定、可追踪。

边界（v1）：

- 包含：公共博客 API、后台管理 API、鉴权授权、审计日志、发布回滚、媒体上传、缓存与限流。
- 不包含：多租户、复杂审批流、国际化翻译平台。

## 2. 技术栈确认

- 运行时：`Node.js 22`
- Web 框架：`Fastify`
- ORM：`Drizzle ORM` + `drizzle-kit`
- 校验：`Zod`
- 数据库：`PostgreSQL`
- 缓存/会话：`Redis`
- 对象存储：`MinIO`（S3 兼容）
- 语言：`TypeScript`

选型原则：

- 快速实现与现有 TypeScript 前端契约对齐。
- 保持框架轻量，避免过重抽象影响开发速度。
- 对“发布、回滚、审计”这类强一致场景优先做事务化设计。

## 3. 架构总览

逻辑分层：

- `Route 层`：HTTP 路由、参数提取、输入输出绑定。
- `Schema 层`：Zod 请求/响应校验与 DTO 映射。
- `Service 层`：业务规则、权限判断、事务编排。
- `Repository 层`：Drizzle 查询与持久化。
- `Infra 层`：Redis、MinIO、日志、配置、鉴权中间件。

运行形态：

- 单体服务（Monolith）起步，模块化目录组织。
- 公共 API 与 Admin API 同进程、分命名空间（`/api/blog`、`/api/admin`）。
- PostgreSQL 作为主数据源，Redis 做会话与热点缓存，MinIO 做媒体存储。

## 4. 工程目录规划（建议）

建议新增后端目录：`backend/`

```txt
backend/
  src/
    app/
      server.ts
      plugins.ts
      hooks.ts
    config/
      env.ts
    modules/
      auth/
      dashboard/
      posts/
      comments/
      site/
      theme/
      media/
      publish/
      audit/
      shared/
    db/
      client.ts
      schema/
      migrations/
      seeds/
    infra/
      redis/
      minio/
      logger/
      metrics/
    utils/
      errors.ts
      request-id.ts
      pagination.ts
  scripts/
  package.json
  tsconfig.json
  drizzle.config.ts
```

## 5. API 实施范围与模块拆分

### 5.1 第一阶段（与前台直接联调）

实现 `docs/backend-api-contract.md` 全量接口：

- `GET /api/blog/bootstrap`
- `POST /api/blog/posts`
- `PUT /api/blog/posts/{postId}`
- `DELETE /api/blog/posts/{postId}`
- `POST /api/blog/posts/{postId}/comments`
- `PATCH /api/blog/posts/{postId}/comments/{commentId}/like`
- `PATCH /api/blog/posts/{postId}/comments/{commentId}`
- `DELETE /api/blog/posts/{postId}/comments/{commentId}`
- `PATCH /api/blog/site/profile`
- `PATCH /api/blog/site/footer`
- `PUT /api/blog/site/links`
- `PUT /api/blog/site/about`
- `PUT /api/blog/site/projects`

### 5.2 第二阶段（后台管理闭环）

实现 Admin 核心接口：

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/refresh`
- `POST /api/admin/auth/logout`
- `GET /api/admin/dashboard/overview`
- `GET /api/admin/posts`
- `GET /api/admin/posts/{id}`
- `POST /api/admin/posts`
- `PUT /api/admin/posts/{id}`
- `POST /api/admin/posts/{id}/publish`
- `POST /api/admin/posts/{id}/rollback`
- `GET /api/admin/comments`
- `PATCH /api/admin/comments/{id}/status`
- `POST /api/admin/comments/batch-status`
- `GET /api/admin/site/config`
- `PATCH /api/admin/site/profile`
- `PATCH /api/admin/site/footer`
- `PUT /api/admin/site/links`
- `PUT /api/admin/site/about`
- `PUT /api/admin/site/projects`
- `POST /api/admin/media/upload`
- `GET /api/admin/media/list`
- `DELETE /api/admin/media/{id}`
- `GET /api/admin/audit-logs`

## 6. 数据库规划（PostgreSQL + Drizzle）

延续现有设计文档中的逻辑模型，分组落表：

- 权限域：`admin_users`、`admin_roles`、`admin_permissions`、`admin_user_roles`、`admin_role_permissions`
- 内容域：`posts`、`post_revisions`、`categories`、`tags`、`post_tags`
- 评论域：`comments`
- 站点域：`site_profile`、`site_footer`、`site_navigation_items`、`site_links`、`site_about_sections`、`site_projects`
- 主题域：`theme_revisions`
- 媒体域：`media_assets`
- 审计域：`audit_logs`

补充建议表：

- `admin_refresh_tokens`：存储刷新令牌哈希、过期时间、设备信息。
- `publish_records`：记录发布/回滚动作、版本、执行人、结果。

约束原则：

- 强一致写操作使用事务（文章发布、回滚、批量状态更新）。
- 高并发查询建立组合索引（状态+时间、外键+时间）。
- 所有核心表统一 `created_at`、`updated_at` 字段。

迁移策略：

- 使用 `drizzle-kit generate` 生成迁移，`drizzle-kit migrate` 执行。
- 禁止手工改线上表结构；所有变更必须走 migration 文件。
- 每次上线前执行“迁移演练 + 回滚演练”。

## 7. Redis 规划

用途：

- 登录态与刷新令牌黑名单。
- 接口限流（登录、评论、上传）。
- 仪表盘短时缓存（如 30-120 秒）。
- 热点统计（点赞增量、PV/UV 临时聚合）。

Key 设计建议：

- `auth:refresh:{tokenId}`
- `ratelimit:login:{ip}`
- `ratelimit:comment:{ip}:{postId}`
- `dashboard:overview:{range}`
- `counter:post:view:{postId}:{yyyyMMdd}`

策略：

- 以 TTL 控制缓存生命周期，避免脏缓存长期驻留。
- 禁止 Redis 作为唯一数据源；关键数据最终落 PostgreSQL。

## 8. MinIO 媒体存储规划

Bucket 建议：

- `blog-public`：前台可直接访问资源（头像、封面、公开附件）。
- `blog-private`：后台临时或敏感资源（按需）。

上传流程：

- 方案 A：后端代理上传（实现简单，便于统一审计）。
- 方案 B：预签名 URL 直传（大文件时减少后端带宽压力，后续可升级）。

元数据管理：

- 文件上传成功后写入 `media_assets`（url、size、mime、width、height、uploaded_by）。
- 删除资源默认走“逻辑删除 + 定时物理清理”策略。

## 9. 鉴权、授权与安全

鉴权：

- `accessToken`（短期）+ `refreshToken`（中期）双令牌机制。
- refresh token 只存哈希；支持主动失效（登出/风控）。

授权：

- 基于 `role -> permission` 的 RBAC。
- 路由级权限校验，关键动作二次校验（发布、回滚、删除）。

安全基线：

- 输入校验：Route 入参全部 Zod 校验。
- 输出最小化：避免泄露内部字段（hash、内部 ID）。
- 频控：登录、评论、上传接口必须限流。
- 内容安全：评论与富文本内容做 XSS 白名单过滤。
- 审计：关键写操作统一记录 `requestId` 与前后快照。

## 10. 发布与回滚机制

核心模型：

- `posts.status`：草稿 / 已发布 / 下线
- `post_revisions`：每次保存形成版本快照
- `posts.current_revision_id`：指向当前生效版本

发布流程：

1. 创建新 revision（或选定 revision）  
2. 事务内更新 `posts.current_revision_id`、`status`、`published_at`  
3. 写入 `publish_records` 与 `audit_logs`  
4. 清理前台缓存（Redis key + CDN/网关缓存）

回滚流程：

1. 校验目标 revision 可用  
2. 事务内切换 `current_revision_id`  
3. 写审计与发布记录  
4. 触发缓存失效

## 11. API 规范与错误模型

响应规范：

- 默认统一返回：

```json
{
  "data": {},
  "message": "ok",
  "requestId": "req_xxx"
}
```

- 删除类接口允许 `204 No Content`。

错误规范：

```json
{
  "code": "VALIDATION_ERROR",
  "message": "参数错误",
  "details": {},
  "requestId": "req_xxx"
}
```

落地要点：

- Fastify `onRequest` 注入 `requestId`，贯穿日志与响应。
- 统一错误处理器映射业务错误码与 HTTP 状态码。
- 与前端兼容：公共接口优先保持契约字段名不变。

## 12. 可观测性与运维

日志：

- `pino` 结构化日志（JSON）。
- 关键字段：`requestId`、`actorUserId`、`path`、`latencyMs`、`statusCode`。

指标：

- QPS、P95/P99 延迟、错误率、慢查询数、Redis 命中率。
- 发布成功率、回滚成功率、上传失败率。

健康检查：

- `/health/live`：进程存活
- `/health/ready`：依赖可用（PostgreSQL、Redis、MinIO）

备份：

- PostgreSQL 每日备份 + WAL 策略（按环境分级）。
- MinIO 关键 bucket 定期快照或异地复制（按成本决定）。

## 13. 测试策略

测试层级：

- 单元测试：service/repository 业务规则与边界条件。
- 集成测试：数据库事务、鉴权、权限、回滚流程。
- 契约测试：校验与 `docs/backend-api-contract.md` 的字段一致性。
- 冒烟测试：发布前跑核心链路（登录、文章发布、评论审核、回滚）。

优先覆盖场景：

- 评论点赞并发与幂等。
- 发布回滚事务一致性。
- 站点配置覆盖写入（防误覆盖）。
- 权限绕过与 token 失效边界。

## 14. 环境与配置规划

建议环境变量：

- `NODE_ENV`
- `PORT`
- `LOG_LEVEL`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `MINIO_ENDPOINT`
- `MINIO_PORT`
- `MINIO_USE_SSL`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_BUCKET_PUBLIC`
- `MINIO_BUCKET_PRIVATE`
- `CORS_ORIGIN`

环境分层：

- `local`：开发联调、可降配
- `staging`：完整链路预发验证
- `production`：高可用 + 严格审计

## 15. 分阶段排期（6 周建议）

### 阶段 A（第 1 周）

- 后端工程初始化（Fastify、Drizzle、Zod、日志、配置）
- 数据库首批迁移（用户、文章、评论、站点核心表）
- 打通 `GET /api/blog/bootstrap`

### 阶段 B（第 2 周）

- 前台写接口全量完成（文章、评论、站点配置）
- 参数校验、错误模型、requestId 全链路
- 与前台联调并替换本地回退链路验证

### 阶段 C（第 3 周）

- Admin 鉴权（login/refresh/logout）
- RBAC 基础能力
- 审计日志写入中间件

### 阶段 D（第 4 周）

- Admin 内容管理接口（文章列表、编辑、发布、回滚）
- 评论审核与批量处理
- 发布记录与缓存失效

### 阶段 E（第 5 周）

- 站点配置聚合接口
- MinIO 媒体上传与媒体库查询
- 仪表盘 overview 聚合接口

### 阶段 F（第 6 周）

- 性能压测与慢查询优化
- 安全加固（限流、XSS、权限穿透测试）
- 上线前演练（发布、回滚、故障恢复）

## 16. 里程碑与验收

`M1`：公共 API 可支撑前台完整读写  
`M2`：Admin 登录、权限、文章管理可用  
`M3`：发布回滚、评论审核、审计日志可用  
`M4`：媒体、仪表盘、性能与安全达标

验收指标：

- 关键写操作 100% 记录审计日志。
- 发布失败可回滚，回滚后前台一致。
- API 错误可通过 `requestId` 定位。
- 后台核心接口 P95 满足设计指标（概览 < 400ms，分页列表 < 250ms）。

## 17. 风险与应对

- 需求扩张风险：按 P0/P1/P2 分层，先保证可用闭环。
- 契约漂移风险：上线前自动化契约测试，接口变更必须评审。
- 一致性风险：发布/回滚/批量操作强制事务化。
- 缓存脏读风险：写操作后统一失效 key，禁止仅更新缓存不落库。
- 文件治理风险：媒体资源与业务记录双向关联，定时清理孤儿文件。

## 18. 首批执行清单（建议本周启动）

1. 初始化 `backend/` 工程骨架与基础依赖。  
2. 完成 Drizzle 基础 schema 与首批 migration。  
3. 实现 `GET /api/blog/bootstrap` 与统一响应包装。  
4. 实现评论创建/点赞接口与限流。  
5. 实现文章新增/更新/删除接口。  
6. 建立基础 CI（lint + test + migration check）。  

## 19. 当前实施进度（2026-02-14）

里程碑状态（按代码现状）：

- `M1` 已完成：公共博客 API 已打通，前台读写链路可用。
- `M2` 已完成：Admin 登录鉴权、权限守卫、内容管理与评论管理接口收敛可用。
- `M3` 已完成：发布预览/发布/回滚、评论审核、审计日志链路可用。
- `M4` 部分完成：媒体库查询、外链入库、本地图片上传、仪表盘总览已落地；性能与安全达标项仍待专项验证。

已落地后端能力摘要：

- 鉴权与会话：`/api/admin/auth/login|refresh|logout`，refresh token 哈希持久化，支持失效与轮换。
- 管理能力：仪表盘、主题版本、审计日志、发布中心、媒体库、权限快照与用户权限更新接口可用。
- 博客主数据：`/api/blog/bootstrap` 与文章/评论/站点配置写接口可用，并已接入输入校验与统一错误模型。
- 稳定性基线：请求限流、`requestId` 贯穿、健康检查、PostgreSQL + Redis 持久化。

与原规划的差异与待办：

1. Admin 内容与评论已收敛到 `/api/admin/posts*`、`/api/admin/comments*`，但站点配置仍部分复用 `/api/blog/site*`。
2. 媒体能力已具备删除与孤儿清理能力，仍待补齐对象存储签名直传流程。
3. 数据层当前采用快照型 JSONB 持久化（`blog_snapshots`、`admin_runtime_snapshots`），尚未完全拆分为规划中的领域化表结构（如 `posts`、`post_revisions`、`media_assets`）。
4. 性能压测、安全穿透测试、契约自动化校验与 CI 质量门禁仍需补齐并固化。

建议下一阶段优先级：

1. 补齐 Admin 站点配置专用接口与聚合配置模型（减少对 `/api/blog/site*` 写接口依赖）。
2. 补齐媒体删除、对象存储签名上传、孤儿文件清理。
3. 推进领域表结构迁移与回滚演练，逐步替换快照模型。
4. 建立性能与安全专项基线（压测、限流策略回归、权限穿透测试）。

---

执行结论：采用 `Node.js 22 + Fastify + Drizzle + Zod + PostgreSQL + Redis + MinIO` 方案推进，先完成“前台可用 + 管理闭环最小集”，再进入仪表盘与主题等增强模块。
