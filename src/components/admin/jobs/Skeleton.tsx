'use client';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-zinc-200 dark:bg-zinc-700 rounded ${className}`}
    />
  );
}

export function JobCardSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
      <div className="flex items-start gap-4">
        {/* Checkbox placeholder */}
        <Skeleton className="w-4 h-4 mt-1" />

        {/* Logo placeholder */}
        <Skeleton className="w-12 h-12 rounded-lg" />

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {/* Title */}
              <Skeleton className="h-5 w-3/4 mb-2" />
              {/* Company */}
              <Skeleton className="h-4 w-1/2" />
            </div>
            {/* Status badge */}
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>

          {/* Meta info */}
          <div className="flex gap-3 mt-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>

          {/* Tags */}
          <div className="flex gap-2 mt-3">
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-5 w-20 rounded" />
            <Skeleton className="h-5 w-14 rounded" />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
        <Skeleton className="h-4 w-20" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function JobSearchResultSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
      <div className="flex items-start gap-4">
        {/* Logo placeholder */}
        <Skeleton className="w-12 h-12 rounded-lg" />

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {/* Title */}
              <Skeleton className="h-5 w-3/4 mb-2" />
              {/* Company */}
              <Skeleton className="h-4 w-1/2 mb-2" />
              {/* Score */}
              <Skeleton className="h-4 w-16" />
            </div>
            {/* Source badge */}
            <Skeleton className="h-5 w-20 rounded" />
          </div>

          {/* Meta info */}
          <div className="flex gap-3 mt-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>

          {/* Description preview */}
          <div className="mt-3 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>

          {/* Tags */}
          <div className="flex gap-2 mt-3">
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-5 w-20 rounded" />
            <Skeleton className="h-5 w-14 rounded" />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 gap-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
    </div>
  );
}

export function JobListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function JobSearchListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <JobSearchResultSkeleton key={i} />
      ))}
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4"
          >
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Chart placeholder */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  );
}
