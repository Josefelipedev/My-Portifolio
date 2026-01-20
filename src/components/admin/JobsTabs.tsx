'use client';

import { useState, type ReactNode } from 'react';
import JobSearch from './JobSearch';
import SavedJobs from './SavedJobs';
import JobApplications from './JobApplications';

interface JobsTabsProps {
  initialSavedCount: number;
  initialApplicationsCount: number;
}

type TabType = 'search' | 'saved' | 'applications';

export default function JobsTabs({ initialSavedCount, initialApplicationsCount }: JobsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [savedCount, setSavedCount] = useState(initialSavedCount);
  const [applicationsCount, setApplicationsCount] = useState(initialApplicationsCount);

  const handleJobSaved = () => {
    setSavedCount((prev) => prev + 1);
  };

  const handleJobRemoved = () => {
    setSavedCount((prev) => Math.max(0, prev - 1));
  };

  const handleApplicationCreated = () => {
    setApplicationsCount((prev) => prev + 1);
  };

  const handleApplicationDeleted = () => {
    setApplicationsCount((prev) => Math.max(0, prev - 1));
  };

  const tabs: { id: TabType; label: string; count?: number; icon: ReactNode }[] = [
    {
      id: 'search',
      label: 'Search Jobs',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      id: 'saved',
      label: 'Saved',
      count: savedCount,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      ),
    },
    {
      id: 'applications',
      label: 'Applications',
      count: applicationsCount,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      {/* Tab Navigation */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-700 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-red-500 text-red-600 dark:text-red-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs rounded">
                  {tab.count}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'search' && <JobSearch onJobSaved={handleJobSaved} />}
        {activeTab === 'saved' && (
          <SavedJobs
            onJobRemoved={handleJobRemoved}
            onApplicationCreated={handleApplicationCreated}
          />
        )}
        {activeTab === 'applications' && (
          <JobApplications onApplicationDeleted={handleApplicationDeleted} />
        )}
      </div>
    </div>
  );
}
