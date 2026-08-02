import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { Cloud, CheckCircle2, AlertCircle, RefreshCw, Unplug } from 'lucide-react';
import { CloudProvider, CloudSettings, CloudSyncStatus, CloudBackupVersion, CloudStorageQuota } from '../../../shared/types';
import './Settings.css';

type SetCloud = Dispatch<SetStateAction<CloudSettings>>;

type PanelProps = {
  cloudSettings: CloudSettings;
  setCloudSettings: SetCloud;
};

function formatRelativeTime(iso?: string): string {
  if (!iso) return 'ещё не было';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return 'ещё не было';
  const diffSec = Math.round((Date.now() - ts) / 1000);
  if (diffSec < 60) return 'только что';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} мин назад`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ч назад`;
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function providerLabel(p: CloudProvider): string {
  return p === 'yandex' ? 'Яндекс.Диск' : 'Google Drive';
}

export function SettingsCloudBackupPanel({ cloudSettings, setCloudSettings }: PanelProps) {
  const [activeTab, setActiveTab] = useState<CloudProvider>('yandex');
  const [status, setStatus] = useState<CloudSyncStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [legacyWinUser, setLegacyWinUser] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [versions, setVersions] = useState<CloudBackupVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [quota, setQuota] = useState<CloudStorageQuota | null>(null);
  const [loadingQuota, setLoadingQuota] = useState(false);

  const yandexConnected = !!(cloudSettings.yandexDisk?.connected || cloudSettings.yandexDisk?.token);
  const googleConnected = !!(cloudSettings.googleDrive?.connected || cloudSettings.googleDrive?.token);
  const anyEnabled =
    (cloudSettings.yandexDisk?.enabled && yandexConnected) ||
    (cloudSettings.googleDrive?.enabled && googleConnected);
  const tabConnected = activeTab === 'yandex' ? yandexConnected : googleConnected;
  const tabEnabled =
    activeTab === 'yandex'
      ? !!cloudSettings.yandexDisk?.enabled
      : !!cloudSettings.googleDrive?.enabled;

  const refreshStatus = async () => {
    try {
      const result = await window.electronAPI.checkCloudSync();
      setStatus(result);
    } catch (err) {
      console.error(err);
    }
  };

  const refreshVersions = async (provider: CloudProvider) => {
    const connected = provider === 'yandex' ? yandexConnected : googleConnected;
    if (!connected) {
      setVersions([]);
      return;
    }
    setLoadingVersions(true);
    try {
      const result = await window.electronAPI.listCloudVersions(provider);
      if (result.success) {
        setVersions(result.versions || []);
      } else {
        setVersions([]);
      }
    } catch (err) {
      console.error(err);
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const refreshQuota = async (provider: CloudProvider) => {
    const connected = provider === 'yandex' ? yandexConnected : googleConnected;
    if (!connected) {
      setQuota(null);
      return;
    }
    setLoadingQuota(true);
    try {
      const result = await window.electronAPI.getCloudStorageQuota(provider);
      if (result.success && result.quotas?.length) {
        setQuota(result.quotas.find((q) => q.provider === provider) || result.quotas[0]);
      } else {
        setQuota(null);
      }
    } catch (err) {
      console.error(err);
      setQuota(null);
    } finally {
      setLoadingQuota(false);
    }
  };

  useEffect(() => {
    if (anyEnabled) {
      refreshStatus();
    }
  }, [anyEnabled, yandexConnected, googleConnected]);

  useEffect(() => {
    if (tabConnected && tabEnabled) {
      refreshVersions(activeTab);
      refreshQuota(activeTab);
    } else {
      setVersions([]);
      setQuota(null);
    }
  }, [activeTab, tabConnected, tabEnabled]);

  const showMsg = (type: 'ok' | 'err', text: string) => {
    setMessage({ type, text });
  };

  const handleAuthorize = async (provider: CloudProvider) => {
    setBusy(`auth-${provider}`);
    setMessage(null);
    try {
      const result =
        provider === 'yandex'
          ? await window.electronAPI.authorizeYandexDisk()
          : await window.electronAPI.authorizeGoogleDrive();

      if (result.success) {
        setCloudSettings((prev) => {
          if (provider === 'yandex') {
            return {
              ...prev,
              yandexDisk: {
                ...prev.yandexDisk,
                enabled: true,
                connected: true,
                path: prev.yandexDisk?.path || 'SafeKey',
              },
            };
          }
          return {
            ...prev,
            googleDrive: {
              ...prev.googleDrive,
              enabled: true,
              connected: true,
            },
          };
        });

        if (result.hasExistingFiles && result.files?.length) {
          showMsg(
            'ok',
            `Подключено. В облаке есть бэкапы (${result.files.length}). Можно восстановить ниже.`
          );
        } else {
          showMsg('ok', `${providerLabel(provider)} подключён.`);
        }
        await refreshStatus();
        await refreshVersions(provider);
      } else {
        showMsg('err', result.error || 'Авторизация не удалась');
      }
    } catch (err) {
      showMsg('err', err instanceof Error ? err.message : 'Ошибка авторизации');
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async (provider: CloudProvider) => {
    const ok = window.confirm(`Отключить ${providerLabel(provider)}? Локальные данные не удалятся.`);
    if (!ok) return;
    setBusy(`disconnect-${provider}`);
    try {
      await window.electronAPI.disconnectCloudProvider(provider);
      setCloudSettings((prev) => {
        if (provider === 'yandex') {
          return {
            ...prev,
            yandexDisk: {
              ...prev.yandexDisk,
              enabled: false,
              connected: false,
              token: '',
              path: prev.yandexDisk?.path || 'SafeKey',
            },
          };
        }
        return {
          ...prev,
          googleDrive: {
            ...prev.googleDrive,
            enabled: false,
            connected: false,
            token: '',
            folderId: '',
          },
        };
      });
      showMsg('ok', `${providerLabel(provider)} отключён`);
      setStatus(null);
    } catch (err) {
      showMsg('err', err instanceof Error ? err.message : 'Не удалось отключить');
    } finally {
      setBusy(null);
    }
  };

  const handleSyncNow = async () => {
    setBusy('sync');
    setMessage(null);
    try {
      const result = await window.electronAPI.syncToCloud();
      const cloud = await window.electronAPI.getCloudSettings();
      setCloudSettings(cloud);
      if (result.success) {
        showMsg('ok', 'Бэкап создан и загружен в облако');
      } else {
        showMsg('err', result.error || 'Не удалось создать бэкап');
      }
      await refreshStatus();
      await refreshVersions(activeTab);
      await refreshQuota(activeTab);
    } catch (err) {
      showMsg('err', err instanceof Error ? err.message : 'Ошибка синхронизации');
    } finally {
      setBusy(null);
    }
  };

  const handleCheck = async () => {
    setBusy('check');
    setMessage(null);
    try {
      const result = await window.electronAPI.checkCloudSync();
      setStatus(result);
      showMsg(result.synced ? 'ok' : 'err', result.message);
      await refreshVersions(activeTab);
    } catch {
      showMsg('err', 'Ошибка проверки синхронизации');
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async (provider: CloudProvider, backupFileName?: string) => {
    const versionHint = backupFileName ? `\nВерсия: ${backupFileName}` : '';
    const ok = window.confirm(
      `Восстановить локальную базу из ${providerLabel(provider)}?${versionHint}\nТекущие пароли на этом компьютере будут заменены данными из облака.`
    );
    if (!ok) return;
    setRestoring(true);
    setMessage(null);
    try {
      const legacy = legacyWinUser.trim() || undefined;
      const recovery = recoveryCode.trim() || undefined;
      const result = await window.electronAPI.restoreFromCloud(
        provider,
        legacy,
        backupFileName,
        recovery
      );
      if (result.success) {
        showMsg('ok', 'Восстановление выполнено. Страница перезагрузится…');
        setTimeout(() => window.location.reload(), 800);
      } else {
        showMsg('err', result.error || 'Не удалось восстановить');
      }
    } catch (err) {
      showMsg('err', err instanceof Error ? err.message : 'Ошибка восстановления');
    } finally {
      setRestoring(false);
    }
  };

  const handleSaveRecovery = async () => {
    setBusy('recovery');
    setMessage(null);
    try {
      const result = await window.electronAPI.configureCloudRecovery(recoveryInput);
      if (result.success) {
        setCloudSettings((prev) => ({
          ...prev,
          status: { ...prev.status, recoveryConfigured: true },
        }));
        setRecoveryInput('');
        showMsg('ok', 'Код восстановления сохранён в облаке');
      } else {
        showMsg('err', result.error || 'Не удалось сохранить код');
      }
    } catch (err) {
      showMsg('err', err instanceof Error ? err.message : 'Ошибка сохранения кода');
    } finally {
      setBusy(null);
    }
  };

  const handleClearRecovery = async () => {
    const ok = window.confirm('Удалить код восстановления из облака?');
    if (!ok) return;
    setBusy('recovery');
    try {
      const result = await window.electronAPI.clearCloudRecovery();
      if (result.success) {
        setCloudSettings((prev) => ({
          ...prev,
          status: { ...prev.status, recoveryConfigured: false },
        }));
        showMsg('ok', 'Код восстановления удалён');
      } else {
        showMsg('err', result.error || 'Не удалось удалить');
      }
    } catch (err) {
      showMsg('err', err instanceof Error ? err.message : 'Ошибка удаления');
    } finally {
      setBusy(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ГБ`;
  };

  const formatQuotaSize = (bytes: number) => {
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} МБ`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ГБ`;
  };

  const lastBackupAt = status?.lastBackupAt || cloudSettings.status?.lastBackupAt;
  const lastError = status?.lastError || cloudSettings.status?.lastError;
  const providerStatus = status?.providers?.find((p) => p.provider === activeTab);

  return (
    <section className="settings-section cloud-backup-section">
      <h3>Облачный бэкап</h3>
      <p className="cloud-backup-lead">Защищённая копия хранилища на Яндекс.Диске или Google Drive</p>

      <div className={`cloud-status-bar ${anyEnabled ? (lastError && !lastBackupAt ? 'is-error' : 'is-ok') : 'is-idle'}`}>
        <div className="cloud-status-icon">
          {anyEnabled ? (
            lastError && !status?.synced ? (
              <AlertCircle size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )
          ) : (
            <Cloud size={18} />
          )}
        </div>
        <div className="cloud-status-text">
          <strong>
            {!anyEnabled
              ? 'Не подключено'
              : status?.isRestorable
                ? 'Готово к восстановлению'
                : lastBackupAt
                  ? 'Синхронизация активна'
                  : 'Ожидает первого бэкапа'}
          </strong>
          <span>Последний бэкап: {formatRelativeTime(lastBackupAt)}</span>
          {lastError && <span className="cloud-status-error">{lastError}</span>}
        </div>
      </div>

      <div className="cloud-provider-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`cloud-provider-tab ${activeTab === 'yandex' ? 'is-active' : ''}`}
          aria-selected={activeTab === 'yandex'}
          onClick={() => setActiveTab('yandex')}
        >
          Яндекс.Диск
          {yandexConnected && <span className="cloud-tab-dot" />}
        </button>
        <button
          type="button"
          role="tab"
          className={`cloud-provider-tab ${activeTab === 'google' ? 'is-active' : ''}`}
          aria-selected={activeTab === 'google'}
          onClick={() => setActiveTab('google')}
        >
          Google Drive
          {googleConnected && <span className="cloud-tab-dot" />}
        </button>
      </div>

      <div className="cloud-provider-panel">
        <label className="toggle-label">
          <span>Включить {providerLabel(activeTab)}</span>
          <div className="toggle-switch">
            <input
              type="checkbox"
              checked={tabEnabled}
              onChange={(e) => {
                const enabled = e.target.checked;
                setCloudSettings((prev) => {
                  if (activeTab === 'yandex') {
                    return {
                      ...prev,
                      yandexDisk: { ...prev.yandexDisk, enabled, path: prev.yandexDisk?.path || 'SafeKey' },
                    };
                  }
                  return {
                    ...prev,
                    googleDrive: { ...prev.googleDrive, enabled },
                  };
                });
              }}
            />
            <span className="toggle-slider"></span>
          </div>
        </label>

        {tabEnabled && (
          <>
            <div className="cloud-connection-row">
              <div className="cloud-connection-state">
                {tabConnected ? (
                  <>
                    <CheckCircle2 size={16} className="cloud-ok-icon" />
                    <span>Подключён</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} className="cloud-warn-icon" />
                    <span>Требуется авторизация</span>
                  </>
                )}
              </div>
              <div className="cloud-connection-actions">
                <button
                  type="button"
                  className="small-button"
                  disabled={!!busy}
                  onClick={() => handleAuthorize(activeTab)}
                >
                  {busy === `auth-${activeTab}`
                    ? '…'
                    : tabConnected
                      ? 'Обновить доступ'
                      : 'Подключить'}
                </button>
                {tabConnected && (
                  <button
                    type="button"
                    className="small-button cloud-disconnect-btn"
                    disabled={!!busy}
                    onClick={() => handleDisconnect(activeTab)}
                    title="Отключить"
                  >
                    <Unplug size={14} />
                  </button>
                )}
              </div>
            </div>

            {activeTab === 'yandex' && (
              <div className="settings-field">
                <label>
                  Папка на диске
                  <input
                    type="text"
                    className="force-interactive-input"
                    placeholder="SafeKey"
                    value={cloudSettings.yandexDisk?.path || ''}
                    onChange={(e) =>
                      setCloudSettings({
                        ...cloudSettings,
                        yandexDisk: {
                          ...cloudSettings.yandexDisk!,
                          enabled: true,
                          path: e.target.value,
                        },
                      })
                    }
                  />
                </label>
              </div>
            )}

            {activeTab === 'google' && tabConnected && (
              <small className="cloud-hint">Папка SafeKey создаётся автоматически</small>
            )}

            {tabConnected && providerStatus && (
              <div className="cloud-remote-meta">
                {providerStatus.isRestorable
                  ? `В облаке: ${providerStatus.backupFile} + ключ`
                  : providerStatus.message}
              </div>
            )}

            {tabConnected && (
              <div className="cloud-quota">
                <div className="cloud-quota-head">
                  <span>Память {providerLabel(activeTab)}</span>
                  <span>
                    {loadingQuota
                      ? '…'
                      : quota
                        ? `${formatQuotaSize(quota.used)} из ${formatQuotaSize(quota.total)}`
                        : 'нет данных'}
                  </span>
                </div>
                <div className="cloud-quota-bar">
                  <div
                    className="cloud-quota-fill"
                    style={{
                      width: quota && quota.total > 0
                        ? `${Math.min(100, Math.round((quota.used / quota.total) * 100))}%`
                        : '0%',
                    }}
                  />
                </div>
                {quota && (
                  <div className="cloud-quota-free">
                    Свободно: {formatQuotaSize(quota.free)}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {anyEnabled && (
        <div className="cloud-actions">
          <button
            type="button"
            className="primary-button cloud-action-btn"
            disabled={!!busy || restoring}
            onClick={handleSyncNow}
          >
            <RefreshCw size={16} />
            {busy === 'sync' ? 'Создание бэкапа…' : 'Создать бэкап сейчас'}
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!!busy || restoring}
            onClick={handleCheck}
          >
            {busy === 'check' ? 'Проверка…' : 'Проверить'}
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!!busy || restoring || !tabConnected}
            onClick={() => handleRestore(activeTab)}
          >
            {restoring ? 'Восстановление…' : `Восстановить последнее`}
          </button>
        </div>
      )}

      {tabEnabled && tabConnected && (
        <div className="cloud-versions">
          <div className="cloud-versions-header">
            <strong>Версии</strong>
            <span>до 7 копий</span>
          </div>
          {loadingVersions ? (
            <div className="cloud-versions-empty">Загрузка…</div>
          ) : versions.length === 0 ? (
            <div className="cloud-versions-empty">Пока нет сохранённых версий</div>
          ) : (
            <ul className="cloud-versions-list">
              {versions.map((v) => (
                <li key={v.file} className={`cloud-version-row ${v.isLatest ? 'is-latest' : ''}`}>
                  <div className="cloud-version-meta">
                    <span className="cloud-version-date">
                      {formatRelativeTime(v.createdAt)}
                      {v.isLatest ? ' · текущая' : ''}
                    </span>
                    <span className="cloud-version-sub">
                      {[formatSize(v.size), v.device].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  {!v.isLatest && (
                    <button
                      type="button"
                      className="small-button"
                      disabled={restoring || !!busy}
                      onClick={() => handleRestore(activeTab, v.file)}
                    >
                      Восстановить
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {message && (
        <div className={`cloud-inline-message is-${message.type}`}>{message.text}</div>
      )}

      <button
        type="button"
        className="cloud-advanced-toggle"
        onClick={() => setShowAdvanced((v) => !v)}
      >
        {showAdvanced ? 'Скрыть дополнительно' : 'Дополнительно'}
      </button>

      {showAdvanced && (
        <div className="cloud-advanced">
          <label>
            Код восстановления (для restore без привязки к Windows)
            <input
              type="password"
              className="force-interactive-input"
              placeholder="Введите код при восстановлении"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
              autoComplete="off"
            />
          </label>
          <small>
            Если имя пользователя Windows изменилось — укажите код, заданный заранее ниже.
          </small>

          <div className="cloud-recovery-setup">
            <label>
              Задать новый код восстановления
              <input
                type="password"
                className="force-interactive-input"
                placeholder="Минимум 6 символов"
                value={recoveryInput}
                onChange={(e) => setRecoveryInput(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <div className="cloud-connection-actions">
              <button
                type="button"
                className="small-button"
                disabled={!!busy || recoveryInput.trim().length < 6 || !anyEnabled}
                onClick={handleSaveRecovery}
              >
                {busy === 'recovery' ? '…' : 'Сохранить в облако'}
              </button>
              {cloudSettings.status?.recoveryConfigured && (
                <button
                  type="button"
                  className="small-button"
                  disabled={!!busy}
                  onClick={handleClearRecovery}
                >
                  Удалить
                </button>
              )}
            </div>
            <small>
              {cloudSettings.status?.recoveryConfigured
                ? 'Код восстановления настроен. Храните его отдельно — в приложении он не сохраняется.'
                : 'Код шифрует ключ хранилища и загружается в облако. Не хранится локально в открытом виде.'}
            </small>
          </div>

          <label>
            Пользователь Windows (если менялся после переустановки)
            <input
              type="text"
              className="force-interactive-input"
              placeholder="Оставьте пустым, если имя не менялось"
              value={legacyWinUser}
              onChange={(e) => setLegacyWinUser(e.target.value)}
            />
          </label>
          <small>
            Альтернатива коду восстановления: укажите старое имя учётной записи Windows.
          </small>
        </div>
      )}
    </section>
  );
}

/** @deprecated use SettingsCloudBackupPanel */
export function SettingsYandexPanel(props: PanelProps) {
  return <SettingsCloudBackupPanel {...props} />;
}

/** @deprecated use SettingsCloudBackupPanel */
export function SettingsGoogleDrivePanel(_props: PanelProps) {
  return null;
}
