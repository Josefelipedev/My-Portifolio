'use client';

import { useState, useEffect } from 'react';
import BulkActionBar from './jobs/BulkActionBar';
import AIGradeBadge from './jobs/AIGradeBadge';
import AIAnalysisPanel, { type AIAnalysis } from './jobs/AIAnalysisPanel';
import CVGeneratorButton from './jobs/CVGeneratorButton';
import InterviewPrepModal, { type InterviewPrep } from './jobs/InterviewPrepModal';
import { exportJobsToCSV, exportJobsToPDF, ExportableJob } from '@/lib/export';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

interface EnrichedData {
  emails?: string[];
  phones?: string[];
  requirements?: string[];
  benefits?: string[];
  applicationProcess?: string;
  companyInfo?: string;
  salary?: string;
  workMode?: string;
  contractType?: string;
}

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
  contactEmail?: string;
  contactPhone?: string;
  enrichedData?: string | EnrichedData;
  enrichedAt?: string;
  aiGrade?: string;
  aiAnalysis?: string;
  aiAnalyzedAt?: string;
  generatedCvAt?: string;
  interviewPrep?: string;
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  // AI Enrichment state
  const [enriching, setEnriching] = useState<string | null>(null);
  // AI Analysis state
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);
  // Interview Prep state
  const [generatingPrep, setGeneratingPrep] = useState<string | null>(null);
  const [prepModal, setPrepModal] = useState<{ job: SavedJob; prep: InterviewPrep } | null>(null);
  // Contact editing state
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  // Email composer state
  const [composingEmail, setComposingEmail] = useState<SavedJob | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [copied, setCopied] = useState(false);
  // Manual job entry state
  const [addingJob, setAddingJob] = useState(false);
  const [savingJob, setSavingJob] = useState(false);
  const [extractingJob, setExtractingJob] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [manualJob, setManualJob] = useState({
    title: '',
    company: '',
    description: '',
    url: '',
    location: '',
    salary: '',
    jobType: '',
    tags: '',
  });

  useEffect(() => {
    fetchSavedJobs(1);
  }, []);

  const fetchSavedJobs = async (pageNum: number = 1) => {
    try {
      pageNum === 1 ? setLoading(true) : setLoadingMore(true);
      const response = await fetch(`/api/jobs/saved?page=${pageNum}&limit=50`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch saved jobs');
      }

      if (pageNum === 1) {
        setJobs(data.jobs);
      } else {
        setJobs((prev) => [...prev, ...data.jobs]);
      }
      setTotalCount(data.total);
      setHasMore(data.hasMore);
      setPage(pageNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load saved jobs');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => fetchSavedJobs(page + 1);

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

      await fetchSavedJobs(1);
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

  const handleSaveContact = async (id: string) => {
    try {
      const response = await fetch(`/api/jobs/saved/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save contact');
      }

      setJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, contactEmail, contactPhone } : j))
      );
      setEditingContact(null);
      showSuccess('Contact info saved');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save contact');
    }
  };

  const openEmailComposer = (job: SavedJob) => {
    setComposingEmail(job);
    setEmailSubject(`Application: ${job.title} - ${job.company}`);
    setEmailBody('');
    setCopied(false);
  };

  const generateEmailWithAI = async () => {
    if (!composingEmail) return;

    try {
      setGeneratingEmail(true);
      const response = await fetch('/api/jobs/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: composingEmail.title,
          company: composingEmail.company,
          description: composingEmail.description,
          jobUrl: composingEmail.url,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate email');
      }

      setEmailSubject(data.subject || emailSubject);
      setEmailBody(data.body);
      showSuccess('Email generated based on your resume!');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to generate email');
    } finally {
      setGeneratingEmail(false);
    }
  };

  const copyEmailToClipboard = async () => {
    const fullEmail = `Subject: ${emailSubject}\n\n${emailBody}`;
    try {
      await navigator.clipboard.writeText(fullEmail);
      setCopied(true);
      showSuccess('Email copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      showError('Failed to copy to clipboard');
    }
  };

  const handleExtractJobInfo = async () => {
    if (!pasteText || pasteText.trim().length < 20) {
      showError('Paste at least 20 characters of job information');
      return;
    }

    try {
      setExtractingJob(true);
      const response = await fetch('/api/jobs/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract job info');
      }

      // Fill the form with extracted data
      setManualJob({
        title: data.title || '',
        company: data.company || '',
        description: data.description || pasteText,
        url: data.url || '',
        location: data.location || '',
        salary: data.salary || '',
        jobType: data.jobType || '',
        tags: data.tags || '',
      });

      setPasteText('');
      showSuccess('Info extracted! Review and save.');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to extract info');
    } finally {
      setExtractingJob(false);
    }
  };

  const handleAddManualJob = async () => {
    if (!manualJob.title || !manualJob.company) {
      showError('Title and company are required');
      return;
    }

    try {
      setSavingJob(true);
      const response = await fetch('/api/jobs/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId: `manual-${Date.now()}`,
          source: 'manual',
          title: manualJob.title,
          company: manualJob.company,
          description: manualJob.description,
          url: manualJob.url || '#',
          location: manualJob.location || null,
          salary: manualJob.salary || null,
          jobType: manualJob.jobType || null,
          tags: manualJob.tags || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save job');
      }

      await fetchSavedJobs();
      setAddingJob(false);
      setManualJob({
        title: '',
        company: '',
        description: '',
        url: '',
        location: '',
        salary: '',
        jobType: '',
        tags: '',
      });
      showSuccess('Job added successfully!');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to add job');
    } finally {
      setSavingJob(false);
    }
  };

  const handleEnrich = async (job: SavedJob) => {
    try {
      setEnriching(job.id);
      const response = await fetch(`/api/jobs/saved/${job.id}/enrich`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enrich job');
      }

      // Update the job in state
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? {
                ...j,
                contactEmail: data.job.contactEmail,
                contactPhone: data.job.contactPhone,
                enrichedData: data.job.enrichedData,
                enrichedAt: data.job.enrichedAt,
              }
            : j
        )
      );

      const foundInfo = [];
      if (data.extracted.emailsFound > 0) foundInfo.push(`${data.extracted.emailsFound} email(s)`);
      if (data.extracted.phonesFound > 0) foundInfo.push(`${data.extracted.phonesFound} phone(s)`);

      if (foundInfo.length > 0) {
        showSuccess(`Found: ${foundInfo.join(', ')}`);
      } else {
        showWarning('No contact info found on the page');
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to enrich job');
    } finally {
      setEnriching(null);
    }
  };

  const handleAnalyze = async (job: SavedJob) => {
    try {
      setAnalyzing(job.id);
      const response = await fetch('/api/jobs/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze job');
      }

      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? {
                ...j,
                aiGrade: data.analysis.grade,
                aiAnalysis: JSON.stringify(data.analysis),
                aiAnalyzedAt: data.analyzedAt ?? new Date().toISOString(),
              }
            : j
        )
      );
      setExpandedAnalysis(job.id);
      showSuccess(`Analysis complete! Grade: ${data.analysis.grade}`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to analyze job');
    } finally {
      setAnalyzing(null);
    }
  };

  const getAIAnalysis = (job: SavedJob): AIAnalysis | null => {
    if (!job.aiAnalysis) return null;
    try {
      return JSON.parse(job.aiAnalysis) as AIAnalysis;
    } catch {
      return null;
    }
  };

  const handleInterviewPrep = async (job: SavedJob) => {
    // If already generated, show cached
    if (job.interviewPrep) {
      try {
        const cached = JSON.parse(job.interviewPrep) as InterviewPrep;
        setPrepModal({ job, prep: cached });
        return;
      } catch {
        // Fall through to regenerate
      }
    }

    try {
      setGeneratingPrep(job.id);
      const response = await fetch(`/api/jobs/saved/${job.id}/interview-prep`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate interview prep');
      }

      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id ? { ...j, interviewPrep: JSON.stringify(data.prep) } : j
        )
      );
      setPrepModal({ job: { ...job, interviewPrep: JSON.stringify(data.prep) }, prep: data.prep });
      showSuccess('Interview prep generated!');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to generate interview prep');
    } finally {
      setGeneratingPrep(null);
    }
  };

  const getEnrichedData = (job: SavedJob): EnrichedData | null => {
    if (!job.enrichedData) return null;
    if (typeof job.enrichedData === 'string') {
      try {
        return JSON.parse(job.enrichedData);
      } catch {
        return null;
      }
    }
    return job.enrichedData;
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
      message: `Delete ${selectedIds.size} saved jobs?`,
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
      setTotalCount((prev) => prev - (data.count ?? selectedIds.size));
      onJobRemoved();
      setSelectedIds(new Set());
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete jobs');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBatchAnalyze = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      setBatchAnalyzing(true);
      const response = await fetch('/api/jobs/batch/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobIds: ids }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Batch analyze failed');

      await fetchSavedJobs(1);
      showSuccess(`Analysis complete: ${data.succeeded}/${data.processed} jobs analyzed.`);
      if (data.failed > 0) {
        showWarning(`${data.failed} job(s) failed.`);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Batch analyze failed');
    } finally {
      setBatchAnalyzing(false);
    }
  };

  const handleBatchGenerateCVs = async () => {
    const ids = Array.from(selectedIds).slice(0, 10);
    if (ids.length === 0) return;

    try {
      setBatchGenerating(true);
      const response = await fetch('/api/jobs/batch/generate-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobIds: ids }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Batch CV generation failed');

      // Trigger PDF downloads for successful generations
      const [{ pdf }, { default: CVDocument }, { default: resumeModule }, React] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/admin/jobs/CVDocument'),
        import('@/data/resume.json'),
        import('react'),
      ]);
      const resumeInfo = resumeModule.personalInfo;

      for (const item of data.cvData) {
        if (!item.success || !item.customCV) continue;
        const job = jobs.find((j) => j.id === item.jobId);
        if (!job) continue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = React.createElement(CVDocument, {
          cv: item.customCV,
          personalInfo: resumeInfo,
          jobTitle: job.title,
          company: job.company,
        }) as any;
        const blob = await pdf(doc).toBlob();

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `cv-${job.company.toLowerCase().replace(/\s+/g, '-')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      await fetchSavedJobs(1);
      showSuccess(`CVs generated: ${data.succeeded}/${data.processed} jobs.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Batch CV generation failed');
    } finally {
      setBatchGenerating(false);
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
        <p className="text-sm text-zinc-500 mb-4">
          Search for jobs and save the ones you&apos;re interested in.
        </p>
        <button
          onClick={() => setAddingJob(true)}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors inline-flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Job Manually
        </button>

        {/* Manual Job Entry Modal for Empty State */}
        {addingJob && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto text-left">
              <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-800">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Job Manually
                </h3>
                <button
                  onClick={() => {
                    setAddingJob(false);
                    setPasteText('');
                    setManualJob({ title: '', company: '', description: '', url: '', location: '', salary: '', jobType: '', tags: '' });
                  }}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-4">
                {/* AI Extraction Section */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI Auto-Extraction
                  </h4>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mb-3">
                    Paste job info and AI will automatically extract title, company, description, etc.
                  </p>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={4}
                    placeholder="Paste the full job description, received email, or any text with job information..."
                    className="w-full px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm"
                  />
                  <button
                    onClick={handleExtractJobInfo}
                    disabled={extractingJob || pasteText.trim().length < 20}
                    className="mt-2 w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                  >
                    {extractingJob ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Extracting info...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Extract with AI
                      </>
                    )}
                  </button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-200 dark:border-zinc-700"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-white dark:bg-zinc-800 text-zinc-500">or fill in manually</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Job Title *
                    </label>
                    <input
                      type="text"
                      value={manualJob.title}
                      onChange={(e) => setManualJob({ ...manualJob, title: e.target.value })}
                      placeholder="e.g., Full Stack Developer"
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Company *
                    </label>
                    <input
                      type="text"
                      value={manualJob.company}
                      onChange={(e) => setManualJob({ ...manualJob, company: e.target.value })}
                      placeholder="e.g., Tech Company"
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Job Description
                  </label>
                  <textarea
                    value={manualJob.description}
                    onChange={(e) => setManualJob({ ...manualJob, description: e.target.value })}
                    rows={4}
                    placeholder="Job description..."
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Job URL
                    </label>
                    <input
                      type="url"
                      value={manualJob.url}
                      onChange={(e) => setManualJob({ ...manualJob, url: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={manualJob.location}
                      onChange={(e) => setManualJob({ ...manualJob, location: e.target.value })}
                      placeholder="e.g., Remote, Lisbon, São Paulo"
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Salary
                    </label>
                    <input
                      type="text"
                      value={manualJob.salary}
                      onChange={(e) => setManualJob({ ...manualJob, salary: e.target.value })}
                      placeholder="e.g., €2000-3000"
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Type
                    </label>
                    <select
                      value={manualJob.jobType}
                      onChange={(e) => setManualJob({ ...manualJob, jobType: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="">Select...</option>
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Contract">Contract</option>
                      <option value="Freelance">Freelance</option>
                      <option value="Internship">Internship</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Tags
                    </label>
                    <input
                      type="text"
                      value={manualJob.tags}
                      onChange={(e) => setManualJob({ ...manualJob, tags: e.target.value })}
                      placeholder="react, node, typescript"
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                  <button
                    onClick={handleAddManualJob}
                    disabled={savingJob || !manualJob.title || !manualJob.company}
                    className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {savingJob ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Save Job
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setAddingJob(false)}
                    className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <BulkActionBar
          selectedCount={selectedIds.size}
          totalCount={totalCount}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          onDelete={handleBulkDelete}
          onExport={handleExport}
          isDeleting={bulkDeleting || exporting}
          onBatchAnalyze={selectedIds.size > 0 ? handleBatchAnalyze : undefined}
          onBatchGenerateCVs={selectedIds.size > 0 ? handleBatchGenerateCVs : undefined}
          batchAnalyzing={batchAnalyzing}
          batchGenerating={batchGenerating}
        />
        <button
          onClick={() => setAddingJob(true)}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Job
        </button>
      </div>

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
                    {job.aiGrade && (
                      <AIGradeBadge grade={job.aiGrade} />
                    )}
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
                  <button
                    onClick={() => openEmailComposer(job)}
                    className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors"
                    title="Compor email de candidatura"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {job.contactEmail ? job.contactEmail : 'Compor Email'}
                  </button>
                  {job.contactPhone && (
                    <a
                      href={`tel:${job.contactPhone}`}
                      className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {job.contactPhone}
                    </a>
                  )}
                  {/* Edit contact button */}
                  <button
                    onClick={() => {
                      setEditingContact(job.id);
                      setContactEmail(job.contactEmail || '');
                      setContactPhone(job.contactPhone || '');
                    }}
                    className="flex items-center gap-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    title="Edit contact info"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    {!job.contactEmail && !job.contactPhone && 'Add Contact'}
                  </button>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    Saved {formatDate(job.savedAt)}
                  </span>
                  {job.enrichedAt && (
                    <span className="flex items-center gap-1 text-purple-500">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      AI Enriched
                    </span>
                  )}
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
                {/* Source Info Card */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Job Information
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="bg-white dark:bg-zinc-800 rounded-lg p-2">
                      <span className="block text-xs text-zinc-500 dark:text-zinc-400">Fonte</span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300 capitalize">{job.source}</span>
                    </div>
                    {job.jobType && (
                      <div className="bg-white dark:bg-zinc-800 rounded-lg p-2">
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">Type</span>
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{job.jobType}</span>
                      </div>
                    )}
                    {job.location && (
                      <div className="bg-white dark:bg-zinc-800 rounded-lg p-2">
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">Local</span>
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{job.location}</span>
                      </div>
                    )}
                    {job.postedAt && (
                      <div className="bg-white dark:bg-zinc-800 rounded-lg p-2">
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">Publicado</span>
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{formatDate(job.postedAt)}</span>
                      </div>
                    )}
                    {job.salary && (
                      <div className="bg-white dark:bg-zinc-800 rounded-lg p-2">
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">Salary</span>
                        <span className="font-medium text-green-600 dark:text-green-400">{job.salary}</span>
                      </div>
                    )}
                    <div className="bg-white dark:bg-zinc-800 rounded-lg p-2">
                      <span className="block text-xs text-zinc-500 dark:text-zinc-400">ID Externo</span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300 text-xs truncate block" title={job.externalId}>{job.externalId.substring(0, 20)}...</span>
                    </div>
                  </div>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    {job.url.length > 60 ? job.url.substring(0, 60) + '...' : job.url}
                  </a>
                </div>

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

                {/* AI Analysis Panel */}
                {(() => {
                  const analysis = getAIAnalysis(job);
                  if (!analysis) return null;
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <button
                          onClick={() => setExpandedAnalysis(expandedAnalysis === job.id ? null : job.id)}
                          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          {expandedAnalysis === job.id ? 'Ocultar Análise IA' : 'Ver Análise IA'}
                        </button>
                        <span className="text-xs text-zinc-400">
                          Nota: <span className="font-bold text-zinc-600 dark:text-zinc-300">{analysis.grade}</span> · {analysis.skillFitPercent}% fit
                        </span>
                      </div>
                      {expandedAnalysis === job.id && <AIAnalysisPanel analysis={analysis} />}
                    </div>
                  );
                })()}

                {/* AI Enriched Data */}
                {(() => {
                  const enriched = getEnrichedData(job);
                  if (!enriched) return null;
                  return (
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        AI Insights
                      </h4>
                      <div className="grid gap-3 text-sm">
                        {enriched.emails && enriched.emails.length > 0 && (
                          <div>
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">Emails: </span>
                            <span className="text-zinc-600 dark:text-zinc-400">
                              {enriched.emails.map((email, i) => (
                                <a key={i} href={`mailto:${email}`} className="text-purple-600 dark:text-purple-400 hover:underline mr-2">
                                  {email}
                                </a>
                              ))}
                            </span>
                          </div>
                        )}
                        {enriched.phones && enriched.phones.length > 0 && (
                          <div>
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">Phones: </span>
                            <span className="text-zinc-600 dark:text-zinc-400">{enriched.phones.join(', ')}</span>
                          </div>
                        )}
                        {enriched.workMode && (
                          <div>
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">Work Mode: </span>
                            <span className="text-zinc-600 dark:text-zinc-400">{enriched.workMode}</span>
                          </div>
                        )}
                        {enriched.contractType && (
                          <div>
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">Contract: </span>
                            <span className="text-zinc-600 dark:text-zinc-400">{enriched.contractType}</span>
                          </div>
                        )}
                        {enriched.requirements && enriched.requirements.length > 0 && (
                          <div>
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">Requirements:</span>
                            <ul className="mt-1 ml-4 list-disc text-zinc-600 dark:text-zinc-400">
                              {enriched.requirements.slice(0, 5).map((req, i) => (
                                <li key={i}>{req}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {enriched.benefits && enriched.benefits.length > 0 && (
                          <div>
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">Benefits:</span>
                            <ul className="mt-1 ml-4 list-disc text-zinc-600 dark:text-zinc-400">
                              {enriched.benefits.slice(0, 5).map((benefit, i) => (
                                <li key={i}>{benefit}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {enriched.applicationProcess && (
                          <div>
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">How to Apply: </span>
                            <span className="text-zinc-600 dark:text-zinc-400">{enriched.applicationProcess}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
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
                {/* AI Analyze Button */}
                <button
                  onClick={() => handleAnalyze(job)}
                  disabled={analyzing === job.id}
                  className="px-3 py-1.5 text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50 transition-colors flex items-center gap-1"
                  title={job.aiAnalyzedAt ? 'Re-analyze with AI' : 'Analyze job fit with AI'}
                >
                  {analyzing === job.id ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Analisando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                      {job.aiAnalyzedAt ? 'Re-analyze' : 'Analyze'}
                    </>
                  )}
                </button>
                {/* CV Generator Button */}
                <CVGeneratorButton
                  job={job}
                  onGenerated={fetchSavedJobs}
                />
                {/* Interview Prep Button */}
                <button
                  onClick={() => handleInterviewPrep(job)}
                  disabled={generatingPrep === job.id}
                  className="px-3 py-1.5 text-sm bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50 disabled:opacity-50 transition-colors flex items-center gap-1"
                  title={job.interviewPrep ? 'View interview prep' : 'Generate interview prep'}
                >
                  {generatingPrep === job.id ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      {job.interviewPrep ? 'Ver Prep' : 'Prep Entrevista'}
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleEnrich(job)}
                  disabled={enriching === job.id}
                  className="px-3 py-1.5 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-50 transition-colors flex items-center gap-1"
                  title={job.enrichedAt ? 'Re-scan for contact info' : 'Scan for contact info'}
                >
                  {enriching === job.id ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Scanning...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      {job.enrichedAt ? 'Re-scan' : 'Find Contact'}
                    </>
                  )}
                </button>
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

      {/* Interview Prep Modal */}
      {prepModal && (
        <InterviewPrepModal
          isOpen={true}
          onClose={() => setPrepModal(null)}
          prep={prepModal.prep}
          jobTitle={prepModal.job.title}
          company={prepModal.job.company}
        />
      )}

      {/* Contact Editing Modal */}
      {editingContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Edit Contact Info</h3>
              <button
                onClick={() => setEditingContact(null)}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contact@company.com"
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+55 11 99999-9999"
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleSaveContact(editingContact)}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingContact(null)}
                  className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Composer Modal */}
      {composingEmail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-xl max-w-2xl w-full overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Compor Email</h3>
                <p className="text-sm text-zinc-500">Para: {composingEmail.contactEmail || 'Email nao encontrado'}</p>
              </div>
              <button
                onClick={() => setComposingEmail(null)}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Generate with AI Button */}
              <button
                onClick={generateEmailWithAI}
                disabled={generatingEmail}
                className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
              >
                {generatingEmail ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating from your resume...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate Email with AI (based on resume)
                  </>
                )}
              </button>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Message
                </label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={12}
                  placeholder="Click 'Generate Email with AI' to create a personalized message based on your resume..."
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={copyEmailToClipboard}
                  disabled={!emailBody}
                  className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                    copied
                      ? 'bg-green-500 text-white'
                      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 disabled:opacity-50'
                  }`}
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
                {composingEmail.contactEmail && (
                  <a
                    href={`mailto:${composingEmail.contactEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Open in Email App
                  </a>
                )}
              </div>
              <p className="text-xs text-zinc-500 text-center">
                AI generates a suggestion based on your resume. You send it manually.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-6 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm"
          >
            {loadingMore ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Carregando...
              </>
            ) : (
              `Carregar mais (${totalCount - jobs.length} restantes)`
            )}
          </button>
        </div>
      )}

      {/* Manual Job Entry Modal */}
      {addingJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-800">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Job Manually
              </h3>
              <button
                onClick={() => {
                  setAddingJob(false);
                  setPasteText('');
                  setManualJob({ title: '', company: '', description: '', url: '', location: '', salary: '', jobType: '', tags: '' });
                }}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* AI Extraction Section */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
                <h4 className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI Auto-Extraction
                </h4>
                <p className="text-xs text-purple-600 dark:text-purple-400 mb-3">
                  Paste job info and AI will automatically extract title, company, description, etc.
                </p>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={4}
                  placeholder="Paste the full job description, received email, or any text with job information..."
                  className="w-full px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm"
                />
                <button
                  onClick={handleExtractJobInfo}
                  disabled={extractingJob || pasteText.trim().length < 20}
                  className="mt-2 w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                >
                  {extractingJob ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Extracting info...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Extract with AI
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-200 dark:border-zinc-700"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white dark:bg-zinc-800 text-zinc-500">or fill in manually</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    value={manualJob.title}
                    onChange={(e) => setManualJob({ ...manualJob, title: e.target.value })}
                    placeholder="e.g., Full Stack Developer"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Company *
                  </label>
                  <input
                    type="text"
                    value={manualJob.company}
                    onChange={(e) => setManualJob({ ...manualJob, company: e.target.value })}
                    placeholder="e.g., Tech Company"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Job Description
                </label>
                <textarea
                  value={manualJob.description}
                  onChange={(e) => setManualJob({ ...manualJob, description: e.target.value })}
                  rows={4}
                  placeholder="Job description..."
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Job URL
                  </label>
                  <input
                    type="url"
                    value={manualJob.url}
                    onChange={(e) => setManualJob({ ...manualJob, url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={manualJob.location}
                    onChange={(e) => setManualJob({ ...manualJob, location: e.target.value })}
                    placeholder="e.g., Remote, Lisbon, São Paulo"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Salary
                  </label>
                  <input
                    type="text"
                    value={manualJob.salary}
                    onChange={(e) => setManualJob({ ...manualJob, salary: e.target.value })}
                    placeholder="e.g., €2000-3000"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Type
                  </label>
                  <select
                    value={manualJob.jobType}
                    onChange={(e) => setManualJob({ ...manualJob, jobType: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="">Select...</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={manualJob.tags}
                    onChange={(e) => setManualJob({ ...manualJob, tags: e.target.value })}
                    placeholder="react, node, typescript"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                <button
                  onClick={handleAddManualJob}
                  disabled={savingJob || !manualJob.title || !manualJob.company}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingJob ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save Job
                    </>
                  )}
                </button>
                <button
                  onClick={() => setAddingJob(false)}
                  className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
