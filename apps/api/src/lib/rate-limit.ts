// Minimal in-memory rate limiter for the API service, ported from the web
// app's src/lib/rate-limit.ts (contact context: 5 attempts / hour). In-memory
// is fine because contact moves to this single service after the split.

interface Entry {
  count: number;
  firstAttempt: number;
}

const CONTACT_MAX = 5;
const CONTACT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const contactStore = new Map<string, Entry>();

// Login context: 5 attempts / 15 min, then a 30 min block (RateLimitConfigs.login).
interface LoginEntry {
  count: number;
  firstAttempt: number;
  blockedUntil: number;
}
const LOGIN_MAX = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 30 * 60 * 1000;
const loginStore = new Map<string, LoginEntry>();

export function checkLoginRateLimit(ip: string): { allowed: boolean; blockedFor?: number } {
  const now = Date.now();
  const entry = loginStore.get(ip);
  if (!entry) return { allowed: true };
  if (entry.blockedUntil > now) {
    return { allowed: false, blockedFor: Math.ceil((entry.blockedUntil - now) / 60000) };
  }
  if (now - entry.firstAttempt > LOGIN_WINDOW_MS) return { allowed: true };
  return { allowed: entry.count < LOGIN_MAX };
}

export function recordLoginAttempt(ip: string, success = false): void {
  const now = Date.now();
  if (success) {
    loginStore.delete(ip);
    return;
  }
  const entry = loginStore.get(ip);
  if (!entry || now - entry.firstAttempt > LOGIN_WINDOW_MS) {
    loginStore.set(ip, { count: 1, firstAttempt: now, blockedUntil: 0 });
    return;
  }
  entry.count += 1;
  if (entry.count >= LOGIN_MAX) entry.blockedUntil = now + LOGIN_BLOCK_MS;
  loginStore.set(ip, entry);
}

export function checkContactRateLimit(ip: string): { allowed: boolean } {
  const now = Date.now();
  const entry = contactStore.get(ip);
  if (!entry || now - entry.firstAttempt > CONTACT_WINDOW_MS) {
    return { allowed: true };
  }
  return { allowed: entry.count < CONTACT_MAX };
}

export function recordContactAttempt(ip: string): void {
  const now = Date.now();
  const entry = contactStore.get(ip);
  if (!entry || now - entry.firstAttempt > CONTACT_WINDOW_MS) {
    contactStore.set(ip, { count: 1, firstAttempt: now });
    return;
  }
  entry.count += 1;
  contactStore.set(ip, entry);
}

/** Extract the client IP from forwarding headers (parity with the web helper). */
export function getClientIp(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip') || 'unknown';
}
