import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { error } from '@/lib/api-utils';
import type { ResumeData } from '@/lib/jobs/types';

/** Load resume: DB first, fallback to file */
export async function loadResumeData(): Promise<ResumeData> {
  try {
    const config = await prisma.resumeConfig.findUnique({ where: { id: 'main' } });
    if (config?.data) {
      return JSON.parse(config.data) as ResumeData;
    }
  } catch {
    // DB not ready or no record — fall through to file
  }
  const resumePath = path.join(process.cwd(), 'src/data/resume.json');
  const content = await readFile(resumePath, 'utf-8');
  return JSON.parse(content) as ResumeData;
}

export async function GET() {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const resume = await loadResumeData();
    return NextResponse.json({ resume });
  } catch (err) {
    return error(err);
  }
}

export async function PUT(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as ResumeData;

    // Basic validation
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid resume data' }, { status: 400 });
    }
    if (!Array.isArray(body.skills)) {
      return NextResponse.json({ error: 'skills must be an array' }, { status: 400 });
    }

    const data = JSON.stringify(body);

    await prisma.resumeConfig.upsert({
      where: { id: 'main' },
      create: { id: 'main', data },
      update: { data },
    });

    return NextResponse.json({ success: true, resume: body });
  } catch (err) {
    return error(err);
  }
}
