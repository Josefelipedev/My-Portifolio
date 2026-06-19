// CV Generator — creates a tailored CV for a specific job using AI
import Together from 'together-ai';
import { trackAIUsage, estimateTokens, checkQuotaLimits } from '../ai-tracking';
import prisma from '../../db';
import resumeData from '../../../data/resume.json';
import { buildKnowledgeContext } from '../knowledge';

export interface CustomCVContent {
  summary: string;
  skills: string[];
  experience: Array<{
    title: string;
    company: string;
    startDate: string;
    endDate: string;
    location: string;
    bullets: string[];
  }>;
  projects?: Array<{
    name: string;
    description: string;
    technologies?: string[];
    link?: string;
  }>;
  certifications?: Array<{
    name: string;
    issuer?: string;
    year?: string;
  }>;
  providedKnowledge?: Array<{
    id: string;
    title: string;
    type: string;
  }>;
}


function validateCustomCV(obj: unknown): obj is CustomCVContent {
  if (!obj || typeof obj !== 'object') return false;
  const cv = obj as Record<string, unknown>;
  return (
    typeof cv.summary === 'string' &&
    Array.isArray(cv.skills) &&
    Array.isArray(cv.experience)
  );
}

function getTogetherClient(): Together | null {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) return null;
  return new Together({ apiKey });
}

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/i)
      .map((word) => word.trim())
      .filter((word) => word.length >= 2)
  );
}

function rankKnowledgeItems(
  jobText: string,
  items: Array<{
    id: string;
    type: string;
    title: string;
    content: string;
    tags: string | null;
    confidence: number;
    priority: number;
  }>
) {
  const jobTokens = tokenize(jobText);

  return items
    .map((item) => {
      const itemTokens = tokenize(`${item.title} ${item.content} ${item.tags || ''}`);
      let matches = 0;
      itemTokens.forEach((token) => {
        if (jobTokens.has(token)) matches++;
      });
      return {
        item,
        score: matches * 3 + item.priority * 2 + item.confidence,
      };
    })
    .filter(({ score, item }) => score > item.priority * 2 + item.confidence || item.priority >= 8)
    .sort((a, b) => b.score - a.score)
    .slice(0, 35)
    .map(({ item }) => item);
}

export async function generateCustomCV(savedJobId: string): Promise<CustomCVContent> {
  const savedJob = await prisma.savedJob.findUnique({ where: { id: savedJobId } });
  if (!savedJob) throw new Error('Job not found');

  const quotaCheck = await checkQuotaLimits();
  if (!quotaCheck.withinLimits) throw new Error('AI quota exceeded. Please try again later.');

  const client = getTogetherClient();
  if (!client) throw new Error('AI service not configured. Set TOGETHER_API_KEY.');

  const resume = resumeData;

  const allSkills = resume.skills.map((s) => s.name).join(', ');
  const expSummary = resume.experience
    .map(
      (e) =>
        `${e.title} at ${e.company} (${e.startDate}–${e.endDate || 'present'}): ${e.responsibilities.join('; ')}`
    )
    .join('\n');

  const activeKnowledgeItems = await prisma.knowledgeItem.findMany({
    where: { isActive: true },
    select: {
      id: true,
      type: true,
      title: true,
      content: true,
      tags: true,
      confidence: true,
      priority: true,
    },
    orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    take: 250,
  });

  const jobText = [
    savedJob.title,
    savedJob.company,
    savedJob.tags || '',
    savedJob.description || '',
    savedJob.location || '',
    savedJob.jobType || '',
  ].join('\n');
  const selectedKnowledgeItems = rankKnowledgeItems(jobText, activeKnowledgeItems);
  // Always surface project/certification/course knowledge to the model so the CV
  // can include them, even when they don't token-match the job description.
  const projectCertItems = activeKnowledgeItems
    .filter((i) => ['project', 'certification', 'course'].includes(i.type))
    .slice(0, 8);
  const knowledgeForContext = [
    ...selectedKnowledgeItems,
    ...projectCertItems.filter((i) => !selectedKnowledgeItems.some((s) => s.id === i.id)),
  ];
  const privateKnowledge = buildKnowledgeContext(knowledgeForContext);

  const certSummary = (resume.certifications || [])
    .map((c) => `${c.name}${c.issuer ? ` — ${c.issuer}` : ''}${c.date ? ` (${c.date})` : ''}`)
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

Certifications (from CV):
${certSummary || 'None listed'}

PRIVATE PROFESSIONAL KNOWLEDGE BASE:
${privateKnowledge}

YOUR TASK:
1. Rewrite the summary (2-3 sentences) to match this specific job's keywords and requirements
2. Reorder and select the most relevant skills (top 12, job-matching ones first)
3. Rewrite experience bullet points to emphasize achievements relevant to this job
   - Use action verbs
   - Include metrics where possible (keep original metrics)
   - Mirror keywords from the job description
4. Select up to 4 of the most relevant PROJECTS (from the knowledge base or CV) for this job — a name, a one-line impact-focused description, and the key technologies used.
5. List the CERTIFICATIONS relevant to this job (from the CV and the knowledge base) — name, issuer, and year.

STRICT FACT RULES:
- Use only facts from the current CV and private knowledge base.
- Do not invent companies, dates, degrees, certifications, metrics, technologies, or achievements.
- If the knowledge base supports a requirement but it is not in the public CV, you may use it as supporting detail.
- If a job requirement is not supported by the CV or knowledge base, do not claim it.
- Only include projects and certifications that exist in the CV or the knowledge base; return an empty array ([]) when there are none.

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
  ],
  "projects": [
    { "name": "Project name", "description": "One-line, impact-focused description", "technologies": ["Tech1", "Tech2"], "link": "url or empty string" }
  ],
  "certifications": [
    { "name": "Certification name", "issuer": "Issuer or empty string", "year": "YYYY" }
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error('AI returned invalid JSON');
    }

    if (!validateCustomCV(parsed)) {
      throw new Error('AI response missing required CV fields');
    }
    const customCV: CustomCVContent = {
      ...parsed,
      providedKnowledge: selectedKnowledgeItems.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
      })),
    };

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
    enrichedData.customizedCvProvidedKnowledgeIds = selectedKnowledgeItems.map((item) => item.id);

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
