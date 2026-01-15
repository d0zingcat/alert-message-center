import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
	process.env.DATABASE_URL ||
	"postgres://postgres:password@localhost:5432/alert_message_center";

async function main() {
	console.log("⏳ Running migrations...");
	const sql = postgres(connectionString, { max: 1 });
	const db = drizzle(sql, { schema });

	try {
		await migrate(db, { migrationsFolder: "./drizzle" });
		console.log("✅ Migrations completed!");
	} catch (error) {
		console.error("❌ Migration failed:", error);
		process.exit(1);
	} finally {
		await sql.end();
	}
}

main();
