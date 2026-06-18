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
