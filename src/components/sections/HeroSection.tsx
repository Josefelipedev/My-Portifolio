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

export async function HeroSection() {
  const config = await getSiteConfig();

  return (
    <HeroClient
      githubUrl={config.githubUrl}
      linkedinUrl={config.linkedinUrl}
      email={config.email}
    />
  );
}
