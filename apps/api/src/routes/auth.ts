// Auth endpoints — ported from the web app's src/app/api/{csrf, auth/login,
// auth/verify, logout}. Public (the login flow itself), so no requireAuth.
// These are what the admin frontend calls to obtain a CSRF token and a session
// against the standalone API.

import { Hono } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import { issueCsrfToken } from '../lib/csrf';
import { honoCookieOptions } from '../lib/cookies';
import { initiateLogin, verifyCodeAndCreateSession, logout } from '../lib/auth-service';
import { checkLoginRateLimit, recordLoginAttempt, getClientIp } from '../lib/rate-limit';

const auth = new Hono();

// GET /api/csrf — issue or reuse the double-submit CSRF token.
auth.get('/csrf', (c) => c.json({ csrfToken: issueCsrfToken(c) }));
// POST /api/csrf — force a fresh token (parity with the web route).
auth.post('/csrf', (c) => c.json({ csrfToken: issueCsrfToken(c) }));

// POST /api/auth/login — email+password; dev mode creates a session directly,
// prod mode emails a verification code.
auth.post('/auth/login', async (c) => {
  const ip = getClientIp(c.req.raw.headers);
  const rateLimit = checkLoginRateLimit(ip);
  if (!rateLimit.allowed) {
    return c.json({ error: `Muitas tentativas. Tente novamente em ${rateLimit.blockedFor} minutos.`, blocked: true }, 429);
  }

  const { email, password } = (await c.req.json().catch(() => ({}))) as { email?: string; password?: string };
  if (!email || typeof email !== 'string') return c.json({ error: 'Email é obrigatório' }, 400);
  if (!password || typeof password !== 'string') return c.json({ error: 'Senha é obrigatória' }, 400);
  if (password.length > 100) return c.json({ error: 'Senha inválida' }, 400);

  const userAgent = c.req.header('user-agent') || 'Unknown';
  const result = await initiateLogin(email, password, { ipAddress: ip, userAgent });

  if (!result.success) {
    recordLoginAttempt(ip, false);
    return c.json({ error: result.error }, 401);
  }

  if (result.token && !result.requiresVerification) {
    // Dev mode: session created directly — set the auth cookie.
    setCookie(c, 'auth_token', result.token, honoCookieOptions({ secure: false, sameSite: 'lax', maxAge: 14 * 24 * 60 * 60 }));
    return c.json({ success: true, message: 'Login realizado com sucesso (modo desenvolvimento)', userId: result.userId, requiresVerification: false });
  }

  return c.json({ success: true, message: 'Código de verificação enviado para seu email', userId: result.userId, requiresVerification: true });
});

// POST /api/auth/verify — verify the emailed code and create the session.
auth.post('/auth/verify', async (c) => {
  const ip = getClientIp(c.req.raw.headers);
  const rateLimit = checkLoginRateLimit(ip);
  if (!rateLimit.allowed) {
    return c.json({ error: `Muitas tentativas. Tente novamente em ${rateLimit.blockedFor} minutos.`, blocked: true }, 429);
  }

  const { userId, code } = (await c.req.json().catch(() => ({}))) as { userId?: string; code?: string };
  if (!userId || typeof userId !== 'string') return c.json({ error: 'Sessão inválida' }, 400);
  if (!code || typeof code !== 'string' || code.length !== 6) return c.json({ error: 'Código inválido' }, 400);

  const userAgent = c.req.header('user-agent') || 'Unknown';
  const result = await verifyCodeAndCreateSession(userId, code, { ipAddress: ip, userAgent });

  if (!result.success || !result.token) {
    recordLoginAttempt(ip, false);
    return c.json({ error: result.error }, 401);
  }

  recordLoginAttempt(ip, true);
  setCookie(c, 'auth_token', result.token, honoCookieOptions({ secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 14 * 24 * 60 * 60 }));
  return c.json({ success: true });
});

// POST /api/logout — invalidate the session and clear the cookie.
auth.post('/logout', async (c) => {
  const token = getCookie(c, 'auth_token');
  if (token) await logout(token);
  setCookie(c, 'auth_token', '', honoCookieOptions({ secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 0 }));
  return c.json({ message: 'Logout realizado com sucesso' });
});

export default auth;
