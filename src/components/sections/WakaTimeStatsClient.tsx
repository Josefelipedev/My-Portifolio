'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n';

interface WakaTimeStats {
  totalSeconds: number;
  totalHours: string;
  dailyAverage: string;
  bestDay: {
    date: string;
    totalSeconds: number;
    text: string;
  } | null;
  languages: {
    name: string;
    percent: number;
    totalSeconds: number;
    text: string;
    color: string;
  }[];
  editors: {
    name: string;
    percent: number;
    totalSeconds: number;
    text: string;
  }[];
  operatingSystems: {
    name: string;
    percent: number;
    totalSeconds: number;
    text: string;
  }[];
  projects: {
    name: string;
    percent: number;
    totalSeconds: number;
    text: string;
  }[];
  categories: {
    name: string;
    percent: number;
    totalSeconds: number;
    text: string;
  }[];
  range: {
    start: string;
    end: string;
    text: string;
  };
}

interface WakaTimeConfig {
  enabled: boolean;
  showTotalTime: boolean;
  showDailyAverage: boolean;
  showBestDay: boolean;
  showAllTime: boolean;
  showYearlyStats: boolean;
  showLanguages: boolean;
  showEditors: boolean;
  showOS: boolean;
  showProjects: boolean;
  profileUrl: string;
  selectedYears: number[];
  yearlyStatsType: 'last365' | 'calendar';
}

interface Props {
  stats: WakaTimeStats;
  allTimeStats: { totalSeconds: number; text: string } | null;
  yearlyStats: WakaTimeStats | null;
  yearlyStatsByYear: Record<number, WakaTimeStats>;
  config: WakaTimeConfig;
}

