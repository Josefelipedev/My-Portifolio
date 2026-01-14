/**
 * Script to sync skills from resume.json to the database
 * Run with: npx tsx scripts/sync-resume-skills.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import resumeData from '../src/data/resume.json';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function syncSkills() {
  console.log('Starting skills sync from resume...');

  const skills = resumeData.skills;

  for (let i = 0; i < skills.length; i++) {
    const skill = skills[i];

    // Check if skill already exists
    const existing = await prisma.skill.findFirst({
      where: { name: skill.name },
    });

    if (existing) {
      // Update existing skill
      await prisma.skill.update({
        where: { id: existing.id },
        data: {
          level: skill.level,
          category: skill.category,
          order: i,
        },
      });
      console.log(`Updated: ${skill.name} (level: ${skill.level})`);
    } else {
      // Create new skill
      await prisma.skill.create({
        data: {
          name: skill.name,
          level: skill.level,
          category: skill.category,
          order: i,
        },
      });
      console.log(`Created: ${skill.name} (level: ${skill.level})`);
    }
  }

  console.log('\nSkills sync completed!');
}

async function syncExperiences() {
  console.log('\nStarting experiences sync from resume...');

  const experiences = resumeData.experience;

  for (const exp of experiences) {
    // Check if experience already exists by title and company
    const existing = await prisma.experience.findFirst({
      where: {
        title: exp.title,
        company: exp.company,
      },
    });

    const experienceData = {
      title: exp.title,
      company: exp.company,
      location: exp.location,
      description: exp.responsibilities.join('. '),
      responsibilities: exp.responsibilities.join(', '),
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
      console.log(`Updated: ${exp.title} at ${exp.company}`);
    } else {
      await prisma.experience.create({
        data: experienceData,
      });
      console.log(`Created: ${exp.title} at ${exp.company}`);
    }
  }

  console.log('\nExperiences sync completed!');
}

async function main() {
  try {
    await syncSkills();
    await syncExperiences();
  } catch (error) {
    console.error('Error syncing data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
