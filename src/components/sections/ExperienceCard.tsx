'use client';

import { useState } from 'react';
import { SkillBadge } from '../ui/SkillBadge';

interface Experience {
  id: string;
  title: string;
  description: string;
  responsibilities: string;
  challenges: string;
  technologies: string;
  company: string | null;
  startDate: Date | null;
  endDate: Date | null;
  location: string | null;
}

interface ExperienceCardProps {
  exp: Experience;
  index: number;
}

function formatDate(date: Date | null): string {
  if (!date) return 'Present';
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function ExperienceCard({ exp, index }: ExperienceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasDetails = exp.responsibilities || exp.challenges;

  return (
    <div
      className={`relative flex flex-col md:flex-row gap-8 animate-fade-in-up ${
        index % 2 === 0 ? 'md:flex-row-reverse' : ''
      }`}
      style={{ animationDelay: `${index * 150}ms` }}
    >
      {/* Timeline dot */}
      <div className="absolute left-0 md:left-1/2 w-4 h-4 bg-gradient-to-r from-red-500 to-purple-500 rounded-full transform -translate-x-1.5 md:-translate-x-2 ring-4 ring-white dark:ring-zinc-900" />

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
              <p className="text-red-500 font-medium">{exp.company}</p>
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
          <p className={`text-zinc-600 dark:text-zinc-400 mb-4 ${!isExpanded && hasDetails ? 'line-clamp-2' : ''}`}>
            {exp.description}
          </p>

          {/* Expandable content */}
          {isExpanded && (
            <>
              {/* Responsibilities */}
              {exp.responsibilities && (
                <div className="mb-4 animate-fade-in-up">
                  <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                    Key Responsibilities
                  </h4>
                  <ul className="space-y-1">
                    {exp.responsibilities.split(',').map((resp, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                        <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <div className="mb-4 animate-fade-in-up">
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
            </>
          )}

          {/* Technologies */}
          <div className="flex flex-wrap gap-2 mb-4">
            {exp.technologies.split(',').map((tech) => (
              <SkillBadge key={tech} name={tech.trim()} size="sm" variant="gradient" />
            ))}
          </div>

          {/* See more button */}
          {hasDetails && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
            >
              {isExpanded ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  See less
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  See more
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Empty space for timeline alignment */}
      <div className="hidden md:block md:w-1/2" />
    </div>
  );
}
