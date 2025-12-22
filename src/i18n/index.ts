// ==================== COMPONENTS ====================
export { LanguageSwitcher } from './components/language-switcher';

// ==================== HOOKS ====================

// ==================== SERVICES ====================
export { default as i18n } from './services/i18n';
export {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getLanguageByCode,
  isValidLanguageCode,
  LANGUAGE_CODES,
  type Language,
  type LanguageCode,
} from './services/supported_languages';
