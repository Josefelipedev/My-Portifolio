// CV Generator — creates a tailored CV for a specific job using AI
import Together from 'together-ai';
import { trackAIUsage, estimateTokens, checkQuotaLimits } from '@/lib/ai-tracking';
import prisma from '@/lib/prisma';
import { type CustomCVContent } from './cv-html';

export type { CustomCVContent };
export { buildCVHtml } from './cv-html';

interface ResumeSkill {
  name: string;
  level: number;
  category: string;
}

interface ResumeExperience {
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  responsibilities: string[];
}

interface ResumeEducation {
  degree: string;
  institution: string;
  startDate: string;
  endDate: string;
}

interface ResumeCertification {
  name: string;
  issuer: string;
}

interface ResumePersonalInfo {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
}

interface ResumeData {
  personalInfo: ResumePersonalInfo;
  professionalSummary: { en: string };
  skills: ResumeSkill[];
  experience: ResumeExperience[];
  education: ResumeEducation[];
  certifications: ResumeCertification[];
}

function getTogetherClient(): Together | null {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) return null;
  return new Together({ apiKey });
}

export async function generateCustomCV(savedJobId: string): Promise<CustomCVContent> {
  const savedJob = await prisma.savedJob.findUnique({ where: { id: savedJobId } });
  if (!savedJob) throw new Error('Job not found');

  const quotaCheck = await checkQuotaLimits();
  if (!quotaCheck.withinLimits) throw new Error('AI quota exceeded. Please try again later.');

  const client = getTogetherClient();
  if (!client) throw new Error('AI service not configured. Set TOGETHER_API_KEY.');

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const resume: ResumeData = require('@/data/resume.json');

  const allSkills = resume.skills.map((s) => s.name).join(', ');
  const expSummary = resume.experience
    .map(
      (e) =>
        `${e.title} at ${e.company} (${e.startDate}–${e.endDate || 'present'}): ${e.responsibilities.join('; ')}`
    )
    .join('\n');

  const model = process.env.TOGETHER_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
  const startTime = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;
  let success = true;
  let errorMessage: string | undefined;

  try {
    const prompt = `You are an expert ATS resume writer. Tailor this developer's CV for a specific job.

JOB DETAILS:
- Title: ${savedJob.title}
- Company: ${savedJob.company}
- Tags/Tech Required: ${savedJob.tags || 'Not specified'}
- Description (first 1500 chars): ${(savedJob.description || '').substring(0, 1500)}

CANDIDATE'S CURRENT CV:
Summary: ${resume.professionalSummary.en}

Skills: ${allSkills}

Experience:
${expSummary}

YOUR TASK:
1. Rewrite the summary (2-3 sentences) to match this specific job's keywords and requirements
2. Reorder and select the most relevant skills (top 12, job-matching ones first)
3. Rewrite experience bullet points to emphasize achievements relevant to this job
   - Use action verbs
   - Include metrics where possible (keep original metrics)
   - Mirror keywords from the job description

Return ONLY a JSON object (no markdown, no explanation):
{
  "summary": "Rewritten 2-3 sentence professional summary tailored to this job",
  "skills": ["Top skill 1", "Top skill 2", ...up to 12 skills],
  "experience": [
    {
      "title": "exact job title from CV",
      "company": "exact company name",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or present",
      "location": "location from CV",
      "bullets": ["Rewritten bullet 1 with job keywords", "Rewritten bullet 2", ...]
    }
  ]
}

Include ALL experience entries from the original CV but rewrite bullets for relevance.
Return ONLY the JSON.`;

    const aiResponse = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2500,
      temperature: 0.4,
    });

    inputTokens = aiResponse.usage?.prompt_tokens || estimateTokens(prompt);
    outputTokens = aiResponse.usage?.completion_tokens || 0;

    const content = aiResponse.choices[0]?.message?.content?.trim() || '{}';
    outputTokens = outputTokens || estimateTokens(content);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in AI response');

    const customCV = JSON.parse(jsonMatch[0]) as CustomCVContent;

    // Merge into existing enrichedData under 'customizedCv' key
    let enrichedData: Record<string, unknown> = {};
    if (savedJob.enrichedData) {
      try {
        enrichedData = JSON.parse(savedJob.enrichedData) as Record<string, unknown>;
      } catch {
        enrichedData = {};
      }
    }
    enrichedData.customizedCv = customCV;
    enrichedData.customizedCvJobTitle = savedJob.title;
    enrichedData.customizedCvCompany = savedJob.company;

    await prisma.savedJob.update({
      where: { id: savedJobId },
      data: {
        enrichedData: JSON.stringify(enrichedData),
        generatedCvAt: new Date(),
      },
    });

    return customCV;
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw error;
  } finally {
    const latencyMs = Date.now() - startTime;
    trackAIUsage({
      feature: 'cv-generation',
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
