// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  verificationCode: { findFirst: vi.fn(), updateMany: vi.fn() },
  loginHistory: { create: vi.fn(), count: vi.fn() },
}));
vi.mock('../../../apps/api/src/db', () => ({ default: db }));
vi.mock('../../../apps/api/src/lib/email', () => ({ sendVerificationCode: vi.fn(), sendLoginAlert: vi.fn() }));

import { getClientIp } from '../../../apps/api/src/lib/rate-limit';
import { verifyCodeAndCreateSession } from '../../../apps/api/src/lib/auth-service';

const headers = (h: Record<string, string>) => new Headers(h);

describe('getClientIp', () => {
  it('prefers CF-Connecting-IP over a spoofed X-Forwarded-For', () => {
    expect(getClientIp(headers({ 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '1.2.3.4, 203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('uses the proxy-appended (last) X-Forwarded-For entry, not the client-supplied first one', () => {
    expect(getClientIp(headers({ 'x-forwarded-for': '1.2.3.4, 198.51.100.9' }))).toBe('198.51.100.9');
  });

  it('falls back to unknown', () => {
    expect(getClientIp(headers({}))).toBe('unknown');
  });
});

describe('verification code brute force', () => {
  const req = { ipAddress: '203.0.113.7', userAgent: 'test' };
  const pending = { id: 'c1', createdAt: new Date() };

  beforeEach(() => {
    vi.clearAllMocks();
    // First findFirst = the code lookup (miss); second = the pending code.
    db.verificationCode.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(pending);
  });

  it('keeps the pending code while under the attempt cap', async () => {
    db.loginHistory.count.mockResolvedValue(4);
    const res = await verifyCodeAndCreateSession('u1', '000000', req);
    expect(res.success).toBe(false);
    expect(db.verificationCode.updateMany).not.toHaveBeenCalled();
  });

  it('burns the pending code after 5 wrong guesses', async () => {
    db.loginHistory.count.mockResolvedValue(5);
    await verifyCodeAndCreateSession('u1', '000000', req);
    expect(db.verificationCode.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', type: 'login', isUsed: false },
      data: { isUsed: true },
    });
  });
});
