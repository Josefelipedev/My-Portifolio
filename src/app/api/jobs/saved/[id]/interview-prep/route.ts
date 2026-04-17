import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import Together from 'together-ai';
import { trackAIUsage, estimateTokens, checkQuotaLimits } from '@/lib/ai-tracking';
import prisma from '@/lib/prisma';
import resumeData from '@/data/resume.json';

function getTogetherClient(): Together | null {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) return null;
  return new Together({ apiKey });
}

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

    const savedJob = await prisma.savedJob.findUnique({ where: { id } });
    if (!savedJob) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const quotaCheck = await checkQuotaLimits();
    if (!quotaCheck.withinLimits) {
      return NextResponse.json({ error: 'AI quota exceeded. Please try again later.' }, { status: 429 });
    }

    const client = getTogetherClient();
    if (!client) {
      return NextResponse.json({ error: 'AI service not configured.' }, { status: 503 });
    }

    const topSkills = resumeData.skills
      .sort((a, b) => b.level - a.level)
      .slice(0, 10)
      .map((s) => s.name)
      .join(', ');

    const recentExp = resumeData.experience
      .slice(0, 3)
      .map((e) => `${e.title} at ${e.company}: ${e.responsibilities.slice(0, 2).join('; ')}`)
      .join('\n');

    const model = process.env.TOGETHER_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    let success = true;
    let errorMessage: string | undefined;

    try {
      const prompt = `You are an expert interview coach. Prepare this developer for an upcoming interview.

CANDIDATE:
- Skills: ${topSkills}
- Recent Experience:
${recentExp}

JOB:
- Title: ${savedJob.title}
- Company: ${savedJob.company}
- Location: ${savedJob.location || 'Not specified'}
- Salary: ${savedJob.salary || 'Not specified'}
- Description (first 1200 chars): ${(savedJob.description || '').substring(0, 1200)}

Generate comprehensive interview preparation and return ONLY a JSON object:

{
  "starStories": [
    {
      "question": "Behavioral question relevant to this job",
      "situation": "Specific situation from candidate's experience",
      "task": "What the candidate was responsible for",
      "action": "Specific actions taken using their skills",
      "result": "Quantifiable or specific result achieved"
    }
  ],
  "technicalTopics": [
    {
      "topic": "Technical topic likely to come up",
      "relevance": "Why this is likely given the job description",
      "tip": "Quick tip to prepare for this"
    }
  ],
  "salaryScript": {
    "opening": "How to open the salary conversation",
    "anchor": "Specific anchor range to state (research-based for this location and level)",
    "justification": "How to justify the ask with experience",
    "flexibility": "How to handle negotiation"
  },
  "keyQuestions": [
    "Smart question to ask the interviewer about this role/company"
  ]
}

Requirements:
- Generate 5 STAR stories using the candidate's actual experience
- Generate 5 technical topics based on the job's tags/description
- Make the salary script specific to ${savedJob.location || 'Europe/Remote'} market
- Generate 3 key questions to ask the interviewer
- All in English
- Return ONLY the JSON, no markdown or explanation`;

      const aiResponse = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000,
        temperature: 0.5,
      });

      inputTokens = aiResponse.usage?.prompt_tokens || estimateTokens(prompt);
      outputTokens = aiResponse.usage?.completion_tokens || 0;

      const content = aiResponse.choices[0]?.message?.content?.trim() || '{}';
      outputTokens = outputTokens || estimateTokens(content);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in AI response');

      const prep = JSON.parse(jsonMatch[0]);

      await prisma.savedJob.update({
        where: { id },
        data: { interviewPrep: JSON.stringify(prep) },
      });

      return NextResponse.json({ success: true, prep });
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      const latencyMs = Date.now() - startTime;
      trackAIUsage({
        feature: 'interview-prep',
        model,
        inputTokens,
        outputTokens,
        latencyMs,
        success,
        error: errorMessage,
        metadata: { jobId: id, company: savedJob.company },
      }).catch(() => {});
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
