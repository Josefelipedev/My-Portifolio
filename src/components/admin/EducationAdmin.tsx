'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Education } from '@prisma/client';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { fetchWithCSRF } from '@/lib/csrf-client';

const TYPE_OPTIONS = [
  { value: 'degree', label: 'Degree / University', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  { value: 'course', label: 'Course', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  { value: 'certification', label: 'Certification', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
];

export default function EducationAdmin({ education }: { education: Education[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingEducation, setEditingEducation] = useState<Education | null>(null);
  const [title, setTitle] = useState('');
  const [institution, setInstitution] = useState('');
  const [type, setType] = useState('degree');
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [certificateUrl, setCertificateUrl] = useState('');
  const [expandedEducation, setExpandedEducation] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const router = useRouter();
  const { confirm } = useConfirm();
  const { showSuccess, showError } = useToast();

  const filteredEducation = filterType
    ? education.filter(edu => edu.type === filterType)
    : education;

  const handleImportFromResume = async () => {
    const confirmed = await confirm({
      title: 'Import from Resume',
      message: 'This will import education and certifications from resume.json. Existing entries will be skipped. Continue?',
      type: 'warning',
      confirmText: 'Import',
    });
    if (!confirmed) return;

    setIsImporting(true);
    try {
      const res = await fetchWithCSRF('/api/education/import', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess(data.message);
        router.refresh();
      } else {
        showError(data.error || 'Failed to import');
      }
    } catch (err) {
      showError('Failed to import from resume');
      console.error(err);
    } finally {
      setIsImporting(false);
    }
  };

  const formatDateForInput = (date: Date | string | null): string => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = {
        title,
        institution,
        type,
        fieldOfStudy: fieldOfStudy || null,
        location: location || null,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
        description: description || null,
        certificateUrl: certificateUrl || null,
      };

      if (editingEducation) {
        const res = await fetchWithCSRF(`/api/education/${editingEducation.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          router.refresh();
          closeModal();
        }
      } else {
        const res = await fetchWithCSRF('/api/education', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          router.refresh();
          closeModal();
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const openEditModal = (edu: Education) => {
    setEditingEducation(edu);
    setTitle(edu.title);
    setInstitution(edu.institution);
    setType(edu.type);
    setFieldOfStudy(edu.fieldOfStudy || '');
    setLocation(edu.location || '');
    setStartDate(formatDateForInput(edu.startDate));
    setEndDate(formatDateForInput(edu.endDate));
    setDescription(edu.description || '');
    setCertificateUrl(edu.certificateUrl || '');
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingEducation(null);
    resetForm();
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEducation(null);
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setInstitution('');
    setType('degree');
    setFieldOfStudy('');
    setLocation('');
    setStartDate('');
    setEndDate('');
    setDescription('');
    setCertificateUrl('');
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete Education',
      message: 'Are you sure you want to delete this education entry?',
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!confirmed) return;
    const res = await fetchWithCSRF(`/api/education/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.refresh();
    }
  };

  const formatDisplayDate = (date: Date | string | null): string => {
    if (!date) return 'Present';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const getTypeConfig = (typeValue: string) => {
    return TYPE_OPTIONS.find(t => t.value === typeValue) || TYPE_OPTIONS[0];
  };

  const getTypeIcon = (typeValue: string) => {
    switch (typeValue) {
      case 'degree':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          </svg>
        );
      case 'course':
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        );
      case 'certification':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Education ({education.length})
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImportFromResume}
            disabled={isImporting}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors"
          >
            {isImporting ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
            {isImporting ? 'Importing...' : 'Import from Resume'}
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Education
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilterType(null)}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            filterType === null
              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          }`}
        >
          All ({education.length})
        </button>
        {TYPE_OPTIONS.map(opt => {
          const count = education.filter(e => e.type === opt.value).length;
          return (
            <button
              key={opt.value}
              onClick={() => setFilterType(opt.value)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filterType === opt.value
                  ? opt.color
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {opt.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Education List */}
      <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
        {filteredEducation.length === 0 ? (
          <p className="text-zinc-500 text-center py-8">
            {filterType ? `No ${getTypeConfig(filterType).label.toLowerCase()} entries yet.` : 'No education entries yet. Add one above!'}
          </p>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {filteredEducation.map((edu) => (
              <div key={edu.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors">
                {/* Main Row */}
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Expand Button */}
                    <button
                      onClick={() => setExpandedEducation(expandedEducation === edu.id ? null : edu.id)}
                      className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded transition-colors"
                    >
                      <svg
                        className={`w-4 h-4 text-zinc-500 transition-transform ${expandedEducation === edu.id ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Type Icon */}
                    <div className="shrink-0">
                      {getTypeIcon(edu.type)}
                    </div>

                    {/* Title & Institution */}
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate block">
                        {edu.title}
                      </span>
                      <span className="text-sm text-zinc-500 dark:text-zinc-400 truncate block">
                        {edu.institution}
                      </span>
                    </div>

                    {/* Type Badge */}
                    <span className={`px-2 py-0.5 text-xs rounded-full shrink-0 hidden sm:block ${getTypeConfig(edu.type).color}`}>
                      {getTypeConfig(edu.type).label}
                    </span>

                    {/* Date Range */}
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0 hidden md:block">
                      {formatDisplayDate(edu.startDate)} - {formatDisplayDate(edu.endDate)}
                    </span>

                    {/* In Progress Badge */}
                    {!edu.endDate && (
                      <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded-full shrink-0">
                        In Progress
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => openEditModal(edu)}
                      className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                      title="Edit education"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(edu.id)}
                      className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                      title="Delete education"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedEducation === edu.id && (
                  <div className="px-4 pb-4 pt-0 border-t border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                    <div className="pt-3 space-y-2 text-sm">
                      {edu.fieldOfStudy && (
                        <p className="text-zinc-600 dark:text-zinc-400">
                          <span className="font-medium">Field of Study:</span> {edu.fieldOfStudy}
                        </p>
                      )}
                      {edu.location && (
                        <p className="text-zinc-600 dark:text-zinc-400">
                          <span className="font-medium">Location:</span> {edu.location}
                        </p>
                      )}
                      <p className="text-zinc-600 dark:text-zinc-400">
                        <span className="font-medium">Period:</span> {formatDisplayDate(edu.startDate)} - {formatDisplayDate(edu.endDate)}
                      </p>
                      {edu.description && (
                        <p className="text-zinc-600 dark:text-zinc-400 mt-2">{edu.description}</p>
                      )}
                      {edu.certificateUrl && (
                        <a
                          href={edu.certificateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-red-500 hover:text-red-600 mt-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          View Certificate
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeModal}>
          <div
            className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {editingEducation ? 'Edit Education' : 'Add New Education'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Type Selection */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Type *</label>
                <div className="flex flex-wrap gap-2">
                  {TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setType(opt.value)}
                      className={`px-4 py-2 text-sm rounded-lg border-2 transition-colors ${
                        type === opt.value
                          ? `${opt.color} border-current`
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {type === 'certification' ? 'Certification Name' : type === 'course' ? 'Course Name' : 'Degree / Course'} *
                  </label>
                  <input
                    type="text"
                    placeholder={type === 'certification' ? 'e.g., AWS Solutions Architect' : type === 'course' ? 'e.g., React Complete Guide' : 'e.g., Computer Science'}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {type === 'course' ? 'Platform' : 'Institution'} *
                  </label>
                  <input
                    type="text"
                    placeholder={type === 'course' ? 'e.g., Udemy, Coursera, Alura' : type === 'certification' ? 'e.g., Amazon Web Services' : 'e.g., University of Example'}
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Field of Study</label>
                  <input
                    type="text"
                    placeholder="e.g., Software Engineering"
                    value={fieldOfStudy}
                    onChange={(e) => setFieldOfStudy(e.target.value)}
                    className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Location</label>
                  <input
                    type="text"
                    placeholder={type === 'course' ? 'e.g., Online' : 'e.g., Faro, Portugal'}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Leave empty if in progress</p>
                </div>
              </div>

              {/* Certificate URL - only for courses and certifications */}
              {(type === 'course' || type === 'certification') && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Certificate URL</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={certificateUrl}
                    onChange={(e) => setCertificateUrl(e.target.value)}
                    className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
                <textarea
                  placeholder="Brief description, achievements, skills learned..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 outline-none resize-none text-sm"
                  rows={3}
                />
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading && (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {editingEducation ? 'Save Changes' : 'Add Education'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
