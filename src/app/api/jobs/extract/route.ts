import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import Together from 'together-ai';
import { trackAIUsage, estimateTokens, checkQuotaLimits } from '@/lib/ai-tracking';

function getTogetherClient(): Together | null {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) return null;
  return new Together({ apiKey });
}

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text } = await request.json();

    if (!text || text.trim().length < 20) {
      return NextResponse.json(
        { error: 'Please provide job information text (minimum 20 characters)' },
        { status: 400 }
      );
    }

    // Check quota
    const quotaCheck = await checkQuotaLimits();
    if (!quotaCheck.withinLimits) {
      return NextResponse.json(
        { error: 'AI quota exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    const client = getTogetherClient();
    if (!client) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      );
    }

    const startTime = Date.now();
    const model = process.env.TOGETHER_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
    let inputTokens = 0;
    let outputTokens = 0;
    let success = true;
    let errorMessage: string | undefined;

    try {
      const prompt = `Extract job information from this text and return ONLY valid JSON.

TEXT:
${text.substring(0, 3000)}

Extract and return this JSON structure (use null for fields not found):
{
  "title": "job title/position",
  "company": "company name",
  "description": "full job description (keep original formatting)",
  "location": "location or 'Remote' if remote",
  "salary": "salary if mentioned",
  "jobType": "Full-time, Part-time, Contract, Freelance, or Internship",
  "tags": "comma-separated skills/technologies mentioned",
  "url": "URL if present in text"
}

Return ONLY the JSON, no other text.`;

      const aiResponse = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.3,
      });

      inputTokens = aiResponse.usage?.prompt_tokens || estimateTokens(prompt);
      outputTokens = aiResponse.usage?.completion_tokens || 0;

      const content = aiResponse.choices[0]?.message?.content?.trim() || '{}';
      outputTokens = outputTokens || estimateTokens(content);

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const extracted = JSON.parse(jsonMatch[0]);

      // Clean up the extracted data
      const result = {
        title: extracted.title || null,
        company: extracted.company || null,
        description: extracted.description || text.substring(0, 2000),
        location: extracted.location || null,
        salary: extracted.salary || null,
        jobType: extracted.jobType || null,
        tags: extracted.tags || null,
        url: extracted.url || null,
      };

      return NextResponse.json(result);
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      const latencyMs = Date.now() - startTime;

      trackAIUsage({
        feature: 'job-extraction',
        model,
        inputTokens,
        outputTokens,
        latencyMs,
        success,
        error: errorMessage,
        metadata: { textLength: text.length },
      }).catch(() => {});
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
