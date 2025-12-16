import { useEffect, useState } from 'react';
import { getTranslation, Translations } from '../utils/translations';
import { setLanguage, getCurrentLanguage } from '../utils/i18n';

export function useTranslation() {
  const [lang, setLangState] = useState<string>('ru');
  const [t, setT] = useState<Translations>(getTranslation('ru'));

  useEffect(() => {
    // Загружаем язык из настроек
    const loadLanguage = async () => {
      try {
        const settings = await window.electronAPI.getAppSettings();
        const currentLang = settings.language || 'ru';
        setLangState(currentLang);
        setLanguage(currentLang);
        setT(getTranslation(currentLang));
      } catch (error) {
        console.error('Ошибка загрузки языка:', error);
      }
    };

    loadLanguage();

    // Слушаем изменения языка
    const checkLanguage = setInterval(async () => {
      try {
        const settings = await window.electronAPI.getAppSettings();
        const currentLang = settings.language || 'ru';
        if (currentLang !== lang) {
          setLangState(currentLang);
          setLanguage(currentLang);
          setT(getTranslation(currentLang));
        }
      } catch (error) {
        // Игнорируем ошибки
      }
    }, 1000);

    return () => clearInterval(checkLanguage);
  }, [lang]);

  return t;
}
