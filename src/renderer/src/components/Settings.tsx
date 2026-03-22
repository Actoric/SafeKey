import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { CloudSettings, AppSettings } from '../../../shared/types';
import { LANGUAGES, setLanguage } from '../utils/i18n';
import { useTranslation } from '../hooks/useTranslation';
import './Settings.css';

function AppPinSettings() {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isPinSet, setIsPinSet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    checkPinStatus();
  }, []);

  const checkPinStatus = async () => {
    try {
      const pinSet = await window.electronAPI.checkAppPinSet();
      setIsPinSet(pinSet);
    } catch (error) {
      console.error('Ошибка проверки PIN-кода:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetPin = async () => {
    if (!newPin || newPin.length < 4) {
      setError('PIN-код должен содержать минимум 4 символа');
      return;
    }

    if (newPin !== confirmPin) {
      setError('PIN-коды не совпадают');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const result = await window.electronAPI.setAppPin(newPin);
      if (result.success) {
        setSuccess('PIN-код успешно установлен');
        setNewPin('');
        setConfirmPin('');
        setIsPinSet(true);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.error || 'Ошибка установки PIN-кода');
      }
    } catch (error) {
      setError('Ошибка установки PIN-кода: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePin = async () => {
    if (!currentPin) {
      setError('Введите текущий PIN-код');
      return;
    }

    // Проверяем текущий PIN
    const verified = await window.electronAPI.verifyAppPin(currentPin);
    if (!verified) {
      setError('Неверный текущий PIN-код');
      return;
    }

    if (!newPin || newPin.length < 4) {
      setError('PIN-код должен содержать минимум 4 символа');
      return;
    }

    if (newPin !== confirmPin) {
      setError('PIN-коды не совпадают');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const result = await window.electronAPI.setAppPin(newPin);
      if (result.success) {
        setSuccess('PIN-код успешно изменен');
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.error || 'Ошибка изменения PIN-кода');
      }
    } catch (error) {
      setError('Ошибка изменения PIN-кода: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'));
    } finally {
      setSaving(false);
    }
  };

  const handleClearPin = async () => {
    if (!currentPin) {
      setError('Введите текущий PIN-код для подтверждения');
      return;
    }

    // Проверяем текущий PIN
    const verified = await window.electronAPI.verifyAppPin(currentPin);
    if (!verified) {
      setError('Неверный PIN-код');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const result = await window.electronAPI.clearAppPin();
      if (result.success) {
        setSuccess('PIN-код успешно удален');
        setCurrentPin('');
        setIsPinSet(false);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Ошибка удаления PIN-кода');
      }
    } catch (error) {
      setError('Ошибка удаления PIN-кода: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>Загрузка...</div>;
  }

  return (
    <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
      {isPinSet ? (
        <>
          <div style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-primary)' }}>
            PIN-код установлен
          </div>
          <div className="settings-field">
            <label>
              Текущий PIN-код
              <input
                type="password"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                placeholder="Введите текущий PIN"
                style={{ letterSpacing: '4px' }}
              />
            </label>
          </div>
          <div className="settings-field">
            <label>
              Новый PIN-код
              <input
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="Введите новый PIN (минимум 4 символа)"
                style={{ letterSpacing: '4px' }}
              />
            </label>
          </div>
          <div className="settings-field">
            <label>
              Подтвердите новый PIN-код
              <input
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="Повторите новый PIN"
                style={{ letterSpacing: '4px' }}
              />
            </label>
          </div>
          {error && (
            <div style={{ fontSize: '12px', color: '#e74c3c', marginBottom: '12px' }}>{error}</div>
          )}
          {success && (
            <div style={{ fontSize: '12px', color: '#27ae60', marginBottom: '12px' }}>{success}</div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="small-button"
              onClick={handleChangePin}
              disabled={saving || !newPin || !confirmPin}
            >
              Изменить PIN
            </button>
            <button
              type="button"
              className="small-button"
              onClick={handleClearPin}
              disabled={saving || !currentPin}
              style={{ backgroundColor: '#e74c3c' }}
            >
              Удалить PIN
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-primary)' }}>
            Установите PIN-код для защиты доступа к программе
          </div>
          <div className="settings-field">
            <label>
              PIN-код
              <input
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="Введите PIN (минимум 4 символа)"
                style={{ letterSpacing: '4px' }}
              />
            </label>
          </div>
          <div className="settings-field">
            <label>
              Подтвердите PIN-код
              <input
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="Повторите PIN"
                style={{ letterSpacing: '4px' }}
              />
            </label>
          </div>
          {error && (
            <div style={{ fontSize: '12px', color: '#e74c3c', marginBottom: '12px' }}>{error}</div>
          )}
          {success && (
            <div style={{ fontSize: '12px', color: '#27ae60', marginBottom: '12px' }}>{success}</div>
          )}
          <button
            type="button"
            className="small-button"
            onClick={handleSetPin}
            disabled={saving || !newPin || !confirmPin}
          >
            Установить PIN
          </button>
        </>
      )}
    </div>
  );
}

interface SettingsProps {
  onClose: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (error: string) => void;
}

export function Settings({ onClose, onSaveSuccess, onSaveError }: SettingsProps) {
  const t = useTranslation();
  const [cloudSettings, setCloudSettings] = useState<CloudSettings>({
    yandexDisk: { enabled: false, token: '', path: '' },
    googleDrive: { enabled: false, token: '', folderId: '' },
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
          <section className="settings-section">
            <h3>Яндекс.Диск</h3>
            <div className="settings-field">
              <label className="toggle-label">
                <span>Включить синхронизацию с Яндекс.Диском</span>
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={cloudSettings.yandexDisk?.enabled || false}
                    onChange={(e) =>
                      setCloudSettings({
                        ...cloudSettings,
                        yandexDisk: {
                          ...cloudSettings.yandexDisk,
                          enabled: e.target.checked,
                        },
                      })
                    }
                  />
                  <span className="toggle-slider"></span>
                </div>
              </label>
            </div>
            {cloudSettings.yandexDisk?.enabled && (
              <>
                <div className="settings-field">
                  <label>
                    Токен доступа
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Токен будет получен автоматически"
                        value={cloudSettings.yandexDisk.token || ''}
                        onChange={(e) =>
                          setCloudSettings({
                            ...cloudSettings,
                            yandexDisk: {
                              ...cloudSettings.yandexDisk!,
                              token: e.target.value,
                            },
                          })
                        }
                        readOnly={!!cloudSettings.yandexDisk.token}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="small-button"
                        onClick={async () => {
                          // Выполняем авторизацию асинхронно, не блокируя UI
                          window.electronAPI.authorizeYandexDisk().then((result) => {
                            if (result.success && result.token) {
                              setCloudSettings({
                                ...cloudSettings,
                                yandexDisk: {
                                  ...cloudSettings.yandexDisk!,
                                  token: result.token,
                                },
                              });
                              setTimeout(() => {
                                if (result.hasExistingFiles && result.files && result.files.length > 0) {
                                  alert(`Авторизация успешна! Токен сохранен.\n\nНайдены существующие файлы резервных копий на Яндекс.Диске:\n${result.files.join('\n')}`);
                                } else {
                                  alert('Авторизация успешна! Токен сохранен.');
                                }
                              }, 0);
                            } else {
                              setTimeout(() => {
                                alert('Авторизация не удалась. Попробуйте еще раз.');
                              }, 0);
                            }
                          }).catch((error) => {
                            console.error('Ошибка авторизации:', error);
                            setTimeout(() => {
                              alert('Ошибка авторизации: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'));
                            }, 0);
                          });
                        }}
                      >
                        {cloudSettings.yandexDisk.token ? 'Обновить токен' : 'Авторизоваться'}
                      </button>
                    </div>
                  </label>
                  <small>
                    Нажмите "Авторизоваться" для автоматического получения токена через OAuth
                  </small>
                </div>
                <div className="settings-field">
                  <label>
                    Путь на диске
                    <input
                      type="text"
                      placeholder="/SafeKey"
                      value={cloudSettings.yandexDisk.path || ''}
                      onChange={(e) =>
                        setCloudSettings({
                          ...cloudSettings,
                          yandexDisk: {
                            ...cloudSettings.yandexDisk!,
                            path: e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                </div>
                {cloudSettings.yandexDisk.token && (
                  <div className="settings-field">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={async () => {
                        // Выполняем проверку асинхронно, не блокируя UI
                        window.electronAPI.checkCloudSync().then((result) => {
                          if (result.synced) {
                            const message = `Синхронизация работает!\n${result.message}\n\nНайдено файлов: ${result.files?.length || 0}`;
                            // Используем setTimeout для неблокирующего показа сообщения
                            setTimeout(() => {
                              alert(message);
                            }, 0);
                          } else {
                            const message = `Синхронизация не найдена:\n${result.message}`;
                            setTimeout(() => {
                              alert(message);
                            }, 0);
                          }
                        }).catch((error) => {
                          console.error('Ошибка проверки синхронизации:', error);
                          setTimeout(() => {
                            alert('Ошибка проверки синхронизации');
                          }, 0);
                        });
                      }}
                    >
                      Проверить синхронизацию
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

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
            {appSettings.authType === 'app-pin' && (
              <AppPinSettings />
            )}
          </section>

          <section className="settings-section">
            <h3>Google Drive</h3>
            <div className="settings-field">
              <label className="toggle-label">
                <span>Включить синхронизацию с Google Drive</span>
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={cloudSettings.googleDrive?.enabled || false}
                    onChange={(e) =>
                      setCloudSettings({
                        ...cloudSettings,
                        googleDrive: {
                          ...cloudSettings.googleDrive,
                          enabled: e.target.checked,
                        },
                      })
                    }
                  />
                  <span className="toggle-slider"></span>
                </div>
              </label>
            </div>
            {cloudSettings.googleDrive?.enabled && (
              <>
                <div className="settings-field">
                  <label>
                    Токен доступа
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Токен будет получен автоматически"
                        value={cloudSettings.googleDrive.token || ''}
                        onChange={(e) =>
                          setCloudSettings({
                            ...cloudSettings,
                            googleDrive: {
                              ...cloudSettings.googleDrive!,
                              token: e.target.value,
                            },
                          })
                        }
                        readOnly={!!cloudSettings.googleDrive.token}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="small-button"
                        onClick={async () => {
                          // Выполняем авторизацию асинхронно, не блокируя UI
                          window.electronAPI.authorizeGoogleDrive().then((result) => {
                            if (result.success && result.token) {
                              setCloudSettings({
                                ...cloudSettings,
                                googleDrive: {
                                  ...cloudSettings.googleDrive!,
                                  token: result.token,
                                },
                              });
                              setTimeout(() => {
                                alert('Авторизация успешна! Токен сохранен.');
                              }, 0);
                            } else {
                              setTimeout(() => {
                                alert('Авторизация не удалась. Попробуйте еще раз.');
                              }, 0);
                            }
                          }).catch((error) => {
                            console.error('Ошибка авторизации Google Drive:', error);
                            setTimeout(() => {
                              alert('Ошибка авторизации: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'));
                            }, 0);
                          });
                        }}
                      >
                        {cloudSettings.googleDrive.token ? 'Обновить токен' : 'Авторизоваться'}
                      </button>
                    </div>
                  </label>
                  <small>
                    Нажмите "Авторизоваться" для автоматического получения токена через OAuth
                  </small>
                </div>
                <div className="settings-field">
                  <label>
                    ID папки
                    <input
                      type="text"
                      placeholder="Введите ID папки"
                      value={cloudSettings.googleDrive.folderId || ''}
                      onChange={(e) =>
                        setCloudSettings({
                          ...cloudSettings,
                          googleDrive: {
                            ...cloudSettings.googleDrive!,
                            folderId: e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                </div>
              </>
            )}
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

