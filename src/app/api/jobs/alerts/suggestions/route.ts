import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { generateAlertSuggestions } from '@/lib/jobs/alert-suggestions';

export async function GET() {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const suggestions = await generateAlertSuggestions();

    return NextResponse.json({
      suggestions,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Alert suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
