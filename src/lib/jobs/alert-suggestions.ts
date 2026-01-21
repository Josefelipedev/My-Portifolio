// AI-powered Job Alert Suggestions based on Resume

import Together from 'together-ai';
import resumeData from '@/data/resume.json';
import { trackAIUsage, estimateTokens, checkQuotaLimits } from '../ai-tracking';

export interface AlertSuggestion {
  name: string;
  keyword: string;
  countries: string;
  sources: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
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
 * Generate job alert suggestions based on user's resume using AI
 */
export async function generateAlertSuggestions(): Promise<AlertSuggestion[]> {
  const resume = resumeData;

  // Extract relevant information from resume
  const skills = resume.skills.map(s => `${s.name} (${s.level}/5)`).join(', ');
  const experience = resume.experience.map(e => `${e.title} at ${e.company}`).join('; ');
  const certifications = resume.certifications?.map(c => c.name).join(', ') || '';

  const client = getTogetherClient();

  if (!client) {
    console.log('Alert suggestions: No Together API key, using rule-based fallback');
    return generateRuleBasedSuggestions(resume);
  }

  const startTime = Date.now();
  const model = process.env.TOGETHER_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
  let inputTokens = 0;
  let outputTokens = 0;
  let success = true;
  let errorMessage: string | undefined;

  const prompt = `You are a tech recruitment expert. Analyze the resume below and suggest personalized job alerts.

## Resume:
**Skills:** ${skills}
**Experience:** ${experience}
**Certifications:** ${certifications}

## Task:
Generate 5 job alert suggestions that would be ideal for this professional.

Respond ONLY with a valid JSON array in this exact format:
[
  {
    "name": "Descriptive alert name",
    "keyword": "search keyword",
    "countries": "br,pt or all",
    "sources": "linkedin,remoteok,geekhunter or all",
    "reason": "Why this job is suitable",
    "confidence": "high"
  }
]

Consider:
- Skills with high level (4-5) should have priority
- Combine related technologies (e.g., React + Node = Full-Stack)
- Include remote and local opportunities (Brazil/Portugal)
- Vary search sources
- Be specific with keywords for better results
- Available sources: remoteok, remotive, arbeitnow, linkedin, geekhunter, vagascombr, netempregos, all

Respond with ONLY the JSON array.`;

  try {
    // Check quota before making the call
    const quotaCheck = await checkQuotaLimits();
    if (!quotaCheck.withinLimits) {
      console.log('Alert suggestions: Quota exceeded, using rule-based fallback');
      return generateRuleBasedSuggestions(resume);
    }

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.7,
    });

    inputTokens = response.usage?.prompt_tokens || estimateTokens(prompt);
    outputTokens = response.usage?.completion_tokens || 0;

    const content = response.choices[0]?.message?.content || '';
    outputTokens = outputTokens || estimateTokens(content);

    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log('Alert suggestions: No JSON array found in AI response');
      return generateRuleBasedSuggestions(resume);
    }

    const suggestions: AlertSuggestion[] = JSON.parse(jsonMatch[0]);

    // Validate and clean suggestions
    return suggestions
      .filter(s => s.name && s.keyword && s.countries && s.reason)
      .map(s => ({
        ...s,
        confidence: validateConfidence(s.confidence),
      }))
      .slice(0, 5);
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('AI suggestion error:', error);
    return generateRuleBasedSuggestions(resume);
  } finally {
    const latencyMs = Date.now() - startTime;

    // Track usage
    trackAIUsage({
      feature: 'alert-suggestions',
      model,
      inputTokens,
      outputTokens,
      latencyMs,
      success,
      error: errorMessage,
      metadata: { skillCount: resume.skills.length },
    }).catch(() => {
      // Silently ignore tracking errors
    });
  }
}

function validateConfidence(confidence: string): 'high' | 'medium' | 'low' {
  if (confidence === 'high' || confidence === 'medium' || confidence === 'low') {
    return confidence;
  }
  return 'medium';
}

/**
 * Fallback: Generate suggestions based on rules when AI is not available
 */
function generateRuleBasedSuggestions(resume: typeof resumeData): AlertSuggestion[] {
  const suggestions: AlertSuggestion[] = [];

  // Get top skills (level >= 4)
  const topSkills = resume.skills
    .filter(s => s.level >= 4)
    .sort((a, b) => b.level - a.level)
    .slice(0, 5);

  // Suggestion based on main skill
  if (topSkills.length > 0) {
    suggestions.push({
      name: `${topSkills[0].name} Developer`,
      keyword: topSkills[0].name.toLowerCase(),
      countries: 'br,pt',
      sources: 'linkedin,geekhunter',
      reason: `Based on your main skill: ${topSkills[0].name}`,
      confidence: 'high',
    });
  }

  // Detect profile type
  const hasReact = topSkills.some(s => s.name.toLowerCase().includes('react'));
  const hasNode = topSkills.some(s => s.name.toLowerCase().includes('node'));
  const hasDocker = topSkills.some(s => s.name.toLowerCase().includes('docker'));
  const hasLaravel = topSkills.some(s => s.name.toLowerCase().includes('laravel'));
  const hasPHP = topSkills.some(s => s.name.toLowerCase().includes('php'));
  const hasReactNative = topSkills.some(s => s.name.toLowerCase().includes('react native'));
  const hasFlutter = topSkills.some(s => s.name.toLowerCase().includes('flutter'));

  // Full-Stack JavaScript
  if (hasReact && hasNode) {
    suggestions.push({
      name: 'Full-Stack JavaScript',
      keyword: 'full-stack node react',
      countries: 'br,pt',
      sources: 'all',
      reason: 'You have skills in React and Node.js',
      confidence: 'high',
    });
  }

  // PHP/Laravel Developer
  if (hasLaravel || hasPHP) {
    suggestions.push({
      name: 'PHP/Laravel Developer',
      keyword: 'laravel php developer',
      countries: 'br,pt',
      sources: 'linkedin,geekhunter,vagascombr',
      reason: 'Based on your PHP and Laravel skills',
      confidence: 'high',
    });
  }

  // Mobile Developer
  if (hasReactNative || hasFlutter) {
    const mobileKeyword = hasReactNative ? 'react native' : 'flutter';
    suggestions.push({
      name: 'Mobile Developer',
      keyword: `mobile ${mobileKeyword}`,
      countries: 'br,pt',
      sources: 'linkedin,geekhunter',
      reason: 'Based on your mobile development skills',
      confidence: 'high',
    });
  }

  // DevOps / SRE
  if (hasDocker) {
    suggestions.push({
      name: 'DevOps / SRE',
      keyword: 'devops docker',
      countries: 'all',
      sources: 'linkedin,remoteok',
      reason: 'Based on your DevOps skills',
      confidence: 'medium',
    });
  }

  // Remote opportunities
  suggestions.push({
    name: 'Remote Tech Jobs',
    keyword: topSkills[0]?.name.toLowerCase() || 'developer',
    countries: 'remote',
    sources: 'remoteok,remotive',
    reason: 'Remote work opportunities',
    confidence: 'medium',
  });

  // Ensure we don't have duplicates and limit to 5
  const uniqueSuggestions = suggestions.filter(
    (s, index, self) => index === self.findIndex(t => t.keyword === s.keyword)
  );

  return uniqueSuggestions.slice(0, 5);
}
