// AI Usage Tracking Service
// Tracks Together AI API usage for cost monitoring

import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// Together AI pricing (per 1M tokens)
const PRICING: Record<string, { input: number; output: number }> = {
  'meta-llama/Llama-3.3-70B-Instruct-Turbo': {
    input: 0.88,
    output: 0.88,
  },
  // Add other models as needed
};

export type AIFeature =
  | 'job-extraction'
  | 'job-enrichment'
  | 'project-summary'
  | 'bio-generation'
  | 'readme-analysis'
  | 'skills-suggestion'
  | 'resume-analysis'
  | 'alert-suggestions'
  | 'wakatime-ranking'
  | 'generate-email';

interface TrackingParams {
  feature: AIFeature;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  error?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Calculate cost based on model and token usage
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING[model] || { input: 1, output: 1 };
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Estimate token count from text (1 token ≈ 4 characters)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Track AI API usage
 */
export async function trackAIUsage(params: TrackingParams): Promise<void> {
  try {
    const cost = calculateCost(params.model, params.inputTokens, params.outputTokens);

    await prisma.aIUsageLog.create({
      data: {
        feature: params.feature,
        model: params.model,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        totalTokens: params.inputTokens + params.outputTokens,
        cost,
        latencyMs: params.latencyMs,
        success: params.success,
        error: params.error,
        metadata: params.metadata,
      },
    });
  } catch (error) {
    // Log but don't fail the main operation
    console.error('Failed to track AI usage:', error);
  }
}

export interface UsageStats {
  total: {
    cost: number;
    tokens: number;
    requests: number;
  };
  daily: Array<{
    date: string;
    cost: number;
    tokens: number;
    requests: number;
  }>;
  byFeature: Array<{
    feature: string;
    cost: number;
    tokens: number;
    requests: number;
  }>;
  recentLogs: Array<{
    id: string;
    feature: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
    latencyMs: number;
    success: boolean;
    error: string | null;
    createdAt: Date;
  }>;
}

/**
 * Get usage statistics for a given period
 */
export async function getUsageStats(days: number = 7): Promise<UsageStats> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const [totalStats, featureStats, recentLogs] = await Promise.all([
    // Total stats
    prisma.aIUsageLog.aggregate({
      where: { createdAt: { gte: startDate } },
      _sum: { cost: true, totalTokens: true },
      _count: true,
    }),

    // By feature
    prisma.aIUsageLog.groupBy({
      by: ['feature'],
      where: { createdAt: { gte: startDate } },
      _sum: { cost: true, totalTokens: true },
      _count: true,
    }),

    // Recent logs
    prisma.aIUsageLog.findMany({
      where: { createdAt: { gte: startDate } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  // Get daily breakdown using raw query for date grouping
  const dailyStats = await prisma.$queryRaw<
    Array<{
      date: Date;
      cost: number;
      tokens: bigint;
      requests: bigint;
    }>
  >`
    SELECT
      DATE("createdAt") as date,
      COALESCE(SUM(cost), 0) as cost,
      COALESCE(SUM("totalTokens"), 0) as tokens,
      COUNT(*) as requests
    FROM "AIUsageLog"
    WHERE "createdAt" >= ${startDate}
    GROUP BY DATE("createdAt")
    ORDER BY date DESC
  `;

  return {
    total: {
      cost: totalStats._sum.cost || 0,
      tokens: totalStats._sum.totalTokens || 0,
      requests: totalStats._count,
    },
    daily: dailyStats.map((d) => ({
      date: d.date.toISOString().split('T')[0],
      cost: Number(d.cost),
      tokens: Number(d.tokens),
      requests: Number(d.requests),
    })),
    byFeature: featureStats.map((f) => ({
      feature: f.feature,
      cost: f._sum.cost || 0,
      tokens: f._sum.totalTokens || 0,
      requests: f._count,
    })),
    recentLogs,
  };
}

export interface QuotaStatus {
  withinLimits: boolean;
  dailyUsed: number;
  monthlyUsed: number;
  dailyLimit: number;
  monthlyLimit: number;
  dailyPercent: number;
  monthlyPercent: number;
  alertThreshold: number;
  shouldAlert: boolean;
}

/**
 * Check current quota status
 */
export async function checkQuotaLimits(): Promise<QuotaStatus> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [quota, dailyUsage, monthlyUsage] = await Promise.all([
    prisma.aIUsageQuota.findUnique({ where: { id: 'main' } }),
    prisma.aIUsageLog.aggregate({
      where: { createdAt: { gte: startOfDay } },
      _sum: { cost: true },
    }),
    prisma.aIUsageLog.aggregate({
      where: { createdAt: { gte: startOfMonth } },
      _sum: { cost: true },
    }),
  ]);

  const dailyLimit = quota?.dailyLimit ?? 5.0;
  const monthlyLimit = quota?.monthlyLimit ?? 50.0;
  const alertAt = quota?.alertAt ?? 0.8;
  const dailyUsed = dailyUsage._sum.cost || 0;
  const monthlyUsed = monthlyUsage._sum.cost || 0;

  const dailyPercent = dailyLimit > 0 ? (dailyUsed / dailyLimit) * 100 : 0;
  const monthlyPercent = monthlyLimit > 0 ? (monthlyUsed / monthlyLimit) * 100 : 0;

  return {
    withinLimits: dailyUsed < dailyLimit && monthlyUsed < monthlyLimit,
    dailyUsed,
    monthlyUsed,
    dailyLimit,
    monthlyLimit,
    dailyPercent,
    monthlyPercent,
    alertThreshold: alertAt * 100,
    shouldAlert: dailyPercent >= alertAt * 100 || monthlyPercent >= alertAt * 100,
  };
}

/**
 * Update quota limits
 */
export async function updateQuotaLimits(
  dailyLimit: number,
  monthlyLimit: number,
  alertAt: number = 0.8
): Promise<void> {
  await prisma.aIUsageQuota.upsert({
    where: { id: 'main' },
    update: { dailyLimit, monthlyLimit, alertAt },
    create: { id: 'main', dailyLimit, monthlyLimit, alertAt },
  });
}

/**
 * Get today's usage summary
 */
export async function getTodayUsage(): Promise<{
  cost: number;
  tokens: number;
  requests: number;
}> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const stats = await prisma.aIUsageLog.aggregate({
    where: { createdAt: { gte: startOfDay } },
    _sum: { cost: true, totalTokens: true },
    _count: true,
  });

  return {
    cost: stats._sum.cost || 0,
    tokens: stats._sum.totalTokens || 0,
    requests: stats._count,
  };
}

/**
 * Get this month's usage summary
 */
export async function getMonthUsage(): Promise<{
  cost: number;
  tokens: number;
  requests: number;
}> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const stats = await prisma.aIUsageLog.aggregate({
    where: { createdAt: { gte: startOfMonth } },
    _sum: { cost: true, totalTokens: true },
    _count: true,
  });

  return {
    cost: stats._sum.cost || 0,
    tokens: stats._sum.totalTokens || 0,
    requests: stats._count,
  };
}
