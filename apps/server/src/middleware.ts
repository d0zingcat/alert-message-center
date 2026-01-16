import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";

export interface AuthSession {
	id: string;
	name: string;
	email: string | null;
	isAdmin: boolean;
	isTrusted: boolean;
}

export async function requireAuth(c: Context, next: Next) {
	const sessionCookie = getCookie(c, "session");

	if (!sessionCookie) {
		return c.json({ error: "Authentication required" }, 401);
	}

	try {
		const session: AuthSession = sessionCookie
			? JSON.parse(sessionCookie)
			: null;
		if (!session) {
			return c.json({ error: "Authentication required" }, 401);
		}
		c.set("session", session);
		await next();
	} catch (error) {
		console.error("[Middleware] Failed to parse session cookie:", error);
		return c.json({ error: "Invalid session" }, 401);
	}
}

export async function requireAdmin(c: Context, next: Next) {
	const sessionCookie = getCookie(c, "session");

	if (!sessionCookie) {
		return c.json({ error: "Authentication required" }, 401);
	}

	try {
		const session: AuthSession = sessionCookie
			? JSON.parse(sessionCookie)
			: null;

		if (!session || !session.isAdmin) {
			return c.json({ error: "Admin access required" }, 403);
		}

		c.set("session", session);
		await next();
	} catch (error) {
		console.error(
			"[Middleware] Failed to parse session cookie in requireAdmin:",
			error,
		);
		return c.json({ error: "Invalid session" }, 401);
	}
}
