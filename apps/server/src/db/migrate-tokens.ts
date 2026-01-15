import { db } from "./index";
import { migrateUserTokens } from "./migrate";

async function main() {
	await migrateUserTokens(db);
	process.exit(0);
}

main();
