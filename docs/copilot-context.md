# Project Context for GitHub Copilot (v1.2.2)

This document provides technical context, architectural decisions, and code conventions for the **Alert Message Center** project. It is intended to help AI assistants understand the codebase.

## 1. Project Overview

**Alert Message Center** (formerly Alert Manager) is a centralized alert dispatching system.
- **Goal**: Decouple alert sources from alert recipients.
- **Mechanism**:
  - **Topics**: Alerts are sent to a **Topic**. Users subscribe to Topics to receive messages.
  - **Personal Inbox**: Users can send alerts directly to themselves via a private webhook URL, bypassing Topic creation and approval.
  - **Group Chat**: Alerts can be dispatched to Feishu Group Chats where the App Bot is a member.
  - **Dispatch**: The system sends messages via **Feishu (Lark) Private Messages** or **Group Messages**.
- **Runtime**: Bun (JavaScript/TypeScript runtime).

## 2. Tech Stack

- **Monorepo**: Simple directory structure (`apps/server`, `apps/web`).
- **Backend**:
  - **Runtime**: Bun.
  - **Framework**: Hono (Web Standard based).
  - **Database**: PostgreSQL.
  - **ORM**: Drizzle ORM.
  - **Authentication**: Feishu OAuth2 (Session-based with cookies).
  - **External API**: Feishu Open Platform (Server-side API via `@larksuiteoapi/node-sdk`).
- **Frontend**:
  - **Build Tool**: Vite.
  - **Framework**: React.
  - **Styling**: Tailwind CSS.
  - **Icons**: Lucide React.
  - **Client**: `hono/client` (RPC-style type-safe client).

## 3. Data Model (Schema)

The database schema is defined in `apps/server/src/db/schema.ts`.

### Entities

1.  **Topic** (`topics`)
    - `id`: UUID (Primary Key)
    - `name`: Display name (e.g., "Payment Service Errors").
    - `slug`: URL-safe identifier (e.g., `payment-errors`). Used in webhook URLs.
    - `description`: Optional text.
    - `status`: `pending`, `approved`, or `rejected`.
    - `createdBy`: Foreign Key -> `users.id`.
    - `approvedBy`: Foreign Key -> `users.id`.

2.  **User** (`users`)
    - `id`: UUID (Primary Key).
    - `name`: Display name.
    - `feishuUserId`: The Feishu `open_id`. **Critical** for sending messages.
    - `email`: Contact info.
    - `isAdmin`: Boolean flag for administrative privileges (create topics, view all users).

3.  **Subscription** (`subscriptions`)
    - `topicId`: Foreign Key -> `topics.id`.
    - `userId`: Foreign Key -> `users.id`.
    - **Relationship**: Many-to-Many between Topics and Users.

4.  **Topic Group Chat** (`topic_group_chats`)
    - `id`: UUID (Primary Key).
    - `topicId`: Foreign Key -> `topics.id`.
    - `chatId`: The Feishu `chat_id`.
    - `name`: Group name (snapshot).
    - **Relationship**: Many-to-Many between Topics and Feishu Groups.

5.  **Known Group Chat** (`known_group_chats`)
    - `chatId`: Feishu `chat_id` (Primary Key).
    - `name`: Group name.
    - `lastActiveAt`: Timestamp of last event from this group.
    - **Purpose**: Caches groups the bot has been added to, facilitating easy selection in the UI.
7.  **Alert Task** (`alert_tasks`)
    - `id`: UUID (Primary Key).
    - `topicSlug`: The slug of the target topic (or `NULL` for DM).
    - `senderId`: Foreign Key -> `users.id` (who triggered the webhook).
    - `status`: `pending`, `processing`, `completed`, or `failed`.
    - `recipientCount`: Total recipients (subscribers + groups).
    - `successCount`: Number of successful deliveries.
    - `payload`: Snapshot of the incoming webhook body (JSONB).
    - `error`: Last error message if failed.
    - **Purpose**: Tracks the lifecycle of a single alert ingestion events.

8.  **Alert Log** (`alert_logs`)
    - `id`: UUID (Primary Key).
    - `taskId`: Foreign Key -> `alert_tasks.id`.
    - `userId`: Target user open_id (snapshot).
    - `status`: `sent` or `failed`.
    - **Purpose**: Granular tracking for each individual delivery within a task.

