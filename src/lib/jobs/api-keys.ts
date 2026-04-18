import prisma from '@/lib/prisma';

export interface JobApiKeys {
  adzunaAppId?: string;
  adzunaAppKey?: string;
  joobleApiKey?: string;
  rapidApiKey?: string;
}

let cached: JobApiKeys | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000; // re-read from DB at most once per minute

export async function getJobApiKeys(): Promise<JobApiKeys> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached;

  try {
    const config = await prisma.siteConfig.findUnique({ where: { id: 'main' } });
    const dbKeys: JobApiKeys = config?.jobApiKeys ? JSON.parse(config.jobApiKeys) : {};
    cached = {
      adzunaAppId: dbKeys.adzunaAppId || process.env.ADZUNA_APP_ID,
      adzunaAppKey: dbKeys.adzunaAppKey || process.env.ADZUNA_APP_KEY,
      joobleApiKey: dbKeys.joobleApiKey || process.env.JOOBLE_API_KEY,
      rapidApiKey: dbKeys.rapidApiKey || process.env.RAPIDAPI_KEY,
    };
  } catch {
    cached = {
      adzunaAppId: process.env.ADZUNA_APP_ID,
      adzunaAppKey: process.env.ADZUNA_APP_KEY,
      joobleApiKey: process.env.JOOBLE_API_KEY,
      rapidApiKey: process.env.RAPIDAPI_KEY,
    };
  }
  cachedAt = now;
  return cached!;
}

export function invalidateJobApiKeyCache() {
  cached = null;
  cachedAt = 0;
}
