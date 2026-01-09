import { Hono } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import { db } from './db';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';
import { feishuClient } from './feishu';

const auth = new Hono();

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(email => email.trim()).filter(Boolean);

// Get the login URL for frontend to redirect
auth.get('/login-url', (c) => {
  const appId = process.env.FEISHU_APP_ID;
  const redirectUri = encodeURIComponent(process.env.REDIRECT_URI || 'http://localhost:5173/auth/callback');
  const state = crypto.randomUUID();

  // Store state in cookie for CSRF protection
  setCookie(c, 'oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600, // 10 minutes
    sameSite: 'Lax',
  });

  const loginUrl = `https://open.feishu.cn/open-apis/authen/v1/index?app_id=${appId}&redirect_uri=${redirectUri}&state=${state}`;

  return c.json({ loginUrl });
});

// Handle OAuth callback
auth.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const storedState = getCookie(c, 'oauth_state');

  // Verify state for CSRF protection
  if (!state || state !== storedState) {
    return c.json({ error: 'Invalid state parameter' }, 400);
  }

  if (!code) {
    return c.json({ error: 'No code provided' }, 400);
  }

  try {
    // Exchange code for user access token and user info
    const userData = await feishuClient.getUserAccessToken(code);

    // Check if user exists, otherwise create
    let user = await db.query.users.findFirst({
      where: eq(users.feishuUserId, userData.open_id),
    });

    const isAdmin = ADMIN_EMAILS.includes(userData.email || '');

    if (!user) {
      // Create new user
      const result = await db.insert(users).values({
        name: userData.name,
        feishuUserId: userData.open_id,
        email: userData.email || null,
        isAdmin,
      }).returning();
      user = result[0];
    } else {
      // Update user info (in case name or admin status changed)
      const result = await db.update(users)
        .set({
          name: userData.name,
          email: userData.email || user.email,
          isAdmin,
        })
        .where(eq(users.id, user.id))
        .returning();
      user = result[0];
    }

    // Set session cookie
    setCookie(c, 'session', JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      personalToken: user.personalToken,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: 'Lax',
    });

    return c.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
});

// Get current user from session
auth.get('/me', (c) => {
  const sessionCookie = getCookie(c, 'session');

  if (!sessionCookie) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const session = sessionCookie ? JSON.parse(sessionCookie) : null;
    if (!session) {
      return c.json({ error: 'Not authenticated' }, 401);
    }
    // Normalize user object to ensure id is present (handle legacy session with userId)
    const user = {
      ...session,
      id: session.id || session.userId,
    };
    return c.json({ user });
  } catch (error) {
    console.error('[Auth] Failed to parse session cookie:', error);
    return c.json({ error: 'Invalid session' }, 401);
  }
});

// Logout
auth.post('/logout', (c) => {
  setCookie(c, 'session', '', {
    maxAge: 0,
  });
  return c.json({ success: true });
});

export default auth;
