// ==================== SUPPORTED LANGUAGES ====================
// Location: src/i18n/config/supported-languages.ts
// Single Responsibility: Define available languages (Data)

export type LanguageCode = 'en' | 'de';

export interface Language {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  dir: 'ltr' | 'rtl'; // For future RTL languages (Arabic, Hebrew)
}

/**
 * List of all supported languages in the application
 * 
 * To add a new language:
 * 1. Add entry here
 * 2. Create locales/{code}.json
 * 3. Import in i18n-config.ts
 */
export const SUPPORTED_LANGUAGES: readonly Language[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
    dir: 'ltr',
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    dir: 'ltr',
  },
  // Easy to extend:
  // {
  //   code: 'fr',
  //   name: 'French',
  //   nativeName: 'Français',
  //   flag: '🇫🇷',
  //   dir: 'ltr',
  // },
] as const;

/**
 * Default language fallback
 */
export const DEFAULT_LANGUAGE: LanguageCode = 'en';

/**
 * localStorage key for persisting language preference
 */
export const LANGUAGE_STORAGE_KEY = 'coretm_language';

/**
 * Get language by code (with type safety)
 */
export function getLanguageByCode(code: string): Language | undefined {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code);
}

/**
 * Check if language code is supported
 */
export function isValidLanguageCode(code: string): code is LanguageCode {
  return SUPPORTED_LANGUAGES.some((lang) => lang.code === code);
}

/**
 * Get language codes only (for type unions)
 */
export const LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);
