import { eq } from "drizzle-orm";
import { type Context, Hono } from "hono";
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

interface Topic {
	slug: string;
	name: string;
	isGlobal: boolean;
	subscriptions?: { user: User }[];
	groupChats?: { id: string; name: string; chatId: string; status: string }[];
}

interface User {
	id: string;
	name: string;
	feishuUserId: string;
}

interface WebhookBody {
	msg_type?: string;
	content?: unknown;
	card?: unknown;
	post?: unknown;
	image_key?: string;
	file_key?: string;
	audio_key?: string;
	sticker_key?: string;
	chat_id?: string;
	user_id?: string;
	uuid?: string;
	token?: string;
	file_type?: string;
	file_name?: string;
	[key: string]: unknown;
}

const webhook = new Hono();

const getRequestBody = async (c: Context): Promise<WebhookBody> => {
	const contentType = c.req.header("Content-Type") || "";
	let body: WebhookBody;

	if (contentType.includes("application/json")) {
		try {
			body = await c.req.json();
		} catch (_e) {
			throw new Error("Invalid JSON body");
		}
	} else if (
		contentType.includes("multipart/form-data") ||
		contentType.includes("application/x-www-form-urlencoded")
	) {
		body = (await c.req.parseBody()) as unknown as WebhookBody;
		// Handle stringified JSON fields in multipart
		const complexFields: (keyof WebhookBody)[] = ["content", "card", "post"];
		for (const field of complexFields) {
			const val = body[field];
			if (typeof val === "string") {
				try {
					body[field] = JSON.parse(val);
				} catch {
					// Not JSON, leave as is
				}
			}
		}
	} else {
		// Fallback: try parsing as JSON
		try {
			const text = await c.req.text();
			if (!text || text.trim() === "") {
				throw new Error("Empty body");
			}
			body = JSON.parse(text);
		} catch (_e) {
			throw new Error("Invalid or missing request body");
		}
	}

	// Proxy upload if files are present
	const file = Array.isArray(body.file) ? (body.file[0] as unknown) : body.file;
	if (file instanceof File) {
		const buffer = Buffer.from(await file.arrayBuffer());
		const fileType =
			(body.file_type as
				| "opus"
				| "mp4"
				| "pdf"
				| "doc"
				| "xls"
				| "ppt"
				| "stream") || "stream";
		const fileName = (body.file_name as string) || file.name;
		const fileKey = await feishuClient.uploadFile(fileType, fileName, buffer);
		body.file_key = fileKey;
		delete body.file;
	}

	const image = Array.isArray(body.image)
		? (body.image[0] as unknown)
		: body.image;
	if (image instanceof File) {
		const buffer = Buffer.from(await image.arrayBuffer());
		const imageKey = await feishuClient.uploadImage(buffer);
		body.image_key = imageKey;
		delete body.image;
	}

	return { ...body };
};

