import { SectionWrapper } from '../ui/SectionWrapper';
import { GradientText } from '../ui/GradientText';
import prisma from '@/lib/prisma';

async function getEducation() {
  try {
    const education = await prisma.education.findMany({
      orderBy: [{ startDate: 'desc' }, { order: 'asc' }, { createdAt: 'desc' }],
    });
    return education;
  } catch {
    // Table might not exist yet
    return [];
  }
}

function formatDate(date: Date | null): string {
  if (!date) return 'Present';
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function getTypeConfig(type: string) {
  switch (type) {
    case 'degree':
      return {
        label: 'Degree',
        color: 'from-red-500 to-rose-500',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        textColor: 'text-red-700 dark:text-red-400',
        borderColor: 'border-red-500',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          </svg>
        ),
      };
    case 'course':
      return {
        label: 'Course',
        color: 'from-blue-500 to-cyan-500',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        textColor: 'text-blue-700 dark:text-blue-400',
        borderColor: 'border-blue-500',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        ),
      };
    case 'certification':
      return {
        label: 'Certification',
        color: 'from-green-500 to-emerald-500',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        textColor: 'text-green-700 dark:text-green-400',
        borderColor: 'border-green-500',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        ),
      };
    default:
      return {
        label: 'Education',
        color: 'from-purple-500 to-pink-500',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
        textColor: 'text-purple-700 dark:text-purple-400',
        borderColor: 'border-purple-500',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
          </svg>
        ),
      };
  }
}

export async function EducationSection() {
  const education = await getEducation();

  return (
    <SectionWrapper id="education" className="bg-zinc-50/50 dark:bg-zinc-900/50">
      <div className="text-center mb-16">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          My <GradientText>Education</GradientText>
        </h2>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
          My academic journey, courses, and certifications
        </p>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 mt-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-rose-500" />
            <span className="text-zinc-600 dark:text-zinc-400">Degrees</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" />
            <span className="text-zinc-600 dark:text-zinc-400">Courses</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500" />
            <span className="text-zinc-600 dark:text-zinc-400">Certifications</span>
          </div>
        </div>
      </div>

      {education.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400">
            No education entries yet. Add some from the admin panel!
          </p>
        </div>
      ) : (
        <div className="relative max-w-4xl mx-auto">
          {/* SVG Wave Path - Hidden on mobile */}
          <svg
            className="absolute left-1/2 -translate-x-1/2 top-0 h-full w-full hidden md:block pointer-events-none"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
            style={{ height: `${education.length * 280}px` }}
          >
            <defs>
              <linearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>
            <path
              d={`M 50 0 ${education.map((_, i) => {
                const y = ((i + 0.5) / education.length) * 100;
                const curve = i % 2 === 0 ? 'C 20' : 'C 80';
                const controlY1 = ((i + 0.2) / education.length) * 100;
                const controlY2 = ((i + 0.8) / education.length) * 100;
                return `${curve} ${controlY1}, ${i % 2 === 0 ? '80' : '20'} ${controlY2}, 50 ${y}`;
              }).join(' ')} L 50 100`}
              fill="none"
              stroke="url(#waveGradient)"
              strokeWidth="0.5"
              strokeLinecap="round"
              opacity="0.3"
            />
          </svg>

          {/* Mobile Timeline Line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-red-500 via-blue-500 to-green-500 md:hidden" />

          {/* Timeline items */}
          <div className="space-y-8 md:space-y-16">
            {education.map((edu, index) => {
              const config = getTypeConfig(edu.type);
              const isLeft = index % 2 === 0;

              return (
                <div
                  key={edu.id}
                  className={`relative animate-fade-in-up ${
                    isLeft ? 'md:pr-[52%]' : 'md:pl-[52%]'
                  }`}
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  {/* Timeline dot - Desktop */}
                  <div
                    className={`hidden md:flex absolute top-6 left-1/2 -translate-x-1/2 w-10 h-10 bg-gradient-to-r ${config.color} rounded-full items-center justify-center text-white shadow-lg ring-4 ring-white dark:ring-zinc-900 z-10`}
                  >
                    {config.icon}
                  </div>

                  {/* Timeline dot - Mobile */}
                  <div
                    className={`md:hidden absolute left-4 top-6 -translate-x-1/2 w-8 h-8 bg-gradient-to-r ${config.color} rounded-full flex items-center justify-center text-white shadow-lg ring-4 ring-white dark:ring-zinc-900 z-10`}
                  >
                    {config.icon}
                  </div>

                  {/* Content card */}
                  <div className={`ml-10 md:ml-0 ${isLeft ? 'md:mr-8' : 'md:ml-8'}`}>
                    <div className={`bg-white dark:bg-zinc-800 rounded-2xl p-5 shadow-lg border-l-4 ${config.borderColor} hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}>
                      {/* Type badge */}
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${config.bgColor} ${config.textColor} text-xs font-medium mb-3`}>
                        {config.label}
                      </div>

                      {/* Title & Institution */}
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                        {edu.title}
                      </h3>
                      <p className={`font-medium ${config.textColor.replace('text-', 'text-').replace('-700', '-600').replace('-400', '-500')}`}>
                        {edu.institution}
                      </p>

                      {/* Meta info */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {formatDate(edu.startDate)} - {formatDate(edu.endDate)}
                        </span>
                        {edu.location && (
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {edu.location}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      {edu.description && (
                        <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-3 line-clamp-3">
                          {edu.description}
                        </p>
                      )}

                      {/* Certificate link */}
                      {edu.certificateUrl && (
                        <a
                          href={edu.certificateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 mt-3 text-sm font-medium ${config.textColor} hover:underline`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          View Certificate
                        </a>
                      )}

                      {/* Status badge */}
                      {!edu.endDate && (
                        <div className="mt-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium">
                          <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                          In Progress
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </SectionWrapper>
  );
}
