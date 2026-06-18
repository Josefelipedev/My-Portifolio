// Jobs inline-AI — handlers whose AI logic lives directly in the route (no
// shared lib). Ported faithfully from the web handlers under
// src/app/api/jobs/{saved/[id]/enrich, saved/[id]/interview-prep,
// generate-email, extract}. Each creates the Together client inline, builds the
// prompt, tracks usage via ../lib/ai-tracking, and writes the DB where the web
// handler did.
//
// SECURITY: the web routes relied on Next middleware (or isAuthenticated()) for
// auth. The API service has NO global middleware, so every route here MUST
// carry requireAuth explicitly. They are all state-changing AI mutations, so
// requireCsrf is applied too.

import { Hono } from 'hono';
import Together from 'together-ai';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { requireCsrf } from '../lib/csrf';
import { trackAIUsage, estimateTokens, checkQuotaLimits } from '../lib/ai-tracking';
import { logger } from '../lib/logger';
import prisma from '../db';
import resumeData from '../../data/resume.json';

const jobsAiInline = new Hono<AuthEnv>();

// Get Together AI client (null when TOGETHER_API_KEY is absent -> 503).
function getTogetherClient(): Together | null {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) return null;
  return new Together({ apiKey });
}

interface EnrichedData {
  emails: string[];
  phones: string[];
  requirements: string[];
  benefits: string[];
  applicationProcess: string;
  companyInfo: string;
  salary?: string;
  workMode?: string;
  contractType?: string;
  rawExtraction?: string;
}

// POST /api/jobs/saved/:id/enrich
jobsAiInline.post('/jobs/saved/:id/enrich', requireAuth, requireCsrf, async (c) => {
  try {
    const id = c.req.param('id');

    // Get the saved job
    const savedJob = await prisma.savedJob.findUnique({ where: { id } });
    if (!savedJob) {
      return c.json({ error: 'Job not found' }, 404);
    }

    // Check quota
    const quotaCheck = await checkQuotaLimits();
    if (!quotaCheck.withinLimits) {
      return c.json({ error: 'AI quota exceeded. Please try again later.' }, 429);
    }

    const client = getTogetherClient();
    if (!client) {
      return c.json({ error: 'AI service not configured' }, 503);
    }

    // Fetch the job page
    logger.info('job-enrichment', `Fetching URL for enrichment: ${savedJob.url}`, {
      jobId: id,
      url: savedJob.url,
    });

    const response = await fetch(savedJob.url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      logger.error('job-enrichment', `Failed to fetch job URL: ${response.status}`, {
        jobId: id,
        url: savedJob.url,
        status: response.status,
      });
      return c.json({ error: `Failed to fetch job page: ${response.status}` }, 502);
    }

    const html = await response.text();

    // Clean HTML
    const cleanedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 20000);

    const startTime = Date.now();
    const model = process.env.TOGETHER_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
    let inputTokens = 0;
    let outputTokens = 0;
    let success = true;
    let errorMessage: string | undefined;

    try {
      const prompt = `You are analyzing a job posting page to extract contact information and additional details.

Job Title: ${savedJob.title}
Company: ${savedJob.company}

HTML Content:
${cleanedHtml}

Extract the following information from this job posting and return as JSON:

{
  "emails": ["array of email addresses found"],
  "phones": ["array of phone numbers found"],
  "requirements": ["array of job requirements/qualifications"],
  "benefits": ["array of benefits mentioned"],
  "applicationProcess": "how to apply or application instructions",
  "companyInfo": "additional info about the company",
  "salary": "salary range if mentioned and not already known",
  "workMode": "remote/hybrid/on-site if specified",
  "contractType": "CLT/PJ/Freelance/etc if specified"
}

IMPORTANT:
- Look for emails in the page, often in "apply" or "contact" sections
- Look for phone/WhatsApp numbers
- Extract actual requirements, not generic ones
- If a field has no data, use empty string or empty array
- Return ONLY the JSON object, no other text

Respond with ONLY the JSON object.`;

      const aiResponse = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.1,
      });

      inputTokens = aiResponse.usage?.prompt_tokens || estimateTokens(prompt);
      outputTokens = aiResponse.usage?.completion_tokens || 0;

      const content = aiResponse.choices[0]?.message?.content?.trim() || '{}';
      outputTokens = outputTokens || estimateTokens(content);

      // Parse response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in AI response');
      }

      const enrichedData: EnrichedData = JSON.parse(jsonMatch[0]);
      enrichedData.rawExtraction = content.slice(0, 500);

      // Get primary contact email (first non-generic one)
      const primaryEmail =
        enrichedData.emails?.find(
          (email) => !email.includes('noreply') && !email.includes('no-reply')
        ) ||
        enrichedData.emails?.[0] ||
        null;

      const primaryPhone = enrichedData.phones?.[0] || null;

      // Update the saved job
      const updatedJob = await prisma.savedJob.update({
        where: { id },
        data: {
          contactEmail: primaryEmail,
          contactPhone: primaryPhone,
          enrichedData: JSON.stringify(enrichedData),
          enrichedAt: new Date(),
        },
      });

      logger.info('job-enrichment', `Successfully enriched job: ${savedJob.title}`, {
        jobId: id,
        emailsFound: enrichedData.emails?.length || 0,
        phonesFound: enrichedData.phones?.length || 0,
      });

      return c.json({
        success: true,
        job: {
          ...updatedJob,
          enrichedData: enrichedData,
        },
        extracted: {
          email: primaryEmail,
          phone: primaryPhone,
          emailsFound: enrichedData.emails?.length || 0,
          phonesFound: enrichedData.phones?.length || 0,
        },
      });
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('job-enrichment', `AI extraction failed: ${errorMessage}`, {
        jobId: id,
        error: errorMessage,
      });
      throw error;
    } finally {
      const latencyMs = Date.now() - startTime;

      trackAIUsage({
        feature: 'job-enrichment',
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('job-enrichment', `Enrichment failed: ${errorMessage}`, {
      error: errorMessage,
    });
    return c.json({ error: errorMessage }, 500);
  }
});

