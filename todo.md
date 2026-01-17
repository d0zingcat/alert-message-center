# Alert Message Center Project Plan

## Phase 1: Core Functionality (Completed)
- [x] Initialize project structure (Bun, Monorepo)
- [x] Setup Backend (Hono + Bun)
    - [x] Setup Drizzle (PostgreSQL)
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
- [x] **Admin Topic Management**: Approve, reject, and delete topics (with audit trail).
- [x] **Personal Inbox**: Direct alert delivery bypassing topics.
- [ ] **Retry Mechanism**: Handle Feishu API failures.
- [x] **Deployment**: Dockerfile and CI/CD (GitHub Actions + GHCR).
- [x] **Feishu Group Chat**: Event-based group discovery and alerting (App Bot).
- [x] **Auto-Cleanup**: Unbind subscriptions when bot is removed from group.
- [x] **Long Connection**: WebSocket support for intranet deployments.
- [x] **Structured Logging**: Integrated `pino` for better observability.
- [x] **Linting**: Tightened Biome rules and resolved all a11y/correctness issues.
- [x] **Automated Migrations**: Automatically initialize database schema on startup (especially in Docker).
- [x] **Frontend Resilience**: Hardened API calls to prevent crashes on empty data or env access errors.
- [x] **CI & Type Safety**: Resolved all TypeScript errors and Biome formatting issues to ensure a healthy CI pipeline.
- [x] **User Token Shortening**: Shortened `personalToken` to 8 characters and integrated automated migration into the deployment script.
- [x] **Visual Identity**: Added custom logo, favicon and integrated them into the UI (login/navbar).
- [x] **Migration Robustness**: Fixed migration failures in Docker by un-ignoring the drizzle meta directory.
- [x] **Scalability & Security**: Implemented Trusted User system, ownership-based group binding, and Admin notification for topic requests.
- [x] **User Management UI**: Added "Admin" badges and a "Trusted" toggle in the User Management view.
- [x] **Searchable Group Binding**: Implemented server-side search and searchable dropdown for smoother group chat management.
- [x] **Bilingual Documentation**: Split README into English and Chinese versions for international outreach.

