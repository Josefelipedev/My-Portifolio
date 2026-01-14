'use client';

import { ReactNode } from 'react';

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
}

export function AnimatedCard({
  children,
  className = '',
  delay = 0,
  hover = true,
}: AnimatedCardProps) {
  return (
    <div
      className={`
        relative bg-white dark:bg-zinc-900 rounded-2xl p-6
        border border-zinc-200 dark:border-zinc-800
        transition-all duration-300 ease-out
        ${hover ? 'hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-2 hover:border-blue-500/20' : ''}
        animate-fade-in-up
        ${className}
      `}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Gradient border overlay on hover */}
      {hover && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-10 transition-opacity -z-10 blur-xl" />
      )}
      {children}
    </div>
  );
}
