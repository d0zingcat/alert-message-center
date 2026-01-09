# Alert Message Center Project Plan

## Phase 1: Core Functionality (Completed)
- [x] Initialize project structure (Bun, Monorepo)
- [x] Setup Backend (Hono + Bun)
    - [x] Setup Drizzle (SQLite)
    - [x] **Refactor Schema**: Switch from Bots/Roles to Topics/Users/Subscriptions
    - [x] **Feishu Integration**: Implement Tenant Access Token & Private Message sending
    - [x] Implement Webhook API (`POST /api/webhook/:slug`)
    - [x] Implement Management APIs (CRUD for Topics, Users)
- [x] Setup Frontend (Vite + React + Tailwind)
    - [x] **Topics View**: Manage topics and subscriptions
    - [x] **Users View**: Manage users and Feishu IDs
    - [x] Remove obsolete Bots/Roles views

## Phase 2: Enhancements
- [x] **Authentication**: Feishu SSO integration and role-based access control.
- [x] **Global Monitoring Dashboard**: Real-time System Load metrics (Grafana-style).
- [ ] **Message Preview**: Preview Feishu card JSON in the UI.
- [x] **History/Logs**: Basic tracking for sent alerts (Alert Tasks/Logs).
- [x] **Admin Topic Management**: Approve, reject, and delete topics.
- [ ] **Retry Mechanism**: Handle Feishu API failures.
- [ ] **Deployment**: Dockerfile and deployment scripts.

