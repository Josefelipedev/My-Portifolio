// Environment variables validation and typing
// This ensures all required env vars are present at runtime

function getEnvVar(key: string, required: boolean = true): string {
  const value = process.env[key];

  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value || '';
}

function getEnvVarOptional(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

// Lazy evaluation to avoid errors during build time
export const env = {
  // Authentication (required)
  get JWT_SECRET() {
    return getEnvVar('JWT_SECRET');
  },
  get PASSWORD_HASH() {
    return getEnvVar('PASSWORD_HASH');
  },

  // GitHub integration (optional)
  get GITHUB_TOKEN() {
    return getEnvVarOptional('GITHUB_TOKEN');
  },

  // AI providers (at least one should be configured)
  get ANTHROPIC_API_KEY() {
    return getEnvVarOptional('ANTHROPIC_API_KEY');
  },
  get TOGETHER_API_KEY() {
    return getEnvVarOptional('TOGETHER_API_KEY');
  },
  get OLLAMA_URL() {
    return getEnvVarOptional('OLLAMA_URL', 'http://localhost:11434');
  },
  get OLLAMA_MODEL() {
    return getEnvVarOptional('OLLAMA_MODEL', 'llama3.2');
  },
  get AI_PROVIDER() {
    return getEnvVarOptional('AI_PROVIDER', 'together') as 'together' | 'anthropic' | 'ollama';
  },

  // Contact (optional)
  get CONTACT_EMAIL() {
    return getEnvVarOptional('CONTACT_EMAIL');
  },

  // Database
  get DATABASE_URL() {
    return getEnvVarOptional('DATABASE_URL', 'prisma/dev.db');
  },

  // Node environment
  get NODE_ENV() {
    return getEnvVarOptional('NODE_ENV', 'development');
  },
  get isProduction() {
    return this.NODE_ENV === 'production';
  },
  get isDevelopment() {
    return this.NODE_ENV === 'development';
  },
};

// Validate that at least one AI provider is configured
export function validateAIConfig(): boolean {
  const hasAnthropic = !!env.ANTHROPIC_API_KEY;
  const hasTogether = !!env.TOGETHER_API_KEY;
  const hasOllama = env.AI_PROVIDER === 'ollama';

  return hasAnthropic || hasTogether || hasOllama;
}

// Validate required env vars at startup (call this in middleware or layout)
export function validateRequiredEnvVars(): { valid: boolean; missing: string[] } {
  const required = ['JWT_SECRET', 'PASSWORD_HASH'];
  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
