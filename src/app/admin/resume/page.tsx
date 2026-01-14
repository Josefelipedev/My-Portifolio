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

export default function ResumeAdminPage() {
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  };

  const getLevelLabel = (level: number) => {
    const labels = ['', 'Beginner', 'Basic', 'Intermediate', 'Advanced', 'Expert'];
    return labels[level] || '';
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Resume Analyzer</h1>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              Upload your resume PDF and let AI extract structured data
            </p>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
          >
            Back
          </Link>
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

        {/* Upload Section */}
        {!analysis && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-8 border border-zinc-200 dark:border-zinc-700 mb-8">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Analyze Resume PDF
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-6 max-w-md mx-auto">
                Upload a new PDF or analyze the existing resume at <code className="text-sm bg-zinc-100 dark:bg-zinc-700 px-2 py-0.5 rounded">src/data/resume.pdf</code>
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

        {/* Analysis Results */}
        {analysis && (
          <>
            {/* Sync Options */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 border border-zinc-200 dark:border-zinc-700 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Sync to Database
                  </h2>
                  <p className="text-sm text-zinc-500">
                    Provider: <span className="text-blue-500">{provider}</span>
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setAnalysis(null)}
                    className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                  >
                    Analyze Again
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Sync to Database
                      </>
                    )}
                  </button>
                </div>
              </div>
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
                  <span className="text-sm text-red-600 dark:text-red-400">Clear existing data</span>
                </label>
              </div>
            </div>

            {/* Personal Info */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 border border-zinc-200 dark:border-zinc-700 mb-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Personal Information</h2>
              <div className="grid md:grid-cols-2 gap-4">
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
                <div>
                  <p className="text-sm text-zinc-500 mb-1">LinkedIn</p>
                  <p className="text-zinc-900 dark:text-zinc-100">{analysis.personalInfo.linkedin || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500 mb-1">GitHub</p>
                  <p className="text-zinc-900 dark:text-zinc-100">{analysis.personalInfo.github || '-'}</p>
                </div>
              </div>
            </div>

            {/* Professional Summary */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 border border-zinc-200 dark:border-zinc-700 mb-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Professional Summary</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-zinc-500 mb-1">English</p>
                  <p className="text-zinc-700 dark:text-zinc-300">{analysis.professionalSummary.en || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500 mb-1">Portuguese</p>
                  <p className="text-zinc-700 dark:text-zinc-300">{analysis.professionalSummary.pt || '-'}</p>
                </div>
              </div>
            </div>

            {/* Experience */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 border border-zinc-200 dark:border-zinc-700 mb-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Experience ({analysis.experience.length})
              </h2>
              <div className="space-y-4">
                {analysis.experience.map((exp, idx) => (
                  <div key={idx} className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
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
                        {exp.responsibilities.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Skills */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 border border-zinc-200 dark:border-zinc-700 mb-6">
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
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 border border-zinc-200 dark:border-zinc-700 mb-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Education ({analysis.education.length})
              </h2>
              <div className="space-y-4">
                {analysis.education.map((edu, idx) => (
                  <div key={idx} className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{edu.degree}</h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          {edu.institution} {edu.location && `• ${edu.location}`}
                        </p>
                        {edu.description && (
                          <p className="text-sm text-zinc-500 mt-1">{edu.description}</p>
                        )}
                      </div>
                      <span className="text-sm text-zinc-500">
                        {edu.startDate} - {edu.endDate || 'Present'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Certifications */}
            {analysis.certifications.length > 0 && (
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 border border-zinc-200 dark:border-zinc-700 mb-6">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                  Certifications ({analysis.certifications.length})
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {analysis.certifications.map((cert, idx) => (
                    <div key={idx} className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{cert.name}</h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {cert.issuer} {cert.date && `• ${cert.date}`}
                      </p>
                      {cert.description && (
                        <p className="text-sm text-zinc-500 mt-1">{cert.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {analysis.languages.length > 0 && (
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 border border-zinc-200 dark:border-zinc-700">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Languages</h2>
                <div className="flex flex-wrap gap-4">
                  {analysis.languages.map((lang, idx) => (
                    <div key={idx} className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{lang.language}</span>
                      <span className="text-sm text-zinc-500 ml-2">({lang.level})</span>
                      {lang.notes && (
                        <p className="text-xs text-zinc-400 mt-1">{lang.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
