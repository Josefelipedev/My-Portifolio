import HeroClient from './HeroClient';
import { getSiteConfig, getEducation } from '@/lib/data/content';

const DEFAULT_CONFIG: { githubUrl: string | null; linkedinUrl: string | null; email: string | null } = {
  githubUrl: 'https://github.com/Josefelipedev',
  linkedinUrl: null,
  email: 'josefelipedev@gmail.com',
};

async function getVisibleEducation() {
  try {
    const education = await getEducation();
    return education.filter((edu) => edu.visible).sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}

export async function HeroSection() {
  const [config, education] = await Promise.all([getSiteConfig(), getVisibleEducation()]);

  return (
    <HeroClient
      githubUrl={config?.githubUrl ?? DEFAULT_CONFIG.githubUrl}
      linkedinUrl={config?.linkedinUrl ?? DEFAULT_CONFIG.linkedinUrl}
      email={config?.email ?? DEFAULT_CONFIG.email}
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
