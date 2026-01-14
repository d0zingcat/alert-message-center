import * as lark from "@larksuiteoapi/node-sdk";
import { logger } from "./lib/logger";

export class FeishuClient {
	public client: lark.Client;
	public appId: string;
	public appSecret: string;

	constructor(appId: string, appSecret: string) {
		this.appId = appId;
		this.appSecret = appSecret;
		this.client = new lark.Client({
			appId: appId,
			appSecret: appSecret,
			disableTokenCache: false,
		});
	}

	async sendMessage(
		receiveId: string,
		receiveIdType: "open_id" | "user_id" | "email" | "chat_id",
		msgType: string,
		content: any,
	) {
		// Content needs to be stringified for 'text' type in API, but SDK might handle it differently?
		// Actually SDK expects 'content' as string JSON for 'im.v1.messages.create'
		const contentStr =
			typeof content === "string" ? content : JSON.stringify(content);

		try {
			const response = await this.client.im.message.create({
				params: {
					receive_id_type: receiveIdType,
				},
				data: {
					receive_id: receiveId,
					msg_type: msgType,
					content: contentStr,
				},
			});

			if (response.code !== 0) {
				logger.error({ response }, "Feishu send message error");
				throw new Error(`Failed to send message: ${response.msg}`);
			}
			return response.data;
		} catch (e) {
			console.error("Feishu SDK error:", e);
			throw e;
		}
	}

	async getUserAccessToken(code: string): Promise<any> {
		try {
			const response = await this.client.authen.accessToken.create({
				data: {
					grant_type: "authorization_code",
					code,
				},
			});

			if (response.code !== 0) {
				logger.error({ response }, "Feishu get user access token error");
				throw new Error(`Failed to get user access token: ${response.msg}`);
			}
			return response.data;
		} catch (e) {
			console.error("Feishu SDK error:", e);
			throw e;
		}
	}
}

// Singleton instance
export const feishuClient = new FeishuClient(
	process.env.FEISHU_APP_ID || "",
	process.env.FEISHU_APP_SECRET || "",
);