## 4. Key Workflows

### Authentication
- **Strategy**: Feishu OAuth2.
- **Flow**:
  1. Frontend calls `/api/auth/login-url` to get Feishu auth URL.
  2. User redirects to Feishu, approves, redirects back to `/api/auth/callback`.
  3. Server exchanges code for token, gets user info, creates/updates user in DB.
  4. Server sets `session` cookie (httpOnly).
- **Context**: `AuthContext.tsx` manages user state on frontend.
 
### Personal Inbox (Direct Messaging)
- **Strategy**: Direct delivery to a specific user.
- **Mechanism**:
  1. Each user has a `personalToken`.
  2. Sending to `POST /api/webhook/:token/dm` routes messages directly to the user associated with the token.
  3. No Topic or Subscription is required.

### Alert Ingestion & Dispatch
**File**: `apps/server/src/webhook.ts`

1.  **Ingest**:
    - **Topic-based**: `POST /api/webhook/:token/topic/:slug`
    - **Direct (Inbox)**: `POST /api/webhook/:token/dm`
2.  **Lookup**:
    - For Topic-based: Find `Topic` by `slug` and fetch all `subscriptions`.
    - For Direct: Identify the user via `token`.
3.  **Dispatch**:
    - Call `FeishuClient.sendMessage` for each recipient.
    - **Payload**: Supports `text` and `interactive` (Feishu Card) message types.

    - Call `FeishuClient.sendMessage` for each recipient.
    - **Payload**: Supports `text` and `interactive` (Feishu Card) message types.

### Feishu Group Chat Integration
- **Strategy**: App Bot in Group.
- **Discovery**:
  - The system listens for `im.chat.member.bot.added_v1` events (via Webhook or WebSocket).
  - When the bot is added to a group, the group details are cached in `known_group_chats`.
- **Bot Removal**:
  - The system listens for `im.chat.member.bot.deleted_v1` events.
  - When the bot is removed, the cached group is deleted from `known_group_chats`.
  - **Auto-Unbind**: All bindings in `topic_group_chats` for that `chat_id` are automatically deleted to ensure data consistency.
- **Binding**: Admins bind a Topic to a known Feishu Group in the UI.
- **Dispatch**: Alerts for the topic are sent to all bound `chat_id`s in addition to individual subscribers.

### Long Connection (WebSocket)
- **Problem**: Intranet deployments cannot receive public Webhook callbacks from Feishu.
- **Solution**: Use Feishu Open Platform's WebSocket mode.
- **Configuration**: Set `FEISHU_USE_WS=true` in `.env`.
- **Implementation**: Uses `@larksuiteoapi/node-sdk` to establish a persistent connection and receive events like `im.chat.member.bot.added_v1`.
- Users can subscribe/unsubscribe themselves to any topic.
- Admins can manage subscriptions for other users globally in `AdminView`.
- **Topic Deletion**: Centralized in the **Admin Dashboard (All Topics Tab)** to avoid accidental deletion from the main topic list.
- Button logic on frontend toggles between "Subscribe" and "Unsubscribe".


## 5. API Endpoints

### Auth
- `GET /api/auth/login-url`
- `GET /api/auth/callback`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Management
- `GET /api/topics`: List all approved topics.
- `GET /api/topics/my-requests`: List user's own topic requests.
- `GET /api/topics/requests`: List pending topic requests (Admin only).
- `GET /api/topics/all`: List all topics regardless of status (Admin only).
- `POST /api/topics`: Create a topic (Admin creates approved, User creates pending).
- `POST /api/topics/:id/approve`: Approve a topic request (Admin only).
- `POST /api/topics/:id/reject`: Reject a topic request (Admin only).
- `DELETE /api/topics/:id`: Delete a topic (Admin only).
- `POST /api/topics/:id/subscribe/:userId`: Subscribe.
- `DELETE /api/topics/:id/subscribe/:userId`: Unsubscribe.
- `GET /api/users`: List users (Admin only).
- `GET /api/users`: List users (Admin only).

