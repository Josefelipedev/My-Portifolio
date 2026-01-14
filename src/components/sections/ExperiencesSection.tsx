import { SectionWrapper } from '../ui/SectionWrapper';
import { GradientText } from '../ui/GradientText';
import { SkillBadge } from '../ui/SkillBadge';
import prisma from '@/lib/prisma';

async function getExperiences() {
  const experiences = await prisma.experience.findMany({
    orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
  });
  return experiences;
}

function formatDate(date: Date | null): string {
  if (!date) return 'Present';
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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
          <div className="absolute left-0 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 to-purple-500 transform md:-translate-x-1/2" />

          {/* Timeline items */}
          <div className="space-y-12">
            {experiences.map((exp, index) => (
              <div
                key={exp.id}
                className={`relative flex flex-col md:flex-row gap-8 animate-fade-in-up ${
                  index % 2 === 0 ? 'md:flex-row-reverse' : ''
                }`}
                style={{ animationDelay: `${index * 150}ms` }}
              >
                {/* Timeline dot */}
                <div className="absolute left-0 md:left-1/2 w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transform -translate-x-1.5 md:-translate-x-2 ring-4 ring-white dark:ring-zinc-900" />

                {/* Date (visible on mobile) */}
                <div className="md:hidden pl-8 text-sm text-zinc-500">
                  {formatDate(exp.startDate)} - {formatDate(exp.endDate)}
                </div>

                {/* Content card */}
                <div className={`md:w-1/2 ${index % 2 === 0 ? 'md:pr-12' : 'md:pl-12'} pl-8 md:pl-0`}>
                  <div className="bg-white dark:bg-zinc-800 rounded-2xl p-6 shadow-lg border border-zinc-200 dark:border-zinc-700 hover:shadow-xl transition-shadow duration-300">
                    {/* Header */}
                    <div className="mb-4">
                      <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                        {exp.title}
                      </h3>
                      {exp.company && (
                        <p className="text-blue-500 font-medium">{exp.company}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-sm text-zinc-500">
                        {/* Date (hidden on mobile, visible on desktop) */}
                        <span className="hidden md:inline">
                          {formatDate(exp.startDate)} - {formatDate(exp.endDate)}
                        </span>
                        {exp.location && (
                          <>
                            <span className="hidden md:inline">•</span>
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {exp.location}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                      {exp.description}
                    </p>

                    {/* Responsibilities */}
                    {exp.responsibilities && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                          Key Responsibilities
                        </h4>
                        <ul className="space-y-1">
                          {exp.responsibilities.split(',').map((resp, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                              <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>{resp.trim()}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Challenges */}
                    {exp.challenges && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                          Challenges Overcome
                        </h4>
                        <ul className="space-y-1">
                          {exp.challenges.split(',').map((challenge, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                              <svg className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              <span>{challenge.trim()}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Technologies */}
                    <div className="flex flex-wrap gap-2">
                      {exp.technologies.split(',').map((tech) => (
                        <SkillBadge key={tech} name={tech.trim()} size="sm" variant="gradient" />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Empty space for timeline alignment */}
                <div className="hidden md:block md:w-1/2" />
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionWrapper>
  );
}
