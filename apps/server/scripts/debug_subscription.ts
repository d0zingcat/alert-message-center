import postgres from "postgres";

const sql = postgres("postgres://localhost:5432/alertmessagecenter");

async function run() {
	try {
		// 1. Get a topic
		const [topic] = await sql`SELECT * FROM topics LIMIT 1`;
		if (!topic) {
			console.log("No topics found. Create a topic first.");
			return;
		}
		console.log("Using topic:", topic.id, topic.slug);

		// 2. Define a fake user ID
		const fakeUserId = "user_fake_002";

		// Clean up first
		await sql`DELETE FROM subscriptions WHERE user_id = ${fakeUserId}`;
		await sql`DELETE FROM users WHERE id = ${fakeUserId}`;

		// 3. Try to subscribe with non-existent user
		console.log("\n--- Attempt 1: Subscribe with non-existent user ---");
		const res1 = await fetch(
			`http://localhost:3000/api/topics/${topic.id}/subscribe/${fakeUserId}`,
			{
				method: "POST",
				headers: {
					Cookie: `session=${encodeURIComponent(
						JSON.stringify({
							id: fakeUserId,
							name: "Fake User",
							email: "fake@example.com",
							isAdmin: false,
						}),
					)}`,
				},
			},
		);
		console.log("Status:", res1.status);
		const text1 = await res1.text();
		console.log("Response:", text1); // Expect 500 FK violation

		// 4. Create the user
		console.log("\n--- Creating user... ---");
		await sql`INSERT INTO users (id, name, feishu_user_id, email, is_admin)
              VALUES (${fakeUserId}, 'Fake User', 'ou_fake', 'fake2@example.com', false)
              ON CONFLICT (id) DO NOTHING`;

		// 5. Try to subscribe again
		console.log("\n--- Attempt 2: Subscribe with existing user ---");
		const res2 = await fetch(
			`http://localhost:3000/api/topics/${topic.id}/subscribe/${fakeUserId}`,
			{
				method: "POST",
				headers: {
					Cookie: `session=${encodeURIComponent(
						JSON.stringify({
							id: fakeUserId,
							name: "Fake User",
							email: "fake@example.com",
							isAdmin: false,
						}),
					)}`,
				},
			},
		);
		console.log("Status:", res2.status);
		const text2 = await res2.text();
		console.log("Response:", text2); // Expect 200
	} catch (e) {
		console.error(e);
	} finally {
		await sql.end();
	}
}

run();
