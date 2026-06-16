import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { error, success } from '@/lib/api-utils';
import { processKnowledgeSource } from '@/lib/knowledge';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const result = await processKnowledgeSource(id);
    return success({ result });
  } catch (err) {
    return error(err);
  }
}
