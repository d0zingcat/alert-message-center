# Project Context for GitHub Copilot

This document provides technical context, architectural decisions, and code conventions for the **Alert Message Center** project. It is intended to help AI assistants understand the codebase.

## 1. Project Overview

**Alert Message Center** (formerly Alert Manager) is a centralized alert dispatching system.
- **Goal**: Decouple alert sources from alert recipients.
- **Mechanism**:
  - **Topics**: Alerts are sent to a **Topic**. Users subscribe to Topics to receive messages.
  - **Personal Inbox**: Users can send alerts directly to themselves via a private webhook URL, bypassing Topic creation and approval.
  - **Dispatch**: The system sends messages via **Feishu (Lark) Private Messages**.
- **Runtime**: Bun (JavaScript/TypeScript runtime).

## 2. Tech Stack

- **Monorepo**: Simple directory structure (`apps/server`, `apps/web`).
- **Backend**:
  - **Runtime**: Bun.
  - **Framework**: Hono (Web Standard based).
  - **Database**: PostgreSQL.
  - **ORM**: Drizzle ORM.
  - **Authentication**: Feishu OAuth2 (Session-based with cookies).
  - **External API**: Feishu Open Platform (Server-side API).
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

### Subscription Management
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


### Webhook
- `POST /api/webhook/:token/topic/:slug`: Trigger an alert for a topic.
- `POST /api/webhook/:token/dm`: Trigger a direct alert to the user's private inbox.

## 6. Future Roadmap (Planned)

- [ ] **Message Preview**: Preview Feishu card JSON in the UI.
- [ ] **History/Logs**: Keep a log of sent alerts for auditing.
- [ ] **Retry Mechanism**: Handle Feishu API failures.
- [ ] **Deployment**: Dockerfile and deployment scripts.

## 7. Development Conventions

- **Imports**: Use relative imports.
- **Styling**: Use Tailwind utility classes directly in JSX.
- **Async/Await**: Prefer `async/await` over `.then()`.
- **Type Safety**: strict TypeScript usage. Backend and Frontend share types via Hono RPC or shared interfaces.
- **Environment Variables**:
  - `FEISHU_APP_ID`, `FEISHU_APP_SECRET`, `REDIRECT_URI`, `ADMIN_EMAILS`.
- **Administrators**:
  - Configured via the `ADMIN_EMAILS` environment variable (comma-separated list of emails).


