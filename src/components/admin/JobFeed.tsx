'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { apiFetch } from '@/lib/api-fetch';
import { stripHtml } from '@/lib/html';

// Postings ingested by the API cron (every few hours) and scored 0-100 against
// the resume. Saving copies a posting into Saved Jobs.

interface FeedPosting {
  id: string;
  source: string;
  sources: string[];
  title: string;
  company: string;
  description: string;
  url: string;
  location: string | null;
  salary: string | null;
  postedAt: string | null;
  firstSeenAt: string;
  matchScore: number | null;
  dealBreaker: string | null;
  status: 'new' | 'saved' | 'dismissed';
}

interface IngestRun {
  startedAt: string;
  finishedAt: string | null;
  found: number;
  created: number;
  errors: string[];
}

interface FeedResponse {
  jobs: FeedPosting[];
  total: number;
  hasMore: boolean;
  running: boolean;
  lastRun: IngestRun | null;
}

type StatusFilter = 'new' | 'saved' | 'dismissed' | 'all';

const PAGE_SIZE = 30;

function scoreClass(score: number | null): string {
  if (score === null) return 'bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400';
  if (score >= 70) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (score >= 50) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
  return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300';
}

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function safeHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : '#';
}

export default function JobFeed({ onJobSaved }: { onJobSaved?: () => void }) {
  const { showError, showSuccess, showInfo } = useToast();
  const [jobs, setJobs] = useState<FeedPosting[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<IngestRun | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [days, setDays] = useState(7);
  const [minScore, setMinScore] = useState(0);
  const [status, setStatus] = useState<StatusFilter>('new');
  const [includeFiltered, setIncludeFiltered] = useState(false);

  const load = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          days: String(days),
          minScore: String(minScore),
          status,
          includeFiltered: String(includeFiltered),
          page: String(nextPage),
          limit: String(PAGE_SIZE),
        });
        const res = await apiFetch(`/api/jobs/feed?${params}`);
        if (!res.ok) throw new Error(`Failed to load feed (${res.status})`);
        const data = (await res.json()) as FeedResponse;
        setJobs((current) => (nextPage === 1 ? data.jobs : [...current, ...data.jobs]));
        setTotal(data.total);
        setHasMore(data.hasMore);
        setRunning(data.running);
        setLastRun(data.lastRun);
        setPage(nextPage);
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Failed to load feed');
      } finally {
        setLoading(false);
      }
    },
    [days, minScore, status, includeFiltered, showError]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  // While an ingestion runs, poll until it finishes, then reload the list.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      try {
        const res = await apiFetch('/api/jobs/feed?limit=1');
        const data = (await res.json()) as FeedResponse;
        if (!data.running) {
          setRunning(false);
          load(1);
        }
      } catch {
        // keep polling
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [running, load]);

  const startIngest = async () => {
    const res = await apiFetch('/api/jobs/feed/ingest', { method: 'POST' });
    if (res.status === 202 || res.status === 409) {
      setRunning(true);
      showInfo(res.status === 202 ? 'Fetching new postings — this takes a minute or two' : 'A run is already in progress');
    } else {
      showError('Could not start the ingestion run');
    }
  };

  const setPostingStatus = async (job: FeedPosting, next: 'new' | 'dismissed') => {
    setBusyId(job.id);
    try {
      const res = await apiFetch(`/api/jobs/feed/${job.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      setJobs((current) => current.filter((item) => status === 'all' || item.id !== job.id).map((item) => (item.id === job.id ? { ...item, status: next } : item)));
      setTotal((count) => (status === 'all' ? count : Math.max(0, count - 1)));
    } catch {
      showError('Could not update the posting');
    } finally {
      setBusyId(null);
    }
  };

  const savePosting = async (job: FeedPosting) => {
    setBusyId(job.id);
    try {
      const res = await apiFetch(`/api/jobs/feed/${job.id}/save`, { method: 'POST' });
      if (!res.ok) throw new Error();
      showSuccess('Saved to Saved Jobs');
      onJobSaved?.();
      setJobs((current) => current.filter((item) => status === 'all' || item.id !== job.id).map((item) => (item.id === job.id ? { ...item, status: 'saved' } : item)));
      setTotal((count) => (status === 'all' ? count : Math.max(0, count - 1)));
    } catch {
      showError('Could not save the posting');
    } finally {
      setBusyId(null);
    }
  };

  const selectClass =
    'rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          {running ? (
            <span className="text-blue-600 dark:text-blue-400">Fetching new postings…</span>
          ) : lastRun ? (
            <>
              Last update {timeAgo(lastRun.finishedAt || lastRun.startedAt)} · {lastRun.found} found · {lastRun.created} new
              {lastRun.errors.length > 0 && (
                <button onClick={() => setShowErrors((v) => !v)} className="ml-2 text-amber-600 hover:underline dark:text-amber-400">
                  {lastRun.errors.length} source issue(s)
                </button>
              )}
            </>
          ) : (
            'No ingestion run yet'
          )}
        </div>
        <button
          onClick={startIngest}
          disabled={running}
          className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
        >
          {running ? 'Updating…' : 'Update now'}
        </button>
      </div>

      {showErrors && lastRun && lastRun.errors.length > 0 && (
        <ul className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          {lastRun.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(['new', 'saved', 'dismissed', 'all'] as StatusFilter[]).map((value) => (
          <button
            key={value}
            onClick={() => setStatus(value)}
            className={`rounded-full px-3 py-1 text-sm capitalize ${
              status === value
                ? 'bg-red-500 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300'
            }`}
          >
            {value}
          </button>
        ))}
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={selectClass}>
          {[1, 3, 7, 30].map((value) => (
            <option key={value} value={value}>
              Seen in the last {value}d
            </option>
          ))}
        </select>
        <select value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className={selectClass}>
          {[0, 50, 60, 70].map((value) => (
            <option key={value} value={value}>
              {value === 0 ? 'Any score' : `Score ≥ ${value}`}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          <input type="checkbox" checked={includeFiltered} onChange={(e) => setIncludeFiltered(e.target.checked)} />
          Show deal-breaker matches
        </label>
        <span className="ml-auto text-sm text-zinc-500">{total} posting(s)</span>
      </div>

      {jobs.length === 0 && !loading ? (
        <p className="py-10 text-center text-sm text-zinc-500">
          No postings match these filters{lastRun ? '' : ' — run “Update now” to fetch the first batch'}.
        </p>
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li key={job.id} className="flex gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${scoreClass(job.matchScore)}`}
                title="Fit score (0-100): semantic similarity to your resume blended with keyword matches"
              >
                {job.matchScore ?? '—'}
              </div>
              <div className="min-w-0 flex-1">
                <a
                  href={safeHref(job.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-zinc-900 hover:text-red-600 dark:text-zinc-100 dark:hover:text-red-400"
                >
                  {job.title}
                </a>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {[job.company, job.location, job.salary].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
                  {stripHtml(job.description).slice(0, 300)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  {job.sources.map((source) => (
                    <span key={source} className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-700">
                      {source}
                    </span>
                  ))}
                  <span>first seen {timeAgo(job.firstSeenAt)}</span>
                  {job.dealBreaker && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      deal-breaker: {job.dealBreaker}
                    </span>
                  )}
                  {status === 'all' && job.status !== 'new' && <span className="capitalize">· {job.status}</span>}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                {job.status !== 'saved' && (
                  <button
                    onClick={() => savePosting(job)}
                    disabled={busyId === job.id}
                    className="rounded-lg bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
                  >
                    Save
                  </button>
                )}
                {job.status === 'new' && (
                  <button
                    onClick={() => setPostingStatus(job, 'dismissed')}
                    disabled={busyId === job.id}
                    className="rounded-lg border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    Dismiss
                  </button>
                )}
                {job.status === 'dismissed' && (
                  <button
                    onClick={() => setPostingStatus(job, 'new')}
                    disabled={busyId === job.id}
                    className="rounded-lg border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    Restore
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="text-center">
          <button
            onClick={() => load(page + 1)}
            disabled={loading}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
