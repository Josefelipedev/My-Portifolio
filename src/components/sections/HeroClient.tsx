'use client';

import TypewriterText from '../ui/TypewriterText';

interface HeroClientProps {
  title: string;
  bio: string | null;
}

export default function HeroClient({ title, bio }: HeroClientProps) {
  const titles = [
    title,
    'Problem Solver',
    'Tech Enthusiast',
    'Code Artisan',
  ];

  return (
    <>
      {/* Title with typewriter effect */}
      <h2 className="text-2xl sm:text-3xl md:text-4xl text-zinc-700 dark:text-zinc-300 font-medium mb-8 animate-fade-in-up delay-200 h-12">
        <TypewriterText
          texts={titles}
          speed={80}
          deleteSpeed={40}
          delayBetween={2500}
          className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent"
        />
      </h2>

      {/* Bio */}
      {bio && (
        <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-12 animate-fade-in-up delay-300 leading-relaxed">
          {bio}
        </p>
      )}
    </>
  );
}
