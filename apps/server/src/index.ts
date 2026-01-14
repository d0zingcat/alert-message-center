import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import api from "./api";
import auth from "./auth";
import { db } from "./db";
import { topics } from "./db/schema";
import { logger } from "./lib/logger";
import webhook from "./webhook";

const app = new Hono();

// Enable CORS for frontend
app.use(
	"/*",
	cors({
		origin: process.env.FRONTEND_URL || "http://localhost:5173",
		credentials: true,
	}),
);

import feishuEvent from "./api/feishu-event";

// ...

// API Routes
const routes = app
	.route("/api/auth", auth)
	.route("/api", api)
	.route("/api/feishu/event", feishuEvent)
	.route("/webhook", webhook);

// Serve static files (Frontend)
app.use("/*", serveStatic({ root: "./public" }));
app.get("*", serveStatic({ path: "./public/index.html" }));

app.onError((err, c) => {
	logger.error({ err, method: c.req.method, url: c.req.url }, "Global Error");
	return c.json({ error: err.message || "Internal Server Error" }, 500);
});

app.get("/topics", async (c) => {
	const allTopics = await db.select().from(topics);
	return c.json(allTopics);
});

// Start WebSocket if enabled
import { startWebSocket } from "./ws";

startWebSocket();

export type AppType = typeof routes;
export default app;
