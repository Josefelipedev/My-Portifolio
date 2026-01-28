'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { fetchWithCSRF } from '@/lib/csrf-client';
import { useToast } from '@/components/ui/Toast';

type ModalTab = 'import' | 'export' | 'config' | 'url-update';
type ImportSource = 'dges' | 'eduportugal';

interface ScraperConfig {
  dges: {
    baseUrl: string;
    enabled: boolean;
  };
  eduportugal: {
    baseUrl: string;
    enabled: boolean;
  };
}

interface UrlUpdateResult {
  type: string;
  name: string;
  fieldsUpdated: number;
  data: Record<string, unknown>;
}

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportStarted: (syncId: string, source: ImportSource, syncType: string) => void;
  scraperConfig: ScraperConfig | null;
  onConfigSaved: (config: ScraperConfig) => void;
}

export default function DataManagementModal({
  isOpen,
  onClose,
  onImportStarted,
  scraperConfig,
  onConfigSaved,
}: DataManagementModalProps) {
  const { showSuccess, showError, showWarning } = useToast();

  const [activeTab, setActiveTab] = useState<ModalTab>('import');
  const [importSource, setImportSource] = useState<ImportSource>('dges');
  const [isStartingImport, setIsStartingImport] = useState(false);
  const [scraperOnline, setScraperOnline] = useState<boolean | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  // Export state
  const [exportLoading, setExportLoading] = useState<string | null>(null);

  // Config state
  const [editingConfig, setEditingConfig] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [configForm, setConfigForm] = useState({
    dgesBaseUrl: '',
    dgesEnabled: true,
    eduportugalBaseUrl: '',
    eduportugalEnabled: true,
  });

  // URL Update state
  const [urlUpdateInput, setUrlUpdateInput] = useState('');
  const [urlUpdateType, setUrlUpdateType] = useState<'university' | 'course'>('university');
  const [urlUpdateLoading, setUrlUpdateLoading] = useState(false);
  const [urlUpdateResult, setUrlUpdateResult] = useState<UrlUpdateResult | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('import');
      setIsStartingImport(false);
      setUrlUpdateResult(null);
      checkScraperHealth();

      // Load config form values
      if (scraperConfig) {
        setConfigForm({
          dgesBaseUrl: scraperConfig.dges.baseUrl,
          dgesEnabled: scraperConfig.dges.enabled,
          eduportugalBaseUrl: scraperConfig.eduportugal.baseUrl,
          eduportugalEnabled: scraperConfig.eduportugal.enabled,
        });
      }
    }
  }, [isOpen, scraperConfig]);

  // Check if scraper is online
  const checkScraperHealth = async () => {
    setCheckingHealth(true);
    try {
      const response = await fetch('/api/admin/finduniversity/health');
      const data = await response.json();
      setScraperOnline(data.online === true);
    } catch {
      setScraperOnline(false);
    } finally {
      setCheckingHealth(false);
    }
  };

  // Start import
  const startImport = async (syncType: 'universities' | 'courses' | 'full') => {
    if (!scraperOnline) {
      showError('Scraper Python nao esta disponivel. Inicie com: docker-compose up -d');
      return;
    }

    setIsStartingImport(true);

    try {
      const response = await fetchWithCSRF('/api/admin/finduniversity/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType, source: importSource }),
      });

      const data = await response.json();

      if (!data.success) {
        showError(data.error || 'Falha ao iniciar importacao');
        setIsStartingImport(false);
        return;
      }

      // Success - close modal and notify parent
      showSuccess(`Importacao de ${syncType} iniciada em background`);
      onImportStarted(data.syncId, importSource, syncType);
      onClose();

    } catch (err) {
      console.error('Import error:', err);
      showError('Erro ao iniciar importacao');
      setIsStartingImport(false);
    }
  };

  // Export
  const handleExport = async (type: 'courses' | 'universities', format: 'json' | 'csv') => {
    const key = `${type}-${format}`;
    setExportLoading(key);

    try {
      const url = `/api/${type}/export?format=${format}&all=true`;
      const response = await fetch(url);

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${type}-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      showSuccess(`${type} exportado com sucesso`);
    } catch (err) {
      console.error('Export failed:', err);
      showError('Falha ao exportar');
    } finally {
      setExportLoading(null);
    }
  };

  // Save config
  const saveConfig = async () => {
    setConfigLoading(true);
    try {
      const response = await fetchWithCSRF('/api/admin/finduniversity/scraper-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dges: {
            baseUrl: configForm.dgesBaseUrl,
            enabled: configForm.dgesEnabled,
          },
          eduportugal: {
            baseUrl: configForm.eduportugalBaseUrl,
            enabled: configForm.eduportugalEnabled,
          },
        }),
      });
      const data = await response.json();
      if (data.success) {
        onConfigSaved(data.config);
        setEditingConfig(false);
        showSuccess('Configuracao salva com sucesso!');
      } else {
        showError(data.error || 'Falha ao salvar configuracao');
      }
    } catch (err) {
      console.error('Failed to save scraper config:', err);
      showError('Erro ao salvar configuracao');
    } finally {
      setConfigLoading(false);
    }
  };

  // URL Update
  const handleUrlUpdate = async () => {
    if (!urlUpdateInput.trim()) {
      showWarning('Por favor, insira uma URL valida');
      return;
    }

    setUrlUpdateLoading(true);
    setUrlUpdateResult(null);

    try {
      const response = await fetchWithCSRF('/api/admin/finduniversity/url-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlUpdateInput.trim(),
          type: urlUpdateType,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUrlUpdateResult(data.result);
        showSuccess(`Atualizado: ${data.result.name} (${data.result.fieldsUpdated} campos)`);
      } else {
        showError(data.error || 'Falha ao atualizar dados');
      }
    } catch (err) {
      console.error('URL update error:', err);
      showError('Erro ao atualizar dados pela URL');
    } finally {
      setUrlUpdateLoading(false);
    }
  };

  if (!isOpen) return null;

  const sourceName = importSource === 'dges' ? 'DGES (Oficial)' : 'EduPortugal';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold">Gestao de Dados</h2>
          <button
            onClick={onClose}
            disabled={isStartingImport}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-zinc-200 dark:border-zinc-700">
          <nav className="flex px-4">
            {[
              { id: 'import', label: 'Importar' },
              { id: 'export', label: 'Exportar' },
              { id: 'config', label: 'Configuracao' },
              { id: 'url-update', label: 'URL Update' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ModalTab)}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Import Tab */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              {/* Scraper Status */}
              <div className={`p-3 rounded-lg ${
                scraperOnline === null ? 'bg-zinc-100 dark:bg-zinc-900' :
                scraperOnline ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {checkingHealth ? (
                      <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                    ) : (
                      <span className={`w-3 h-3 rounded-full ${
                        scraperOnline === null ? 'bg-zinc-400' :
                        scraperOnline ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                    )}
                    <span className="text-sm font-medium">
                      Scraper Python: {
                        checkingHealth ? 'Verificando...' :
                        scraperOnline === null ? 'Desconhecido' :
                        scraperOnline ? 'Online' : 'Offline'
                      }
                    </span>
                  </div>
                  <button
                    onClick={checkScraperHealth}
                    disabled={checkingHealth}
                    className="text-xs text-blue-500 hover:text-blue-600 disabled:opacity-50"
                  >
                    Verificar
                  </button>
                </div>
                {scraperOnline === false && (
                  <p className="text-xs text-red-600 mt-2">
                    Execute: <code className="bg-red-100 px-1 rounded">cd job-scraper && docker-compose up -d</code>
                  </p>
                )}
              </div>

              {/* Source Selection */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-zinc-600 dark:text-zinc-400">Fonte de Dados</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setImportSource('dges')}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      importSource === 'dges'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    <div className="font-semibold">DGES</div>
                    <div className="text-xs text-zinc-500">Fonte Oficial do Governo</div>
                  </button>
                  <button
                    onClick={() => setImportSource('eduportugal')}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      importSource === 'eduportugal'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    <div className="font-semibold">EduPortugal</div>
                    <div className="text-xs text-zinc-500">Agregador de Cursos</div>
                  </button>
                </div>
              </div>

              {/* Import Actions */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-zinc-600 dark:text-zinc-400">Iniciar Importacao</h3>
                <p className="text-xs text-zinc-500 mb-3">
                  A importacao sera executada em background. Pode fechar este modal e acompanhar o progresso na pagina principal.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => startImport('universities')}
                    disabled={isStartingImport || !scraperOnline}
                    className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    {isStartingImport ? 'Iniciando...' : 'Importar Universidades'}
                  </button>
                  <button
                    onClick={() => startImport('courses')}
                    disabled={isStartingImport || !scraperOnline}
                    className="px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 disabled:opacity-50"
                  >
                    {isStartingImport ? 'Iniciando...' : 'Importar Cursos'}
                  </button>
                  <button
                    onClick={() => startImport('full')}
                    disabled={isStartingImport || !scraperOnline}
                    className="px-4 py-2 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600 disabled:opacity-50"
                  >
                    {isStartingImport ? 'Iniciando...' : 'Importar Tudo'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Export Tab */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-3 text-zinc-600 dark:text-zinc-400">Exportar Universidades</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExport('universities', 'json')}
                    disabled={exportLoading !== null}
                    className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    {exportLoading === 'universities-json' ? 'Exportando...' : 'JSON'}
                  </button>
                  <button
                    onClick={() => handleExport('universities', 'csv')}
                    disabled={exportLoading !== null}
                    className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    {exportLoading === 'universities-csv' ? 'Exportando...' : 'CSV'}
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3 text-zinc-600 dark:text-zinc-400">Exportar Cursos</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExport('courses', 'json')}
                    disabled={exportLoading !== null}
                    className="px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 disabled:opacity-50"
                  >
                    {exportLoading === 'courses-json' ? 'Exportando...' : 'JSON'}
                  </button>
                  <button
                    onClick={() => handleExport('courses', 'csv')}
                    disabled={exportLoading !== null}
                    className="px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 disabled:opacity-50"
                  >
                    {exportLoading === 'courses-csv' ? 'Exportando...' : 'CSV'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Config Tab */}
          {activeTab === 'config' && (
            <div className="space-y-4">
              {!editingConfig ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">Configuracao do Scraper</h3>
                    <button
                      onClick={() => setEditingConfig(true)}
                      className="text-xs text-blue-500 hover:text-blue-600"
                    >
                      Editar
                    </button>
                  </div>

                  {scraperConfig ? (
                    <div className="space-y-3">
                      <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-2 h-2 rounded-full ${scraperConfig.dges.enabled ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="font-medium text-sm">DGES (Oficial)</span>
                        </div>
                        <p className="text-xs text-zinc-500">{scraperConfig.dges.baseUrl}</p>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-2 h-2 rounded-full ${scraperConfig.eduportugal.enabled ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="font-medium text-sm">EduPortugal</span>
                        </div>
                        <p className="text-xs text-zinc-500">{scraperConfig.eduportugal.baseUrl}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">Carregando configuracao...</p>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  {/* DGES Config */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id="dgesEnabled"
                        checked={configForm.dgesEnabled}
                        onChange={(e) => setConfigForm({ ...configForm, dgesEnabled: e.target.checked })}
                        className="rounded"
                      />
                      <label htmlFor="dgesEnabled" className="text-sm font-medium">DGES (Oficial)</label>
                    </div>
                    <input
                      type="url"
                      value={configForm.dgesBaseUrl}
                      onChange={(e) => setConfigForm({ ...configForm, dgesBaseUrl: e.target.value })}
                      placeholder="https://www.dges.gov.pt"
                      className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-zinc-900 dark:border-zinc-700"
                    />
                  </div>

                  {/* EduPortugal Config */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id="eduportugalEnabled"
                        checked={configForm.eduportugalEnabled}
                        onChange={(e) => setConfigForm({ ...configForm, eduportugalEnabled: e.target.checked })}
                        className="rounded"
                      />
                      <label htmlFor="eduportugalEnabled" className="text-sm font-medium">EduPortugal</label>
                    </div>
                    <input
                      type="url"
                      value={configForm.eduportugalBaseUrl}
                      onChange={(e) => setConfigForm({ ...configForm, eduportugalBaseUrl: e.target.value })}
                      placeholder="https://eduportugal.eu"
                      className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-zinc-900 dark:border-zinc-700"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={saveConfig}
                      disabled={configLoading}
                      className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50"
                    >
                      {configLoading ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingConfig(false);
                        if (scraperConfig) {
                          setConfigForm({
                            dgesBaseUrl: scraperConfig.dges.baseUrl,
                            dgesEnabled: scraperConfig.dges.enabled,
                            eduportugalBaseUrl: scraperConfig.eduportugal.baseUrl,
                            eduportugalEnabled: scraperConfig.eduportugal.enabled,
                          });
                        }
                      }}
                      className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-sm rounded-lg hover:bg-zinc-300"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* URL Update Tab */}
          {activeTab === 'url-update' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-2 text-zinc-600 dark:text-zinc-400">Atualizar via URL</h3>
                <p className="text-xs text-zinc-500 mb-4">
                  Passe a URL de uma universidade ou curso para extrair e atualizar os dados automaticamente.
                </p>
              </div>

              <div className="flex gap-2">
                <select
                  value={urlUpdateType}
                  onChange={(e) => setUrlUpdateType(e.target.value as 'university' | 'course')}
                  className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900"
                >
                  <option value="university">Universidade</option>
                  <option value="course">Curso</option>
                </select>
                <input
                  type="url"
                  value={urlUpdateInput}
                  onChange={(e) => setUrlUpdateInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlUpdate()}
                  placeholder="https://universidade.pt/..."
                  className="flex-1 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900"
                />
                <button
                  onClick={handleUrlUpdate}
                  disabled={urlUpdateLoading || !urlUpdateInput.trim()}
                  className="px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {urlUpdateLoading ? 'Processando...' : 'Atualizar'}
                </button>
              </div>

              {urlUpdateResult && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      {urlUpdateResult.type === 'university' ? 'Universidade' : 'Curso'}: {urlUpdateResult.name}
                    </p>
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                      {urlUpdateResult.fieldsUpdated} campos atualizados
                    </span>
                  </div>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-zinc-500 hover:text-zinc-700">Ver dados</summary>
                    <pre className="mt-2 p-2 bg-white dark:bg-zinc-800 rounded overflow-auto max-h-40 text-[10px]">
                      {JSON.stringify(urlUpdateResult.data, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end">
          <button
            onClick={onClose}
            disabled={isStartingImport}
            className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg hover:bg-zinc-300 text-sm disabled:opacity-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
