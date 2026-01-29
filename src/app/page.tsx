import { Navigation } from '@/components/ui/Navigation';
import { HeroSection } from '@/components/sections/HeroSection';
import { AboutSection } from '@/components/sections/AboutSection';
import { GitHubStatsSection } from '@/components/sections/GitHubStatsSection';
import { WakaTimeStatsSection } from '@/components/sections/WakaTimeStatsSection';
import { SkillsSection } from '@/components/sections/SkillsSection';
import { EducationSection } from '@/components/sections/EducationSection';
import { ProjectsSection } from '@/components/sections/ProjectsSection';
import { ExperiencesSection } from '@/components/sections/ExperiencesSection';
import { ContactSection } from '@/components/sections/ContactSection';
import { Footer } from '@/components/ui/Footer';

export default function Home() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen">
        <HeroSection />
        <AboutSection />
        <GitHubStatsSection />
        <WakaTimeStatsSection />
        <SkillsSection />
        <EducationSection />
        <ProjectsSection />
        <ExperiencesSection />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}
