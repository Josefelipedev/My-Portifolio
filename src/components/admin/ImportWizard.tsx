'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { fetchWithCSRF } from '@/lib/csrf-client';
import { useToast } from '@/components/ui/Toast';

type ImportStep = 'source' | 'universities' | 'courses' | 'complete';
type ImportSource = 'dges' | 'eduportugal';

interface SyncProgress {
  id: string;
  status: string;
  universitiesFound: number;
  universitiesCreated: number;
  universitiesUpdated: number;
  coursesFound: number;
  coursesCreated: number;
  coursesUpdated: number;
}

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function ImportWizard({ isOpen, onClose, onComplete }: ImportWizardProps) {
  const { showSuccess, showError } = useToast();

  const [step, setStep] = useState<ImportStep>('source');
  const [source, setSource] = useState<ImportSource>('dges');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [universitiesResult, setUniversitiesResult] = useState<SyncProgress | null>(null);
  const [coursesResult, setCoursesResult] = useState<SyncProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset state when wizard opens
  useEffect(() => {
    if (isOpen) {
      setStep('source');
      setSource('dges');
      setIsImporting(false);
      setProgress(null);
      setUniversitiesResult(null);
      setCoursesResult(null);
      setError(null);
    }
  }, [isOpen]);

  // Poll for import status
  const checkStatus = useCallback(async (syncId: string) => {
    try {
      const response = await fetch(`/api/admin/finduniversity/status?syncId=${syncId}`);
      if (response.ok) {
        const data = await response.json();
        setProgress(data);
        return data;
      }
    } catch (err) {
      console.error('Failed to check status:', err);
    }
    return null;
  }, []);

  // Start import for a specific type
  const startImport = async (syncType: 'universities' | 'courses') => {
    setIsImporting(true);
    setError(null);
    setProgress(null);

    try {
      const response = await fetchWithCSRF('/api/admin/finduniversity/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType, source }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to start import');
        setIsImporting(false);
        return;
      }

      const syncId = data.syncId;

      // Poll for completion
      const pollInterval = setInterval(async () => {
        const status = await checkStatus(syncId);
        if (status && status.status !== 'running') {
          clearInterval(pollInterval);
          setIsImporting(false);

          if (status.status === 'completed') {
            if (syncType === 'universities') {
              setUniversitiesResult(status);
              showSuccess(`${status.universitiesCreated + status.universitiesUpdated} universities imported`);
            } else {
              setCoursesResult(status);
              showSuccess(`${status.coursesCreated + status.coursesUpdated} courses imported`);
            }
          } else {
            setError('Import failed');
          }
        }
      }, 3000);

      // Initial status check
      await checkStatus(syncId);

    } catch (err) {
      console.error('Import error:', err);
      setError('Failed to start import');
      setIsImporting(false);
    }
  };

  const handleNext = () => {
    if (step === 'source') {
      setStep('universities');
    } else if (step === 'universities' && universitiesResult) {
      setStep('courses');
    } else if (step === 'courses' && coursesResult) {
      setStep('complete');
    }
  };

  const handleSkip = () => {
    if (step === 'universities') {
      setStep('courses');
    } else if (step === 'courses') {
      setStep('complete');
    }
  };

  const handleComplete = () => {
    onComplete();
    onClose();
  };

  if (!isOpen) return null;

  const sourceName = source === 'dges' ? 'DGES (Oficial)' : 'EduPortugal';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold">Importar Dados</h2>
          <button
            onClick={onClose}
            disabled={isImporting}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between text-sm">
            <div className={`flex items-center gap-2 ${step === 'source' ? 'text-blue-600 font-medium' : 'text-zinc-500'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'source' ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700'}`}>1</span>
              Fonte
            </div>
            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700 mx-2" />
            <div className={`flex items-center gap-2 ${step === 'universities' ? 'text-blue-600 font-medium' : 'text-zinc-500'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'universities' ? 'bg-blue-600 text-white' : universitiesResult ? 'bg-green-500 text-white' : 'bg-zinc-200 dark:bg-zinc-700'}`}>2</span>
              Universidades
            </div>
            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700 mx-2" />
            <div className={`flex items-center gap-2 ${step === 'courses' ? 'text-blue-600 font-medium' : 'text-zinc-500'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'courses' ? 'bg-blue-600 text-white' : coursesResult ? 'bg-green-500 text-white' : 'bg-zinc-200 dark:bg-zinc-700'}`}>3</span>
              Cursos
            </div>
            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700 mx-2" />
            <div className={`flex items-center gap-2 ${step === 'complete' ? 'text-green-600 font-medium' : 'text-zinc-500'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'complete' ? 'bg-green-500 text-white' : 'bg-zinc-200 dark:bg-zinc-700'}`}>4</span>
              Concluido
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Step 1: Source Selection */}
          {step === 'source' && (
            <div>
              <h3 className="text-lg font-medium mb-4">Selecione a fonte de dados</h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setSource('dges')}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    source === 'dges'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                  }`}
                >
                  <div className="font-semibold mb-1">DGES</div>
                  <div className="text-sm text-zinc-500">Fonte Oficial do Governo</div>
                  <div className="text-xs text-zinc-400 mt-2">Dados oficiais do ensino superior portugues</div>
                </button>
                <button
                  onClick={() => setSource('eduportugal')}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    source === 'eduportugal'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                  }`}
                >
                  <div className="font-semibold mb-1">EduPortugal</div>
                  <div className="text-sm text-zinc-500">Agregador de Cursos</div>
                  <div className="text-xs text-zinc-400 mt-2">Portal com informacoes de cursos em Portugal</div>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Universities Import */}
          {step === 'universities' && (
            <div>
              <h3 className="text-lg font-medium mb-4">Importar Universidades</h3>
              <p className="text-sm text-zinc-500 mb-4">
                Primeiro vamos importar as universidades do {sourceName}. Os cursos serao vinculados a elas no proximo passo.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {!universitiesResult && !isImporting && (
                <button
                  onClick={() => startImport('universities')}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Iniciar Importacao de Universidades
                </button>
              )}

              {isImporting && (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
                    <span className="font-medium">Importando universidades...</span>
                  </div>
                  {progress && (
                    <div className="text-sm text-zinc-500">
                      <p>Encontradas: {progress.universitiesFound}</p>
                      <p>Criadas: {progress.universitiesCreated}</p>
                      <p>Atualizadas: {progress.universitiesUpdated}</p>
                    </div>
                  )}
                </div>
              )}

              {universitiesResult && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium mb-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Universidades importadas com sucesso!
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    <p>Total encontradas: {universitiesResult.universitiesFound}</p>
                    <p>Novas: {universitiesResult.universitiesCreated}</p>
                    <p>Atualizadas: {universitiesResult.universitiesUpdated}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Courses Import */}
          {step === 'courses' && (
            <div>
              <h3 className="text-lg font-medium mb-4">Importar Cursos</h3>
              <p className="text-sm text-zinc-500 mb-4">
                Agora vamos importar os cursos do {sourceName}. Eles serao automaticamente vinculados as universidades ja importadas.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {!coursesResult && !isImporting && (
                <button
                  onClick={() => startImport('courses')}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Iniciar Importacao de Cursos
                </button>
              )}

              {isImporting && (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
                    <span className="font-medium">Importando cursos...</span>
                  </div>
                  {progress && (
                    <div className="text-sm text-zinc-500">
                      <p>Encontrados: {progress.coursesFound}</p>
                      <p>Criados: {progress.coursesCreated}</p>
                      <p>Atualizados: {progress.coursesUpdated}</p>
                    </div>
                  )}
                </div>
              )}

              {coursesResult && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium mb-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Cursos importados com sucesso!
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    <p>Total encontrados: {coursesResult.coursesFound}</p>
                    <p>Novos: {coursesResult.coursesCreated}</p>
                    <p>Atualizados: {coursesResult.coursesUpdated}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 'complete' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Importacao Concluida!</h3>
              <p className="text-zinc-500 mb-6">Todos os dados foram importados com sucesso.</p>

              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto text-left">
                {universitiesResult && (
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {universitiesResult.universitiesCreated + universitiesResult.universitiesUpdated}
                    </div>
                    <div className="text-sm text-zinc-500">Universidades</div>
                  </div>
                )}
                {coursesResult && (
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {coursesResult.coursesCreated + coursesResult.coursesUpdated}
                    </div>
                    <div className="text-sm text-zinc-500">Cursos</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-between">
          <div>
            {(step === 'universities' || step === 'courses') && !isImporting && (
              <button
                onClick={handleSkip}
                className="px-4 py-2 text-zinc-600 hover:text-zinc-800 text-sm"
              >
                Pular
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {step !== 'complete' && (
              <button
                onClick={onClose}
                disabled={isImporting}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg hover:bg-zinc-300 text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
            )}
            {step === 'source' && (
              <button
                onClick={handleNext}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
              >
                Proximo
              </button>
            )}
            {step === 'universities' && universitiesResult && (
              <button
                onClick={handleNext}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
              >
                Proximo: Cursos
              </button>
            )}
            {step === 'courses' && coursesResult && (
              <button
                onClick={handleNext}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
              >
                Proximo
              </button>
            )}
            {step === 'complete' && (
              <button
                onClick={handleComplete}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
              >
                Concluir
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
