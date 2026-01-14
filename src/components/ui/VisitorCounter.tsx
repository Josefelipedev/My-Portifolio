'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n';

interface VisitStats {
  totalVisits: number;
  uniqueVisits: number;
}

export function VisitorCounter() {
  const { language } = useLanguage();
  const [stats, setStats] = useState<VisitStats | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const registerVisit = async () => {
      try {
        // Register the visit
        const response = await fetch('/api/visits', {
          method: 'POST',
        });
        const data = await response.json();
        if (data.totalVisits !== undefined) {
          setStats({
            totalVisits: data.totalVisits,
            uniqueVisits: data.uniqueVisits || 0,
          });
        }
      } catch (error) {
        console.error('Error registering visit:', error);
        // Try to at least get the current count
        try {
          const response = await fetch('/api/visits');
          const data = await response.json();
          if (data.totalVisits !== undefined) {
            setStats({
              totalVisits: data.totalVisits,
              uniqueVisits: data.uniqueVisits || 0,
            });
          }
        } catch {
          // Silently fail
        }
      }
    };

    registerVisit();
  }, []);

  // Don't render until client-side to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  if (!stats || stats.totalVisits === undefined) {
    return null;
  }

  const visitorsText = language === 'pt' ? 'visitantes' : 'visitors';

  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-full">
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <EyeIcon />
      </div>
      <span className="text-sm font-medium text-slate-300">
        <span className="text-emerald-400 font-bold">
          {stats.totalVisits.toLocaleString()}
        </span>{' '}
        {visitorsText}
      </span>
    </div>
  );
}

const EyeIcon = () => (
  <svg
    className="w-4 h-4 text-slate-400"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
);
