// CSRF Protection
// Implements double-submit cookie pattern

import { cookies } from 'next/headers';
import { randomBytes, timingSafeEqual } from 'crypto';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  return randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Set CSRF cookie and return the token
 */
export async function setCSRFCookie(): Promise<string> {
  const token = generateCSRFToken();
  const cookieStore = await cookies();

  cookieStore.set(CSRF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return token;
}

/**
 * Get CSRF token from cookie
 */
export async function getCSRFToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_COOKIE)?.value || null;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Validate CSRF token from request
 */
export async function validateCSRFToken(request: Request): Promise<boolean> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get(CSRF_HEADER);

  // Both tokens must exist
  if (!cookieToken || !headerToken) {
    return false;
  }

  // Token must be the expected length
  if (cookieToken.length !== TOKEN_LENGTH * 2 || headerToken.length !== TOKEN_LENGTH * 2) {
    return false;
  }

  // Constant-time comparison
  return safeCompare(cookieToken, headerToken);
}

/**
 * Middleware helper to check CSRF for state-changing requests
 */
export async function requireCSRF(request: Request): Promise<Response | null> {
  const method = request.method.toUpperCase();

  // CSRF only needed for state-changing methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return null;
  }

  const isValid = await validateCSRFToken(request);
  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Invalid CSRF token' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null;
}

/**
 * API routes that need CSRF protection
 */
export const CSRF_PROTECTED_ROUTES = [
  '/api/projects',
  '/api/experiences',
  '/api/github/import',
  '/api/summarize',
  '/api/skills',
  '/api/contact',
  '/api/config',
  '/api/admin',
];

/**
 * Check if a route needs CSRF protection
 */
export function routeNeedsCSRF(pathname: string): boolean {
  return CSRF_PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
}
