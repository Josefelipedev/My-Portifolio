'use client';

import { useEffect, useState } from 'react';

interface ContributionDay {
  date: string;
  count: number;
  level: number;
}

interface GitHubStats {
  user: {
    name: string;
    login: string;
    avatar: string;
    bio: string;
    followers: number;
    publicRepos: number;
    memberSince: string;
  };
  stats: {
    totalRepos: number;
    totalStars: number;
    totalForks: number;
    totalCommits: number;
    totalPRs: number;
    totalIssues: number;
  };
  languages: { name: string; percentage: number; color: string }[];
  topRepos: {
    name: string;
    description: string;
    stars: number;
    forks: number;
    language: string;
    url: string;
  }[];
  contributions: ContributionDay[];
  skills: string[];
}

interface Props {
  stats: GitHubStats;
}

// Animated counter component
function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

// Contribution Heatmap
function ContributionHeatmap({ contributions }: { contributions: ContributionDay[] }) {
  const weeks: ContributionDay[][] = [];
  let currentWeek: ContributionDay[] = [];

  contributions.forEach((day, index) => {
    currentWeek.push(day);
    if (currentWeek.length === 7 || index === contributions.length - 1) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  const getLevelColor = (level: number) => {
    const colors = [
      'bg-slate-800',
      'bg-emerald-900',
      'bg-emerald-700',
      'bg-emerald-500',
      'bg-emerald-400',
    ];
    return colors[level] || colors[0];
  };

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px] min-w-max">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-[3px]">
            {week.map((day, dayIndex) => (
              <div
                key={`${weekIndex}-${dayIndex}`}
                className={`w-3 h-3 rounded-sm ${getLevelColor(day.level)} transition-all hover:ring-2 hover:ring-emerald-400/50`}
                title={`${day.date}: ${day.count} contribuições`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-slate-500">
        {months.map(month => (
          <span key={month}>{month}</span>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2 mt-2 text-xs text-slate-500">
        <span>Menos</span>
        {[0, 1, 2, 3, 4].map(level => (
          <div key={level} className={`w-3 h-3 rounded-sm ${getLevelColor(level)}`} />
        ))}
        <span>Mais</span>
      </div>
    </div>
  );
}

// Language Bar Chart
function LanguageChart({ languages }: { languages: { name: string; percentage: number; color: string }[] }) {
  return (
    <div className="space-y-3">
      {/* Bar */}
      <div className="h-4 rounded-full overflow-hidden flex bg-slate-800">
        {languages.map((lang, index) => (
          <div
            key={lang.name}
            className="h-full transition-all duration-1000 ease-out"
            style={{
              width: `${lang.percentage}%`,
              backgroundColor: lang.color,
              marginLeft: index === 0 ? 0 : '-1px',
            }}
            title={`${lang.name}: ${lang.percentage}%`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {languages.map(lang => (
          <div key={lang.name} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: lang.color }}
            />
            <span className="text-slate-300">{lang.name}</span>
            <span className="text-slate-500">{lang.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Stat Card
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="relative group">
      <div className={`absolute inset-0 bg-gradient-to-r ${color} opacity-0 group-hover:opacity-10 rounded-xl transition-opacity`} />
      <div className="relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition-all">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-gradient-to-r ${color}`}>
            {icon}
          </div>
          <div>
            <p className="text-2xl font-bold text-white">
              <AnimatedCounter value={value} />
            </p>
            <p className="text-sm text-slate-400">{label}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GitHubStatsClient({ stats }: Props) {
  return (
    <section id="github" className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              GitHub Stats
            </span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Minhas contribuições e atividade no GitHub
          </p>
        </div>

        {/* Stats Grid - Only show non-zero values */}
        {(() => {
          const statItems = [
            { icon: <RepoIcon />, label: 'Repositórios', value: stats.stats.totalRepos, color: 'from-blue-500 to-cyan-500' },
            { icon: <StarIcon />, label: 'Stars', value: stats.stats.totalStars, color: 'from-yellow-500 to-orange-500' },
            { icon: <ForkIcon />, label: 'Forks', value: stats.stats.totalForks, color: 'from-purple-500 to-pink-500' },
            { icon: <CommitIcon />, label: 'Commits', value: stats.stats.totalCommits, color: 'from-emerald-500 to-teal-500' },
            { icon: <PRIcon />, label: 'Pull Requests', value: stats.stats.totalPRs, color: 'from-indigo-500 to-purple-500' },
            { icon: <IssueIcon />, label: 'Issues', value: stats.stats.totalIssues, color: 'from-red-500 to-pink-500' },
          ].filter(item => item.value > 0);

          if (statItems.length === 0) return null;

          // Dynamic grid columns based on number of items
          const gridCols = statItems.length <= 2 ? 'grid-cols-2' :
                           statItems.length <= 3 ? 'grid-cols-2 md:grid-cols-3' :
                           statItems.length <= 4 ? 'grid-cols-2 md:grid-cols-4' :
                           'grid-cols-2 md:grid-cols-3 lg:grid-cols-' + Math.min(statItems.length, 6);

          return (
            <div className={`grid ${gridCols} gap-4 mb-8`}>
              {statItems.map((item, index) => (
                <StatCard
                  key={index}
                  icon={item.icon}
                  label={item.label}
                  value={item.value}
                  color={item.color}
                />
              ))}
            </div>
          );
        })()}

        {/* Two Column Layout - Only show sections with data */}
        {(stats.languages.length > 0 || stats.contributions.length > 0) && (
          <div className={`grid ${stats.languages.length > 0 && stats.contributions.length > 0 ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-8`}>
            {/* Languages */}
            {stats.languages.length > 0 && (
              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <CodeIcon />
                  Linguagens Mais Usadas
                </h3>
                <LanguageChart languages={stats.languages} />
              </div>
            )}

            {/* Contribution Heatmap */}
            {stats.contributions.length > 0 && (
              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <CalendarIcon />
                  Contribuições
                </h3>
                <ContributionHeatmap contributions={stats.contributions} />
              </div>
            )}
          </div>
        )}

        {/* Skills from GitHub */}
        {stats.skills.length > 0 && (
          <div className="mt-8 bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <SkillIcon />
              Skills Detectadas
            </h3>
            <div className="flex flex-wrap gap-2">
              {stats.skills.map(skill => (
                <span
                  key={skill}
                  className="px-3 py-1 bg-slate-700/50 text-slate-300 rounded-full text-sm hover:bg-slate-700 transition-colors"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* GitHub Profile Link */}
        <div className="mt-8 text-center">
          <a
            href={`https://github.com/${stats.user.login}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition-all hover:-translate-y-1"
          >
            <GitHubIcon />
            Ver perfil completo no GitHub
            <ExternalLinkIcon />
          </a>
        </div>
      </div>
    </section>
  );
}

// Icons
const RepoIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const StarIcon = () => (
  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const ForkIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2" />
  </svg>
);

const CommitIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const PRIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const IssueIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CodeIcon = () => (
  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const SkillIcon = () => (
  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const GitHubIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);
