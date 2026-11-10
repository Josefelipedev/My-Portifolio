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

// Page-view tracking (POST /visits) is public: cap it per IP so a script cannot
// inflate the stats or fill the PageView table. The store is bounded too, so
// many distinct IPs cannot grow it without limit.
const VISITS_MAX = 120;
const VISITS_WINDOW_MS = 60 * 60 * 1000;
const VISITS_MAX_TRACKED_IPS = 10_000;
const visitsStore = new Map<string, Entry>();

export function allowVisit(ip: string): boolean {
  const now = Date.now();
  const entry = visitsStore.get(ip);
  if (entry && now - entry.firstAttempt <= VISITS_WINDOW_MS) {
    if (entry.count >= VISITS_MAX) return false;
    entry.count += 1;
    return true;
  }

  visitsStore.delete(ip);
  if (visitsStore.size >= VISITS_MAX_TRACKED_IPS) {
    visitsStore.forEach((value, key) => {
      if (now - value.firstAttempt > VISITS_WINDOW_MS) visitsStore.delete(key);
    });
  }
  if (visitsStore.size >= VISITS_MAX_TRACKED_IPS) {
    // Still full of live entries: drop the oldest (Maps keep insertion order).
    const oldest = visitsStore.keys().next().value;
    if (oldest !== undefined) visitsStore.delete(oldest);
  }
  visitsStore.set(ip, { count: 1, firstAttempt: now });
  return true;
}

/**
 * Extract the client IP. Prod sits behind Cloudflare, which overwrites
 * CF-Connecting-IP with the real client address. The FIRST X-Forwarded-For
 * entry is client-controlled (Cloudflare appends to it), so it must never key
 * a rate limit — fall back to the LAST entry, added by the nearest proxy.
 */
export function getClientIp(headers: { get(name: string): string | null }): string {
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',').pop()!.trim() || 'unknown';
  return 'unknown';
}
