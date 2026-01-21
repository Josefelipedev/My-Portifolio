// WakaTime Year in Review Ranking Extractor

import Together from 'together-ai';
import { trackAIUsage, estimateTokens, checkQuotaLimits } from './ai-tracking';

export interface YearlyRanking {
  year: number;
  percentile: number;
  totalDevs: string;
  totalHours?: string;
  dailyAverage?: string;
  bestDay?: {
    date: string;
    hours: string;
  };
}

// Get Together AI client
let togetherClient: Together | null = null;

function getTogetherClient(): Together | null {
  if (!togetherClient) {
    const apiKey = process.env.TOGETHER_API_KEY;
    if (!apiKey) {
      return null;
    }
    togetherClient = new Together({ apiKey });
  }
  return togetherClient;
}

/**
 * Extract ranking information from WakaTime Year in Review page
 */
export async function extractRankingFromUrl(url: string, year: number): Promise<YearlyRanking | null> {
  try {
    // Fetch the Year in Review page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch Year in Review page: ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Try AI extraction first
    const aiResult = await extractWithAI(html, year);
    if (aiResult) {
      return aiResult;
    }

    // Fallback to regex extraction
    return extractWithRegex(html, year);
  } catch (error) {
    console.error(`Error extracting ranking for ${year}:`, error);
    return null;
  }
}

/**
 * Extract ranking using AI
 */
async function extractWithAI(html: string, year: number): Promise<YearlyRanking | null> {
  const client = getTogetherClient();
  if (!client) {
    return null;
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
      console.log('WakaTime ranking: Quota exceeded, using regex fallback');
      return null;
    }

    // Clean HTML - remove scripts, styles, and limit size
    const cleanedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 20000);

    const prompt = `Extract coding statistics from this WakaTime Year in Review HTML page for ${year}.

HTML Content:
${cleanedHtml}

Extract and return ONLY a JSON object with this exact structure:
{
  "percentile": <number - the "Top X%" ranking, just the number without %>",
  "totalDevs": "<string - total developers like '500k+'>",
  "totalHours": "<string - total hours coded like '1,693 hrs 7 mins'>",
  "dailyAverage": "<string - daily average like '5 hrs 7 mins'>",
  "bestDayDate": "<string - best day date>",
  "bestDayHours": "<string - best day hours>"
}

IMPORTANT:
- Look for text like "Top 1% of 500k+ devs" or similar ranking information
- The percentile should be just the number (e.g., 1 for "Top 1%", 4 for "Top 4%")
- Return ONLY valid JSON, no other text`;

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.1,
    });

    inputTokens = response.usage?.prompt_tokens || estimateTokens(prompt);
    outputTokens = response.usage?.completion_tokens || 0;

    const content = response.choices[0]?.message?.content?.trim() || '';
    outputTokens = outputTokens || estimateTokens(content);

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const data = JSON.parse(jsonMatch[0]);

    if (typeof data.percentile !== 'number' || data.percentile <= 0) {
      return null;
    }

    return {
      year,
      percentile: data.percentile,
      totalDevs: data.totalDevs || '500k+',
      totalHours: data.totalHours,
      dailyAverage: data.dailyAverage,
      bestDay: data.bestDayDate ? {
        date: data.bestDayDate,
        hours: data.bestDayHours || '',
      } : undefined,
    };
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('AI extraction error:', error);
    return null;
  } finally {
    const latencyMs = Date.now() - startTime;

    // Track usage
    trackAIUsage({
      feature: 'wakatime-ranking',
      model,
      inputTokens,
      outputTokens,
      latencyMs,
      success,
      error: errorMessage,
      metadata: { year },
    }).catch(() => {
      // Silently ignore tracking errors
    });
  }
}

/**
 * Extract ranking using regex patterns
 */
function extractWithRegex(html: string, year: number): YearlyRanking | null {
  // Pattern for "Top X% of Yk+ devs" or similar
  const rankingPatterns = [
    /Top\s+(\d+)%\s+of\s+([\d,]+k?\+?)\s*(?:devs?|developers?)/i,
    /top\s+(\d+)\s*%\s*(?:of\s*)?([\d,]+k?\+?)\s*(?:devs?|developers?)/i,
    /ranked?\s+(?:in\s+)?(?:the\s+)?top\s+(\d+)%/i,
    /(\d+)%\s+(?:of\s+)?([\d,]+k?\+?)\s*(?:devs?|developers?)/i,
  ];

  for (const pattern of rankingPatterns) {
    const match = html.match(pattern);
    if (match) {
      const percentile = parseInt(match[1], 10);
      const totalDevs = match[2] || '500k+';

      if (percentile > 0 && percentile <= 100) {
        // Try to extract total hours
        const hoursMatch = html.match(/(\d{1,3}(?:,\d{3})*)\s*(?:hrs?|hours?)\s*(?:(\d+)\s*(?:mins?|minutes?))?/i);
        const totalHours = hoursMatch ? `${hoursMatch[1]} hrs${hoursMatch[2] ? ` ${hoursMatch[2]} mins` : ''}` : undefined;

        // Try to extract daily average
        const avgMatch = html.match(/(?:daily\s+average|average\s+daily)[:\s]*(\d+)\s*(?:hrs?|hours?)\s*(?:(\d+)\s*(?:mins?|minutes?))?/i);
        const dailyAverage = avgMatch ? `${avgMatch[1]} hrs${avgMatch[2] ? ` ${avgMatch[2]} mins` : ''}` : undefined;

        return {
          year,
          percentile,
          totalDevs: totalDevs.includes('k') ? totalDevs : `${totalDevs}+`,
          totalHours,
          dailyAverage,
        };
      }
    }
  }

  return null;
}

/**
 * Extract rankings from multiple Year in Review URLs
 */
export async function extractRankingsFromUrls(
  yearlyReportLinks: Record<number, string>
): Promise<Record<number, YearlyRanking>> {
  const rankings: Record<number, YearlyRanking> = {};

  for (const [yearStr, url] of Object.entries(yearlyReportLinks)) {
    const year = parseInt(yearStr, 10);
    if (isNaN(year) || !url) continue;

    console.log(`Extracting ranking for ${year} from ${url}`);
    const ranking = await extractRankingFromUrl(url, year);

    if (ranking) {
      rankings[year] = ranking;
      console.log(`Found ranking for ${year}: Top ${ranking.percentile}%`);
    } else {
      console.log(`Could not extract ranking for ${year}`);
    }
  }

  return rankings;
}
