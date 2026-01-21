'use client';

import React from 'react';
import AdminLayout from './AdminLayout';
import JobsTabs from './JobsTabs';

interface JobsPageWrapperProps {
  savedJobsCount: number;
  totalApplications: number;
  statsMap: Record<string, number>;
  error: string | null;
}

export default function JobsPageWrapper({
  savedJobsCount,
  totalApplications,
  statsMap,
  error,
}: JobsPageWrapperProps) {
  return (
    <AdminLayout
      title="Job Search & Tracker"
      subtitle="Search remote jobs and track your applications"
    >
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
          <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
          <p className="text-sm text-red-500 dark:text-red-400 mt-1">
            Run this command on your server:{' '}
            <code className="bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded">
              npx prisma db push
            </code>
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
          <p className="text-2xl font-bold text-red-500">{savedJobsCount}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Saved Jobs</p>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
          <p className="text-2xl font-bold text-blue-500">{statsMap.applied || 0}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Applied</p>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
          <p className="text-2xl font-bold text-yellow-500">{statsMap.interview || 0}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Interview</p>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
          <p className="text-2xl font-bold text-green-500">{statsMap.offer || 0}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Offers</p>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
          <p className="text-2xl font-bold text-zinc-400">{statsMap.rejected || 0}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Rejected</p>
        </div>
      </div>

      {/* Tabs Component */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 md:p-6">
        <JobsTabs
          initialSavedCount={savedJobsCount}
          initialApplicationsCount={totalApplications}
        />
      </div>
    </AdminLayout>
  );
}
