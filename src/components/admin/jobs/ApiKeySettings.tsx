'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/Toast';

interface KeyStatus {
  masked: string | null;
  source: 'db' | 'env' | null;
}

interface ApiKeysState {
  adzunaAppId: KeyStatus;
  adzunaAppKey: KeyStatus;
  joobleApiKey: KeyStatus;
  rapidApiKey: KeyStatus;
}

interface EditState {
  adzunaAppId: string;
  adzunaAppKey: string;
  joobleApiKey: string;
  rapidApiKey: string;
}

export default function ApiKeySettings() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState<ApiKeysState | null>(null);
  const [edit, setEdit] = useState<EditState>({ adzunaAppId: '', adzunaAppKey: '', joobleApiKey: '', rapidApiKey: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) fetchKeys();
  }, [open]);

  const fetchKeys = async () => {
    try {
      const res = await fetch('/api/jobs/api-keys');
      if (res.ok) setKeys(await res.json());
    } catch {}
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only send fields that the user typed something in
      const payload: Record<string, string> = {};
      if (edit.adzunaAppId !== '') payload.adzunaAppId = edit.adzunaAppId;
      if (edit.adzunaAppKey !== '') payload.adzunaAppKey = edit.adzunaAppKey;
      if (edit.joobleApiKey !== '') payload.joobleApiKey = edit.joobleApiKey;
      if (edit.rapidApiKey !== '') payload.rapidApiKey = edit.rapidApiKey;

      const res = await fetch('/api/jobs/api-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save');
      setEdit({ adzunaAppId: '', adzunaAppKey: '', joobleApiKey: '', rapidApiKey: '' });
      await fetchKeys();
      toast.showSuccess('Chaves salvas!');
    } catch {
      toast.showError('Erro ao salvar chaves');
    } finally {
      setSaving(false);
    }
  };

  const sourceLabel = (s: 'db' | 'env' | null) => {
    if (!s) return null;
    return s === 'db'
      ? <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">DB</span>
      : <span className="text-xs text-zinc-400">env</span>;
  };

  const KeyRow = ({ label, keyName, description }: { label: string; keyName: keyof EditState; description: string }) => {
    const status = keys?.[keyName];
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
            {label}
            {sourceLabel(status?.source ?? null)}
          </label>
          {status?.source && (
            <span className="text-xs text-zinc-500 font-mono">{status.masked}</span>
          )}
        </div>
        <p className="text-xs text-zinc-400">{description}</p>
        <input
          type="password"
          placeholder={status?.source ? 'Deixe em branco para manter o atual' : 'Cole a chave aqui'}
          value={edit[keyName]}
          onChange={(e) => setEdit(prev => ({ ...prev, [keyName]: e.target.value }))}
          className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono focus:ring-2 focus:ring-red-500 focus:border-red-500"
          autoComplete="off"
        />
      </div>
    );
  };

  const hasChanges = Object.values(edit).some(v => v !== '');

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        title="Configurar chaves de API"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
        Chaves de API
        {keys && Object.values(keys).filter(k => !k.source).length > 0 && (
          <span className="w-2 h-2 rounded-full bg-amber-400" title="Algumas chaves não configuradas" />
        )}
      </button>

      {open && (
        <div className="mt-3 p-4 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-zinc-800 dark:text-zinc-200 text-sm">Configurar chaves de API</h4>
            <span className="text-xs text-zinc-400">Chaves salvas no banco de dados — ativas imediatamente, sem reiniciar</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KeyRow keyName="adzunaAppId"  label="Adzuna App ID"  description="adzuna.com/developer — vagas PT/BR" />
            <KeyRow keyName="adzunaAppKey" label="Adzuna App Key" description="Complemento do App ID da Adzuna" />
            <KeyRow keyName="joobleApiKey" label="Jooble API Key" description="jooble.org — vagas globais" />
            <KeyRow keyName="rapidApiKey"  label="RapidAPI Key"   description="rapidapi.com — usado pelo JSearch" />
          </div>

          {hasChanges && (
            <div className="flex items-center gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-700">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Salvando…' : 'Salvar chaves'}
              </button>
              <button
                onClick={() => setEdit({ adzunaAppId: '', adzunaAppKey: '', joobleApiKey: '', rapidApiKey: '' })}
                className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Cancelar
              </button>
              <p className="text-xs text-zinc-400 ml-auto">Deixe em branco para manter o valor atual · apague e salve para remover</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
