'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from './AdminLayout';
import { fetchWithCSRF } from '@/lib/csrf-client';

// AI Features Types
interface AISearchResult {
  query: string;
  interpreted: Record<string, unknown>;
  explanation: string;
  totalResults: number;
  courses: Array<{
    id: string;
    name: string;
    level: string;
    area: string | null;
    city: string | null;
    university: { name: string };
  }>;
}

interface AIRecommendation {
  course: {
    id: string;
    name: string;
    level: string;
    area: string | null;
    city: string | null;
    university: { name: string };
  };
  matchScore: number;
  reasons: string[];
}

interface AISummaryStats {
  courses: { withoutDescription: number; total: number };
  universities: { withoutDescription: number; total: number };
}

interface SyncLog {
  id: string;
  syncType: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  universitiesFound: number;
  universitiesCreated: number;
  universitiesUpdated: number;
  coursesFound: number;
  coursesCreated: number;
  coursesUpdated: number;
  errors: string | null;
}

interface University {
  id: string;
  name: string;
  shortName: string | null;
  city: string | null;
  type: string | null;
  website: string | null;
  _count?: { courses: number };
}

interface Course {
  id: string;
  name: string;
  level: string;
  city: string | null;
  sourceUrl?: string;
  officialUrl?: string;
  researchUrl?: string | null;
  universityId?: string;
  university: { id?: string; name: string } | null;
}

interface ScrapedFile {
  filename: string;
  path: string;
  size_bytes: number;
  size_mb: number;
  created_at: string;
}

interface UnlinkedCourse {
  id: string;
  name: string;
  level: string;
  city: string | null;
  sourceUrl: string | null;
  universityId: string;
  university: { id: string; name: string } | null;
}

interface RefreshStats {
  totalCourses: number;
  totalWithUrls: number;
  totalNeedingRefresh: number;
  missingFields: Record<string, number>;
}

interface FindUniversityPageWrapperProps {
  universitiesCount: number;
  coursesCount: number;
  coursesByLevel: Record<string, number>;
  universitiesByCity: Record<string, number>;
  universitiesByType: Record<string, number>;
  latestSync: SyncLog | null;
  runningSync: SyncLog | null;
  recentSyncs: SyncLog[];
  error: string | null;
}

const COURSE_LEVEL_LABELS: Record<string, string> = {
  licenciatura: 'Licenciatura',
  mestrado: 'Mestrado',
  'mestrado-integrado': 'Mestrado Integrado',
  doutorado: 'Doutorado',
  'pos-doutorado': 'Pos-Doutorado',
  mba: 'MBA',
  'pos-graduacao': 'Pos-Graduacao',
  'curso-tecnico': 'Curso Tecnico',
  'b-learning': 'B-Learning',
  'e-learning': 'E-Learning',
  'formacao-executiva': 'Formacao Executiva',
  especializacao: 'Especializacao',
};

