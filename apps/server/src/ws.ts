import { feishuClient } from './feishu';
import { eventDispatcher } from './event-handler';

export const startWebSocket = async () => {
    if (process.env.FEISHU_USE_WS !== 'true') {
        return;
    }

    console.log('[Feishu WS] Starting WebSocket connection...');
    try {
        await (feishuClient.client as any).ws.start(eventDispatcher);
        console.log('[Feishu WS] Connected successfully');
    } catch (e) {
        console.error('[Feishu WS] Connection failed:', e);
    }
};
