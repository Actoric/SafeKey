import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isInitialized: boolean;
  checkAuth: () => Promise<void>;
  login: () => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      console.log('[AuthContext] Инициализация шифрования...');
      await window.electronAPI.initEncryption();
      console.log('[AuthContext] Шифрование инициализировано');
      setIsInitialized(true);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('[AuthContext] Ошибка инициализации:', error);
      setIsInitialized(false);
      setIsAuthenticated(false);
    }
  }, []);

  const login = useCallback(async () => {
    try {
      // Проверяем статус авторизации из main процесса
      const authStatus = await window.electronAPI.checkAuthStatus();
      if (authStatus) {
        console.log('[AuthContext] Пользователь уже авторизован');
        setIsAuthenticated(true);
        return true;
      }
      
      // Если не авторизован, проверяем настройки и используем соответствующий метод
      const settings = await window.electronAPI.getAppSettings();
      const authType = settings.authType || 'windows-pin';
      
      if (authType === 'none') {
        setIsAuthenticated(true);
        return true;
      }
      
      if (authType === 'app-pin') {
        // Для app-pin проверка уже выполнена в PinCodeLogin
        const status = await window.electronAPI.checkAuthStatus();
        setIsAuthenticated(status);
        return status;
      }
      
      // Windows PIN по умолчанию
      console.log('[AuthContext] login вызван, проверка PIN-кода Windows...');
      const result = await window.electronAPI.verifyWindowsPin();
      console.log('[AuthContext] Результат проверки PIN-кода:', result);
      if (result) {
        console.log('[AuthContext] PIN-код проверен, устанавливаем isAuthenticated = true');
        setIsAuthenticated(true);
        console.log('[AuthContext] Состояние обновлено после успешного входа');
      } else {
        console.log('[AuthContext] PIN-код неверный, состояние не изменено');
      }
      return result;
    } catch (error) {
      console.error('[AuthContext] Ошибка входа:', error);
      return false;
    }
  }, []);


  const logout = useCallback(async () => {
    console.log('[AuthContext] Выход из системы');
    setIsAuthenticated(false);
    // Сбрасываем статус авторизации в main процессе
    try {
      await window.electronAPI.resetAuthStatus();
      console.log('[AuthContext] Статус авторизации сброшен в main процессе');
    } catch (error) {
      console.error('[AuthContext] Ошибка сброса статуса авторизации:', error);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isInitialized,
        checkAuth,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

