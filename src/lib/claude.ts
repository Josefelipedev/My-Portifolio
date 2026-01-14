import Together from 'together-ai';

// AI Provider types
type AIProvider = 'ollama' | 'together' | 'anthropic';

interface AIConfig {
  provider: AIProvider;
  model: string;
}

// Get current AI provider from env
function getAIConfig(): AIConfig {
  const provider = (process.env.AI_PROVIDER as AIProvider) || 'together';

  switch (provider) {
    case 'ollama':
      return {
        provider: 'ollama',
        model: process.env.OLLAMA_MODEL || 'llama3.2',
      };
    case 'anthropic':
      return {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      };
    case 'together':
    default:
      return {
        provider: 'together',
        model: process.env.TOGETHER_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      };
  }
}

// Together AI client
let togetherClient: Together | null = null;

function getTogetherClient(): Together {
  if (!togetherClient) {
    const apiKey = process.env.TOGETHER_API_KEY;
    if (!apiKey) {
      throw new Error('TOGETHER_API_KEY environment variable is not set');
    }
    togetherClient = new Together({ apiKey });
  }
  return togetherClient;
}

// Ollama local API call
async function callOllama(prompt: string, model: string): Promise<string> {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.response?.trim() || '';
}

// Together AI call
async function callTogether(prompt: string, model: string, maxTokens = 500): Promise<string> {
  const client = getTogetherClient();

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content?.trim() || '';
}

// Anthropic call (optional, if user has API key)
async function callAnthropic(prompt: string, model: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'COLE_SUA_CHAVE_ANTHROPIC_AQUI') {
    throw new Error('ANTHROPIC_API_KEY not configured. Use Together AI or Ollama instead.');
  }

  // Dynamic import to avoid errors if not using Anthropic
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model,
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type === 'text') {
    return content.text.trim();
  }

  throw new Error('Unexpected response format from Anthropic API');
}

// Unified AI call function
async function callAI(prompt: string, maxTokens = 500): Promise<string> {
  const config = getAIConfig();

  switch (config.provider) {
    case 'ollama':
      return callOllama(prompt, config.model);
    case 'anthropic':
      return callAnthropic(prompt, config.model);
    case 'together':
    default:
      return callTogether(prompt, config.model, maxTokens);
  }
}

interface SummarizeInput {
  repoName: string;
  description: string | null;
  readme: string | null;
  languages: string[];
  topics: string[];
}

export async function generateProjectSummary(input: SummarizeInput): Promise<string> {
  const prompt = `You are a technical writer creating portfolio descriptions for a developer.

Summarize this GitHub project for a developer portfolio in 2-3 concise sentences.
Focus on: what the project does, key technologies used, and what makes it interesting or valuable.
Be professional and avoid generic phrases. Write in third person.

Project: ${input.repoName}
${input.description ? `Description: ${input.description}` : ''}
Languages: ${input.languages.length > 0 ? input.languages.join(', ') : 'Not specified'}
Topics: ${input.topics.length > 0 ? input.topics.join(', ') : 'Not specified'}

${input.readme ? `README (first 3000 chars):\n${input.readme.slice(0, 3000)}` : 'No README available.'}

Write only the summary, no introduction or extra text.`;

  return callAI(prompt);
}

export async function generateBioSuggestion(
  repos: { name: string; description: string | null; language: string | null }[]
): Promise<string> {
  const repoList = repos
    .slice(0, 10)
    .map((r) => `- ${r.name}: ${r.description || 'No description'} (${r.language || 'Unknown'})`)
    .join('\n');

  const prompt = `Based on these GitHub repositories, write a brief professional bio (2-3 sentences) for a developer portfolio.
Focus on their apparent expertise and interests based on the projects.

Repositories:
${repoList}

Write only the bio, no introduction or extra text.`;

  return callAI(prompt);
}

// Export current provider info for UI
export function getCurrentAIProvider(): { provider: AIProvider; model: string } {
  return getAIConfig();
}

interface SkillsSuggestionInput {
  projects: { title: string; technologies: string; description: string }[];
  experiences: { title: string; technologies: string; description: string }[];
  existingSkills?: string[];
}

