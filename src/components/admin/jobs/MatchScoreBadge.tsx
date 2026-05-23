'use client';

import { useState, useRef, useEffect } from 'react';

interface MatchScoreBadgeProps {
  score: number;
  maxScore?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function MatchScoreBadge({
  score,
  maxScore = 20,
  showLabel = true,
  size = 'sm',
}: MatchScoreBadgeProps) {
  // Calculate percentage (capped at 100%)
  const percentage = Math.min(100, Math.round((score / maxScore) * 100));

  // Determine color based on score percentage
  const getScoreColor = () => {
    if (percentage >= 70) {
      return {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-400',
        bar: 'bg-green-500',
      };
    } else if (percentage >= 40) {
      return {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        text: 'text-yellow-700 dark:text-yellow-400',
        bar: 'bg-yellow-500',
      };
    } else {
      return {
        bg: 'bg-zinc-100 dark:bg-zinc-700',
        text: 'text-zinc-600 dark:text-zinc-400',
        bar: 'bg-zinc-400',
      };
    }
  };

  const colors = getScoreColor();

  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full ${colors.bg} ${colors.text} ${sizeClasses[size]}`}
      title={`Match Score: ${score}/${maxScore} (${percentage}%)`}
    >
      {/* Score Bar */}
      <div className="w-8 h-1.5 bg-zinc-200 dark:bg-zinc-600 rounded-full overflow-hidden">
        <div
          className={`h-full ${colors.bar} rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Score Text */}
      {showLabel && (
        <span className="font-medium">{percentage}%</span>
      )}
    </div>
  );
}

// Compact version for lists
export function MatchScoreCompact({ score, maxScore = 20 }: { score: number; maxScore?: number }) {
  const percentage = Math.min(100, Math.round((score / maxScore) * 100));

  const getColor = () => {
    if (percentage >= 70) return 'text-green-600 dark:text-green-400';
    if (percentage >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-zinc-500 dark:text-zinc-400';
  };

  return (
    <span
      className={`text-xs font-medium ${getColor()}`}
      title={`Match Score: ${score}/${maxScore}`}
    >
      {percentage}% match
    </span>
  );
}

// Tooltip version with detailed breakdown
export function MatchScoreTooltip({
  score,
  maxScore = 20,
  breakdown,
}: {
  score: number;
  maxScore?: number;
  breakdown?: { label: string; points: number }[];
}) {
  const percentage = Math.min(100, Math.round((score / maxScore) * 100));

  const getScoreLabel = () => {
    if (percentage >= 80) return 'Excellent Match';
    if (percentage >= 60) return 'Good Match';
    if (percentage >= 40) return 'Fair Match';
    return 'Low Match';
  };

  const getScoreColor = () => {
    if (percentage >= 70) return 'bg-green-500';
    if (percentage >= 40) return 'bg-yellow-500';
    return 'bg-zinc-400';
  };

  return (
    <div className="relative group">
      <MatchScoreBadge score={score} maxScore={maxScore} />

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
        <div className="bg-zinc-900 dark:bg-zinc-700 text-white text-xs rounded-lg p-3 shadow-lg min-w-[160px]">
          <div className="font-semibold mb-2">{getScoreLabel()}</div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-zinc-700 dark:bg-zinc-600 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full ${getScoreColor()} rounded-full`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          <div className="text-zinc-300 mb-2">
            Score: {score}/{maxScore} ({percentage}%)
          </div>

          {/* Breakdown */}
          {breakdown && breakdown.length > 0 && (
            <div className="border-t border-zinc-700 pt-2 mt-2 space-y-1">
              {breakdown.map((item, i) => (
                <div key={i} className="flex justify-between text-zinc-300">
                  <span>{item.label}</span>
                  <span className="text-zinc-400">+{item.points}</span>
                </div>
              ))}
            </div>
          )}

          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-zinc-900 dark:border-t-zinc-700" />
        </div>
      </div>
    </div>
  );
}

// ─── Match Score with Reason ────────────────────────────────────────────────
// Shows badge + click-to-open popover explaining why the score is high/low

export interface MatchReason {
  matched: string[];   // skills found in the job text
  missing: string[];   // resume skills NOT found in the job text
  titleMatch: boolean; // job title matches an experience title
}

export function MatchScoreWithReason({
  score,
  reason,
}: {
  score: number;         // 0–100
  reason?: MatchReason;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const getBadgeColors = () => {
    if (score >= 70) return {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-700 dark:text-green-400',
      bar: 'bg-green-500',
    };
    if (score >= 40) return {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-700 dark:text-yellow-400',
      bar: 'bg-yellow-500',
    };
    return {
      bg: 'bg-zinc-100 dark:bg-zinc-700',
      text: 'text-zinc-600 dark:text-zinc-400',
      bar: 'bg-zinc-400',
    };
  };

  const getLabel = () => {
    if (score >= 80) return 'Excellent Match';
    if (score >= 60) return 'Good Match';
    if (score >= 40) return 'Fair Match';
    return 'Low Match';
  };

  const colors = getBadgeColors();
  const hasReason = reason && (reason.matched.length > 0 || reason.missing.length > 0);

  return (
    <div className="relative" ref={ref}>
      {/* Badge — clickable if we have reason data */}
      <button
        type="button"
        onClick={() => hasReason && setOpen(v => !v)}
        className={`flex items-center gap-1.5 rounded-full text-xs px-2 py-0.5 transition-opacity
          ${colors.bg} ${colors.text}
          ${hasReason ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
        title={hasReason ? 'Click to see match details' : `Match: ${score}%`}
      >
        <div className="w-8 h-1.5 bg-zinc-200 dark:bg-zinc-600 rounded-full overflow-hidden">
          <div
            className={`h-full ${colors.bar} rounded-full transition-all duration-300`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="font-medium">{score}%</span>
        {hasReason && (
          <svg
            className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Popover */}
      {open && hasReason && (
        <div className="absolute bottom-full right-0 mb-2 z-50 w-72">
          <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-4">

            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-100">
                {getLabel()}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                {score}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden mb-4">
              <div
                className={`h-full ${colors.bar} rounded-full transition-all duration-500`}
                style={{ width: `${score}%` }}
              />
            </div>

            {/* Low score explanation */}
            {score < 40 && reason.missing.length > 0 && (
              <div className="mb-3 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                  💡 Why is the score low?
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                  Most skills in your resume were not mentioned in this job posting.
                </p>
              </div>
            )}

            {/* Matched skills */}
            {reason.matched.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                  ✅ Matched ({reason.matched.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {reason.matched.slice(0, 10).map(skill => (
                    <span
                      key={skill}
                      className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded"
                    >
                      {skill}
                    </span>
                  ))}
                  {reason.matched.length > 10 && (
                    <span className="text-xs text-zinc-400">+{reason.matched.length - 10} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Missing skills */}
            {reason.missing.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                  ❌ Not found ({reason.missing.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {reason.missing.slice(0, 8).map(skill => (
                    <span
                      key={skill}
                      className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 text-xs rounded line-through"
                    >
                      {skill}
                    </span>
                  ))}
                  {reason.missing.length > 8 && (
                    <span className="text-xs text-zinc-400">+{reason.missing.length - 8} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Title bonus */}
            {reason.titleMatch && (
              <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                +10% title bonus applied
              </div>
            )}

            {/* Matched = 0 fallback */}
            {reason.matched.length === 0 && reason.missing.length === 0 && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                No resume skills detected to compare.
              </p>
            )}

            {/* Arrow */}
            <div className="absolute top-full right-4 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white dark:border-t-zinc-800" />
          </div>
        </div>
      )}
    </div>
  );
}
