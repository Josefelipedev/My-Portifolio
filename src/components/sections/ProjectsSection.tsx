import { SectionWrapper } from '../ui/SectionWrapper';
import { GradientText } from '../ui/GradientText';
import prisma from '@/lib/prisma';
import ProjectCard from './ProjectCard';

interface Project {
  id: string;
  title: string;
  description: string;
  technologies: string;
  repoUrl: string;
  demoUrl: string | null;
  imageUrl: string | null;
  stars: number | null;
  featured: boolean;
  source: string;
  aiSummary: string | null;
  rank: number | null;
  isPrivate: boolean;
}

async function getProjects(): Promise<Project[]> {
  const projects = await prisma.project.findMany({
    orderBy: [
      { rank: 'asc' },
      { featured: 'desc' },
      { stars: 'desc' },
      { createdAt: 'desc' },
    ],
  });
  return projects;
}

export async function ProjectsSection() {
  const projects = await getProjects();

  // Separate top 3 (ranked) projects from the rest
  const topProjects = projects
    .filter((p) => p.rank !== null)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const otherProjects = projects.filter((p) => p.rank === null);

  return (
    <SectionWrapper id="projects">
      <div className="text-center mb-16">
        <span className="inline-block px-4 py-2 bg-blue-500/10 text-blue-400 rounded-full text-sm font-medium mb-4">
          Portfolio
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          My <GradientText>Projects</GradientText>
        </h2>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
          A selection of projects I&apos;ve built and contributed to
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-6 bg-slate-800 rounded-2xl flex items-center justify-center">
            <svg className="w-10 h-10 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-zinc-300 mb-2">No projects yet</h3>
          <p className="text-zinc-500">
            Add some from the admin panel or import from GitHub!
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Top 3 Featured Projects - Larger Cards */}
          {topProjects.length > 0 && (
            <div className="space-y-6">
              {topProjects.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  index={index}
                  variant="featured"
                />
              ))}
            </div>
          )}

          {/* Other Projects - Standard Grid */}
          {otherProjects.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {otherProjects.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  index={topProjects.length + index}
                  variant="default"
                />
              ))}
            </div>
          )}
        </div>
      )}
    </SectionWrapper>
  );
}
