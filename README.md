# vue-blog-single-store

基于 `Vue 3.2+ + TypeScript + Vite` 的博客示例项目，使用单一 `Pinia` 模块管理状态，并将内容与样式彻底分离。

## 创建方式

项目初始化命令：

```sh
yarn dlx create-vue@latest
```

## 技术栈

- Vue 3
- TypeScript
- Vite
- Vue Router
- Pinia（单模块：`src/stores/blog.ts`）

## 目录说明

```txt
src/
  assets/styles/     # 统一样式系统（tokens/base/blog）
  components/blog/   # 页面展示组件
  content/           # 构建期静态素材（不参与运行期数据源）
  services/          # 后端网关与接口适配
  stores/            # 单一状态模块
  types/             # 领域类型定义
  views/             # 页面视图
```

## 使用方式

安装依赖：

```sh
yarn
```

开发运行：

```sh
yarn dev
```

生产构建：

```sh
yarn build
```

质量门禁（类型检查 + 构建 + 合同漂移 + 安全基线 + 回归 smoke）：

```sh
yarn quality-gate
```

发布前检查（质量门禁 + 一致性 + 回滚目标）：

```sh
yarn publish:preflight -- "v1.0 发布说明（含风险与回滚触发条件）" latest
```

MinIO 生命周期策略（`admin/tmp/` 过期规则）：

```sh
yarn minio:lifecycle:apply
yarn minio:lifecycle:verify
```

仓库必过检查（GitHub required status checks，默认 dry-run）：

```sh
bash ./scripts/apply-required-checks.sh --apply <owner/repo> <branch>
```

## 预留后端接口

项目已预留全站可编辑内容的后端网关接口，统一入口：

- `src/services/blog-api.ts`
- `src/types/api.ts`

### 环境变量

当前版本前台与后台管理均仅使用后端 API，不再提供前端 mock/本地回退数据。

```sh
# Blog API 基础地址
VITE_BLOG_API_BASE_URL=/api

# Admin API 基础地址（开发环境可保持 /api/admin，Vite 会代理到后端）
VITE_ADMIN_API_BASE_URL=/api/admin

# 前端 dev server 监听地址/端口（用于稳定 HMR）
VITE_DEV_SERVER_HOST=127.0.0.1
VITE_DEV_SERVER_PORT=5173

# 本地开发 /api 代理目标
VITE_DEV_API_PROXY_TARGET=http://localhost:3000

# SEO 基础信息（构建期）
VITE_SITE_TITLE=Blog
VITE_SITE_DESCRIPTION=Personal blog powered by API-first content pipeline.
VITE_SITE_URL=https://example.com
```

### 已预留接口能力

- 全站启动数据：`getBootstrapData`
- 评论写入：`createComment`
- 评论点赞：`toggleCommentLike`
- 文章新增/更新/删除：`upsertPost` / `deletePost`
- 站点资料更新：`updateSiteProfile` / `updateSiteFooter`
- 页面内容更新：`replaceFriendLinks` / `replaceAboutSections` / `replaceProjects`

以上接口已在 `src/stores/blog.ts` 单模块内统一调用，后续接真实后端只需按约定实现对应 API 即可。

完整后端对接文档见：`docs/backend-api-contract.md`
后台建设计划文档见：`docs/admin-backoffice-plan.md`
后台实施设计文档见：`docs/admin-backoffice-design-v1.md`

## 项目索引

- 总索引文档：`PROJECT_INDEX.md`
