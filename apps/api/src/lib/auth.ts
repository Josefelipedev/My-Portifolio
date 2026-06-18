// Auth for the API service — ported from the web app's session validation
// (src/lib/auth-service.ts validateSession). Verifies the auth_token JWT and
// confirms the session is still valid in the DB. Exposes a Hono middleware
// `requireAuth` that 401s unless a valid session cookie is present and stashes
// the userId on the context.

import { jwtVerify } from 'jose';
import { getCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono';
import prisma from '../db';

export interface SessionResult {
  valid: boolean;
  userId?: string;
}

/** JWT signature check + DB session lookup (isValid + not expired). */
export async function validateSession(jwt: string): Promise<SessionResult> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(jwt, secret);
    const { userId, sessionToken } = payload as { userId?: string; sessionToken?: string };
    if (!userId || !sessionToken) return { valid: false };

    const session = await prisma.session.findFirst({
      where: {
        userId,
        token: sessionToken,
        isValid: true,
        expiresAt: { gt: new Date() },
      },
    });
    return session ? { valid: true, userId } : { valid: false };
  } catch {
    return { valid: false };
  }
}

export type AuthEnv = { Variables: { userId: string } };

/** Hono middleware: reject with 401 unless a valid session cookie is present. */
export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const token = getCookie(c, 'auth_token');
  if (!token) {
    return c.json({ error: 'Não autorizado', code: 'UNAUTHORIZED' }, 401);
  }
  const result = await validateSession(token);
  if (!result.valid || !result.userId) {
    return c.json({ error: 'Sessão expirada', code: 'UNAUTHORIZED' }, 401);
  }
  c.set('userId', result.userId);
  await next();
};
