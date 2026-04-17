'use client';

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDelete: () => void;
  onExport?: () => void;
  onStatusChange?: (status: string) => void;
  showStatusChange?: boolean;
  isDeleting?: boolean;
  onBatchAnalyze?: () => void;
  onBatchGenerateCVs?: () => void;
  batchAnalyzing?: boolean;
  batchGenerating?: boolean;
}

const STATUSES = ['saved', 'applied', 'interview', 'offer', 'rejected'];

export default function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onDelete,
  onExport,
  onStatusChange,
  showStatusChange = false,
  isDeleting = false,
  onBatchAnalyze,
  onBatchGenerateCVs,
  batchAnalyzing = false,
  batchGenerating = false,
}: BulkActionBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="sticky top-0 z-10 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 mb-4 flex items-center justify-between gap-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selectedCount === totalCount}
            onChange={() => (selectedCount === totalCount ? onDeselectAll() : onSelectAll())}
            className="w-4 h-4 rounded border-zinc-300 text-red-500 focus:ring-red-500"
          />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
          </span>
        </div>

        <button
          onClick={onDeselectAll}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Limpar selecao
        </button>
      </div>

      <div className="flex items-center gap-2">
        {/* Status Change Dropdown */}
        {showStatusChange && onStatusChange && (
          <select
            onChange={(e) => {
              if (e.target.value) {
                onStatusChange(e.target.value);
                e.target.value = '';
              }
            }}
            className="px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            defaultValue=""
          >
            <option value="" disabled>
              Mudar status...
            </option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        )}

        {/* Batch Analyze */}
        {onBatchAnalyze && (
          <button
            onClick={onBatchAnalyze}
            disabled={batchAnalyzing}
            className="px-3 py-1.5 text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800/50 disabled:opacity-50 transition-colors flex items-center gap-1"
          >
            {batchAnalyzing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analisando {selectedCount}...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                Analyze {selectedCount}
              </>
            )}
          </button>
        )}

        {/* Batch Generate CVs */}
        {onBatchGenerateCVs && (
          <button
            onClick={onBatchGenerateCVs}
            disabled={batchGenerating || selectedCount > 10}
            className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/50 disabled:opacity-50 transition-colors flex items-center gap-1"
            title={selectedCount > 10 ? 'Máximo 10 CVs por vez' : `Gerar CVs para ${selectedCount} vagas`}
          >
            {batchGenerating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Gerando CVs...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CVs {selectedCount > 10 ? '(max 10)' : `(${selectedCount})`}
              </>
            )}
          </button>
        )}

        {/* Export Button */}
        {onExport && (
          <button
            onClick={onExport}
            className="px-3 py-1.5 text-sm bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Exportar
          </button>
        )}

        {/* Delete Button */}
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-1"
        >
          {isDeleting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Deletando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Deletar ({selectedCount})
            </>
          )}
        </button>
      </div>
    </div>
  );
}
