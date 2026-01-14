import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkRateLimit,
  recordAttempt,
  RateLimitConfigs,
  checkLoginRateLimit,
  recordLoginAttempt,
  getClientIP,
} from '@/lib/rate-limit';

describe('Rate Limiter', () => {
  beforeEach(() => {
    // Reset the stores between tests by using different identifiers
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkRateLimit', () => {
    it('should allow first request', () => {
      const result = checkRateLimit('new-ip-1', 'test', {
        maxAttempts: 5,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });

    it('should track attempts correctly', () => {
      const config = { maxAttempts: 3, windowMs: 60000 };
      const ip = 'track-ip-' + Date.now();

      // Record 2 attempts
      recordAttempt(ip, 'test', config);
      recordAttempt(ip, 'test', config);

      const result = checkRateLimit(ip, 'test', config);
      expect(result.remaining).toBe(1);
      expect(result.allowed).toBe(true);
    });

    it('should block after max attempts', () => {
      const config = { maxAttempts: 2, windowMs: 60000 };
      const ip = 'block-ip-' + Date.now();

      recordAttempt(ip, 'test', config);
      recordAttempt(ip, 'test', config);

      const result = checkRateLimit(ip, 'test', config);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset after window expires', () => {
      const config = { maxAttempts: 2, windowMs: 1000 };
      const ip = 'reset-ip-' + Date.now();

      recordAttempt(ip, 'test', config);
      recordAttempt(ip, 'test', config);

      // Advance time past the window
      vi.advanceTimersByTime(1500);

      const result = checkRateLimit(ip, 'test', config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });
  });

  describe('Login rate limit', () => {
    it('should use login configuration', () => {
      const ip = 'login-ip-' + Date.now();
      const result = checkLoginRateLimit(ip);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(RateLimitConfigs.login.maxAttempts);
    });

    it('should reset on successful login', () => {
      const ip = 'success-ip-' + Date.now();

      // Record failed attempts
      recordLoginAttempt(ip, false);
      recordLoginAttempt(ip, false);

      // Successful login should reset
      recordLoginAttempt(ip, true);

      const result = checkLoginRateLimit(ip);
      expect(result.remaining).toBe(RateLimitConfigs.login.maxAttempts);
    });
  });

  describe('getClientIP', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const request = new Request('http://test.com', {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        },
      });

      expect(getClientIP(request)).toBe('192.168.1.1');
    });

    it('should fall back to x-real-ip', () => {
      const request = new Request('http://test.com', {
        headers: {
          'x-real-ip': '192.168.1.2',
        },
      });

      expect(getClientIP(request)).toBe('192.168.1.2');
    });

    it('should return unknown if no IP headers', () => {
      const request = new Request('http://test.com');
      expect(getClientIP(request)).toBe('unknown');
    });
  });
});
