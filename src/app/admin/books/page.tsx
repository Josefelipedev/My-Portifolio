'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { fetchWithCSRF } from '@/lib/csrf-client';
import AdminLayout from '@/components/admin/AdminLayout';

interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  progress: number;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  rating: number | null;
  notes: string | null;
  isbn: string | null;
  totalPages: number | null;
  order: number;
}

const STATUSES = [
  { value: 'reading', label: 'Reading', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'want_to_read', label: 'Want to Read', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'paused', label: 'Paused', color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400' },
];

const DEFAULT_FORM = {
  title: '',
  author: '',
  coverUrl: '',
  progress: 0,
  status: 'reading',
  startedAt: '',
  finishedAt: '',
  rating: 0,
  notes: '',
  isbn: '',
  totalPages: '',
};

export default function BooksAdminPage() {
  const { showToast, showError } = useToast();
  const { confirm } = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [formData, setFormData] = useState(DEFAULT_FORM);

  useEffect(() => { fetchBooks(); }, []);

  const fetchBooks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/books');
      const data = await res.json();
      setBooks(data);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving('form');
      const url = editingId ? `/api/books/${editingId}` : '/api/books';
      const method = editingId ? 'PUT' : 'POST';

      const payload = {
        title: formData.title,
        author: formData.author,
        coverUrl: formData.coverUrl || null,
        progress: Number(formData.progress),
        status: formData.status,
        startedAt: formData.startedAt || null,
        finishedAt: formData.finishedAt || null,
        rating: formData.rating ? Number(formData.rating) : null,
        notes: formData.notes || null,
        isbn: formData.isbn || null,
        totalPages: formData.totalPages ? Number(formData.totalPages) : null,
      };

      const res = await fetchWithCSRF(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save book');
      }

      setShowForm(false);
      setEditingId(null);
      setFormData(DEFAULT_FORM);
      await fetchBooks();
      showToast(editingId ? 'Book updated!' : 'Book added!', 'success');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(null);
    }
  };

  const handleEdit = (book: Book) => {
    setFormData({
      title: book.title,
      author: book.author,
      coverUrl: book.coverUrl || '',
      progress: book.progress,
      status: book.status,
      startedAt: book.startedAt ? book.startedAt.slice(0, 10) : '',
      finishedAt: book.finishedAt ? book.finishedAt.slice(0, 10) : '',
      rating: book.rating || 0,
      notes: book.notes || '',
      isbn: book.isbn || '',
      totalPages: book.totalPages?.toString() || '',
    });
    setEditingId(book.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete Book',
      message: 'Are you sure you want to remove this book?',
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!confirmed) return;

    try {
      setSaving(id);
      const res = await fetchWithCSRF(`/api/books/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchBooks();
      showToast('Book removed', 'success');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setSaving(null);
    }
  };

  const handleDownloadSample = () => {
    const sample = [
      {
        title: 'Clean Code',
        author: 'Robert C. Martin',
        coverUrl: 'https://covers.openlibrary.org/b/isbn/9780132350884-M.jpg',
        progress: 65,
        status: 'reading',
        rating: 5,
        notes: 'Great book about writing maintainable code.',
        isbn: '9780132350884',
        totalPages: 431,
      },
      {
        title: 'The Pragmatic Programmer',
        author: 'David Thomas, Andrew Hunt',
        progress: 100,
        status: 'completed',
        rating: 5,
      },
      {
        title: 'Designing Data-Intensive Applications',
        author: 'Martin Kleppmann',
        progress: 0,
        status: 'want_to_read',
      },
    ];
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'books-sample.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const text = await file.text();
      const json = JSON.parse(text);

      const res = await fetchWithCSRF('/api/books/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Import failed');

      await fetchBooks();
      showToast(`Imported ${data.imported} books (${data.skipped} skipped)`, 'success');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to import. Check the JSON format.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getStatusStyle = (status: string) =>
    STATUSES.find((s) => s.value === status)?.color ??
    'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400';

  const getStatusLabel = (status: string) =>
    STATUSES.find((s) => s.value === status)?.label ?? status;

  const filtered = filterStatus === 'all' ? books : books.filter((b) => b.status === filterStatus);

  const counts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s.value] = books.filter((b) => b.status === s.value).length;
    return acc;
  }, {});

  const headerActions = (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={handleDownloadSample}
        className="flex items-center gap-2 px-4 py-2 bg-zinc-600 text-white font-medium rounded-lg hover:bg-zinc-500 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Sample JSON
      </button>
      <label className={`flex items-center gap-2 px-4 py-2 bg-zinc-700 text-white font-medium rounded-lg hover:bg-zinc-600 transition-colors cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        {importing ? 'Importing...' : 'Import JSON'}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
          disabled={importing}
        />
      </label>
      <button
        onClick={() => {
          setShowForm(true);
          setEditingId(null);
          setFormData(DEFAULT_FORM);
        }}
        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Book
      </button>
    </div>
  );

  return (
    <AdminLayout
      title="Books"
      subtitle="Manage your reading list — add manually or import from Koodo Reader"
      actions={headerActions}
    >
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setFilterStatus(filterStatus === s.value ? 'all' : s.value)}
            className={`p-4 rounded-xl border text-left transition-all ${
              filterStatus === s.value
                ? 'border-red-400 bg-red-50 dark:bg-red-900/10'
                : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-zinc-300'
            }`}
          >
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{counts[s.value] ?? 0}</div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Import hint */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 mb-6">
        <p className="text-sm text-zinc-400 mb-2">
          <strong className="text-zinc-200">Import via JSON</strong> — clica em <strong className="text-zinc-200">Sample JSON</strong> para descarregar um ficheiro de exemplo com o formato correcto. Preenche com os teus livros e importa com o botão <strong className="text-zinc-200">Import JSON</strong>.
        </p>
        <p className="text-xs text-zinc-500">
          Campos suportados: <code className="text-zinc-300">title</code>, <code className="text-zinc-300">author</code>, <code className="text-zinc-300">coverUrl</code>, <code className="text-zinc-300">progress</code> (0–100), <code className="text-zinc-300">status</code> (reading | completed | want_to_read | paused), <code className="text-zinc-300">rating</code> (1–5), <code className="text-zinc-300">notes</code>, <code className="text-zinc-300">isbn</code>, <code className="text-zinc-300">totalPages</code>.
        </p>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-5">
              {editingId ? 'Edit Book' : 'Add Book'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                    placeholder="Book title"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Author *</label>
                  <input
                    type="text"
                    required
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                    placeholder="Author name"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Cover URL</label>
                  <input
                    type="url"
                    value={formData.coverUrl}
                    onChange={(e) => setFormData({ ...formData, coverUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                    placeholder="https://covers.openlibrary.org/b/isbn/..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Progress: {formData.progress}%
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={formData.progress}
                    onChange={(e) => setFormData({ ...formData, progress: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Rating (1-5)</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFormData({ ...formData, rating: formData.rating === star ? 0 : star })}
                        className={`text-2xl transition-colors ${star <= formData.rating ? 'text-yellow-400' : 'text-zinc-300 dark:text-zinc-600'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Total Pages</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.totalPages}
                    onChange={(e) => setFormData({ ...formData, totalPages: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                    placeholder="300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Started At</label>
                  <input
                    type="date"
                    value={formData.startedAt}
                    onChange={(e) => setFormData({ ...formData, startedAt: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Finished At</label>
                  <input
                    type="date"
                    value={formData.finishedAt}
                    onChange={(e) => setFormData({ ...formData, finishedAt: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">ISBN</label>
                  <input
                    type="text"
                    value={formData.isbn}
                    onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                    placeholder="9780000000000"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 resize-none"
                    placeholder="Your thoughts..."
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving === 'form'}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {saving === 'form' ? 'Saving...' : editingId ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filter */}
      {books.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filterStatus === 'all'
                ? 'bg-red-500 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            All ({books.length})
          </button>
          {STATUSES.map((s) => counts[s.value] > 0 && (
            <button
              key={s.value}
              onClick={() => setFilterStatus(s.value)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filterStatus === s.value
                  ? 'bg-red-500 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {s.label} ({counts[s.value]})
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <svg className="w-6 h-6 animate-spin text-zinc-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      )}

      {/* Books Grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((book) => (
            <div key={book.id} className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col">
              {/* Cover */}
              <div className="relative h-40 bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt={book.title} className="h-full w-full object-cover" />
                ) : (
                  <svg className="w-12 h-12 text-zinc-300 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                )}
                <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(book.status)}`}>
                  {getStatusLabel(book.status)}
                </span>
              </div>

              {/* Info */}
              <div className="p-4 flex flex-col flex-1">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm leading-tight mb-1 line-clamp-2">{book.title}</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">{book.author}</p>

                {book.rating !== null && (
                  <p className="text-yellow-400 text-xs mb-2">{'★'.repeat(book.rating)}{'☆'.repeat(5 - book.rating)}</p>
                )}

                {/* Progress bar */}
                {book.status === 'reading' && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>Progress</span>
                      <span>{book.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${book.progress}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-auto pt-2">
                  <button
                    onClick={() => handleEdit(book)}
                    className="flex-1 px-3 py-1.5 text-xs bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(book.id)}
                    disabled={saving === book.id}
                    className="px-3 py-1.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                  >
                    {saving === book.id ? '...' : 'Del'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && books.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 mb-4">No books yet. Add one manually or import from Koodo Reader.</p>
        </div>
      )}

      {!loading && filtered.length === 0 && books.length > 0 && (
        <div className="text-center py-12 text-zinc-400">No books with this status.</div>
      )}
    </AdminLayout>
  );
}
