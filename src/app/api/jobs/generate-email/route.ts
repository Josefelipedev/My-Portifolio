import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import Together from 'together-ai';
import { trackAIUsage, estimateTokens, checkQuotaLimits } from '@/lib/ai-tracking';
import resumeData from '@/data/resume.json';

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

    const { jobTitle, company, description, jobUrl } = await request.json();

    if (!jobTitle || !company) {
      return NextResponse.json(
        { error: 'Job title and company are required' },
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

    // Get resume info
    const personalInfo = resumeData.personalInfo;
    const summary = resumeData.professionalSummary?.pt || resumeData.professionalSummary?.en || '';
    const skills = resumeData.skills?.map((s: { name: string }) => s.name).join(', ') || '';
    const experience = resumeData.experience?.map((e: { company: string; title: string }) => `${e.title} at ${e.company}`).join('; ') || '';

    const startTime = Date.now();
    const model = process.env.TOGETHER_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
    let inputTokens = 0;
    let outputTokens = 0;
    let success = true;
    let errorMessage: string | undefined;

    // Portfolio URL
    const portfolioUrl = 'https://portfolio.josefelipedev.com/';
    const linkedinUrl = personalInfo?.linkedin ? `https://linkedin.com/in/${personalInfo.linkedin}` : '';
    const githubUrl = personalInfo?.github ? `https://github.com/${personalInfo.github}` : '';

    try {
      const prompt = `Write a SHORT job application email in PORTUGUESE (Brazilian).

CANDIDATE INFO:
Name: ${personalInfo?.name || 'Jose Felipe'}
Portfolio: ${portfolioUrl}
LinkedIn: ${linkedinUrl}
GitHub: ${githubUrl}
Skills: ${skills}

JOB:
Position: ${jobTitle}
Company: ${company}

RULES - FOLLOW EXACTLY:
1. Start with greeting: "Boa tarde," or "Ola,"
2. MAXIMUM 5 LINES of text (not counting signature)
3. Be direct and professional
4. Mention 1-2 relevant skills only
5. End with "Atenciosamente," and the name

SIGNATURE FORMAT (always include):
Atenciosamente,
${personalInfo?.name || 'Jose Felipe'}
Portfolio: ${portfolioUrl}
LinkedIn: ${linkedinUrl}
GitHub: ${githubUrl}

Return ONLY JSON:
{
  "subject": "Candidatura: ${jobTitle} - ${personalInfo?.name || 'Jose Felipe'}",
  "body": "the short email body"
}`;

      const aiResponse = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7,
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

      const result = JSON.parse(jsonMatch[0]);

      return NextResponse.json({
        subject: result.subject,
        body: result.body,
      });
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      const latencyMs = Date.now() - startTime;

      trackAIUsage({
        feature: 'generate-email',
        model,
        inputTokens,
        outputTokens,
        latencyMs,
        success,
        error: errorMessage,
        metadata: { jobTitle, company },
      }).catch(() => {});
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
