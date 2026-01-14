import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "./db";
import { alertLogs, alertTasks, topics, users } from "./db/schema";
import { feishuClient } from "./feishu";
import { logger } from "./lib/logger";

const webhook = new Hono();

webhook.post("/:token/topic/:slug", async (c) => {
	const token = c.req.param("token");
	const slug = c.req.param("slug");
	logger.info({ token, slug }, "[Webhook] Received request");

	// 0. Find the User by Token
	const user = await db.query.users.findFirst({
		where: eq(users.personalToken, token),
	});

	if (!user) {
		logger.warn({ token }, "[Webhook] Invalid personal token");
		return c.json({ error: "Invalid personal token" }, 401);
	}
	let body;
	try {
		const rawBody = await c.req.text();
		logger.debug({ bodyLength: rawBody.length }, "[Webhook] Received raw body");
		if (!rawBody || rawBody.trim() === "") {
			return c.json({ error: "Empty body" }, 400);
		}
		body = JSON.parse(rawBody);
	} catch (e) {
		logger.error({ err: e }, "[Webhook] Failed to parse JSON body");
		return c.json({ error: "Invalid JSON body" }, 400);
	}

	// 1. Find the Topic
	const topic = await db.query.topics.findFirst({
		where: eq(topics.slug, slug),
		with: {
			subscriptions: {
				with: {
					user: true,
				},
			},
			groupChats: true,
		},
	});

	if (!topic) {
		logger.warn({ slug }, "[Webhook] Topic not found");
		return c.json({ error: "Topic not found" }, 404);
	}

	logger.info({ topicName: topic.name }, "[Webhook] Found topic");

	// 2. Collect recipients
	const userRecipients = topic.subscriptions
		.map((sub) => sub.user)
		.filter((u) => !!u && !!u.feishuUserId)
		.map((u) => ({
			type: "user",
			id: u.id,
			name: u.name,
			feishuId: u.feishuUserId,
			idType: u.feishuUserId.startsWith("ou_") ? "open_id" : "user_id",
		}));

	const groupRecipients = topic.groupChats.map((g) => ({
		type: "group",
		id: g.id, // Binding ID
		name: g.name,
		feishuId: g.chatId,
		idType: "chat_id",
	}));

	const allRecipients = [...userRecipients, ...groupRecipients];

	const [task] = await db
		.insert(alertTasks)
		.values({
			topicSlug: topic.slug,
			senderId: user.id,
			status: "processing",
			recipientCount: allRecipients.length,
			successCount: 0,
			payload: body,
		})
		.returning();

	if (allRecipients.length === 0) {
		await db
			.update(alertTasks)
			.set({ status: "completed", updatedAt: new Date() })
			.where(eq(alertTasks.id, task.id));

		return c.json({
			message: "No subscribers for this topic",
			taskId: task.id,
			status: "completed",
		});
	}

	logger.info(
		{
			taskId: task.id,
			userCount: userRecipients.length,
			groupCount: groupRecipients.length,
		},
		"[Webhook] Dispatching alerts",
	);

	// 4. Send Private Messages asynchronously
	Promise.allSettled(
		allRecipients.map(async (recipient) => {
			try {
				// Construct message content
				let msgType = body.msg_type || "text";
				let content = body.content;

				if (!content) {
					msgType = "text";
					content = { text: JSON.stringify(body, null, 2) };
					// Deep copy needed? usually content is new obj if we parsed body
				} else {
					// Deep clone content to avoid mutating shared object for parallel requests if we modify it
					content = JSON.parse(JSON.stringify(content));
				}

				// Add metadata
				if (msgType === "text" && content.text) {
					content.text = `[Topic: ${topic.name}]\n${content.text}`;
				}
				if (msgType === "interactive" && content.header) {
					content.header.title.content = `[${topic.name}] ${content.header.title.content}`;
				}

				await feishuClient.sendMessage(
					recipient.feishuId,
					recipient.idType as any,
					msgType,
					content,
				);

				return { recipientId: recipient.id, status: "sent", error: null };
			} catch (error: any) {
				logger.error(
					{
						err: error,
						recipientType: recipient.type,
						recipientName: recipient.name,
					},
					"Failed to send alert",
				);
				return {
					recipientId: recipient.id,
					status: "failed",
					error: error.message,
				};
			}
		}),
	).then(async (results) => {
		const successCount = results.filter(
			(r) => r.status === "fulfilled" && (r.value as any).status === "sent",
		).length;
		const failures = results.filter(
			(r) =>
				r.status === "rejected" ||
				(r.status === "fulfilled" && (r.value as any).status === "failed"),
		).length;

		// Determine final status
		const finalStatus =
			failures === 0 ? "completed" : successCount > 0 ? "completed" : "failed";

		// Update Task
		await db
			.update(alertTasks)
			.set({
				status: finalStatus,
				successCount,
				updatedAt: new Date(),
				// If fully failed, maybe store the first error in the task record for quick view
				error: failures > 0 ? `Failed to send to ${failures} recipients` : null,
			})
			.where(eq(alertTasks.id, task.id));

		// Insert Logs
		const logs = results.map((r, index) => {
			const recipient = allRecipients[index];
			if (r.status === "fulfilled") {
				const val = r.value as any;
				return {
					taskId: task.id,
					userId: recipient.type === "user" ? recipient.id : null, // Only link users
					// We could add connection to group binding if we altered schema, but for now log it
					status: val.status,
					error: val.error,
				};
			} else {
				return {
					taskId: task.id,
					userId: recipient.type === "user" ? recipient.id : null,
					status: "failed",
					error: r.reason ? String(r.reason) : "Unknown error",
				};
			}
		});

		if (logs.length > 0) {
			await db.insert(alertLogs).values(logs as any);
		}

		logger.info(
			{
				taskId: task.id,
				successCount,
				totalCount: allRecipients.length,
				slug,
			},
			"[Webhook] Task processed",
		);
	});

	return c.json({
		message: "Alert received and processing started",
		taskId: task.id,
		status: "processing",
		recipientCount: allRecipients.length,
	});
});

