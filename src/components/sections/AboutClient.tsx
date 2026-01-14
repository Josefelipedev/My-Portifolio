'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLanguage } from '@/lib/i18n';
import { SectionWrapper } from '../ui/SectionWrapper';
import { GradientText } from '../ui/GradientText';

interface AboutClientProps {
  readme: string;
  user: {
    name: string;
    login: string;
    avatar: string;
    bio: string;
    location: string | null;
    email: string | null;
    company: string | null;
    blog: string | null;
  } | null;
}

export function AboutClient({ readme, user }: AboutClientProps) {
  const { t, language } = useLanguage();

  // Clean up README - remove images, badges, and stats cards that don't render well
  const cleanReadme = readme
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
    .replace(/<img[^>]*>/g, '') // Remove img tags
    .replace(/<picture>[\s\S]*?<\/picture>/g, '') // Remove picture tags
    .replace(/<a[^>]*>[\s\S]*?<\/a>/g, (match) => {
      // Keep text links but remove image links
      if (match.includes('<img')) return '';
      return match;
    })
    .replace(/\[!\[.*?\]\(.*?\)\]\(.*?\)/g, '') // Remove badge links
    .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
    .replace(/<div[^>]*>[\s\S]*?<\/div>/g, '') // Remove div blocks
    .replace(/<p[^>]*align[^>]*>[\s\S]*?<\/p>/g, '') // Remove aligned paragraphs (usually badges)
    .replace(/\n{3,}/g, '\n\n') // Clean up multiple newlines
    .trim();

  const displayName = user?.name || 'Jose Felipe';
  const avatarUrl = user?.avatar || null;

  return (
    <SectionWrapper id="about">
      <div className="grid md:grid-cols-2 gap-12 items-start">
        {/* Avatar */}
        <div className="flex justify-center">
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur-2xl opacity-30 animate-pulse-glow" />

            {/* Avatar container */}
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-full overflow-hidden border-4 border-white dark:border-zinc-800 shadow-2xl">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                  <span className="text-6xl text-white font-bold">
                    {displayName.charAt(0)}
                  </span>
                </div>
              )}
            </div>

            {/* User info below avatar */}
            {user && (
              <div className="mt-6 text-center space-y-2">
                {user.location && (
                  <div className="flex items-center justify-center gap-2 text-zinc-400">
                    <LocationIcon />
                    <span className="text-sm">{user.location}</span>
                  </div>
                )}
                {user.company && (
                  <div className="flex items-center justify-center gap-2 text-zinc-400">
                    <CompanyIcon />
                    <span className="text-sm">{user.company}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="text-center md:text-left">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            {language === 'pt' ? (
              <>
                Sobre <GradientText>Mim</GradientText>
              </>
            ) : (
              <>
                About <GradientText>Me</GradientText>
              </>
            )}
          </h2>

          {/* README Content or fallback bio */}
          {cleanReadme ? (
            <div className="prose prose-invert prose-zinc max-w-none mb-8">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h3 className="text-xl font-bold text-white mt-4 mb-2">{children}</h3>
                  ),
                  h2: ({ children }) => (
                    <h4 className="text-lg font-semibold text-white mt-4 mb-2">{children}</h4>
                  ),
                  h3: ({ children }) => (
                    <h5 className="text-base font-semibold text-zinc-200 mt-3 mb-2">{children}</h5>
                  ),
                  p: ({ children }) => (
                    <p className="text-zinc-400 mb-3 leading-relaxed">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside text-zinc-400 mb-3 space-y-1">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside text-zinc-400 mb-3 space-y-1">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-zinc-400">{children}</li>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      {children}
                    </a>
                  ),
                  strong: ({ children }) => (
                    <strong className="text-white font-semibold">{children}</strong>
                  ),
                  em: ({ children }) => (
                    <em className="text-zinc-300 italic">{children}</em>
                  ),
                  code: ({ children }) => (
                    <code className="bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded text-sm">
                      {children}
                    </code>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-blue-500 pl-4 italic text-zinc-400 my-4">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {cleanReadme}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-lg text-zinc-400 mb-6 leading-relaxed">
              {user?.bio || t.hero.description}
            </p>
          )}

          {/* CTA Button */}
          <a
            href="#contact"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium rounded-full hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300 hover:-translate-y-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {t.hero.cta}
          </a>
        </div>
      </div>
    </SectionWrapper>
  );
}

const LocationIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const CompanyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);
