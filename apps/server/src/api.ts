import { zValidator } from "@hono/zod-validator";
import { and, count, desc, eq, gt, sql, sum } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "./db";
import {
	alertTasks,
	knownGroupChats,
	subscriptions,
	topicGroupChats,
	topics,
	users,
} from "./db/schema";
import { notifyAdminsOfNewTopic } from "./lib/admin-notifier";
import { type AuthSession, requireAdmin, requireAuth } from "./middleware";

const api = new Hono<{ Variables: { session: AuthSession } }>();

const topicSchema = z.object({
	name: z.string().min(1),
	slug: z
		.string()
		.min(1)
		.regex(
			/^[a-z0-9-]+$/i,
			"Slug must only contain alphanumeric characters and hyphens",
		),
	description: z.string().optional(),
	isGlobal: z.boolean().optional(),
});

const groupBindingSchema = z.object({
	chatId: z.string().min(1),
	name: z.string().min(1),
});

const userSchema = z.object({
	name: z.string().min(1),
	feishuUserId: z.string().min(1),
	email: z.string().email().optional().or(z.literal("")),
	isTrusted: z.boolean().optional(),
});

// --- Topics ---

// --- Topics ---

api.get("/topics", requireAuth, async (c) => {
	const session = c.get("session");
	const isAdmin = session.isAdmin;
	const currentUserId = session.id;

	const allTopics = await db.query.topics.findMany({
		where: eq(topics.status, "approved"),
		with: {
			creator: true,
			approver: true,
			subscriptions: {
				where: (subscriptions, { eq }) =>
					isAdmin
						? undefined
						: currentUserId
							? eq(subscriptions.userId, currentUserId)
							: undefined,
				with: {
					user: true,
				},
			},
		},
	});

	return c.json(allTopics);
});

api.get("/topics/requests", requireAdmin, async (c) => {
	const requests = await db.query.topics.findMany({
		where: eq(topics.status, "pending"),
		with: {
			creator: true,
		},
	});
	return c.json(requests);
});

api.get("/topics/groups/requests", requireAdmin, async (c) => {
	const requests = await db.query.topicGroupChats.findMany({
		where: eq(topicGroupChats.status, "pending"),
		with: {
			topic: true,
			creator: true,
		},
	});
	return c.json(requests);
});

api.get("/topics/all", requireAdmin, async (c) => {
	const allTopics = await db.query.topics.findMany({
		with: {
			creator: true,
			approver: true,
			subscriptions: true,
		},
		orderBy: [desc(topics.createdAt)],
	});
	return c.json(allTopics);
});

api.get("/topics/my-requests", requireAuth, async (c) => {
	const session = c.get("session");
	const requests = await db.query.topics.findMany({
		where: eq(topics.createdBy, session.id),
		orderBy: [desc(topics.createdAt)],
		with: {
			approver: true,
		},
	});
	return c.json(requests);
});

api.post("/topics/:id/approve", requireAdmin, async (c) => {
	const id = c.req.param("id");
	const session = c.get("session");
	const result = await db
		.update(topics)
		.set({ status: "approved", approvedBy: session.id })
		.where(eq(topics.id, id))
		.returning();
	return c.json(result[0]);
});

api.post("/topics/:id/reject", requireAdmin, async (c) => {
	const id = c.req.param("id");
	const result = await db
		.update(topics)
		.set({ status: "rejected" })
		.where(eq(topics.id, id))
		.returning();
	return c.json(result[0]);
});

// Only admins can create topics
// Authenticated users can create topics (requests)
api.post("/topics", requireAuth, zValidator("json", topicSchema), async (c) => {
	const body = c.req.valid("json");
	const session = c.get("session");

	const status = session.isAdmin || session.isTrusted ? "approved" : "pending";

	const result = await db
		.insert(topics)
		.values({
			...body,
			isGlobal: session.isAdmin ? (body.isGlobal ?? false) : false,
			status,
			createdBy: session.id,
			approvedBy: session.isAdmin || session.isTrusted ? session.id : null,
		})
		.returning();
	if (status === "pending") {
		await notifyAdminsOfNewTopic({
			id: result[0].id,
			name: result[0].name,
			slug: result[0].slug,
			createdBy: session.id,
		});
	}

	return c.json(result[0]);
});

// Only admins can update topics
api.put(
	"/topics/:id",
	requireAdmin,
	zValidator("json", topicSchema.partial()),
	async (c) => {
		const id = c.req.param("id");
		const body = c.req.valid("json");
		const result = await db
			.update(topics)
			.set({
				...body,
				isGlobal: body.isGlobal ?? (undefined as any),
			})
			.where(eq(topics.id, id))
			.returning();
		return c.json(result[0]);
	},
);