// POST /api/jobs/saved/:id/interview-prep
jobsAiInline.post('/jobs/saved/:id/interview-prep', requireAuth, requireCsrf, async (c) => {
  try {
    const id = c.req.param('id');

    const savedJob = await prisma.savedJob.findUnique({ where: { id } });
    if (!savedJob) {
      return c.json({ error: 'Job not found' }, 404);
    }

    const quotaCheck = await checkQuotaLimits();
    if (!quotaCheck.withinLimits) {
      return c.json({ error: 'AI quota exceeded. Please try again later.' }, 429);
    }

    const client = getTogetherClient();
    if (!client) {
      return c.json({ error: 'AI service not configured.' }, 503);
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

      return c.json({ success: true, prep });
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
    return c.json({ error: message }, 500);
  }
});

// POST /api/jobs/generate-email
jobsAiInline.post('/jobs/generate-email', requireAuth, requireCsrf, async (c) => {
  try {
    const { jobTitle, company, description } = (await c.req.json().catch(() => ({}))) as {
      jobTitle?: string;
      company?: string;
      description?: string;
      jobUrl?: string;
    };

    if (!jobTitle || !company) {
      return c.json({ error: 'Job title and company are required' }, 400);
    }

    // Check quota
    const quotaCheck = await checkQuotaLimits();
    if (!quotaCheck.withinLimits) {
      return c.json({ error: 'AI quota exceeded. Please try again later.' }, 429);
    }

    const client = getTogetherClient();
    if (!client) {
      return c.json({ error: 'AI service not configured' }, 503);
    }

    // Get resume info
    const personalInfo = resumeData.personalInfo;
    const summary = resumeData.professionalSummary?.pt || resumeData.professionalSummary?.en || '';
    void summary;
    const skills = resumeData.skills?.map((s: { name: string }) => s.name).join(', ') || '';
    const experience =
      resumeData.experience
        ?.map((e: { company: string; title: string }) => `${e.title} at ${e.company}`)
        .join('; ') || '';

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

    // Extract key requirements from description if available
    const descriptionContext = description
      ? `\nJOB DESCRIPTION (use to personalize):\n${description.substring(0, 1500)}`
      : '';

    try {
      const prompt = `Write a SHORT job application email in PORTUGUESE (Brazilian).

CANDIDATE INFO:
Name: ${personalInfo?.name || 'Jose Felipe'}
Portfolio: ${portfolioUrl}
LinkedIn: ${linkedinUrl}
GitHub: ${githubUrl}
Skills: ${skills}
Recent Experience: ${experience}

JOB:
Position: ${jobTitle}
Company: ${company}${descriptionContext}

RULES - FOLLOW EXACTLY:
1. Start with greeting: "Boa tarde," or "Ola,"
2. MAXIMUM 5 LINES of text (not counting signature)
3. Be direct and professional
4. If job description mentions specific tech/requirements, highlight 1-2 matching skills
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

      return c.json({
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
    return c.json({ error: errorMessage }, 500);
  }
});

// POST /api/jobs/extract
jobsAiInline.post('/jobs/extract', requireAuth, requireCsrf, async (c) => {
  try {
    const { text } = (await c.req.json().catch(() => ({}))) as { text?: string };

    if (!text || text.trim().length < 20) {
      return c.json({ error: 'Please provide job information text (minimum 20 characters)' }, 400);
    }

    // Check quota
    const quotaCheck = await checkQuotaLimits();
    if (!quotaCheck.withinLimits) {
      return c.json({ error: 'AI quota exceeded. Please try again later.' }, 429);
    }

    const client = getTogetherClient();
    if (!client) {
      return c.json({ error: 'AI service not configured' }, 503);
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

      return c.json(result);
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
    return c.json({ error: errorMessage }, 500);
  }
});

export default jobsAiInline;
