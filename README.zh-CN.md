# Alert Message Center

[English](./README.md) | **简体中文**

[![Tech Stack](https://img.shields.io/badge/Stack-Bun%20%7C%20Hono%20%7C%20React-blue)](https://bun.sh)
[![Database](https://img.shields.io/badge/Database-PostgreSQL-blue)](https://www.postgresql.org/)

**Alert Message Center** 是一个现代化、企业级的告警路由与分发中心。它旨在将纷繁复杂的告警源（Prometheus, Grafana, 自建脚本等）与最终接收人解耦，通过 **飞书机器人私聊** 实现告警的精准触达。

---

## 📸 界面预览

### 1. 话题管理与个人信箱
支持通过 **Topic (主题)** 订阅模式分发告警，同时也提供 **Personal Inbox (个人信箱)** 功能，无需创建话题即可快速给自己推送消息。
![Topics View](docs/images/topics_view.png)

### 2. 群聊告警分发
支持将机器人加入飞书群聊，并将话题绑定到群聊中，实现告警的群组广播。
![Group Binding](docs/images/group_binding.png)
![Group Alert](docs/images/group_alert.png)

### 3. 管理员看板 (Live Stats)
实时追踪全系统的告警负载、分发成功率以及各话题的热度。
![Admin Dashboard](docs/images/admin_dashboard.png)

---

## 🔥 核心特性

- **🚀 极简推送 (Personal Inbox)**: 每个用户拥有专属的 Webhook Token，直接向 `/dm` 接口发送即可在飞书收到私聊，零配置成本。
- **📢 主题订阅 (Topic Model)**: 灵活的“发布-订阅”机制。告警发送至 Topic，系统自动分发给所有订阅成员。
- **👥 群聊分发 (Group Support)**: 告警可同步分发至绑定的飞书群聊，支持机器人自动发现与解绑。
- **🛡️ 权限与审计**: 
    - 话题创建需经过管理员审批。
    - 记录完整的 `Alert Task` 日志，实现发送链路可追溯。
- **📊 实时看板**: Grafana 风格的监控界面，直观展示系统运行健壮性。
- **🔌 长连接模式 (WebSocket)**: 支持飞书开放平台长连接，无需公网 IP 或域名即可在内网环境接收事件回调。
- **📎 附件支持**: 支持通过控制面板或 API 直接发送文件和图片。
- **⚡ 高性能架构**: 基于 Bun + Hono 的全异步架构，毫秒级分发延迟。

---

## 🛠️ 技术栈

- **Runtime**: [Bun](https://bun.sh/) (高性能 TS 运行时)
- **Backend**: [Hono](https://hono.dev/) (Web Standards Based)
- **Frontend**: [React](https://react.dev/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) + [Drizzle ORM](https://orm.drizzle.team/)
- **Messaging**: [Feishu (Lark) Open Platform](https://open.feishu.cn/)

---

## 🚀 快速开始

### 1. 飞书应用配置
1.  登录 [飞书开放平台](https://open.feishu.cn/) 创建一个 **企业自建应用**。
2.  在“应用能力”中开启 **机器人**。
3.  在“权限管理”中申请 `im:message:send_as_bot` (以应用身份发送消息)。
4.  获取 `App ID` 和 `App Secret`。

### 2. 部署运行
```bash
# 安装依赖
bun install

# 配置环境变量 (apps/server/.env)
DATABASE_URL="postgresql://user:pass@localhost:5432/db"
FEISHU_APP_ID="cli_xxx"
FEISHU_APP_SECRET="xxx"
ADMIN_EMAILS="user1@example.com,user2@example.com" # 管理员列表

# 数据库推送/迁移
cd apps/server && bun run db:migrate:deploy

# 启动开发环境
bun run dev
```

### 3. Docker 部署
项目支持使用 Docker Compose 快速部署，且**数据库会自动进行初始化与迁移**：

```bash
# 复制并填写环境变量
cp apps/server/.env.example .env

# 启动所有服务 (Postgres + Server + Web)
docker-compose up -d
```

---

## 🏗️ CI/CD

项目通过 GitHub Actions 实现了自动化流水线。

## 📜 更新日志

所有版本的详细变更记录请查看 [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md)。

---

## 📡 Webhook 使用指南

### 1. 发送给个人 (Personal Inbox)
- **URL**: `POST /api/webhook/:your_token/dm`
- **格式**: JSON 或 Multipart Form-Data

### 2. 发送到主题 (Topic)
- **URL**: `POST /api/webhook/:your_token/topic/:topic_slug`

### 使用示例 (curl)

**发送纯文字 (JSON):**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"content":{"text":"你好，世界"}}' \
  http://localhost:3000/api/webhook/YOUR_TOKEN/dm
```

**发送文件 (Multipart):**
```bash
curl -X POST \
  -F "content={\"text\":\"请查看附件\"}" \
  -F "file=@/path/to/report.pdf" \
  http://localhost:3000/api/webhook/YOUR_TOKEN/dm
```

**发送图片:**
```bash
curl -X POST \
  -F "image=@/path/to/screenshot.png" \
  http://localhost:3000/api/webhook/YOUR_TOKEN/dm
```

---

## 📂 项目结构

- `apps/server`: 核心 API 服务，处理 OAuth、Webhook 解析与飞书分发。
- `apps/web`: 响应式管理后台。
- `docs/copilot-context.md`: 为 AI 辅助编程提供的深层架构背景。

---
*Created with ❤️ by the Alert Message Center Team.*
