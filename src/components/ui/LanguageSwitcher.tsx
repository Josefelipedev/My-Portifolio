'use client';

import { useLanguage, Language } from '@/lib/i18n';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'pt' ? 'en' : 'pt');
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 transition-all hover:scale-105"
      title={language === 'pt' ? 'Switch to English' : 'Mudar para Português'}
    >
      <span className="text-lg">{language === 'pt' ? '🇧🇷' : '🇺🇸'}</span>
      <span className="text-sm font-medium text-slate-300">
        {language === 'pt' ? 'PT' : 'EN'}
      </span>
    </button>
  );
}