// Only admins can delete topics
api.delete("/topics/:id", requireAdmin, async (c) => {
	const id = c.req.param("id");
	await db.delete(topics).where(eq(topics.id, id));
	return c.json({ success: true });
});

// --- Users ---

api.get("/users", requireAdmin, async (c) => {
	const allUsers = await db.query.users.findMany({
		with: {
			subscriptions: {
				with: {
					topic: true,
				},
			},
		},
	});
	return c.json(allUsers);
});

api.post("/users", requireAdmin, zValidator("json", userSchema), async (c) => {
	const body = c.req.valid("json");
	const result = await db.insert(users).values(body).returning();
	return c.json(result[0]);
});

api.put(
	"/users/:id",
	requireAdmin,
	zValidator("json", userSchema.partial()),
	async (c) => {
		const id = c.req.param("id");
		const body = c.req.valid("json");
		const result = await db
			.update(users)
			.set(body)
			.where(eq(users.id, id))
			.returning();
		return c.json(result[0]);
	},
);

api.delete("/users/:id", requireAdmin, async (c) => {
	const id = c.req.param("id");
	await db.delete(users).where(eq(users.id, id));
	return c.json({ success: true });
});

// --- Subscriptions ---

// --- Subscriptions ---

// Users can subscribe themselves or admins can subscribe anyone
api.post("/topics/:topicId/subscribe/:userId", requireAuth, async (c) => {
	const { topicId, userId } = c.req.param();
	const session = c.get("session");

	// Check if user is subscribing themselves or is an admin
	if (session.id !== userId && !session.isAdmin) {
		return c.json({ error: "You can only subscribe yourself" }, 403);
	}

	const result = await db
		.insert(subscriptions)
		.values({ topicId, userId })
		.returning();
	return c.json(result[0]);
});

// Users can unsubscribe themselves or admins can unsubscribe anyone
api.delete("/topics/:topicId/subscribe/:userId", requireAuth, async (c) => {
	const { topicId, userId } = c.req.param();
	const session = c.get("session");

	// Check if user is unsubscribing themselves or is an admin
	if (session.id !== userId && !session.isAdmin) {
		return c.json({ error: "You can only unsubscribe yourself" }, 403);
	}

	await db
		.delete(subscriptions)
		.where(
			and(eq(subscriptions.topicId, topicId), eq(subscriptions.userId, userId)),
		);
	return c.json({ success: true });
});

// --- Group Bindings (App Bot) ---

// Get list of known groups (for selection)
api.get("/groups", requireAuth, async (c) => {
	const query = c.req.query("q")?.trim();
	const limit = Math.min(Number(c.req.query("limit") || 100), 200);

	const whereClause = query
		? sql`${knownGroupChats.name} ilike ${`%${query}%`}`
		: undefined;

	// Return recent active groups
	const groups = await db
		.select()
		.from(knownGroupChats)
		.where(whereClause)
		.orderBy(desc(knownGroupChats.lastActiveAt))
		.limit(limit);
	return c.json(groups);
});

// Get bindings for a topic
api.get("/topics/:id/groups", requireAuth, async (c) => {
	const topicId = c.req.param("id");
	const groups = await db
		.select()
		.from(topicGroupChats)
		.where(eq(topicGroupChats.topicId, topicId))
		.orderBy(desc(topicGroupChats.createdAt));
	return c.json(groups);
});

// Bind a group to a topic
api.post(
	"/topics/:id/groups",
	requireAuth,
	zValidator("json", groupBindingSchema),
	async (c) => {
		const topicId = c.req.param("id");
		const body = c.req.valid("json");
		const session = c.get("session");

		// Check topic ownership or admin
		const topic = await db.query.topics.findFirst({
			where: eq(topics.id, topicId),
		});

		if (!topic) {
			return c.json({ error: "Topic not found" }, 404);
		}

		if (topic.createdBy !== session.id && !session.isAdmin) {
			return c.json(
				{ error: "Only topic owner or admin can bind groups" },
				403,
			);
		}

		const status =
			session.isAdmin || session.isTrusted ? "approved" : "pending";

		const result = await db
			.insert(topicGroupChats)
			.values({
				topicId,
				chatId: body.chatId,
				name: body.name,
				createdBy: session.id,
				status,
			})
			.returning();

		if (status === "pending") {
			// Notify admins about the new group binding request
			await notifyAdminsOfNewTopic({
				id: topic.id,
				name: topic.name,
				slug: topic.slug,
				createdBy: session.id,
				// Metadata passed to notifier for better context
				isGroupBinding: true,
				groupName: body.name,
			});
		}

		return c.json(result[0]);
	},
);

