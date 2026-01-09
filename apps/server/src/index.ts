import { Hono } from 'hono';
import { cors } from 'hono/cors';
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

app.get('/', (c) => {
  return c.text('Alert Message Center API is running!');
});

const routes = app.route('/api/auth', auth)
  .route('/api', api)
  .route('/webhook', webhook);

app.onError((err, c) => {
  console.error(`[Global Error] ${c.req.method} ${c.req.url}:`, err);
  return c.json({ error: err.message || 'Internal Server Error' }, 500);
});

app.get('/topics', async (c) => {
  const allTopics = await db.select().from(topics);
  return c.json(allTopics);
});

export type AppType = typeof routes;
export default app;