// Animated counter
function AnimatedValue({ value }: { value: string }) {
  const [displayed, setDisplayed] = useState('0');

  useEffect(() => {
    // Extract number from string like "45h 30m"
    const match = value.match(/(\d+)/);
    const targetNum = match ? parseInt(match[1]) : 0;
    const duration = 1500;
    const steps = 40;
    const increment = targetNum / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= targetNum) {
        setDisplayed(value);
        clearInterval(timer);
      } else {
        // Replace first number in the string with current
        setDisplayed(value.replace(/\d+/, Math.floor(current).toString()));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return <span>{displayed}</span>;
}

// Gradient color mapping
const GRADIENT_COLORS: Record<string, { from: string; to: string }> = {
  'indigo-purple': { from: '#6366f1', to: '#a855f7' },
  'cyan-blue': { from: '#06b6d4', to: '#3b82f6' },
  'amber-orange': { from: '#f59e0b', to: '#f97316' },
  'emerald-teal': { from: '#10b981', to: '#14b8a6' },
  'violet-purple': { from: '#8b5cf6', to: '#a855f7' },
  'fuchsia-pink': { from: '#d946ef', to: '#ec4899' },
  'rose-red': { from: '#f43f5e', to: '#ef4444' },
  'sky-cyan': { from: '#0ea5e9', to: '#06b6d4' },
};

// Stat Card
function StatCard({
  icon,
  label,
  value,
  subtext,
  colorKey,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  colorKey: string;
}) {
  const colors = GRADIENT_COLORS[colorKey] || GRADIENT_COLORS['indigo-purple'];
  const gradientStyle = {
    background: `linear-gradient(to right, ${colors.from}, ${colors.to})`,
  };

  return (
    <div className="relative group">
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-10 rounded-xl transition-opacity"
        style={gradientStyle}
      />
      <div className="relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition-all">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={gradientStyle}>
            {icon}
          </div>
          <div>
            <p className="text-2xl font-bold text-white">
              <AnimatedValue value={value} />
            </p>
            <p className="text-sm text-slate-400">{label}</p>
            {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Language Bar Chart
function LanguageChart({ languages }: { languages: WakaTimeStats['languages'] }) {
  return (
    <div className="space-y-3">
      {/* Bar */}
      <div className="h-4 rounded-full overflow-hidden flex bg-slate-800">
        {languages.map((lang, index) => (
          <div
            key={lang.name}
            className="h-full transition-all duration-1000 ease-out"
            style={{
              width: `${lang.percent}%`,
              backgroundColor: lang.color,
              marginLeft: index === 0 ? 0 : '-1px',
            }}
            title={`${lang.name}: ${lang.percent}%`}
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
            <span className="text-slate-500">{lang.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Progress Bar Item
function ProgressItem({ name, percent, text, color }: { name: string; percent: number; text: string; color?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-300">{name}</span>
        <span className="text-slate-500">{text}</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${percent}%`,
            backgroundColor: color || '#6366f1',
          }}
        />
      </div>
    </div>
  );
}

// Editor icon mapping
function getEditorIcon(name: string) {
  const lowered = name.toLowerCase();
  if (lowered.includes('vs code') || lowered.includes('vscode')) {
    return (
      <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.583 17.044l-4.167 4.167L2 13.583l4.167-4.167 3.333 3.334-4.167 4.166 8.334-8.333L12 10l-1.667-1.667L17.583 1l4.167 4.167-4.167 4.167-3.333-3.334 4.167-4.166-8.334 8.333L12 10l1.667 1.667-4.167 4.167z"/>
      </svg>
    );
  }
  if (lowered.includes('intellij') || lowered.includes('webstorm') || lowered.includes('pycharm')) {
    return (
      <svg className="w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M0 0h24v24H0V0zm2 2v20h20V2H2zm3 17h8v-2H5v2zm0-4h14v-2H5v2zm0-4h14V9H5v2zm0-4h14V5H5v2z"/>
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}

// OS icon mapping
function getOSIcon(name: string) {
  const lowered = name.toLowerCase();
  if (lowered.includes('mac') || lowered.includes('darwin')) {
    return (
      <svg className="w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
      </svg>
    );
  }
  if (lowered.includes('windows')) {
    return (
      <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
      </svg>
    );
  }
  if (lowered.includes('linux') || lowered.includes('ubuntu')) {
    return (
      <svg className="w-5 h-5 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a.96.96 0 00-.026-.238c-.023-.105-.07-.194-.124-.283a.739.739 0 00-.472-.334.985.985 0 00-.37-.015.872.872 0 00-.116.028.959.959 0 00-.14.058.734.734 0 00-.131.072c-.003.001-.007.001-.009.001h-.005c-.03.022-.06.04-.084.067l-.006.007a1.007 1.007 0 00-.07.082c-.028.038-.06.075-.086.116-.026.04-.05.082-.073.122-.025.04-.049.085-.07.127a1.02 1.02 0 00-.052.127c-.015.043-.028.088-.041.129a.866.866 0 00-.029.132 1.144 1.144 0 00-.033.394c.003.06.01.118.02.176.01.06.022.118.038.175.016.055.034.109.056.16.014.04.03.079.047.118.017.04.035.08.056.117.021.037.043.074.068.11.024.034.05.07.078.102.028.033.058.064.09.094.03.03.064.059.098.087.035.026.071.053.11.077.038.023.077.046.117.066.04.02.08.039.122.055.041.017.085.031.128.044.043.013.087.025.132.033.044.009.09.016.135.02.045.005.09.008.136.008.046 0 .09-.003.135-.008.045-.004.09-.01.133-.02.043-.008.085-.02.127-.032a.987.987 0 00.124-.044 1.107 1.107 0 00.118-.055c.038-.02.075-.041.111-.064.036-.023.071-.049.105-.075.033-.026.066-.055.096-.086.03-.03.058-.061.084-.093.027-.032.052-.066.076-.101.023-.036.044-.072.063-.11.02-.037.037-.077.053-.117.015-.04.028-.08.04-.12.01-.04.02-.082.027-.123.007-.041.012-.083.016-.124.004-.042.005-.084.005-.126v-.105c0-.02-.006-.04-.006-.06.008-.265-.061-.465-.166-.724-.108-.201-.248-.398-.438-.533a1.03 1.03 0 00-.584-.198h-.013z"/>
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

export function WakaTimeStatsClient({ stats, allTimeStats, yearlyStats, yearlyStatsByYear, config }: Props) {
  const { language } = useLanguage();

  // Get available years from yearlyStatsByYear
  const availableYears = Object.keys(yearlyStatsByYear).map(Number).sort((a, b) => b - a);
  const [selectedYear, setSelectedYear] = useState<number | 'last365'>(
    config.yearlyStatsType === 'calendar' && availableYears.length > 0 ? availableYears[0] : 'last365'
  );

  // Get the stats for the selected year/period
  const currentYearlyStats = selectedYear === 'last365'
    ? yearlyStats
    : yearlyStatsByYear[selectedYear] || null;

  const texts = {
    title: language === 'pt' ? 'Estatísticas de Código' : 'Coding Stats',
    subtitle: language === 'pt' ? 'Minha atividade de programação via WakaTime' : 'My coding activity tracked by WakaTime',
    totalTime: language === 'pt' ? 'Tempo Total' : 'Total Time',
    last7Days: language === 'pt' ? 'Últimos 7 dias' : 'Last 7 days',
    dailyAverage: language === 'pt' ? 'Média Diária' : 'Daily Average',
    bestDay: language === 'pt' ? 'Melhor Dia' : 'Best Day',
    allTime: language === 'pt' ? 'Total Geral' : 'All Time',
    languages: language === 'pt' ? 'Linguagens' : 'Languages',
    editors: language === 'pt' ? 'Editores' : 'Editors',
    operatingSystems: language === 'pt' ? 'Sistemas Operacionais' : 'Operating Systems',
    projects: language === 'pt' ? 'Projetos' : 'Projects',
    viewProfile: language === 'pt' ? 'Ver perfil no WakaTime' : 'View WakaTime profile',
    yearlyStats: language === 'pt' ? 'Estatísticas Anuais' : 'Yearly Stats',
    yearlySubtitle: language === 'pt' ? 'Últimos 365 dias' : 'Last 365 days',
    yearlyTotal: language === 'pt' ? 'Total Anual' : 'Yearly Total',
    yearlyDailyAvg: language === 'pt' ? 'Média Diária (Ano)' : 'Daily Average (Year)',
    selectYear: language === 'pt' ? 'Selecionar Ano' : 'Select Year',
    last365Days: language === 'pt' ? 'Últimos 365 dias' : 'Last 365 days',
  };

  return (
    <section id="wakatime" className="py-20 px-4 overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              {texts.title}
            </span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            {texts.subtitle}
          </p>

          {/* Year Selection Buttons */}
          {config.showYearlyStats && (availableYears.length > 0 || yearlyStats) && (
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {yearlyStats && (
                <button
                  onClick={() => setSelectedYear('last365')}
                  className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                    selectedYear === 'last365'
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-purple-500/25'
                      : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-700'
                  }`}
                >
                  {texts.last365Days}
                </button>
              )}
              {availableYears.map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                    selectedYear === year
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-purple-500/25'
                      : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-700'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {config.showTotalTime && (
            <StatCard
              icon={<ClockIcon />}
              label={texts.totalTime}
              value={stats.totalHours}
              subtext={texts.last7Days}
              colorKey="indigo-purple"
            />
          )}
          {config.showDailyAverage && (
            <StatCard
              icon={<ChartIcon />}
              label={texts.dailyAverage}
              value={stats.dailyAverage}
              colorKey="cyan-blue"
            />
          )}
          {config.showBestDay && stats.bestDay && (
            <StatCard
              icon={<TrophyIcon />}
              label={texts.bestDay}
              value={stats.bestDay.text}
              subtext={new Date(stats.bestDay.date).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              colorKey="amber-orange"
            />
          )}
          {config.showAllTime && allTimeStats && (
            <StatCard
              icon={<InfinityIcon />}
              label={texts.allTime}
              value={allTimeStats.text}
              colorKey="emerald-teal"
            />
          )}
        </div>

        {/* Two Column Layout */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Languages */}
          {config.showLanguages && stats.languages.length > 0 && (
            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <CodeIcon />
                {texts.languages}
              </h3>
              <LanguageChart languages={stats.languages} />
            </div>
          )}

          {/* Editors */}
          {config.showEditors && stats.editors.length > 0 && (
            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <EditorIcon />
                {texts.editors}
              </h3>
              <div className="space-y-4">
                {stats.editors.map((editor) => (
                  <div key={editor.name} className="flex items-center gap-3">
                    {getEditorIcon(editor.name)}
                    <div className="flex-1">
                      <ProgressItem
                        name={editor.name}
                        percent={editor.percent}
                        text={editor.text}
                        color="#6366f1"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Operating Systems */}
          {config.showOS && stats.operatingSystems.length > 0 && (
            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <ComputerIcon />
                {texts.operatingSystems}
              </h3>
              <div className="space-y-4">
                {stats.operatingSystems.map((os) => (
                  <div key={os.name} className="flex items-center gap-3">
                    {getOSIcon(os.name)}
                    <div className="flex-1">
                      <ProgressItem
                        name={os.name}
                        percent={os.percent}
                        text={os.text}
                        color="#22d3ee"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {config.showProjects && stats.projects.length > 0 && (
            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <FolderIcon />
                {texts.projects}
              </h3>
              <div className="space-y-4">
                {stats.projects.map((project, index) => (
                  <ProgressItem
                    key={project.name}
                    name={project.name}
                    percent={project.percent}
                    text={project.text}
                    color={['#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'][index % 5]}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Yearly Stats Section */}
        {config.showYearlyStats && (yearlyStats || availableYears.length > 0) && (
          <div className="mt-12">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                <CalendarIcon />
                {texts.yearlyStats} {selectedYear !== 'last365' && `- ${selectedYear}`}
              </h3>
              <p className="text-slate-400 text-sm">
                {selectedYear === 'last365' ? texts.last365Days : `${language === 'pt' ? 'Ano de' : 'Year'} ${selectedYear}`}
              </p>
            </div>

            {currentYearlyStats && (
              <>
                {/* Yearly Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <StatCard
                    icon={<ClockIcon />}
                    label={texts.yearlyTotal}
                    value={currentYearlyStats.totalHours}
                    colorKey="violet-purple"
                  />
                  <StatCard
                    icon={<ChartIcon />}
                    label={texts.yearlyDailyAvg}
                    value={currentYearlyStats.dailyAverage}
                    colorKey="fuchsia-pink"
                  />
                  {currentYearlyStats.bestDay && (
                    <StatCard
                      icon={<TrophyIcon />}
                      label={texts.bestDay}
                      value={currentYearlyStats.bestDay.text}
                      subtext={new Date(currentYearlyStats.bestDay.date).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      colorKey="rose-red"
                    />
                  )}
                  <div className="relative group">
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-10 rounded-xl transition-opacity"
                      style={{ background: 'linear-gradient(to right, #0ea5e9, #06b6d4)' }}
                    />
                    <div className="relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition-all h-full flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-white">{currentYearlyStats.languages.length}+</p>
                        <p className="text-sm text-slate-400">{texts.languages}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Yearly Languages & Projects */}
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Yearly Languages */}
                  {currentYearlyStats.languages.length > 0 && (
                    <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                      <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <CodeIcon />
                        {texts.languages} ({selectedYear === 'last365' ? texts.last365Days : selectedYear})
                      </h4>
                      <LanguageChart languages={currentYearlyStats.languages} />
                    </div>
                  )}

                  {/* Yearly Projects */}
                  {currentYearlyStats.projects.length > 0 && (
                    <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                      <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <FolderIcon />
                        {texts.projects} ({selectedYear === 'last365' ? texts.last365Days : selectedYear})
                      </h4>
                      <div className="space-y-4">
                        {currentYearlyStats.projects.slice(0, 5).map((project, index) => (
                          <ProgressItem
                            key={project.name}
                            name={project.name}
                            percent={project.percent}
                            text={project.text}
                            color={['#a855f7', '#ec4899', '#06b6d4', '#22c55e', '#eab308'][index % 5]}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* WakaTime Profile Link */}
        {config.profileUrl && (
          <div className="mt-8 text-center">
            <a
              href={config.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition-all hover:-translate-y-1"
            >
              <WakaTimeIcon />
              {texts.viewProfile}
              <ExternalLinkIcon />
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

// Icons
const ClockIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const TrophyIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const InfinityIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12c-2-2.67-4-4-6-4a4 4 0 100 8c2 0 4-1.33 6-4zm0 0c2 2.67 4 4 6 4a4 4 0 000-8c-2 0-4 1.33-6 4z" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const CodeIcon = () => (
  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
  </svg>
);

const EditorIcon = () => (
  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const ComputerIcon = () => (
  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const FolderIcon = () => (
  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const WakaTimeIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.824a9.176 9.176 0 110 18.352 9.176 9.176 0 010-18.352zm-.002 2.39a6.787 6.787 0 100 13.573 6.787 6.787 0 000-13.574zm0 2.822a3.965 3.965 0 110 7.93 3.965 3.965 0 010-7.93z"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);
