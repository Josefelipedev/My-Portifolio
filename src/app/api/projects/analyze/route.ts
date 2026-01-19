import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { analyzeReadmeForProject } from '@/lib/claude';

export async function POST(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { readme, title, repoUrl } = data;

    if (!readme || typeof readme !== 'string') {
      return NextResponse.json(
        { error: 'README content is required' },
        { status: 400 }
      );
    }

    if (readme.trim().length < 50) {
      return NextResponse.json(
        { error: 'README content is too short (minimum 50 characters)' },
        { status: 400 }
      );
    }

    const analysis = await analyzeReadmeForProject(readme, title);

    return NextResponse.json({
      suggestedTitle: analysis.suggestedTitle,
      suggestedDescription: analysis.suggestedDescription,
      detectedTechnologies: analysis.detectedTechnologies,
      aiSummary: analysis.aiSummary,
      repoUrl: repoUrl || null,
    });
  } catch (err) {
    console.error('Error analyzing README:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to analyze README' },
      { status: 500 }
    );
  }
}
