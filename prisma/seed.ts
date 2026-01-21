/**
 * Prisma Seed - Popula o banco de dados com dados iniciais
 * Run: npx prisma db seed
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting seed...\n');

  // =============================================
  // 1. Create Admin User
  // =============================================
  const adminEmail = process.env.SMTP_USER || 'josefelipedev@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || '94750286Ze@';

  const existingUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingUser) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: 'Jose Felipe',
        isActive: true,
      },
    });
    console.log(`✅ Admin user created: ${adminEmail}`);
  } else {
    console.log(`⏭️  Admin user already exists: ${adminEmail}`);
  }

  // =============================================
  // 2. Create Site Config
  // =============================================
  const existingConfig = await prisma.siteConfig.findUnique({
    where: { id: 'main' },
  });

  if (!existingConfig) {
    await prisma.siteConfig.create({
      data: {
        id: 'main',
        name: 'Jose Felipe',
        title: 'Full Stack Developer',
        bio: 'Full-stack developer with a strong emphasis on back-end development and proven experience in designing and implementing modern, scalable solutions.',
        githubUrl: 'https://github.com/Josefelipedev',
        linkedinUrl: 'https://www.linkedin.com/in/jose-felipe-almeida-da-silva-a29665210/',
        email: 'josefelipedev@gmail.com',
        location: 'Faro, Portugal',
      },
    });
    console.log('✅ Site config created');
  } else {
    console.log('⏭️  Site config already exists');
  }

  // =============================================
  // 3. Create Initial Site Stats
  // =============================================
  const existingStats = await prisma.siteStats.findUnique({
    where: { id: 'main' },
  });

  if (!existingStats) {
    await prisma.siteStats.create({
      data: {
        id: 'main',
        totalVisits: 0,
        uniqueVisits: 0,
      },
    });
    console.log('✅ Site stats initialized');
  } else {
    console.log('⏭️  Site stats already exists');
  }

  // =============================================
  // 4. Import Skills from Resume
  // =============================================
  const skillsCount = await prisma.skill.count();

  if (skillsCount === 0) {
    const skills = [
      { name: 'React', level: 4, category: 'frontend', order: 0 },
      { name: 'Next.js', level: 4, category: 'frontend', order: 1 },
      { name: 'TypeScript', level: 4, category: 'frontend', order: 2 },
      { name: 'Tailwind CSS', level: 4, category: 'frontend', order: 3 },
      { name: 'Node.js', level: 4, category: 'backend', order: 0 },
      { name: 'PHP', level: 3, category: 'backend', order: 1 },
      { name: 'Laravel', level: 3, category: 'backend', order: 2 },
      { name: 'PostgreSQL', level: 4, category: 'backend', order: 3 },
      { name: 'Redis', level: 3, category: 'backend', order: 4 },
      { name: 'Docker', level: 3, category: 'devops', order: 0 },
      { name: 'Git', level: 5, category: 'devops', order: 1 },
      { name: 'Linux', level: 4, category: 'devops', order: 2 },
    ];

    for (const skill of skills) {
      await prisma.skill.create({ data: skill });
    }
    console.log(`✅ Created ${skills.length} skills`);
  } else {
    console.log(`⏭️  Skills already exist (${skillsCount} found)`);
  }

  console.log('\n🎉 Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
