import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { error } from '@/lib/api-utils';
import { invalidateJobApiKeyCache } from '@/lib/jobs/api-keys';

// GET — return masked key status (never expose values)
export async function GET() {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await prisma.siteConfig.findUnique({ where: { id: 'main' } });
    const dbKeys = config?.jobApiKeys ? JSON.parse(config.jobApiKeys) : {};

    const mask = (envVar: string, dbVal?: string) => {
      const val = dbVal || process.env[envVar];
      if (!val) return null;
      return val.length <= 8 ? '****' : `${val.slice(0, 4)}${'*'.repeat(Math.max(4, val.length - 8))}${val.slice(-4)}`;
    };

    return NextResponse.json({
      adzunaAppId:  { masked: mask('ADZUNA_APP_ID', dbKeys.adzunaAppId),  source: dbKeys.adzunaAppId ? 'db' : process.env.ADZUNA_APP_ID ? 'env' : null },
      adzunaAppKey: { masked: mask('ADZUNA_APP_KEY', dbKeys.adzunaAppKey), source: dbKeys.adzunaAppKey ? 'db' : process.env.ADZUNA_APP_KEY ? 'env' : null },
      joobleApiKey: { masked: mask('JOOBLE_API_KEY', dbKeys.joobleApiKey), source: dbKeys.joobleApiKey ? 'db' : process.env.JOOBLE_API_KEY ? 'env' : null },
      rapidApiKey:  { masked: mask('RAPIDAPI_KEY', dbKeys.rapidApiKey),    source: dbKeys.rapidApiKey ? 'db' : process.env.RAPIDAPI_KEY ? 'env' : null },
    });
  } catch (err) {
    return error(err);
  }
}

// PUT — update keys stored in DB (empty string = delete key from DB)
export async function PUT(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { adzunaAppId, adzunaAppKey, joobleApiKey, rapidApiKey } = body;

    const config = await prisma.siteConfig.findUnique({ where: { id: 'main' } });
    const existing = config?.jobApiKeys ? JSON.parse(config.jobApiKeys) : {};

    const updated: Record<string, string> = { ...existing };

    const set = (key: string, val?: string) => {
      if (val === undefined) return; // not included in request — leave unchanged
      if (val === '') delete updated[key];
      else updated[key] = val;
    };

    set('adzunaAppId', adzunaAppId);
    set('adzunaAppKey', adzunaAppKey);
    set('joobleApiKey', joobleApiKey);
    set('rapidApiKey', rapidApiKey);

    await prisma.siteConfig.upsert({
      where: { id: 'main' },
      update: { jobApiKeys: JSON.stringify(updated) },
      create: { id: 'main', jobApiKeys: JSON.stringify(updated) },
    });

    invalidateJobApiKeyCache();

    return NextResponse.json({ ok: true });
  } catch (err) {
    return error(err);
  }
}
