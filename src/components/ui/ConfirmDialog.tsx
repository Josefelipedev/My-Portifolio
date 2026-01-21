'use client';

import React, { useState, createContext, useContext, useCallback } from 'react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface PromptOptions {
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}

interface DialogState {
  isOpen: boolean;
  type: 'confirm' | 'prompt';
  options: ConfirmOptions | PromptOptions;
  resolve: ((value: boolean | string | null) => void) | null;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    type: 'confirm',
    options: { message: '' },
    resolve: null,
  });
  const [inputValue, setInputValue] = useState('');

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({
        isOpen: true,
        type: 'confirm',
        options,
        resolve: resolve as (value: boolean | string | null) => void,
      });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    setInputValue(options.defaultValue || '');
    return new Promise((resolve) => {
      setDialog({
        isOpen: true,
        type: 'prompt',
        options,
        resolve: resolve as (value: boolean | string | null) => void,
      });
    });
  }, []);

  const handleConfirm = () => {
    if (dialog.type === 'confirm') {
      dialog.resolve?.(true);
    } else {
      dialog.resolve?.(inputValue);
    }
    setDialog((prev) => ({ ...prev, isOpen: false }));
    setInputValue('');
  };

  const handleCancel = () => {
    if (dialog.type === 'confirm') {
      dialog.resolve?.(false);
    } else {
      dialog.resolve?.(null);
    }
    setDialog((prev) => ({ ...prev, isOpen: false }));
    setInputValue('');
  };

  const options = dialog.options as ConfirmOptions & PromptOptions;
  const type = (options as ConfirmOptions).type || 'info';

  const typeStyles = {
    danger: {
      icon: (
        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      button: 'bg-red-500 hover:bg-red-600',
    },
    warning: {
      icon: (
        <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      button: 'bg-yellow-500 hover:bg-yellow-600',
    },
    info: {
      icon: (
        <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      button: 'bg-blue-500 hover:bg-blue-600',
    },
  };

  return (
    <ConfirmContext.Provider value={{ confirm, prompt }}>
      {children}

      {/* Dialog Overlay */}
      {dialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleCancel}
          />

          {/* Dialog */}
          <div className="relative bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-zinc-200 dark:border-zinc-700">
              {typeStyles[type].icon}
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {options.title || (dialog.type === 'confirm' ? 'Confirmar' : 'Digite')}
              </h3>
            </div>

            {/* Content */}
            <div className="p-4">
              <p className="text-zinc-600 dark:text-zinc-400">{options.message}</p>

              {dialog.type === 'prompt' && (
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={(options as PromptOptions).placeholder}
                  className="mt-4 w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirm();
                    if (e.key === 'Escape') handleCancel();
                  }}
                />
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 p-4 bg-zinc-50 dark:bg-zinc-900/50">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-700 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
              >
                {options.cancelText || 'Cancelar'}
              </button>
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${typeStyles[type].button}`}
              >
                {options.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
