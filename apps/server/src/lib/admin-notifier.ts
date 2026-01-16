import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { feishuClient } from "../feishu";
import { logger } from "./logger";

export async function notifyAdminsOfNewTopic(topic: {
    id: string;
    name: string;
    slug: string;
    createdBy: string | null;
    isGroupBinding?: boolean;
    groupName?: string;
}) {
    try {
        // 1. Get all admins
        const admins = await db.query.users.findMany({
            where: eq(users.isAdmin, true),
        });

        if (admins.length === 0) {
            logger.warn("No admins found to notify");
            return;
        }

        // 2. Get creator name
        let creatorName = "Unknown";
        if (topic.createdBy) {
            const creator = await db.query.users.findFirst({
                where: eq(users.id, topic.createdBy),
            });
            if (creator) creatorName = creator.name;
        }

        // 3. Prepare message content
        const title = topic.isGroupBinding
            ? "🔗 新的群聊绑定申请"
            : "🆕 新的 Topic 申请";
        const detailContent = topic.isGroupBinding
            ? `**Topic:** ${topic.name}\n**群聊:** ${topic.groupName}\n**创建者:** ${creatorName}`
            : `**名称:** ${topic.name}\n**Slug:** ${topic.slug}\n**创建者:** ${creatorName}`;

        const content = {
            config: { wide_screen_mode: true },
            header: {
                template: topic.isGroupBinding ? "blue" : "orange",
                title: { content: title, tag: "plain_text" },
            },
            elements: [
                {
                    tag: "div",
                    text: {
                        content: detailContent,
                        tag: "lark_md",
                    },
                },
                {
                    tag: "action",
                    actions: [
                        {
                            tag: "button",
                            text: { content: "前往审批", tag: "plain_text" },
                            type: "primary",
                            url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/admin/topics`,
                        },
                    ],
                },
            ],
        };

        // 4. Send notification to each admin
        for (const admin of admins) {
            if (admin.feishuUserId) {
                await feishuClient.sendMessage(
                    admin.feishuUserId,
                    "open_id",
                    "interactive",
                    content,
                );
            }
        }
    } catch (error) {
        logger.error({ err: error, topicId: topic.id }, "Failed to notify admins");
    }
}
