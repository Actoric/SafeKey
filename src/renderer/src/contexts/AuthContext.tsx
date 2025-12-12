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


  const logout = useCallback(() => {
    console.log('[AuthContext] Выход из системы');
    setIsAuthenticated(false);
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

