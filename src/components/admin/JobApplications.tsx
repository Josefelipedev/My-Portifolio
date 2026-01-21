'use client';

import { useState, useEffect } from 'react';
import BulkActionBar from './jobs/BulkActionBar';
import { exportApplicationsToCSV, exportApplicationsToPDF, ExportableApplication } from '@/lib/export';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

interface JobApplication {
  id: string;
  savedJobId?: string;
  title: string;
  company: string;
  url?: string;
  location?: string;
  salary?: string;
  status: string;
  appliedAt?: string;
  notes?: string;
  timeline?: string;
  nextStep?: string;
  nextStepDate?: string;
  createdAt: string;
  updatedAt: string;
  savedJob?: {
    id: string;
    companyLogo?: string;
    tags?: string;
  };
}

interface TimelineEvent {
  status: string;
  date: string;
  note?: string;
}

interface JobApplicationsProps {
  onApplicationDeleted: () => void;
}

const STATUSES = ['saved', 'applied', 'interview', 'offer', 'rejected'] as const;

export default function JobApplications({ onApplicationDeleted }: JobApplicationsProps) {
  const { showError, showWarning, showSuccess } = useToast();
  const { confirm, prompt } = useConfirm();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    status: '',
    notes: '',
    nextStep: '',
    nextStepDate: '',
    statusNote: '',
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    title: '',
    company: '',
    url: '',
    location: '',
    salary: '',
    status: 'saved',
    notes: '',
  });
  const [adding, setAdding] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/jobs/applications');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch applications');
      }

      setApplications(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      setUpdating(id);
      const response = await fetch(`/api/jobs/applications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editForm.status,
          notes: editForm.notes,
          nextStep: editForm.nextStep,
          nextStepDate: editForm.nextStepDate || null,
          statusNote: editForm.statusNote,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update application');
      }

      await fetchApplications();
      setEditingId(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete Application',
      message: 'Are you sure you want to delete this application?',
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!confirmed) return;

    try {
      setDeleting(id);
      const response = await fetch(`/api/jobs/applications/${id}`, { method: 'DELETE' });

      if (!response.ok) {
        throw new Error('Failed to delete application');
      }

      setApplications((prev) => prev.filter((a) => a.id !== id));
      onApplicationDeleted();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.title.trim() || !addForm.company.trim()) return;

    try {
      setAdding(true);
      const response = await fetch('/api/jobs/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add application');
      }

      await fetchApplications();
      setShowAddForm(false);
      setAddForm({
        title: '',
        company: '',
        url: '',
        location: '',
        salary: '',
        status: 'saved',
        notes: '',
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to add application');
    } finally {
      setAdding(false);
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
    setSelectedIds(new Set(filteredApplications.map((app) => app.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete Applications',
      message: `Are you sure you want to delete ${selectedIds.size} application(s)?`,
      type: 'danger',
      confirmText: 'Delete All',
    });
    if (!confirmed) return;

    try {
      setBulkDeleting(true);
      const response = await fetch('/api/jobs/applications/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete applications');
      }

      await fetchApplications();
      setSelectedIds(new Set());
      onApplicationDeleted();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete applications');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    const confirmed = await confirm({
      title: 'Update Status',
      message: `Update ${selectedIds.size} application(s) to "${status}"?`,
      type: 'warning',
      confirmText: 'Update All',
    });
    if (!confirmed) return;

    try {
      setBulkUpdating(true);
      const response = await fetch('/api/jobs/applications/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), status }),
      });

      if (!response.ok) {
        throw new Error('Failed to update applications');
      }

      await fetchApplications();
      setSelectedIds(new Set());
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update applications');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleExport = async () => {
    const appsToExport = selectedIds.size > 0
      ? filteredApplications.filter((app) => selectedIds.has(app.id))
      : filteredApplications;

    if (appsToExport.length === 0) {
      showWarning('No applications to export');
      return;
    }

    const exportData: ExportableApplication[] = appsToExport.map((app) => ({
      title: app.title,
      company: app.company,
      location: app.location,
      salary: app.salary,
      url: app.url,
      status: app.status,
      appliedAt: app.appliedAt,
      notes: app.notes,
      nextStep: app.nextStep,
      nextStepDate: app.nextStepDate,
      createdAt: app.createdAt,
    }));

    // Show format options
    const format = await prompt({
      title: 'Export Format',
      message: `Export ${exportData.length} application(s) as:\n1. CSV\n2. PDF\n\nEnter 1 or 2:`,
      defaultValue: '1',
      placeholder: '1 or 2',
    });

    if (!format) return;

    setExporting(true);
    try {
      if (format === '2') {
        await exportApplicationsToPDF(exportData, `applications-${new Date().toISOString().split('T')[0]}`);
      } else {
        exportApplicationsToCSV(exportData, `applications-${new Date().toISOString().split('T')[0]}`);
      }
      showSuccess('Export completed!');
    } catch (err) {
      showError('Failed to export: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setExporting(false);
    }
  };

  const startEditing = (app: JobApplication) => {
    setEditingId(app.id);
    setEditForm({
      status: app.status,
      notes: app.notes || '',
      nextStep: app.nextStep || '',
      nextStepDate: app.nextStepDate ? app.nextStepDate.split('T')[0] : '',
      statusNote: '',
    });
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'applied':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'interview':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
      case 'offer':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
      case 'rejected':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
      default:
        return 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-600';
    }
  };

  const filteredApplications =
    filter === 'all' ? applications : applications.filter((a) => a.status === filter);

  const statusCounts = STATUSES.reduce(
    (acc, status) => ({
      ...acc,
      [status]: applications.filter((a) => a.status === status).length,
    }),
    {} as Record<string, number>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-zinc-500">
          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Loading applications...</span>
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

  return (
    <div>
      {/* Header with Add Button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Filter:</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          >
            <option value="all">All ({applications.length})</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)} ({statusCounts[status] || 0})
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Manual
        </button>
      </div>

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Add Application Manually
            </h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Job Title *
                </label>
                <input
                  type="text"
                  value={addForm.title}
                  onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Company *
                </label>
                <input
                  type="text"
                  value={addForm.company}
                  onChange={(e) => setAddForm({ ...addForm, company: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Job URL
                </label>
                <input
                  type="url"
                  value={addForm.url}
                  onChange={(e) => setAddForm({ ...addForm, url: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={addForm.location}
                    onChange={(e) => setAddForm({ ...addForm, location: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Status
                  </label>
                  <select
                    value={addForm.status}
                    onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {adding ? 'Adding...' : 'Add Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={filteredApplications.length}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        onDelete={handleBulkDelete}
        onExport={handleExport}
        onStatusChange={handleBulkStatusChange}
        showStatusChange={true}
        isDeleting={bulkDeleting || bulkUpdating || exporting}
      />

      {/* Applications List */}
      {filteredApplications.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 mb-2">
            {filter === 'all' ? 'No applications yet.' : `No ${filter} applications.`}
          </p>
          <p className="text-sm text-zinc-500">
            Save a job and mark it as applied, or add an application manually.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApplications.map((app) => (
            <div
              key={app.id}
              className={`bg-white dark:bg-zinc-800 rounded-xl border overflow-hidden ${getStatusColor(app.status)} ${
                selectedIds.has(app.id) ? 'ring-2 ring-red-500' : ''
              }`}
            >
              <div className="p-4">
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedIds.has(app.id)}
                    onChange={() => toggleSelection(app.id)}
                    className="w-4 h-4 mt-1 rounded border-zinc-300 text-red-500 focus:ring-red-500 cursor-pointer"
                  />
                  {/* Company Logo */}
                  {app.savedJob?.companyLogo ? (
                    <img
                      src={app.savedJob.companyLogo}
                      alt={app.company}
                      className="w-12 h-12 rounded-lg object-contain bg-white"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                      <span className="text-lg font-bold text-zinc-400">
                        {app.company.charAt(0)}
                      </span>
                    </div>
                  )}

                  {/* Job Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {app.title}
                        </h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          {app.company}
                        </p>
                      </div>
                      <span className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${getStatusColor(app.status)}`}>
                        {app.status}
                      </span>
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {app.location && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                          {app.location}
                        </span>
                      )}
                      {app.appliedAt && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Applied {formatDate(app.appliedAt)}
                        </span>
                      )}
                      {app.nextStep && app.nextStepDate && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {app.nextStep} on {formatDate(app.nextStepDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Editing Form */}
                {editingId === app.id && (
                  <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          Status
                        </label>
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                        >
                          {STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      {editForm.status !== app.status && (
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            Status Note
                          </label>
                          <input
                            type="text"
                            value={editForm.statusNote}
                            onChange={(e) => setEditForm({ ...editForm, statusNote: e.target.value })}
                            placeholder="e.g., Phone screen scheduled"
                            className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          Next Step
                        </label>
                        <input
                          type="text"
                          value={editForm.nextStep}
                          onChange={(e) => setEditForm({ ...editForm, nextStep: e.target.value })}
                          placeholder="e.g., Technical interview"
                          className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          Next Step Date
                        </label>
                        <input
                          type="date"
                          value={editForm.nextStepDate}
                          onChange={(e) => setEditForm({ ...editForm, nextStepDate: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Notes
                      </label>
                      <textarea
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(app.id)}
                        disabled={updating === app.id}
                        className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                      >
                        {updating === app.id ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-2 text-sm bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Expanded Content - Timeline */}
                {expandedId === app.id && !editingId && app.timeline && (
                  <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                    <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Timeline</h4>
                    <div className="space-y-2">
                      {(JSON.parse(app.timeline) as TimelineEvent[]).map((event, index) => (
                        <div key={index} className="flex items-start gap-3 text-sm">
                          <div className={`w-2 h-2 rounded-full mt-1.5 ${
                            event.status === 'offer' ? 'bg-green-500' :
                            event.status === 'rejected' ? 'bg-red-500' :
                            event.status === 'interview' ? 'bg-yellow-500' :
                            event.status === 'applied' ? 'bg-blue-500' :
                            'bg-zinc-400'
                          }`} />
                          <div>
                            <p className="text-zinc-700 dark:text-zinc-300 capitalize">
                              {event.status}
                              {event.note && `: ${event.note}`}
                            </p>
                            <p className="text-xs text-zinc-500">{formatDate(event.date)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {app.notes && (
                      <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Notes</h4>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">{app.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {!editingId && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                    <button
                      onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                      className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    >
                      {expandedId === app.id ? 'Show less' : 'Show timeline'}
                    </button>
                    <div className="flex items-center gap-2">
                      {app.url && (
                        <a
                          href={app.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                        >
                          View Job
                        </a>
                      )}
                      <button
                        onClick={() => startEditing(app)}
                        className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        Update
                      </button>
                      <button
                        onClick={() => handleDelete(app.id)}
                        disabled={deleting === app.id}
                        className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                      >
                        {deleting === app.id ? '...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
