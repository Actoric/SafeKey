import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { CloudSettings, AppSettings } from '../../../shared/types';
import { LANGUAGES } from '../utils/i18n';
import './Settings.css';

interface SettingsProps {
  onClose: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (error: string) => void;
}

export function Settings({ onClose, onSaveSuccess, onSaveError }: SettingsProps) {
  const [cloudSettings, setCloudSettings] = useState<CloudSettings>({
    yandexDisk: { enabled: false, token: '', path: '' },
    googleDrive: { enabled: false, token: '', folderId: '' },
  });
  const [appSettings, setAppSettings] = useState<AppSettings>({
    overlayShortcut: 'CommandOrControl+Shift+P',
    openInOverlay: false,
    language: 'ru',
  });
  const [appVersion, setAppVersion] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const updateCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadSettings();

    // Подписываемся на события обновления
    if (window.electronAPI && (window.electronAPI as any).ipcRenderer) {
      const ipcRenderer = (window.electronAPI as any).ipcRenderer;
      
      const handleUpdateNotAvailable = () => {
        if (updateCheckTimeoutRef.current) {
          clearTimeout(updateCheckTimeoutRef.current);
        }
        setTimeout(() => {
          alert('Программа обновлена до последней версии');
        }, 500);
      };

      ipcRenderer.on('update-not-available', handleUpdateNotAvailable);

      return () => {
        ipcRenderer.removeAllListeners('update-not-available');
        if (updateCheckTimeoutRef.current) {
          clearTimeout(updateCheckTimeoutRef.current);
        }
      };
    }
  }, []);

  const loadSettings = async () => {
    try {
      const cloud = await window.electronAPI.getCloudSettings();
      const app = await window.electronAPI.getAppSettings();
      const version = await window.electronAPI.getAppVersion();
      setCloudSettings(cloud);
      setAppSettings(app);
      setAppVersion(version);
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
              <label>
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
                Включить синхронизацию с Яндекс.Диском
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
                                alert('Авторизация успешна! Токен сохранен.');
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
            <h3>Обновления</h3>
            <div className="settings-field">
              <div style={{ marginBottom: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Текущая версия: <strong>{appVersion || 'Загрузка...'}</strong>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={async () => {
                  try {
                    const result = await window.electronAPI.checkForUpdates();
                    if (result.success) {
                      // Не показываем alert сразу, ждем результата проверки
                      // Сообщение будет показано через событие update-not-available или update-available
                      updateCheckTimeoutRef.current = setTimeout(() => {
                        // Если через 3 секунды не пришло событие, значит проверка еще идет
                      }, 3000);
                    } else {
                      // Если это сообщение о том, что обновлений нет
                      if (result.message?.includes('не найдены') || result.message?.includes('not available') || result.message?.includes('максимальной')) {
                        setTimeout(() => {
                          alert('Программа обновлена до последней версии');
                        }, 0);
                      } else {
                        setTimeout(() => {
                          alert(result.message || 'Ошибка проверки обновлений');
                        }, 0);
                      }
                    }
                  } catch (error) {
                    console.error('Ошибка проверки обновлений:', error);
                    setTimeout(() => {
                      alert('Ошибка проверки обновлений');
                    }, 0);
                  }
                }}
              >
                Проверить обновления
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3>Язык интерфейса</h3>
            <div className="settings-field">
              <label>
                Выберите язык
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
            <div className="settings-field">
              <label>
                <input
                  type="checkbox"
                  checked={appSettings.openInOverlay || false}
                  onChange={(e) =>
                    setAppSettings({
                      ...appSettings,
                      openInOverlay: e.target.checked,
                    })
                  }
                />
                Открывать программу в оверлее при запуске
              </label>
            </div>
          </section>

          <section className="settings-section">
            <h3>Автозапуск и трей</h3>
            <div className="settings-field">
              <label>
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
                Запускать при старте Windows
              </label>
            </div>
            <div className="settings-field">
              <label>
                <input
                  type="checkbox"
                  checked={appSettings.startMinimized || false}
                  onChange={(e) =>
                    setAppSettings({
                      ...appSettings,
                      startMinimized: e.target.checked,
                    })
                  }
                />
                Запускать свернутым в трей
              </label>
            </div>
            <div className="settings-field">
              <label>
                <input
                  type="checkbox"
                  checked={appSettings.minimizeToTray || false}
                  onChange={(e) =>
                    setAppSettings({
                      ...appSettings,
                      minimizeToTray: e.target.checked,
                    })
                  }
                />
                Сворачивать в трей вместо панели задач
              </label>
            </div>
          </section>

          <section className="settings-section">
            <h3>Google Drive</h3>
            <div className="settings-field">
              <label>
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
                Включить синхронизацию с Google Drive
              </label>
            </div>
            {cloudSettings.googleDrive?.enabled && (
              <>
                <div className="settings-field">
                  <label>
                    Токен доступа
                    <input
                      type="text"
                      placeholder="Введите токен Google Drive"
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
                    />
                  </label>
                  <small>
                    Получить токен можно в{' '}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Google Cloud Console
                    </a>
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
            Отмена
          </button>
          <button className="primary-button" onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}

