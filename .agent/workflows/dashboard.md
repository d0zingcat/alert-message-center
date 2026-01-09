---
description: System Dashboard and Monitoring Maintenance
---

# Dashboard and Monitoring Workflow

This workflow describes how to maintain and extend the System Load dashboard and the underlying statistics API.

## Architecture

1.  **Backend Statistics API**:
    -   File: `apps/server/src/api.ts`
    -   Endpoint: `GET /api/stats` (Requires Admin)
    -   Logic: Aggregates `alert_tasks` and `alert_logs` using Drizzle ORM.
    -   Key Metrics:
        -   `alertsReceived`: Total task count.
        -   `plannedMessages`: Sum of `recipientCount` across tasks.
        -   `successCount`: Sum of `successCount`.
        -   `failedCount`: calculated as `plannedMessages - successCount`.

2.  **Frontend Dashboard**:
    -   File: `apps/web/src/views/SystemLoadView.tsx`
    -   Component: `SystemLoadView`
    -   Features:
        -   10s auto-refresh interval.
        -   SVG-based custom Gauges for success rate.
        -   Metric cards for immediate feedback.
        -   Live status indicator with breathing animation.
        -   **Audit Log**: A detailed table showing recent alert tasks, capturing the timestamp, topic, associated **Sender** (via personal token), and success counts.

## Common Tasks

### 1. Extending Metrics
To add a new metric (e.g., average delivery time):
1.  Update `apps/server/src/api.ts` in the `/stats` handler.
2.  Add the new fields to the query using Drizzle's `avg`, `min`, `max`, etc.
3.  Update the `Stats` interface in `apps/web/src/views/SystemLoadView.tsx`.
4.  Add a new `MetricCard` or a column to the table.

### 2. Tuning Refresh Rates
If the 10s refresh is too aggressive:
-   Change the interval in `useEffect` within `SystemLoadView.tsx`.
-   Balance between "real-time feel" and server load.

### 3. Debugging Type Erasure Issues
When working with Hono's RPC client (`hc`):
-   The client in `apps/web/src/lib/client.ts` is currently cast as `any` to avoid complex type inference circularities.
-   If adding new endpoints, ensure they are correctly routed in `apps/server/src/index.ts` so they appear in `AppType`.

## Performance Considerations
-   The `/stats` endpoint uses standard SQL aggregations. 
-   For extremely large datasets, consider adding an index on `alert_tasks(created_at, topic_slug)`.
-   The dashboard is restricted to Admins to minimize the impact of frequent polling.
