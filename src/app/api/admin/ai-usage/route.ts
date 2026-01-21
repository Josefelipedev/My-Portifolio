import { NextResponse } from 'next/server';
import {
  getUsageStats,
  checkQuotaLimits,
  updateQuotaLimits,
  getTodayUsage,
  getMonthUsage,
} from '@/lib/ai-tracking';

// GET /api/admin/ai-usage - Get usage stats
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7', 10);

    const [stats, quota, today, month] = await Promise.all([
      getUsageStats(days),
      checkQuotaLimits(),
      getTodayUsage(),
      getMonthUsage(),
    ]);

    return NextResponse.json({
      stats,
      quota,
      today,
      month,
    });
  } catch (error) {
    console.error('AI usage API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI usage stats' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/ai-usage - Update quota limits
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { dailyLimit, monthlyLimit, alertAt } = body;

    // Validate inputs
    if (typeof dailyLimit !== 'number' || dailyLimit < 0) {
      return NextResponse.json(
        { error: 'Invalid daily limit' },
        { status: 400 }
      );
    }

    if (typeof monthlyLimit !== 'number' || monthlyLimit < 0) {
      return NextResponse.json(
        { error: 'Invalid monthly limit' },
        { status: 400 }
      );
    }

    const alertThreshold = typeof alertAt === 'number' ? alertAt : 0.8;
    if (alertThreshold < 0 || alertThreshold > 1) {
      return NextResponse.json(
        { error: 'Alert threshold must be between 0 and 1' },
        { status: 400 }
      );
    }

    await updateQuotaLimits(dailyLimit, monthlyLimit, alertThreshold);

    return NextResponse.json({
      success: true,
      message: 'Quota limits updated successfully',
    });
  } catch (error) {
    console.error('AI usage API error:', error);
    return NextResponse.json(
      { error: 'Failed to update quota limits' },
      { status: 500 }
    );
  }
}
