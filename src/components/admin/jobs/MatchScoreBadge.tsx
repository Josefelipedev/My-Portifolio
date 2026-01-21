'use client';

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
