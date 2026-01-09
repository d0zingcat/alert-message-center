# Alert Message Center

这是一个基于 **Bun**, **Hono**, **Drizzle ORM (SQLite)** 和 **React (Vite + Tailwind)** 构建的企业级告警管理系统。

它采用 **Topic (主题)** 订阅模型，类似于 Sentry 的告警分发机制。告警发送到特定的 Topic，系统根据订阅关系，通过 **飞书机器人私聊 (Private Message)** 将告警精准推送给订阅该 Topic 的用户。

## 核心理念

-   **Topic (主题)**: 业务逻辑上的告警分类，例如 `payment-service-error`, `frontend-performance`, `daily-report`。
-   **User (用户)**: 接收告警的实体，绑定飞书 User ID。
-   **Subscription (订阅)**: 用户订阅感兴趣的 Topic。
-   **Private Message (私聊)**: 告警不再发送到嘈杂的群组，而是直接私聊发送给相关负责人，确保触达。

## 功能特性

-   **精准分发**: 告警只发给订阅的人，避免群消息轰炸。
-   **集中管理**: 统一管理所有告警入口和订阅关系，无需维护大量硬编码的 Webhook URL。
-   **飞书集成**: 使用飞书开放平台 API，支持发送富文本和卡片消息。
-   **全局监控**: 提供 Grafana 风格的系统负载看板，实时追踪告警接收数、应发消息数及发送成功率。
-   **现代化技术栈**: 全栈 TypeScript，高性能 Bun 运行时。

## 快速开始

### 1. 前置准备

你需要创建一个飞书企业自建应用 (Custom App)：
1.  访问 [飞书开发者后台](https://open.feishu.cn/app)。
2.  创建企业自建应用。
3.  **启用机器人能力**: 在 "添加应用能力" -> "机器人" 中启用。
4.  **申请权限**: 在 "权限管理" 中申请以下权限：
    -   `im:message` (获取与发送单聊、群组消息)
    -   `im:message:send_as_bot` (以应用身份发送消息)
    -   (可选) `contact:user.id:readonly` (通过手机号或邮箱获取用户 ID)
5.  **发布版本**: 创建版本并发布，等待管理员审核通过。
6.  获取 **App ID** and **App Secret**。

### 2. 安装依赖

确保你已经安装了 [Bun](https://bun.sh/)。

```bash
# 在根目录运行
bun install
```

### 3. 配置环境变量

在 `apps/server` 目录下 (或者在启动命令中) 配置环境变量：

```bash
export FEISHU_APP_ID="你的AppID"
export FEISHU_APP_SECRET="你的AppSecret"
```

### 4. 启动开发环境

这将同时启动后端 API (端口 3000) 和前端界面 (端口 5173)。

```bash
bun run dev
```

访问前端界面: [http://localhost:5173](http://localhost:5173)

### 5. 使用指南

#### 第一步：配置 Topic
1.  进入 **Topics** 页面，点击 "Add Topic"。
2.  填写 Name (显示名) 和 Slug (唯一标识，用于 URL)。
    *   例如: Name: "支付服务异常", Slug: `payment-error`。

#### 第二步：添加用户
1.  进入 **Users** 页面，添加用户。
2.  必须填入用户的 **飞书 User ID** (Open ID 或 User ID)。
    *   *提示: 可以在飞书管理后台查看用户的 User ID，或者通过 API 获取。*

#### 第三步：订阅告警
1.  回到 **Topics** 页面。
2.  点击 Topic 卡片上的 **订阅图标** (用户组图标)。
3.  勾选需要接收该 Topic 告警的用户。

#### 第四步：发送告警
使用你的程序或脚本向系统发送 POST 请求：

**POST** `http://localhost:3000/api/webhook/:slug`

示例 (curl):

```bash
curl -X POST http://localhost:3000/api/webhook/payment-error \
  -H "Content-Type: application/json" \
  -d '{
    "msg_type": "text",
    "content": {
      "text": "支付接口响应超时 (500ms)"
    }
  }'
```

系统会查找订阅了 `payment-error` 的所有用户，并通过飞书机器人给他们分别发送私聊消息。

## API 参考

### 发送告警

`POST /api/webhook/:slug`

**Parameters:**
- `slug`: Topic 的唯一标识符。

**Body:**
直接透传给飞书消息 API 的 `content` 和 `msg_type`。

1. **文本消息**:
```json
{
  "msg_type": "text",
  "content": {
    "text": "告警内容..."
  }
}
```

2. **富文本/卡片消息**:
请参考 [飞书发送消息 API 文档](https://open.feishu.cn/document/server-docs/im-v1/message/create) 构建 `content`。

## 项目结构

*   `apps/server`: 后端服务 (Hono + Drizzle)
    *   `src/index.ts`: 入口文件
    *   `src/feishu.ts`: 飞书 API 客户端
    *   `src/webhook.ts`: 告警处理与分发逻辑
    *   `src/db`: 数据库 Schema (Topics, Users, Subscriptions)
*   `apps/web`: 前端界面 (React + Vite)
    *   `src/views/SystemLoadView.tsx`: 实时监控仪表盘
    *   `src/views/AdminView.tsx`: 后台管理与仪表盘集成
