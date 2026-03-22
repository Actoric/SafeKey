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
    // Получаем имя пользователя Windows через IPC
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

    // Загружаем настройки авторизации
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
        console.log('[PinCodeLogin] Запуск проверки PIN-кода приложения...');
        const result = await window.electronAPI.verifyAppPin(appPin);
        if (result) {
          // Обновляем состояние через login
          await login();
        } else {
          setError('Неверный PIN-код');
        }
      } else {
        console.log('[PinCodeLogin] Запуск проверки PIN-кода Windows...');
        const result = await login();
        if (!result) {
          console.log('[PinCodeLogin] PIN-код неверный или отменен');
          setError('PIN-код неверный или вход отменен');
        } else {
          console.log('[PinCodeLogin] Вход успешен');
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
      <div className="master-password-card">
        <h1>SafeKey</h1>
        {username && (
          <p className="welcome-message" style={{ fontSize: '16px', margin: '0 0 12px 0', padding: 0, color: 'var(--text-primary)', textAlign: 'center', lineHeight: '1.4' }}>
            Добро пожаловать, {username}!
          </p>
        )}
        <p className="subtitle">
          {isChecking 
            ? (authType === 'app-pin' ? 'Проверка PIN-кода...' : 'Проверка PIN-кода Windows...')
            : (authType === 'app-pin' ? 'Введите PIN-код приложения' : 'Введите PIN-код Windows')}
        </p>
        <p className="description">
          {isChecking 
            ? (authType === 'app-pin' ? 'Проверка PIN-кода...' : 'Ожидание подтверждения PIN-кода через Windows Hello...')
            : (authType === 'app-pin' 
                ? 'Введите PIN-код приложения для доступа к программе'
                : 'Нажмите кнопку ниже, чтобы войти с помощью PIN-кода Windows. Если PIN-код не установлен, вход будет выполнен автоматически.')}
        </p>

        {authType === 'app-pin' && !isChecking && (
          <div style={{ marginBottom: '16px' }}>
            <input
              type="password"
              value={appPin}
              onChange={(e) => setAppPin(e.target.value)}
              placeholder="PIN-код"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '16px',
                textAlign: 'center',
                letterSpacing: '4px',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleLogin();
                }
              }}
              autoFocus
            />
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        {!isChecking && (
          <button 
            type="button" 
            className="primary-button"
            onClick={handleLogin}
            disabled={authType === 'app-pin' && (!appPin || appPin.length < 4)}
          >
            {authType === 'app-pin' ? 'Войти' : 'Войти с PIN-кодом Windows'}
          </button>
        )}

        {isChecking && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <div style={{ 
              display: 'inline-block',
              width: '40px',
              height: '40px',
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #3498db',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}
      </div>
    </div>
  );
}

