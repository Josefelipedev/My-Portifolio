'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

interface ResumeAnalysis {
  personalInfo: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    linkedin?: string;
    github?: string;
  };
  professionalSummary: {
    pt: string;
    en: string;
  };
  experience: Array<{
    title: string;
    company: string;
    location?: string;
    startDate: string;
    endDate?: string;
    responsibilities: string[];
  }>;
  education: Array<{
    degree: string;
    institution: string;
    location?: string;
    startDate: string;
    endDate?: string;
    description?: string;
  }>;
  skills: Array<{
    name: string;
    level: number;
    category: string;
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
    date?: string;
    description?: string;
  }>;
  languages: Array<{
    language: string;
    level: string;
    notes?: string;
  }>;
}

interface ComparisonItem<T> {
  action: 'add' | 'update' | 'remove' | 'keep';
  current?: T;
  new?: T;
  changes?: string[];
}

interface ComparisonResult {
  experiences: ComparisonItem<{
    title: string;
    company: string;
    location?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    description?: string;
  }>[];
  skills: ComparisonItem<{
    name: string;
    category: string;
    level: number;
  }>[];
  summary: {
    experiences: { add: number; update: number; remove: number; keep: number };
    skills: { add: number; update: number; remove: number; keep: number };
  };
}

type ViewMode = 'upload' | 'analysis' | 'comparison';

