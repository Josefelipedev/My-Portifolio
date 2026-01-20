'use client';

import TypewriterText from '../ui/TypewriterText';
import { GradientText } from '../ui/GradientText';
import { useLanguage } from '@/lib/i18n';

interface HeroClientProps {
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  email?: string | null;
}

export default function HeroClient({ githubUrl, linkedinUrl, email }: HeroClientProps) {
  const { t, language } = useLanguage();

  const titles = language === 'pt'
    ? [t.hero.role, 'Solucionador de Problemas', 'Entusiasta de Tech', 'Artesão de Código']
    : [t.hero.role, 'Problem Solver', 'Tech Enthusiast', 'Code Artisan'];

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16"
    >
      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        {/* Greeting */}
        <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-4 animate-fade-in-up">
          {t.hero.greeting}
        </p>

        {/* Name */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold mb-6 animate-fade-in-up delay-100">
          <GradientText animate>{t.hero.name}</GradientText>
        </h1>

        {/* Title with typewriter effect */}
        <h2 className="text-2xl sm:text-3xl md:text-4xl text-zinc-700 dark:text-zinc-300 font-medium mb-8 animate-fade-in-up delay-200 h-12">
          <TypewriterText
            texts={titles}
            speed={80}
            deleteSpeed={40}
            delayBetween={2500}
            className="bg-gradient-to-r from-red-500 via-purple-500 to-pink-500 bg-clip-text text-transparent"
          />
        </h2>

        {/* Description */}
        <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-12 animate-fade-in-up delay-300 leading-relaxed">
          {t.hero.description}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-400">
          <a
            href="#projects"
            className="group relative px-8 py-4 bg-gradient-to-r from-red-500 to-purple-500 text-white font-medium rounded-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-red-500/30"
          >
            <span className="relative z-10">
              {language === 'pt' ? 'Ver Meus Projetos' : 'View My Work'}
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </a>
          <a
            href="#contact"
            className="group px-8 py-4 border-2 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium rounded-full hover:border-red-500 dark:hover:border-red-500 hover:text-red-500 dark:hover:text-red-400 transition-all duration-300 hover:-translate-y-1"
          >
            {t.hero.cta}
          </a>
        </div>

        {/* Social Links */}
        <div className="flex items-center justify-center gap-6 mt-12 animate-fade-in-up delay-500">
          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group p-3 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-gradient-to-r hover:from-red-500 hover:to-purple-500 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/25"
              aria-label="GitHub"
            >
              <svg className="w-6 h-6 text-zinc-600 dark:text-zinc-400 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            </a>
          )}
          {linkedinUrl && (
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group p-3 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-gradient-to-r hover:from-red-500 hover:to-purple-500 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/25"
              aria-label="LinkedIn"
            >
              <svg className="w-6 h-6 text-zinc-600 dark:text-zinc-400 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>
          )}
          {email && (
            <a
              href={`mailto:${email}`}
              className="group p-3 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-gradient-to-r hover:from-red-500 hover:to-purple-500 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/25"
              aria-label="Email"
            >
              <svg className="w-6 h-6 text-zinc-600 dark:text-zinc-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </a>
          )}
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="flex flex-col items-center gap-2 animate-bounce">
            <span className="text-sm text-zinc-400">
              {language === 'pt' ? 'Role para baixo' : 'Scroll Down'}
            </span>
            <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
