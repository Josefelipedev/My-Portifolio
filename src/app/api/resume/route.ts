import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Import resume data from JSON (fallback and structured data)
import resumeData from '@/data/resume.json';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const section = searchParams.get('section');
  const lang = searchParams.get('lang') || 'en';

  try {
    // Check if PDF exists and get its modification time
    const pdfPath = path.join(process.cwd(), 'src/data/resume.pdf');
    let pdfLastModified: Date | null = null;

    if (fs.existsSync(pdfPath)) {
      const stats = fs.statSync(pdfPath);
      pdfLastModified = stats.mtime;
    }

    // Build response based on requested section
    const response: Record<string, unknown> = {
      lastUpdated: pdfLastModified?.toISOString() || new Date().toISOString(),
    };

    if (!section || section === 'all') {
      // Return all data
      response.personalInfo = resumeData.personalInfo;
      response.summary = resumeData.professionalSummary[lang as 'pt' | 'en'] || resumeData.professionalSummary.en;
      response.experience = resumeData.experience;
      response.education = resumeData.education;
      response.skills = resumeData.skills;
      response.certifications = resumeData.certifications;
      response.languages = resumeData.languages;
    } else {
      // Return specific section
      switch (section) {
        case 'summary':
          response.summary = resumeData.professionalSummary[lang as 'pt' | 'en'] || resumeData.professionalSummary.en;
          break;
        case 'experience':
          response.experience = resumeData.experience;
          break;
        case 'education':
          response.education = resumeData.education;
          break;
        case 'skills':
          response.skills = resumeData.skills;
          break;
        case 'certifications':
          response.certifications = resumeData.certifications;
          break;
        case 'languages':
          response.languages = resumeData.languages;
          break;
        case 'personal':
          response.personalInfo = resumeData.personalInfo;
          break;
        default:
          return NextResponse.json(
            { error: 'Invalid section. Available: summary, experience, education, skills, certifications, languages, personal, all' },
            { status: 400 }
          );
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching resume data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resume data' },
      { status: 500 }
    );
  }
}
