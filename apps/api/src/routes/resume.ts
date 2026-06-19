// Resume routes — ported from the web app's src/app/api/resume/analyze. Extracts
// text from an uploaded (or stored) PDF with unpdf and analyzes it with the
// API-owned AI engine. Authenticated (writes the stored PDF), so guarded by
// requireAuth + requireCsrf.
//
// The stored-PDF location is decoupled from the web's src/data via
// RESUME_PDF_PATH (defaults to <cwd>/data/resume.pdf for the API service).

import { Hono } from 'hono';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { requireCsrf } from '../lib/csrf';
import { analyzeResumePDF, getCurrentAIProvider } from '../lib/claude';

const resume = new Hono<AuthEnv>();

function resumePdfPath(): string {
  return process.env.RESUME_PDF_PATH || path.join(process.cwd(), 'data', 'resume.pdf');
}

function resumeJsonPath(): string {
  return process.env.RESUME_JSON_PATH || path.join(process.cwd(), 'data', 'resume.json');
}

async function readResumeJson(): Promise<Record<string, unknown>> {
  const content = await fs.readFile(resumeJsonPath(), 'utf-8');
  return JSON.parse(content) as Record<string, unknown>;
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const { extractText } = await import('unpdf');
  const uint8Array = new Uint8Array(buffer);
  const result = await extractText(uint8Array);
  return Array.isArray(result.text) ? result.text.join('\n') : result.text;
}

resume.post('/resume/analyze', requireAuth, requireCsrf, async (c) => {
  let pdfBuffer: Buffer;
  const contentType = c.req.header('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await c.req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return c.json({ error: 'No file uploaded', code: 'BAD_REQUEST' }, 400);
    }
    if (!file.name.endsWith('.pdf')) {
      return c.json({ error: 'File must be a PDF', code: 'BAD_REQUEST' }, 400);
    }
    pdfBuffer = Buffer.from(await file.arrayBuffer());

    const savePath = resumePdfPath();
    await fs.mkdir(path.dirname(savePath), { recursive: true });
    await fs.writeFile(savePath, pdfBuffer);
  } else {
    try {
      pdfBuffer = await fs.readFile(resumePdfPath());
    } catch {
      return c.json({ error: 'No resume PDF found. Please upload a PDF file.', code: 'NOT_FOUND' }, 404);
    }
  }

  const pdfText = await extractTextFromPDF(pdfBuffer);
  if (!pdfText || pdfText.trim().length < 50) {
    return c.json(
      { error: 'Could not extract text from PDF. Make sure the PDF contains readable text.', code: 'BAD_REQUEST' },
      400,
    );
  }

  const analysis = await analyzeResumePDF(pdfText);
  return c.json({
    success: true,
    analysis,
    provider: getCurrentAIProvider().provider,
    extractedTextLength: pdfText.length,
  });
});

// GET /resume?section=&lang= — structured resume sections from resume.json.
// Public (read-only). Ported from the web's src/app/api/resume route.
resume.get('/resume', async (c) => {
  const section = c.req.query('section') || 'all';
  const lang = (c.req.query('lang') || 'en') as 'pt' | 'en';

  let data: Record<string, unknown>;
  try {
    data = await readResumeJson();
  } catch {
    return c.json({ error: 'Failed to fetch resume data', code: 'INTERNAL' }, 500);
  }

  let lastUpdated = new Date().toISOString();
  try {
    lastUpdated = (await fs.stat(resumePdfPath())).mtime.toISOString();
  } catch {
    /* no PDF — keep now() */
  }

  const summary = data.professionalSummary as Record<string, string> | undefined;
  const response: Record<string, unknown> = { lastUpdated };

  const sections: Record<string, () => void> = {
    summary: () => (response.summary = summary?.[lang] || summary?.en),
    experience: () => (response.experience = data.experience),
    education: () => (response.education = data.education),
    skills: () => (response.skills = data.skills),
    certifications: () => (response.certifications = data.certifications),
    languages: () => (response.languages = data.languages),
    personal: () => (response.personalInfo = data.personalInfo),
  };

  if (section === 'all') {
    response.personalInfo = data.personalInfo;
    response.summary = summary?.[lang] || summary?.en;
    response.experience = data.experience;
    response.education = data.education;
    response.skills = data.skills;
    response.certifications = data.certifications;
    response.languages = data.languages;
  } else if (sections[section]) {
    sections[section]();
  } else {
    return c.json(
      { error: 'Invalid section. Available: summary, experience, education, skills, certifications, languages, personal, all', code: 'BAD_REQUEST' },
      400,
    );
  }

  return c.json(response);
});

// PUT /resume — update personalInfo in resume.json. NOTE: writes the container
// file, which resets on redeploy; durable resume edits use PUT /jobs/resume (DB).
resume.put('/resume', requireAuth, requireCsrf, async (c) => {
  const updates = (await c.req.json().catch(() => ({}))) as { personalInfo?: Record<string, unknown> };
  let current: Record<string, unknown>;
  try {
    current = await readResumeJson();
  } catch {
    return c.json({ error: 'Failed to read resume data', code: 'INTERNAL' }, 500);
  }

  if (updates.personalInfo) {
    current.personalInfo = { ...(current.personalInfo as object), ...updates.personalInfo };
  }
  await fs.writeFile(resumeJsonPath(), JSON.stringify(current, null, 2));

  return c.json({
    success: true,
    message: 'Personal info updated successfully',
    personalInfo: current.personalInfo,
  });
});

export default resume;
