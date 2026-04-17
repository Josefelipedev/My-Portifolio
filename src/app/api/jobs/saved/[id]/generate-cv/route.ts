import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { generateCustomCV } from '@/lib/jobs/cv-generator';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const customCV = await generateCustomCV(id);

    return NextResponse.json({ success: true, customCV });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('quota') ? 429
      : message.includes('not found') ? 404
      : message.includes('not configured') ? 503
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
