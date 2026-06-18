import { Navigation } from '@/components/ui/Navigation';
import { HeroSection } from '@/components/sections/HeroSection';
import { AboutSection } from '@/components/sections/AboutSection';
import { GitHubStatsSection } from '@/components/sections/GitHubStatsSection';
// WakaTimeStatsSection: temporarily out of the edge build — its data comes from
// lib/wakatime (raw SQL + external API) not yet ported to apps/api. Re-add once
// the WakaTime backend is on the API service.
import { SkillsSection } from '@/components/sections/SkillsSection';
import { ProjectsSection } from '@/components/sections/ProjectsSection';
import { ExperiencesSection } from '@/components/sections/ExperiencesSection';
import { BooksSection } from '@/components/sections/BooksSection';
import { ContactSection } from '@/components/sections/ContactSection';
import { Footer } from '@/components/ui/Footer';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen">
        <HeroSection />
        <AboutSection />
        <GitHubStatsSection />
        <SkillsSection />
        <ProjectsSection />
        <ExperiencesSection />
        <BooksSection />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}
