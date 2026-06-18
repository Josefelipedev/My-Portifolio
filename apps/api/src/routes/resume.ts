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

export default resume;
