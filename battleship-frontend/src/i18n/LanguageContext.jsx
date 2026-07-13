import { createContext, useState, useCallback, useMemo } from 'react';
import ptBR from './locales/pt-BR';
import enUS from './locales/en-US';

const locales = { 'pt-BR': ptBR, 'en-US': enUS };

export const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => localStorage.getItem('language') || 'pt-BR');

  const setLanguage = useCallback((lang) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  }, []);

  const t = useMemo(() => {
    return (key) => locales[language]?.[key] || locales['pt-BR']?.[key] || key;
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
