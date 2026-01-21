'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface WakaTimeConfig {
  enabled: boolean;
  // Weekly stats
  showTotalTime: boolean;
  showDailyAverage: boolean;
  showBestDay: boolean;
  showAllTime: boolean;
  showLanguages: boolean;
  showEditors: boolean;
  showOS: boolean;
  showProjects: boolean;
  // Yearly stats
  showYearlyStats: boolean;
  showYearSelector: boolean;
  selectedYears: number[];
  yearlyStatsType: 'last365' | 'calendar';
  // Yearly display options
  showYearlyTotalTime: boolean;
  showYearlyDailyAverage: boolean;
  showYearlyBestDay: boolean;
  showYearlyLanguages: boolean;
  showYearlyEditors: boolean;
  showYearlyOS: boolean;
  showYearlyProjects: boolean;
  // Year in Review links
  yearlyReportLinks: Record<number, string>;
  showYearlyReportLink: boolean;
  // Ranking badge
  showRankingBadge: boolean;
  rankingPercentile: number;
  rankingTotalDevs: string;
  yearlyRankings: Record<number, { percentile: number; totalDevs: string }>;
  // Other
  profileUrl: string;
  cacheYearlyData: boolean;
}

interface WakaTimePreview {
  totalHours: string;
  dailyAverage: string;
  bestDay: { text: string; date: string } | null;
  languages: { name: string; percent: number; text: string }[];
  projects: { name: string; percent: number; text: string }[];
}

const DEFAULT_CONFIG: WakaTimeConfig = {
  enabled: true,
  showTotalTime: true,
  showDailyAverage: true,
  showBestDay: true,
  showAllTime: true,
  showLanguages: true,
  showEditors: true,
  showOS: true,
  showProjects: true,
  showYearlyStats: true,
  showYearSelector: true,
  selectedYears: [],
  yearlyStatsType: 'last365',
  showYearlyTotalTime: true,
  showYearlyDailyAverage: true,
  showYearlyBestDay: true,
  showYearlyLanguages: true,
  showYearlyEditors: true,
  showYearlyOS: true,
  showYearlyProjects: true,
  yearlyReportLinks: {},
  showYearlyReportLink: true,
  showRankingBadge: true,
  rankingPercentile: 1,
  rankingTotalDevs: '500k+',
  yearlyRankings: {
    2023: { percentile: 1, totalDevs: '500k+' },
    2024: { percentile: 1, totalDevs: '500k+' },
    2025: { percentile: 4, totalDevs: '500k+' },
  },
  profileUrl: 'https://wakatime.com/@josefelipedev',
  cacheYearlyData: true,
};

// Generate available years (current year and last 4 years)
const getAvailableYears = () => {
  const currentYear = new Date().getFullYear();
  return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4];
};

