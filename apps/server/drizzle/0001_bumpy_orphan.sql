CREATE TABLE "topic_group_webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
ALTER TABLE "alert_tasks" ALTER COLUMN "topic_slug" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_tasks" ADD COLUMN "sender_id" text;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "personal_token" text NOT NULL;--> statement-breakpoint
ALTER TABLE "topic_group_webhooks" ADD CONSTRAINT "topic_group_webhooks_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_group_webhooks" ADD CONSTRAINT "topic_group_webhooks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_tasks" ADD CONSTRAINT "alert_tasks_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_personal_token_unique" UNIQUE("personal_token");