# Alert Message Center

**README** | [简体中文](./README.zh-CN.md)

[![Tech Stack](https://img.shields.io/badge/Stack-Bun%20%7C%20Hono%20%7C%20React-blue)](https://bun.sh)
[![Database](https://img.shields.io/badge/Database-PostgreSQL-blue)](https://www.postgresql.org/)

**Alert Message Center** is a modern, enterprise-grade alert routing and dispatching hub. It decouples complex alert sources (Prometheus, Grafana, custom scripts, etc.) from end recipients, ensuring precise alert delivery via **Feishu (Lark) private messages and group chats.**

---

## 📸 Preview

### 1. Topic Management & Personal Inbox
Supports alert distribution through the **Topic** subscription model, and also provides a **Personal Inbox** feature for quick self-notifications without creating a topic.
![Topics View](docs/images/topics_view.png)

### 2. Group Chat Alert Dispatch
Supports adding the bot to Feishu group chats and binding topics to these groups for group-wide broadcasting.
![Group Binding](docs/images/group_binding.png)
![Group Alert](docs/images/group_alert.png)

### 3. Admin Dashboard (Live Stats)
Real-time tracking of system alert load, dispatch success rates, and topic popularity.
![Admin Dashboard](docs/images/admin_dashboard.png)

---

## 🔥 Key Features

- **🚀 Zero-Config Personal Inbox**: Every user has a unique Webhook Token. Send directly to the `/dm` interface to receive messages on Feishu with zero configuration.
- **📢 Topic Subscription Model**: Flexible "Publish-Subscribe" mechanism. Alerts sent to a Topic are automatically distributed to all subscribers.
- **👥 Group Chat Distribution**: Alerts can be simultaneously dispatched to bound Feishu group chats, supporting automatic discovery and unbinding.
- **🛡️ Permissions & Auditing**:
    - Topic creation requires admin approval.
    - Full `Alert Task` logs for end-to-end traceability.
- **📊 Real-time Dashboard**: Grafana-style monitoring interface for system health visualization.
- **🔌 WebSocket Mode**: Supports Feishu Open Platform WebSocket for intranet deployments without public IP or domain.
- **📎 Attachment Support**: Send files and images directly via dashboard or API.
- **⚡ High Performance**: Built on Bun + Hono for millisecond-level dispatch latency.

---

## 🛠️ Tech Stack

- **Runtime**: [Bun](https://bun.sh/) (High-performance TS runtime)
- **Backend**: [Hono](https://hono.dev/) (Web Standards Based)
- **Frontend**: [React](https://react.dev/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) + [Drizzle ORM](https://orm.drizzle.team/)
- **Messaging**: [Feishu (Lark) Open Platform](https://open.feishu.cn/)

---

## 🚀 Quick Start

### 1. Feishu App Configuration
1. Login to the [Feishu Open Platform](https://open.feishu.cn/) and create an **Enterprise Custom App**.
2. Enable **Bot** capability in "App Capabilities".
3. Apply for `im:message:send_as_bot` permission in "Permission Management".
4. Get your `App ID` and `App Secret`.

### 2. Deployment
```bash
# Install dependencies
bun install

# Configure environment variables (apps/server/.env)
DATABASE_URL="postgresql://user:pass@localhost:5432/db"
FEISHU_APP_ID="cli_xxx"
FEISHU_APP_SECRET="xxx"
ADMIN_EMAILS="user1@example.com,user2@example.com"

# Database migration
cd apps/server && bun run db:migrate:deploy

# Start development
bun run dev
```

### 3. Docker Deployment
```bash
cp apps/server/.env.example .env
docker-compose up -d
```

---

## 🏗️ CI/CD
Automatically builds and pushes Docker images to GitHub Container Registry (GHCR) on every push to `main`.

## 📜 Changelog
See [CHANGELOG.md](CHANGELOG.md) for version history.

## 📡 Webhook Usage

### 1. Send to Personal Inbox (DM)
- **URL**: `POST /api/webhook/:your_token/dm`
- **Format**: JSON or Multipart Form-Data

### 2. Send to Topic
- **URL**: `POST /api/webhook/:your_token/topic/:topic_slug`

### Examples (using curl)

**Send Text (JSON):**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"content":{"text":"Hello World"}}' \
  http://localhost:3000/api/webhook/YOUR_TOKEN/dm
```

**Send File (Multipart):**
```bash
curl -X POST \
  -F "content={\"text\":\"Check this file\"}" \
  -F "file=@/path/to/report.pdf" \
  http://localhost:3000/api/webhook/YOUR_TOKEN/dm
```

**Send Image:**
```bash
curl -X POST \
  -F "image=@/path/to/screenshot.png" \
  http://localhost:3000/api/webhook/YOUR_TOKEN/dm
```

## 📂 Project Structure
- `apps/server`: Core API service
- `apps/web`: Responsive management dashboard

---
*Created with ❤️ by the Alert Message Center Team.*
