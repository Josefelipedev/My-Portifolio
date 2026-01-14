import Link from 'next/link';
import ProjectAdmin from '@/components/ProjectAdmin';
import ExperienceAdmin from '@/components/ExperienceAdmin';
import prisma from '@/lib/prisma';

export default async function AdminPage() {
  const projects = await prisma.project.findMany({
    orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
  });
  const experiences = await prisma.experience.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8 md:p-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">Admin Panel</h1>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">Manage your portfolio content</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/github"
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              Import from GitHub
            </Link>
            <Link
              href="/"
              className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
            >
              View Site
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
            <p className="text-3xl font-bold text-blue-500">{projects.length}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Projects</p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
            <p className="text-3xl font-bold text-purple-500">{experiences.length}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Experiences</p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
            <p className="text-3xl font-bold text-green-500">
              {projects.filter((p) => p.source === 'github').length}
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">From GitHub</p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
            <p className="text-3xl font-bold text-amber-500">
              {projects.filter((p) => p.aiSummary).length}
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">AI Summaries</p>
          </div>
        </div>

        {/* Content Management */}
        <div className="space-y-8">
          <ProjectAdmin projects={projects} />
          <ExperienceAdmin experiences={experiences} />
        </div>
      </div>
    </main>
  );
}
