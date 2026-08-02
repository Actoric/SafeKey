import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { CloudSettings, AppSettings } from '../../../shared/types';
import { LANGUAGES, setLanguage } from '../utils/i18n';
import { useTranslation } from '../hooks/useTranslation';
import './Settings.css';
import { SettingsAppPin } from './SettingsAppPin';
import { SettingsCloudBackupPanel } from './SettingsCloudPanels';

interface SettingsProps {
  onClose: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (error: string) => void;
}

export function Settings({ onClose, onSaveSuccess, onSaveError }: SettingsProps) {
  const t = useTranslation();
  const [cloudSettings, setCloudSettings] = useState<CloudSettings>({
    yandexDisk: { enabled: false, connected: false, path: 'SafeKey' },
    googleDrive: { enabled: false, connected: false, folderId: '' },
    status: {},
  });
  const [appSettings, setAppSettings] = useState<AppSettings>({
    overlayShortcut: 'CommandOrControl+Shift+P',
    language: 'ru',
  });
  const [appVersion, setAppVersion] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const cloud = await window.electronAPI.getCloudSettings();
      const app = await window.electronAPI.getAppSettings();
      const version = await window.electronAPI.getAppVersion();
      setCloudSettings(cloud);
      setAppSettings(app);
      setAppVersion(version);
      // Применяем тему при загрузке
      const theme = app.theme || 'light';
      document.documentElement.setAttribute('data-theme', theme);
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await window.electronAPI.saveCloudSettings(cloudSettings);
      await window.electronAPI.saveAppSettings(appSettings);
      // Обновляем язык после сохранения
      if (appSettings.language) {
        setLanguage(appSettings.language);
      }
      onClose();
      if (onSaveSuccess) {
        onSaveSuccess();
      }
    } catch (error) {
      console.error('Ошибка сохранения настроек:', error);
      const errorMessage = error instanceof Error ? error.message : 'Ошибка сохранения настроек';
      if (onSaveError) {
        onSaveError(errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-overlay">
        <div className="settings-modal">
          <div className="loading">Загрузка...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Настройки</h2>
          <button className="icon-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-content">
          <SettingsCloudBackupPanel cloudSettings={cloudSettings} setCloudSettings={setCloudSettings} />

          <section className="settings-section">
            <h3>{t.settings.updates}</h3>
            <div className="settings-field">
              <div style={{ marginBottom: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {t.settings.currentVersion}: <strong>{appVersion || t.common.loading}</strong>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={async () => {
                  try {
                    const result = await window.electronAPI.checkForUpdates();
                    if (result.success) {
                      alert(
                        'Проверка запущена. Если доступна новая версия, она загрузится и установится в фоне. Иначе у вас уже последняя версия.'
                      );
                    } else {
                      alert(result.message || 'Ошибка проверки обновлений');
                    }
                  } catch (error) {
                    console.error('Ошибка проверки обновлений:', error);
                    alert('Ошибка проверки обновлений');
                  }
                }}
              >
                {t.settings.checkUpdates}
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3>{t.settings.language}</h3>
            <div className="settings-field">
              <label>
                {t.settings.selectLanguage}
                <select
                  value={appSettings.language || 'ru'}
                  onChange={(e) =>
                    setAppSettings({
                      ...appSettings,
                      language: e.target.value,
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '8px',
                    marginTop: '6px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="settings-section">
            <h3>Горячие клавиши</h3>
            <div className="settings-field">
              <label>
                Горячая клавиша для открытия оверлея
                <input
                  type="text"
                  placeholder="CommandOrControl+Shift+P"
                  value={appSettings.overlayShortcut || ''}
                  onChange={(e) =>
                    setAppSettings({
                      ...appSettings,
                      overlayShortcut: e.target.value,
                    })
                  }
                />
              </label>
              <small>
                Формат: CommandOrControl+Shift+P (для Windows: Ctrl+Shift+P, для Mac: Cmd+Shift+P)
              </small>
            </div>
          </section>

          <section className="settings-section">
            <h3>Автозапуск</h3>
            <div className="settings-field">
              <label className="toggle-label">
                <span>Запускать при старте Windows</span>
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={appSettings.autoStart || false}
                    onChange={(e) =>
                      setAppSettings({
                        ...appSettings,
                        autoStart: e.target.checked,
                      })
                    }
                  />
                  <span className="toggle-slider"></span>
                </div>
              </label>
              <small>
                При включении автозапуска программа будет автоматически загружаться в системный трей
              </small>
            </div>
            <div className="settings-field">
              <label className="toggle-label">
                <span>Требовать авторизацию при открытии после автозапуска</span>
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={appSettings.requireAuthOnStartup !== false}
                    onChange={(e) =>
                      setAppSettings({
                        ...appSettings,
                        requireAuthOnStartup: e.target.checked,
                      })
                    }
                  />
                  <span className="toggle-slider"></span>
                </div>
              </label>
              <small>
                При включении будет запрашиваться авторизация при открытии программы из трея после автозапуска
              </small>
            </div>
          </section>

          <section className="settings-section">
            <h3>Внешний вид</h3>
            <div className="settings-field">
              <label>
                Тема оформления
                <select
                  value={appSettings.theme || 'light'}
                  onChange={(e) => {
                    const newTheme = e.target.value as 'light' | 'dark';
                    setAppSettings({
                      ...appSettings,
                      theme: newTheme,
                    });
                    // Применяем тему сразу
                    document.documentElement.setAttribute('data-theme', newTheme);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    marginTop: '6px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                >
                  <option value="light">Светлая</option>
                  <option value="dark">Темная</option>
                </select>
              </label>
              <small>
                Выберите тему оформления интерфейса
              </small>
            </div>
          </section>

          <section className="settings-section">
            <h3>Авторизация</h3>
            <div className="settings-field">
              <label>
                Способ авторизации
                <select
                  value={appSettings.authType || 'windows-pin'}
                  onChange={(e) =>
                    setAppSettings({
                      ...appSettings,
                      authType: e.target.value as 'windows-pin' | 'app-pin' | 'none',
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '8px',
                    marginTop: '6px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                >
                  <option value="windows-pin">Windows PIN (Windows Hello)</option>
                  <option value="app-pin">Собственный PIN-код приложения</option>
                  <option value="none">Без авторизации</option>
                </select>
              </label>
              <small>
                Выберите способ авторизации для доступа к программе
              </small>
            </div>
            {appSettings.authType === 'app-pin' && <SettingsAppPin />}
          </section>
        </div>

        <div className="settings-footer">
          <button className="secondary-button" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button className="primary-button" onClick={handleSave} disabled={saving}>
            {saving ? t.common.loading : t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}

