'use client';

interface AIGradeBadgeProps {
  grade: string | null | undefined;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

const GRADE_CONFIG = {
  A: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-green-300 dark:border-green-700',
    label: 'Excellent fit',
  },
  B: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-300 dark:border-emerald-700',
    label: 'Good fit',
  },
  C: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
    border: 'border-yellow-300 dark:border-yellow-700',
    label: 'Moderate fit',
  },
  D: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-300 dark:border-orange-700',
    label: 'Poor fit',
  },
  F: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-300 dark:border-red-700',
    label: 'Not suitable',
  },
} as const;

export default function AIGradeBadge({ grade, size = 'sm', showLabel = false }: AIGradeBadgeProps) {
  if (!grade) return null;

  const config = GRADE_CONFIG[grade as keyof typeof GRADE_CONFIG];
  if (!config) return null;

  const sizeClasses = size === 'sm'
    ? 'text-xs font-bold px-2 py-0.5 min-w-[28px]'
    : 'text-sm font-bold px-2.5 py-1 min-w-[32px]';

  return (
    <span
      className={`inline-flex items-center justify-center rounded border ${config.bg} ${config.text} ${config.border} ${sizeClasses}`}
      title={`AI Grade: ${grade} — ${config.label}`}
    >
      {grade}
      {showLabel && <span className="ml-1 font-normal">{config.label}</span>}
    </span>
  );
}
