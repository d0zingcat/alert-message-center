import { db } from './db';
import { knownGroupChats } from './db/schema';
import { eq } from 'drizzle-orm';
import * as lark from '@larksuiteoapi/node-sdk';

export const eventDispatcher = new lark.EventDispatcher({}).register({
    'im.chat.member.bot.added_v1': async (data) => {
        const payload = data as any;
        const { chat_id, name } = payload.chat || payload.message?.chat || {};
        console.log(`[Feishu Event] Bot added to group: ${name} (${chat_id})`);

        if (chat_id) {
            await db.insert(knownGroupChats).values({
                chatId: chat_id,
                name: name || 'Unknown Group',
                lastActiveAt: new Date(),
            }).onConflictDoUpdate({
                target: knownGroupChats.chatId,
                set: {
                    name: name || 'Unknown Group',
                    lastActiveAt: new Date(),
                }
            });
        }
    },
});
