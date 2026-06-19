'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { fetchWithCSRF } from '@/lib/csrf-client';
import { apiFetch } from '@/lib/api-fetch';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

interface KnowledgeItem {
  id: string;
  type: string;
  title: string;
  content: string;
  tags: string | null;
  source: string;
  confidence: number;
  priority: number;
  isActive: boolean;
  updatedAt: string;
  knowledgeSource?: {
    id: string;
    title: string | null;
    createdAt: string;
    processedAt: string | null;
  } | null;
}

interface KnowledgeSource {
  id: string;
  title: string | null;
  processedAt: string | null;
  createdAt: string;
  _count: { items: number };
}

const DEFAULT_TYPES = [
  'skill',
  'project',
  'experience',
  'achievement',
  'course',
  'certification',
  'language',
  'tool',
  'domain',
  'responsibility',
  'evidence',
];

export default function KnowledgeAdminPage() {
  const { showError, showSuccess } = useToast();
  const { confirm } = useConfirm();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [types, setTypes] = useState<string[]>(DEFAULT_TYPES);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('true');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sourceTitle, setSourceTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [editing, setEditing] = useState<KnowledgeItem | null>(null);
  const [form, setForm] = useState({
    type: 'skill',
    title: '',
    content: '',
    tags: '',
    confidence: 4,
    priority: 3,
    isActive: true,
  });

  const stats = useMemo(() => {
    const active = items.filter((item) => item.isActive).length;
    const byType = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {});
    return { active, total: items.length, byType };
  }, [items]);

  useEffect(() => {
    void loadData();
  }, [debouncedQuery, typeFilter, activeFilter, page]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setDebouncedQuery(query);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, activeFilter]);

  async function loadData() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (activeFilter !== 'all') params.set('active', activeFilter);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const [itemsResponse, sourcesResponse] = await Promise.all([
        apiFetch(`/api/admin/knowledge?${params.toString()}`),
        apiFetch('/api/admin/knowledge/sources'),
      ]);
      const itemsData = await itemsResponse.json();
      const sourcesData = await sourcesResponse.json();

      if (!itemsResponse.ok) throw new Error(itemsData.error || 'Failed to load knowledge');
      if (!sourcesResponse.ok) throw new Error(sourcesData.error || 'Failed to load sources');

      setItems(itemsData.items || []);
      setTypes(itemsData.types || DEFAULT_TYPES);
      setSources(sourcesData.sources || []);
      setTotal(itemsData.total || 0);
      setTotalPages(itemsData.totalPages || 1);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge');
    } finally {
      setLoading(false);
    }
  }

  async function processText(e: React.FormEvent) {
    e.preventDefault();
    try {
      setProcessing(true);
      setError(null);
      const response = await fetchWithCSRF('/api/admin/knowledge/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: sourceTitle || null,
          rawText,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save text source');

      const sourceId = data.source?.id;
      if (!sourceId) throw new Error('Source was saved but no source id was returned');

      const processResponse = await fetchWithCSRF(`/api/admin/knowledge/sources/${sourceId}/process`, {
        method: 'POST',
      });
      const processData = await processResponse.json();
      if (!processResponse.ok) {
        throw new Error(processData.error || 'Source was saved but processing failed');
      }

      setSourceTitle('');
      setRawText('');
      await loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to process text');
    } finally {
      setProcessing(false);
    }
  }

  async function processExistingSource(sourceId: string) {
    try {
      setProcessing(true);
      const response = await fetchWithCSRF(`/api/admin/knowledge/sources/${sourceId}/process`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to process source');
      await loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to process source');
    } finally {
      setProcessing(false);
    }
  }

  function startCreate() {
    setEditing(null);
    setForm({
      type: 'skill',
      title: '',
      content: '',
      tags: '',
      confidence: 4,
      priority: 3,
      isActive: true,
    });
  }

  function startEdit(item: KnowledgeItem) {
    setEditing(item);
    setForm({
      type: item.type,
      title: item.title,
      content: item.content,
      tags: item.tags || '',
      confidence: item.confidence,
      priority: item.priority,
      isActive: item.isActive,
    });
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving('form');
      const response = await fetchWithCSRF(
        editing ? `/api/admin/knowledge/${editing.id}` : '/api/admin/knowledge',
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }
      );
      const data = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to save knowledge item');
      startCreate();
      await loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setSaving(null);
    }
  }

  async function toggleItem(item: KnowledgeItem) {
    try {
      setSaving(item.id);
      const response = await fetchWithCSRF(`/api/admin/knowledge/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update item');
      }
      await loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update item');
    } finally {
      setSaving(null);
    }
  }

  async function deleteItem(item: KnowledgeItem) {
    const confirmed = await confirm({
      title: 'Delete knowledge item',
      message: `Delete "${item.title}" from your private knowledge base?`,
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!confirmed) return;

    try {
      setSaving(item.id);
      const response = await fetchWithCSRF(`/api/admin/knowledge/${item.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete item');
      await loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete item');
    } finally {
      setSaving(null);
    }
  }

  async function clearAll() {
    const confirmed = await confirm({
      title: 'Clear knowledge base',
      message: `Delete ALL ${total} knowledge item(s)? This cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete all',
    });
    if (!confirmed) return;

    try {
      setSaving('__all__');
      const response = await fetchWithCSRF('/api/admin/knowledge', { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to clear knowledge base');
      const data = (await response.json().catch(() => ({}))) as { deleted?: number };
      showSuccess(`Knowledge base cleared (${data.deleted ?? 0} item(s) removed).`);
      await loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to clear knowledge base');
    } finally {
      setSaving(null);
    }
  }

  const actions = (
    <div className="flex gap-2">
      {total > 0 && (
        <button
          onClick={clearAll}
          disabled={saving === '__all__'}
          className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-medium rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50"
        >
          {saving === '__all__' ? 'Clearing…' : 'Clear all'}
        </button>
      )}
      <button
        onClick={startCreate}
        className="px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors"
      >
        Add item
      </button>
    </div>
  );

  return (
    <AdminLayout
      title="Knowledge Base"
      subtitle="Private professional memory used to generate tailored CVs"
      actions={actions}
    >
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{stats.active}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Active facts</p>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{stats.total}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Filtered items</p>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{sources.length}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Text sources</p>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{Object.keys(stats.byType).length}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Categories</p>
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_420px] gap-6">
        <div className="space-y-6">
          <form
            onSubmit={processText}
            className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-5"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Process long text</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Paste private career notes and AI will extract reusable facts for CV generation.
                </p>
              </div>
              <button
                type="submit"
                disabled={processing || rawText.trim().length < 100}
                className="px-4 py-2 bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors"
              >
                {processing ? 'Processing...' : 'Process with AI'}
              </button>
            </div>
            <input
              value={sourceTitle}
              onChange={(event) => setSourceTitle(event.target.value)}
              placeholder="Optional title"
              className="w-full px-3 py-2 mb-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
            />
            <textarea
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              rows={10}
              placeholder="Paste two pages or more about your experience, projects, skills, achievements, tools, responsibilities, and anything that should support future CVs."
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
            />
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {rawText.trim().length} characters. Minimum 100 characters.
            </p>
          </form>

          <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-5">
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-5">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, content or tags"
                className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
              />
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
              >
                <option value="all">All types</option>
                {types.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <select
                value={activeFilter}
                onChange={(event) => setActiveFilter(event.target.value)}
                className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
                <option value="all">All</option>
              </select>
            </div>

            {loading ? (
              <div className="py-10 text-center text-zinc-500 dark:text-zinc-400">Loading...</div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center text-zinc-500 dark:text-zinc-400">No knowledge items found.</div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-4 ${
                      item.isActive
                        ? 'border-zinc-200 dark:border-zinc-700'
                        : 'border-zinc-200 dark:border-zinc-700 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                            {item.type}
                          </span>
                          <span className="px-2 py-0.5 text-xs rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300">
                            priority {item.priority}
                          </span>
                          <span className="px-2 py-0.5 text-xs rounded bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-300">
                            confidence {item.confidence}/5
                          </span>
                        </div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</h3>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{item.content}</p>
                        {item.tags && (
                          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">Tags: {item.tags}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => startEdit(item)}
                          className="px-3 py-1.5 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleItem(item)}
                          disabled={saving === item.id}
                          className="px-3 py-1.5 text-sm rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 disabled:opacity-50"
                        >
                          {item.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => deleteItem(item)}
                          disabled={saving === item.id}
                          className="px-3 py-1.5 text-sm rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-5 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Showing {items.length} of {total} items
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1 || loading}
                  className="px-3 py-1.5 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages || loading}
                  className="px-3 py-1.5 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <form
            onSubmit={saveItem}
            className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-5 sticky top-24"
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              {editing ? 'Edit item' : 'Manual item'}
            </h2>
            <div className="space-y-3">
              <select
                value={form.type}
                onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
              >
                {types.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Title"
                required
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
              />
              <textarea
                value={form.content}
                onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                placeholder="Fact, evidence or CV-ready detail"
                rows={6}
                required
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
              />
              <input
                value={form.tags}
                onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
                placeholder="Tags separated by commas"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
              />
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-zinc-600 dark:text-zinc-400">
                  Confidence
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={form.confidence}
                    onChange={(event) => setForm((prev) => ({ ...prev, confidence: Number(event.target.value) }))}
                    className="mt-1 w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </label>
                <label className="text-sm text-zinc-600 dark:text-zinc-400">
                  Priority
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={form.priority}
                    onChange={(event) => setForm((prev) => ({ ...prev, priority: Number(event.target.value) }))}
                    className="mt-1 w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                Active for CV generation
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving === 'form'}
                  className="flex-1 px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {saving === 'form' ? 'Saving...' : 'Save'}
                </button>
                {editing && (
                  <button
                    type="button"
                    onClick={startCreate}
                    className="px-4 py-2 bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-medium rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </form>

          <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-5">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Recent sources</h2>
            <div className="space-y-3">
              {sources.slice(0, 6).map((source) => (
                <div key={source.id} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                        {source.title || 'Untitled source'}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {source._count.items} items extracted
                        {source.processedAt ? ' · processed' : ' · not processed'}
                      </p>
                    </div>
                    {!source.processedAt && (
                      <button
                        onClick={() => processExistingSource(source.id)}
                        disabled={processing}
                        className="px-2 py-1 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-50"
                      >
                        Process
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {sources.length === 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No text sources yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