export default function ResumeAdminPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [syncOptions, setSyncOptions] = useState({
    syncExperiences: true,
    syncSkills: true,
    syncJson: true,
    clearExisting: false,
  });

  const handleAnalyze = async (file?: File) => {
    try {
      setAnalyzing(true);
      setError(null);
      setSuccess(null);

      let response: Response;

      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        response = await fetch('/api/resume/analyze', {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await fetch('/api/resume/analyze', {
          method: 'POST',
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze resume');
      }

      setAnalysis(data.analysis);
      setProvider(data.provider);
      setViewMode('analysis');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze resume');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleAnalyze(file);
    }
  };

  const handleCompare = async () => {
    if (!analysis) return;

    try {
      setComparing(true);
      setError(null);

      const response = await fetch('/api/resume/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to compare resume data');
      }

      setComparison(data.comparison);
      setViewMode('comparison');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare');
    } finally {
      setComparing(false);
    }
  };

  const handleSync = async () => {
    if (!analysis) return;

    try {
      setSyncing(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/resume/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis,
          options: syncOptions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync resume data');
      }

      setSuccess(data.message);
      setComparison(null);
      setViewMode('analysis');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  };

  const handleReset = () => {
    setAnalysis(null);
    setComparison(null);
    setViewMode('upload');
    setError(null);
    setSuccess(null);
  };

  const getLevelLabel = (level: number) => {
    const labels = ['', 'Beginner', 'Basic', 'Intermediate', 'Advanced', 'Expert'];
    return labels[level] || '';
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'add':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'update':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 'remove':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'keep':
        return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700';
      default:
        return 'bg-zinc-100 dark:bg-zinc-800';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'add':
        return 'Adicionar';
      case 'update':
        return 'Atualizar';
      case 'remove':
        return 'Remover';
      case 'keep':
        return 'Manter';
      default:
        return action;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-100">Resume Analyzer</h1>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1 text-sm md:text-base">
              Upload your resume PDF and let AI extract structured data
            </p>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors text-center"
          >
            Back
          </Link>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              viewMode === 'upload' ? 'bg-blue-500 text-white' : 'bg-green-500 text-white'
            }`}>
              {viewMode === 'upload' ? '1' : '✓'}
            </div>
            <div className={`w-8 md:w-12 h-1 rounded ${viewMode !== 'upload' ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              viewMode === 'analysis' ? 'bg-blue-500 text-white' :
              viewMode === 'comparison' ? 'bg-green-500 text-white' : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-500'
            }`}>
              {viewMode === 'comparison' ? '✓' : '2'}
            </div>
            <div className={`w-8 md:w-12 h-1 rounded ${viewMode === 'comparison' ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              viewMode === 'comparison' ? 'bg-blue-500 text-white' : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-500'
            }`}>
              3
            </div>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6">
            <p className="text-green-600 dark:text-green-400">{success}</p>
          </div>
        )}

        {/* Step 1: Upload Section */}
        {viewMode === 'upload' && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 md:p-8 border border-zinc-200 dark:border-zinc-700 mb-8">
            <div className="text-center">
              <div className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 md:w-10 md:h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-lg md:text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Step 1: Analyze Resume PDF
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-6 max-w-md mx-auto text-sm md:text-base">
                Upload a new PDF or analyze the existing resume at <code className="text-xs md:text-sm bg-zinc-100 dark:bg-zinc-700 px-2 py-0.5 rounded">src/data/resume.pdf</code>
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={analyzing}
                  className="px-6 py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload New PDF
                </button>
                <button
                  onClick={() => handleAnalyze()}
                  disabled={analyzing}
                  className="px-6 py-3 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Analyze Existing PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Analysis Results */}
        {viewMode === 'analysis' && analysis && (
          <>
            {/* Action Bar */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 md:p-6 border border-zinc-200 dark:border-zinc-700 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Step 2: Review Extracted Data
                  </h2>
                  <p className="text-sm text-zinc-500">
                    Provider: <span className="text-blue-500">{provider}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                  >
                    Start Over
                  </button>
                  <button
                    onClick={handleCompare}
                    disabled={comparing}
                    className="px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {comparing ? (
                      <>
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Comparing...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Compare with Database
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Personal Info */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 md:p-6 border border-zinc-200 dark:border-zinc-700 mb-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-zinc-500 mb-1">Name</p>
                  <p className="text-zinc-900 dark:text-zinc-100">{analysis.personalInfo.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500 mb-1">Email</p>
                  <p className="text-zinc-900 dark:text-zinc-100">{analysis.personalInfo.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500 mb-1">Phone</p>
                  <p className="text-zinc-900 dark:text-zinc-100">{analysis.personalInfo.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500 mb-1">Location</p>
                  <p className="text-zinc-900 dark:text-zinc-100">{analysis.personalInfo.address || '-'}</p>
                </div>
              </div>
            </div>

            {/* Experience */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 md:p-6 border border-zinc-200 dark:border-zinc-700 mb-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Experience ({analysis.experience.length})
              </h2>
              <div className="space-y-4">
                {analysis.experience.map((exp, idx) => (
                  <div key={idx} className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                      <div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{exp.title}</h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          {exp.company} {exp.location && `• ${exp.location}`}
                        </p>
                      </div>
                      <span className="text-sm text-zinc-500">
                        {exp.startDate} - {exp.endDate || 'Present'}
                      </span>
                    </div>
                    {exp.responsibilities.length > 0 && (
                      <ul className="list-disc list-inside text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                        {exp.responsibilities.slice(0, 3).map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                        {exp.responsibilities.length > 3 && (
                          <li className="text-zinc-400">+{exp.responsibilities.length - 3} more...</li>
                        )}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Skills */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 md:p-6 border border-zinc-200 dark:border-zinc-700 mb-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Skills ({analysis.skills.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {analysis.skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm flex items-center gap-2"
                  >
                    {skill.name}
                    <span className="text-xs opacity-70">
                      ({getLevelLabel(skill.level)})
                    </span>
                  </span>
                ))}
              </div>
            </div>

            {/* Education */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 md:p-6 border border-zinc-200 dark:border-zinc-700">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Education ({analysis.education.length})
              </h2>
              <div className="space-y-4">
                {analysis.education.map((edu, idx) => (
                  <div key={idx} className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                      <div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{edu.degree}</h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          {edu.institution} {edu.location && `• ${edu.location}`}
                        </p>
                      </div>
                      <span className="text-sm text-zinc-500">
                        {edu.startDate} - {edu.endDate || 'Present'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Step 3: Comparison View */}
        {viewMode === 'comparison' && comparison && (
          <>
            {/* Action Bar */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 md:p-6 border border-zinc-200 dark:border-zinc-700 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Step 3: Review Changes
                  </h2>
                  <p className="text-sm text-zinc-500">
                    Review what will be added, updated, or removed
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setViewMode('analysis')}
                    className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="px-4 py-2 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {syncing ? (
                      <>
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Syncing...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Apply Changes
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Sync Options */}
              <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncOptions.syncExperiences}
                      onChange={(e) => setSyncOptions({ ...syncOptions, syncExperiences: e.target.checked })}
                      className="w-4 h-4 rounded border-zinc-300 text-blue-500"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Sync Experiences</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncOptions.syncSkills}
                      onChange={(e) => setSyncOptions({ ...syncOptions, syncSkills: e.target.checked })}
                      className="w-4 h-4 rounded border-zinc-300 text-blue-500"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Sync Skills</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncOptions.syncJson}
                      onChange={(e) => setSyncOptions({ ...syncOptions, syncJson: e.target.checked })}
                      className="w-4 h-4 rounded border-zinc-300 text-blue-500"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Update resume.json</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncOptions.clearExisting}
                      onChange={(e) => setSyncOptions({ ...syncOptions, clearExisting: e.target.checked })}
                      className="w-4 h-4 rounded border-zinc-300 text-red-500"
                    />
                    <span className="text-sm text-red-600 dark:text-red-400">Clear existing</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Experiences</h3>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-sm">
                    +{comparison.summary.experiences.add} add
                  </span>
                  <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded text-sm">
                    ~{comparison.summary.experiences.update} update
                  </span>
                  <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-sm">
                    -{comparison.summary.experiences.remove} remove
                  </span>
                  <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded text-sm">
                    ={comparison.summary.experiences.keep} keep
                  </span>
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-sm">
                    +{comparison.summary.skills.add} add
                  </span>
                  <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded text-sm">
                    ~{comparison.summary.skills.update} update
                  </span>
                  <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-sm">
                    -{comparison.summary.skills.remove} remove
                  </span>
                  <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded text-sm">
                    ={comparison.summary.skills.keep} keep
                  </span>
                </div>
              </div>
            </div>

            {/* Experiences Comparison */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 md:p-6 border border-zinc-200 dark:border-zinc-700 mb-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Experiences Changes
              </h2>
              <div className="space-y-3">
                {comparison.experiences.map((item, idx) => (
                  <div key={idx} className={`p-4 rounded-lg border ${getActionColor(item.action)}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionColor(item.action)}`}>
                            {getActionLabel(item.action)}
                          </span>
                        </div>
                        {item.action === 'add' && item.new && (
                          <div>
                            <p className="font-medium">{item.new.title}</p>
                            <p className="text-sm opacity-70">{item.new.company}</p>
                          </div>
                        )}
                        {item.action === 'remove' && item.current && (
                          <div>
                            <p className="font-medium line-through">{item.current.title}</p>
                            <p className="text-sm opacity-70 line-through">{item.current.company}</p>
                          </div>
                        )}
                        {item.action === 'update' && (
                          <div>
                            <p className="font-medium">{item.current?.title}</p>
                            <p className="text-sm opacity-70">{item.current?.company}</p>
                            {item.changes && (
                              <ul className="mt-2 text-sm">
                                {item.changes.map((change, i) => (
                                  <li key={i} className="opacity-80">• {change}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                        {item.action === 'keep' && item.current && (
                          <div>
                            <p className="font-medium">{item.current.title}</p>
                            <p className="text-sm opacity-70">{item.current.company}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Skills Comparison */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 md:p-6 border border-zinc-200 dark:border-zinc-700">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Skills Changes
              </h2>
              <div className="flex flex-wrap gap-2">
                {comparison.skills.map((item, idx) => (
                  <div
                    key={idx}
                    className={`px-3 py-2 rounded-lg border ${getActionColor(item.action)}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium opacity-70">
                        {item.action === 'add' && '+'}
                        {item.action === 'remove' && '-'}
                        {item.action === 'update' && '~'}
                        {item.action === 'keep' && '='}
                      </span>
                      <span className={item.action === 'remove' ? 'line-through' : ''}>
                        {item.current?.name || item.new?.name}
                      </span>
                      {item.action === 'update' && item.changes && (
                        <span className="text-xs opacity-70">
                          ({item.changes.join(', ')})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
