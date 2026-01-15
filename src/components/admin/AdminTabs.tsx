'use client';

import { useState } from 'react';
import ProjectAdmin from '@/components/ProjectAdmin';
import ExperienceAdmin from '@/components/ExperienceAdmin';
import { Experience } from '@prisma/client';

interface Project {
  id: string;
  title: string;
  description: string;
  readme: string | null;
  technologies: string;
  repoUrl: string;
  demoUrl: string | null;
  githubId: number | null;
  source: string;
  aiSummary: string | null;
  stars: number | null;
  featured: boolean;
}

interface AdminTabsProps {
  projects: Project[];
  experiences: Experience[];
}

export default function AdminTabs({ projects, experiences }: AdminTabsProps) {
  const [activeTab, setActiveTab] = useState<'projects' | 'experiences'>('projects');

  return (
    <div>
      {/* Tab Navigation */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-700 mb-4">
        <button
          onClick={() => setActiveTab('projects')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'projects'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Projects
            <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs rounded">
              {projects.length}
            </span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('experiences')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'experiences'
              ? 'border-purple-500 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Experiences
            <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs rounded">
              {experiences.length}
            </span>
          </div>
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'projects' && <ProjectAdmin projects={projects} />}
        {activeTab === 'experiences' && <ExperienceAdmin experiences={experiences} />}
      </div>
    </div>
  );
}