interface SkillSuggestion {
  name: string;
  category: 'frontend' | 'backend' | 'devops' | 'tools' | 'other';
  level: number;
  reason: string;
}

export async function generateSkillsSuggestion(input: SkillsSuggestionInput): Promise<SkillSuggestion[]> {
  const projectsList = input.projects
    .map((p) => `- ${p.title}: ${p.description} (Technologies: ${p.technologies})`)
    .join('\n');

  const experiencesList = input.experiences
    .map((e) => `- ${e.title}: ${e.description} (Technologies: ${e.technologies})`)
    .join('\n');

  const existingSkillsText = input.existingSkills?.length
    ? `\nExisting skills to SKIP (do not suggest these): ${input.existingSkills.join(', ')}`
    : '';

  const prompt = `You are analyzing a developer's portfolio to suggest technical skills.

Based on the projects and work experiences below, suggest a list of technical skills with proficiency levels.

PROJECTS:
${projectsList || 'No projects available'}

WORK EXPERIENCES:
${experiencesList || 'No experiences available'}
${existingSkillsText}

For each skill, provide:
1. name: The technology/skill name (e.g., "React", "Node.js", "Docker")
2. category: One of "frontend", "backend", "devops", "tools", or "other"
3. level: Proficiency from 1-5 based on how frequently it appears and project complexity:
   - 1: Beginner (mentioned once or twice)
   - 2: Basic (used in a few projects)
   - 3: Intermediate (regular use)
   - 4: Advanced (used extensively)
   - 5: Expert (primary technology, used in most projects)
4. reason: Brief justification for the level (1 sentence)

Respond ONLY with a valid JSON array. No other text. Example:
[{"name":"React","category":"frontend","level":4,"reason":"Used in 5 projects including complex dashboards"},{"name":"Node.js","category":"backend","level":3,"reason":"Backend of 3 projects"}]`;

  const response = await callAI(prompt);

  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }
    const suggestions = JSON.parse(jsonMatch[0]) as SkillSuggestion[];

    // Validate and sanitize each suggestion
    return suggestions.map((s) => ({
      name: String(s.name || '').trim(),
      category: ['frontend', 'backend', 'devops', 'tools', 'other'].includes(s.category)
        ? s.category
        : 'other',
      level: Math.min(5, Math.max(1, Number(s.level) || 3)),
      reason: String(s.reason || '').trim(),
    }));
  } catch (parseError) {
    console.error('Failed to parse AI response:', response);
    throw new Error('Failed to parse AI suggestions. Please try again.');
  }
}

// Resume analysis types
export interface ResumeAnalysis {
  personalInfo: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    linkedin?: string;
    github?: string;
  };
  professionalSummary: {
    pt: string;
    en: string;
  };
  experience: Array<{
    title: string;
    company: string;
    location?: string;
    startDate: string;
    endDate?: string;
    responsibilities: string[];
  }>;
  education: Array<{
    degree: string;
    institution: string;
    location?: string;
    startDate: string;
    endDate?: string;
    description?: string;
  }>;
  skills: Array<{
    name: string;
    level: number;
    category: 'frontend' | 'backend' | 'devops' | 'tools' | 'mobile' | 'other';
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
    date?: string;
    description?: string;
  }>;
  languages: Array<{
    language: string;
    level: string;
    notes?: string;
  }>;
}

