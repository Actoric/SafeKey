// Система локализации

import { getTranslation, Translations } from './translations';

export interface Language {
  code: string;
  name: string;
  flag: string;
}

export const LANGUAGES: Language[] = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
];

export function getLanguageByCode(code: string): Language | undefined {
  return LANGUAGES.find(lang => lang.code === code);
}

export function getDefaultLanguage(): Language {
  // Определяем язык по умолчанию на основе системных настроек
  const systemLang = navigator.language.split('-')[0];
  return getLanguageByCode(systemLang) || LANGUAGES[0];
}

// Глобальная переменная для текущего языка
let currentLanguage: string = 'ru';

export function setLanguage(lang: string) {
  currentLanguage = lang;
}

export function getCurrentLanguage(): string {
  return currentLanguage;
}

export function t(): Translations {
  return getTranslation(currentLanguage);
}

