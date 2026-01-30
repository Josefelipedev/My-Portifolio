import { SectionWrapper } from '../ui/SectionWrapper';
import { GradientText } from '../ui/GradientText';
import prisma from '@/lib/prisma';

async function getEducation() {
  try {
    const education = await prisma.education.findMany({
      orderBy: [{ startDate: 'desc' }, { order: 'asc' }, { createdAt: 'desc' }],
    });
    console.log('[EducationSection] Found', education.length, 'education entries');
    return education;
  } catch (error) {
    console.error('[EducationSection] Error fetching education:', error);
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
        gradient: 'from-red-500 to-rose-600',
        bg: 'bg-red-500/10',
        text: 'text-red-500',
        border: 'border-red-500/30',
      };
    case 'course':
      return {
        label: 'Course',
        gradient: 'from-blue-500 to-cyan-500',
        bg: 'bg-blue-500/10',
        text: 'text-blue-500',
        border: 'border-blue-500/30',
      };
    case 'certification':
      return {
        label: 'Certification',
        gradient: 'from-green-500 to-emerald-500',
        bg: 'bg-green-500/10',
        text: 'text-green-500',
        border: 'border-green-500/30',
      };
    default:
      return {
        label: 'Education',
        gradient: 'from-purple-500 to-pink-500',
        bg: 'bg-purple-500/10',
        text: 'text-purple-500',
        border: 'border-purple-500/30',
      };
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'degree':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        </svg>
      );
    case 'course':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case 'certification':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
        </svg>
      );
  }
}

