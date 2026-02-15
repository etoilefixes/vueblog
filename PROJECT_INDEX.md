# 项目索引

## 项目概览

- 前端：`Vue 3 + TypeScript + Vite`（根目录）
- 后端：`Fastify + Drizzle`（`backend/`）
- 基础设施：`PostgreSQL + Redis + MinIO`（`docker-compose.backend.yml`）

## 当前进度快照（2026-02-14）

### 已完成（可用闭环）

- 后台登录与会话：`/api/admin/auth/login|refresh|logout`、路由守卫、权限校验。
- 后台核心模块：仪表盘、内容管理、站点配置、评论管理、主题管理、发布中心、媒体库、权限管理、操作日志。
- 内容编辑体验：结构化编辑 + Markdown 双模式、编辑器内预览、媒体库插图、标签批量管理。
- 媒体能力：外链录入 + 本地图片上传（`/api/admin/media/upload-local`）并可通过 `/api/media/local/:fileName` 访问。
- 媒体治理能力：删除接口、引用保护（默认拒绝删被引用资源）、孤儿清理（支持 dry-run / apply）已落地。
- MinIO 上传链路：已补齐签名直传（`/api/admin/media/upload-signed-url`）与分片上传（init/presign-part/complete/abort）闭环。
- 数据模型迁移（阶段一）：媒体记录与分片会话已拆分到领域表（`admin_media_assets`、`admin_multipart_upload_sessions`），并保留快照兼容回填。
- 媒体清理链路：已覆盖本地文件、MinIO 孤儿对象与孤儿分片上传会话（可 dry-run/apply）。
- 数据模型迁移（阶段二）：博客内容域已建立领域表并双写（`blog_posts`、`blog_comments`、`blog_site_state`）。
- 数据模型迁移（阶段三）：后台运行态已切到领域表主读 + 快照兜底（`admin_theme_revisions`、`admin_publish_records`、`admin_access_users`、`admin_access_state`）。
- MinIO 生命周期策略：已提供并接入 `scripts/minio-lifecycle-policy.sh`（默认治理 `admin/tmp/` 过期规则）。
- 发布收尾工具链：已补齐 `runtime:consistency`、`rollback:target`、`publish:preflight` 检查闭环。
- 前台联动：`/api/blog/bootstrap` + 文章/评论/站点配置写接口已打通，后台操作可驱动前台数据。
- 后台内容/评论写接口已收敛到 `/api/admin/posts*` 与 `/api/admin/comments*`，并支持评论批量处理。
- 工程门禁：`scripts/run-quality-gate.sh` 已接入 CI（GitHub Actions），并新增安全回归、性能 P95 smoke、MinIO 生命周期策略与运行态一致性检查。

### 未完成（与生产级仍有差距）

- 仓库平台侧仍需收尾：需要在 GitHub 仓库设置中真正应用 required status checks（脚本已提供，需绑定真实仓库）。
- 发布演练仍可继续增强：建议补一次“故障注入 + 回滚 + 恢复”实战记录。
- 性能压测与更细粒度安全专项验证（XSS/限流回归深测）仍需补齐。

### 完成度判断

- 功能可用性：已达到“可演示 + 可运营的管理闭环”。
- 工程完善度：尚未达到“生产级完善”，当前更接近“Beta 可用”阶段。
- 结论：项目不算烂尾，主流程已成型，但上线前还需要一轮后端收敛和工程化补强。

### 下一步建议（按优先级）

1. 仓库治理：执行 `scripts/apply-required-checks.sh --apply <owner/repo> <branch>` 并在仓库侧确认生效。
2. 发布治理：按 `yarn publish:preflight -- "<release-note>" <rollback-target>` 固化发布流程。
3. 上线验证：执行一次故障恢复演练（发布失败 -> 回滚 -> 一致性校验）。
4. 做上线前验证：性能基线（P95）、权限穿透、发布回滚演练、故障恢复演练。

## 快速入口

- 一键启动前后端与基础设施：`./start.sh`
- 前端开发：`yarn dev`
- 后端开发：`cd backend && yarn dev`
- 质量门禁：`yarn quality-gate`
- 前端构建：`yarn build`
- 后端构建：`cd backend && yarn build`

## 顶层目录索引

| 路径 | 说明 |
| --- | --- |
| `src/` | 前端业务代码（页面、状态、服务、类型） |
| `backend/` | 后端服务代码（API、状态、数据访问、安全） |
| `docs/` | 方案、契约、设计文档 |
| `scripts/` | 仓库级脚本（质量门禁） |
| `public/` | 前端静态资源 |
| `dist/` | 前端构建产物 |
| `skills/` | 本仓库可复用技能说明与脚本 |

## 前端索引（`src/`）

### 核心入口

- `src/main.ts`：应用启动入口
- `src/App.vue`：根组件
- `src/router/index.ts`：路由定义
- `src/stores/blog.ts`：博客主状态管理
- `src/stores/admin-auth.ts`：后台登录态管理

### 关键服务层

- `src/services/blog-api.ts`：博客接口网关（含本地回退）
- `src/services/admin-api.ts`：后台接口网关
- `src/services/auth-session.ts`：认证会话管理
- `src/services/light-search.ts`：轻量搜索能力
- `src/services/search-highlight.ts`：搜索高亮处理

### 主要视图

- `src/views/HomeView.vue`
- `src/views/PostDetailView.vue`
- `src/views/AboutView.vue`
- `src/views/CategoriesView.vue`
- `src/views/LinksView.vue`
- `src/views/TagsView.vue`
- `src/views/TimelineView.vue`
- `src/views/admin/`：后台页面集合

## 后端索引（`backend/src/`）

### 核心入口

- `backend/src/server.ts`：Fastify 服务与路由入口
- `backend/src/config/env.ts`：环境变量配置
- `backend/src/security/rate-limit.ts`：限流策略

### 数据与基础设施

- `backend/src/db/client.ts`：数据库连接
- `backend/src/db/schema/admin-users.ts`：管理员相关表结构
- `backend/src/infra/redis/client.ts`：Redis 客户端
- `backend/src/infra/minio/client.ts`：MinIO 客户端
- `backend/src/infra/metrics/request-metrics.ts`：请求指标

### 业务模块

- `backend/src/modules/blog/contracts.ts`：博客模块契约
- `backend/src/modules/blog/state.ts`：博客模块状态读写
- `backend/src/modules/admin/contracts.ts`：后台模块契约
- `backend/src/modules/admin/state.ts`：后台模块状态读写
- `backend/src/modules/admin/runtime-state.ts`：后台运行态（领域表主读 + 快照兼容）

## 脚本与运行索引

- `start.sh`：本地一键启动（依赖检查、容器拉起、前后端并行启动）
- `scripts/run-quality-gate.sh`：仓库级质量门禁
- `backend/scripts/setup.sh`：后端初始化与启动辅助

## 文档索引（`docs/`）

- `docs/backend-api-contract.md`：前后端接口契约
- `docs/admin-backoffice-plan.md`：后台建设计划
- `docs/admin-backoffice-design-v1.md`：后台设计方案
- `docs/backend-fastify-drizzle-plan.md`：后端技术方案

## 环境与配置索引

- `.env.example`：前端环境变量模板
- `.env`：本地前端环境变量
- `backend/.env.example`：后端环境变量模板
- `backend/.env`：本地后端环境变量
- `vite.config.ts`：前端构建配置
- `backend/drizzle.config.ts`：Drizzle 配置
