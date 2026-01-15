import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";
import { users } from "./schema";

const connectionString =
	process.env.DATABASE_URL ||
	"postgres://postgres:password@localhost:5432/alert_message_center";

export async function migrateUserTokens(db: any) {
	console.log("⏳ Checking for user tokens that need shortening...");
	try {
		const allUsers = await db.select().from(users);
		let updatedCount = 0;
		for (const user of allUsers) {
			if (user.personalToken && user.personalToken.length > 8) {
				const newToken = user.personalToken.substring(0, 8);
				console.log(
					`Updating user ${user.name}: ${user.personalToken} -> ${newToken}`,
				);
				await db
					.update(users)
					.set({ personalToken: newToken })
					.where(eq(users.id, user.id));
				updatedCount++;
			}
		}
		if (updatedCount > 0) {
			console.log(`✅ Updated ${updatedCount} user tokens.`);
		} else {
			console.log("ℹ️ No tokens need shortening.");
		}
	} catch (error) {
		console.error("❌ Failed to migrate user tokens:", error);
	}
}

async function main() {
	console.log("⏳ Running database migrations...");
	const sql = postgres(connectionString, { max: 1 });
	const db = drizzle(sql, { schema });

	try {
		await migrate(db, { migrationsFolder: "./drizzle" });
		console.log("✅ Database migrations completed!");

		await migrateUserTokens(db);
	} catch (error) {
		console.error("❌ Migration failed:", error);
		process.exit(1);
	} finally {
		await sql.end();
	}
}

// Only run main if this script is executed directly
if (import.meta.main) {
	main();
}
