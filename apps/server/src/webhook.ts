import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { topics, alertTasks, alertLogs, users } from './db/schema';
import { feishuClient } from './feishu';

const webhook = new Hono();

webhook.post('/:token/topic/:slug', async (c) => {
  const token = c.req.param('token');
  const slug = c.req.param('slug');
  console.log(`[Webhook] Received request for token: ${token}, slug: ${slug}`);

  // 0. Find the User by Token
  const user = await db.query.users.findFirst({
    where: eq(users.personalToken, token),
  });

  if (!user) {
    console.warn(`[Webhook] Invalid personal token: ${token}`);
    return c.json({ error: 'Invalid personal token' }, 401);
  }
  let body;
  try {
    const rawBody = await c.req.text();
    console.log(`[Webhook] Raw body length: ${rawBody.length}, content: "${rawBody}"`);
    if (!rawBody || rawBody.trim() === '') {
      return c.json({ error: 'Empty body' }, 400);
    }
    body = JSON.parse(rawBody);
  } catch (e) {
    console.error(`[Webhook] Failed to parse JSON body:`, e);
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // 1. Find the Topic
  const topic = await db.query.topics.findFirst({
    where: eq(topics.slug, slug),
    with: {
      subscriptions: {
        with: {
          user: true
        }
      }
    }
  });

  if (!topic) {
    console.warn(`[Webhook] Topic not found: ${slug}`);
    return c.json({ error: 'Topic not found' }, 404);
  }

  console.log(`[Webhook] Found topic: ${topic.name}, subscribers: ${topic.subscriptions.length}`);

  // 2. Collect subscribers
  const subscribers = topic.subscriptions
    .map(sub => sub.user)
    .filter(u => !!u && !!u.feishuUserId);

  const [task] = await db.insert(alertTasks).values({
    topicSlug: topic.slug,
    senderId: user.id,
    status: 'processing',
    recipientCount: subscribers.length,
    successCount: 0,
    payload: body,
  }).returning();

  if (subscribers.length === 0) {
    await db.update(alertTasks)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(alertTasks.id, task.id));

    return c.json({
      message: 'No subscribers for this topic',
      taskId: task.id,
      status: 'completed'
    });
  }

  // 4. Send Private Messages asynchronously
  Promise.allSettled(subscribers.map(async (user) => {
    try {
      // Construct message content
      let msgType = body.msg_type || 'text';
      let content = body.content;

      if (!content) {
        msgType = 'text';
        content = { text: JSON.stringify(body, null, 2) };
      }

      // Add metadata
      if (msgType === 'text' && content.text) {
        content.text = `[Topic: ${topic.name}]\n${content.text}`;
      }
      if (msgType === 'interactive' && content.header) {
        content.header.title.content = `[${topic.name}] ${content.header.title.content}`;
      }

      const idType = user.feishuUserId.startsWith('ou_') ? 'open_id' : 'user_id';
      await feishuClient.sendMessage(user.feishuUserId, idType, msgType, content);

      return { userId: user.id, status: 'sent', error: null };
    } catch (error: any) {
      console.error(`Failed to send to user ${user.name}:`, error);
      return { userId: user.id, status: 'failed', error: error.message };
    }
  })).then(async (results) => {
    const successCount = results.filter(r => r.status === 'fulfilled' && (r.value as any).status === 'sent').length;
    const failures = results
      .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && (r.value as any).status === 'failed'))
      .length;

    // Determine final status
    const finalStatus = failures === 0 ? 'completed' : (successCount > 0 ? 'completed' : 'failed');

    // Update Task
    await db.update(alertTasks).set({
      status: finalStatus,
      successCount,
      updatedAt: new Date(),
      // If fully failed, maybe store the first error in the task record for quick view
      error: failures > 0 ? `Failed to send to ${failures} recipients` : null,
    }).where(eq(alertTasks.id, task.id));

    // Insert Logs (Optional: insert only failures to save space, or all for audit)
    // Let's insert all for now
    const logs = results.map((r, index) => {
      const user = subscribers[index];
      if (r.status === 'fulfilled') {
        const val = r.value as any;
        return {
          taskId: task.id,
          userId: user.id,
          status: val.status,
          error: val.error,
        };
      } else {
        return {
          taskId: task.id,
          userId: user.id,
          status: 'failed',
          error: r.reason ? String(r.reason) : 'Unknown error',
        };
      }
    });

    if (logs.length > 0) {
      await db.insert(alertLogs).values(logs as any);
    }

    console.log(`[Webhook] Task ${task.id}: Sent ${successCount}/${subscribers.length} alerts for topic ${slug}`);
  });

  return c.json({
    message: 'Alert received and processing started',
    taskId: task.id,
    status: 'processing',
    recipientCount: subscribers.length
  });
});

