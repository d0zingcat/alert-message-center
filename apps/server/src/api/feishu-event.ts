import { Hono } from 'hono';
import * as lark from '@larksuiteoapi/node-sdk';
import { eventDispatcher } from '../event-handler';

const feishuEvent = new Hono();

// Helper to adapt Hono request to Lark SDK request

feishuEvent.post('/', async (c) => {
    try {
        const headers = c.req.raw.headers;
        const headerRecord: Record<string, string> = {};
        headers.forEach((value, key) => {
            headerRecord[key] = value;
        });

        const body = await c.req.json();
        const req = {
            headers: headerRecord,
            body,
        };

        // Use the official SDK functions directly for Hono compatibility
        // 1. Handle URL verification (Challenge)
        const { isChallenge, challenge } = lark.generateChallenge(body, {
            encryptKey: process.env.FEISHU_ENCRYPT_KEY || ''
        });

        if (isChallenge) {
            return c.json(challenge);
        }

        // 2. Dispatch event
        // The dispatcher expects an object containing headers and body.
        // We use Object.create to put headers on the prototype so they are accessible
        // but not included in JSON.stringify, which preserves signature verification.
        const payload = Object.assign(Object.create({ headers: headerRecord }), body);
        const result = await eventDispatcher.invoke(payload);

        return c.json(result || {});
    } catch (e) {
        console.error('[Feishu Event] Error:', e);
        return c.json({ error: 'Internal Server Error' }, 500);
    }
});

export default feishuEvent;
