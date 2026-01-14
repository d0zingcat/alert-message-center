// Simulate topic creation
import { client } from "./client"; // This won't work in node script easily due to frontend dependencies

// Let's use fetch directly against the server
async function run() {
	console.log("Creating pending topic...");
	const res = await fetch("http://localhost:3000/api/topics", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			// We need to bake a cookie.
			// But we can't easily bake a signed cookie without the secret.
			// Wait, the cookies are not signed in the strict sense, just set.
			// But `middleware.ts` parses `JSON.parse(sessionCookie)`.

			// Let's fake a session cookie for a non-admin user.
			Cookie: `session=${encodeURIComponent(
				JSON.stringify({
					id: "user_123",
					name: "Test User",
					email: "test@example.com",
					isAdmin: false,
				}),
			)}`,
		},
		body: JSON.stringify({
			name: "Test Pending Topic",
			slug: "test-pending",
			description: "This should be pending",
		}),
	});

	if (res.ok) {
		const data = await res.json();
		console.log("Created topic:", data);
	} else {
		console.log("Error:", res.status, await res.text());
	}
}

run();
