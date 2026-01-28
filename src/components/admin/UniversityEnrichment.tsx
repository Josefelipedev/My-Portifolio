'use client';

import React, { useState } from 'react';
import { fetchWithCSRF } from '@/lib/csrf-client';

interface University {
  id: string;
  name: string;
  shortName: string | null;
  website: string | null;
  logoUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  facebookUrl?: string | null;
  twitterUrl?: string | null;
  youtubeUrl?: string | null;
  enrichedAt?: string | null;
}

interface EnrichmentResult {
  logo_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  facebook_url: string | null;
  twitter_url: string | null;
  youtube_url: string | null;
  email: string | null;
  phone: string | null;
  description: string | null;
  tokens_used: number;
  ai_used: boolean;
  error: string | null;
}

interface UniversityEnrichmentProps {
  universities: University[];
  onEnrichComplete?: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const SCRAPER_URL = process.env.NEXT_PUBLIC_SCRAPER_URL || 'http://localhost:8000';

export default function UniversityEnrichment({
  universities,
  onEnrichComplete,
  showToast,
}: UniversityEnrichmentProps) {
  const [searchName, setSearchName] = useState('');
  const [searchResult, setSearchResult] = useState<EnrichmentResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [enrichmentResults, setEnrichmentResults] = useState<Map<string, EnrichmentResult>>(new Map());

  // Filter universities that need enrichment (no logo or no social media)
  const universitiesNeedingEnrichment = universities.filter(
    (u) => !u.logoUrl || (!u.instagramUrl && !u.linkedinUrl && !u.facebookUrl)
  );

  const handleSearchEnrich = async () => {
    if (!searchName.trim()) {
      showToast('Insere o nome da universidade', 'error');
      return;
    }

    setSearchLoading(true);
    setSearchResult(null);

    try {
      const response = await fetch(
        `${SCRAPER_URL}/enrich/search?university_name=${encodeURIComponent(searchName.trim())}`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erro na busca');
      }

      const data = await response.json();
      setSearchResult(data.data);

      if (data.data.error) {
        showToast(`Erro: ${data.data.error}`, 'error');
      } else {
        showToast('Dados encontrados com sucesso!', 'success');
      }
    } catch (error) {
      showToast(`Erro: ${error instanceof Error ? error.message : 'Falha na busca'}`, 'error');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleEnrichSingle = async (university: University) => {
    try {
      const url = university.website
        ? `${SCRAPER_URL}/enrich/university?website_url=${encodeURIComponent(university.website)}`
        : `${SCRAPER_URL}/enrich/search?university_name=${encodeURIComponent(university.name)}`;

      const response = await fetch(url, { method: 'POST' });

      if (!response.ok) {
        throw new Error('Falha no enriquecimento');
      }

      const data = await response.json();
      const result = data.data || data;

      if (result.error) {
        showToast(`${university.name}: ${result.error}`, 'error');
        return null;
      }

      // Save to database
      await saveEnrichment(university.id, result);
      showToast(`${university.name} enriquecida!`, 'success');

      return result;
    } catch (error) {
      showToast(`Erro: ${error instanceof Error ? error.message : 'Falha'}`, 'error');
      return null;
    }
  };

  const handleBatchEnrich = async () => {
    const toEnrich = universities.filter((u) => selectedIds.has(u.id));
    if (toEnrich.length === 0) {
      showToast('Seleciona universidades para enriquecer', 'error');
      return;
    }

    setBatchLoading(true);
    setBatchProgress({ current: 0, total: toEnrich.length });
    const results = new Map<string, EnrichmentResult>();

    for (let i = 0; i < toEnrich.length; i++) {
      const uni = toEnrich[i];
      setBatchProgress({ current: i + 1, total: toEnrich.length });

      const result = await handleEnrichSingle(uni);
      if (result) {
        results.set(uni.id, result);
      }

      // Rate limiting - 2s between requests
      if (i < toEnrich.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    setEnrichmentResults(results);
    setBatchLoading(false);
    setSelectedIds(new Set());

    showToast(
      `Enriquecidas ${results.size} de ${toEnrich.length} universidades`,
      results.size > 0 ? 'success' : 'error'
    );
    onEnrichComplete?.();
  };

  const saveEnrichment = async (universityId: string, data: EnrichmentResult) => {
    try {
      await fetchWithCSRF(`/api/universities/${universityId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          logoUrl: data.logo_url,
          instagramUrl: data.instagram_url,
          linkedinUrl: data.linkedin_url,
          facebookUrl: data.facebook_url,
          twitterUrl: data.twitter_url,
          youtubeUrl: data.youtube_url,
          email: data.email,
          phone: data.phone,
          enrichedAt: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Failed to save enrichment:', error);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === universitiesNeedingEnrichment.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(universitiesNeedingEnrichment.map((u) => u.id)));
    }
  };

  const SocialIcon = ({ platform, url }: { platform: string; url: string | null }) => {
    if (!url) return null;
    const icons: Record<string, string> = {
      instagram: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z',
      linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z',
      facebook: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
      twitter: 'M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z',
      youtube: 'M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z',
    };

    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
      >
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" viewBox="0 0 24 24" fill="currentColor">
          <path d={icons[platform] || ''} />
        </svg>
      </a>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Enriquecimento de Universidades
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Busca automatica de logos, redes sociais e contactos via Google
        </p>
      </div>

      {/* Search by Name */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">
          Buscar por Nome (Google Search)
        </h4>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="Ex: IPMAIA, Universidade do Porto..."
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            onKeyDown={(e) => e.key === 'Enter' && handleSearchEnrich()}
          />
          <button
            onClick={handleSearchEnrich}
            disabled={searchLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {searchLoading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            Buscar
          </button>
        </div>

        {/* Search Result */}
        {searchResult && !searchResult.error && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-start gap-4">
              {searchResult.logo_url && (
                <img
                  src={searchResult.logo_url}
                  alt="Logo"
                  className="w-16 h-16 object-contain rounded"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <SocialIcon platform="instagram" url={searchResult.instagram_url} />
                  <SocialIcon platform="linkedin" url={searchResult.linkedin_url} />
                  <SocialIcon platform="facebook" url={searchResult.facebook_url} />
                  <SocialIcon platform="twitter" url={searchResult.twitter_url} />
                  <SocialIcon platform="youtube" url={searchResult.youtube_url} />
                </div>
                {searchResult.email && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Email: {searchResult.email}
                  </p>
                )}
                {searchResult.phone && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Telefone: {searchResult.phone}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {searchResult.ai_used ? 'Extraido com AI' : 'Extraido via HTML'} |{' '}
                  {searchResult.tokens_used} tokens
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Batch Enrichment */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">
              Enriquecimento em Lote
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {universitiesNeedingEnrichment.length} universidades sem dados completos
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {selectedIds.size === universitiesNeedingEnrichment.length
                ? 'Desselecionar'
                : 'Selecionar Todos'}
            </button>
            <button
              onClick={handleBatchEnrich}
              disabled={batchLoading || selectedIds.size === 0}
              className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {batchLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {batchProgress.current}/{batchProgress.total}
                </>
              ) : (
                `Enriquecer (${selectedIds.size})`
              )}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {batchLoading && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all"
                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Universities List */}
        <div className="max-h-80 overflow-y-auto space-y-2">
          {universitiesNeedingEnrichment.slice(0, 50).map((uni) => (
            <div
              key={uni.id}
              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                selectedIds.has(uni.id)
                  ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                  : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
              onClick={() => toggleSelect(uni.id)}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(uni.id)}
                  onChange={() => toggleSelect(uni.id)}
                  className="w-4 h-4 rounded"
                />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{uni.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {uni.website || 'Sem website'} |{' '}
                    {!uni.logoUrl && <span className="text-orange-500">Sem logo</span>}
                    {!uni.instagramUrl && !uni.linkedinUrl && !uni.facebookUrl && (
                      <span className="text-orange-500 ml-1">Sem redes sociais</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEnrichSingle(uni);
                }}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Enriquecer
              </button>
            </div>
          ))}
          {universitiesNeedingEnrichment.length > 50 && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">
              Mostrando 50 de {universitiesNeedingEnrichment.length} universidades
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
