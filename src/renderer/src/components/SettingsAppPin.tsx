import { useState, useEffect } from 'react';
import './Settings.css';

export function SettingsAppPin() {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isPinSet, setIsPinSet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    void checkPinStatus();
  }, []);

  const checkPinStatus = async () => {
    try {
      const pinSet = await window.electronAPI.checkAppPinSet();
      setIsPinSet(pinSet);
    } catch (e) {
      console.error(e);
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
    } catch (e) {
      setError('Ошибка: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePin = async () => {
    if (!currentPin) {
      setError('Введите текущий PIN-код');
      return;
    }
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
    } catch (e) {
      setError('Ошибка: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const handleClearPin = async () => {
    if (!currentPin) {
      setError('Введите текущий PIN-код для подтверждения');
      return;
    }
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
    } catch (e) {
      setError('Ошибка: ' + (e instanceof Error ? e.message : String(e)));
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
          <div style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-primary)' }}>PIN-код установлен</div>
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
          {error && <div style={{ fontSize: '12px', color: '#e74c3c', marginBottom: '12px' }}>{error}</div>}
          {success && <div style={{ fontSize: '12px', color: '#27ae60', marginBottom: '12px' }}>{success}</div>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="small-button"
              onClick={() => void handleChangePin()}
              disabled={saving || !newPin || !confirmPin}
            >
              Изменить PIN
            </button>
            <button
              type="button"
              className="small-button"
              onClick={() => void handleClearPin()}
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
          {error && <div style={{ fontSize: '12px', color: '#e74c3c', marginBottom: '12px' }}>{error}</div>}
          {success && <div style={{ fontSize: '12px', color: '#27ae60', marginBottom: '12px' }}>{success}</div>}
          <button
            type="button"
            className="small-button"
            onClick={() => void handleSetPin()}
            disabled={saving || !newPin || !confirmPin}
          >
            Установить PIN
          </button>
        </>
      )}
    </div>
  );
}
