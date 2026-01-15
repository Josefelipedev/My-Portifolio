import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { analyzeResumePDF, getCurrentAIProvider } from '@/lib/claude';
import { promises as fs } from 'fs';
import path from 'path';

// Extract text from PDF using unpdf
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const { extractText } = await import('unpdf');
  // unpdf expects Uint8Array, not Buffer
  const uint8Array = new Uint8Array(buffer);
  const result = await extractText(uint8Array);
  // unpdf returns text as array of strings (one per page)
  return Array.isArray(result.text) ? result.text.join('\n') : result.text;
}

export async function POST(request: Request) {
  try {
    // Check authentication
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let pdfBuffer: Buffer;
    const contentType = request.headers.get('content-type') || '';

    // Check if it's a file upload or using existing PDF
    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }

      if (!file.name.endsWith('.pdf')) {
        return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      pdfBuffer = Buffer.from(arrayBuffer);

      // Save the uploaded file
      const savePath = path.join(process.cwd(), 'src', 'data', 'resume.pdf');
      await fs.writeFile(savePath, pdfBuffer);
    } else {
      // Use existing PDF from src/data/resume.pdf
      const pdfPath = path.join(process.cwd(), 'src', 'data', 'resume.pdf');

      try {
        pdfBuffer = await fs.readFile(pdfPath);
      } catch {
        return NextResponse.json(
          { error: 'No resume PDF found. Please upload a PDF file.' },
          { status: 404 }
        );
      }
    }

    // Extract text from PDF
    const pdfText = await extractTextFromPDF(pdfBuffer);

    if (!pdfText || pdfText.trim().length < 50) {
      return NextResponse.json(
        { error: 'Could not extract text from PDF. Make sure the PDF contains readable text.' },
        { status: 400 }
      );
    }

    // Analyze with Together AI
    const analysis = await analyzeResumePDF(pdfText);
    const provider = getCurrentAIProvider();

    return NextResponse.json({
      success: true,
      analysis,
      provider: provider.provider,
      extractedTextLength: pdfText.length,
    });
  } catch (error) {
    console.error('Error analyzing resume:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze resume' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Check authentication
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if resume.pdf exists
    const pdfPath = path.join(process.cwd(), 'src', 'data', 'resume.pdf');

    try {
      const stats = await fs.stat(pdfPath);
      return NextResponse.json({
        exists: true,
        path: 'src/data/resume.pdf',
        size: stats.size,
        lastModified: stats.mtime,
      });
    } catch {
      return NextResponse.json({
        exists: false,
        message: 'No resume PDF found. Upload one using POST.',
      });
    }
  } catch (error) {
    console.error('Error checking resume:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check resume' },
      { status: 500 }
    );
  }
}
