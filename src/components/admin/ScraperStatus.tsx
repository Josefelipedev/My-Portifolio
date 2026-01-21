'use client';

import { useState, useEffect } from 'react';

interface ScraperStatusProps {
  defaultExpanded?: boolean;
}

interface ScraperHealth {
  status: string;
  uptime?: number;
  version?: string;
}

interface ScraperStats {
  requests_total?: number;
  requests_success?: number;
  requests_failed?: number;
  jobs_found?: number;
  uptime_seconds?: number;
  uptime_human?: string;
}

interface ScraperLog {
  timestamp: string;
  level: string;
  message: string;
  source: string;
}

interface DebugFile {
  name: string;
  size: number;
  created: string;
  type: 'screenshot' | 'html';
}

interface ScraperInfo {
  available: boolean;
  url: string;
  health: ScraperHealth | null;
  sources: string[];
  stats: ScraperStats | null;
  logs: ScraperLog[];
  message: string;
  debug?: {
    enabled: boolean;
    files: DebugFile[];
    total: number;
  };
  test?: {
    source: string;
    keyword: string;
    success: boolean;
    jobsFound?: number;
    errors?: string[];
    error?: string;
    alertSent?: boolean;
  };
}

export default function ScraperStatus({ defaultExpanded = false }: ScraperStatusProps) {
  const [info, setInfo] = useState<ScraperInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testSource, setTestSource] = useState('geekhunter');
  const [testKeyword, setTestKeyword] = useState('desenvolvedor');
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showLogs, setShowLogs] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedDebugFile, setSelectedDebugFile] = useState<string | null>(null);
  const [debugFileContent, setDebugFileContent] = useState<string | null>(null);
  const [loadingDebugFile, setLoadingDebugFile] = useState(false);
  const [sendAlertOnFail, setSendAlertOnFail] = useState(true);

  useEffect(() => {
    if (expanded && !info) {
      fetchStatus();
    }
  }, [expanded, info]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || !expanded) return;

    const interval = setInterval(() => {
      fetchStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, expanded]);

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
      const alertParam = sendAlertOnFail ? '&alert=true' : '';
      const response = await fetch(
        `/api/admin/scraper-logs?action=test&source=${testSource}&keyword=${encodeURIComponent(testKeyword)}${alertParam}`
      );
      const data = await response.json();
      setInfo(data);
      // Refresh to get new debug files after test
      setTimeout(fetchStatus, 2000);
    } catch (err) {
      console.error('Test failed:', err);
    } finally {
      setTesting(false);
    }
  };

  const viewDebugFile = async (filename: string) => {
    try {
      setLoadingDebugFile(true);
      setSelectedDebugFile(filename);

      if (filename.endsWith('.png')) {
        // For images, just set the URL
        setDebugFileContent(`/api/admin/scraper-logs?action=debug-file&filename=${encodeURIComponent(filename)}`);
      } else {
        // For HTML, fetch content
        const response = await fetch(
          `/api/admin/scraper-logs?action=debug-file&filename=${encodeURIComponent(filename)}`
        );
        if (response.ok) {
          const text = await response.text();
          setDebugFileContent(text);
        }
      }
    } catch (err) {
      console.error('Failed to load debug file:', err);
    } finally {
      setLoadingDebugFile(false);
    }
  };

  const clearDebugFiles = async () => {
    try {
      const response = await fetch('/api/admin/scraper-logs?action=clear-debug');
      if (response.ok) {
        fetchStatus();
        setSelectedDebugFile(null);
        setDebugFileContent(null);
      }
    } catch (err) {
      console.error('Failed to clear debug files:', err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
      {/* Header - Always visible, clickable to toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">Python Scraper</span>
          {info && (
            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
              info.available
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            }`}>
              {info.available ? 'Online' : 'Offline'}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-zinc-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-6 pb-6 border-t border-zinc-200 dark:border-zinc-700">
          {loading ? (
            <div className="flex items-center gap-3 text-zinc-500 py-4">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Checking Python scraper status...</span>
            </div>
          ) : (
            <div className="pt-4">
              {/* Status and Refresh */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${info?.available ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className={`font-medium ${info?.available ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {info?.available ? 'Running' : 'Not Available'}
                  </span>
                  {info?.url && <span className="text-sm text-zinc-500">({info.url})</span>}
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-purple-500 focus:ring-purple-500"
                    />
                    <span className="text-xs text-zinc-500">Auto (5s)</span>
                    {autoRefresh && (
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    )}
                  </label>
                  <button
                    onClick={(e) => { e.stopPropagation(); fetchStatus(); }}
                    className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {/* Not Available Warning */}
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

              {/* Available - Show details */}
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
                      {info.stats.jobs_found !== undefined && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {info.stats.jobs_found}
                          </div>
                          <div className="text-xs text-blue-600 dark:text-blue-400">Jobs Found</div>
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

                    {/* Alert toggle */}
                    <label className="flex items-center gap-2 mt-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sendAlertOnFail}
                        onChange={(e) => setSendAlertOnFail(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-purple-500 focus:ring-purple-500"
                      />
                      <span className="text-xs text-zinc-600 dark:text-zinc-400">
                        Send email alert if test fails (0 jobs)
                      </span>
                    </label>

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
                        {info.test.alertSent && (
                          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Email alert sent
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Logs Section */}
                  <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-4">
                    <button
                      onClick={() => setShowLogs(!showLogs)}
                      className="flex items-center justify-between w-full text-left"
                    >
                      <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Recent Logs ({info.logs?.length || 0})
                      </h4>
                      <svg
                        className={`w-4 h-4 text-zinc-400 transition-transform ${showLogs ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showLogs && info.logs && info.logs.length > 0 && (
                      <div className="mt-3 max-h-64 overflow-y-auto bg-zinc-900 rounded-lg p-3 font-mono text-xs">
                        {info.logs.map((log, index) => (
                          <div
                            key={index}
                            className={`py-1 border-b border-zinc-800 last:border-0 ${
                              log.level === 'ERROR'
                                ? 'text-red-400'
                                : log.level === 'WARNING'
                                ? 'text-yellow-400'
                                : 'text-zinc-400'
                            }`}
                          >
                            <span className="text-zinc-600">{log.timestamp.split('T')[1]?.split('.')[0] || log.timestamp}</span>
                            {' '}
                            <span className={`font-bold ${
                              log.level === 'ERROR'
                                ? 'text-red-500'
                                : log.level === 'WARNING'
                                ? 'text-yellow-500'
                                : log.level === 'INFO'
                                ? 'text-blue-500'
                                : 'text-zinc-500'
                            }`}>
                              [{log.level}]
                            </span>
                            {' '}
                            <span className="text-purple-400">[{log.source}]</span>
                            {' '}
                            {log.message}
                          </div>
                        ))}
                      </div>
                    )}

                    {showLogs && (!info.logs || info.logs.length === 0) && (
                      <p className="mt-3 text-sm text-zinc-500">No logs available</p>
                    )}
                  </div>

                  {/* Debug Files Section */}
                  {info.debug?.enabled && (
                    <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-4">
                      <button
                        onClick={() => setShowDebug(!showDebug)}
                        className="flex items-center justify-between w-full text-left"
                      >
                        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          Debug Files ({info.debug.total || 0})
                          {(info.debug.total || 0) > 0 && (
                            <span className="px-1.5 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded">
                              New
                            </span>
                          )}
                        </h4>
                        <svg
                          className={`w-4 h-4 text-zinc-400 transition-transform ${showDebug ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {showDebug && (
                        <div className="mt-3">
                          {info.debug.files && info.debug.files.length > 0 ? (
                            <>
                              <div className="flex justify-end mb-2">
                                <button
                                  onClick={clearDebugFiles}
                                  className="text-xs text-red-500 hover:text-red-600"
                                >
                                  Clear All
                                </button>
                              </div>
                              <div className="space-y-2">
                                {info.debug.files.map((file) => (
                                  <div
                                    key={file.name}
                                    className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-700/50 rounded-lg p-2"
                                  >
                                    <div className="flex items-center gap-2">
                                      {file.type === 'screenshot' ? (
                                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                      ) : (
                                        <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                        </svg>
                                      )}
                                      <div>
                                        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{file.name}</p>
                                        <p className="text-xs text-zinc-500">
                                          {formatFileSize(file.size)} • {new Date(file.created).toLocaleTimeString()}
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => viewDebugFile(file.name)}
                                      className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50"
                                    >
                                      View
                                    </button>
                                  </div>
                                ))}
                              </div>

                              {/* Debug File Viewer Modal */}
                              {selectedDebugFile && (
                                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                                  <div className="bg-white dark:bg-zinc-800 rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                                    <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
                                      <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{selectedDebugFile}</h3>
                                      <button
                                        onClick={() => {
                                          setSelectedDebugFile(null);
                                          setDebugFileContent(null);
                                        }}
                                        className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                                      >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                    <div className="flex-1 overflow-auto p-4">
                                      {loadingDebugFile ? (
                                        <div className="flex items-center justify-center h-64">
                                          <svg className="w-8 h-8 animate-spin text-purple-500" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                          </svg>
                                        </div>
                                      ) : selectedDebugFile.endsWith('.png') ? (
                                        <img
                                          src={debugFileContent || ''}
                                          alt={selectedDebugFile}
                                          className="max-w-full h-auto"
                                        />
                                      ) : (
                                        <iframe
                                          srcDoc={debugFileContent || ''}
                                          className="w-full h-[70vh] border border-zinc-200 dark:border-zinc-700 rounded"
                                          sandbox="allow-same-origin"
                                        />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-zinc-500">No debug files. Run a test to generate debug data when no jobs are found.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