webhook.post("/:token/dm", async (c) => {
	const token = c.req.param("token");
	logger.info({ token }, "[Webhook] Received DM request");

	// 0. Find the User by Token
	const user = await db.query.users.findFirst({
		where: eq(users.personalToken, token),
	});

	if (!user) {
		logger.warn({ token }, "[Webhook] Invalid personal token");
		return c.json({ error: "Invalid personal token" }, 401);
	}

	if (!user.feishuUserId) {
		return c.json({ error: "User has no Feishu ID linked" }, 400);
	}

	let body;
	try {
		const rawBody = await c.req.text();
		if (!rawBody || rawBody.trim() === "") {
			return c.json({ error: "Empty body" }, 400);
		}
		body = JSON.parse(rawBody);
	} catch (e) {
		return c.json({ error: "Invalid JSON body" }, 400);
	}

	// 1. Create Task (topicSlug is null for DM)
	const [task] = await db
		.insert(alertTasks)
		.values({
			topicSlug: null,
			senderId: user.id,
			status: "processing",
			recipientCount: 1,
			successCount: 0,
			payload: body,
		})
		.returning();

	// 2. Send Message
	(async () => {
		try {
			let msgType = body.msg_type || "text";
			let content = body.content;

			if (!content) {
				msgType = "text";
				content = { text: JSON.stringify(body, null, 2) };
			}

			// Add metadata
			if (msgType === "text" && content.text) {
				content.text = `[Direct Message]\n${content.text}`;
			}
			if (msgType === "interactive" && content.header) {
				content.header.title.content = `[DM] ${content.header.title.content}`;
			}

			const idType = user.feishuUserId.startsWith("ou_")
				? "open_id"
				: "user_id";
			await feishuClient.sendMessage(
				user.feishuUserId,
				idType,
				msgType,
				content,
			);

			// Update Task
			await db
				.update(alertTasks)
				.set({
					status: "completed",
					successCount: 1,
					updatedAt: new Date(),
				})
				.where(eq(alertTasks.id, task.id));

			// Insert Log
			await db.insert(alertLogs).values({
				taskId: task.id,
				userId: user.id,
				status: "sent",
			});
		} catch (error: any) {
			logger.error({ err: error, userName: user.name }, "Failed to send DM");
			await db
				.update(alertTasks)
				.set({
					status: "failed",
					updatedAt: new Date(),
					error: error.message,
				})
				.where(eq(alertTasks.id, task.id));

			await db.insert(alertLogs).values({
				taskId: task.id,
				userId: user.id,
				status: "failed",
				error: error.message,
			});
		}
	})();

	return c.json({
		message: "DM received and processing started",
		taskId: task.id,
		status: "processing",
		recipientCount: 1,
	});
});

// Help message for non-POST requests or malformed URLs
webhook.all("/:token/topic/:slug", (c) => {
	return c.json(
		{
			error: "Method not allowed",
			message: "Please use POST to send alerts to this webhook",
			format: "POST /webhook/:token/topic/:slug",
			example:
				'curl -X POST -H "Content-Type: application/json" -d \'{"content":{"text":"Hello"}}\' URL',
		},
		405,
	);
});

export default webhook;
