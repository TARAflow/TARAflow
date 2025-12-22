import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

// ==================== LANGUAGE SWITCHER ====================

interface Language {
  code: string;
  name: string;
  flag: string;
}

const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  // Add more languages here:
  // { code: 'fr', name: 'Français', flag: '🇫🇷' },
  // { code: 'es', name: 'Español', flag: '🇪🇸' },
];

interface LanguageSwitcherProps {
  variant?: 'dropdown' | 'buttons' | 'minimal';
  showLabel?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'dropdown',
  showLabel = true,
}) => {
  const { i18n, t } = useTranslation();
  const currentLanguage = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  const changeLanguage = (langCode: string) => {
    i18n.changeLanguage(langCode);
  };

  // Dropdown variant
  if (variant === 'dropdown') {
    return (
      <div className="relative inline-block">
        <select
          value={i18n.language}
          onChange={(e) => changeLanguage(e.target.value)}
          className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm cursor-pointer hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>
        <Globe className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    );
  }

  // Button variant
  if (variant === 'buttons') {
    return (
      <div className="flex gap-1">
        {showLabel && (
          <span className="text-sm text-gray-600 mr-2 self-center">
            {t('settings.language')}:
          </span>
        )}
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              i18n.language === lang.code
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={lang.name}
          >
            {lang.flag} {lang.name}
          </button>
        ))}
      </div>
    );
  }

  // Minimal variant (just flags)
  return (
    <div className="flex gap-1">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => changeLanguage(lang.code)}
          className={`p-2 text-lg rounded-lg transition-colors ${
            i18n.language === lang.code
              ? 'bg-blue-100 ring-2 ring-blue-500'
              : 'hover:bg-gray-100'
          }`}
          title={lang.name}
        >
          {lang.flag}
        </button>
      ))}
    </div>
  );
};

// ==================== HOOK FOR LANGUAGE ====================

export const useLanguage = () => {
  const { i18n } = useTranslation();

  return {
    currentLanguage: i18n.language,
    changeLanguage: (code: string) => i18n.changeLanguage(code),
    languages: LANGUAGES,
  };
};

export default LanguageSwitcher;
