'use client';

import { useState, useEffect } from 'react';

interface ScraperHealth {
  status: string;
  uptime?: number;
  version?: string;
}

interface ScraperStats {
  requests_total?: number;
  requests_success?: number;
  requests_failed?: number;
  cache_hits?: number;
  last_scrape?: string;
}

interface ScraperInfo {
  available: boolean;
  url: string;
  health: ScraperHealth | null;
  sources: string[];
  stats: ScraperStats | null;
  message: string;
  test?: {
    source: string;
    keyword: string;
    success: boolean;
    jobsFound?: number;
    errors?: string[];
    error?: string;
  };
}

export default function ScraperStatus() {
  const [info, setInfo] = useState<ScraperInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testSource, setTestSource] = useState('geekhunter');
  const [testKeyword, setTestKeyword] = useState('desenvolvedor');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/scraper-logs');
      const data = await response.json();
      setInfo(data);
    } catch (err) {
      console.error('Failed to fetch scraper status:', err);
    } finally {
      setLoading(false);
    }
  };

  const runTest = async () => {
    try {
      setTesting(true);
      const response = await fetch(
        `/api/admin/scraper-logs?action=test&source=${testSource}&keyword=${encodeURIComponent(testKeyword)}`
      );
      const data = await response.json();
      setInfo(data);
    } catch (err) {
      console.error('Test failed:', err);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
        <div className="flex items-center gap-3 text-zinc-500">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Checking Python scraper status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          Python Scraper
        </h3>
        <button
          onClick={fetchStatus}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Refresh
        </button>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-3 h-3 rounded-full ${
            info?.available ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span className={`font-medium ${info?.available ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {info?.available ? 'Running' : 'Not Available'}
        </span>
        {info?.url && (
          <span className="text-sm text-zinc-500">({info.url})</span>
        )}
      </div>

      {!info?.available && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            {info?.message}
          </p>
          <code className="block mt-2 text-xs bg-zinc-100 dark:bg-zinc-900 p-2 rounded">
            cd job-scraper && docker compose up -d
          </code>
        </div>
      )}

      {info?.available && (
        <>
          {/* Sources */}
          {info.sources && info.sources.length > 0 && (
            <div className="mb-4">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Available Sources:</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {info.sources.map((source) => (
                  <span
                    key={source}
                    className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs rounded"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          {info.stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {info.stats.requests_total !== undefined && (
                <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {info.stats.requests_total}
                  </div>
                  <div className="text-xs text-zinc-500">Total Requests</div>
                </div>
              )}
              {info.stats.requests_success !== undefined && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {info.stats.requests_success}
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400">Successful</div>
                </div>
              )}
              {info.stats.requests_failed !== undefined && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {info.stats.requests_failed}
                  </div>
                  <div className="text-xs text-red-600 dark:text-red-400">Failed</div>
                </div>
              )}
              {info.stats.cache_hits !== undefined && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {info.stats.cache_hits}
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400">Cache Hits</div>
                </div>
              )}
            </div>
          )}

          {/* Test Scraper */}
          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-4">
            <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Test Scraper</h4>
            <div className="flex flex-wrap gap-3">
              <select
                value={testSource}
                onChange={(e) => setTestSource(e.target.value)}
                className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
              >
                {info.sources?.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={testKeyword}
                onChange={(e) => setTestKeyword(e.target.value)}
                placeholder="Keyword"
                className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
              />
              <button
                onClick={runTest}
                disabled={testing}
                className="px-4 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2"
              >
                {testing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Running...
                  </>
                ) : (
                  'Run Test'
                )}
              </button>
            </div>

            {/* Test Results */}
            {info.test && (
              <div className={`mt-3 p-3 rounded-lg ${info.test.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {info.test.success ? (
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span className={`text-sm font-medium ${info.test.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {info.test.success ? `Found ${info.test.jobsFound} jobs` : 'Test failed'}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Source: {info.test.source} | Keyword: {info.test.keyword}
                </p>
                {info.test.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{info.test.error}</p>
                )}
                {info.test.errors && info.test.errors.length > 0 && (
                  <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                    Warnings: {info.test.errors.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
