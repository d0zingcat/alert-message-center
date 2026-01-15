import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "./db";
import { alertLogs, alertTasks, topics, users } from "./db/schema";
import { feishuClient } from "./feishu";
import { logger } from "./lib/logger";

type FeishuReceiveIdType = "open_id" | "user_id" | "email" | "chat_id";

interface Recipient {
	type: "user" | "group";
	id: string;
	name: string;
	feishuId: string;
	idType: FeishuReceiveIdType;
}

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
	// biome-ignore lint/suspicious/noExplicitAny: Webhook body can be any arbitrary JSON
	let body: Record<string, any>;
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
	const userRecipients: Recipient[] = topic.subscriptions
		.map((sub) => sub.user)
		.map((u) => {
			if (!u || !u.feishuUserId) return null;
			return {
				type: "user" as const,
				id: u.id,
				name: u.name,
				feishuId: u.feishuUserId,
				idType: (u.feishuUserId.startsWith("ou_")
					? "open_id"
					: "user_id") as FeishuReceiveIdType,
			};
		})
		.filter((u): u is NonNullable<typeof u> => u !== null);

	const groupRecipients: Recipient[] = topic.groupChats.map((g) => ({
		type: "group",
		id: g.id, // Binding ID
		name: g.name,
		feishuId: g.chatId,
		idType: "chat_id" as FeishuReceiveIdType,
	}));

	const allRecipients: Recipient[] = [...userRecipients, ...groupRecipients];

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

				// Special handling for incomplete payloads (missing 'content')
				if (!content) {
					// 1. Special case: Unwrap 'card' if provided (convenience for user)
					if (body.card) {
						content = body.card;
						if (!msgType) msgType = "interactive";
					} else {
						// 2. Pass-through strategy: Use rest of body as content
						// Exclude keys that are definitely not part of content
						const { msg_type, token, ...rest } = body;
						content = rest;

						// 3. Infer msgType if missing
						if (!msgType) {
							if (body.post) msgType = "post";
							else if (body.file_key && body.image_key)
								msgType = "media"; // Media has both
							else if (body.image_key) msgType = "image";
							else if (body.file_key) msgType = "file";
							else if (body.audio_key) msgType = "audio";
							else if (body.sticker_key) msgType = "sticker";
							else if (body.chat_id) msgType = "share_chat";
							else if (body.user_id) msgType = "share_user";
							else if (body.header || body.elements)
								msgType = "interactive"; // Unwrapped card
							else {
								// Fallback to text
								msgType = "text";
								// For text, content must be simple or stringified
								content = { text: JSON.stringify(body, null, 2) };
							}
						}
					}
				} else {
					// Deep clone content to avoid mutating shared object for parallel requests if we modify it
					content = JSON.parse(JSON.stringify(content));
				}

				// Add metadata
				if (msgType === "text" && content.text) {
					content.text = `[${topic.name}]\n${content.text}`;
				}
				if (msgType === "interactive" && content.header) {
					content.header.title.content = `[${topic.name}] ${content.header.title.content}`;
				}

				await feishuClient.sendMessage(
					recipient.feishuId,
					recipient.idType,
					msgType,
					content,
					body.uuid,
				);

				return { recipientId: recipient.id, status: "sent", error: null };
			} catch (error: unknown) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
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
					error: errorMessage,
				};
			}
		}),
	).then(async (results) => {
		const successCount = results.filter(
			(r) =>
				r.status === "fulfilled" &&
				(r.value as { status: string }).status === "sent",
		).length;
		const failures = results.filter(
			(r) =>
				r.status === "rejected" ||
				(r.status === "fulfilled" &&
					(r.value as { status: string }).status === "failed"),
		).length;

		// Determine final status
		const finalStatus: "completed" | "failed" =
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
				const val = r.value as {
					status: "sent" | "failed";
					error: string | null;
				};
				return {
					taskId: task.id,
					userId: recipient.type === "user" ? recipient.id : null, // Only link users
					// We could add connection to group binding if we altered schema, but for now log it
					status: val.status as "sent" | "failed",
					error: val.error,
				};
			} else {
				return {
					taskId: task.id,
					userId: recipient.type === "user" ? recipient.id : null,
					status: "failed" as const,
					error: r.status === "rejected" ? String(r.reason) : "Unknown error",
				};
			}
		});

		if (logs.length > 0) {
			await db.insert(alertLogs).values(logs);
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

	// biome-ignore lint/suspicious/noExplicitAny: Webhook body can be any arbitrary JSON
	let body: Record<string, any>;
	try {
		const rawBody = await c.req.text();
		if (!rawBody || rawBody.trim() === "") {
			return c.json({ error: "Empty body" }, 400);
		}
		body = JSON.parse(rawBody);
	} catch (_e) {
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

			// Special handling for incomplete payloads (missing 'content')
			if (!content) {
				// 1. Interactive / Card
				if ((msgType === "interactive" || !msgType) && body.card) {
					msgType = "interactive";
					content = body.card;
				}
				// 2. Post (Rich Text)
				else if ((msgType === "post" || !msgType) && body.post) {
					msgType = "post";
					content = { post: body.post };
				}
				// 3. Image
				else if ((msgType === "image" || !msgType) && body.image_key) {
					msgType = "image";
					content = { image_key: body.image_key };
				}
				// 4. File
				else if ((msgType === "file" || !msgType) && body.file_key) {
					msgType = "file";
					content = { file_key: body.file_key };
				}
				// 5. Audio
				else if ((msgType === "audio" || !msgType) && body.audio_key) {
					msgType = "audio";
					content = { file_key: body.audio_key };
				}
				// 6. Media (Video)
				else if (
					(msgType === "media" || !msgType) &&
					body.file_key &&
					body.image_key
				) {
					msgType = "media";
					content = { file_key: body.file_key, image_key: body.image_key };
				}
				// 7. Sticker
				else if ((msgType === "sticker" || !msgType) && body.sticker_key) {
					msgType = "sticker";
					content = { file_key: body.sticker_key };
				}
				// 8. Share Chat
				else if ((msgType === "share_chat" || !msgType) && body.chat_id) {
					msgType = "share_chat";
					content = { chat_id: body.chat_id };
				}
				// 9. Share User
				else if ((msgType === "share_user" || !msgType) && body.user_id) {
					msgType = "share_user";
					content = { user_id: body.user_id };
				}
				// Fallback
				else {
					if (!msgType || msgType === "text") {
						msgType = "text";
						content = { text: JSON.stringify(body, null, 2) };
					}
				}
			} else {
				// Deep clone content to avoid mutating shared object for parallel requests if we modify it
				content = JSON.parse(JSON.stringify(content));
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
			const uuid = body.uuid || crypto.randomUUID();
			await feishuClient.sendMessage(
				user.feishuUserId,
				idType,
				msgType,
				content,
				uuid,
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
				status: "sent" as const,
			});
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			logger.error({ err: error, userName: user.name }, "Failed to send DM");
			await db
				.update(alertTasks)
				.set({
					status: "failed",
					updatedAt: new Date(),
					error: errorMessage,
				})
				.where(eq(alertTasks.id, task.id));

			await db.insert(alertLogs).values({
				taskId: task.id,
				userId: user.id,
				status: "failed" as const,
				error: errorMessage,
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
