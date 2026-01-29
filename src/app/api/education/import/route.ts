import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import { promises as fs } from 'fs';
import path from 'path';

interface ResumeEducation {
  degree: string;
  institution: string;
  location?: string;
  startDate?: string;
  endDate?: string | null;
  description?: string;
}

interface ResumeCertification {
  name: string;
  issuer: string;
  date?: string;
  description?: string;
}

interface ResumeData {
  education?: ResumeEducation[];
  certifications?: ResumeCertification[];
}

export async function POST() {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Read resume.json
    const jsonPath = path.join(process.cwd(), 'src', 'data', 'resume.json');
    const fileContent = await fs.readFile(jsonPath, 'utf-8');
    const resumeData: ResumeData = JSON.parse(fileContent);

    const results = {
      education: { created: 0, skipped: 0 },
      certifications: { created: 0, skipped: 0 },
    };

    // Import education (degrees)
    if (resumeData.education?.length) {
      for (const edu of resumeData.education) {
        // Check if already exists
        const existing = await prisma.education.findFirst({
          where: {
            title: edu.degree,
            institution: edu.institution,
          },
        });

        if (existing) {
          results.education.skipped++;
          continue;
        }

        await prisma.education.create({
          data: {
            title: edu.degree,
            institution: edu.institution,
            type: 'degree',
            location: edu.location || null,
            description: edu.description || null,
            startDate: edu.startDate ? new Date(`${edu.startDate}-01`) : null,
            endDate: edu.endDate ? new Date(`${edu.endDate}-01`) : null,
          },
        });
        results.education.created++;
      }
    }

    // Import certifications
    if (resumeData.certifications?.length) {
      for (const cert of resumeData.certifications) {
        // Check if already exists
        const existing = await prisma.education.findFirst({
          where: {
            title: cert.name,
            institution: cert.issuer,
            type: 'certification',
          },
        });

        if (existing) {
          results.certifications.skipped++;
          continue;
        }

        await prisma.education.create({
          data: {
            title: cert.name,
            institution: cert.issuer,
            type: 'certification',
            description: cert.description || null,
            startDate: cert.date ? new Date(`${cert.date}-01`) : null,
            endDate: cert.date ? new Date(`${cert.date}-01`) : null,
          },
        });
        results.certifications.created++;
      }
    }

    const total = results.education.created + results.certifications.created;
    const skipped = results.education.skipped + results.certifications.skipped;

    return NextResponse.json({
      success: true,
      results,
      message: `Imported ${total} items (${skipped} already existed)`,
    });
  } catch (error) {
    console.error('Error importing from resume:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import' },
      { status: 500 }
    );
  }
}
