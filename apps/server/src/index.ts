import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import { db } from './db';
import { topics } from './db/schema';
import webhook from './webhook';
import api from './api';
import auth from './auth';

const app = new Hono();

// Enable CORS for frontend
app.use('/*', cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

import feishuEvent from './api/feishu-event';

// ...

// API Routes
const routes = app.route('/api/auth', auth)
  .route('/api', api)
  .route('/api/feishu/event', feishuEvent)
  .route('/webhook', webhook);

// Serve static files (Frontend)
app.use('/*', serveStatic({ root: './public' }));
app.get('*', serveStatic({ path: './public/index.html' }));

app.onError((err, c) => {
  console.error(`[Global Error] ${c.req.method} ${c.req.url}:`, err);
  return c.json({ error: err.message || 'Internal Server Error' }, 500);
});

app.get('/topics', async (c) => {
  const allTopics = await db.select().from(topics);
  return c.json(allTopics);
});

// Start WebSocket if enabled
import { startWebSocket } from './ws';
startWebSocket();

export type AppType = typeof routes;
export default app;
