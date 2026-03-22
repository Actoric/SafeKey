import { useState, useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import { mobileAPI } from '../api/mobile-bridge';
import '../MobileLayout.css';

type Step = 'choose' | 'restore_wait' | 'password' | 'create_password' | 'error';

interface MobileLoginProps {
  onSuccess: () => void;
}

export function MobileLogin({ onSuccess }: MobileLoginProps) {
  const [step, setStep] = useState<Step>('choose');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pendingRestore, setPendingRestore] = useState<{ keyData: { salt: string; keyHash: string }; backupText: string } | null>(null);

  useEffect(() => {
    let listener: { remove: () => Promise<void> } | null = null;
    if (step === 'restore_wait') {
      CapApp.addListener('appUrlOpen', async (event) => {
        const url = event.url;
        const match = url.match(/[?&]code=([^&]+)/);
        if (match) {
          const code = decodeURIComponent(match[1]);
          const result = await mobileAPI.restoreFromCloud(code);
          if (result.success) {
            setPendingRestore({ keyData: result.keyData, backupText: result.backupText });
            setStep('password');
          } else {
            setError(result.error || 'Ошибка восстановления');
            setStep('error');
          }
        }
      }).then((l) => { listener = l; });
    }
    return () => {
      listener?.remove();
    };
  }, [step]);

  const [hasKey, setHasKey] = useState(false);
  useEffect(() => {
    mobileAPI.hasStoredKeyData().then(setHasKey);
  }, []);

  const handleRestoreFromCloud = async () => {
    setError('');
    setStep('restore_wait');
    await mobileAPI.openYandexOAuth();
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (pendingRestore) {
      const ok = await mobileAPI.verifyAndLoadDb(password, pendingRestore.keyData, pendingRestore.backupText);
      if (ok) {
        setPendingRestore(null);
        setPassword('');
        onSuccess();
      } else {
        setError('Неверный мастер-пароль');
      }
      return;
    }
    if (step === 'password' && hasKey) {
      const ok = await mobileAPI.tryUnlockWithStoredKey(password);
      if (ok) {
        setPassword('');
        onSuccess();
      } else {
        setError('Неверный мастер-пароль');
      }
    }
  };

  const handleCreateNew = () => {
    setError('');
    setStep('create_password');
    setPassword('');
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 4) {
      setError('Пароль не менее 4 символов');
      return;
    }
    setError('');
    const ok = await mobileAPI.createNewVault(password);
    if (ok) {
      setPassword('');
      onSuccess();
    } else {
      setError('Ошибка создания хранилища');
    }
  };

  return (
    <div className="mobile-page mobile-container">
      <h1 className="mobile-title">SafeKey</h1>
      <p className="mobile-subtitle">Менеджер паролей</p>

      {step === 'choose' && (
        <>
          {hasKey && (
            <button type="button" onClick={() => setStep('password')} className="mobile-btn mobile-btn-primary" style={{ marginBottom: '0.75rem' }}>
              Войти по мастер-паролю
            </button>
          )}
          <button type="button" onClick={handleRestoreFromCloud} className="mobile-btn mobile-btn-secondary" style={{ marginBottom: '0.75rem' }}>
            Восстановить из облака (Яндекс.Диск)
          </button>
          <button type="button" onClick={handleCreateNew} className="mobile-btn mobile-btn-secondary">
            Создать новое хранилище
          </button>
        </>
      )}

      {step === 'restore_wait' && (
        <p className="mobile-subtitle" style={{ marginBottom: 0 }}>
          Авторизуйтесь в Яндексе в открывшемся окне. После этого вернитесь сюда — данные подгрузятся автоматически.
        </p>
      )}

      {(step === 'password' || step === 'create_password') && (
        <form onSubmit={step === 'create_password' ? handleCreateSubmit : handlePasswordSubmit} className="mobile-form">
          <label>
            <span className="mobile-label">{step === 'create_password' ? 'Придумайте мастер-пароль' : 'Мастер-пароль'}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={step === 'create_password' ? 'new-password' : 'current-password'}
              className="mobile-input"
            />
          </label>
          <div className="mobile-form-actions">
            <button type="submit" className="mobile-btn mobile-btn-primary">
              {step === 'create_password' ? 'Создать' : 'Войти'}
            </button>
            {step === 'password' && (
              <button type="button" onClick={() => { setStep('choose'); setPendingRestore(null); setPassword(''); setError(''); }} className="mobile-btn mobile-btn-ghost">
                Назад
              </button>
            )}
          </div>
        </form>
      )}

      {step === 'error' && (
        <>
          <p className="mobile-error" style={{ marginBottom: '1rem' }}>{error}</p>
          <button type="button" onClick={() => { setStep('choose'); setError(''); }} className="mobile-btn mobile-btn-primary">
            Назад
          </button>
        </>
      )}

      {error && step !== 'error' && <p className="mobile-error">{error}</p>}
    </div>
  );
}
