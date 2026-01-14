// Unified rate limiter for all endpoints
// In-memory implementation - consider Redis for production with multiple instances

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  blockedUntil: number;
}

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs?: number;
}

// Separate stores for different rate limit contexts
const stores = new Map<string, Map<string, RateLimitEntry>>();

// Predefined configurations for common use cases
export const RateLimitConfigs = {
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 30 * 60 * 1000, // 30 minutes block
  },
  contact: {
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  api: {
    maxAttempts: 100,
    windowMs: 60 * 1000, // 1 minute
  },
} as const;

function getStore(context: string): Map<string, RateLimitEntry> {
  if (!stores.has(context)) {
    stores.set(context, new Map());
  }
  return stores.get(context)!;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn?: number; // seconds until reset
  blockedFor?: number; // minutes blocked (if blocked)
}

export function checkRateLimit(
  identifier: string,
  context: string,
  config: RateLimitConfig
): RateLimitResult {
  const store = getStore(context);
  const now = Date.now();
  const entry = store.get(identifier);

  // No previous attempts
  if (!entry) {
    return { allowed: true, remaining: config.maxAttempts };
  }

  // Check if currently blocked
  if (config.blockDurationMs && entry.blockedUntil > now) {
    const blockedFor = Math.ceil((entry.blockedUntil - now) / 1000 / 60);
    return { allowed: false, remaining: 0, blockedFor };
  }

  // Reset if window has passed
  if (now - entry.firstAttempt > config.windowMs) {
    store.delete(identifier);
    return { allowed: true, remaining: config.maxAttempts };
  }

  // Check remaining attempts
  const remaining = config.maxAttempts - entry.count;
  const resetIn = Math.ceil((entry.firstAttempt + config.windowMs - now) / 1000);

  return {
    allowed: remaining > 0,
    remaining: Math.max(0, remaining),
    resetIn,
  };
}

export function recordAttempt(
  identifier: string,
  context: string,
  config: RateLimitConfig,
  success: boolean = false
): void {
  const store = getStore(context);
  const now = Date.now();

  // If success and we want to reset on success (like successful login)
  if (success) {
    store.delete(identifier);
    return;
  }

  const entry = store.get(identifier);

  if (!entry) {
    store.set(identifier, {
      count: 1,
      firstAttempt: now,
      blockedUntil: 0,
    });
    return;
  }

  // Reset if window passed
  if (now - entry.firstAttempt > config.windowMs) {
    store.set(identifier, {
      count: 1,
      firstAttempt: now,
      blockedUntil: 0,
    });
    return;
  }

  entry.count += 1;

  // Block if max attempts exceeded and blocking is configured
  if (config.blockDurationMs && entry.count >= config.maxAttempts) {
    entry.blockedUntil = now + config.blockDurationMs;
  }

  store.set(identifier, entry);
}

// Helper to get client IP from request
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

// Cleanup old entries - call periodically (e.g., every hour)
export function cleanupOldEntries(): void {
  const now = Date.now();

  Array.from(stores.entries()).forEach(([context, store]) => {
    const config = RateLimitConfigs[context as keyof typeof RateLimitConfigs];
    if (!config) return;

    Array.from(store.entries()).forEach(([id, entry]) => {
      const isExpired = now - entry.firstAttempt > config.windowMs;
      const isUnblocked = entry.blockedUntil < now;

      if (isExpired && isUnblocked) {
        store.delete(id);
      }
    });
  });
}

// Convenience functions for common use cases
export function checkLoginRateLimit(ip: string): RateLimitResult {
  return checkRateLimit(ip, 'login', RateLimitConfigs.login);
}

export function recordLoginAttempt(ip: string, success: boolean = false): void {
  recordAttempt(ip, 'login', RateLimitConfigs.login, success);
}

export function checkContactRateLimit(ip: string): RateLimitResult {
  return checkRateLimit(ip, 'contact', RateLimitConfigs.contact);
}

export function recordContactAttempt(ip: string): void {
  recordAttempt(ip, 'contact', RateLimitConfigs.contact);
}
