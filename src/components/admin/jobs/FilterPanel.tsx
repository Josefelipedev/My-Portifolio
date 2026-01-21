'use client';

import { useState } from 'react';

export interface JobFilters {
  salaryMin: number;
  salaryMax: number;
  jobType: 'all' | 'remote' | 'hybrid' | 'onsite';
  experienceLevel: 'all' | 'junior' | 'mid' | 'senior';
  sortBy: 'date' | 'salary' | 'relevance';
}

interface FilterPanelProps {
  filters: JobFilters;
  onChange: (filters: JobFilters) => void;
  isSmartSearch?: boolean;
}

const JOB_TYPE_OPTIONS = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'remote', label: 'Remoto' },
  { value: 'hybrid', label: 'Hibrido' },
  { value: 'onsite', label: 'Presencial' },
];

const EXPERIENCE_OPTIONS = [
  { value: 'all', label: 'Todos os niveis' },
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Pleno' },
  { value: 'senior', label: 'Senior' },
];

const SORT_OPTIONS = [
  { value: 'date', label: 'Data (mais recente)' },
  { value: 'relevance', label: 'Relevancia' },
  { value: 'salary', label: 'Salario (maior)' },
];

export default function FilterPanel({
  filters,
  onChange,
  isSmartSearch = false,
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleChange = (key: keyof JobFilters, value: string | number) => {
    onChange({
      ...filters,
      [key]: value,
    });
  };

  const hasActiveFilters =
    filters.jobType !== 'all' ||
    filters.experienceLevel !== 'all' ||
    filters.salaryMin > 0 ||
    filters.salaryMax < 500000;

  const resetFilters = () => {
    onChange({
      salaryMin: 0,
      salaryMax: 500000,
      jobType: 'all',
      experienceLevel: 'all',
      sortBy: 'date',
    });
  };

  return (
    <div className="mb-4">
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
      >
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <span className="font-medium">Filtros Avancados</span>
        {hasActiveFilters && (
          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-full">
            Ativos
          </span>
        )}
      </button>

      {/* Filter Panel */}
      {isExpanded && (
        <div className="mt-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Job Type */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                Tipo de Trabalho
              </label>
              <select
                value={filters.jobType}
                onChange={(e) => handleChange('jobType', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                {JOB_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Experience Level */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                Nivel de Experiencia
              </label>
              <select
                value={filters.experienceLevel}
                onChange={(e) => handleChange('experienceLevel', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                {EXPERIENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Salary Range */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                Faixa Salarial (USD/ano)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={filters.salaryMin || ''}
                  onChange={(e) => handleChange('salaryMin', parseInt(e.target.value) || 0)}
                  placeholder="Min"
                  className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
                <span className="text-zinc-400">-</span>
                <input
                  type="number"
                  value={filters.salaryMax >= 500000 ? '' : filters.salaryMax}
                  onChange={(e) => handleChange('salaryMax', parseInt(e.target.value) || 500000)}
                  placeholder="Max"
                  className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                Ordenar por
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => handleChange('sortBy', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
                {isSmartSearch && (
                  <option value="match">Match com Curriculo</option>
                )}
              </select>
            </div>
          </div>

          {/* Reset Button */}
          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <button
                onClick={resetFilters}
                className="text-sm text-red-500 hover:text-red-600 font-medium"
              >
                Limpar Filtros
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper function to filter jobs based on filters
export function applyJobFilters<T extends {
  id: string;
  title?: string;
  description?: string;
  location?: string;
  jobType?: string;
  salary?: string;
  tags?: string[];
  relevanceScore?: number;
  postedAt?: string;
}>(
  jobs: T[],
  filters: JobFilters
): T[] {
  let filtered = [...jobs];

  // Filter by job type
  if (filters.jobType !== 'all') {
    filtered = filtered.filter((job) => {
      const text = `${job.title || ''} ${job.location || ''} ${job.jobType || ''} ${job.description || ''}`.toLowerCase();
      switch (filters.jobType) {
        case 'remote':
          return /\b(remote|remoto|home[\s-]?office|anywhere)\b/i.test(text);
        case 'hybrid':
          return /\b(hybrid|hibrido|híbrido)\b/i.test(text);
        case 'onsite':
          return /\b(on[\s-]?site|presencial|in[\s-]?office)\b/i.test(text);
        default:
          return true;
      }
    });
  }

  // Filter by experience level
  if (filters.experienceLevel !== 'all') {
    filtered = filtered.filter((job) => {
      const text = `${job.title || ''} ${job.description || ''}`.toLowerCase();
      switch (filters.experienceLevel) {
        case 'junior':
          return /\b(junior|jr\.?|entry[\s-]?level|trainee|intern|estagio|estagiario)\b/i.test(text);
        case 'mid':
          return /\b(mid[\s-]?level|pleno|intermediate)\b/i.test(text) ||
                 (!/(junior|jr\.?|senior|sr\.?|lead|principal)/i.test(text));
        case 'senior':
          return /\b(senior|sr\.?|lead|principal|staff|architect|head)\b/i.test(text);
        default:
          return true;
      }
    });
  }

  // Filter by salary (only if job has salary info)
  if (filters.salaryMin > 0 || filters.salaryMax < 500000) {
    filtered = filtered.filter((job) => {
      if (!job.salary) return true; // Keep jobs without salary info

      // Extract numbers from salary string
      const numbers = job.salary.match(/\d+(?:,\d{3})*(?:\.\d+)?/g);
      if (!numbers) return true;

      const salaryValues = numbers.map((n) => parseFloat(n.replace(/,/g, '')));
      const maxSalary = Math.max(...salaryValues);

      // Check for 'k' multiplier
      if (/\d+\s*k/i.test(job.salary)) {
        const kValue = maxSalary * 1000;
        return kValue >= filters.salaryMin && kValue <= filters.salaryMax;
      }

      return maxSalary >= filters.salaryMin && maxSalary <= filters.salaryMax;
    });
  }

  // Sort
  switch (filters.sortBy) {
    case 'date':
      filtered.sort((a, b) => {
        const dateA = a.postedAt ? new Date(a.postedAt).getTime() : 0;
        const dateB = b.postedAt ? new Date(b.postedAt).getTime() : 0;
        return dateB - dateA;
      });
      break;
    case 'salary':
      filtered.sort((a, b) => {
        const getSalaryValue = (salary?: string) => {
          if (!salary) return 0;
          const numbers = salary.match(/\d+(?:,\d{3})*(?:\.\d+)?/g);
          if (!numbers) return 0;
          const values = numbers.map((n) => parseFloat(n.replace(/,/g, '')));
          if (/\d+\s*k/i.test(salary)) return Math.max(...values) * 1000;
          return Math.max(...values);
        };
        return getSalaryValue(b.salary) - getSalaryValue(a.salary);
      });
      break;
    case 'relevance':
      filtered.sort((a, b) => ((b as { relevanceScore?: number }).relevanceScore || 0) - ((a as { relevanceScore?: number }).relevanceScore || 0));
      break;
  }

  return filtered as T[];
}
