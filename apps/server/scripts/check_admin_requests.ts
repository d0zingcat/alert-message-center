export {};

// Simulate admin checking requests
async function run() {
	console.log("Fetching pending topics as admin...");
	const adminEmail = (process.env.ADMIN_EMAILS || "").split(",")[0].trim();
	const res = await fetch("http://localhost:3000/api/topics/requests", {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			Cookie: `session=${encodeURIComponent(
				JSON.stringify({
					id: "admin_123",
					name: "Admin User",
					email: adminEmail,
					isAdmin: true,
				}),
			)}`,
		},
	});

	if (res.ok) {
		const data = await res.json();
		console.log("Pending topics:", JSON.stringify(data, null, 2));
	} else {
		console.log("Error:", res.status, await res.text());
	}
}

run();
