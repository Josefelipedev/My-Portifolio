import { SectionWrapper } from '../ui/SectionWrapper';
import { GradientText } from '../ui/GradientText';
import prisma from '@/lib/prisma';

async function getSiteConfig() {
  const config = await prisma.siteConfig.findUnique({
    where: { id: 'main' },
  });
  return config || {
    name: 'Your Name',
    title: 'Full Stack Developer',
    bio: 'Passionate about building amazing digital experiences.',
    avatarUrl: null,
    location: null,
    email: null,
  };
}

export async function AboutSection() {
  const config = await getSiteConfig();

  return (
    <SectionWrapper id="about">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        {/* Avatar */}
        <div className="flex justify-center">
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur-2xl opacity-30 animate-pulse-glow" />

            {/* Avatar container */}
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-full overflow-hidden border-4 border-white dark:border-zinc-800 shadow-2xl">
              {config.avatarUrl ? (
                <img
                  src={config.avatarUrl}
                  alt={config.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                  <span className="text-6xl text-white font-bold">
                    {config.name.charAt(0)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="text-center md:text-left">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            About <GradientText>Me</GradientText>
          </h2>

          <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
            {config.bio || "I'm a passionate developer who loves creating beautiful and functional applications. I believe in writing clean, maintainable code and staying up-to-date with the latest technologies."}
          </p>

          {/* Quick facts */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            {config.location && (
              <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{config.location}</span>
              </div>
            )}
            {config.email && (
              <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>{config.email}</span>
              </div>
            )}
          </div>

          {/* Download CV Button */}
          <a
            href="#contact"
            className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Get In Touch
          </a>
        </div>
      </div>
    </SectionWrapper>
  );
}
