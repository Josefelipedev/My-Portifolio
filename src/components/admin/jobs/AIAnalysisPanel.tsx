'use client';

export interface AIAnalysis {
  grade: string;
  skillFitPercent: number;
  salaryAssessment: string;
  seniorityMatch: string;
  applicationTip: string;
  strengths: string[];
  gaps: string[];
}

interface AIAnalysisPanelProps {
  analysis: AIAnalysis;
}

export default function AIAnalysisPanel({ analysis }: AIAnalysisPanelProps) {
  const fitColor =
    analysis.skillFitPercent >= 70
      ? 'bg-green-500'
      : analysis.skillFitPercent >= 45
      ? 'bg-yellow-500'
      : 'bg-red-500';

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        Análise IA
      </div>

      {/* Skill Fit Bar */}
      <div>
        <div className="flex items-center justify-between mb-1 text-xs text-zinc-600 dark:text-zinc-400">
          <span>Compatibilidade de Skills</span>
          <span className="font-semibold">{analysis.skillFitPercent}%</span>
        </div>
        <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${fitColor} rounded-full transition-all duration-500`}
            style={{ width: `${analysis.skillFitPercent}%` }}
          />
        </div>
      </div>

      {/* Salary + Seniority */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white/60 dark:bg-zinc-800/60 rounded-lg p-3">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Salário vs Mercado</p>
          <p className="text-xs text-zinc-700 dark:text-zinc-300">{analysis.salaryAssessment}</p>
        </div>
        <div className="bg-white/60 dark:bg-zinc-800/60 rounded-lg p-3">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Senioridade</p>
          <p className="text-xs text-zinc-700 dark:text-zinc-300">{analysis.seniorityMatch}</p>
        </div>
      </div>

      {/* Application Tip */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Dica de Candidatura
        </p>
        <p className="text-xs text-amber-800 dark:text-amber-300">{analysis.applicationTip}</p>
      </div>

      {/* Strengths + Gaps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {analysis.strengths.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">Pontos Fortes</p>
            <ul className="space-y-1">
              {analysis.strengths.map((s, i) => (
                <li key={i} className="text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.gaps.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">Gaps</p>
            <ul className="space-y-1">
              {analysis.gaps.map((g, i) => (
                <li key={i} className="text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                  {g}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