const dispatchAlert = async (
	c: Context,
	topic: Topic,
	body: WebhookBody,
	user: User | null,
) => {
	// 2. Collect recipients
	const userRecipients: (Recipient | null)[] = (topic.subscriptions || [])
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
		});

	const validUserRecipients: Recipient[] = userRecipients.filter(
		(u): u is Recipient => u !== null,
	);

	const groupRecipients: Recipient[] = (topic.groupChats || [])
		.filter((g) => g.status === "approved")
		.map((g) => ({
			type: "group",
			id: g.id, // Binding ID
			name: g.name,
			feishuId: g.chatId,
			idType: "chat_id" as FeishuReceiveIdType,
		}));

	const allRecipients: Recipient[] = [
		...validUserRecipients,
		...groupRecipients,
	];

	const [task] = await db
		.insert(alertTasks)
		.values({
			topicSlug: topic.slug,
			senderId: user?.id || null, // Global topic might not have a sender
			status: "processing",
			recipientCount: allRecipients.length,
			successCount: 0,
			// biome-ignore lint/suspicious/noExplicitAny: Drizzle expects specific jsonb type
			payload: body as any,
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
			slug: topic.slug,
			userCount: validUserRecipients.length,
			groupCount: groupRecipients.length,
		},
		"[Webhook] Dispatching alerts",
	);

	// 4. Send Private Messages asynchronously
	Promise.allSettled(
		allRecipients.map(async (recipient) => {
			try {
				// Construct messages list
				const messagesToSend: {
					type: string;
					content: Record<string, unknown> | string;
				}[] = [];

				// 1. Text content
				if (body.content) {
					const content = JSON.parse(JSON.stringify(body.content));
					const msgType = body.msg_type || "text";
					// Add prefix for text
					if (
						msgType === "text" &&
						content &&
						typeof content === "object" &&
						"text" in content
					) {
						(content as Record<string, unknown>).text = `[Direct Message]\n${
							(content as Record<string, unknown>).text
						}`;
					}
					// Add prefix for interactive
					if (
						msgType === "interactive" &&
						content &&
						typeof content === "object" &&
						"header" in content
					) {
						const c = content as Record<
							string,
							Record<string, Record<string, unknown>>
						>;
						if (c.header?.title?.content) {
							c.header.title.content = `[${topic.slug || topic.name}] ${
								c.header.title.content
							}`;
						}
					}
					messagesToSend.push({
						type: msgType,
						content: content as Record<string, unknown> | string,
					});
				}

				// 2. Image
				if (body.image_key) {
					messagesToSend.push({
						type: "image",
						content: { image_key: body.image_key },
					});
				}

				// 3. File
				if (body.file_key) {
					messagesToSend.push({
						type: "file",
						content: { file_key: body.file_key },
					});
				}

				// 4. Fallback for no explicit content/attachment keys
				if (messagesToSend.length === 0) {
					let msgType = body.msg_type || "text";
					let content: unknown = body.content;

					if (body.card) {
						content = body.card;
						if (!msgType) msgType = "interactive";
					} else {
						const { msg_type: _msg_type, token: _token, ...rest } = body;
						content = rest;
						if (!msgType) {
							if (body.post) msgType = "post";
							else if (body.file_key && body.image_key) msgType = "media";
							else if (body.image_key) msgType = "image";
							else if (body.file_key) msgType = "file";
							else if (body.audio_key) msgType = "audio";
							else if (body.sticker_key) msgType = "sticker";
							else if (body.chat_id) msgType = "share_chat";
							else if (body.user_id) msgType = "share_user";
							else if (body.header || body.elements) msgType = "interactive";
							else {
								msgType = "text";
								content = { text: JSON.stringify(body, null, 2) };
							}
						}
					}
					// Add prefix for inferred types
					if (
						msgType === "text" &&
						content &&
						typeof content === "object" &&
						"text" in content
					) {
						(content as Record<string, unknown>).text = `[${topic.name}]\n${
							(content as Record<string, unknown>).text
						}`;
					}
					messagesToSend.push({
						type: msgType,
						content: content as Record<string, unknown> | string,
					});
				}

				let successCount = 0;
				for (const msg of messagesToSend) {
					await feishuClient.sendMessage(
						recipient.feishuId,
						recipient.idType,
						msg.type,
						msg.content,
						body.uuid,
					);
					successCount++;
				}

				return {
					recipientId: recipient.id,
					status: successCount > 0 ? "sent" : "failed",
					error: null,
				};
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
					recipientId: string;
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
			}
			return {
				taskId: task.id,
				userId: recipient.type === "user" ? recipient.id : null,
				status: "failed" as const,
				error: r.status === "rejected" ? String(r.reason) : "Unknown error",
			};
		});

		if (logs.length > 0) {
			await db.insert(alertLogs).values(logs);
		}

		logger.info(
			{
				taskId: task.id,
				successCount,
				totalCount: allRecipients.length,
				slug: topic.slug,
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
};

webhook.post("/topic/:slug", async (c) => {
	const slug = c.req.param("slug");
	logger.info({ slug }, "[Webhook] Received global request");

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

	if (!topic.isGlobal) {
		logger.warn({ slug }, "[Webhook] Topic is not global");
		return c.json(
			{ error: "This topic requires a personal token to send alerts" },
			401,
		);
	}

	// biome-ignore lint/suspicious/noExplicitAny: Webhook body can be any arbitrary JSON
	let body: Record<string, any>;
	try {
		body = await getRequestBody(c);
	} catch (e) {
		return c.json({ error: (e as Error).message }, 400);
	}

	return dispatchAlert(c, topic, body, null);
});

webhook.post("/:token/topic/:slug", async (c) => {
	const token = c.req.param("token");
	const slug = c.req.param("slug");
	logger.info({ token, slug }, "[Webhook] Received request");

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

	let user: User | null = null;
	if (!topic.isGlobal) {
		// 0. Find the User by Token
		user =
			(await db.query.users.findFirst({
				where: eq(users.personalToken, token),
			})) || null;

		if (!user) {
			logger.warn({ token }, "[Webhook] Invalid personal token");
			return c.json({ error: "Invalid personal token" }, 401);
		}
	}

	// biome-ignore lint/suspicious/noExplicitAny: Webhook body can be any arbitrary JSON
	let body: Record<string, any>;
	try {
		body = await getRequestBody(c);
	} catch (e) {
		return c.json({ error: (e as Error).message }, 400);
	}

	return dispatchAlert(c, topic, body, user);
});

webhook.all("/topic/:slug", (c) => {
	return c.json(
		{
			error: "Method not allowed",
			message: "Please use POST to send alerts to this webhook",
			format: "POST /webhook/topic/:slug",
			example:
				'curl -X POST -H "Content-Type: application/json" -d \'{"content":{"text":"Hello"}}\' URL',
		},
		405,
	);
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
		body = await getRequestBody(c);
	} catch (e) {
		return c.json({ error: (e as Error).message }, 400);
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
			const messagesToSend: {
				type: string;
				content: Record<string, unknown> | string;
			}[] = [];

			// Text content
			if (body.content) {
				const content = JSON.parse(JSON.stringify(body.content));
				messagesToSend.push({ type: body.msg_type || "text", content });
			}

			// Image
			if (body.image_key) {
				messagesToSend.push({
					type: "image",
					content: { image_key: body.image_key },
				});
			}

			// File
			if (body.file_key) {
				messagesToSend.push({
					type: "file",
					content: { file_key: body.file_key },
				});
			}

			// Fallback: if no explicit content/attachment keys, check other fields
			if (messagesToSend.length === 0) {
				let msgType = body.msg_type || "text";
				let content = body.content;

				if ((msgType === "interactive" || !msgType) && body.card) {
					msgType = "interactive";
					content = body.card;
				} else if ((msgType === "post" || !msgType) && body.post) {
					msgType = "post";
					content = { post: body.post };
				} else if ((msgType === "audio" || !msgType) && body.audio_key) {
					msgType = "audio";
					content = { file_key: body.audio_key };
				} else if (
					(msgType === "media" || !msgType) &&
					body.file_key &&
					body.image_key
				) {
					msgType = "media";
					content = { file_key: body.file_key, image_key: body.image_key };
				} else if ((msgType === "sticker" || !msgType) && body.sticker_key) {
					msgType = "sticker";
					content = { file_key: body.sticker_key };
				} else if ((msgType === "share_chat" || !msgType) && body.chat_id) {
					msgType = "share_chat";
					content = { chat_id: body.chat_id };
				} else if ((msgType === "share_user" || !msgType) && body.user_id) {
					msgType = "share_user";
					content = { user_id: body.user_id };
				} else {
					const { msg_type: _msg_type, token: _token, ...rest } = body;
					content = rest;
					if (!msgType || msgType === "text") {
						msgType = "text";
						content = { text: JSON.stringify(rest, null, 2) };
					}
				}
				messagesToSend.push({ type: msgType, content });
			}

			let totalSuccess = 0;
			for (const msg of messagesToSend) {
				await feishuClient.sendMessage(
					user.feishuUserId,
					"open_id",
					msg.type,
					msg.content,
					body.uuid,
				);
				totalSuccess++;
			}

			const finalStatus = totalSuccess > 0 ? "completed" : "failed";

			// Update Task
			await db
				.update(alertTasks)
				.set({
					status: finalStatus,
					successCount: totalSuccess === messagesToSend.length ? 1 : 0, // In DM case, 1 recipient
					updatedAt: new Date(),
				})
				.where(eq(alertTasks.id, task.id));

			// Log Sent
			await db.insert(alertLogs).values({
				taskId: task.id,
				userId: user.id,
				status: totalSuccess > 0 ? "sent" : "failed",
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
