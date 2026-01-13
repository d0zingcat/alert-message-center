# 更新日志

本项目的所有显著变更都将记录在此文件中。

本文件的格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本 (Semantic Versioning)](https://semver.org/lang/zh-CN/spec/v2.0.0.html)。

## [1.1.0] - 2026-01-13

### 新增
- **Docker 集成**: 将前端和后端合并为统一个 Docker 镜像，简化部署流程。
- **CI/CD**: 添加了 GitHub Actions 工作流，支持自动化 Docker 构建和镜像推送。
- **环境隔离**: 改进了单体仓库中的 `.env` 处理，使用 Bun 的 `--env-file` 参数。
- **根目录脚本**: 在根目录添加了 `start` 和 `dev` 脚本，提升开发体验。
- **代理配置**: 使 Vite 的代理目标可通过 `VITE_API_URL` 环境变量配置。

### 变更
- 更新了服务端，使其从 `public` 目录提供前端静态文件。
- 将 `docker-compose.yml` 整合为单一服务。

## [1.0.0] - 2026-01-12

### 新增
- **个人信箱**: 支持通过个人 Webhook Token 实现私聊推送。
- **话题管理**: 为话题增加了 `created_by` (创建者) 和 `approved_by` (审批人) 的追踪。
- **管理员看板**: 新增了管理话题申请和权限的视图。
- **身份验证**: 集成飞书 (Lark) OAuth2。
- **初始版本**: 基于 Hono, Vite 和 PostgreSQL 的基础告警分发系统。

### 修复
- 优化了 README 文档和项目结构。

## [0.1.0] - 2026-01-12

### 新增
- 初始项目结构和数据库模式定义。
- 基础的飞书消息发送功能。
