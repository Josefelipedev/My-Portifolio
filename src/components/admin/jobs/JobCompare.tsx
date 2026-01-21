'use client';

import { useState } from 'react';
import MatchScoreBadge from './MatchScoreBadge';

interface ComparableJob {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  location?: string;
  salary?: string;
  jobType?: string;
  description: string;
  tags?: string;
  source?: string;
  url: string;
  relevanceScore?: number;
}

interface JobCompareProps {
  jobs: ComparableJob[];
  onClose: () => void;
  onRemove: (jobId: string) => void;
}

export default function JobCompare({ jobs, onClose, onRemove }: JobCompareProps) {
  const [showFullDescription, setShowFullDescription] = useState<Record<string, boolean>>({});

  if (jobs.length === 0) {
    return null;
  }

  // Helper to strip HTML
  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  // Helper to parse tags
  const parseTags = (tags?: string) => {
    if (!tags) return [];
    return tags.split(',').map((t) => t.trim()).filter(Boolean);
  };

  // Find common and unique tags across jobs
  const allTags = jobs.map((job) => new Set(parseTags(job.tags)));
  const commonTags = jobs.length > 1
    ? parseTags(jobs[0].tags).filter((tag) =>
        allTags.every((tagSet) => tagSet.has(tag))
      )
    : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Compare Jobs ({jobs.length})
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Comparison Table */}
        <div className="flex-1 overflow-auto p-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${jobs.length}, minmax(280px, 1fr))` }}>
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-zinc-50 dark:bg-zinc-700/50 rounded-xl p-4 relative"
              >
                {/* Remove button */}
                <button
                  onClick={() => onRemove(job.id)}
                  className="absolute top-2 right-2 p-1 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded transition-colors"
                  title="Remove from comparison"
                >
                  <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Company Logo & Title */}
                <div className="flex items-start gap-3 mb-4 pr-6">
                  {job.companyLogo ? (
                    <img
                      src={job.companyLogo}
                      alt={job.company}
                      className="w-10 h-10 rounded-lg object-contain bg-white"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-600 flex items-center justify-center">
                      <span className="text-sm font-bold text-zinc-400">
                        {job.company.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm leading-tight">
                      {job.title}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{job.company}</p>
                  </div>
                </div>

                {/* Match Score */}
                {job.relevanceScore !== undefined && (
                  <div className="mb-3">
                    <MatchScoreBadge score={job.relevanceScore} />
                  </div>
                )}

                {/* Details */}
                <div className="space-y-3">
                  {/* Location */}
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">
                      {job.location || 'Not specified'}
                    </span>
                  </div>

                  {/* Salary */}
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className={`text-sm ${job.salary ? 'text-green-600 dark:text-green-400' : 'text-zinc-400'}`}>
                      {job.salary || 'Not disclosed'}
                    </span>
                  </div>

                  {/* Job Type */}
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">
                      {job.jobType || 'Not specified'}
                    </span>
                  </div>

                  {/* Source */}
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {job.source || 'Unknown'}
                    </span>
                  </div>
                </div>

                {/* Tags */}
                {parseTags(job.tags).length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Skills/Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {parseTags(job.tags).slice(0, 8).map((tag) => (
                        <span
                          key={tag}
                          className={`px-2 py-0.5 text-xs rounded ${
                            commonTags.includes(tag)
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-zinc-200 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                <div className="mt-4">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Description</p>
                  <p className={`text-xs text-zinc-600 dark:text-zinc-300 ${
                    showFullDescription[job.id] ? '' : 'line-clamp-4'
                  }`}>
                    {stripHtml(job.description)}
                  </p>
                  {job.description.length > 200 && (
                    <button
                      onClick={() => setShowFullDescription((prev) => ({
                        ...prev,
                        [job.id]: !prev[job.id],
                      }))}
                      className="text-xs text-red-500 hover:text-red-600 mt-1"
                    >
                      {showFullDescription[job.id] ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>

                {/* View Job Button */}
                <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-600">
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
                  >
                    View Job
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Common Tags Section */}
        {commonTags.length > 0 && (
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-700">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Common Skills/Tags ({commonTags.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {commonTags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm rounded-lg"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Compact button to add to comparison
export function AddToCompareButton({
  isSelected,
  onToggle,
  disabled = false,
}: {
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`p-1.5 rounded-lg transition-colors ${
        isSelected
          ? 'bg-blue-500 text-white'
          : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={isSelected ? 'Remove from comparison' : 'Add to comparison'}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    </button>
  );
}

// Floating comparison bar
export function CompareBar({
  count,
  onCompare,
  onClear,
}: {
  count: number;
  onCompare: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-zinc-700 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-4 z-40">
      <span className="text-sm">
        {count} job{count > 1 ? 's' : ''} selected for comparison
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onClear}
          className="px-3 py-1 text-sm bg-zinc-700 dark:bg-zinc-600 hover:bg-zinc-600 dark:hover:bg-zinc-500 rounded-lg transition-colors"
        >
          Clear
        </button>
        <button
          onClick={onCompare}
          disabled={count < 2}
          className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Compare
        </button>
      </div>
    </div>
  );
}
