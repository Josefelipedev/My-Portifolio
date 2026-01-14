import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { promises as fs } from 'fs';
import path from 'path';
import type { ResumeAnalysis } from '@/lib/claude';

interface SyncOptions {
  syncExperiences?: boolean;
  syncSkills?: boolean;
  syncJson?: boolean;
  clearExisting?: boolean;
}

export async function POST(request: Request) {
  try {
    // Check authentication
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { analysis, options = {} } = body as {
      analysis: ResumeAnalysis;
      options: SyncOptions;
    };

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis data is required' }, { status: 400 });
    }

    const {
      syncExperiences = true,
      syncSkills = true,
      syncJson = true,
      clearExisting = false,
    } = options;

    const results = {
      experiences: { created: 0, updated: 0, deleted: 0 },
      skills: { created: 0, updated: 0, deleted: 0 },
      jsonUpdated: false,
    };

    // Sync Experiences to database
    if (syncExperiences && analysis.experience?.length > 0) {
      if (clearExisting) {
        const deleted = await prisma.experience.deleteMany({});
        results.experiences.deleted = deleted.count;
      }

      for (const exp of analysis.experience) {
        // Try to find existing experience by title and company
        const existing = await prisma.experience.findFirst({
          where: {
            title: exp.title,
            company: exp.company,
          },
        });

        const experienceData = {
          title: exp.title,
          company: exp.company,
          location: exp.location || null,
          description: exp.responsibilities.join('. '),
          responsibilities: exp.responsibilities.join(','),
          challenges: '',
          technologies: '',
          startDate: exp.startDate ? new Date(`${exp.startDate}-01`) : null,
          endDate: exp.endDate ? new Date(`${exp.endDate}-01`) : null,
        };

        if (existing) {
          await prisma.experience.update({
            where: { id: existing.id },
            data: experienceData,
          });
          results.experiences.updated++;
        } else {
          await prisma.experience.create({
            data: experienceData,
          });
          results.experiences.created++;
        }
      }
    }

    // Sync Skills to database
    if (syncSkills && analysis.skills?.length > 0) {
      if (clearExisting) {
        const deleted = await prisma.skill.deleteMany({});
        results.skills.deleted = deleted.count;
      }

      for (const skill of analysis.skills) {
        // Try to find existing skill by name (case-insensitive)
        const existing = await prisma.skill.findFirst({
          where: {
            name: {
              equals: skill.name,
              mode: 'insensitive',
            },
          },
        });

        const skillData = {
          name: skill.name,
          category: skill.category === 'mobile' ? 'other' : skill.category,
          level: skill.level,
        };

        if (existing) {
          await prisma.skill.update({
            where: { id: existing.id },
            data: skillData,
          });
          results.skills.updated++;
        } else {
          await prisma.skill.create({
            data: skillData,
          });
          results.skills.created++;
        }
      }
    }

    // Update resume.json file
    if (syncJson) {
      const jsonPath = path.join(process.cwd(), 'src', 'data', 'resume.json');

      const resumeJson = {
        personalInfo: {
          name: analysis.personalInfo.name,
          email: analysis.personalInfo.email,
          phone: analysis.personalInfo.phone || '',
          address: analysis.personalInfo.address || '',
          linkedin: analysis.personalInfo.linkedin || '',
          github: analysis.personalInfo.github || '',
          birthDate: '',
        },
        professionalSummary: analysis.professionalSummary,
        experience: analysis.experience.map((exp) => ({
          title: exp.title,
          company: exp.company,
          location: exp.location || '',
          startDate: exp.startDate,
          endDate: exp.endDate || null,
          responsibilities: exp.responsibilities,
        })),
        education: analysis.education.map((edu) => ({
          degree: edu.degree,
          institution: edu.institution,
          location: edu.location || '',
          startDate: edu.startDate,
          endDate: edu.endDate || null,
          description: edu.description || '',
        })),
        skills: analysis.skills.map((skill) => ({
          name: skill.name,
          level: skill.level,
          category: skill.category,
        })),
        certifications: analysis.certifications.map((cert) => ({
          name: cert.name,
          issuer: cert.issuer,
          date: cert.date || '',
          description: cert.description || '',
        })),
        languages: analysis.languages.map((lang) => ({
          language: lang.language,
          level: lang.level,
          notes: lang.notes || '',
        })),
      };

      await fs.writeFile(jsonPath, JSON.stringify(resumeJson, null, 2));
      results.jsonUpdated = true;
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Sync completed: ${results.experiences.created + results.experiences.updated} experiences, ${results.skills.created + results.skills.updated} skills processed`,
    });
  } catch (error) {
    console.error('Error syncing resume data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync resume data' },
      { status: 500 }
    );
  }
}
