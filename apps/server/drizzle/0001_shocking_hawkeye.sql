ALTER TABLE "topic_group_chats" ADD COLUMN "status" text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "is_global" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_trusted" boolean DEFAULT false;