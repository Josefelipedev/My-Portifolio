'use client';

import { useState, useRef, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';

interface Experience {
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  responsibilities: string[];
}

interface Skill {
  name: string;
  level: number;
  category: string;
}

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
  experience: Experience[];
  education: Array<{
    degree: string;
    institution: string;
    location?: string;
    startDate: string;
    endDate?: string;
    description?: string;
  }>;
  skills: Skill[];
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

interface EditableExperience extends Experience {
  id: string;
  included: boolean;
  action: 'add' | 'update' | 'remove' | 'keep';
}

interface EditableSkill extends Skill {
  id: string;
  included: boolean;
  action: 'add' | 'update' | 'remove' | 'keep';
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
    company: string | null;
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

  // Editable states for comparison view
  const [editableExperiences, setEditableExperiences] = useState<EditableExperience[]>([]);
  const [editableSkills, setEditableSkills] = useState<EditableSkill[]>([]);

  // Modal states
  const [editingExperience, setEditingExperience] = useState<EditableExperience | null>(null);
  const [editingSkill, setEditingSkill] = useState<EditableSkill | null>(null);

  const [syncOptions, setSyncOptions] = useState({
    syncExperiences: true,
    syncSkills: true,
    syncJson: true,
  });

  // Contact info editing state
  const [editingContactInfo, setEditingContactInfo] = useState(false);
  const [savingContactInfo, setSavingContactInfo] = useState(false);
  const [contactInfo, setContactInfo] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    linkedin: '',
    github: '',
    portfolio: '',
  });

  // Load current contact info
  const loadContactInfo = async () => {
    try {
      const response = await fetch('/api/resume?section=personal');
      const data = await response.json();
      if (data.personalInfo) {
        setContactInfo({
          name: data.personalInfo.name || '',
          email: data.personalInfo.email || '',
          phone: data.personalInfo.phone || '',
          address: data.personalInfo.address || '',
          linkedin: data.personalInfo.linkedin || '',
          github: data.personalInfo.github || '',
          portfolio: data.personalInfo.portfolio || '',
        });
      }
    } catch {
      console.error('Failed to load contact info');
    }
  };

  const handleSaveContactInfo = async () => {
    try {
      setSavingContactInfo(true);
      const response = await fetch('/api/resume', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personalInfo: contactInfo }),
      });

      if (!response.ok) {
        throw new Error('Failed to save contact info');
      }

      setSuccess('Contact info updated successfully!');
      setEditingContactInfo(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingContactInfo(false);
    }
  };

  // Load contact info when editing modal opens
  useEffect(() => {
    if (editingContactInfo) {
      loadContactInfo();
    }
  }, [editingContactInfo]);

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

      // Convert comparison to editable format
      const expEditable: EditableExperience[] = data.comparison.experiences.map((item: ComparisonItem<{ title: string; company: string | null; location?: string | null; startDate?: string | null; endDate?: string | null; description?: string }>, idx: number) => ({
        id: `exp-${idx}`,
        title: item.new?.title || item.current?.title || '',
        company: item.new?.company || item.current?.company || '',
        location: item.new?.location || item.current?.location || '',
        startDate: item.new?.startDate || item.current?.startDate || '',
        endDate: item.new?.endDate || item.current?.endDate || '',
        responsibilities: item.new?.description?.split('. ') || item.current?.description?.split('. ') || [],
        included: item.action !== 'keep',
        action: item.action,
      }));

      const skillEditable: EditableSkill[] = data.comparison.skills.map((item: ComparisonItem<{ name: string; category: string; level: number }>, idx: number) => ({
        id: `skill-${idx}`,
        name: item.new?.name || item.current?.name || '',
        category: item.new?.category || item.current?.category || 'other',
        level: item.new?.level || item.current?.level || 3,
        included: item.action !== 'keep',
        action: item.action,
      }));

      setEditableExperiences(expEditable);
      setEditableSkills(skillEditable);
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

      // Build modified analysis from editable states
      const modifiedAnalysis: ResumeAnalysis = {
        ...analysis,
        experience: editableExperiences
          .filter(exp => exp.included && exp.action !== 'remove')
          .map(exp => ({
            title: exp.title,
            company: exp.company,
            location: exp.location,
            startDate: exp.startDate,
            endDate: exp.endDate,
            responsibilities: exp.responsibilities,
          })),
        skills: editableSkills
          .filter(skill => skill.included && skill.action !== 'remove')
          .map(skill => ({
            name: skill.name,
            category: skill.category,
            level: skill.level,
          })),
      };

      const response = await fetch('/api/resume/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis: modifiedAnalysis,
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
    setEditableExperiences([]);
    setEditableSkills([]);
    setViewMode('upload');
    setError(null);
    setSuccess(null);
  };

  const toggleExperienceIncluded = (id: string) => {
    setEditableExperiences(prev =>
      prev.map(exp => exp.id === id ? { ...exp, included: !exp.included } : exp)
    );
  };

  const toggleSkillIncluded = (id: string) => {
    setEditableSkills(prev =>
      prev.map(skill => skill.id === id ? { ...skill, included: !skill.included } : skill)
    );
  };

  const updateExperience = (updated: EditableExperience) => {
    setEditableExperiences(prev =>
      prev.map(exp => exp.id === updated.id ? updated : exp)
    );
    setEditingExperience(null);
  };

  const updateSkill = (updated: EditableSkill) => {
    setEditableSkills(prev =>
      prev.map(skill => skill.id === updated.id ? updated : skill)
    );
    setEditingSkill(null);
  };

  const getLevelLabel = (level: number) => {
    const labels = ['', 'Beginner', 'Basic', 'Intermediate', 'Advanced', 'Expert'];
    return labels[level] || '';
  };

  const getActionColor = (action: string, included: boolean) => {
    if (!included) return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700 opacity-50';
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
      case 'add': return 'Add';
      case 'update': return 'Update';
      case 'remove': return 'Remove';
      case 'keep': return 'Keep';
      default: return action;
    }
  };

  const countIncluded = () => {
    const expCount = editableExperiences.filter(e => e.included && e.action !== 'keep').length;
    const skillCount = editableSkills.filter(s => s.included && s.action !== 'keep').length;
    return { expCount, skillCount };
  };

  return (
    <AdminLayout
      title="Resume Analyzer"
      subtitle="Upload your resume PDF and let AI extract structured data"
    >
      <div className="max-w-6xl mx-auto">

        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              viewMode === 'upload' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
            }`}>
              {viewMode === 'upload' ? '1' : '✓'}
            </div>
            <div className={`w-8 md:w-12 h-1 rounded ${viewMode !== 'upload' ? 'bg-red-500' : 'bg-zinc-300 dark:bg-zinc-700'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              viewMode === 'analysis' ? 'bg-red-500 text-white' :
              viewMode === 'comparison' ? 'bg-green-500 text-white' : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-500'
            }`}>
              {viewMode === 'comparison' ? '✓' : '2'}
            </div>
            <div className={`w-8 md:w-12 h-1 rounded ${viewMode === 'comparison' ? 'bg-red-500' : 'bg-zinc-300 dark:bg-zinc-700'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              viewMode === 'comparison' ? 'bg-red-500 text-white' : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-500'
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

        {/* Contact Info Edit Card - Always visible */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 md:p-6 border border-zinc-200 dark:border-zinc-700 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Informacoes de Contato</h3>
                <p className="text-sm text-zinc-500">LinkedIn, GitHub, Email, Portfolio</p>
              </div>
            </div>
            <button
              onClick={() => setEditingContactInfo(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Editar
            </button>
          </div>
        </div>

        {/* Step 1: Upload Section */}
        {viewMode === 'upload' && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 md:p-8 border border-zinc-200 dark:border-zinc-700 mb-8">
            <div className="text-center">
              <div className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 md:w-10 md:h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-lg md:text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Step 1: Analyze Resume PDF
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-6 max-w-md mx-auto text-sm md:text-base">
                Upload a new PDF or analyze the existing resume
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
                  className="px-6 py-3 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
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
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 md:p-6 border border-zinc-200 dark:border-zinc-700 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Step 2: Review Extracted Data
                  </h2>
                  <p className="text-sm text-zinc-500">
                    Provider: <span className="text-red-500">{provider}</span>
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
                    className="px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {comparing ? 'Comparing...' : 'Compare with Database'}
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
              </div>
            </div>

            {/* Experience Preview */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 md:p-6 border border-zinc-200 dark:border-zinc-700 mb-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Experience ({analysis.experience.length})
              </h2>
              <div className="space-y-3">
                {analysis.experience.map((exp, idx) => (
                  <div key={idx} className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{exp.title}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{exp.company}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Skills Preview */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 md:p-6 border border-zinc-200 dark:border-zinc-700">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Skills ({analysis.skills.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {analysis.skills.map((skill, idx) => (
                  <span key={idx} className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
                    {skill.name} ({getLevelLabel(skill.level)})
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Step 3: Comparison View with Edit */}
        {viewMode === 'comparison' && (
          <>
            {/* Action Bar */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 md:p-6 border border-zinc-200 dark:border-zinc-700 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Step 3: Edit & Select Changes
                  </h2>
                  <p className="text-sm text-zinc-500">
                    Click on items to edit, use checkboxes to include/exclude
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
                    {syncing ? 'Syncing...' : `Apply (${countIncluded().expCount + countIncluded().skillCount} changes)`}
                  </button>
                </div>
              </div>

              {/* Sync Options */}
              <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncOptions.syncExperiences}
                      onChange={(e) => setSyncOptions({ ...syncOptions, syncExperiences: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Sync Experiences</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncOptions.syncSkills}
                      onChange={(e) => setSyncOptions({ ...syncOptions, syncSkills: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Sync Skills</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncOptions.syncJson}
                      onChange={(e) => setSyncOptions({ ...syncOptions, syncJson: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Update resume.json</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Experiences with Edit */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 md:p-6 border border-zinc-200 dark:border-zinc-700 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Experiences ({editableExperiences.filter(e => e.included).length}/{editableExperiences.length} selected)
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditableExperiences(prev => prev.map(e => ({ ...e, included: true })))}
                    className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setEditableExperiences(prev => prev.map(e => ({ ...e, included: false })))}
                    className="text-xs px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {editableExperiences.map((exp) => (
                  <div
                    key={exp.id}
                    className={`p-4 rounded-lg border transition-all ${getActionColor(exp.action, exp.included)}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={exp.included}
                        onChange={() => toggleExperienceIncluded(exp.id)}
                        className="mt-1 w-4 h-4 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium`}>
                            {getActionLabel(exp.action)}
                          </span>
                        </div>
                        <p className={`font-medium ${!exp.included ? 'line-through opacity-50' : ''}`}>
                          {exp.title}
                        </p>
                        <p className={`text-sm opacity-70 ${!exp.included ? 'line-through' : ''}`}>
                          {exp.company} • {exp.startDate} - {exp.endDate || 'Present'}
                        </p>
                      </div>
                      <button
                        onClick={() => setEditingExperience(exp)}
                        className="p-2 hover:bg-white/50 dark:hover:bg-black/20 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Skills with Edit */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 md:p-6 border border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Skills ({editableSkills.filter(s => s.included).length}/{editableSkills.length} selected)
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditableSkills(prev => prev.map(s => ({ ...s, included: true })))}
                    className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setEditableSkills(prev => prev.map(s => ({ ...s, included: false })))}
                    className="text-xs px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {editableSkills.map((skill) => (
                  <div
                    key={skill.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${getActionColor(skill.action, skill.included)}`}
                  >
                    <input
                      type="checkbox"
                      checked={skill.included}
                      onChange={() => toggleSkillIncluded(skill.id)}
                      className="w-3 h-3 rounded"
                    />
                    <span className={`text-xs opacity-70`}>
                      {skill.action === 'add' && '+'}
                      {skill.action === 'remove' && '-'}
                      {skill.action === 'update' && '~'}
                    </span>
                    <span className={!skill.included ? 'line-through opacity-50' : ''}>
                      {skill.name}
                    </span>
                    <span className="text-xs opacity-50">Lv.{skill.level}</span>
                    <button
                      onClick={() => setEditingSkill(skill)}
                      className="p-1 hover:bg-white/50 dark:hover:bg-black/20 rounded transition-colors"
                      title="Edit"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Edit Experience Modal */}
        {editingExperience && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Edit Experience</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Title</label>
                  <input
                    type="text"
                    value={editingExperience.title}
                    onChange={(e) => setEditingExperience({ ...editingExperience, title: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Company</label>
                  <input
                    type="text"
                    value={editingExperience.company}
                    onChange={(e) => setEditingExperience({ ...editingExperience, company: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Location</label>
                  <input
                    type="text"
                    value={editingExperience.location || ''}
                    onChange={(e) => setEditingExperience({ ...editingExperience, location: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Start Date</label>
                    <input
                      type="text"
                      placeholder="YYYY-MM"
                      value={editingExperience.startDate}
                      onChange={(e) => setEditingExperience({ ...editingExperience, startDate: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">End Date</label>
                    <input
                      type="text"
                      placeholder="YYYY-MM or empty"
                      value={editingExperience.endDate || ''}
                      onChange={(e) => setEditingExperience({ ...editingExperience, endDate: e.target.value || undefined })}
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Responsibilities (one per line)</label>
                  <textarea
                    rows={4}
                    value={editingExperience.responsibilities.join('\n')}
                    onChange={(e) => setEditingExperience({ ...editingExperience, responsibilities: e.target.value.split('\n').filter(r => r.trim()) })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setEditingExperience(null)}
                  className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateExperience(editingExperience)}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Skill Modal */}
        {editingSkill && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 max-w-sm w-full">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Edit Skill</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={editingSkill.name}
                    onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Category</label>
                  <select
                    value={editingSkill.category}
                    onChange={(e) => setEditingSkill({ ...editingSkill, category: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                  >
                    <option value="frontend">Frontend</option>
                    <option value="backend">Backend</option>
                    <option value="devops">DevOps</option>
                    <option value="tools">Tools</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Level (1-5)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={editingSkill.level}
                      onChange={(e) => setEditingSkill({ ...editingSkill, level: parseInt(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-20">{getLevelLabel(editingSkill.level)}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setEditingSkill(null)}
                  className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateSkill(editingSkill)}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Contact Info Modal */}
        {editingContactInfo && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-800">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Editar Informacoes de Contato
                </h3>
                <button
                  onClick={() => setEditingContactInfo(false)}
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
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={contactInfo.name}
                    onChange={(e) => setContactInfo({ ...contactInfo, name: e.target.value })}
                    placeholder="Jose Felipe Almeida da Silva"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={contactInfo.email}
                      onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                      placeholder="email@exemplo.com"
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Telefone
                    </label>
                    <input
                      type="tel"
                      value={contactInfo.phone}
                      onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                      placeholder="+351 913 884 527"
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Endereco
                  </label>
                  <input
                    type="text"
                    value={contactInfo.address}
                    onChange={(e) => setContactInfo({ ...contactInfo, address: e.target.value })}
                    placeholder="Cidade, Pais"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
                  <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Redes Sociais & Portfolio</h4>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                        LinkedIn (apenas o username)
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-400">linkedin.com/in/</span>
                        <input
                          type="text"
                          value={contactInfo.linkedin}
                          onChange={(e) => setContactInfo({ ...contactInfo, linkedin: e.target.value })}
                          placeholder="jose-felipe-almeida-da-silva"
                          className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                        GitHub (apenas o username)
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-400">github.com/</span>
                        <input
                          type="text"
                          value={contactInfo.github}
                          onChange={(e) => setContactInfo({ ...contactInfo, github: e.target.value })}
                          placeholder="josefelipedev"
                          className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                        Portfolio URL
                      </label>
                      <input
                        type="url"
                        value={contactInfo.portfolio}
                        onChange={(e) => setContactInfo({ ...contactInfo, portfolio: e.target.value })}
                        placeholder="https://portfolio.josefelipedev.com"
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                  <button
                    onClick={handleSaveContactInfo}
                    disabled={savingContactInfo}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {savingContactInfo ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Salvar
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setEditingContactInfo(false)}
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
    </AdminLayout>
  );
}
