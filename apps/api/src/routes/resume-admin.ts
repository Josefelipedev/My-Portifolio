// Authenticated resume compare + sync — ported from the web app's POST handlers
// at src/app/api/resume/{compare,sync}. Both consume a `ResumeAnalysis`
// (produced by /resume/analyze) and reconcile it against the DB content:
//   - compare: diff the analysis vs stored experiences/skills (read-only)
//   - sync:    upsert the analysis into experiences/skills/education and
//              optionally rewrite the stored resume.json
// Both mutate or read protected admin state, so each is guarded by
// requireAuth + requireCsrf (the API service has no global auth middleware).
//
// The stored resume.json location is decoupled from the web's src/data via
// RESUME_JSON_PATH (defaults to <cwd>/data/resume.json for the API service),
// mirroring resume.ts's RESUME_PDF_PATH.

import { Hono } from 'hono';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import prisma from '../db';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { requireCsrf } from '../lib/csrf';
import type { ResumeAnalysis } from '../lib/claude';

const resumeAdmin = new Hono<AuthEnv>();

function resumeJsonPath(): string {
  return process.env.RESUME_JSON_PATH || path.join(process.cwd(), 'data', 'resume.json');
}

// ---------------- Compare ----------------

interface ComparisonItem<T> {
  action: 'add' | 'update' | 'remove' | 'keep';
  current?: T;
  new?: T;
  changes?: string[];
}

interface ExperienceCompareItem {
  title: string;
  company: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  description?: string;
}

interface SkillCompareItem {
  name: string;
  category: string;
  level: number;
}

interface ComparisonResult {
  experiences: ComparisonItem<ExperienceCompareItem>[];
  skills: ComparisonItem<SkillCompareItem>[];
  summary: {
    experiences: { add: number; update: number; remove: number; keep: number };
    skills: { add: number; update: number; remove: number; keep: number };
  };
}

resumeAdmin.post('/resume/compare', requireAuth, requireCsrf, async (c) => {
  const body = (await c.req.json()) as { analysis?: ResumeAnalysis };
  const { analysis } = body;

  if (!analysis) {
    return c.json({ error: 'Analysis data is required', code: 'BAD_REQUEST' }, 400);
  }

  const result: ComparisonResult = {
    experiences: [],
    skills: [],
    summary: {
      experiences: { add: 0, update: 0, remove: 0, keep: 0 },
      skills: { add: 0, update: 0, remove: 0, keep: 0 },
    },
  };

  const existingExperiences = await prisma.experience.findMany({
    orderBy: { startDate: 'desc' },
  });

  const existingSkills = await prisma.skill.findMany({
    orderBy: { name: 'asc' },
  });

  // Compare Experiences
  const processedExpIds = new Set<string>();

  for (const newExp of analysis.experience || []) {
    const existing = existingExperiences.find(
      (e) =>
        e.title.toLowerCase() === newExp.title.toLowerCase() &&
        (e.company || '').toLowerCase() === newExp.company.toLowerCase(),
    );

    if (existing) {
      processedExpIds.add(existing.id);

      const changes: string[] = [];
      const currentDesc = existing.description || '';
      const newDesc = newExp.responsibilities.join('. ');

      if (existing.location !== (newExp.location || null)) {
        changes.push(`Localização: "${existing.location || '(vazio)'}" → "${newExp.location || '(vazio)'}"`);
      }
      if (currentDesc !== newDesc && newDesc.length > 0) {
        changes.push('Descrição atualizada');
      }
      if (existing.startDate?.toISOString().slice(0, 7) !== newExp.startDate) {
        changes.push(
          `Data início: "${existing.startDate?.toISOString().slice(0, 7) || '(vazio)'}" → "${newExp.startDate}"`,
        );
      }

      if (changes.length > 0) {
        result.experiences.push({
          action: 'update',
          current: {
            title: existing.title,
            company: existing.company,
            location: existing.location,
            startDate: existing.startDate?.toISOString().slice(0, 7),
            endDate: existing.endDate?.toISOString().slice(0, 7),
            description: currentDesc.slice(0, 100) + (currentDesc.length > 100 ? '...' : ''),
          },
          new: {
            title: newExp.title,
            company: newExp.company,
            location: newExp.location,
            startDate: newExp.startDate,
            endDate: newExp.endDate,
            description: newDesc.slice(0, 100) + (newDesc.length > 100 ? '...' : ''),
          },
          changes,
        });
        result.summary.experiences.update++;
      } else {
        result.experiences.push({
          action: 'keep',
          current: {
            title: existing.title,
            company: existing.company,
            location: existing.location,
            startDate: existing.startDate?.toISOString().slice(0, 7),
            endDate: existing.endDate?.toISOString().slice(0, 7),
          },
        });
        result.summary.experiences.keep++;
      }
    } else {
      result.experiences.push({
        action: 'add',
        new: {
          title: newExp.title,
          company: newExp.company,
          location: newExp.location,
          startDate: newExp.startDate,
          endDate: newExp.endDate,
          description: newExp.responsibilities.join('. ').slice(0, 100) + '...',
        },
      });
      result.summary.experiences.add++;
    }
  }

  // Experiences to remove (in DB but not in new analysis)
  for (const existing of existingExperiences) {
    if (!processedExpIds.has(existing.id)) {
      result.experiences.push({
        action: 'remove',
        current: {
          title: existing.title,
          company: existing.company,
          location: existing.location,
          startDate: existing.startDate?.toISOString().slice(0, 7),
          endDate: existing.endDate?.toISOString().slice(0, 7),
        },
      });
      result.summary.experiences.remove++;
    }
  }

  // Compare Skills
  const processedSkillIds = new Set<string>();

  for (const newSkill of analysis.skills || []) {
    const existing = existingSkills.find((s) => s.name.toLowerCase() === newSkill.name.toLowerCase());

    if (existing) {
      processedSkillIds.add(existing.id);

      const changes: string[] = [];
      const newCategory = newSkill.category === 'mobile' ? 'other' : newSkill.category;

      if (existing.category !== newCategory) {
        changes.push(`Categoria: "${existing.category}" → "${newCategory}"`);
      }
      if (existing.level !== newSkill.level) {
        changes.push(`Nível: ${existing.level} → ${newSkill.level}`);
      }

      if (changes.length > 0) {
        result.skills.push({
          action: 'update',
          current: {
            name: existing.name,
            category: existing.category,
            level: existing.level,
          },
          new: {
            name: newSkill.name,
            category: newCategory,
            level: newSkill.level,
          },
          changes,
        });
        result.summary.skills.update++;
      } else {
        result.skills.push({
          action: 'keep',
          current: {
            name: existing.name,
            category: existing.category,
            level: existing.level,
          },
        });
        result.summary.skills.keep++;
      }
    } else {
      result.skills.push({
        action: 'add',
        new: {
          name: newSkill.name,
          category: newSkill.category === 'mobile' ? 'other' : newSkill.category,
          level: newSkill.level,
        },
      });
      result.summary.skills.add++;
    }
  }

  // Skills to remove (in DB but not in new analysis)
  for (const existing of existingSkills) {
    if (!processedSkillIds.has(existing.id)) {
      result.skills.push({
        action: 'remove',
        current: {
          name: existing.name,
          category: existing.category,
          level: existing.level,
        },
      });
      result.summary.skills.remove++;
    }
  }

  // Sort by action priority: add, update, remove, keep
  const actionOrder = { add: 0, update: 1, remove: 2, keep: 3 };
  result.experiences.sort((a, b) => actionOrder[a.action] - actionOrder[b.action]);
  result.skills.sort((a, b) => actionOrder[a.action] - actionOrder[b.action]);

  return c.json({
    success: true,
    comparison: result,
  });
});

