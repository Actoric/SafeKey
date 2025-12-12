import { useEffect, useState, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { PinCodeLogin } from './components/PinCodeLogin';
import { MainLayout } from './components/MainLayout';
import { OverlayWindow } from './components/OverlayWindow';
import { TitleBar } from './components/TitleBar';
import { useAuth } from './hooks/useAuth';

function App() {
  const location = useLocation();
  const { isAuthenticated, isInitialized, checkAuth } = useAuth();
  const [loading, setLoading] = useState(true);

  // Логирование изменений состояния для отладки
  useEffect(() => {
    console.log('[App] ⚡ Состояние изменилось - isInitialized:', isInitialized, 'isAuthenticated:', isAuthenticated, 'loading:', loading);
    
    // Если авторизованы, показываем основное приложение
    if (isInitialized && isAuthenticated && !loading) {
      console.log('[App] ✅ Все готово, показываем MainLayout');
    }
  }, [isInitialized, isAuthenticated, loading]);

  useEffect(() => {
    const init = async () => {
      try {
        console.log('[App] Инициализация приложения...');
        console.log('[App] electronAPI доступен:', !!window.electronAPI);
        
        if (!window.electronAPI) {
          console.error('[App] electronAPI не доступен!');
          setLoading(false);
          return;
        }
        
        await window.electronAPI.initDatabase('');
        console.log('[App] База данных инициализирована');
        
        await checkAuth();
        console.log('[App] Проверка авторизации завершена');
        
        setLoading(false);
      } catch (error) {
        console.error('[App] Ошибка инициализации приложения:', error);
        setLoading(false);
      }
    };
    init();
  }, [checkAuth]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Загрузка...</div>
      </div>
    );
  }

  // Оверлей
  if (location.hash === '#overlay') {
    return <OverlayWindow />;
  }

  // Если не авторизован
  if (!isAuthenticated) {
    console.log('[App] Рендерим PinCodeLogin. isInitialized:', isInitialized, 'isAuthenticated:', isAuthenticated);
    return (
      <>
        <TitleBar />
        <PinCodeLogin />
      </>
    );
  }

  console.log('[App] Рендерим MainLayout. isInitialized:', isInitialized, 'isAuthenticated:', isAuthenticated);

  // Основное приложение
  return (
    <>
      <TitleBar />
      <Routes>
        <Route path="*" element={<MainLayout />} />
      </Routes>
    </>
  );
}

export default App;