export async function EducationSection() {
  const education = await getEducation();

  // Split education into left and right columns for U-shape
  const leftItems = education.filter((_, i) => i % 2 === 0);
  const rightItems = education.filter((_, i) => i % 2 === 1);

  return (
    <SectionWrapper id="education">
      <div className="text-center mb-16">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          My <GradientText>Education</GradientText>
        </h2>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
          Academic journey, courses, and certifications
        </p>
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
        <div className="relative max-w-5xl mx-auto">
          {/* U-Shape Timeline Container */}
          <div className="relative">
            {/* SVG U-Shape Path */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none hidden md:block"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="uGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="50%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>
              {/* Left vertical line */}
              <line
                x1="10%"
                y1="0"
                x2="10%"
                y2={`${Math.max(leftItems.length * 15, 50)}%`}
                stroke="url(#uGradient)"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.3"
              />
              {/* Bottom curve */}
              <path
                d={`M ${10}% ${Math.max(leftItems.length * 15, 50)}% Q 50% ${Math.max(leftItems.length * 15 + 20, 70)}% ${90}% ${Math.max(rightItems.length * 15, 50)}%`}
                fill="none"
                stroke="url(#uGradient)"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.3"
              />
              {/* Right vertical line */}
              <line
                x1="90%"
                y1="0"
                x2="90%"
                y2={`${Math.max(rightItems.length * 15, 50)}%`}
                stroke="url(#uGradient)"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.3"
              />
            </svg>

            {/* Mobile: Single column with vertical line */}
            <div className="md:hidden relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-red-500 via-purple-500 to-red-500 opacity-30" />
              <div className="space-y-6 pl-12">
                {education.map((edu, index) => {
                  const config = getTypeConfig(edu.type);
                  return (
                    <div
                      key={edu.id}
                      className="relative animate-fade-in-up"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {/* Timeline dot */}
                      <div className={`absolute -left-12 top-4 w-8 h-8 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center text-white shadow-lg ring-4 ring-white dark:ring-zinc-900`}>
                        {getTypeIcon(edu.type)}
                      </div>

                      {/* Card */}
                      <div className="bg-white dark:bg-zinc-800 rounded-2xl p-5 shadow-lg border border-zinc-200 dark:border-zinc-700 hover:shadow-xl transition-all duration-300">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg} ${config.text} text-xs font-medium mb-3`}>
                          {getTypeIcon(edu.type)}
                          <span>{config.label}</span>
                        </div>

                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                          {edu.title}
                        </h3>
                        <p className={`font-medium ${config.text} mb-2`}>
                          {edu.institution}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-3">
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
                              </svg>
                              {edu.location}
                            </span>
                          )}
                        </div>

                        {edu.description && (
                          <p className="text-zinc-600 dark:text-zinc-400 text-sm line-clamp-2">
                            {edu.description}
                          </p>
                        )}

                        {!edu.endDate && (
                          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium">
                            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                            In Progress
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Desktop: Two columns forming U-shape */}
            <div className="hidden md:grid md:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-6">
                {leftItems.map((edu, index) => {
                  const config = getTypeConfig(edu.type);
                  return (
                    <div
                      key={edu.id}
                      className="relative animate-fade-in-up"
                      style={{ animationDelay: `${index * 150}ms` }}
                    >
                      {/* Timeline dot */}
                      <div className={`absolute -left-4 top-4 w-8 h-8 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center text-white shadow-lg ring-4 ring-white dark:ring-zinc-900 z-10`}>
                        {getTypeIcon(edu.type)}
                      </div>

                      {/* Connector line */}
                      <div className="absolute -left-8 top-7 w-4 h-0.5 bg-gradient-to-r from-transparent to-red-500/30" />

                      {/* Card */}
                      <div className="ml-6 bg-white dark:bg-zinc-800 rounded-2xl p-5 shadow-lg border border-zinc-200 dark:border-zinc-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg} ${config.text} text-xs font-medium mb-3`}>
                          {getTypeIcon(edu.type)}
                          <span>{config.label}</span>
                        </div>

                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                          {edu.title}
                        </h3>
                        <p className={`font-medium ${config.text} mb-2`}>
                          {edu.institution}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-3">
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
                              </svg>
                              {edu.location}
                            </span>
                          )}
                        </div>

                        {edu.description && (
                          <p className="text-zinc-600 dark:text-zinc-400 text-sm line-clamp-2">
                            {edu.description}
                          </p>
                        )}

                        {edu.certificateUrl && (
                          <a
                            href={edu.certificateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1 mt-3 text-sm font-medium ${config.text} hover:underline`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            View Certificate
                          </a>
                        )}

                        {!edu.endDate && (
                          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium">
                            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                            In Progress
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Column */}
              <div className="space-y-6 mt-12">
                {rightItems.map((edu, index) => {
                  const config = getTypeConfig(edu.type);
                  return (
                    <div
                      key={edu.id}
                      className="relative animate-fade-in-up"
                      style={{ animationDelay: `${(index + leftItems.length) * 150}ms` }}
                    >
                      {/* Timeline dot */}
                      <div className={`absolute -right-4 top-4 w-8 h-8 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center text-white shadow-lg ring-4 ring-white dark:ring-zinc-900 z-10`}>
                        {getTypeIcon(edu.type)}
                      </div>

                      {/* Connector line */}
                      <div className="absolute -right-8 top-7 w-4 h-0.5 bg-gradient-to-l from-transparent to-red-500/30" />

                      {/* Card */}
                      <div className="mr-6 bg-white dark:bg-zinc-800 rounded-2xl p-5 shadow-lg border border-zinc-200 dark:border-zinc-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg} ${config.text} text-xs font-medium mb-3`}>
                          {getTypeIcon(edu.type)}
                          <span>{config.label}</span>
                        </div>

                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                          {edu.title}
                        </h3>
                        <p className={`font-medium ${config.text} mb-2`}>
                          {edu.institution}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-3">
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
                              </svg>
                              {edu.location}
                            </span>
                          )}
                        </div>

                        {edu.description && (
                          <p className="text-zinc-600 dark:text-zinc-400 text-sm line-clamp-2">
                            {edu.description}
                          </p>
                        )}

                        {edu.certificateUrl && (
                          <a
                            href={edu.certificateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1 mt-3 text-sm font-medium ${config.text} hover:underline`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            View Certificate
                          </a>
                        )}

                        {!edu.endDate && (
                          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium">
                            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                            In Progress
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom curve indicator - shows only on desktop when there are items on both sides */}
            {leftItems.length > 0 && rightItems.length > 0 && (
              <div className="hidden md:flex justify-center mt-8">
                <div className="w-32 h-8 relative">
                  <div className="absolute inset-0 border-b-2 border-l-2 border-r-2 border-red-500/20 rounded-b-full" />
                  <div className="absolute left-1/2 -translate-x-1/2 -bottom-3 w-6 h-6 bg-gradient-to-br from-red-500 to-purple-500 rounded-full flex items-center justify-center text-white shadow-lg">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-6 mt-12">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-rose-600" />
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
      )}
    </SectionWrapper>
  );
}
