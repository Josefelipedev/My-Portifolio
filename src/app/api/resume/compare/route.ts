import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { promises as fs } from 'fs';
import path from 'path';
import type { ResumeAnalysis } from '@/lib/claude';

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

export async function POST(request: Request) {
  try {
    // Check authentication
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { analysis } = body as { analysis: ResumeAnalysis };

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis data is required' }, { status: 400 });
    }

    const result: ComparisonResult = {
      experiences: [],
      skills: [],
      summary: {
        experiences: { add: 0, update: 0, remove: 0, keep: 0 },
        skills: { add: 0, update: 0, remove: 0, keep: 0 },
      },
    };

    // Get existing experiences
    const existingExperiences = await prisma.experience.findMany({
      orderBy: { startDate: 'desc' },
    });

    // Get existing skills
    const existingSkills = await prisma.skill.findMany({
      orderBy: { name: 'asc' },
    });

    // Compare Experiences
    const processedExpIds = new Set<string>();

    for (const newExp of analysis.experience || []) {
      // Find matching experience by title + company
      const existing = existingExperiences.find(
        (e) =>
          e.title.toLowerCase() === newExp.title.toLowerCase() &&
          (e.company || '').toLowerCase() === newExp.company.toLowerCase()
      );

      if (existing) {
        processedExpIds.add(existing.id);

        // Check for changes
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
          changes.push(`Data início: "${existing.startDate?.toISOString().slice(0, 7) || '(vazio)'}" → "${newExp.startDate}"`);
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
        // New experience
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

    // Check for experiences to remove (exist in DB but not in new analysis)
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
      // Find matching skill by name (case-insensitive)
      const existing = existingSkills.find(
        (s) => s.name.toLowerCase() === newSkill.name.toLowerCase()
      );

      if (existing) {
        processedSkillIds.add(existing.id);

        // Check for changes
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
        // New skill
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

    // Check for skills to remove (exist in DB but not in new analysis)
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

    return NextResponse.json({
      success: true,
      comparison: result,
    });
  } catch (error) {
    console.error('Error comparing resume data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compare resume data' },
      { status: 500 }
    );
  }
}
