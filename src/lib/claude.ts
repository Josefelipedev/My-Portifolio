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
async function callTogether(prompt: string, model: string): Promise<string> {
  const client = getTogetherClient();

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
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
async function callAI(prompt: string): Promise<string> {
  const config = getAIConfig();

  switch (config.provider) {
    case 'ollama':
      return callOllama(prompt, config.model);
    case 'anthropic':
      return callAnthropic(prompt, config.model);
    case 'together':
    default:
      return callTogether(prompt, config.model);
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
