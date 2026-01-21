'use client';

import { useState, useEffect } from 'react';
import BulkActionBar from './jobs/BulkActionBar';
import { exportJobsToCSV, exportJobsToPDF, ExportableJob } from '@/lib/export';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

interface SavedJob {
  id: string;
  externalId: string;
  source: string;
  title: string;
  company: string;
  companyLogo?: string;
  description: string;
  url: string;
  location?: string;
  jobType?: string;
  salary?: string;
  tags?: string;
  postedAt?: string;
  notes?: string;
  savedAt: string;
  application?: {
    id: string;
    status: string;
  };
}

interface SavedJobsProps {
  onJobRemoved: () => void;
  onApplicationCreated: () => void;
}

export default function SavedJobs({ onJobRemoved, onApplicationCreated }: SavedJobsProps) {
  const { showError, showWarning, showSuccess } = useToast();
  const { confirm, prompt } = useConfirm();
  const [jobs, setJobs] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchSavedJobs();
  }, []);

  const fetchSavedJobs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/jobs/saved');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch saved jobs');
      }

      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load saved jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Remove Saved Job',
      message: 'Are you sure you want to remove this saved job?',
      type: 'danger',
      confirmText: 'Remove',
    });
    if (!confirmed) return;

    try {
      setDeleting(id);
      const response = await fetch(`/api/jobs/saved/${id}`, { method: 'DELETE' });

      if (!response.ok) {
        throw new Error('Failed to delete job');
      }

      setJobs((prev) => prev.filter((j) => j.id !== id));
      onJobRemoved();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const handleApply = async (job: SavedJob) => {
    try {
      setApplying(job.id);
      const response = await fetch(`/api/jobs/saved/${job.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'applied',
          appliedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create application');
      }

      await fetchSavedJobs();
      onApplicationCreated();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create application');
    } finally {
      setApplying(null);
    }
  };

  const handleSaveNotes = async (id: string) => {
    try {
      const response = await fetch(`/api/jobs/saved/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to save notes');
      }

      setJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, notes: notesValue } : j))
      );
      setEditingNotes(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save notes');
    }
  };

  // Bulk selection handlers
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(jobs.map((j) => j.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete Saved Jobs',
      message: `Deletar ${selectedIds.size} vagas salvas?`,
      type: 'danger',
      confirmText: 'Delete All',
    });
    if (!confirmed) return;

    try {
      setBulkDeleting(true);
      const response = await fetch('/api/jobs/saved/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete jobs');
      }

      const data = await response.json();
      setJobs((prev) => prev.filter((j) => !selectedIds.has(j.id)));
      // Call onJobRemoved for each deleted job
      for (let i = 0; i < data.count; i++) {
        onJobRemoved();
      }
      setSelectedIds(new Set());
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete jobs');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExport = async () => {
    const jobsToExport = selectedIds.size > 0
      ? jobs.filter((j) => selectedIds.has(j.id))
      : jobs;

    if (jobsToExport.length === 0) {
      showWarning('No jobs to export');
      return;
    }

    const exportData: ExportableJob[] = jobsToExport.map((job) => ({
      title: job.title,
      company: job.company,
      location: job.location,
      salary: job.salary,
      url: job.url,
      source: job.source,
      tags: job.tags,
      savedAt: job.savedAt,
    }));

    // Show format options
    const format = await prompt({
      title: 'Export Format',
      message: `Export ${exportData.length} job(s) as:\n1. CSV\n2. PDF\n\nEnter 1 or 2:`,
      defaultValue: '1',
      placeholder: '1 or 2',
    });

    if (!format) return;

    setExporting(true);
    try {
      if (format === '2') {
        await exportJobsToPDF(exportData, `saved-jobs-${new Date().toISOString().split('T')[0]}`);
      } else {
        exportJobsToCSV(exportData, `saved-jobs-${new Date().toISOString().split('T')[0]}`);
      }
      showSuccess('Export completed!');
    } catch (err) {
      showError('Failed to export: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'applied':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
      case 'interview':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
      case 'offer':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'rejected':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      default:
        return 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-zinc-500">
          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Loading saved jobs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </div>
        <p className="text-zinc-600 dark:text-zinc-400 mb-2">
          No saved jobs yet.
        </p>
        <p className="text-sm text-zinc-500">
          Search for jobs and save the ones you&apos;re interested in.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={jobs.length}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        onDelete={handleBulkDelete}
        onExport={handleExport}
        isDeleting={bulkDeleting || exporting}
      />

      {jobs.map((job) => (
        <div
          key={job.id}
          className={`bg-white dark:bg-zinc-800 rounded-xl border overflow-hidden transition-colors ${
            selectedIds.has(job.id)
              ? 'border-red-300 dark:border-red-700 ring-1 ring-red-200 dark:ring-red-800'
              : 'border-zinc-200 dark:border-zinc-700'
          }`}
        >
          <div className="p-4">
            <div className="flex items-start gap-4">
              {/* Checkbox */}
              <div className="pt-1">
                <input
                  type="checkbox"
                  checked={selectedIds.has(job.id)}
                  onChange={() => toggleSelection(job.id)}
                  className="w-4 h-4 rounded border-zinc-300 text-red-500 focus:ring-red-500"
                />
              </div>

              {/* Company Logo */}
              {job.companyLogo ? (
                <img
                  src={job.companyLogo}
                  alt={job.company}
                  className="w-12 h-12 rounded-lg object-contain bg-white"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                  <span className="text-lg font-bold text-zinc-400">
                    {job.company.charAt(0)}
                  </span>
                </div>
              )}

              {/* Job Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {job.title}
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {job.company}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {job.application && (
                      <span className={`px-2 py-1 text-xs rounded capitalize ${getStatusColor(job.application.status)}`}>
                        {job.application.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Meta */}
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {job.location && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {job.location}
                    </span>
                  )}
                  {job.salary && (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {job.salary}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    Saved {formatDate(job.savedAt)}
                  </span>
                </div>

                {/* Tags */}
                {job.tags && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {job.tags.split(',').slice(0, 5).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs rounded"
                      >
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Expanded Content */}
            {expandedId === job.id && (
              <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 space-y-4">
                {/* Description */}
                <div>
                  <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Description
                  </h4>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap line-clamp-6">
                    {stripHtml(job.description).substring(0, 1000)}...
                  </p>
                </div>

                {/* Notes */}
                <div>
                  <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
                    Notes
                    {editingNotes !== job.id && (
                      <button
                        onClick={() => {
                          setEditingNotes(job.id);
                          setNotesValue(job.notes || '');
                        }}
                        className="text-xs text-red-500 hover:text-red-600"
                      >
                        Edit
                      </button>
                    )}
                  </h4>
                  {editingNotes === job.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={notesValue}
                        onChange={(e) => setNotesValue(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                        placeholder="Add notes about this job..."
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveNotes(job.id)}
                          className="px-3 py-1 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingNotes(null)}
                          className="px-3 py-1 text-sm bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {job.notes || 'No notes yet.'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                {expandedId === job.id ? 'Show less' : 'Show more'}
              </button>
              <div className="flex items-center gap-2">
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                >
                  View Job
                </a>
                {!job.application ? (
                  <button
                    onClick={() => handleApply(job)}
                    disabled={applying === job.id}
                    className="px-3 py-1.5 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                  >
                    {applying === job.id ? (
                      'Creating...'
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Mark Applied
                      </>
                    )}
                  </button>
                ) : (
                  <span className="px-3 py-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                    Tracking in Applications
                  </span>
                )}
                <button
                  onClick={() => handleDelete(job.id)}
                  disabled={deleting === job.id}
                  className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                >
                  {deleting === job.id ? '...' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