export async function analyzeResumePDF(pdfText: string): Promise<ResumeAnalysis> {
  const prompt = `You are an expert resume parser. Analyze the following resume text extracted from a PDF and extract structured information.

RESUME TEXT:
${pdfText.slice(0, 8000)}

Extract and return a JSON object with the following structure:
{
  "personalInfo": {
    "name": "Full name",
    "email": "Email address",
    "phone": "Phone number (optional)",
    "address": "Address (optional)",
    "linkedin": "LinkedIn username only (optional)",
    "github": "GitHub username only (optional)"
  },
  "professionalSummary": {
    "pt": "Professional summary in Portuguese",
    "en": "Professional summary in English"
  },
  "experience": [
    {
      "title": "Job title",
      "company": "Company name",
      "location": "City, Country (optional)",
      "startDate": "YYYY-MM format",
      "endDate": "YYYY-MM format or null if current",
      "responsibilities": ["Responsibility 1", "Responsibility 2"]
    }
  ],
  "education": [
    {
      "degree": "Degree name",
      "institution": "Institution name",
      "location": "City, Country (optional)",
      "startDate": "YYYY-MM format",
      "endDate": "YYYY-MM format or null if ongoing",
      "description": "Brief description (optional)"
    }
  ],
  "skills": [
    {
      "name": "Skill name",
      "level": 1-5,
      "category": "frontend|backend|devops|tools|mobile|other"
    }
  ],
  "certifications": [
    {
      "name": "Certification name",
      "issuer": "Issuing organization",
      "date": "YYYY-MM format (optional)",
      "description": "Brief description (optional)"
    }
  ],
  "languages": [
    {
      "language": "Language name",
      "level": "Native|Fluent|Advanced|Intermediate|Basic",
      "notes": "Additional notes (optional)"
    }
  ]
}

IMPORTANT:
- For skill levels: 1=Beginner, 2=Basic, 3=Intermediate, 4=Advanced, 5=Expert
- Categorize skills correctly: React/Vue/Angular=frontend, Node/Python/Java=backend, Docker/K8s/AWS=devops, Git/VSCode=tools, Flutter/React Native=mobile
- Use YYYY-MM format for dates (e.g., "2024-03")
- If information is not available, use empty arrays or null
- Generate BOTH Portuguese and English summaries (translate if only one language is present)

Respond ONLY with the JSON object. No other text.`;

  const response = await callAI(prompt, 4000);

  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in response');
    }
    const analysis = JSON.parse(jsonMatch[0]) as ResumeAnalysis;

    // Validate and sanitize
    return {
      personalInfo: {
        name: String(analysis.personalInfo?.name || '').trim(),
        email: String(analysis.personalInfo?.email || '').trim(),
        phone: analysis.personalInfo?.phone?.trim(),
        address: analysis.personalInfo?.address?.trim(),
        linkedin: analysis.personalInfo?.linkedin?.trim(),
        github: analysis.personalInfo?.github?.trim(),
      },
      professionalSummary: {
        pt: String(analysis.professionalSummary?.pt || '').trim(),
        en: String(analysis.professionalSummary?.en || '').trim(),
      },
      experience: (analysis.experience || []).map((e) => ({
        title: String(e.title || '').trim(),
        company: String(e.company || '').trim(),
        location: e.location?.trim(),
        startDate: String(e.startDate || '').trim(),
        endDate: e.endDate?.trim(),
        responsibilities: (e.responsibilities || []).map((r) => String(r).trim()),
      })),
      education: (analysis.education || []).map((e) => ({
        degree: String(e.degree || '').trim(),
        institution: String(e.institution || '').trim(),
        location: e.location?.trim(),
        startDate: String(e.startDate || '').trim(),
        endDate: e.endDate?.trim(),
        description: e.description?.trim(),
      })),
      skills: (analysis.skills || []).map((s) => ({
        name: String(s.name || '').trim(),
        level: Math.min(5, Math.max(1, Number(s.level) || 3)),
        category: ['frontend', 'backend', 'devops', 'tools', 'mobile', 'other'].includes(s.category)
          ? s.category
          : 'other',
      })),
      certifications: (analysis.certifications || []).map((c) => ({
        name: String(c.name || '').trim(),
        issuer: String(c.issuer || '').trim(),
        date: c.date?.trim(),
        description: c.description?.trim(),
      })),
      languages: (analysis.languages || []).map((l) => ({
        language: String(l.language || '').trim(),
        level: String(l.level || '').trim(),
        notes: l.notes?.trim(),
      })),
    };
  } catch (parseError) {
    console.error('Failed to parse AI response:', response);
    throw new Error('Failed to parse resume analysis. Please try again.');
  }
}
