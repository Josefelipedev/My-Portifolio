// Debug endpoint for job extraction - helps diagnose why jobs aren't being found
import { NextResponse } from 'next/server';
import { extractJobsWithAI, getLastExtractionDebug } from '@/lib/jobs/ai-extraction';

interface DebugResult {
  source: string;
  url: string;
  httpStatus: number | null;
  htmlLength: number;
  htmlSample: string;
  aiExtractionResult: {
    success: boolean;
    jobsFound: number;
    jobs: unknown[];
    error?: string;
  };
  regexFallback?: {
    jobsFound: number;
    patterns: string[];
  };
}

// GET /api/jobs/debug?source=vagascombr&keyword=developer
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source') || 'vagascombr';
  const keyword = searchParams.get('keyword') || 'desenvolvedor';

  const results: DebugResult[] = [];

  // Test Vagas.com.br
  if (source === 'vagascombr' || source === 'all') {
    const vagasResult = await debugVagasComBr(keyword);
    results.push(vagasResult);
  }

  // Test GeekHunter
  if (source === 'geekhunter' || source === 'all') {
    const geekhunterResult = await debugGeekHunter(keyword);
    results.push(geekhunterResult);
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    keyword,
    results,
    aiConfig: {
      provider: process.env.AI_PROVIDER || 'together',
      model: process.env.TOGETHER_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      hasApiKey: !!process.env.TOGETHER_API_KEY,
    },
    lastAIExtraction: getLastExtractionDebug(),
  });
}

async function debugVagasComBr(keyword: string): Promise<DebugResult> {
  const encodedKeyword = encodeURIComponent(keyword);
  const url = `https://www.vagas.com.br/vagas-de-${encodedKeyword.replace(/%20/g, '-')}`;

  const result: DebugResult = {
    source: 'vagascombr',
    url,
    httpStatus: null,
    htmlLength: 0,
    htmlSample: '',
    aiExtractionResult: {
      success: false,
      jobsFound: 0,
      jobs: [],
    },
  };

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    result.httpStatus = response.status;

    if (!response.ok) {
      result.aiExtractionResult.error = `HTTP error: ${response.status}`;
      return result;
    }

    const html = await response.text();
    result.htmlLength = html.length;

    // Get a sample that shows job-related content
    const jobSectionMatch = html.match(/class="[^"]*vaga[^"]*"[\s\S]{0,5000}/i);
    result.htmlSample = jobSectionMatch
      ? jobSectionMatch[0].slice(0, 2000)
      : html.slice(0, 2000);

    // Try AI extraction
    try {
      const aiJobs = await extractJobsWithAI(html, 'Vagas.com.br', 'https://www.vagas.com.br');
      result.aiExtractionResult = {
        success: aiJobs.length > 0,
        jobsFound: aiJobs.length,
        jobs: aiJobs.slice(0, 5), // Show first 5 jobs
      };
    } catch (aiError) {
      result.aiExtractionResult.error = aiError instanceof Error ? aiError.message : 'AI extraction failed';
    }

    // Check regex patterns
    const regexPatterns = [
      'link-detalhes-vaga',
      'emprVaga',
      'nivelVaga',
      'vaga-local',
    ];
    const foundPatterns = regexPatterns.filter(p => html.includes(p));
    result.regexFallback = {
      jobsFound: (html.match(/class="link-detalhes-vaga"/gi) || []).length,
      patterns: foundPatterns,
    };

  } catch (error) {
    result.aiExtractionResult.error = error instanceof Error ? error.message : 'Fetch failed';
  }

  return result;
}

async function debugGeekHunter(keyword: string): Promise<DebugResult> {
  const encodedKeyword = encodeURIComponent(keyword);
  const url = `https://www.geekhunter.com.br/vagas?search=${encodedKeyword}`;

  const result: DebugResult = {
    source: 'geekhunter',
    url,
    httpStatus: null,
    htmlLength: 0,
    htmlSample: '',
    aiExtractionResult: {
      success: false,
      jobsFound: 0,
      jobs: [],
    },
  };

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    result.httpStatus = response.status;

    if (!response.ok) {
      result.aiExtractionResult.error = `HTTP error: ${response.status}`;
      return result;
    }

    const html = await response.text();
    result.htmlLength = html.length;

    // Get a sample that shows job-related content
    const jobSectionMatch = html.match(/class="[^"]*(?:job|vaga|position)[^"]*"[\s\S]{0,5000}/i);
    result.htmlSample = jobSectionMatch
      ? jobSectionMatch[0].slice(0, 2000)
      : html.slice(0, 2000);

    // Try AI extraction
    try {
      const aiJobs = await extractJobsWithAI(html, 'GeekHunter', 'https://www.geekhunter.com.br');
      result.aiExtractionResult = {
        success: aiJobs.length > 0,
        jobsFound: aiJobs.length,
        jobs: aiJobs.slice(0, 5), // Show first 5 jobs
      };
    } catch (aiError) {
      result.aiExtractionResult.error = aiError instanceof Error ? aiError.message : 'AI extraction failed';
    }

    // Check regex patterns
    const regexPatterns = [
      '/vagas/',
      'job-card',
      'position-card',
      'vaga-card',
    ];
    const foundPatterns = regexPatterns.filter(p => html.includes(p));
    result.regexFallback = {
      jobsFound: (html.match(/href="\/vagas\/[^"]+"/gi) || []).length,
      patterns: foundPatterns,
    };

  } catch (error) {
    result.aiExtractionResult.error = error instanceof Error ? error.message : 'Fetch failed';
  }

  return result;
}
