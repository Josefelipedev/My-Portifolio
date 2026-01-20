'use client';

import { useState, useEffect } from 'react';

interface JobListing {
  id: string;
  source: 'remoteok' | 'remotive' | 'arbeitnow' | 'adzuna' | 'jooble' | 'jsearch' | 'netempregos';
  title: string;
  company: string;
  companyLogo?: string;
  description: string;
  url: string;
  location?: string;
  jobType?: string;
  salary?: string;
  tags?: string[];
  postedAt?: string;
  country?: string;
}

interface ApiStatus {
  name: string;
  configured: boolean;
  needsKey: boolean;
}

interface JobSearchProps {
  onJobSaved: () => void;
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  remoteok: { label: 'RemoteOK', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  remotive: { label: 'Remotive', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  arbeitnow: { label: 'Arbeitnow', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' },
  adzuna: { label: 'Adzuna', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
  jooble: { label: 'Jooble', color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400' },
  jsearch: { label: 'JSearch', color: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400' },
  netempregos: { label: 'Net-Empregos', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' },
};

const COUNTRY_OPTIONS = [
  { value: 'all', label: 'All Countries', flag: '🌍' },
  { value: 'remote', label: 'Remote Only', flag: '🏠' },
  { value: 'pt', label: 'Portugal', flag: '🇵🇹' },
  { value: 'br', label: 'Brazil', flag: '🇧🇷' },
];

const DATE_FILTER_OPTIONS = [
  { value: '0', label: 'Todas as datas' },
  { value: '7', label: 'Ultimos 7 dias' },
  { value: '15', label: 'Ultimos 15 dias' },
  { value: '30', label: 'Ultimo mes' },
  { value: '60', label: 'Ultimos 2 meses' },
];

const SOURCE_OPTIONS = [
  { value: 'remoteok', label: 'RemoteOK', region: 'Remote' },
  { value: 'remotive', label: 'Remotive', region: 'Remote' },
  { value: 'arbeitnow', label: 'Arbeitnow', region: 'EU' },
  { value: 'netempregos', label: 'Net-Empregos', region: 'PT' },
  { value: 'adzuna', label: 'Adzuna', region: 'PT/BR' },
  { value: 'jooble', label: 'Jooble', region: 'Global' },
  { value: 'jsearch', label: 'JSearch', region: 'Global' },
];

export default function JobSearch({ onJobSaved }: JobSearchProps) {
  const [keyword, setKeyword] = useState('');
  const [country, setCountry] = useState('all');
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set(['all']));
  const [maxAgeDays, setMaxAgeDays] = useState('0');
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus[]>([]);
  const [showApiStatus, setShowApiStatus] = useState(false);
  const [smartSearchKeywords, setSmartSearchKeywords] = useState<string[]>([]);
  const [isSmartSearch, setIsSmartSearch] = useState(false);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);

  const toggleSource = (source: string) => {
    setSelectedSources(prev => {
      const newSet = new Set(prev);
      if (source === 'all') {
        // If selecting 'all', clear everything and add 'all'
        return new Set(['all']);
      }
      // Remove 'all' when selecting specific sources
      newSet.delete('all');
      if (newSet.has(source)) {
        newSet.delete(source);
        // If nothing selected, default to 'all'
        if (newSet.size === 0) return new Set(['all']);
      } else {
        newSet.add(source);
      }
      return newSet;
    });
  };

  const getSourceParam = () => {
    if (selectedSources.has('all')) return 'all';
    return Array.from(selectedSources).join(',');
  };

  const getSourceLabel = () => {
    if (selectedSources.has('all')) return 'Todas as fontes';
    if (selectedSources.size === 1) {
      const source = Array.from(selectedSources)[0];
      return SOURCE_OPTIONS.find(s => s.value === source)?.label || source;
    }
    return `${selectedSources.size} fontes`;
  };

  // Fetch API status on mount
  useEffect(() => {
    fetch('/api/jobs/search?status=true')
      .then(res => res.json())
      .then(data => setApiStatus(data.apis || []))
      .catch(() => {});
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-source-dropdown]')) {
        setShowSourceDropdown(false);
      }
    };
    if (showSourceDropdown) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showSourceDropdown]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;

    try {
      setLoading(true);
      setError(null);
      setIsSmartSearch(false);
      setSmartSearchKeywords([]);

      const params = new URLSearchParams({
        keyword,
        country,
        source: getSourceParam(),
        limit: '50',
        maxAgeDays,
      });
      const response = await fetch(`/api/jobs/search?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search jobs');
      }

      setJobs(data.jobs);
      if (data.apis) {
        setApiStatus(data.apis);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSmartSearch = async () => {
    try {
      setLoading(true);
      setError(null);
      setIsSmartSearch(true);

      const params = new URLSearchParams({
        country,
        source: getSourceParam(),
        limit: '50',
        maxAgeDays,
      });
      const response = await fetch(`/api/jobs/smart-search?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to perform smart search');
      }

      setJobs(data.jobs);
      setSmartSearchKeywords(data.keywords || []);
      if (data.apis) {
        setApiStatus(data.apis);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Smart search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveJob = async (job: JobListing) => {
    try {
      setSaving(job.id);
      const response = await fetch('/api/jobs/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId: job.id,
          source: job.source,
          title: job.title,
          company: job.company,
          companyLogo: job.companyLogo,
          description: job.description,
          url: job.url,
          location: job.location,
          jobType: job.jobType,
          salary: job.salary,
          tags: job.tags,
          postedAt: job.postedAt,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save job');
      }

      setSavedIds((prev) => {
        const newSet = new Set(prev);
        newSet.add(job.id);
        return newSet;
      });
      onJobSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save job');
    } finally {
      setSaving(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const configuredApis = apiStatus.filter(api => api.configured).length;
  const totalApis = apiStatus.length;

  return (
    <div>
      {/* API Status Banner */}
      <div className="mb-4">
        <button
          onClick={() => setShowApiStatus(!showApiStatus)}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-2"
        >
          <span className={`w-2 h-2 rounded-full ${configuredApis === totalApis ? 'bg-green-500' : 'bg-yellow-500'}`} />
          {configuredApis}/{totalApis} APIs configured
          <svg className={`w-4 h-4 transition-transform ${showApiStatus ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showApiStatus && (
          <div className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {apiStatus.map(api => (
                <div key={api.name} className="flex items-center gap-2 text-sm">
                  {api.configured ? (
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                  <span className={api.configured ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400'}>
                    {api.name}
                  </span>
                  {api.needsKey && !api.configured && (
                    <span className="text-xs text-amber-500">(needs key)</span>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Add API keys to .env: ADZUNA_APP_ID, ADZUNA_APP_KEY, JOOBLE_API_KEY, RAPIDAPI_KEY
            </p>
          </div>
        )}
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search by keyword (e.g., React, Python, DevOps)"
              className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          >
            {COUNTRY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.flag} {opt.label}
              </option>
            ))}
          </select>
          {/* Multi-select Source Dropdown */}
          <div className="relative" data-source-dropdown>
            <button
              type="button"
              onClick={() => setShowSourceDropdown(!showSourceDropdown)}
              className="px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center gap-2 min-w-[140px]"
            >
              <span className="truncate">{getSourceLabel()}</span>
              <svg className={`w-4 h-4 transition-transform ${showSourceDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showSourceDropdown && (
              <div className="absolute z-50 mt-1 w-56 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg">
                <div className="p-2">
                  {/* All Sources Option */}
                  <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSources.has('all')}
                      onChange={() => toggleSource('all')}
                      className="w-4 h-4 rounded border-zinc-300 text-red-500 focus:ring-red-500"
                    />
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Todas as fontes</span>
                  </label>
                  <div className="border-t border-zinc-200 dark:border-zinc-700 my-1" />
                  {/* Individual Sources */}
                  {SOURCE_OPTIONS.map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSources.has(opt.value)}
                        onChange={() => toggleSource(opt.value)}
                        disabled={selectedSources.has('all')}
                        className="w-4 h-4 rounded border-zinc-300 text-red-500 focus:ring-red-500 disabled:opacity-50"
                      />
                      <span className={`text-sm ${selectedSources.has('all') ? 'text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                        {opt.label}
                      </span>
                      <span className="text-xs text-zinc-400 ml-auto">{opt.region}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <select
            value={maxAgeDays}
            onChange={(e) => setMaxAgeDays(e.target.value)}
            className="px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            title="Filtrar por data"
          >
            {DATE_FILTER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading || !keyword.trim()}
            className="px-6 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading && !isSmartSearch ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Searching...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleSmartSearch}
            disabled={loading}
            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            title="Busca inteligente baseada no seu curriculo"
          >
            {loading && isSmartSearch ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                AI Search...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI Search
              </>
            )}
          </button>
        </div>
      </form>

      {/* Smart Search Keywords */}
      {isSmartSearch && smartSearchKeywords.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="font-medium text-purple-700 dark:text-purple-300">Busca Inteligente Ativa</span>
          </div>
          <p className="text-sm text-purple-600 dark:text-purple-400 mb-2">
            Keywords extraidas do seu curriculo:
          </p>
          <div className="flex flex-wrap gap-2">
            {smartSearchKeywords.slice(0, 10).map((kw, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-purple-100 dark:bg-purple-800/50 text-purple-700 dark:text-purple-300 text-xs rounded-full"
              >
                {kw}
              </span>
            ))}
            {smartSearchKeywords.length > 10 && (
              <span className="text-xs text-purple-500">+{smartSearchKeywords.length - 10} mais</span>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {jobs.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Found {jobs.length} jobs
          </p>
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-start gap-4">
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
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {job.title}
                        </h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          {job.company}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`px-2 py-1 text-xs rounded ${SOURCE_LABELS[job.source]?.color || 'bg-zinc-100 text-zinc-600'}`}>
                          {SOURCE_LABELS[job.source]?.label || job.source}
                        </span>
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatDate(job.postedAt)}
                      </span>
                      {job.country && job.country !== 'remote' && (
                        <span className="flex items-center gap-1">
                          {job.country === 'pt' && '🇵🇹'}
                          {job.country === 'br' && '🇧🇷'}
                          {job.country === 'eu' && '🇪🇺'}
                          {job.country.toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Tags */}
                    {job.tags && job.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {job.tags.slice(0, 5).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {job.tags.length > 5 && (
                          <span className="text-xs text-zinc-400">
                            +{job.tags.length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Description */}
                {expandedId === job.id && (
                  <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap line-clamp-6">
                      {stripHtml(job.description).substring(0, 1000)}...
                    </p>
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
                    <button
                      onClick={() => handleSaveJob(job)}
                      disabled={saving === job.id || savedIds.has(job.id)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1 ${
                        savedIds.has(job.id)
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-default'
                          : 'bg-red-500 text-white hover:bg-red-600 disabled:opacity-50'
                      }`}
                    >
                      {saving === job.id ? (
                        'Saving...'
                      ) : savedIds.has(job.id) ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Saved
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                          Save
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && jobs.length === 0 && keyword && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400">
            No jobs found for &quot;{keyword}&quot;. Try a different search term or source.
          </p>
        </div>
      )}

      {/* Initial State */}
      {!loading && jobs.length === 0 && !keyword && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 mb-2">
            Search for jobs from multiple sources.
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            Select a country to search for local jobs in Portugal or Brazil.
          </p>
        </div>
      )}
    </div>
  );
}