webhook.post('/:token/dm', async (c) => {
  const token = c.req.param('token');
  console.log(`[Webhook] Received DM request for token: ${token}`);

  // 0. Find the User by Token
  const user = await db.query.users.findFirst({
    where: eq(users.personalToken, token),
  });

  if (!user) {
    console.warn(`[Webhook] Invalid personal token: ${token}`);
    return c.json({ error: 'Invalid personal token' }, 401);
  }

  if (!user.feishuUserId) {
    return c.json({ error: 'User has no Feishu ID linked' }, 400);
  }

  let body;
  try {
    const rawBody = await c.req.text();
    if (!rawBody || rawBody.trim() === '') {
      return c.json({ error: 'Empty body' }, 400);
    }
    body = JSON.parse(rawBody);
  } catch (e) {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // 1. Create Task (topicSlug is null for DM)
  const [task] = await db.insert(alertTasks).values({
    topicSlug: null,
    senderId: user.id,
    status: 'processing',
    recipientCount: 1,
    successCount: 0,
    payload: body,
  }).returning();

  // 2. Send Message
  (async () => {
    try {
      let msgType = body.msg_type || 'text';
      let content = body.content;

      if (!content) {
        msgType = 'text';
        content = { text: JSON.stringify(body, null, 2) };
      }

      // Add metadata
      if (msgType === 'text' && content.text) {
        content.text = `[Direct Message]\n${content.text}`;
      }
      if (msgType === 'interactive' && content.header) {
        content.header.title.content = `[DM] ${content.header.title.content}`;
      }

      const idType = user.feishuUserId.startsWith('ou_') ? 'open_id' : 'user_id';
      await feishuClient.sendMessage(user.feishuUserId, idType, msgType, content);

      // Update Task
      await db.update(alertTasks).set({
        status: 'completed',
        successCount: 1,
        updatedAt: new Date(),
      }).where(eq(alertTasks.id, task.id));

      // Insert Log
      await db.insert(alertLogs).values({
        taskId: task.id,
        userId: user.id,
        status: 'sent',
      });

    } catch (error: any) {
      console.error(`Failed to send DM to user ${user.name}:`, error);
      await db.update(alertTasks).set({
        status: 'failed',
        updatedAt: new Date(),
        error: error.message,
      }).where(eq(alertTasks.id, task.id));

      await db.insert(alertLogs).values({
        taskId: task.id,
        userId: user.id,
        status: 'failed',
        error: error.message,
      });
    }
  })();

  return c.json({
    message: 'DM received and processing started',
    taskId: task.id,
    status: 'processing',
    recipientCount: 1
  });
});

// Help message for non-POST requests or malformed URLs
webhook.all('/:token/topic/:slug', (c) => {
  return c.json({
    error: 'Method not allowed',
    message: 'Please use POST to send alerts to this webhook',
    format: 'POST /webhook/:token/topic/:slug',
    example: 'curl -X POST -H "Content-Type: application/json" -d \'{"content":{"text":"Hello"}}\' URL'
  }, 405);
});

export default webhook;
