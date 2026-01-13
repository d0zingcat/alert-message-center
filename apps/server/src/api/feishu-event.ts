import { Hono } from 'hono';
import * as lark from '@larksuiteoapi/node-sdk';
import { eventDispatcher } from '../event-handler';

const feishuEvent = new Hono();

// Helper to adapt Hono request to Lark SDK request
const adaptRequest = async (c: any) => {
    const headers = c.req.raw.headers;
    // Convert Headers object to Record<string, string>
    const headerRecord: Record<string, string> = {};
    headers.forEach((value: string, key: string) => {
        headerRecord[key] = value;
    });

    return {
        headers: headerRecord,
        body: await c.req.json(),
    };
};

feishuEvent.post('/', async (c) => {
    try {
        const req = await adaptRequest(c);

        // Use the official SDK to handle the request
        // It handles URL verification, encryption, and dispatching
        const res = await lark.adaptDefault('/api/feishu/event', req, eventDispatcher, {
            autoChallenge: true,
            encryptKey: process.env.FEISHU_ENCRYPT_KEY
        }) as any;

        return c.json(res?.body || {});
    } catch (e) {
        console.error('[Feishu Event] Error:', e);
        return c.json({ error: 'Internal Server Error' }, 500);
    }
});

export default feishuEvent;