export default function FindUniversityPageWrapper({
  universitiesCount: initialUniversitiesCount,
  coursesCount: initialCoursesCount,
  coursesByLevel,
  universitiesByCity,
  latestSync,
  runningSync: initialRunningSync,
  recentSyncs: initialRecentSyncs,
  error,
}: FindUniversityPageWrapperProps) {
  const [universitiesCount, setUniversitiesCount] = useState(initialUniversitiesCount);
  const [coursesCount, setCoursesCount] = useState(initialCoursesCount);
  const [isImporting, setIsImporting] = useState(!!initialRunningSync);
  const [importProgress, setImportProgress] = useState<SyncLog | null>(initialRunningSync);
  const [recentSyncs, setRecentSyncs] = useState<SyncLog[]>(initialRecentSyncs);
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'universities' | 'courses' | 'files' | 'research' | 'ai'>('overview');
  const [universities, setUniversities] = useState<University[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Files State
  const [files, setFiles] = useState<ScrapedFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<unknown>(null);
  const [fileViewLoading, setFileViewLoading] = useState(false);

  // Linking State
  const [showUnlinkedOnly, setShowUnlinkedOnly] = useState(false);
  const [unlinkedCourses, setUnlinkedCourses] = useState<UnlinkedCourse[]>([]);
  const [linkingCourse, setLinkingCourse] = useState<UnlinkedCourse | null>(null);
  const [linkingUniversityId, setLinkingUniversityId] = useState('');
  const [linkingLoading, setLinkingLoading] = useState(false);
  const [allUniversitiesForLink, setAllUniversitiesForLink] = useState<University[]>([]);

  // Refresh State
  const [refreshingCourseId, setRefreshingCourseId] = useState<string | null>(null);
  const [refreshStats, setRefreshStats] = useState<RefreshStats | null>(null);
  const [batchRefreshLoading, setBatchRefreshLoading] = useState(false);
  const [refreshSource, setRefreshSource] = useState<'auto' | 'sourceUrl' | 'officialUrl' | 'researchUrl' | 'custom'>('auto');
  const [customRefreshUrl, setCustomRefreshUrl] = useState('');
  const [batchRefreshResults, setBatchRefreshResults] = useState<{
    refreshed: number;
    failed: number;
    results: Array<{ courseId: string; name: string; fieldsUpdated?: number; confidence?: number; urlUsed?: string }>;
    errors: Array<{ courseId: string; name: string; error: string; urlUsed?: string }>;
    sourceUsed?: string;
  } | null>(null);

  // Research URL State
  const [editingResearchUrl, setEditingResearchUrl] = useState<string | null>(null);
  const [researchUrlInput, setResearchUrlInput] = useState('');
  const [savingResearchUrl, setSavingResearchUrl] = useState(false);

  // Research Tab State
  const [researchUrls, setResearchUrls] = useState<Array<{
    id: string;
    name: string;
    researchUrl: string | null;
    officialUrl: string | null;
    universityName: string | null;
  }>>([]);
  const [researchUrlsLoading, setResearchUrlsLoading] = useState(false);

  // Job Control State
  const [stoppingJob, setStoppingJob] = useState(false);

  // Import Source State
  const [importSource, setImportSource] = useState<'dges' | 'eduportugal'>('dges');

  // AI Features State
  const [aiSearchQuery, setAiSearchQuery] = useState('');
  const [aiSearchResults, setAiSearchResults] = useState<AISearchResult | null>(null);
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const [aiRecommendInterests, setAiRecommendInterests] = useState<string[]>([]);
  const [aiRecommendCity, setAiRecommendCity] = useState('');
  const [aiRecommendLevel, setAiRecommendLevel] = useState('');
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
  const [aiRecommendLoading, setAiRecommendLoading] = useState(false);
  const [aiSummaryStats, setAiSummaryStats] = useState<AISummaryStats | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiCompareIds, setAiCompareIds] = useState<string[]>([]);
  const [aiCompareResult, setAiCompareResult] = useState<Record<string, unknown> | null>(null);
  const [aiCompareLoading, setAiCompareLoading] = useState(false);
  const [newInterest, setNewInterest] = useState('');

  // Poll for import status
  const checkImportStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/finduniversity/status');
      const data = await response.json();

      if (data.runningSync) {
        setImportProgress(data.runningSync);
      } else {
        setIsImporting(false);
        setImportProgress(null);
        // Update counts
        if (data.stats) {
          setUniversitiesCount(data.stats.totalUniversities);
          setCoursesCount(data.stats.totalCourses);
        }
      }

      if (data.recentSyncs) {
        setRecentSyncs(data.recentSyncs);
      }
    } catch (err) {
      console.error('Failed to fetch import status:', err);
    }
  }, []);

  useEffect(() => {
    if (!isImporting) return;
    const interval = setInterval(checkImportStatus, 5000);
    return () => clearInterval(interval);
  }, [isImporting, checkImportStatus]);

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'universities' && universities.length === 0) {
      loadUniversities();
    } else if (activeTab === 'courses' && courses.length === 0) {
      loadCourses();
    } else if (activeTab === 'files' && files.length === 0) {
      loadFiles();
    } else if (activeTab === 'research' && researchUrls.length === 0) {
      loadResearchUrls();
    }
  }, [activeTab]);

  // Load unlinked courses when filter is enabled
  useEffect(() => {
    if (showUnlinkedOnly && unlinkedCourses.length === 0) {
      loadUnlinkedCourses();
    }
  }, [showUnlinkedOnly]);

  const loadUniversities = async () => {
    setLoadingData(true);
    try {
      const response = await fetch('/api/universities?withCourses=true&pageSize=100');
      const data = await response.json();
      setUniversities(data.universities || []);
    } catch (err) {
      console.error('Failed to load universities:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const loadCourses = async () => {
    setLoadingData(true);
    try {
      const response = await fetch('/api/courses/search?pageSize=100');
      const data = await response.json();
      setCourses(data.courses || []);
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      setLoadingData(false);
    }
  };

  // Files functions
  const loadFiles = async () => {
    setFilesLoading(true);
    try {
      const response = await fetch('/api/admin/finduniversity/files');
      const data = await response.json();
      setFiles(data.files || []);
    } catch (err) {
      console.error('Failed to load files:', err);
    } finally {
      setFilesLoading(false);
    }
  };

  const viewFile = async (filename: string) => {
    setSelectedFile(filename);
    setFileViewLoading(true);
    setFileContent(null);
    try {
      const response = await fetch(`/api/admin/finduniversity/files/${encodeURIComponent(filename)}?action=view`);
      if (response.ok) {
        const data = await response.json();
        setFileContent(data);
      } else {
        alert('Failed to load file');
      }
    } catch (err) {
      console.error('Failed to view file:', err);
      alert('Failed to load file');
    } finally {
      setFileViewLoading(false);
    }
  };

  const downloadFile = (filename: string) => {
    const url = `/api/admin/finduniversity/files/${encodeURIComponent(filename)}?action=download`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Linking functions
  const loadUnlinkedCourses = async () => {
    setLoadingData(true);
    try {
      const response = await fetch('/api/admin/finduniversity/unlinked');
      const data = await response.json();
      setUnlinkedCourses(data.unlinkedCourses || []);
      setAllUniversitiesForLink(data.universities || []);
    } catch (err) {
      console.error('Failed to load unlinked courses:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const openLinkingModal = (course: UnlinkedCourse) => {
    setLinkingCourse(course);
    setLinkingUniversityId('');
  };

  const closeLinkingModal = () => {
    setLinkingCourse(null);
    setLinkingUniversityId('');
  };

  const handleLinkCourse = async () => {
    if (!linkingCourse || !linkingUniversityId) return;
    setLinkingLoading(true);
    try {
      const response = await fetchWithCSRF('/api/admin/finduniversity/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: linkingCourse.id,
          universityId: linkingUniversityId,
        }),
      });

      if (response.ok) {
        // Remove from unlinked list
        setUnlinkedCourses(unlinkedCourses.filter(c => c.id !== linkingCourse.id));
        closeLinkingModal();
        // Refresh courses list if loaded
        if (courses.length > 0) {
          loadCourses();
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to link course');
      }
    } catch (err) {
      console.error('Failed to link course:', err);
      alert('Failed to link course');
    } finally {
      setLinkingLoading(false);
    }
  };

  // Refresh functions
  const loadRefreshStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/finduniversity/refresh?limit=10');
      const data = await response.json();
      setRefreshStats(data.stats || null);
    } catch (err) {
      console.error('Failed to load refresh stats:', err);
    }
  }, []);

  useEffect(() => {
    if ((activeTab === 'overview' || activeTab === 'ai') && !refreshStats) {
      loadRefreshStats();
    }
  }, [activeTab, refreshStats, loadRefreshStats]);

  const refreshCourse = async (courseId: string, overrideUrl?: string) => {
    setRefreshingCourseId(courseId);
    try {
      const requestBody: {
        courseId: string;
        useAI: boolean;
        source: typeof refreshSource;
        customUrl?: string;
      } = {
        courseId,
        useAI: true,
        source: overrideUrl ? 'custom' : refreshSource,
      };

      // Use override URL or custom URL from state
      if (overrideUrl) {
        requestBody.customUrl = overrideUrl;
      } else if (refreshSource === 'custom' && customRefreshUrl) {
        requestBody.customUrl = customRefreshUrl;
      }

      const response = await fetchWithCSRF('/api/admin/finduniversity/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Updated ${data.fieldsUpdated} fields (confidence: ${Math.round((data.confidence || 0) * 100)}%)`);
        // Refresh the courses list
        loadCourses();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to refresh course');
      }
    } catch (err) {
      console.error('Failed to refresh course:', err);
      alert('Failed to refresh course');
    } finally {
      setRefreshingCourseId(null);
    }
  };

  // Research URL functions
  const openResearchUrlEditor = (course: Course) => {
    setEditingResearchUrl(course.id);
    setResearchUrlInput(course.researchUrl || '');
  };

  const closeResearchUrlEditor = () => {
    setEditingResearchUrl(null);
    setResearchUrlInput('');
  };

  const saveResearchUrl = async (courseId: string) => {
    setSavingResearchUrl(true);
    try {
      const response = await fetchWithCSRF('/api/admin/finduniversity/research-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'course',
          id: courseId,
          researchUrl: researchUrlInput.trim() || null,
        }),
      });

      if (response.ok) {
        // Update the course in the list
        setCourses(courses.map(c =>
          c.id === courseId ? { ...c, researchUrl: researchUrlInput.trim() || null } : c
        ));
        closeResearchUrlEditor();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save research URL');
      }
    } catch (err) {
      console.error('Failed to save research URL:', err);
      alert('Failed to save research URL');
    } finally {
      setSavingResearchUrl(false);
    }
  };

  // Research URLs functions
  const loadResearchUrls = async () => {
    setResearchUrlsLoading(true);
    try {
      const response = await fetch('/api/admin/finduniversity/research-url?type=course');
      const data = await response.json();
      setResearchUrls(data.courses || []);
    } catch (err) {
      console.error('Failed to load research URLs:', err);
    } finally {
      setResearchUrlsLoading(false);
    }
  };

  const saveResearchUrlForCourse = async (courseId: string, url: string) => {
    try {
      const response = await fetchWithCSRF('/api/admin/finduniversity/research-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'course',
          id: courseId,
          researchUrl: url.trim() || null,
        }),
      });

      if (response.ok) {
        // Update local state
        setResearchUrls(researchUrls.map(c =>
          c.id === courseId ? { ...c, researchUrl: url.trim() || null } : c
        ));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to save research URL:', err);
      return false;
    }
  };

  // Job control functions
  const stopRunningJob = async () => {
    if (!importProgress?.id) return;
    setStoppingJob(true);
    try {
      const response = await fetchWithCSRF('/api/admin/finduniversity/job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stop',
          syncId: importProgress.id,
        }),
      });

      if (response.ok) {
        setIsImporting(false);
        setImportProgress(null);
        checkImportStatus();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to stop job');
      }
    } catch (err) {
      console.error('Failed to stop job:', err);
      alert('Failed to stop job');
    } finally {
      setStoppingJob(false);
    }
  };

  const handleBatchRefresh = async (count: number) => {
    if (!confirm(`Refresh ${count} courses using AI? This will use AI credits.`)) return;
    setBatchRefreshLoading(true);
    setBatchRefreshResults(null);
    try {
      // Get courses needing refresh
      const response = await fetch(`/api/admin/finduniversity/refresh?limit=${count}`);
      const data = await response.json();

      if (!response.ok) {
        setBatchRefreshResults({
          refreshed: 0,
          failed: 1,
          results: [],
          errors: [{ courseId: '', name: 'API Error', error: data.error || 'Failed to fetch courses' }],
        });
        return;
      }

      const courseIds = (data.courses || []).map((c: { id: string }) => c.id).slice(0, count);

      if (courseIds.length === 0) {
        setBatchRefreshResults({
          refreshed: 0,
          failed: 0,
          results: [],
          errors: [{ courseId: '', name: 'Info', error: 'No courses need refresh - all courses have complete data or no URLs' }],
        });
        return;
      }

      // Include source in the request
      const refreshResponse = await fetchWithCSRF('/api/admin/finduniversity/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseIds,
          useAI: true,
          source: refreshSource,
        }),
      });

      const result = await refreshResponse.json();

      if (refreshResponse.ok) {
        setBatchRefreshResults({
          refreshed: result.refreshed || 0,
          failed: result.failed || 0,
          results: result.results || [],
          errors: result.errors || [],
        });
        loadRefreshStats();
      } else {
        setBatchRefreshResults({
          refreshed: 0,
          failed: 1,
          results: [],
          errors: [{ courseId: '', name: 'API Error', error: result.error || 'Batch refresh failed' }],
        });
      }
    } catch (err) {
      console.error('Batch refresh error:', err);
      setBatchRefreshResults({
        refreshed: 0,
        failed: 1,
        results: [],
        errors: [{ courseId: '', name: 'Network Error', error: err instanceof Error ? err.message : 'Batch refresh failed' }],
      });
    } finally {
      setBatchRefreshLoading(false);
    }
  };

  const startImport = async (syncType: string) => {
    const sourceName = importSource === 'dges' ? 'DGES (Oficial)' : 'EduPortugal';
    if (!confirm(`Importar ${syncType === 'full' ? 'universidades e cursos' : syncType} do ${sourceName}?`)) {
      return;
    }

    setIsImporting(true);

    try {
      const response = await fetchWithCSRF('/api/admin/finduniversity/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType, source: importSource }),
      });

      const data = await response.json();

      if (data.success) {
        setImportProgress({
          id: data.syncId,
          syncType,
          status: 'running',
          startedAt: new Date().toISOString(),
          completedAt: null,
          universitiesFound: 0,
          universitiesCreated: 0,
          universitiesUpdated: 0,
          coursesFound: 0,
          coursesCreated: 0,
          coursesUpdated: 0,
          errors: null,
        });
      } else {
        setIsImporting(false);
        alert('Failed to start import: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      setIsImporting(false);
      alert('Failed to start import');
      console.error(err);
    }
  };

  const deleteUniversity = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" and all its courses?`)) return;

    try {
      const response = await fetchWithCSRF(`/api/universities/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setUniversities(universities.filter((u) => u.id !== id));
        setUniversitiesCount((c) => c - 1);
      } else {
        alert('Failed to delete university');
      }
    } catch (err) {
      alert('Failed to delete university');
      console.error(err);
    }
  };

  const deleteCourse = async (id: string, name: string) => {
    if (!confirm(`Delete course "${name}"?`)) return;

    try {
      const response = await fetchWithCSRF(`/api/courses/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setCourses(courses.filter((c) => c.id !== id));
        setCoursesCount((c) => c - 1);
      } else {
        alert('Failed to delete course');
      }
    } catch (err) {
      alert('Failed to delete course');
      console.error(err);
    }
  };

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
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed');
    } finally {
      setExportLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // AI Functions
  const loadAiSummaryStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/finduniversity/ai/summary');
      if (response.ok) {
        const data = await response.json();
        setAiSummaryStats(data);
      }
    } catch (err) {
      console.error('Failed to load AI summary stats:', err);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'ai' && !aiSummaryStats) {
      loadAiSummaryStats();
    }
  }, [activeTab, aiSummaryStats, loadAiSummaryStats]);

  const handleAiSearch = async () => {
    if (!aiSearchQuery.trim()) return;
    setAiSearchLoading(true);
    setAiSearchResults(null);

    try {
      const response = await fetchWithCSRF('/api/admin/finduniversity/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiSearchQuery }),
      });

      if (response.ok) {
        const data = await response.json();
        setAiSearchResults(data);
      } else {
        const error = await response.json();
        alert(error.error || 'Search failed');
      }
    } catch (err) {
      console.error('AI search error:', err);
      alert('Search failed');
    } finally {
      setAiSearchLoading(false);
    }
  };

  const handleAiRecommend = async () => {
    if (aiRecommendInterests.length === 0) {
      alert('Add at least one interest');
      return;
    }
    setAiRecommendLoading(true);
    setAiRecommendations([]);

    try {
      const response = await fetchWithCSRF('/api/admin/finduniversity/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interests: aiRecommendInterests,
          preferences: {
            city: aiRecommendCity || undefined,
            level: aiRecommendLevel || undefined,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAiRecommendations(data.recommendations || []);
      } else {
        const error = await response.json();
        alert(error.error || 'Recommendation failed');
      }
    } catch (err) {
      console.error('AI recommend error:', err);
      alert('Recommendation failed');
    } finally {
      setAiRecommendLoading(false);
    }
  };

  const handleGenerateDescriptions = async (type: 'course' | 'university') => {
    if (!confirm(`Generate descriptions for ${type}s without description?`)) return;
    setAiSummaryLoading(true);

    try {
      const response = await fetchWithCSRF('/api/admin/finduniversity/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, batchMode: true, batchLimit: 5 }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Generated ${data.generated} descriptions`);
        loadAiSummaryStats();
      } else {
        const error = await response.json();
        alert(error.error || 'Generation failed');
      }
    } catch (err) {
      console.error('AI summary error:', err);
      alert('Generation failed');
    } finally {
      setAiSummaryLoading(false);
    }
  };

  const handleAiCompare = async () => {
    if (aiCompareIds.length < 2) {
      alert('Select at least 2 courses to compare');
      return;
    }
    setAiCompareLoading(true);
    setAiCompareResult(null);

    try {
      const response = await fetchWithCSRF('/api/admin/finduniversity/ai/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'courses', ids: aiCompareIds }),
      });

      if (response.ok) {
        const data = await response.json();
        setAiCompareResult(data);
      } else {
        const error = await response.json();
        alert(error.error || 'Comparison failed');
      }
    } catch (err) {
      console.error('AI compare error:', err);
      alert('Comparison failed');
    } finally {
      setAiCompareLoading(false);
    }
  };

  const addInterest = () => {
    if (newInterest.trim() && !aiRecommendInterests.includes(newInterest.trim())) {
      setAiRecommendInterests([...aiRecommendInterests, newInterest.trim()]);
      setNewInterest('');
    }
  };

  const removeInterest = (interest: string) => {
    setAiRecommendInterests(aiRecommendInterests.filter((i) => i !== interest));
  };

  const toggleCourseForCompare = (courseId: string) => {
    if (aiCompareIds.includes(courseId)) {
      setAiCompareIds(aiCompareIds.filter((id) => id !== courseId));
    } else if (aiCompareIds.length < 5) {
      setAiCompareIds([...aiCompareIds, courseId]);
    }
  };

  return (
    <AdminLayout
      title="Universities & Courses"
      subtitle="Manage universities and courses database"
    >
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
          <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
          <p className="text-sm text-red-500 dark:text-red-400 mt-1">
            Run: <code className="bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded">npx prisma db push</code>
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
          <p className="text-3xl font-bold text-blue-500">{universitiesCount}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Universities</p>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
          <p className="text-3xl font-bold text-green-500">{coursesCount}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Courses</p>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
          <p className="text-3xl font-bold text-purple-500">{Object.keys(coursesByLevel).length}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Course Levels</p>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
          <p className="text-3xl font-bold text-amber-500">{Object.keys(universitiesByCity).length}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Cities</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 mb-6">
        <div className="border-b border-zinc-200 dark:border-zinc-700">
          <nav className="flex gap-4 px-4 overflow-x-auto">
            {(['overview', 'universities', 'courses', 'files', 'research', 'ai'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {tab === 'ai' ? 'AI Tools' : tab === 'research' ? 'Research URLs' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Courses by Level */}
              {Object.keys(coursesByLevel).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 text-zinc-600 dark:text-zinc-400">Courses by Level</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(coursesByLevel)
                      .sort(([, a], [, b]) => b - a)
                      .map(([level, count]) => (
                        <div key={level} className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-3">
                          <p className="text-lg font-bold">{count}</p>
                          <p className="text-xs text-zinc-500">{COURSE_LEVEL_LABELS[level] || level}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Export */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-zinc-600 dark:text-zinc-400">Export Data</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleExport('universities', 'json')}
                    disabled={exportLoading !== null}
                    className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50"
                  >
                    {exportLoading === 'universities-json' ? '...' : 'Universities JSON'}
                  </button>
                  <button
                    onClick={() => handleExport('universities', 'csv')}
                    disabled={exportLoading !== null}
                    className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50"
                  >
                    {exportLoading === 'universities-csv' ? '...' : 'Universities CSV'}
                  </button>
                  <button
                    onClick={() => handleExport('courses', 'json')}
                    disabled={exportLoading !== null}
                    className="px-3 py-1.5 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:opacity-50"
                  >
                    {exportLoading === 'courses-json' ? '...' : 'Courses JSON'}
                  </button>
                  <button
                    onClick={() => handleExport('courses', 'csv')}
                    disabled={exportLoading !== null}
                    className="px-3 py-1.5 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:opacity-50"
                  >
                    {exportLoading === 'courses-csv' ? '...' : 'Courses CSV'}
                  </button>
                </div>
              </div>

              {/* Running Job Indicator */}
              {isImporting && importProgress && universitiesCount > 0 && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                      <h3 className="font-semibold text-blue-700 dark:text-blue-400">Job em Execucao</h3>
                    </div>
                    <button
                      onClick={stopRunningJob}
                      disabled={stoppingJob}
                      className="px-3 py-1.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                    >
                      {stoppingJob ? 'Parando...' : 'Parar Job'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-zinc-500 dark:text-zinc-400">Tipo</p>
                      <p className="font-medium">{importProgress.syncType}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 dark:text-zinc-400">Status</p>
                      <p className="font-medium text-blue-600">{importProgress.status}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 dark:text-zinc-400">Universidades</p>
                      <p className="font-medium">{importProgress.universitiesFound} encontradas</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 dark:text-zinc-400">Cursos</p>
                      <p className="font-medium">{importProgress.coursesFound} encontrados</p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">
                    Iniciado em: {formatDate(importProgress.startedAt)}
                  </p>
                </div>
              )}

              {/* Initial Import (one-time) */}
              {universitiesCount === 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <h3 className="font-semibold text-amber-700 dark:text-amber-400 mb-2">Initial Import</h3>
                  <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">
                    Database is empty. Import data from source to get started.
                  </p>

                  {isImporting && importProgress && (
                    <div className="mb-3 p-3 bg-white dark:bg-zinc-800 rounded">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                          <span className="text-sm font-medium">Importing...</span>
                        </div>
                        <button
                          onClick={stopRunningJob}
                          disabled={stoppingJob}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                        >
                          {stoppingJob ? 'Parando...' : 'Parar'}
                        </button>
                      </div>
                      <p className="text-xs text-zinc-500">
                        Universities: {importProgress.universitiesFound} | Courses: {importProgress.coursesFound}
                      </p>
                    </div>
                  )}

                  {/* Source Selector */}
                  <div className="mb-3 p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <label className="text-xs text-zinc-500 block mb-2">Fonte de Dados</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setImportSource('dges')}
                        className={`flex-1 px-3 py-2 text-sm rounded border ${
                          importSource === 'dges'
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50'
                        }`}
                      >
                        <div className="font-medium">DGES</div>
                        <div className="text-xs opacity-80">Fonte Oficial</div>
                      </button>
                      <button
                        onClick={() => setImportSource('eduportugal')}
                        className={`flex-1 px-3 py-2 text-sm rounded border ${
                          importSource === 'eduportugal'
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50'
                        }`}
                      >
                        <div className="font-medium">EduPortugal</div>
                        <div className="text-xs opacity-80">Agregador</div>
                      </button>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">
                      {importSource === 'dges'
                        ? 'DGES: Direção-Geral do Ensino Superior - dados oficiais do governo'
                        : 'EduPortugal: Agregador privado de cursos'}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => startImport('universities')}
                      disabled={isImporting}
                      className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                      Importar Universidades
                    </button>
                    <button
                      onClick={() => startImport('full')}
                      disabled={isImporting}
                      className="px-3 py-1.5 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:opacity-50"
                    >
                      Importar Tudo
                    </button>
                  </div>
                </div>
              )}

              {/* Import History */}
              {recentSyncs.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 text-zinc-600 dark:text-zinc-400">Import History</h3>
                  <div className="space-y-2">
                    {recentSyncs.slice(0, 3).map((sync) => (
                      <div key={sync.id} className="flex items-center justify-between p-2 bg-zinc-50 dark:bg-zinc-900 rounded">
                        <div>
                          <p className="text-sm font-medium">{sync.syncType}</p>
                          <p className="text-xs text-zinc-500">{formatDate(sync.startedAt)}</p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            sync.status === 'completed' ? 'bg-green-100 text-green-700' :
                            sync.status === 'running' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {sync.status}
                          </span>
                          <p className="text-xs text-zinc-500 mt-1">
                            {sync.universitiesFound} unis, {sync.coursesFound} courses
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Batch Refresh */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                <h3 className="text-sm font-semibold mb-3 text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                  <span>🔄</span> Atualizar Dados dos Cursos
                </h3>

                {/* Source Selector */}
                <div className="mb-4 p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <label className="text-xs text-zinc-500 block mb-2">Fonte de Dados</label>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <select
                      value={refreshSource}
                      onChange={(e) => setRefreshSource(e.target.value as typeof refreshSource)}
                      className="px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-900 text-sm"
                    >
                      <option value="auto">Auto (researchUrl, officialUrl ou sourceUrl)</option>
                      <option value="researchUrl">URL de Pesquisa (researchUrl)</option>
                      <option value="sourceUrl">EduPortugal (sourceUrl)</option>
                      <option value="officialUrl">Site Oficial (officialUrl)</option>
                      <option value="custom">URL Customizada</option>
                    </select>
                  </div>
                  {refreshSource === 'custom' && (
                    <div>
                      <input
                        type="url"
                        value={customRefreshUrl}
                        onChange={(e) => setCustomRefreshUrl(e.target.value)}
                        placeholder="https://exemplo.pt/curso/..."
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-900 text-sm"
                      />
                      <p className="text-xs text-zinc-500 mt-1">
                        Cole a URL do site da universidade ou outra fonte
                      </p>
                    </div>
                  )}
                </div>

                {refreshStats ? (
                  <>
                    <div className="text-sm space-y-1 mb-3">
                      <p>Cursos com dados incompletos: <strong>{refreshStats.totalNeedingRefresh}</strong></p>
                      <p>Cursos com URL de origem: <strong>{refreshStats.totalWithUrls}</strong></p>
                      <div className="text-xs text-zinc-500 mt-2">
                        Campos faltando:
                        <span className="ml-2">credits: {refreshStats.missingFields.credits}</span>
                        <span className="ml-2">price: {refreshStats.missingFields.price}</span>
                        <span className="ml-2">duration: {refreshStats.missingFields.duration}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleBatchRefresh(5)}
                        disabled={batchRefreshLoading || refreshStats.totalNeedingRefresh === 0}
                        className="px-3 py-1.5 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:opacity-50"
                      >
                        {batchRefreshLoading ? '...' : 'Atualizar 5 Cursos'}
                      </button>
                      <button
                        onClick={() => handleBatchRefresh(10)}
                        disabled={batchRefreshLoading || refreshStats.totalNeedingRefresh === 0}
                        className="px-3 py-1.5 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:opacity-50"
                      >
                        {batchRefreshLoading ? '...' : 'Atualizar 10 Cursos'}
                      </button>
                      <button
                        onClick={() => setBatchRefreshResults(null)}
                        disabled={!batchRefreshResults}
                        className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-700 text-sm rounded hover:bg-zinc-300 disabled:opacity-50"
                      >
                        Limpar
                      </button>
                    </div>

                    {/* Batch Refresh Results */}
                    {batchRefreshResults && (
                      <div className="mt-4 p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="text-sm font-semibold">Resultados do Refresh</h4>
                            {batchRefreshResults.sourceUsed && (
                              <p className="text-xs text-zinc-500">Fonte: {batchRefreshResults.sourceUsed}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                              {batchRefreshResults.refreshed} OK
                            </span>
                            {batchRefreshResults.failed > 0 && (
                              <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                                {batchRefreshResults.failed} Erros
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Success Results */}
                        {batchRefreshResults.results.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-zinc-500 mb-1">Atualizados:</p>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                              {batchRefreshResults.results.map((r) => (
                                <div key={r.courseId} className="text-xs p-2 bg-green-50 dark:bg-green-900/20 rounded">
                                  <div className="flex justify-between">
                                    <span className="font-medium">{r.name}</span>
                                    <span className="text-green-700">
                                      {r.fieldsUpdated} campos • {Math.round((r.confidence || 0) * 100)}%
                                    </span>
                                  </div>
                                  {r.urlUsed && (
                                    <p className="text-zinc-400 truncate mt-0.5">{r.urlUsed}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Error Results */}
                        {batchRefreshResults.errors.length > 0 && (
                          <div>
                            <p className="text-xs text-zinc-500 mb-1">Erros:</p>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                              {batchRefreshResults.errors.map((e, idx) => (
                                <div key={e.courseId || idx} className="text-xs p-2 bg-red-50 dark:bg-red-900/20 rounded">
                                  <div className="flex justify-between">
                                    <span className="font-medium text-red-700">{e.name}</span>
                                  </div>
                                  <p className="text-red-600 mt-0.5">{e.error}</p>
                                  {e.urlUsed && (
                                    <p className="text-zinc-400 truncate mt-0.5">{e.urlUsed}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-zinc-500">Carregando...</p>
                )}
              </div>
            </div>
          )}

          {/* Universities Tab */}
          {activeTab === 'universities' && (
            <div>
              {loadingData ? (
                <div className="text-center py-8 text-zinc-500">Loading...</div>
              ) : universities.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">No universities yet</div>
              ) : (
                <div className="space-y-2">
                  {universities.map((uni) => (
                    <div key={uni.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                      <div>
                        <p className="font-medium">{uni.name}</p>
                        <p className="text-xs text-zinc-500">
                          {uni.city || 'No city'} {uni.type && `- ${uni.type}`}
                          {uni._count && ` - ${uni._count.courses} courses`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {uni.website && (
                          <a
                            href={uni.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 text-xs bg-zinc-200 dark:bg-zinc-700 rounded hover:bg-zinc-300"
                          >
                            Website
                          </a>
                        )}
                        <button
                          onClick={() => deleteUniversity(uni.id, uni.name)}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Courses Tab */}
          {activeTab === 'courses' && (
            <div>
              {/* Filter Controls */}
              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-zinc-200 dark:border-zinc-700">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showUnlinkedOnly}
                    onChange={(e) => setShowUnlinkedOnly(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-300"
                  />
                  Show Unlinked Only
                </label>
                {showUnlinkedOnly && unlinkedCourses.length > 0 && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {unlinkedCourses.length} courses without university
                  </span>
                )}
              </div>

              {loadingData ? (
                <div className="text-center py-8 text-zinc-500">Loading...</div>
              ) : showUnlinkedOnly ? (
                // Unlinked courses view
                unlinkedCourses.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">No unlinked courses</div>
                ) : (
                  <div className="space-y-2">
                    {unlinkedCourses.map((course) => (
                      <div key={course.id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div>
                          <p className="font-medium">{course.name}</p>
                          <p className="text-xs text-zinc-500">
                            {COURSE_LEVEL_LABELS[course.level] || course.level}
                            {course.city && ` - ${course.city}`}
                          </p>
                          {course.university && (
                            <p className="text-xs text-amber-600">Current: {course.university.name}</p>
                          )}
                        </div>
                        <button
                          onClick={() => openLinkingModal(course)}
                          className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          Link
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : courses.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">No courses yet</div>
              ) : (
                <div className="space-y-2">
                  {courses.map((course) => (
                    <div key={course.id} className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={aiCompareIds.includes(course.id)}
                            onChange={() => toggleCourseForCompare(course.id)}
                            className="w-4 h-4 rounded border-zinc-300"
                            title="Selecionar para comparacao"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{course.name}</p>
                              {!course.university && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded">No Uni</span>
                              )}
                              {course.researchUrl && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded">Research URL</span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500">
                              {course.university?.name || 'No university'} - {COURSE_LEVEL_LABELS[course.level] || course.level}
                              {course.city && ` - ${course.city}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openResearchUrlEditor(course)}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            title="Edit research URL"
                          >
                            URL
                          </button>
                          {(course.sourceUrl || course.officialUrl || course.researchUrl) && (
                            <button
                              onClick={() => refreshCourse(course.id, course.researchUrl || undefined)}
                              disabled={refreshingCourseId === course.id}
                              className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                              title="Refresh from source URL"
                            >
                              {refreshingCourseId === course.id ? '...' : 'Refresh'}
                            </button>
                          )}
                          <button
                            onClick={() => deleteCourse(course.id, course.name)}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Research URL Editor */}
                      {editingResearchUrl === course.id && (
                        <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                          <label className="text-xs text-zinc-500 block mb-1">URL de Pesquisa (site da universidade, PDF, etc.)</label>
                          <div className="flex gap-2">
                            <input
                              type="url"
                              value={researchUrlInput}
                              onChange={(e) => setResearchUrlInput(e.target.value)}
                              placeholder="https://universidade.pt/curso/..."
                              className="flex-1 px-3 py-1.5 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-sm"
                            />
                            <button
                              onClick={() => saveResearchUrl(course.id)}
                              disabled={savingResearchUrl}
                              className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:opacity-50"
                            >
                              {savingResearchUrl ? '...' : 'Salvar'}
                            </button>
                            <button
                              onClick={closeResearchUrlEditor}
                              className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-700 text-xs rounded hover:bg-zinc-300"
                            >
                              Cancelar
                            </button>
                          </div>
                          {course.researchUrl && (
                            <p className="text-xs text-zinc-500 mt-1">
                              Atual: <a href={course.researchUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{course.researchUrl}</a>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Files Tab */}
          {activeTab === 'files' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">Saved JSON Files</h3>
                <button
                  onClick={loadFiles}
                  disabled={filesLoading}
                  className="px-3 py-1.5 text-xs bg-zinc-200 dark:bg-zinc-700 rounded hover:bg-zinc-300 disabled:opacity-50"
                >
                  {filesLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {filesLoading ? (
                <div className="text-center py-8 text-zinc-500">Loading files...</div>
              ) : files.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  No files found. Run a scrape with save_to_file=true to save JSON files.
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div key={file.filename} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{file.filename}</p>
                        <p className="text-xs text-zinc-500">
                          {file.size_mb.toFixed(2)} MB - {formatDate(file.created_at)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => viewFile(file.filename)}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          View
                        </button>
                        <button
                          onClick={() => downloadFile(file.filename)}
                          className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* File Viewer Modal */}
              {selectedFile && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white dark:bg-zinc-800 rounded-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
                      <h3 className="font-semibold">{selectedFile}</h3>
                      <button
                        onClick={() => { setSelectedFile(null); setFileContent(null); }}
                        className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                      >
                        X
                      </button>
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                      {fileViewLoading ? (
                        <div className="text-center py-8 text-zinc-500">Loading...</div>
                      ) : (
                        <pre className="text-xs bg-zinc-50 dark:bg-zinc-900 p-4 rounded overflow-auto">
                          {JSON.stringify(fileContent, null, 2)}
                        </pre>
                      )}
                    </div>
                    <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end gap-2">
                      <button
                        onClick={() => downloadFile(selectedFile)}
                        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => { setSelectedFile(null); setFileContent(null); }}
                        className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 rounded hover:bg-zinc-300 text-sm"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Research URLs Tab */}
          {activeTab === 'research' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                  URLs de Pesquisa dos Cursos
                </h3>
                <button
                  onClick={loadResearchUrls}
                  disabled={researchUrlsLoading}
                  className="px-3 py-1.5 text-xs bg-zinc-200 dark:bg-zinc-700 rounded hover:bg-zinc-300 disabled:opacity-50"
                >
                  {researchUrlsLoading ? 'Carregando...' : 'Atualizar'}
                </button>
              </div>

              <p className="text-xs text-zinc-500 mb-4">
                Configure URLs customizadas para cada curso. Essas URLs serao usadas para extrair informacoes detalhadas como precos, prazos de candidatura e documentos.
              </p>

              {researchUrlsLoading ? (
                <div className="text-center py-8 text-zinc-500">Carregando...</div>
              ) : researchUrls.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  Nenhum curso encontrado. Importe cursos primeiro.
                </div>
              ) : (
                <div className="space-y-2">
                  {researchUrls.map((course) => (
                    <div key={course.id} className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{course.name}</p>
                          <p className="text-xs text-zinc-500 truncate">
                            {course.universityName || 'Sem universidade'}
                          </p>
                          {course.officialUrl && (
                            <p className="text-xs text-zinc-400 truncate mt-1">
                              Official: <a href={course.officialUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{course.officialUrl}</a>
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          {course.researchUrl ? (
                            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">Configurado</span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs bg-zinc-100 text-zinc-500 rounded">Nao configurado</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="flex gap-2">
                          <input
                            type="url"
                            defaultValue={course.researchUrl || ''}
                            placeholder="https://universidade.pt/curso/..."
                            className="flex-1 px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
                            onBlur={(e) => {
                              if (e.target.value !== (course.researchUrl || '')) {
                                saveResearchUrlForCourse(course.id, e.target.value);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const target = e.target as HTMLInputElement;
                                if (target.value !== (course.researchUrl || '')) {
                                  saveResearchUrlForCourse(course.id, target.value);
                                }
                                target.blur();
                              }
                            }}
                          />
                          {course.researchUrl && (
                            <a
                              href={course.researchUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            >
                              Abrir
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* AI Tab */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              {/* Smart Search */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span className="text-lg">🔍</span> Busca Inteligente
                </h3>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={aiSearchQuery}
                    onChange={(e) => setAiSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAiSearch()}
                    placeholder="Ex: mestrado em IA em Lisboa presencial"
                    className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-sm"
                  />
                  <button
                    onClick={handleAiSearch}
                    disabled={aiSearchLoading || !aiSearchQuery.trim()}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm"
                  >
                    {aiSearchLoading ? '...' : 'Buscar'}
                  </button>
                </div>
                {aiSearchResults && (
                  <div className="mt-3">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                      {aiSearchResults.explanation}
                    </p>
                    {aiSearchResults.interpreted && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {Object.entries(aiSearchResults.interpreted)
                          .filter(([, v]) => v)
                          .map(([k, v]) => (
                            <span key={k} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded">
                              {k}: {String(v)}
                            </span>
                          ))}
                      </div>
                    )}
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {aiSearchResults.courses.slice(0, 10).map((course) => (
                        <div key={course.id} className="p-2 bg-white dark:bg-zinc-800 rounded text-sm">
                          <p className="font-medium">{course.name}</p>
                          <p className="text-xs text-zinc-500">
                            {course.university.name} - {course.level}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Generate Descriptions */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <span className="text-lg">📝</span> Gerar Descricoes
                  </h3>
                  {aiSummaryStats ? (
                    <>
                      <div className="text-sm space-y-2 mb-3">
                        <p>Universidades sem descricao: <strong>{aiSummaryStats.universities.withoutDescription}</strong></p>
                        <p>Cursos sem descricao: <strong>{aiSummaryStats.courses.withoutDescription}</strong></p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleGenerateDescriptions('university')}
                          disabled={aiSummaryLoading || aiSummaryStats.universities.withoutDescription === 0}
                          className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50"
                        >
                          {aiSummaryLoading ? '...' : 'Universidades'}
                        </button>
                        <button
                          onClick={() => handleGenerateDescriptions('course')}
                          disabled={aiSummaryLoading || aiSummaryStats.courses.withoutDescription === 0}
                          className="px-3 py-1.5 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:opacity-50"
                        >
                          {aiSummaryLoading ? '...' : 'Cursos'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-zinc-500">Carregando...</p>
                  )}
                </div>

                {/* Compare Courses */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <span className="text-lg">⚖️</span> Comparar Cursos
                  </h3>
                  <p className="text-xs text-zinc-500 mb-2">
                    Selecione cursos na aba Courses e volte aqui ({aiCompareIds.length}/5 selecionados)
                  </p>
                  {aiCompareIds.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {aiCompareIds.map((id) => (
                        <span key={id} className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs rounded">
                          {id.slice(0, 8)}...
                          <button onClick={() => toggleCourseForCompare(id)} className="ml-1">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={handleAiCompare}
                    disabled={aiCompareLoading || aiCompareIds.length < 2}
                    className="px-3 py-1.5 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 disabled:opacity-50"
                  >
                    {aiCompareLoading ? 'Comparando...' : 'Comparar'}
                  </button>
                  {aiCompareResult && (
                    <div className="mt-3 p-3 bg-white dark:bg-zinc-800 rounded text-sm">
                      <p className="font-medium mb-2">
                        {(aiCompareResult.comparison as { summary?: string })?.summary || 'Comparacao concluida'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recommendations */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span className="text-lg">🎯</span> Recomendacoes Personalizadas
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Interesses</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newInterest}
                        onChange={(e) => setNewInterest(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addInterest()}
                        placeholder="Ex: programacao, IA, tecnologia"
                        className="flex-1 px-3 py-1.5 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-sm"
                      />
                      <button
                        onClick={addInterest}
                        className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-700 rounded text-sm hover:bg-zinc-300"
                      >
                        +
                      </button>
                    </div>
                    {aiRecommendInterests.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {aiRecommendInterests.map((interest) => (
                          <span key={interest} className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs rounded">
                            {interest}
                            <button onClick={() => removeInterest(interest)} className="ml-1">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-zinc-500 block mb-1">Cidade</label>
                      <input
                        type="text"
                        value={aiRecommendCity}
                        onChange={(e) => setAiRecommendCity(e.target.value)}
                        placeholder="Ex: Lisboa"
                        className="w-full px-3 py-1.5 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 block mb-1">Nivel</label>
                      <select
                        value={aiRecommendLevel}
                        onChange={(e) => setAiRecommendLevel(e.target.value)}
                        className="w-full px-3 py-1.5 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-sm"
                      >
                        <option value="">Todos</option>
                        <option value="licenciatura">Licenciatura</option>
                        <option value="mestrado">Mestrado</option>
                        <option value="mestrado-integrado">Mestrado Integrado</option>
                        <option value="doutorado">Doutorado</option>
                        <option value="pos-doutorado">Pos-Doutorado</option>
                        <option value="mba">MBA</option>
                        <option value="pos-graduacao">Pos-Graduacao</option>
                        <option value="curso-tecnico">Curso Tecnico</option>
                        <option value="b-learning">B-Learning</option>
                        <option value="e-learning">E-Learning</option>
                        <option value="formacao-executiva">Formacao Executiva</option>
                        <option value="especializacao">Especializacao</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={handleAiRecommend}
                    disabled={aiRecommendLoading || aiRecommendInterests.length === 0}
                    className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50 text-sm"
                  >
                    {aiRecommendLoading ? 'Gerando...' : 'Gerar Recomendacoes'}
                  </button>
                </div>
                {aiRecommendations.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {aiRecommendations.map((rec, idx) => (
                      <div key={rec.course.id} className="p-3 bg-white dark:bg-zinc-800 rounded">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{rec.course.name}</p>
                            <p className="text-xs text-zinc-500">
                              {rec.course.university.name} - {rec.course.level}
                            </p>
                          </div>
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                            {rec.matchScore}%
                          </span>
                        </div>
                        {rec.reasons.length > 0 && (
                          <ul className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 list-disc list-inside">
                            {rec.reasons.slice(0, 3).map((reason, i) => (
                              <li key={i}>{reason}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Linking Modal */}
      {linkingCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-xl max-w-lg w-full">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
              <h3 className="font-semibold">Link Course to University</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Course</p>
                <p className="text-zinc-600 dark:text-zinc-400">{linkingCourse.name}</p>
                <p className="text-xs text-zinc-500">
                  {COURSE_LEVEL_LABELS[linkingCourse.level] || linkingCourse.level}
                  {linkingCourse.city && ` - ${linkingCourse.city}`}
                </p>
              </div>

              {linkingCourse.university && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Current university: <strong>{linkingCourse.university.name}</strong>
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium block mb-2">Select University</label>
                <select
                  value={linkingUniversityId}
                  onChange={(e) => setLinkingUniversityId(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-sm"
                >
                  <option value="">Select a university...</option>
                  {allUniversitiesForLink.map((uni) => (
                    <option key={uni.id} value={uni.id}>
                      {uni.name} {uni.city && `(${uni.city})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end gap-2">
              <button
                onClick={closeLinkingModal}
                disabled={linkingLoading}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 rounded hover:bg-zinc-300 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkCourse}
                disabled={linkingLoading || !linkingUniversityId}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 text-sm"
              >
                {linkingLoading ? 'Linking...' : 'Link Course'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
