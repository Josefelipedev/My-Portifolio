import { SectionWrapper } from '../ui/SectionWrapper';
import { GradientText } from '../ui/GradientText';
import { ExperienceCard } from './ExperienceCard';
import prisma from '@/lib/prisma';

async function getExperiences() {
  const experiences = await prisma.experience.findMany({
    orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
  });
  return experiences;
}

export async function ExperiencesSection() {
  const experiences = await getExperiences();

  return (
    <SectionWrapper id="experience" className="bg-zinc-50/50 dark:bg-zinc-900/50">
      <div className="text-center mb-16">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          Work <GradientText>Experience</GradientText>
        </h2>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
          My professional journey and the experiences that shaped my career
        </p>
      </div>

      {experiences.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400">
            No experiences yet. Add some from the admin panel!
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-0 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-red-500 to-purple-500 transform md:-translate-x-1/2" />

          {/* Timeline items */}
          <div className="space-y-12">
            {experiences.map((exp, index) => (
              <ExperienceCard key={exp.id} exp={exp} index={index} />
            ))}
          </div>
        </div>
      )}
    </SectionWrapper>
  );
}
