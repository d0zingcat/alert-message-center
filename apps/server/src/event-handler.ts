import * as lark from "@larksuiteoapi/node-sdk";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { knownGroupChats, topicGroupChats } from "./db/schema";
import { logger } from "./lib/logger";

interface BotAddedEvent {
	chat_id: string;
	name?: string;
}

interface BotDeletedEvent {
	chat_id: string;
}

export const eventDispatcher = new lark.EventDispatcher({
	encryptKey: process.env.FEISHU_ENCRYPT_KEY,
	verificationToken: process.env.FEISHU_VERIFICATION_TOKEN,
}).register({
	"im.chat.member.bot.added_v1": async (data) => {
		const { chat_id, name } = data as unknown as BotAddedEvent;
		logger.info({ chat_id, name }, "[Feishu Event] Bot added to group");

		if (chat_id) {
			await db
				.insert(knownGroupChats)
				.values({
					chatId: chat_id,
					name: name || "Unknown Group",
					lastActiveAt: new Date(),
				})
				.onConflictDoUpdate({
					target: knownGroupChats.chatId,
					set: {
						name: name || "Unknown Group",
						lastActiveAt: new Date(),
					},
				});
		}
	},
	"im.chat.member.bot.deleted_v1": async (data) => {
		const { chat_id } = data as unknown as BotDeletedEvent;
		logger.info({ chat_id }, "[Feishu Event] Bot removed from group");

		if (chat_id) {
			await db
				.delete(knownGroupChats)
				.where(eq(knownGroupChats.chatId, chat_id));
			await db
				.delete(topicGroupChats)
				.where(eq(topicGroupChats.chatId, chat_id));
		}
	},
});