### Feishu Group Management
- `GET /api/groups`: List known groups (cached from bot events).
- `GET /api/topics/:id/groups`: List group bindings for a topic.
- `POST /api/topics/:id/groups`: Bind a group to a topic.
- `DELETE /api/topics/:id/groups/:bindingId`: Unbind a group.

### Feishu Event
- `POST /api/feishu/event`: Endpoint for receiving Feishu events (Webhook mode).
    - **Note**: This endpoint uses **manual challenge handling** (`lark.generateChallenge`) and `eventDispatcher.invoke` instead of the SDK's `adaptDefault` to maintain compatibility with Hono's non-standard Node.js response object.
    - **Signature Verification Hack**: To preserve Feishu's signature verification, the internal `invoke` call uses `Object.create({ headers })` to inject HTTP headers on the prototype of the payload object. This ensures headers are accessible to the SDK's internal verification logic but are **excluded** from `JSON.stringify`, which is critical for matching the SHA256 content checksum.

### Webhook
- `POST /api/webhook/:token/topic/:slug`: Trigger an alert for a topic.
- `POST /api/webhook/:token/dm`: Trigger a direct alert to the user's private inbox.

## 6. Future Roadmap (Planned)

- [ ] **Message Preview**: Preview Feishu card JSON in the UI.
- [x] **History/Logs**: Tracking for sent alerts (Alert Tasks/Logs).
- [ ] **Retry Mechanism**: Handle Feishu API failures.
- [x] **Deployment**: Dockerfile and CI/CD.

## 7. Development Conventions

- **Imports**: Use relative imports.
- **Styling**: Use Tailwind utility classes directly in JSX.
- **Async/Await**: Prefer `async/await` over `.then()`.
- **Type Safety**: strict TypeScript usage. Backend and Frontend share types via Hono RPC or shared interfaces.
- **Linter & Formatter**:
  - Framework: [Biome](https://biomejs.dev/).
  - **Rules**: Strict configuration for `a11y`, `suspicious`, `style`, and `correctness`.
  - **Tailwind**: `noUnknownAtRules` is configured to ignore Tailwind directives (`@tailwind`, `@apply`, etc.).
  - **Enforcement**: CI/CD runs `biome check` to ensure compliance. Avoid use of `as any` unless absolutely necessary (e.g., complex API payloads), in which case `// biome-ignore` should include a rationale.
- **Logging**:
  - Framework: `pino`.
  - **Structured Log**: Use JSON format for easy parsing and aggregation.
  - **Contextual Data**: Pass objects as the first argument to `logger` methods (e.g., `logger.error({ err, chatId }, 'message')`) for indexed search.
  - **Dev Mode**: Uses `pino-pretty` for human-friendly output during development.
- **Environment Isolation**:
  - Each workspace (`apps/server`, `apps/web`) uses its own `.env` file via Bun's `--env-file .env` flag.
  - Development proxy target for the frontend is configurable via `VITE_API_URL` (default: `http://localhost:3000`).
- **Critical Environment Variables**:
  - `FEISHU_ENCRYPT_KEY`: Essential for the `lark.generateChallenge` and event signature verification.
  - `FEISHU_VERIFICATION_TOKEN`: Used by `EventDispatcher` for event authentication.
  - `FEISHU_USE_WS`: Set to `true` to enable WebSocket mode (bypasses `feishu-event.ts`).
  - `ADMIN_EMAILS`: Comma-separated list of emails that automatically receive `isAdmin=true` upon first login.
- **CI/CD**:
  - GitHub Actions automates building a multi-stage Docker image and pushing it to GitHub Container Registry (GHCR).
  - Image path: `ghcr.io/${USER}/alert-message-center`.
  - Deployment Architecture: A single container runs the Bun server, which serves API requests and static frontend assets (via `hono/bun`'s `serveStatic`).

## 8. Core Documents

- **[README.md](file:///Users/lilithgames/Workspace/dap/alert-message-center/README.md)**: Main project documentation, including quick start, tech stack overview, and Webhook usage guide.
- **[CHANGELOG.md](file:///Users/lilithgames/Workspace/dap/alert-message-center/CHANGELOG.md)**: Record of version changes, following the Keep a Changelog specification.
- **[todo.md](file:///Users/lilithgames/Workspace/dap/alert-message-center/todo.md)**: Task tracking and upcoming features.


