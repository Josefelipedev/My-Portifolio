'use client';

import { useLanguage } from '@/lib/i18n';
import { VisitorCounter } from './VisitorCounter';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="py-8 px-4 border-t border-zinc-200 dark:border-zinc-800">
      <div className="max-w-6xl mx-auto text-center space-y-4">
        {/* Visitor Counter */}
        <div className="flex justify-center">
          <VisitorCounter />
        </div>

        <p className="text-zinc-400 text-xs">
          {new Date().getFullYear()} {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}
