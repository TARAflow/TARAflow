// ==================== i18n CONFIGURATION ====================
// src/i18n/i18n.ts

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import en from "../locales/en.json";
import de from "../locales/de.json";

const resources = {
  en: { translation: en },
  de: { translation: de },
};

i18n
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Pass to react-i18next
  .init({
    resources,
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    
    interpolation: {
      escapeValue: false, // React already escapes
    },

    detection: {
      // Order of language detection
      order: ['localStorage', 'navigator', 'htmlTag'],
      // Cache user language selection
      caches: ['localStorage'],
      lookupLocalStorage: 'coretm_language',
    },
  });

export default i18n;
