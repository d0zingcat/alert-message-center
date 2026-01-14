import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url:
			process.env.DATABASE_URL ||
			"postgres://postgres:password@localhost:5432/alert_message_center",
	},
});
