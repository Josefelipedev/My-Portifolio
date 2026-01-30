import prisma from '@/lib/prisma';
import HeroClient from './HeroClient';

async function getSiteConfig() {
  const config = await prisma.siteConfig.findUnique({
    where: { id: 'main' },
  });
  return config || {
    githubUrl: 'https://github.com/Josefelipedev',
    linkedinUrl: null,
    email: 'josefelipedev@gmail.com',
  };
}

async function getEducation() {
  try {
    const education = await prisma.education.findMany({
      orderBy: [{ order: 'asc' }, { startDate: 'desc' }],
    });
    return education;
  } catch {
    return [];
  }
}

export async function HeroSection() {
  const [config, education] = await Promise.all([
    getSiteConfig(),
    getEducation(),
  ]);

  return (
    <HeroClient
      githubUrl={config.githubUrl}
      linkedinUrl={config.linkedinUrl}
      email={config.email}
      education={education.map(edu => ({
        id: edu.id,
        title: edu.title,
        institution: edu.institution,
        type: edu.type,
        status: edu.status,
        startDate: edu.startDate,
        endDate: edu.endDate,
        location: edu.location,
        certificateUrl: edu.certificateUrl,
      }))}
    />
  );
}
