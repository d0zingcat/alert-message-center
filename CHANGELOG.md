# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), 
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**CHANGELOG** | [简体中文](./CHANGELOG.zh-CN.md)

## [1.4.0] - 2026-01-23

### Added
- **Global Topics**: Introduced a new topic type that broadcasts alerts to all users automatically.
    - **User Requests**: All users can now request a topic to be "Global" during creation.
    - **Admin Control**: Admins can promote any topic to "Global" or create new global topics via the Admin Dashboard.
    - **Automatic Distribution**: Alerts sent to Global Topics are delivered to every registered user without requiring individual subscriptions.
    - **UI Indicators**: Added "Global" badges and specialized management actions in the Topics and Admin views.

## [1.3.3] - 2026-01-17

### Added
- **Multi-replica Deployment Support**: Enhanced stability for load-balanced/multi-instance environments.
    - **Database Locking**: Introduced **Postgres Advisory Locks** in `db:migrate:deploy` script to prevent race conditions during concurrent database migrations.
    - **Idempotency Hardening**: Verified and ensured Feishu event handling logic is idempotent, supporting safe receipt of duplicate events in multi-replica setups.

## [1.3.2] - 2026-01-17

### Added
- **Group Chat Search**: Added real-time search functionality when binding group chats, solving the difficulty of finding specific groups when many are present.
    - **Backend Support**: `GET /groups` now supports `q` query parameter for fuzzy search and increased default return limit.
    - **Search Frontend**: Introduced a search input with debounce logic and a custom dropdown list for better UX.

### Changed
- **UI Optimization**: Improved `GroupBindingsModal` visual design with a modern list style, status icons, and loading animations.
- **Documentation**: Split `README.md` into English (`README.md`) and Chinese (`README.zh-CN.md`) for better internationalization support.

## [1.3.1] - 2026-01-16

### Added
- **Group Chat Binding Management**: Enhanced security and workflow for binding Topics to Feishu group chats.
    - **Permission Control**: Only Topic creators or Admins are allowed to bind/unbind groups.
    - **Approval Workflow**: New approval mechanism for group binding requests from non-admin/non-trusted users (tracked via `status`).
    - **Admin Notifications**: Introduced `admin-notifier.ts` for real-time Feishu card notifications to admins upon new Topic or Binding requests.
- **Trusted User System**: Introduced `isTrusted` flag.
    - Trusted users' Topic and Binding requests are auto-approved.
    - Admins skip approval by default.

### Changed
- **Database Schema**: Added `status` and `created_by` fields to `topic_group_chats` table to support approval flow and permission checks.

## [1.3.0] - 2026-01-16

### Added
- **Visual Branding**: Introduced custom logo and favicon.
    - Modern Indigo theme logo designed specifically for "Alert Message Center".
    - Integrated logo into Login screen and Header, replacing generic icons.

### Fixed
- **Deployment Reliability**: Fixed database migration failures in Docker environments by including `apps/server/drizzle/meta` in the package (un-ignored in git).

## [1.2.7] - 2026-01-15

### Fixed
- **Database Migration**: Fixed migration interruptions in K8s environments caused by relative path resolution failures. Now uses robust absolute paths with additional debug logging.

## [1.2.6] - 2026-01-15

### Changed
- **User Tokens**: Shortened `personalToken` from 32-char UUID to 8-character hex string for better usability.
- **Database Migration**: Integrated automated migration for existing user tokens into the deployment script.
- **AI Conventions**: Updated `copilot-context.md` with strict requirements for style and lint checks.

## [1.2.5] - 2026-01-15

### Fixed
- **Frontend Resilience**: Fixed "white page" crashes when database is empty or API returns error objects.
    - Added `res.ok` and `Array.isArray` checks to all API requests in `TopicsView`, `SystemLoadView`, and `AdminView`.
    - Added defensive logic to show friendly messages instead of crashing.
- **Vite Env Variables**: Fixed `TypeError` when accessing environment variables.
    - Used optional chaining (`meta.env?.`) for safe access.
- **CI & Type Safety**: Fixed CI-breaking type errors and formatting issues.
    - Unified code style via `biome check --write`.
    - Improved `UserAccessTokenData` interface and added null checks for OAuth callback.

## [1.2.4] - 2026-01-15

### Changed
- **Type Safety**: Refactored core logic to eliminate `any` types.
    - Introduced explicit interfaces in `webhook.ts`, `verify_permissions.ts`, and `feishu.ts`.
    - Improved Webhook body handling with better validation.
- **Linting**: Enforced Biome's `noExplicitAny` rule.

## [1.2.3] - 2026-01-15

### Added
- **Automated DB Migrations**: Introduced automatic database initialization.
    - Added `src/db/migrate.ts` using Drizzle Migrator.
    - Updated `Dockerfile` to run migrations on startup.

### Fixed
- **Initialization Errors**: Fixed `relation "users" does not exist` on fresh installs.
- **Migration History**: Re-generated initial migration files for clean deployments.

## [1.2.2] - 2024-01-14

### Changed
- **Linting**: Tightened Biome configuration for `a11y`, `suspicious`, `style`, and `correctness`.
- **CI/CD**: Integrated Biome checks into GitHub Actions.

### Fixed
- **Accessibility**: Added `type="button"` to all buttons and improved Modal keyboard/ARIA support.
- **Hook Dependencies**: Stabilized `useEffect` chains using `useCallback`.

## [1.2.1] - 2024-01-14

### Fixed
- **WebSocket Initialization**: Fixed `TypeError` in `@larksuiteoapi/node-sdk` v1.56.0+.
- **Hono Compatibility**: Fixed signature verification issues by using manual challenge handling and prototype header injection.
- **Auto-Cleanup**: Added `im.chat.member.bot.deleted_v1` support to automatically unbind topics when bot is removed from a group.

### Added
- **Structured Logging**: Integrated `pino` for JSON logging with `pino-pretty` for development.

## [1.2.0] - 2026-01-13

### Added
- **Feishu Group Notifications**: Support for sending alerts to Feishu group chats.
- **Long Connection (WebSocket)**: Support for intranet deployments via Feishu WebSocket mode.
- **UI Improvements**: Added group management entry in Topic list.

### Changed
- **Architecture**: Unified event distribution for Webhook and WebSocket modes.

## [1.1.1] - 2026-01-13

### Fixed
- **CI/CD**: Fixed Docker build failures after path restructuring.

## [1.1.0] - 2026-01-13

### Added
- **Docker Integration**: Single multi-stage Docker image for both frontend and backend.
- **Environment Isolation**: Improved `.env` handling using Bun's `--env-file`.
- **Root Scripts**: Unified `dev` and `start` scripts in root directory.

## [1.0.0] - 2026-01-12

### Added
- **Personal Inbox**: Support for private DM notifications via personal token.
- **Topic Management**: Ownership and approval tracking for topics.
- **Admin Dashboard**: New view for managing topic requests and permissions.
- **Lark OAuth2**: Integrated Feishu identity provider.
- **Initial Release**: Core alert routing system based on Hono, Vite, and PostgreSQL.
