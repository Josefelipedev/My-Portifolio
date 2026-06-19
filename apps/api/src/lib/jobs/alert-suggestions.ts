// AI-powered Job Alert Suggestions based on the resume. Ported from the web
// app's src/lib/jobs/alert-suggestions.ts (resume.json import path adjusted).

import Together from 'together-ai';
import resumeData from '../../../data/resume.json';
import { trackAIUsage, estimateTokens, checkQuotaLimits } from '../ai-tracking';

export interface AlertSuggestion {
  name: string;
  keyword: string;
  countries: string;
  sources: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

let togetherClient: Together | null = null;

function getTogetherClient(): Together | null {
  if (!togetherClient) {
    const apiKey = process.env.TOGETHER_API_KEY;
    if (!apiKey) return null;
    togetherClient = new Together({ apiKey });
  }
  return togetherClient;
}

export async function generateAlertSuggestions(): Promise<AlertSuggestion[]> {
  const resume = resumeData;

  const skills = resume.skills.map((s) => `${s.name} (${s.level}/5)`).join(', ');
  const experience = resume.experience.map((e) => `${e.title} at ${e.company}`).join('; ');
  const certifications = resume.certifications?.map((c) => c.name).join(', ') || '';

  const client = getTogetherClient();
  if (!client) return generateRuleBasedSuggestions(resume);

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
    const quotaCheck = await checkQuotaLimits();
    if (!quotaCheck.withinLimits) return generateRuleBasedSuggestions(resume);

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

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return generateRuleBasedSuggestions(resume);

    const suggestions: AlertSuggestion[] = JSON.parse(jsonMatch[0]);
    return suggestions
      .filter((s) => s.name && s.keyword && s.countries && s.reason)
      .map((s) => ({ ...s, confidence: validateConfidence(s.confidence) }))
      .slice(0, 5);
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return generateRuleBasedSuggestions(resume);
  } finally {
    trackAIUsage({
      feature: 'alert-suggestions',
      model,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startTime,
      success,
      error: errorMessage,
      metadata: { skillCount: resume.skills.length },
    }).catch(() => {});
  }
}

function validateConfidence(confidence: string): 'high' | 'medium' | 'low' {
  return confidence === 'high' || confidence === 'medium' || confidence === 'low' ? confidence : 'medium';
}

function generateRuleBasedSuggestions(resume: typeof resumeData): AlertSuggestion[] {
  const suggestions: AlertSuggestion[] = [];

  const topSkills = resume.skills
    .filter((s) => s.level >= 4)
    .sort((a, b) => b.level - a.level)
    .slice(0, 5);

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

  const has = (kw: string) => topSkills.some((s) => s.name.toLowerCase().includes(kw));

  if (has('react') && has('node')) {
    suggestions.push({
      name: 'Full-Stack JavaScript',
      keyword: 'full-stack node react',
      countries: 'br,pt',
      sources: 'all',
      reason: 'You have skills in React and Node.js',
      confidence: 'high',
    });
  }
  if (has('laravel') || has('php')) {
    suggestions.push({
      name: 'PHP/Laravel Developer',
      keyword: 'laravel php developer',
      countries: 'br,pt',
      sources: 'linkedin,geekhunter,vagascombr',
      reason: 'Based on your PHP and Laravel skills',
      confidence: 'high',
    });
  }
  if (has('react native') || has('flutter')) {
    const mobileKeyword = has('react native') ? 'react native' : 'flutter';
    suggestions.push({
      name: 'Mobile Developer',
      keyword: `mobile ${mobileKeyword}`,
      countries: 'br,pt',
      sources: 'linkedin,geekhunter',
      reason: 'Based on your mobile development skills',
      confidence: 'high',
    });
  }
  if (has('docker')) {
    suggestions.push({
      name: 'DevOps / SRE',
      keyword: 'devops docker',
      countries: 'all',
      sources: 'linkedin,remoteok',
      reason: 'Based on your DevOps skills',
      confidence: 'medium',
    });
  }

  suggestions.push({
    name: 'Remote Tech Jobs',
    keyword: topSkills[0]?.name.toLowerCase() || 'developer',
    countries: 'remote',
    sources: 'remoteok,remotive',
    reason: 'Remote work opportunities',
    confidence: 'medium',
  });

  return suggestions
    .filter((s, i, self) => i === self.findIndex((t) => t.keyword === s.keyword))
    .slice(0, 5);
}
