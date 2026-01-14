import * as lark from "@larksuiteoapi/node-sdk";
import { eventDispatcher } from "./event-handler";
import { feishuClient } from "./feishu";
import { logger } from "./lib/logger";

export const startWebSocket = async () => {
	if (process.env.FEISHU_USE_WS !== "true") {
		return;
	}

	logger.info("[Feishu WS] Starting WebSocket connection...");
	try {
		const wsClient = new lark.WSClient({
			appId: feishuClient.appId,
			appSecret: feishuClient.appSecret,
		});
		await wsClient.start({ eventDispatcher });
		logger.info("[Feishu WS] Connected successfully");
	} catch (e) {
		logger.error({ err: e }, "[Feishu WS] Connection failed");
	}
};
