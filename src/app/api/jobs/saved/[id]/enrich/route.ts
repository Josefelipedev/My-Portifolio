import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import Together from 'together-ai';
import { trackAIUsage, estimateTokens, checkQuotaLimits } from '@/lib/ai-tracking';
import { logger } from '@/lib/logger';

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

// Get Together AI client
function getTogetherClient(): Together | null {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) return null;
  return new Together({ apiKey });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get the saved job
    const savedJob = await prisma.savedJob.findUnique({
      where: { id },
    });

    if (!savedJob) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
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

    // Fetch the job page
    logger.info('job-enrichment', `Fetching URL for enrichment: ${savedJob.url}`, {
      jobId: id,
      url: savedJob.url,
    });

    const response = await fetch(savedJob.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
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
      return NextResponse.json(
        { error: `Failed to fetch job page: ${response.status}` },
        { status: 502 }
      );
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
      const primaryEmail = enrichedData.emails?.find(
        (email) => !email.includes('noreply') && !email.includes('no-reply')
      ) || enrichedData.emails?.[0] || null;

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

      return NextResponse.json({
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
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
