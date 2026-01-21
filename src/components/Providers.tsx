'use client';

import { LanguageProvider } from '@/lib/i18n';
import { ToastProvider } from '@/components/ui/Toast';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <ToastProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </ToastProvider>
    </LanguageProvider>
  );
}
