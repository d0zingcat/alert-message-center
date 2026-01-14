import { eq } from "drizzle-orm";
import { db } from "./db";
import { subscriptions, topics, users } from "./db/schema";
import app from "./index";

async function verify() {
	console.log("Starting Verification...");
	let errors = 0;

	// 1. Setup Test Data
	const timestamp = Date.now();

	// Create Non-Admin User
	const [userUser] = await db
		.insert(users)
		.values({
			name: `TestUser_${timestamp}`,
			feishuUserId: `test_user_${timestamp}`,
			email: `test_user_${timestamp}@example.com`,
			isAdmin: false,
		})
		.returning();

	// Create Admin User
	const [adminUser] = await db
		.insert(users)
		.values({
			name: `TestAdmin_${timestamp}`,
			feishuUserId: `test_admin_${timestamp}`,
			email: `test_admin_${timestamp}@example.com`,
			isAdmin: true,
		})
		.returning();

	// Create Topic
	const [topic] = await db
		.insert(topics)
		.values({
			name: `TestTopic_${timestamp}`,
			slug: `test-topic-${timestamp}`,
			description: "Test Description",
		})
		.returning();

	// Subscribe User to Topic
	await db.insert(subscriptions).values({
		userId: userUser.id,
		topicId: topic.id,
	});

	console.log("Test Data Created:", {
		user: userUser.id,
		admin: adminUser.id,
		topic: topic.id,
	});

	try {
		// 2. Test GET /users (Admin Only)

		// Test as Non-Admin
		const sessionUser = {
			userId: userUser.id,
			name: userUser.name,
			email: userUser.email,
			isAdmin: userUser.isAdmin,
		};
		const req1 = new Request("http://localhost/api/users", {
			headers: {
				Cookie: `session=${encodeURIComponent(JSON.stringify(sessionUser))}`,
			},
		});
		const res1 = await app.request(req1);

		if (res1.status === 403) {
			console.log("✅ PASS: GET /users as Non-Admin returned 403");
		} else {
			console.error(
				`❌ FAIL: GET /users as Non-Admin returned ${res1.status} (expected 403)`,
			);
			errors++;
		}

		// Test as Admin
		const sessionAdmin = {
			userId: adminUser.id,
			name: adminUser.name,
			email: adminUser.email,
			isAdmin: adminUser.isAdmin,
		};
		const req2 = new Request("http://localhost/api/users", {
			headers: {
				Cookie: `session=${encodeURIComponent(JSON.stringify(sessionAdmin))}`,
			},
		});
		const res2 = await app.request(req2);

		if (res2.status === 200) {
			console.log("✅ PASS: GET /users as Admin returned 200");
		} else {
			console.error(
				`❌ FAIL: GET /users as Admin returned ${res2.status} (expected 200)`,
			);
			errors++;
		}

		// 3. Test GET /topics (Filtered)

		// Test as Non-Admin (Should see ONLY their subscription)
		const req3 = new Request("http://localhost/api/topics", {
			headers: {
				Cookie: `session=${encodeURIComponent(JSON.stringify(sessionUser))}`,
			},
		});
		const res3 = await app.request(req3);
		const data3 = await res3.json();

		const targetTopic = (data3 as any).find((t: any) => t.id === topic.id);
		if (targetTopic) {
			if (
				targetTopic.subscriptions.length === 1 &&
				targetTopic.subscriptions[0].userId === userUser.id
			) {
				console.log(
					"✅ PASS: GET /topics as Non-Admin shows correct personal subscription",
				);
			} else {
				console.error(
					"❌ FAIL: GET /topics as Non-Admin showed wrong subscriptions:",
					targetTopic.subscriptions,
				);
				errors++;
			}
		} else {
			console.error("❌ FAIL: Test topic not found in list");
			errors++;
		}

		// Test as Admin (Should see ALL subscriptions?? Wait, I didn't add another subscription. Let's add admin subscription too)
		// Actually, let's just check that Admin sees the User's subscription.
		// In my logic: isAdmin ? undefined (all) : ...
		// So Admin should see User's subscription.

		const req4 = new Request("http://localhost/api/topics", {
			headers: {
				Cookie: `session=${encodeURIComponent(JSON.stringify(sessionAdmin))}`,
			},
		});
		const res4 = await app.request(req4);
		const data4 = await res4.json();

		const targetTopicAdmin = (data4 as any).find((t: any) => t.id === topic.id);
		// Should see the subscription for userUser
		const hasUserSub = targetTopicAdmin.subscriptions.some(
			(s: any) => s.userId === userUser.id,
		);
		if (hasUserSub) {
			console.log(
				"✅ PASS: GET /topics as Admin sees other users subscriptions",
			);
		} else {
			console.error(
				"❌ FAIL: GET /topics as Admin did NOT see other users subscriptions",
			);
			errors++;
		}
	} catch (e) {
		console.error("Test Exception:", e);
		errors++;
	} finally {
		// 4. Cleanup
		await db.delete(subscriptions).where(eq(subscriptions.topicId, topic.id));
		await db.delete(topics).where(eq(topics.id, topic.id));
		await db.delete(users).where(eq(users.id, userUser.id));
		await db.delete(users).where(eq(users.id, adminUser.id));
		console.log("Cleanup Completed");
	}

	if (errors === 0) {
		console.log("🎉 ALL TESTS PASSED");
		process.exit(0);
	} else {
		console.error("💥 SOME TESTS FAILED");
		process.exit(1);
	}
}

verify();
