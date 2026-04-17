// AI Job Analysis — shared logic used by single and batch routes
import Together from 'together-ai';
import { trackAIUsage, estimateTokens, checkQuotaLimits } from '@/lib/ai-tracking';
import prisma from '@/lib/prisma';

export interface AIJobAnalysis {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  skillFitPercent: number;
  salaryAssessment: string;
  seniorityMatch: string;
  applicationTip: string;
  strengths: string[];
  gaps: string[];
}

interface ResumeSkill {
  name: string;
  level: number;
  category: string;
}

interface ResumeExperience {
  title: string;
  company: string;
  responsibilities: string[];
}

interface ResumeData {
  personalInfo: { name: string };
  professionalSummary: { en: string };
  skills: ResumeSkill[];
  experience: ResumeExperience[];
}

function getTogetherClient(): Together | null {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) return null;
  return new Together({ apiKey });
}

export async function analyzeJob(savedJobId: string): Promise<AIJobAnalysis> {
  const savedJob = await prisma.savedJob.findUnique({ where: { id: savedJobId } });
  if (!savedJob) throw new Error('Job not found');

  const quotaCheck = await checkQuotaLimits();
  if (!quotaCheck.withinLimits) throw new Error('AI quota exceeded. Please try again later.');

  const client = getTogetherClient();
  if (!client) throw new Error('AI service not configured. Set TOGETHER_API_KEY.');

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const resume: ResumeData = require('@/data/resume.json');

  const topSkills = resume.skills
    .sort((a, b) => b.level - a.level)
    .slice(0, 15)
    .map((s) => `${s.name} (level ${s.level}/5)`)
    .join(', ');

  const recentExp = resume.experience
    .slice(0, 3)
    .map((e) => `${e.title} at ${e.company}`)
    .join('; ');

  const model = process.env.TOGETHER_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
  const startTime = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;
  let success = true;
  let errorMessage: string | undefined;

  try {
    const prompt = `You are an expert career coach analyzing a job opportunity for a developer.

CANDIDATE PROFILE:
- Name: ${resume.personalInfo.name}
- Summary: ${resume.professionalSummary.en}
- Top Skills: ${topSkills}
- Recent Experience: ${recentExp}

JOB OPPORTUNITY:
- Title: ${savedJob.title}
- Company: ${savedJob.company}
- Location: ${savedJob.location || 'Not specified'}
- Salary: ${savedJob.salary || 'Not specified'}
- Tags/Tech: ${savedJob.tags || 'Not specified'}
- Description (first 2000 chars): ${(savedJob.description || '').substring(0, 2000)}

Analyze this job for this specific candidate and return ONLY a JSON object (no other text):

{
  "grade": "B",
  "skillFitPercent": 75,
  "salaryAssessment": "Brief salary vs market assessment for this location",
  "seniorityMatch": "Brief assessment of seniority alignment",
  "applicationTip": "One specific actionable tip to improve application chances",
  "strengths": ["Strength 1 specific to this job", "Strength 2", "Strength 3"],
  "gaps": ["Gap 1 if any", "Gap 2 if any"]
}

Grade criteria:
- A: Excellent fit (85%+ skills, good salary, right seniority)
- B: Good fit (65-84% skills match)
- C: Moderate fit (45-64% skills match or seniority mismatch)
- D: Poor fit (<45% skills or major gaps)
- F: Not suitable (completely wrong role/level)

Return ONLY the JSON, no markdown, no explanation.`;

    const aiResponse = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.3,
    });

    inputTokens = aiResponse.usage?.prompt_tokens || estimateTokens(prompt);
    outputTokens = aiResponse.usage?.completion_tokens || 0;

    const content = aiResponse.choices[0]?.message?.content?.trim() || '{}';
    outputTokens = outputTokens || estimateTokens(content);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in AI response');

    const analysis = JSON.parse(jsonMatch[0]) as AIJobAnalysis;

    // Persist to DB
    await prisma.savedJob.update({
      where: { id: savedJobId },
      data: {
        aiGrade: analysis.grade,
        aiAnalysis: JSON.stringify(analysis),
        aiAnalyzedAt: new Date(),
      },
    });

    return analysis;
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw error;
  } finally {
    const latencyMs = Date.now() - startTime;
    trackAIUsage({
      feature: 'job-analysis',
      model,
      inputTokens,
      outputTokens,
      latencyMs,
      success,
      error: errorMessage,
      metadata: { jobId: savedJobId, company: savedJob.company },
    }).catch(() => {});
  }
}
