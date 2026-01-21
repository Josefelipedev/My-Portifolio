'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface WakaTimeConfig {
  enabled: boolean;
  showTotalTime: boolean;
  showDailyAverage: boolean;
  showBestDay: boolean;
  showAllTime: boolean;
  showYearlyStats: boolean;
  showYearSelector: boolean;
  showLanguages: boolean;
  showEditors: boolean;
  showOS: boolean;
  showProjects: boolean;
  profileUrl: string;
  selectedYears: number[];
  yearlyStatsType: 'last365' | 'calendar';
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
  showYearlyStats: true,
  showYearSelector: true,
  showLanguages: true,
  showEditors: true,
  showOS: true,
  showProjects: true,
  profileUrl: 'https://wakatime.com/@josefelipe',
  selectedYears: [],
  yearlyStatsType: 'last365',
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

  const toggleOptions = [
    { key: 'enabled', label: 'Habilitar Seção WakaTime', description: 'Mostra ou esconde toda a seção de estatísticas do WakaTime na página inicial' },
    { key: 'showTotalTime', label: 'Tempo Total (7 dias)', description: 'Mostra o total de horas codificadas nos últimos 7 dias' },
    { key: 'showDailyAverage', label: 'Média Diária', description: 'Mostra a média de horas por dia' },
    { key: 'showBestDay', label: 'Melhor Dia', description: 'Mostra o dia com mais horas de código' },
    { key: 'showAllTime', label: 'Tempo Total Geral', description: 'Mostra o total de horas desde o início do uso do WakaTime' },
    { key: 'showYearlyStats', label: 'Estatísticas Anuais', description: 'Mostra uma seção com estatísticas anuais (linguagens, projetos, etc.)' },
    { key: 'showYearSelector', label: 'Botões de Seleção de Ano', description: 'Mostra os botões para o visitante escolher qual ano visualizar' },
    { key: 'showLanguages', label: 'Linguagens', description: 'Mostra as linguagens de programação mais usadas' },
    { key: 'showEditors', label: 'Editores', description: 'Mostra os editores de código mais usados' },
    { key: 'showOS', label: 'Sistemas Operacionais', description: 'Mostra os sistemas operacionais utilizados' },
    { key: 'showProjects', label: 'Projetos', description: 'Mostra os projetos mais trabalhados' },
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
            {/* Toggle Options */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              {toggleOptions.map((option, index) => (
                <div
                  key={option.key}
                  className={`p-4 flex items-center justify-between ${
                    index !== toggleOptions.length - 1 ? 'border-b border-zinc-200 dark:border-zinc-700' : ''
                  } ${option.key === 'enabled' ? 'bg-zinc-100 dark:bg-zinc-700' : ''}`}
                >
                  <div className="flex-1">
                    <h3 className={`font-medium ${option.key === 'enabled' ? 'text-lg' : ''} text-zinc-900 dark:text-zinc-100`}>
                      {option.label}
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{option.description}</p>
                  </div>
                  <button
                    onClick={() => handleToggle(option.key)}
                    disabled={option.key !== 'enabled' && !config.enabled}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config[option.key]
                        ? 'bg-red-500'
                        : 'bg-zinc-300 dark:bg-zinc-600'
                    } ${option.key !== 'enabled' && !config.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config[option.key] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>

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
