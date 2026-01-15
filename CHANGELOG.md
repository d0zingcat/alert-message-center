# 更新日志

本项目的所有显著变更都将记录在此文件中。

本文件的格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本 (Semantic Versioning)](https://semver.org/lang/zh-CN/spec/v2.0.0.html)。

## [1.2.8] - 2026-01-15

### 变更
- **文档规范**：更新了 `copilot-context.md`，详细列出了 Webhook 支持的所有消息类型（text, post, card, image, file 等），并详细说明了消息类型的自动推断逻辑。
- **文档优化**：清理了 `copilot-context.md` 中的冗余描述。

## [1.2.7] - 2026-01-15

### 修复
- **数据库迁移**：修复了在 K8s 环境下执行 `db:migrate:deploy` 时由于相对路径解析失败导致的迁移中断问题。现在使用绝对路径进行稳健解析，并增加了调试日志。

## [1.2.6] - 2026-01-15

### 变更
- **用户 Token**：将用户的 `personalToken` 从 32 位 UUID 缩短为 8 位十六进制字符串，提升易用性。
- **数据库迁移**：完善了数据库迁移流程，在 `db:migrate:deploy` 中集成了存量用户 Token 的自动缩短逻辑，确保线上环境数据的一致性。
- **AI 规范**：更新了 `copilot-context.md`，明确要求 AI 在每次修改代码后必须进行代码风格和 Lint 检查。
 
## [1.2.5] - 2026-01-15

### 修复
- **前端鲁棒性**: 修复了当数据库为空或 API 返回错误对象时页面发生崩溃（白屏）的问题。
    - 为 `TopicsView`, `SystemLoadView` 和 `AdminView` 中的所有 API 请求增加了 `res.ok` 和 `Array.isArray` 校验。
    - 增加了防御性逻辑，确保在数据未加载或加载失败时显示友好的提示而非崩溃。
- **Vite 环境变量**: 修复了 `TypeError: Cannot read properties of undefined (reading 'VITE_WEBHOOK_BASE_URL')`。
    - 在 `TopicsView.tsx` 中使用可选链 (`meta.env?.`) 安全地访问 Vite 环境变量，防止由于环境未完全初始化导致的崩溃。
- **CI & 类型安全**: 修复了破坏 CI 流水的类型错误与格式问题。
    - 运行 `biome check --write` 统一了全局代码格式。
    - 完善了 `feishu.ts` 中的 `UserAccessTokenData` 接口定义，补充了飞书 API 返回的用户基础信息字段。
    - 在 `auth.ts` 中增加了对 `feishuClient.getUserAccessToken` 返回值的空值校验，确保 OAuth 回调流程更健壮。

## [1.2.4] - 2026-01-15

### 变更
- **类型安全**: 全面重构了服务端与前端的代码，消除了绝大部分 `any` 类型的使用。
    - 在 `webhook.ts`, `verify_permissions.ts`, `feishu.ts` 等核心文件中引入了显式接口。
    - 改进了 Webhook Body 的处理逻辑，在保持灵活性的同时增强了类型校验。
    - 修复了多处 Non-null Assertion 为更安全的可选链或显式空值检查。
- **Linting**: 严格执行 Biome 的 `noExplicitAny` 规则。

## [1.2.3] - 2026-01-15

### 新增
- **自动化数据库迁移**: 引入了自动化数据库初始化与迁移机制。
    - 添加了 `src/db/migrate.ts` 脚本，使用 Drizzle Migrator 自动应用挂起的迁移。
    - 更新了 `Dockerfile`，使容器启动时自动执行数据库迁移。
    - 在 `package.json` 中新增了 `db:migrate:deploy` 脚本。

### 修复
- **初始化错误**: 修复了在全新环境下启动时因缺少数据库表导致的 `relation "users" does not exist` 错误。
- **迁移历史**: 清理并重新生成了初始迁移文件，确保所有表在全新部署时能正确创建。

## [1.2.2] - 2026-01-14

### 变更
- **Linting**: 强化了 Biome 配置，启用了更严格的 `a11y` (可访问性), `suspicious` (可疑代码), `style` (代码规范) 和 `correctness` (正确性) 检查规则。
- **配置**: 配置 `noUnknownAtRules` 规则以忽略 Tailwind CSS 特有的 At-rules。
- **CI/CD**: 集成 Biome 检查到 GitHub Actions 工作流，确保在所有 Pull Request 中强制执行代码规范检查。

### 修复
- **Web 可访问性**: 为所有按钮添加了显式的 `type="button"` 以符合规范。
- **语义化/ARAI**: 修正了 `Modal` 背景的交互逻辑，将非语义化的 `div` 替换为 `<button>` 并添加了必要的键盘事件与 ARIA 属性。
- **Hook 依赖**: 在多个视图中使用了 `useCallback` 来确保 `useEffect` 依赖链的稳定性，解决了 `exhaustive-deps` 警告。
- **代码健壮性**: 修复了 `main.tsx` 中的 Non-null Assertion 并解决了 `TopicsView` 中的类型重声明冲突。

## [1.2.1] - 2026-01-14

### 修复
- **WebSocket 初始化**: 修复了 `@larksuiteoapi/node-sdk` v1.56.0+ 中 WebSocket 初始化不正确的 `TypeError`。现在正确使用了 `WSClient` 类并修复了参数类型错误。
- **事件处理**: 修正了 `im.chat.member.bot.added_v1` 事件的 Payload 解析逻辑。
- **Hono 兼容性**: 修正了 `feishu-event.ts` 中 `lark.adaptDefault` 的错误用法。改为使用手动 Challenge 处理和 `eventDispatcher.invoke`，并通过原型链注入 Header 解决了与 Hono 请求/响应对象的兼容性以及签名校验失败的问题。
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
