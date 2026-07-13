import { createContext, useState, useCallback } from 'react';
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

  const t = useCallback((key) => {
    return locales[language]?.[key] || locales['pt-BR']?.[key] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