// Unbind a group
api.delete("/topics/:id/groups/:bindingId", requireAuth, async (c) => {
	const { id: topicId, bindingId } = c.req.param();
	const session = c.get("session");

	// Check topic ownership or admin
	const topic = await db.query.topics.findFirst({
		where: eq(topics.id, topicId),
	});

	if (!topic) {
		return c.json({ error: "Topic not found" }, 404);
	}

	if (topic.createdBy !== session.id && !session.isAdmin) {
		return c.json(
			{ error: "Only topic owner or admin can unbind groups" },
			403,
		);
	}

	await db
		.delete(topicGroupChats)
		.where(
			and(
				eq(topicGroupChats.id, bindingId),
				eq(topicGroupChats.topicId, topicId),
			),
		);

	return c.json({ success: true });
});

// Approve a group binding
api.post("/topics/:id/groups/:bindingId/approve", requireAdmin, async (c) => {
	const { id: topicId, bindingId } = c.req.param();
	const result = await db
		.update(topicGroupChats)
		.set({ status: "approved" })
		.where(
			and(
				eq(topicGroupChats.id, bindingId),
				eq(topicGroupChats.topicId, topicId),
			),
		)
		.returning();
	return c.json(result[0]);
});

// Reject a group binding
api.post("/topics/:id/groups/:bindingId/reject", requireAdmin, async (c) => {
	const { id: topicId, bindingId } = c.req.param();
	const result = await db
		.update(topicGroupChats)
		.set({ status: "rejected" })
		.where(
			and(
				eq(topicGroupChats.id, bindingId),
				eq(topicGroupChats.topicId, topicId),
			),
		)
		.returning();
	return c.json(result[0]);
});

// --- Alert Tasks ---

api.get("/alerts/tasks", requireAdmin, async (c) => {
	const limit = Math.min(Number(c.req.query("limit") || 50), 100);
	const tasks = await db.query.alertTasks.findMany({
		orderBy: [desc(alertTasks.createdAt)],
		limit,
		with: {
			sender: true,
			logs: {
				limit: 10, // Only show first 10 logs inline
			},
		},
	});
	return c.json(tasks);
});

api.get("/alerts/tasks/:id", requireAuth, async (c) => {
	const id = c.req.param("id");
	const task = await db.query.alertTasks.findFirst({
		where: eq(alertTasks.id, id),
		with: {
			sender: true,
			logs: true, // Show all logs for detail view
		},
	});

	if (!task) {
		return c.json({ error: "Task not found" }, 404);
	}

	return c.json(task);
});

// --- Stats ---

api.get("/stats", requireAdmin, async (c) => {
	// 1. Message count per topic
	const topicStats = await db
		.select({
			topicSlug: alertTasks.topicSlug,
			totalTasks: count(),
			totalRecipients: sql<number>`cast(${sum(alertTasks.recipientCount)} as int)`,
			totalSuccess: sql<number>`cast(${sum(alertTasks.successCount)} as int)`,
		})
		.from(alertTasks)
		.groupBy(alertTasks.topicSlug);

	// 2. Recent metrics (last 24h)
	const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
	const recentStats = await db
		.select({
			totalRecipients: sql<number>`cast(${sum(alertTasks.recipientCount)} as int)`,
			totalSuccess: sql<number>`cast(${sum(alertTasks.successCount)} as int)`,
			taskCount: count(),
		})
		.from(alertTasks)
		.where(gt(alertTasks.createdAt, last24h));

	const recent = recentStats[0] || {
		totalRecipients: 0,
		totalSuccess: 0,
		taskCount: 0,
	};
	const totalRecipients = Number(recent.totalRecipients || 0);
	const totalSuccess = Number(recent.totalSuccess || 0);
	const failedCount = totalRecipients - totalSuccess;
	const successRate =
		totalRecipients > 0 ? (totalSuccess / totalRecipients) * 100 : 100;

	return c.json({
		topics: topicStats,
		recent: {
			alertsReceived: Number(recent.taskCount || 0),
			plannedMessages: totalRecipients,
			successCount: totalSuccess,
			failedCount: failedCount,
			successRate: successRate,
		},
	});
});

export default api;
