# Agent Guide for Alert Message Center

This document provides instructions for AI agents working on the Alert Message Center codebase.

## 🛠 Commands

### Workspace Operations
- **Install**: `bun install`
- **Root Dev**: `bun run dev` (starts both server and web)
- **Root Build**: `bun run build`
- **Lint & Format**: 
  - `bun run lint`: Run Biome linter
  - `bun run format`: Fix formatting issues
  - `bun run check`: Linter + Formatter fix

### Backend (`apps/server`)
- **Dev**: `bun run dev`
- **Migrations**: 
  - `bun run db:generate`: Generate migration files
  - `bun run db:push`: Push schema changes directly (dev only)
  - `bun run db:migrate:deploy`: Run migrations in production/Docker
- **Verification**: `bun run src/verify_permissions.ts` (Manual verification script)

### Frontend (`apps/web`)
- **Dev**: `bun run dev`
- **Build**: `bun run build`

### Testing
- No automated tests currently exist in the repository. If adding tests, use **Bun Test**.
- **Run Single Test**: `bun test path/to/file.test.ts`

---

## 📜 Code Style & Conventions

### 1. General
- **Runtime**: Bun is the primary runtime. Use `node:` protocol for built-in modules (e.g., `import fs from "node:fs"`).
- **Formatting**: Enforced by Biome. Use **tabs** for indentation and **double quotes**.
- **Naming**: 
  - Variables/Functions: `camelCase`
  - Components/Classes/Interfaces: `PascalCase`
  - Database Tables/Columns: `snake_case` (e.g., `topic_group_chats`)
  - URL Slugs: `kebab-case`

### 2. TypeScript & Type Safety
- **Strict Mode**: No `any` allowed. Use explicit interfaces or Zod schemas.
- **Interfaces vs Types**: Prefer `interface` for object definitions and `type` for unions/aliases.
- **RPC**: Use `hono/client` for type-safe communication between frontend and backend.
- **Vite Env**: Always use optional chaining when accessing `import.meta.env?.VITE_...`.

### 3. Backend (Hono + Drizzle)
- **Routing**: Group logic into sub-apps (e.g., `api.ts`, `auth.ts`, `webhook.ts`).
- **Database**: Use Drizzle ORM. Prefer relational queries where possible (`db.query.xxx.findMany`).
- **Validation**: Use `@hono/zod-validator` for request validation.
- **Logging**: Use the structured logger in `src/lib/logger.ts` (Pino). 
  - **Pattern**: `logger.error({ err, context }, "Message")`.

### 4. Frontend (React + Tailwind)
- **Components**: Functional components with hooks.
- **Styling**: Tailwind CSS utility classes. Avoid custom CSS files.
- **Icons**: Use `lucide-react`.
- **Resilience**: 
  - Always check `res.ok` before parsing API responses.
  - Provide fallback states (e.g., `[]`) for data fetching.

### 5. Error Handling
- **Backend**: Wrap critical logic in `try/catch`. Log errors with context. Return meaningful JSON errors with appropriate HTTP status codes.
- **Frontend**: Use `useState` to track error states and display user-friendly messages.

---

## 🏗 Architecture Context
- **Topic Model**: Alerts are sent to "Topics". Users and Group Chats subscribe to Topics.
- **Personal Inbox**: Each user has a `personalToken` (8-character hex) for direct `/dm` alerts.
- **Feishu Integration**: Uses `@larksuiteoapi/node-sdk`. Supports both Webhook and WebSocket modes for events.
- **Auth**: Feishu SSO (OAuth2). Admin status is assigned via `ADMIN_EMAILS` env var on first login.

## 🤖 Rules for Agents
- **NO `any`**: This is a hard requirement. Research types or define them.
- **Biome First**: Always run `bun run check` before concluding a task.
- **Preserve Patterns**: Follow existing structure in `apps/server/src` and `apps/web/src`.
- **Minimalism**: Fix bugs minimally. Avoid large refactors unless requested.
- **Context**: Agent-specific context is located in `@docs/`. Refer to `docs/copilot-context.md` for additional instructions.
