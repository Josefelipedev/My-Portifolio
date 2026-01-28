'use client';

import React, { useState, useEffect } from 'react';
import { fetchWithCSRF } from '@/lib/csrf-client';

// Types
interface ExtractedUniversity {
  code: string;
  name: string;
  type: string;
  region?: string;
  city?: string;
  website?: string;
}

interface ExtractedCourse {
  code: string;
  name: string;
  level: string;
  university_code?: string;
  university_name?: string;
  duration?: string;
}

interface ComparisonResult {
  id: string;
  external_id?: string;
  name: string;
  status: 'new' | 'existing' | 'updated';
  changes?: Record<string, unknown>;
}

interface ExtractionResult {
  extracted: {
    universities: ExtractedUniversity[];
    courses: ExtractedCourse[];
  };
  comparison: {
    universities: {
      new: ComparisonResult[];
      existing: ComparisonResult[];
      updated: ComparisonResult[];
    };
    courses: {
      new: ComparisonResult[];
      existing: ComparisonResult[];
      updated: ComparisonResult[];
    };
  };
  stats: {
    tokens_used: number;
    model_used: string;
    extraction_time_ms: number;
  };
}

interface DGESManualUploadProps {
  onSuccess?: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

// Use Next.js API route as proxy to avoid CORS issues
const EXTRACT_API_URL = '/api/admin/finduniversity/manual-extract';

export default function DGESManualUpload({ onSuccess, showToast }: DGESManualUploadProps) {
  const [contentType, setContentType] = useState<'text' | 'html' | 'url'>('html');
  const [content, setContent] = useState('');
  const [extractionMode, setExtractionMode] = useState<'universities' | 'courses' | 'mixed'>('mixed');
  const [region, setRegion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [scraperOnline, setScraperOnline] = useState<boolean | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  // Check scraper health on mount and periodically
  useEffect(() => {
    checkScraperHealth();
  }, []);

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

  const handleExtract = async () => {
    if (!content.trim()) {
      showToast('Por favor, insere o conteudo para extrair', 'error');
      return;
    }

    // Check if scraper is online
    if (scraperOnline === false) {
      showToast('Scraper Python nao esta disponivel. Execute: cd job-scraper && docker-compose up -d', 'error');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(EXTRACT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content_type: contentType,
          content: content.trim(),
          extraction_mode: extractionMode,
          region: region || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erro na extracao');
      }

      const data = await response.json();
      setResult(data);
      showToast(
        `Extraido: ${data.extracted.universities.length} universidades, ${data.extracted.courses.length} cursos`,
        'success'
      );
    } catch (error) {
      showToast(`Erro: ${error instanceof Error ? error.message : 'Falha na extracao'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (!result) return;

    setSaving(true);
    try {
      // Salva apenas os items novos
      const newUniversities = result.comparison.universities.new;
      const newCourses = result.comparison.courses.new;

      if (newUniversities.length === 0 && newCourses.length === 0) {
        showToast('Nenhum item novo para guardar', 'error');
        return;
      }

      // Chama API para guardar
      const response = await fetchWithCSRF('/api/admin/finduniversity/sync', {
        method: 'POST',
        body: JSON.stringify({
          type: 'manual',
          universities: result.extracted.universities.filter((u) =>
            newUniversities.some((n) => n.name === u.name)
          ),
          courses: result.extracted.courses.filter((c) =>
            newCourses.some((n) => n.name === c.name)
          ),
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao guardar');
      }

      showToast(
        `Guardado: ${newUniversities.length} universidades, ${newCourses.length} cursos`,
        'success'
      );
      onSuccess?.();
      setResult(null);
      setContent('');
    } catch (error) {
      showToast(`Erro ao guardar: ${error instanceof Error ? error.message : 'Erro'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: 'new' | 'existing' | 'updated') => {
    const styles = {
      new: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      existing: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      updated: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    };
    const labels = { new: 'Novo', existing: 'Existente', updated: 'Atualizado' };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Upload Manual DGES
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Cola HTML, texto ou URL para extrair dados de universidades e cursos
          </p>
        </div>
      </div>

      {/* Scraper Status */}
      <div className={`p-3 rounded-lg ${
        scraperOnline === null ? 'bg-gray-100 dark:bg-gray-700' :
        scraperOnline ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {checkingHealth ? (
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
            ) : (
              <span className={`w-3 h-3 rounded-full ${
                scraperOnline === null ? 'bg-gray-400' :
                scraperOnline ? 'bg-green-500' : 'bg-red-500'
              }`} />
            )}
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
          <p className="text-xs text-red-600 dark:text-red-400 mt-2">
            Execute: <code className="bg-red-100 dark:bg-red-900/50 px-1 rounded">cd job-scraper && docker-compose up -d</code>
          </p>
        )}
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        {/* Content Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tipo de Conteudo
          </label>
          <div className="flex gap-2">
            {(['html', 'text', 'url'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setContentType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  contentType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {type.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Extraction Mode */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Modo de Extracao
          </label>
          <div className="flex gap-2">
            {(['mixed', 'universities', 'courses'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setExtractionMode(mode)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  extractionMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {mode === 'mixed' ? 'Ambos' : mode === 'universities' ? 'Universidades' : 'Cursos'}
              </button>
            ))}
          </div>
        </div>

        {/* Region (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Regiao (opcional)
          </label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Todas as regioes</option>
            <option value="Lisboa">Lisboa</option>
            <option value="Centro">Centro</option>
            <option value="Norte">Norte</option>
            <option value="Alentejo">Alentejo</option>
            <option value="Algarve">Algarve</option>
            <option value="Acores">Acores</option>
            <option value="Madeira">Madeira</option>
          </select>
        </div>

        {/* Content Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {contentType === 'url' ? 'URL para extrair' : 'Conteudo'}
          </label>
          {contentType === 'url' ? (
            <input
              type="url"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="https://www.dges.gov.pt/..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              placeholder={
                contentType === 'html'
                  ? 'Cola o HTML da pagina aqui...'
                  : 'Cola o texto com informacoes de universidades/cursos...'
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
            />
          )}
        </div>

        {/* Extract Button */}
        <button
          onClick={handleExtract}
          disabled={loading || !content.trim()}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              A extrair...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Extrair Dados
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900 dark:text-white">Resultados da Extracao</h4>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {result.stats.tokens_used} tokens | {result.stats.extraction_time_ms}ms
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {result.comparison.universities.new.length + result.comparison.courses.new.length}
              </div>
              <div className="text-sm text-green-700 dark:text-green-300">Novos</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              <div className="text-2xl font-bold text-gray-600 dark:text-gray-300">
                {result.comparison.universities.existing.length + result.comparison.courses.existing.length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Existentes</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {result.comparison.universities.updated.length + result.comparison.courses.updated.length}
              </div>
              <div className="text-sm text-yellow-700 dark:text-yellow-300">Atualizados</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {result.extracted.universities.length + result.extracted.courses.length}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">Total</div>
            </div>
          </div>

          {/* Universities List */}
          {result.extracted.universities.length > 0 && (
            <div>
              <h5 className="font-medium text-gray-900 dark:text-white mb-2">
                Universidades ({result.extracted.universities.length})
              </h5>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {result.extracted.universities.map((uni, idx) => {
                  const status =
                    result.comparison.universities.new.find((u) => u.name === uni.name)
                      ? 'new'
                      : result.comparison.universities.updated.find((u) => u.name === uni.name)
                      ? 'updated'
                      : 'existing';
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                    >
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{uni.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {uni.city || uni.region || 'Sem localizacao'} | {uni.type}
                        </div>
                      </div>
                      {getStatusBadge(status)}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Courses List */}
          {result.extracted.courses.length > 0 && (
            <div>
              <h5 className="font-medium text-gray-900 dark:text-white mb-2">
                Cursos ({result.extracted.courses.length})
              </h5>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {result.extracted.courses.map((course, idx) => {
                  const status =
                    result.comparison.courses.new.find((c) => c.name === course.name)
                      ? 'new'
                      : result.comparison.courses.updated.find((c) => c.name === course.name)
                      ? 'updated'
                      : 'existing';
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                    >
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{course.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {course.level} | {course.university_name || 'Sem universidade'}
                        </div>
                      </div>
                      {getStatusBadge(status)}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Save Button */}
          {(result.comparison.universities.new.length > 0 ||
            result.comparison.courses.new.length > 0) && (
            <button
              onClick={handleSaveToDatabase}
              disabled={saving}
              className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  A guardar...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Guardar {result.comparison.universities.new.length + result.comparison.courses.new.length} Novos Items
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
