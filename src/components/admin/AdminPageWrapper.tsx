'use client';

import React from 'react';
import AdminLayout from './AdminLayout';
import AdminTabs from './AdminTabs';

interface Project {
  id: string;
  title: string;
  description: string;
  technologies: string;
  repoUrl: string | null;
  demoUrl: string | null;
  imageUrl: string | null;
  featured: boolean;
  rank: number | null;
  isPrivate: boolean;
  source: string;
  githubId: number | null;
  aiSummary: string | null;
  stars: number | null;
  readme: string | null;
  aiSummarizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

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
  createdAt: Date;
  updatedAt: Date;
}

interface AdminPageWrapperProps {
  projects: Project[];
  experiences: Experience[];
}

export default function AdminPageWrapper({ projects, experiences }: AdminPageWrapperProps) {
  return (
    <AdminLayout
      title="Admin Panel"
      subtitle="Manage your portfolio"
    >
      {/* Compact Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
          <p className="text-2xl font-bold text-red-500">{projects.length}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Projects</p>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
          <p className="text-2xl font-bold text-purple-500">{experiences.length}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Experiences</p>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
          <p className="text-2xl font-bold text-green-500">
            {projects.filter((p) => p.source === 'github').length}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">From GitHub</p>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
          <p className="text-2xl font-bold text-amber-500">
            {projects.filter((p) => p.aiSummary).length}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">AI Summaries</p>
        </div>
      </div>

      {/* Tabs Component */}
      <AdminTabs projects={projects} experiences={experiences} />
    </AdminLayout>
  );
}
