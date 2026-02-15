# vueblog

一个基于 `Vue 3 + TypeScript + Vite`（前端）与 `Fastify + Drizzle`（后端）的博客与后台管理系统。

- 前台：文章浏览、评论、链接页、时间线、关于页
- 后台：登录鉴权、内容管理、评论管理、主题管理、发布中心、媒体库、权限管理、操作日志
- 基础设施：PostgreSQL + Redis + MinIO（通过 Docker Compose 启动）

## 技术栈

### 前端

- Vue 3
- TypeScript
- Vite
- Vue Router
- Pinia
- markdown-it + KaTeX

### 后端

- Fastify
- TypeScript
- Drizzle ORM
- PostgreSQL
- Redis
- MinIO

## 项目结构

```txt
.
├── src/                    # 前端源码
├── backend/                # 后端源码
├── docs/                   # 设计与契约文档
├── scripts/                # 仓库级脚本（quality gate / preflight / lifecycle）
├── docker-compose.backend.yml
├── start.sh                # 本地一键启动
└── PROJECT_INDEX.md        # 项目索引
```

## 环境要求

- Node.js: `^20.19.0 || >=22.12.0`（建议 22 LTS）
- Yarn: 1.x/4.x 均可（建议启用 `corepack`）
- Docker + Docker Compose v2

## 快速开始

### 方式一：一键启动（推荐）

```bash
./start.sh
```

该脚本会自动：

- 检查依赖命令
- 补齐 `.env` 与 `backend/.env`（若不存在）
- 启动 PostgreSQL/Redis/MinIO
- 应用 MinIO 生命周期策略
- 启动前后端开发服务

### 方式二：手动启动

1. 准备环境变量

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

2. 安装依赖

```bash
yarn
cd backend && yarn && cd ..
```

3. 启动基础设施

```bash
docker compose -f docker-compose.backend.yml up -d
bash ./scripts/minio-lifecycle-policy.sh --apply
```

4. 启动开发服务

```bash
# 终端 1：后端
cd backend && yarn dev

# 终端 2：前端
yarn dev
```

## 本地访问

- 前端开发服务：`http://127.0.0.1:5173`
- 后端服务：`http://127.0.0.1:3000`
- 健康检查：
  - `GET /health/live`
  - `GET /health/ready`
- MinIO Console：`http://127.0.0.1:9001`

## 默认管理员账号

来自 `backend/.env.example`：

- 邮箱：`admin@example.com`
- 密码：`change-me-in-local-env`

建议本地开发时立刻修改 `backend/.env` 中的 `ADMIN_BOOTSTRAP_PASSWORD`。

## 常用命令

### 根目录命令

```bash
# 前端开发
yarn dev

# 前端类型检查
yarn type-check

# 前端构建
yarn build

# 质量门禁（前后端构建 + 冒烟 + 合同漂移 + 安全基线 + 一致性）
yarn quality-gate

# 发布前检查
yarn publish:preflight -- "v1.0 发布说明（含风险与回滚触发条件）" latest

# MinIO 生命周期策略
yarn minio:lifecycle:apply
yarn minio:lifecycle:verify

# 仓库 required checks（默认 dry-run）
bash ./scripts/apply-required-checks.sh --apply <owner/repo> <branch>
```

### backend 目录命令

```bash
cd backend

# 开发 / 构建 / 类型检查
yarn dev
yarn build
yarn type-check

# 数据库迁移
yarn db:generate
yarn db:migrate

# 运行态一致性检查
yarn runtime:consistency

# 发布回滚目标检查
yarn rollback:target -- latest

# 媒体孤儿清理（默认 dry-run）
yarn media:gc
```

## CI 与质量门禁

GitHub Actions 工作流：`.github/workflows/quality-gate.yml`。

每次 push/PR（`main`/`master`）会执行：

- `scripts/run-quality-gate.sh`
- 包含前后端类型检查与构建
- 后端/前端 smoke 检查
- API contract drift 检查
- security baseline 检查
- runtime consistency 检查

本地可直接复现 CI：

```bash
yarn quality-gate
```

## 常见问题

- `QUALITY_GATE=FAIL` 且阶段是 `api contract drift`：
  先确认是否已拉到最新 `main`，再本地执行 `yarn quality-gate` 查看具体缺失路径。
- `QUALITY_GATE=FAIL` 且阶段是 `minio lifecycle policy`：
  先确认 `docker compose -f docker-compose.backend.yml up -d` 成功，再执行 `yarn minio:lifecycle:apply`。
- 看到 `Post job cleanup` 的 Git 警告（如 submodule 相关）：
  通常不是主失败原因，优先看 quality gate 中首个 `FAIL` 阶段。

## API 与设计文档

- 后端 API 契约：`docs/backend-api-contract.md`
- 后台建设计划：`docs/admin-backoffice-plan.md`
- 后台设计文档：`docs/admin-backoffice-design-v1.md`
- 后端技术方案：`docs/backend-fastify-drizzle-plan.md`
- 项目索引：`PROJECT_INDEX.md`

## License

[Apache-2.0](LICENSE)