export default function WakaTimeAdminPage() {
  const [config, setConfig] = useState<WakaTimeConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState<WakaTimePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [fetchingRankings, setFetchingRankings] = useState(false);
  const [rankingsFetched, setRankingsFetched] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/wakatime/settings');
      const data = await response.json();
      setConfig({ ...DEFAULT_CONFIG, ...data });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch config');
    } finally {
      setLoading(false);
    }
  };

  const fetchPreview = async () => {
    try {
      setLoadingPreview(true);
      setShowPreview(true);
      // Fetch from WakaTime API via our endpoint
      const response = await fetch('/api/wakatime/preview');
      if (response.ok) {
        const data = await response.json();
        setPreview(data);
      } else {
        setPreview(null);
      }
    } catch {
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const response = await fetch('/api/wakatime/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save config');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof WakaTimeConfig) => {
    if (typeof config[key] === 'boolean') {
      setConfig({ ...config, [key]: !config[key] });
    }
  };

  const fetchRankingsFromUrls = async () => {
    try {
      setFetchingRankings(true);
      setRankingsFetched(null);
      setError(null);

      const response = await fetch('/api/wakatime/fetch-rankings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch rankings');
      }

      // Update local config with fetched rankings
      if (data.rankings) {
        setConfig(prev => ({
          ...prev,
          yearlyRankings: {
            ...prev.yearlyRankings,
            ...data.rankings,
          },
        }));
        setRankingsFetched(`Rankings extracted for: ${Object.keys(data.rankings).join(', ')}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rankings');
    } finally {
      setFetchingRankings(false);
    }
  };

  // Weekly stats options
  const weeklyOptions = [
    { key: 'showTotalTime', label: 'Tempo Total (7 dias)', description: 'Mostra o total de horas codificadas nos últimos 7 dias' },
    { key: 'showDailyAverage', label: 'Média Diária', description: 'Mostra a média de horas por dia' },
    { key: 'showBestDay', label: 'Melhor Dia', description: 'Mostra o dia com mais horas de código' },
    { key: 'showAllTime', label: 'Tempo Total Geral', description: 'Mostra o total de horas desde o início do uso do WakaTime' },
    { key: 'showLanguages', label: 'Linguagens', description: 'Mostra as linguagens de programação mais usadas' },
    { key: 'showEditors', label: 'Editores', description: 'Mostra os editores de código mais usados' },
    { key: 'showOS', label: 'Sistemas Operacionais', description: 'Mostra os sistemas operacionais utilizados' },
    { key: 'showProjects', label: 'Projetos', description: 'Mostra os projetos mais trabalhados' },
  ] as const;

  // Yearly stats display options
  const yearlyDisplayOptions = [
    { key: 'showYearlyTotalTime', label: 'Total Anual', description: 'Mostra o total de horas do ano' },
    { key: 'showYearlyDailyAverage', label: 'Média Diária (Ano)', description: 'Mostra a média diária do ano' },
    { key: 'showYearlyBestDay', label: 'Melhor Dia (Ano)', description: 'Mostra o melhor dia do ano' },
    { key: 'showYearlyLanguages', label: 'Linguagens (Ano)', description: 'Mostra as linguagens usadas no ano' },
    { key: 'showYearlyEditors', label: 'Editores (Ano)', description: 'Mostra os editores usados no ano' },
    { key: 'showYearlyOS', label: 'Sistemas Operacionais (Ano)', description: 'Mostra os sistemas operacionais do ano' },
    { key: 'showYearlyProjects', label: 'Projetos (Ano)', description: 'Mostra os projetos do ano' },
  ] as const;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">WakaTime Settings</h1>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              Configure quais estatísticas mostrar na página inicial
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchPreview}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview
            </button>
            <Link
              href="/admin"
              className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
            >
              Voltar
            </Link>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6">
            <p className="text-green-600 dark:text-green-400">Configurações salvas com sucesso!</p>
          </div>
        )}

        {/* Preview Panel */}
        {showPreview && (
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Preview dos Dados</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-slate-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {loadingPreview ? (
              <div className="flex items-center justify-center py-8">
                <svg className="w-8 h-8 animate-spin text-purple-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : preview ? (
              <div className="space-y-4">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {config.showTotalTime && (
                    <div className="bg-slate-800 rounded-lg p-3">
                      <p className="text-2xl font-bold text-white">{preview.totalHours}</p>
                      <p className="text-sm text-slate-400">Tempo Total</p>
                    </div>
                  )}
                  {config.showDailyAverage && (
                    <div className="bg-slate-800 rounded-lg p-3">
                      <p className="text-2xl font-bold text-white">{preview.dailyAverage}</p>
                      <p className="text-sm text-slate-400">Média Diária</p>
                    </div>
                  )}
                  {config.showBestDay && preview.bestDay && (
                    <div className="bg-slate-800 rounded-lg p-3">
                      <p className="text-2xl font-bold text-white">{preview.bestDay.text}</p>
                      <p className="text-sm text-slate-400">Melhor Dia</p>
                    </div>
                  )}
                </div>

                {/* Languages */}
                {config.showLanguages && preview.languages.length > 0 && (
                  <div className="bg-slate-800 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-3">Linguagens</h4>
                    <div className="space-y-2">
                      {preview.languages.slice(0, 5).map((lang) => (
                        <div key={lang.name} className="flex items-center justify-between">
                          <span className="text-slate-300">{lang.name}</span>
                          <span className="text-slate-400">{lang.percent}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Projects */}
                {config.showProjects && preview.projects.length > 0 && (
                  <div className="bg-slate-800 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-3">Projetos</h4>
                    <div className="space-y-2">
                      {preview.projects.slice(0, 5).map((proj) => (
                        <div key={proj.name} className="flex items-center justify-between">
                          <span className="text-slate-300">{proj.name}</span>
                          <span className="text-slate-400">{proj.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Year Buttons Preview */}
                {config.showYearSelector && config.showYearlyStats && (
                  <div className="bg-slate-800 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-3">Botões de Anos (Preview)</h4>
                    <div className="flex flex-wrap gap-2">
                      {config.yearlyStatsType === 'last365' && (
                        <span className="px-4 py-2 bg-purple-500 text-white rounded-full text-sm">
                          Últimos 365 dias
                        </span>
                      )}
                      {config.yearlyStatsType === 'calendar' && config.selectedYears.length > 0 ? (
                        config.selectedYears.map((year) => (
                          <span key={year} className="px-4 py-2 bg-slate-700 text-slate-300 rounded-full text-sm">
                            {year}
                          </span>
                        ))
                      ) : config.yearlyStatsType === 'calendar' ? (
                        <span className="text-slate-400 text-sm">Nenhum ano selecionado</span>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <p>Não foi possível carregar a preview.</p>
                <p className="text-sm mt-1">Verifique se a API key do WakaTime está configurada.</p>
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-zinc-500">
              <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Carregando...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Main Toggle */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              <div className="p-4 flex items-center justify-between bg-zinc-100 dark:bg-zinc-700">
                <div className="flex-1">
                  <h3 className="font-medium text-lg text-zinc-900 dark:text-zinc-100">Habilitar Seção WakaTime</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Mostra ou esconde toda a seção na página inicial</p>
                </div>
                <button
                  onClick={() => handleToggle('enabled')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config.enabled ? 'bg-red-500' : 'bg-zinc-300 dark:bg-zinc-600'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>

            {/* Weekly Stats Options */}
            {config.enabled && (
              <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Estatísticas Semanais (Últimos 7 dias)
                  </h3>
                </div>
                {weeklyOptions.map((option, index) => (
                  <div
                    key={option.key}
                    className={`p-4 flex items-center justify-between ${
                      index !== weeklyOptions.length - 1 ? 'border-b border-zinc-200 dark:border-zinc-700' : ''
                    }`}
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{option.label}</h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">{option.description}</p>
                    </div>
                    <button
                      onClick={() => handleToggle(option.key)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        config[option.key] ? 'bg-red-500' : 'bg-zinc-300 dark:bg-zinc-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config[option.key] ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Yearly Stats Toggle */}
            {config.enabled && (
              <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                <div className="p-4 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                  <div className="flex-1">
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Estatísticas Anuais
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Mostra seção de estatísticas por ano</p>
                  </div>
                  <button
                    onClick={() => handleToggle('showYearlyStats')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.showYearlyStats ? 'bg-red-500' : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.showYearlyStats ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {/* Year Selector Toggle */}
                <div className={`p-4 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 ${!config.showYearlyStats ? 'opacity-50' : ''}`}>
                  <div className="flex-1">
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Botões de Seleção de Ano</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Permite o visitante escolher qual ano visualizar</p>
                  </div>
                  <button
                    onClick={() => handleToggle('showYearSelector')}
                    disabled={!config.showYearlyStats}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.showYearSelector ? 'bg-red-500' : 'bg-zinc-300 dark:bg-zinc-600'
                    } ${!config.showYearlyStats ? 'cursor-not-allowed' : ''}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.showYearSelector ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {/* Yearly Display Options */}
                {config.showYearlyStats && (
                  <>
                    <div className="p-3 bg-zinc-100 dark:bg-zinc-700/50 border-b border-zinc-200 dark:border-zinc-700">
                      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">O que mostrar nas estatísticas anuais:</p>
                    </div>
                    {yearlyDisplayOptions.map((option, index) => (
                      <div
                        key={option.key}
                        className={`p-4 flex items-center justify-between ${
                          index !== yearlyDisplayOptions.length - 1 ? 'border-b border-zinc-200 dark:border-zinc-700' : ''
                        }`}
                      >
                        <div className="flex-1">
                          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{option.label}</h3>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">{option.description}</p>
                        </div>
                        <button
                          onClick={() => handleToggle(option.key)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            config[option.key] ? 'bg-red-500' : 'bg-zinc-300 dark:bg-zinc-600'
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            config[option.key] ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>
                    ))}
                  </>
                )}

                {/* Cache Option */}
                <div className={`p-4 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-700 ${!config.showYearlyStats ? 'opacity-50' : ''}`}>
                  <div className="flex-1">
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                      </svg>
                      Cache no Banco de Dados
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Salva dados de anos anteriores para carregamento mais rápido</p>
                  </div>
                  <button
                    onClick={() => handleToggle('cacheYearlyData')}
                    disabled={!config.showYearlyStats}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.cacheYearlyData ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
                    } ${!config.showYearlyStats ? 'cursor-not-allowed' : ''}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.cacheYearlyData ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            )}

            {/* Year Configuration - Always visible when enabled */}
            {config.enabled && (
              <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Configuração de Anos
                </h3>

                {!config.showYearlyStats && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      ⚠️ Ative "Estatísticas Anuais" acima para usar esta configuração.
                    </p>
                  </div>
                )}

                {/* Stats Type Selection */}
                <div className={`mb-4 ${!config.showYearlyStats ? 'opacity-50 pointer-events-none' : ''}`}>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Tipo de Estatísticas Anuais
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="yearlyStatsType"
                        value="last365"
                        checked={config.yearlyStatsType === 'last365'}
                        onChange={() => setConfig({ ...config, yearlyStatsType: 'last365' })}
                        className="w-4 h-4 text-red-500"
                      />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">Últimos 365 dias</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="yearlyStatsType"
                        value="calendar"
                        checked={config.yearlyStatsType === 'calendar'}
                        onChange={() => setConfig({ ...config, yearlyStatsType: 'calendar' })}
                        className="w-4 h-4 text-red-500"
                      />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">Anos específicos</span>
                    </label>
                  </div>
                </div>

                {/* Year Selection */}
                <div className={`${!config.showYearlyStats || config.yearlyStatsType !== 'calendar' ? 'opacity-50 pointer-events-none' : ''}`}>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Selecione os anos para exibir
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {getAvailableYears().map((year) => {
                      const isSelected = config.selectedYears.includes(year);
                      return (
                        <button
                          key={year}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setConfig({
                                ...config,
                                selectedYears: config.selectedYears.filter((y) => y !== year),
                              });
                            } else {
                              setConfig({
                                ...config,
                                selectedYears: [...config.selectedYears, year].sort((a, b) => b - a),
                              });
                            }
                          }}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isSelected
                              ? 'bg-red-500 text-white'
                              : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600'
                          }`}
                        >
                          {year}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                    Clique nos anos que deseja mostrar. Os dados serão carregados para cada ano selecionado.
                  </p>
                  {config.yearlyStatsType === 'calendar' && config.selectedYears.length === 0 && config.showYearlyStats && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                      ⚠️ Selecione pelo menos um ano para exibir estatísticas.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Year in Review Links */}
            {config.enabled && config.showYearlyStats && (
              <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Links "Year in Review"
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                  Cole os links públicos do WakaTime "A Look Back" para cada ano
                </p>

                {/* Toggle show link */}
                <div className="p-3 flex items-center justify-between bg-zinc-50 dark:bg-zinc-700/50 rounded-lg mb-4">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">Mostrar botão "Ver relatório completo"</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Link para o relatório completo no WakaTime</p>
                  </div>
                  <button
                    onClick={() => handleToggle('showYearlyReportLink')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.showYearlyReportLink ? 'bg-red-500' : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.showYearlyReportLink ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                <div className="space-y-3">
                  {getAvailableYears().map((year) => (
                    <div key={year} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 w-12">{year}</span>
                      <input
                        type="url"
                        value={config.yearlyReportLinks?.[year] || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          yearlyReportLinks: {
                            ...config.yearlyReportLinks,
                            [year]: e.target.value,
                          },
                        })}
                        className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm"
                        placeholder={`https://wakatime.com/a-look-back-at-${year}/...`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ranking Badge */}
            {config.enabled && (
              <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 3a2 2 0 00-2 2v2a5 5 0 003.5 4.78V14a1 1 0 001 1h.5v5a1 1 0 001 1h6a1 1 0 001-1v-5h.5a1 1 0 001-1v-2.22A5 5 0 0021 7V5a2 2 0 00-2-2H5z" />
                  </svg>
                  Badge de Ranking
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                  Mostra seu ranking entre os desenvolvedores do WakaTime
                </p>

                {/* Toggle show badge */}
                <div className="p-3 flex items-center justify-between bg-zinc-50 dark:bg-zinc-700/50 rounded-lg mb-4">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">Mostrar badge de ranking</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Ex: "Top 1% de 500k+ devs"</p>
                  </div>
                  <button
                    onClick={() => handleToggle('showRankingBadge')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.showRankingBadge ? 'bg-amber-500' : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.showRankingBadge ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {config.showRankingBadge && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        Percentil (Top X%)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={config.rankingPercentile}
                        onChange={(e) => setConfig({ ...config, rankingPercentile: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        Total de devs
                      </label>
                      <input
                        type="text"
                        value={config.rankingTotalDevs}
                        onChange={(e) => setConfig({ ...config, rankingTotalDevs: e.target.value })}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                        placeholder="500k+"
                      />
                    </div>
                  </div>
                )}

                {/* Preview */}
                {config.showRankingBadge && (
                  <div className="mt-4 p-4 bg-slate-900 rounded-lg">
                    <p className="text-sm text-slate-400 mb-2">Preview:</p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30">
                      <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M5 3a2 2 0 00-2 2v2a5 5 0 003.5 4.78V14a1 1 0 001 1h.5v5a1 1 0 001 1h6a1 1 0 001-1v-5h.5a1 1 0 001-1v-2.22A5 5 0 0021 7V5a2 2 0 00-2-2H5z" />
                      </svg>
                      <span className="text-sm font-semibold">
                        <span className="text-amber-400">Top {config.rankingPercentile}%</span>
                        <span className="text-slate-400 ml-1">de {config.rankingTotalDevs} devs</span>
                      </span>
                    </div>
                  </div>
                )}

                {/* Yearly Rankings */}
                {config.showRankingBadge && (
                  <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-zinc-900 dark:text-zinc-100">Ranking por Ano</h4>
                      <button
                        onClick={fetchRankingsFromUrls}
                        disabled={fetchingRankings || Object.keys(config.yearlyReportLinks || {}).length === 0}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {fetchingRankings ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Buscando...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Buscar das URLs
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                      Configure o ranking para cada ano. Clique em &quot;Buscar das URLs&quot; para extrair automaticamente das páginas Year in Review.
                    </p>

                    {rankingsFetched && (
                      <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <p className="text-sm text-green-700 dark:text-green-400">{rankingsFetched}</p>
                      </div>
                    )}

                    <div className="space-y-3">
                      {getAvailableYears().map((year) => (
                        <div key={year} className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg">
                          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 w-12">{year}</span>
                          <div className="flex-1 grid grid-cols-2 gap-3">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={config.yearlyRankings?.[year]?.percentile || ''}
                              onChange={(e) => setConfig({
                                ...config,
                                yearlyRankings: {
                                  ...config.yearlyRankings,
                                  [year]: {
                                    percentile: parseInt(e.target.value) || 1,
                                    totalDevs: config.yearlyRankings?.[year]?.totalDevs || '500k+',
                                  },
                                },
                              })}
                              className="px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                              placeholder="Top X%"
                            />
                            <input
                              type="text"
                              value={config.yearlyRankings?.[year]?.totalDevs || ''}
                              onChange={(e) => setConfig({
                                ...config,
                                yearlyRankings: {
                                  ...config.yearlyRankings,
                                  [year]: {
                                    percentile: config.yearlyRankings?.[year]?.percentile || 1,
                                    totalDevs: e.target.value,
                                  },
                                },
                              })}
                              className="px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                              placeholder="500k+"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-zinc-400 mt-2">
                      Dica: Acesse wakatime.com/a-look-back-at-YEAR para ver seu ranking de cada ano
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Profile URL */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                URL do Perfil WakaTime
              </label>
              <input
                type="url"
                value={config.profileUrl}
                onChange={(e) => setConfig({ ...config, profileUrl: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                placeholder="https://wakatime.com/@username"
              />
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Link para o seu perfil público do WakaTime
              </p>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Salvando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Salvar Configurações
                  </>
                )}
              </button>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">Dica</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Clique em "Preview" para ver como os dados vão aparecer.
                    Você pode desativar estatísticas que não quer mostrar publicamente.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
