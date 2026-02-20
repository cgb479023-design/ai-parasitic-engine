import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import zhTranslations from '../locales/zh';
import enTranslations from '../locales/en';

type Language = 'en' | 'zh';
type Translations = Record<string, any>;

interface LocalizationContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  translations: Translations | null;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

const allTranslations = {
  zh: zhTranslations,
  en: enTranslations,
};

export const LocalizationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('zh');

  const translations = allTranslations[language];

  const t = useCallback((key: string, replacements?: Record<string, string | number>): string => {
    if (!translations) {
      return key; // Return key as fallback
    }
    
    const keys = key.split('.');
    let translation = keys.reduce((acc, currentKey) => {
        return (acc && acc[currentKey]) ? acc[currentKey] : null;
    }, translations as any);

    if (typeof translation !== 'string') {
      console.warn(`Translation key not found or not a string: ${key}`);
      return key; 
    }
    
    if (replacements) {
        Object.keys(replacements).forEach(placeholder => {
            translation = (translation as string).replace(`{${placeholder}}`, String(replacements[placeholder]));
        });
    }
    return translation;
  }, [translations]);

  return (
    <LocalizationContext.Provider value={{ language, setLanguage, t, translations }}>
      {children}
    </LocalizationContext.Provider>
  );
};

export const useLocalization = (): LocalizationContextType => {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
};