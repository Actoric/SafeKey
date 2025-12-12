import { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { PinCodeLogin } from './components/PinCodeLogin';
import { MainLayout } from './components/MainLayout';
import { OverlayWindow } from './components/OverlayWindow';
import { TitleBar } from './components/TitleBar';
import { UpdateProgress } from './components/UpdateProgress';
import { useAuth } from './hooks/useAuth';

function App() {
  const location = useLocation();
  const { isAuthenticated, isInitialized, checkAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [updateStatus, setUpdateStatus] = useState<'checking' | 'downloading' | 'downloaded' | 'error' | 'ready' | null>(null);
  const [updateVersion, setUpdateVersion] = useState<string>('');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateError, setUpdateError] = useState<string>('');

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

  // Обработка событий обновления
  useEffect(() => {
    const handleUpdateChecking = () => {
      setUpdateStatus('checking');
    };

    const handleUpdateAvailable = (event: any, info: any) => {
      setUpdateVersion(info.version);
      setUpdateStatus('downloading');
    };

    const handleUpdateProgress = (event: any, progressObj: any) => {
      setUpdateProgress(progressObj.percent || 0);
    };

    const handleUpdateDownloaded = () => {
      setUpdateStatus('ready');
    };

    const handleUpdateError = (event: any, error: any) => {
      setUpdateError(error.message || 'Неизвестная ошибка');
      setUpdateStatus('error');
    };

    // Подписываемся на события обновления
    if (window.electronAPI && (window.electronAPI as any).ipcRenderer) {
      const ipcRenderer = (window.electronAPI as any).ipcRenderer;
      
      ipcRenderer.on('update-checking', handleUpdateChecking);
      ipcRenderer.on('update-available', handleUpdateAvailable);
      ipcRenderer.on('update-download-progress', handleUpdateProgress);
      ipcRenderer.on('update-downloaded', handleUpdateDownloaded);
      ipcRenderer.on('update-error', handleUpdateError);

      return () => {
        ipcRenderer.removeAllListeners('update-checking');
        ipcRenderer.removeAllListeners('update-available');
        ipcRenderer.removeAllListeners('update-download-progress');
        ipcRenderer.removeAllListeners('update-downloaded');
        ipcRenderer.removeAllListeners('update-error');
      };
    }
  }, []);

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
      {updateStatus && (
        <UpdateProgress
          version={updateVersion}
          progress={updateProgress}
          status={updateStatus}
          error={updateError}
        />
      )}
      <Routes>
        <Route path="*" element={<MainLayout />} />
      </Routes>
    </>
  );
}

export default App;