// ---------------- Sync ----------------

interface SyncOptions {
  syncExperiences?: boolean;
  syncSkills?: boolean;
  syncEducation?: boolean;
  syncJson?: boolean;
  clearExisting?: boolean;
}

resumeAdmin.post('/resume/sync', requireAuth, requireCsrf, async (c) => {
  const body = (await c.req.json()) as { analysis?: ResumeAnalysis; options?: SyncOptions };
  const { analysis, options = {} } = body;

  if (!analysis) {
    return c.json({ error: 'Analysis data is required', code: 'BAD_REQUEST' }, 400);
  }

  const {
    syncExperiences = true,
    syncSkills = true,
    syncEducation = true,
    syncJson = true,
    clearExisting = false,
  } = options;

  const results = {
    experiences: { created: 0, updated: 0, deleted: 0 },
    skills: { created: 0, updated: 0, deleted: 0 },
    education: { created: 0, updated: 0, deleted: 0 },
    jsonUpdated: false,
  };

  // Sync Experiences to database
  if (syncExperiences && analysis.experience?.length > 0) {
    if (clearExisting) {
      const deleted = await prisma.experience.deleteMany({});
      results.experiences.deleted = deleted.count;
    }

    for (const exp of analysis.experience) {
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

  // Sync Education to database
  if (syncEducation && analysis.education?.length > 0) {
    if (clearExisting) {
      const deleted = await prisma.education.deleteMany({});
      results.education.deleted = deleted.count;
    }

    for (const edu of analysis.education) {
      const existing = await prisma.education.findFirst({
        where: {
          title: edu.degree,
          institution: edu.institution,
        },
      });

      const educationData = {
        title: edu.degree,
        institution: edu.institution,
        type: 'degree' as const, // Default to degree for resume imports
        location: edu.location || null,
        description: edu.description || null,
        startDate: edu.startDate ? new Date(`${edu.startDate}-01`) : null,
        endDate: edu.endDate ? new Date(`${edu.endDate}-01`) : null,
      };

      if (existing) {
        await prisma.education.update({
          where: { id: existing.id },
          data: educationData,
        });
        results.education.updated++;
      } else {
        await prisma.education.create({
          data: educationData,
        });
        results.education.created++;
      }
    }
  }

  // Sync Certifications to Education database (as certification type)
  if (syncEducation && analysis.certifications?.length > 0) {
    for (const cert of analysis.certifications) {
      const existing = await prisma.education.findFirst({
        where: {
          title: cert.name,
          institution: cert.issuer,
          type: 'certification',
        },
      });

      const certData = {
        title: cert.name,
        institution: cert.issuer,
        type: 'certification' as const,
        description: cert.description || null,
        startDate: cert.date ? new Date(`${cert.date}-01`) : null,
        endDate: cert.date ? new Date(`${cert.date}-01`) : null,
      };

      if (existing) {
        await prisma.education.update({
          where: { id: existing.id },
          data: certData,
        });
        results.education.updated++;
      } else {
        await prisma.education.create({
          data: certData,
        });
        results.education.created++;
      }
    }
  }

  // Update resume.json file
  if (syncJson) {
    const jsonPath = resumeJsonPath();

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

    await fs.mkdir(path.dirname(jsonPath), { recursive: true });
    await fs.writeFile(jsonPath, JSON.stringify(resumeJson, null, 2));
    results.jsonUpdated = true;
  }

  return c.json({
    success: true,
    results,
    message: `Sync completed: ${results.experiences.created + results.experiences.updated} experiences, ${results.skills.created + results.skills.updated} skills, ${results.education.created + results.education.updated} education entries processed`,
  });
});

export default resumeAdmin;
