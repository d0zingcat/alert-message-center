import { pgTable, text, integer, primaryKey, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Topics: 类似于 Kafka 的 Topic 或 告警的 Tag，例如 "payment-service", "prod-env"
export const topics = pgTable('topics', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: text('slug').notNull().unique(), // 告警发送时使用的 key
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).default('approved').notNull(),
  createdBy: text('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const topicsRelations = relations(topics, ({ many, one }) => ({
  subscriptions: many(subscriptions),
  creator: one(users, {
    fields: [topics.createdBy],
    references: [users.id],
  }),
}));

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  feishuUserId: text('feishu_user_id').notNull(), // 必须有飞书 ID 才能私聊 (open_id 或 user_id)
  email: text('email').unique(),
  isAdmin: boolean('is_admin').default(false),
  personalToken: text('personal_token').notNull().unique().$defaultFn(() => crypto.randomUUID().replace(/-/g, '')),
});

export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

// Subscriptions: 用户直接订阅 Topic
export const subscriptions = pgTable('subscriptions', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  topicId: text('topic_id').notNull().references(() => topics.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.topicId] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  topic: one(topics, {
    fields: [subscriptions.topicId],
    references: [topics.id],
  }),
}));

// API Tasks: 记录 webhook 请求的处理状态
export const alertTasks = pgTable('alert_tasks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  topicSlug: text('topic_slug').notNull(),
  senderId: text('sender_id').references(() => users.id), // 记录是谁发送的 (通过 personal_token)
  status: text('status', { enum: ['pending', 'processing', 'completed', 'failed'] }).default('pending').notNull(),
  recipientCount: integer('recipient_count').default(0),
  successCount: integer('success_count').default(0),
  payload: jsonb('payload'), // 存储 webhook body
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Logs for each recipient in a task (optional detail)
export const alertLogs = pgTable('alert_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  taskId: text('task_id').notNull().references(() => alertTasks.id, { onDelete: 'cascade' }),
  userId: text('user_id'), // Optional, in case user is deleted later
  status: text('status', { enum: ['sent', 'failed'] }).notNull(),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const alertTasksRelations = relations(alertTasks, ({ many, one }) => ({
  logs: many(alertLogs),
  sender: one(users, {
    fields: [alertTasks.senderId],
    references: [users.id],
  }),
}));

export const alertLogsRelations = relations(alertLogs, ({ one }) => ({
  task: one(alertTasks, {
    fields: [alertLogs.taskId],
    references: [alertTasks.id],
  }),
}));
