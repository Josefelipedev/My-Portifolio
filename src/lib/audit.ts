// Audit Logging Service
// Records security-relevant events for compliance and debugging

import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { headers } from 'next/headers';

export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.failed'
  | 'auth.session_expired'
  | 'project.create'
  | 'project.update'
  | 'project.delete'
  | 'experience.create'
  | 'experience.update'
  | 'experience.delete'
  | 'settings.update'
  | 'ai.usage'
  | 'ai.quota_exceeded'
  | 'job.save'
  | 'job.apply'
  | 'job.delete'
  | 'contact.submit'
  | 'github.import'
  | 'skills.update'
  | 'security.csrf_failed'
  | 'security.rate_limited';

interface AuditOptions {
  userId?: string;
  resource?: string;
  details?: Prisma.InputJsonValue;
  success?: boolean;
  ip?: string;
  userAgent?: string;
}

/**
 * Anonymize IP address for privacy compliance
 * IPv4: zeros last octet (192.168.1.100 -> 192.168.1.0)
 * IPv6: keeps first 48 bits
 */
function anonymizeIP(ip: string): string {
  if (!ip || ip === 'unknown') {
    return 'unknown';
  }

  // IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 3) {
      return parts.slice(0, 3).join(':') + '::/48';
    }
    return ip;
  }

  // IPv4
  const parts = ip.split('.');
  if (parts.length === 4) {
    return parts.slice(0, 3).join('.') + '.0';
  }

  return ip;
}

/**
 * Get client IP from request headers
 */
async function getClientIP(): Promise<string> {
  try {
    const headersList = await headers();
    const forwarded = headersList.get('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    return headersList.get('x-real-ip') || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Get user agent from request headers
 */
async function getUserAgent(): Promise<string | undefined> {
  try {
    const headersList = await headers();
    return headersList.get('user-agent') || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Record an audit log entry
 */
export async function audit(action: AuditAction, options: AuditOptions = {}): Promise<void> {
  try {
    const ip = options.ip || (await getClientIP());
    const userAgent = options.userAgent || (await getUserAgent());

    await prisma.auditLog.create({
      data: {
        action,
        userId: options.userId,
        ip: anonymizeIP(ip),
        userAgent,
        resource: options.resource,
        details: options.details,
        success: options.success ?? true,
      },
    });
  } catch (error) {
    // Audit logging should never break the main flow
    console.error('Audit log failed:', error);
  }
}

/**
 * Record a successful login
 */
export async function auditLogin(userId: string, ip?: string): Promise<void> {
  await audit('auth.login', { userId, ip, success: true });
}

/**
 * Record a failed login attempt
 */
export async function auditLoginFailed(
  email: string,
  reason: string,
  ip?: string
): Promise<void> {
  await audit('auth.failed', {
    ip,
    details: { email, reason },
    success: false,
  });
}

/**
 * Record a logout
 */
export async function auditLogout(userId: string): Promise<void> {
  await audit('auth.logout', { userId, success: true });
}

/**
 * Record a resource modification
 */
export async function auditResourceChange(
  action: AuditAction,
  resourceType: string,
  resourceId: string,
  userId?: string,
  details?: Prisma.InputJsonValue
): Promise<void> {
  await audit(action, {
    userId,
    resource: `${resourceType}:${resourceId}`,
    details,
    success: true,
  });
}

/**
 * Record a security event
 */
export async function auditSecurityEvent(
  event: 'security.csrf_failed' | 'security.rate_limited',
  details?: Prisma.InputJsonValue
): Promise<void> {
  await audit(event, { details, success: false });
}

/**
 * Get recent audit logs
 */
export async function getRecentAuditLogs(
  limit: number = 100,
  filters?: {
    action?: AuditAction;
    userId?: string;
    success?: boolean;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<
  Array<{
    id: string;
    action: string;
    userId: string | null;
    ip: string;
    userAgent: string | null;
    resource: string | null;
    details: unknown;
    success: boolean;
    createdAt: Date;
  }>
> {
  const where: {
    action?: string;
    userId?: string;
    success?: boolean;
    createdAt?: { gte?: Date; lte?: Date };
  } = {};

  if (filters?.action) {
    where.action = filters.action;
  }
  if (filters?.userId) {
    where.userId = filters.userId;
  }
  if (filters?.success !== undefined) {
    where.success = filters.success;
  }
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.createdAt.lte = filters.endDate;
    }
  }

  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get audit summary for dashboard
 */
export async function getAuditSummary(
  days: number = 7
): Promise<{
  totalEvents: number;
  failedEvents: number;
  loginAttempts: number;
  failedLogins: number;
  resourceChanges: number;
  securityEvents: number;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [total, failed, logins, failedLogins, security] = await Promise.all([
    prisma.auditLog.count({
      where: { createdAt: { gte: startDate } },
    }),
    prisma.auditLog.count({
      where: { createdAt: { gte: startDate }, success: false },
    }),
    prisma.auditLog.count({
      where: { createdAt: { gte: startDate }, action: 'auth.login' },
    }),
    prisma.auditLog.count({
      where: { createdAt: { gte: startDate }, action: 'auth.failed' },
    }),
    prisma.auditLog.count({
      where: {
        createdAt: { gte: startDate },
        action: { startsWith: 'security.' },
      },
    }),
  ]);

  return {
    totalEvents: total,
    failedEvents: failed,
    loginAttempts: logins,
    failedLogins: failedLogins,
    resourceChanges: total - logins - failedLogins - security,
    securityEvents: security,
  };
}
