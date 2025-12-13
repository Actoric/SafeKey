import { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { PinCodeLogin } from './components/PinCodeLogin';
import { MainLayout } from './components/MainLayout';
import { OverlayWindow } from './components/OverlayWindow';
import { TitleBar } from './components/TitleBar';
import { UpdateProgress } from './components/UpdateProgress';
import { Toast, ToastType } from './components/Toast';
import { useAuth } from './hooks/useAuth';

function App() {
  const location = useLocation();
  const { isAuthenticated, isInitialized, checkAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [updateStatus, setUpdateStatus] = useState<'checking' | 'downloading' | 'downloaded' | 'error' | 'ready' | 'completed' | null>(null);
  const [updateVersion, setUpdateVersion] = useState<string>('');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateError, setUpdateError] = useState<string>('');
  const [updateResultMessage, setUpdateResultMessage] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

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
    let checkingTimeout: NodeJS.Timeout | null = null;
    
    const handleUpdateChecking = () => {
      console.log('[App] Обновление: проверка...');
      setUpdateStatus('checking');
      setUpdateError('');
      
      // Устанавливаем таймаут на 30 секунд
      if (checkingTimeout) {
        clearTimeout(checkingTimeout);
      }
      checkingTimeout = setTimeout(() => {
        console.log('[App] Таймаут проверки обновлений (30 секунд)');
        setUpdateStatus(null);
        setUpdateError('Проверка обновлений заняла слишком много времени. Попробуйте позже.');
      }, 30000);
    };

    const handleUpdateAvailable = (_event: any, info: any) => {
      console.log('[App] Обновление доступно:', info?.version);
      if (checkingTimeout) {
        clearTimeout(checkingTimeout);
        checkingTimeout = null;
      }
      setUpdateVersion(info?.version || '');
      setUpdateStatus('downloading');
      setToast({ 
        message: `Доступно обновление до версии ${info?.version || 'новой'}. Начинается загрузка...`, 
        type: 'success' 
      });
    };

    const handleUpdateProgress = (_event: any, progressObj: any) => {
      const percent = progressObj?.percent || 0;
      setUpdateProgress(percent);
      console.log('[App] Прогресс обновления:', percent + '%');
    };

    const handleUpdateDownloaded = () => {
      console.log('[App] Обновление загружено');
      setUpdateStatus('ready');
      setToast({ 
        message: 'Обновление загружено! Приложение будет перезапущено через несколько секунд.', 
        type: 'success' 
      });
    };

    const handleUpdateError = (_event: any, error: any) => {
      console.error('[App] Ошибка обновления:', error);
      if (checkingTimeout) {
        clearTimeout(checkingTimeout);
        checkingTimeout = null;
      }
      
      const errorMessage = error?.message || error?.toString() || 'Неизвестная ошибка';
      
      // Проверяем, не является ли это просто отсутствием обновлений
      const isNoUpdateError = 
        errorMessage.includes('No update available') ||
        errorMessage.includes('not available') ||
        errorMessage.includes('already the latest version') ||
        errorMessage.includes('latest version') ||
        errorMessage.includes('404') ||
        errorMessage.includes('Not Found');
      
      if (isNoUpdateError) {
        // Это не ошибка, просто нет обновлений
        console.log('[App] Обновления не найдены (обработано как отсутствие обновлений)');
        setUpdateStatus(null);
        setUpdateError('');
        return;
      }
      
      // Реальная ошибка - показываем только серьезные ошибки
      // Игнорируем ошибки сети при тихой проверке
      if (errorMessage.includes('net::ERR_INTERNET_DISCONNECTED') || 
          errorMessage.includes('network') ||
          errorMessage.includes('timeout')) {
        console.log('[App] Ошибка сети при проверке обновлений, игнорируем');
        setUpdateStatus(null);
        setUpdateError('');
        setToast({ 
          message: 'Не удалось проверить обновления. Проверьте подключение к интернету.', 
          type: 'error' 
        });
        return;
      }
      
      setUpdateError(errorMessage);
      setUpdateStatus('error');
      setToast({ 
        message: `Ошибка обновления: ${errorMessage}. Пожалуйста, сообщите об этой проблеме разработчикам.`, 
        type: 'error' 
      });
    };

    const handleUpdateNotAvailable = () => {
      console.log('[App] Обновления не найдены - программа максимальной версии');
      if (checkingTimeout) {
        clearTimeout(checkingTimeout);
        checkingTimeout = null;
      }
      // Показываем результат на 3 секунды перед закрытием
      setUpdateResultMessage('Программа обновлена до последней версии');
      setUpdateStatus('completed');
      setUpdateError('');
      setToast({ 
        message: 'Программа обновлена до последней версии', 
        type: 'success' 
      });
      
      // Закрываем окно через 3 секунды
      setTimeout(() => {
        setUpdateStatus(null);
        setUpdateResultMessage('');
      }, 3000);
    };

    // Подписываемся на события обновления
    if (window.electronAPI && (window.electronAPI as any).ipcRenderer) {
      const ipcRenderer = (window.electronAPI as any).ipcRenderer;
      
      console.log('[App] Подписка на события обновления');
      ipcRenderer.on('update-checking', handleUpdateChecking);
      ipcRenderer.on('update-available', handleUpdateAvailable);
      ipcRenderer.on('update-download-progress', handleUpdateProgress);
      ipcRenderer.on('update-downloaded', handleUpdateDownloaded);
      ipcRenderer.on('update-error', handleUpdateError);
      ipcRenderer.on('update-not-available', handleUpdateNotAvailable);

      return () => {
        if (checkingTimeout) {
          clearTimeout(checkingTimeout);
        }
        ipcRenderer.removeAllListeners('update-checking');
        ipcRenderer.removeAllListeners('update-available');
        ipcRenderer.removeAllListeners('update-download-progress');
        ipcRenderer.removeAllListeners('update-downloaded');
        ipcRenderer.removeAllListeners('update-error');
        ipcRenderer.removeAllListeners('update-not-available');
      };
    } else {
      console.warn('[App] ipcRenderer недоступен для событий обновления');
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

  // Если идет обновление, показываем только UI обновления
  if (updateStatus) {
    return (
      <>
        <TitleBar />
        <UpdateProgress
          version={updateVersion}
          progress={updateProgress}
          status={updateStatus}
          error={updateError}
          resultMessage={updateResultMessage}
        />
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
            duration={toast.type === 'error' ? 8000 : 5000}
          />
        )}
      </>
    );
  }

  // Основное приложение
  return (
    <>
      <TitleBar />
      <Routes>
        <Route path="*" element={<MainLayout />} />
      </Routes>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          duration={toast.type === 'error' ? 8000 : 5000}
        />
      )}
    </>
  );
}

export default App;
