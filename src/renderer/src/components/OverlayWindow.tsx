import { useState, useEffect } from 'react';
import { Search, X, Copy, Eye, EyeOff, User, Globe, Lock } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import { useTranslation } from '../hooks/useTranslation';
import './OverlayWindow.css';

export function OverlayWindow() {
  const t = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [passwords, setPasswords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedPasswords, setExpandedPasswords] = useState<Set<number>>(new Set());
  const [visiblePasswords, setVisiblePasswords] = useState<Set<number>>(new Set());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authType, setAuthType] = useState<'windows-pin' | 'app-pin' | 'none'>('windows-pin');
  const [appPin, setAppPin] = useState('');
  const [showAppPinInput, setShowAppPinInput] = useState(false);

  useEffect(() => {
    // Убираем белый фон у body и html
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
    document.body.classList.add('overlay-mode');
    document.documentElement.classList.add('overlay-mode');

    // Загружаем настройки и проверяем авторизацию
    loadAuthSettings();

    return () => {
      // Восстанавливаем фон при размонтировании
      document.body.style.background = '';
      document.documentElement.style.background = '';
      document.body.classList.remove('overlay-mode');
      document.documentElement.classList.remove('overlay-mode');
    };
  }, []);

  const loadAuthSettings = async () => {
    try {
      const settings = await window.electronAPI.getAppSettings();
      const type = settings.authType || 'windows-pin';
      setAuthType(type);
      
      // Проверяем статус авторизации в основном окне
      const authStatus = await window.electronAPI.checkAuthStatus();
      console.log('[OverlayWindow] Загружаем настройки, тип авторизации:', type, 'Статус в основном окне:', authStatus);
      
      // Если авторизация отключена, разрешаем доступ
      if (type === 'none') {
        setIsAuthenticated(true);
        loadPasswords();
        setIsCheckingAuth(false);
        return;
      }
      
      // Если пользователь авторизован в основном окне, разрешаем доступ к оверлею без проверки
      if (authStatus) {
        console.log('[OverlayWindow] Пользователь авторизован в основном окне, разрешаем доступ к оверлею');
        setIsAuthenticated(true);
        loadPasswords();
        setIsCheckingAuth(false);
        return;
      }
      
      // Если пользователь НЕ авторизован, показываем диалог авторизации
      console.log('[OverlayWindow] Пользователь НЕ авторизован, показываем диалог авторизации');
      await checkAuth(type);
    } catch (error) {
      console.error('Ошибка загрузки настроек авторизации:', error);
      setIsAuthenticated(false);
      setIsCheckingAuth(false);
    }
  };

  const checkAuth = async (type: 'windows-pin' | 'app-pin' | 'none' = authType) => {
    setIsCheckingAuth(true);
    setAuthError('');
    
    if (type === 'none') {
      setIsAuthenticated(true);
      loadPasswords();
      setIsCheckingAuth(false);
      return;
    }

    if (type === 'app-pin') {
      // Показываем диалог ввода PIN-кода приложения
      setShowAppPinInput(true);
      setIsCheckingAuth(false);
      return;
    }

    // Windows PIN
    try {
      const verified = await window.electronAPI.verifyWindowsPin();
      if (verified) {
        setIsAuthenticated(true);
        // Устанавливаем статус авторизации в main процессе
        await window.electronAPI.setAuthStatus(true);
        console.log('[OverlayWindow] Авторизация в оверлее успешна, программа авторизована');
        loadPasswords();
      } else {
        setIsAuthenticated(false);
        setAuthError('Аутентификация не подтверждена');
      }
    } catch (error) {
      console.error('Ошибка проверки авторизации в оверлее:', error);
      setIsAuthenticated(false);
      setAuthError('Ошибка при проверке авторизации');
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleAppPinSubmit = async () => {
    if (!appPin || appPin.length < 4) {
      setAuthError('PIN-код должен содержать минимум 4 символа');
      return;
    }

    setIsCheckingAuth(true);
    setAuthError('');

    try {
      const verified = await window.electronAPI.verifyAppPin(appPin);
      if (verified) {
        setIsAuthenticated(true);
        setShowAppPinInput(false);
        setAppPin('');
        // Устанавливаем статус авторизации в main процессе
        await window.electronAPI.setAuthStatus(true);
        console.log('[OverlayWindow] Авторизация в оверлее успешна, программа авторизована');
        loadPasswords();
      } else {
        setAuthError('Неверный PIN-код');
        setAppPin('');
      }
    } catch (error) {
      console.error('Ошибка проверки PIN-кода приложения:', error);
      setAuthError('Ошибка при проверке PIN-кода');
      setAppPin('');
    } finally {
      setIsCheckingAuth(false);
    }
  };


  const loadPasswords = async () => {
    try {
      const entries = await window.electronAPI.getPasswordEntries();
      setPasswords(entries);
    } catch (error) {
      console.error('Ошибка загрузки паролей:', error);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      setLoading(true);
      try {
        const results = await window.electronAPI.searchPasswords(query);
        setPasswords(results);
      } catch (error) {
        console.error('Ошибка поиска:', error);
      } finally {
        setLoading(false);
      }
    } else {
      loadPasswords();
    }
  };

  const handleCopy = async (text: string) => {
    await copyToClipboard(text);
    // Показываем уведомление о копировании
    const notification = document.createElement('div');
    notification.className = 'overlay-notification';
    notification.textContent = t.common.copied;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.remove();
    }, 2000);
  };

  const toggleExpand = (id: number) => {
    const newExpanded = new Set(expandedPasswords);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedPasswords(newExpanded);
  };

  const togglePasswordVisibility = (id: number) => {
    const newVisible = new Set(visiblePasswords);
    if (newVisible.has(id)) {
      newVisible.delete(id);
    } else {
      newVisible.add(id);
    }
    setVisiblePasswords(newVisible);
  };

  // Показываем все пароли без фильтрации по приложению
  const filteredPasswords = passwords;

  // Не ограничиваем количество - показываем все отфильтрованные пароли
  // Высота контейнера ограничена в CSS для показа только 4 элементов с возможностью скролла

  // Если проверяем авторизацию, показываем загрузку
  if (isCheckingAuth) {
    return (
      <div className="overlay-window">
        <div className="overlay-content">
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '40px',
            textAlign: 'center'
          }}>
            <Lock size={32} style={{ marginBottom: '16px', opacity: 0.7 }} />
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Проверка авторизации...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Если не авторизован, показываем экран авторизации
  if (!isAuthenticated || showAppPinInput) {
    return (
      <div className="overlay-window">
        <div className="overlay-content">
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '40px',
            textAlign: 'center'
          }}>
            <Lock size={32} style={{ marginBottom: '16px', opacity: 0.7 }} />
            <div style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '8px', fontWeight: 500 }}>
              {showAppPinInput ? 'Введите PIN-код приложения' : 'Требуется авторизация'}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              {showAppPinInput 
                ? 'Для доступа к паролям введите PIN-код приложения'
                : 'Для доступа к паролям необходимо подтвердить вашу личность'}
            </div>
            {showAppPinInput ? (
              <>
                <input
                  type="password"
                  value={appPin}
                  onChange={(e) => setAppPin(e.target.value)}
                  placeholder="PIN-код"
                  style={{
                    width: '200px',
                    padding: '10px',
                    marginBottom: '12px',
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
                      handleAppPinSubmit();
                    }
                  }}
                  autoFocus
                />
                {authError && (
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#e74c3c', 
                    marginBottom: '16px',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    borderRadius: '4px'
                  }}>
                    {authError}
                  </div>
                )}
                <button
                  onClick={handleAppPinSubmit}
                  disabled={isCheckingAuth}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'var(--primary-color)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isCheckingAuth ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    opacity: isCheckingAuth ? 0.6 : 1,
                    transition: 'background-color 0.2s'
                  }}
                >
                  {isCheckingAuth ? 'Проверка...' : 'Войти'}
                </button>
              </>
            ) : (
              <>
                {authError && (
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#e74c3c', 
                    marginBottom: '16px',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    borderRadius: '4px'
                  }}>
                    {authError}
                  </div>
                )}
                <button
                  onClick={() => checkAuth(authType)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'var(--primary-color)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-color-hover)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-color)'}
                >
                  {authType === 'windows-pin' ? 'Войти с Windows Hello' : 'Войти'}
                </button>
              </>
            )}
            <button
              onClick={() => window.close()}
              style={{
                padding: '8px 16px',
                marginTop: '12px',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay-window">
      <div className="overlay-content">
        <div className="overlay-header">
          <div className="overlay-search">
            <Search size={18} />
            <input
              type="text"
              placeholder={t.overlay.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
          </div>
          <button
            className="overlay-close"
            onClick={() => window.close()}
          >
            <X size={18} />
          </button>
        </div>

        <div className="overlay-results">
          {loading ? (
            <div className="overlay-loading">{t.overlay.searching}</div>
          ) : filteredPasswords.length === 0 ? (
            <div className="overlay-empty">{t.overlay.noResults}</div>
          ) : (
            filteredPasswords.map((password) => {
              const isExpanded = expandedPasswords.has(password.id);
              const isPasswordVisible = visiblePasswords.has(password.id);
              return (
                <div key={password.id} className={`overlay-item ${isExpanded ? 'expanded' : ''}`}>
                  <div className="overlay-item-header" onClick={() => toggleExpand(password.id)}>
                    <div className="overlay-item-info">
                      <div className="overlay-item-title">{password.data?.service || password.title || t.passwords.service}</div>
                      <div className="overlay-item-subtitle">{password.data?.login || t.passwords.login}</div>
                    </div>
                    <div className="overlay-item-actions">
                      <button
                        className="overlay-action-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(password.data?.password || '');
                        }}
                        title="Копировать пароль"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="overlay-item-details">
                      <div className="overlay-detail-row">
                        <span className="overlay-detail-label"><User size={14} /> {t.passwords.login}:</span>
                        <div className="overlay-detail-value">
                          <span>{password.data?.login || t.passwords.login}</span>
                          {password.data?.login && (
                            <button
                              className="overlay-copy-btn"
                              onClick={() => handleCopy(password.data.login)}
                              title={t.passwords.copyLogin}
                            >
                              <Copy size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="overlay-detail-row">
                        <span className="overlay-detail-label">{t.passwords.password}:</span>
                        <div className="overlay-detail-value">
                          <span className="overlay-password">
                            {isPasswordVisible ? (password.data?.password || '') : '••••••••'}
                          </span>
                          <div className="overlay-password-actions">
                            <button
                              className="overlay-copy-btn"
                              onClick={() => handleCopy(password.data?.password || '')}
                              title={t.passwords.copyPassword}
                            >
                              <Copy size={12} />
                            </button>
                            <button
                              className="overlay-copy-btn"
                              onClick={() => togglePasswordVisibility(password.id)}
                              title={isPasswordVisible ? t.passwords.hidePassword : t.passwords.showPassword}
                            >
                              {isPasswordVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          </div>
                        </div>
                      </div>
                      {password.data?.url && (
                        <div className="overlay-detail-row">
                          <span className="overlay-detail-label"><Globe size={14} /> {t.passwords.url}:</span>
                          <div className="overlay-detail-value">
                            <span className="overlay-url">{password.data.url}</span>
                            <button
                              className="overlay-copy-btn"
                              onClick={() => handleCopy(password.data.url)}
                              title={t.passwords.copyUrl}
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                      {password.data?.notes && (
                        <div className="overlay-detail-row">
                          <span className="overlay-detail-label">{t.passwords.notes}:</span>
                          <div className="overlay-detail-value">
                            <span>{password.data.notes}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
