import { Database } from "bun:sqlite";

const db = new Database("dev.db");
try {
	const query = db.query("SELECT * FROM topics");
	const topics = query.all();
	console.log("Topics:", JSON.stringify(topics, null, 2));
} catch (e) {
	console.error("Error querying topics:", e);
}
