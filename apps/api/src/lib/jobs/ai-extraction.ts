// AI-powered HTML Job Extraction using Together AI

import Together from 'together-ai';
import type { AIExtractedJob } from './types';
import { trackAIUsage, estimateTokens, checkQuotaLimits } from '../ai-tracking';

// Store last extraction details for debugging
let lastExtractionDebug: {
  siteName: string;
  htmlLength: number;
  cleanedHtmlLength: number;
  promptLength: number;
  rawResponse: string;
  parsedJobs: number;
  error?: string;
  timestamp: Date;
} | null = null;

export function getLastExtractionDebug() {
  return lastExtractionDebug;
}

// Get Together AI client for job extraction
let togetherClientForJobs: Together | null = null;

function getTogetherClientForJobs(): Together | null {
  if (!togetherClientForJobs) {
    const apiKey = process.env.TOGETHER_API_KEY;
    if (!apiKey) {
      return null;
    }
    togetherClientForJobs = new Together({ apiKey });
  }
  return togetherClientForJobs;
}

/**
 * Extract jobs from HTML using AI
 */
export async function extractJobsWithAI(
  html: string,
  siteName: string,
  baseUrl: string
): Promise<AIExtractedJob[]> {
  const client = getTogetherClientForJobs();
  if (!client) {
    console.log('AI extraction: No Together API key configured, using regex fallback');
    return [];
  }

  const startTime = Date.now();
  const model = process.env.TOGETHER_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
  let inputTokens = 0;
  let outputTokens = 0;
  let success = true;
  let errorMessage: string | undefined;

  try {
    // Check quota before making the call
    const quotaCheck = await checkQuotaLimits();
    if (!quotaCheck.withinLimits) {
      console.log('AI extraction: Quota exceeded, skipping AI extraction');
      return [];
    }

    // Clean HTML - remove scripts, styles, and excessive whitespace
    const cleanedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 15000); // Limit to ~15k chars for AI context

    const prompt = `You are a job listing extractor. Analyze this HTML from ${siteName} and extract job listings.

HTML Content:
${cleanedHtml}

Extract job listings and return a JSON array with this structure:
[
  {
    "title": "Job title",
    "company": "Company name",
    "location": "City/Location",
    "url": "Job URL (relative or absolute)",
    "level": "Experience level if available (Junior, Pleno, Senior)",
    "description": "Brief description if available"
  }
]

IMPORTANT:
- Extract ALL visible job listings from the HTML
- For URLs, include the path as found (e.g., "/vagas/v123/job-title")
- If company is not found, use empty string
- If location is not found, use "Brasil" for Vagas.com.br or "Portugal" for Net-Empregos
- Return ONLY the JSON array, no other text
- If no jobs found, return empty array []

Respond with ONLY the JSON array.`;

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.1, // Low temperature for consistent extraction
    });

    inputTokens = response.usage?.prompt_tokens || estimateTokens(prompt);
    outputTokens = response.usage?.completion_tokens || 0;

    const content = response.choices[0]?.message?.content?.trim() || '[]';
    outputTokens = outputTokens || estimateTokens(content);

    // Store debug info
    lastExtractionDebug = {
      siteName,
      htmlLength: html.length,
      cleanedHtmlLength: cleanedHtml.length,
      promptLength: prompt.length,
      rawResponse: content.slice(0, 2000), // First 2k chars
      parsedJobs: 0,
      timestamp: new Date(),
    };

    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log('AI extraction: No JSON array found in response');
      console.log('AI extraction: Raw response (first 500 chars):', content.slice(0, 500));
      lastExtractionDebug.error = 'No JSON array found in response';
      return [];
    }

    const jobs = JSON.parse(jsonMatch[0]) as AIExtractedJob[];
    lastExtractionDebug.parsedJobs = jobs.length;
    console.log(`AI extraction: Found ${jobs.length} jobs from ${siteName}`);
    return jobs;
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('AI extraction error:', error);
    return [];
  } finally {
    const latencyMs = Date.now() - startTime;

    // Track usage
    trackAIUsage({
      feature: 'job-extraction',
      model,
      inputTokens,
      outputTokens,
      latencyMs,
      success,
      error: errorMessage,
      metadata: { siteName, baseUrl },
    }).catch(() => {
      // Silently ignore tracking errors
    });
  }
}

/**
 * Check if AI extraction is available
 */
export function isAIExtractionAvailable(): boolean {
  return !!process.env.TOGETHER_API_KEY;
}
