# 更新日志

本项目的所有显著变更都将记录在此文件中。

本文件的格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本 (Semantic Versioning)](https://semver.org/lang/zh-CN/spec/v2.0.0.html)。

## [1.2.1] - 2026-01-14

### 修复
- **WebSocket 初始化**: 修复了 `@larksuiteoapi/node-sdk` v1.56.0+ 中 WebSocket 初始化不正确的 `TypeError`。现在正确使用了 `WSClient` 类并修复了参数类型错误。
- **事件处理**: 修正了 `im.chat.member.bot.added_v1` 事件的 Payload 解析逻辑。
- **群聊解绑**: 增加对 `im.chat.member.bot.deleted_v1` 事件的支持。当机器人被移除群聊时，自动清理 `known_group_chats` 和 `topic_group_chats` 关联，确保订阅关系自动解绑。

### 新增
- **结构化日志**: 引入 `pino` 框架替代 `console.log`，实现结构化 JSON 日志输出。
  - 在开发环境集成 `pino-pretty` 提供人类友好格式。
  - 支持通过环境遍历控制日志级别。

## [1.2.0] - 2026-01-13

### 新增
- **飞书群聊通知**: 支持将告警发送到飞书群聊 (App Bot 模式)。
  - 自动发现机器人所在的群组。
  - 支持在 Topic 中绑定群聊。
- **长连接模式 (WebSocket)**: 引入 `@larksuiteoapi/node-sdk`，支持通过 WebSocket 接收飞书事件，解决内网环境无法使用 Webhook 的问题。
  - 可通过 `FEISHU_USE_WS=true` 开启。
- **UI 改进**: 在 Topic 列表页新增了群聊管理入口。

### 变更
- **数据库**: 新增 `topic_group_chats` 和 `known_group_chats` 表。
- **底层架构**: 重构了飞书客户端 (`FeishuClient`) 和事件处理逻辑，统一了 Webhook 和 WebSocket 的事件分发。
## [1.1.1] - 2026-01-13

### 修复
- **CI/CD**: 修复了由于 Dockerfile 路径重构导致的 GitHub Actions 构建失败问题。

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
