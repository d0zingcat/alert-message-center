---
description: Topic Request Lifecycle and User Feedback
---

# Topic Request Workflow

This workflow describes the lifecycle of a Topic creation request, from submission by a normal user to approval/rejection by an admin, and how users track their requests.

## Architecture

1.  **Backend API**:
    -   **Submission**: `POST /api/topics` (Authenticated users).
        -   If `isAdmin`, status is `approved`.
        -   If normal user, status is `pending`.
    -   **Global Admin View**: `GET /api/topics/requests` (Admin only).
    -   **User Personal View**: `GET /api/topics/my-requests` (Authenticated users).
        -   Retrieves all topics where `createdBy` matches the current session user ID.
    -   **Approval**: `POST /api/topics/:id/approve` (Admin only).
    -   **Rejection**: `POST /api/topics/:id/reject` (Admin only).

2.  **Frontend Implementation**:
    -   File: `apps/web/src/views/TopicsView.tsx`
    -   **Submission Modal**: 
        -   Uses `submitStatus` state to provide immediate success/error feedback.
        -   Automatically closes and refreshes after 1.5s on success.
    -   **My Requests Table**:
        -   Rendered below the main topic list.
        -   Uses color-coded badges for status:
            -   `Approved`: Green.
            -   `Rejected`: Red.
            -   `Pending`: Yellow.

## Common Maintenance Tasks

### 1. Adding/Removing Request Fields
If a new field is needed (e.g., "Justification"):
1.  Update `topics` table in `apps/server/src/db/schema.ts`.
2.  Update `topicSchema` in `apps/server/src/api.ts`.
3.  Update the form in `TopicsView.tsx`.
4.  Ensure the field is displayed in both `AdminView` and `TopicsView` (personal requests).

### 2. Customizing Feedback Messages
Feedback messages are managed in the `handleSubmit` function in `TopicsView.tsx`. Update the `message` property in `setSubmitStatus` to change the user-facing wording.

### 3. Handling Rejection Comments (Future)
To add a reason for rejection:
1.  Add a `rejectionReason` column to the `topics` table.
2.  Modify the `AdminView.tsx` to prompt for a reason during rejection.
3.  Update `POST /api/topics/:id/reject` to accept this reason.
4.  Display the reason in the `My Requests` section of `TopicsView.tsx`.

## Design Decisions
-   **Separate Personal Requests**: We show personal requests in a dedicated section to avoid cluttering the primary Topic list, which only shows `approved` topics that can actually be subscribed to.
-   **Optimistic UI vs. Simple Refresh**: Currently, we use a full refresh (`fetchTopics`, `fetchMyRequests`) for simplicity and data consistency.
