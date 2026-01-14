'use client';

import { useLanguage } from '@/lib/i18n';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="py-8 px-4 border-t border-zinc-200 dark:border-zinc-800">
      <div className="max-w-6xl mx-auto text-center">
        <p className="text-zinc-500 text-sm">
          {t.footer.builtWith}
        </p>
        <p className="text-zinc-400 text-xs mt-2">
          {new Date().getFullYear()} {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}
