import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import './MasterPasswordLogin.css';

export function PinCodeLogin() {
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [username, setUsername] = useState('');
  const [authType, setAuthType] = useState<'windows-pin' | 'app-pin' | 'none'>('windows-pin');
  const [appPin, setAppPin] = useState('');
  const { login } = useAuth();

  useEffect(() => {
    const loadUsername = async () => {
      try {
        if (window.electronAPI && typeof window.electronAPI.getWindowsUsername === 'function') {
          const name = await window.electronAPI.getWindowsUsername();
          setUsername(name);
        } else {
          setUsername('Пользователь');
        }
      } catch (error) {
        console.error('Ошибка получения имени пользователя:', error);
        setUsername('Пользователь');
      }
    };
    loadUsername();

    const loadAuthSettings = async () => {
      try {
        const settings = await window.electronAPI.getAppSettings();
        setAuthType(settings.authType || 'windows-pin');
      } catch (error) {
        console.error('Ошибка загрузки настроек авторизации:', error);
      }
    };
    loadAuthSettings();
  }, []);

  const handleLogin = async () => {
    setError('');
    setIsChecking(true);

    try {
      if (authType === 'app-pin') {
        if (!appPin || appPin.length < 4) {
          setError('PIN-код должен содержать минимум 4 символа');
          setIsChecking(false);
          return;
        }
        const result = await window.electronAPI.verifyAppPin(appPin);
        if (result) {
          await login();
        } else {
          setError('Неверный PIN-код');
        }
      } else {
        const result = await login();
        if (!result) {
          setError('PIN-код неверный или вход отменен');
        }
      }
    } catch (err) {
      console.error('[PinCodeLogin] Ошибка при входе:', err);
      setError('Ошибка при входе: ' + (err instanceof Error ? err.message : 'Неизвестная ошибка'));
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="master-password-container">
      <div className="master-password-shell">
        <aside className="master-password-visual">
          <div className="master-password-eyebrow">Keystone</div>
          <h1>Ваши ключи. Только у вас.</h1>
          <p>Локальное шифрование, облачный бэкап по желанию — без аккаунта SafeKey в облаке.</p>
          <div className="master-password-stats">
            <div><span>Шифрование</span><strong>AES-256</strong></div>
            <div><span>Бэкап</span><strong>Яндекс / Google</strong></div>
            <div><span>Оверлей</span><strong>Ctrl+Shift+P</strong></div>
          </div>
        </aside>

        <div className="master-password-card">
          <h2>Вход</h2>
          {username && (
            <p className="welcome-message">Добро пожаловать, {username}</p>
          )}
          <p className="subtitle">
            {isChecking
              ? (authType === 'app-pin' ? 'Проверка PIN-кода…' : 'Проверка PIN-кода Windows…')
              : (authType === 'app-pin' ? 'Введите PIN-код приложения' : 'Подтвердите доступ через Windows Hello')}
          </p>
          <p className="description">
            {isChecking
              ? (authType === 'app-pin' ? 'Проверяем PIN…' : 'Ожидание подтверждения через Windows Hello…')
              : (authType === 'app-pin'
                  ? 'Введите PIN-код приложения для доступа к хранилищу'
                  : 'Нажмите кнопку ниже, чтобы войти с PIN-кодом Windows.')}
          </p>

          {authType === 'app-pin' && !isChecking && (
            <input
              type="password"
              className="pin-input"
              value={appPin}
              onChange={(e) => setAppPin(e.target.value)}
              placeholder="PIN-код"
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleLogin();
              }}
              autoFocus
            />
          )}

          {error && <div className="error-message">{error}</div>}

          {!isChecking && (
            <button
              type="button"
              className="primary-button"
              onClick={handleLogin}
              disabled={authType === 'app-pin' && (!appPin || appPin.length < 4)}
            >
              {authType === 'app-pin' ? 'Разблокировать' : 'Войти с Windows Hello'}
            </button>
          )}

          {isChecking && (
            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <div className="login-spinner" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
