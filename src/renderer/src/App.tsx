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
  const [updateStatus, setUpdateStatus] = useState<'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'ready' | 'completed' | null>(null);
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

    const handleUpdateAvailable = (info: any) => {
      console.log('[App] Обновление доступно (raw):', info);
      console.log('[App] Тип info:', typeof info);
      console.log('[App] Info JSON:', JSON.stringify(info, null, 2));
      
      // Проверяем, что данные действительно пришли
      if (!info) {
        console.warn('[App] ⚠️ Событие update-available получено, но данные отсутствуют (info is null/undefined)');
        return;
      }
      
      // Извлекаем версию из разных возможных форматов
      let version = '';
      if (typeof info === 'string') {
        version = info;
      } else if (info && typeof info === 'object') {
        version = info.version || info.releaseVersion || info.tag || '';
      }
      
      console.log('[App] Извлеченная версия:', version);
      
      if (checkingTimeout) {
        clearTimeout(checkingTimeout);
        checkingTimeout = null;
      }
      
      // Устанавливаем статус 'available' - показываем окно с кнопкой "Обновить"
      setUpdateVersion(version || 'новой версии');
      setUpdateStatus('available'); // Показываем окно с кнопкой "Обновить"
    };

    const handleUpdateProgress = (progressObj: any) => {
      const percent = progressObj?.percent || 0;
      setUpdateProgress(percent);
      console.log('[App] Прогресс обновления:', percent + '%');
    };

    const handleUpdateDownloaded = () => {
      console.log('[App] Обновление загружено');
      setUpdateStatus('ready');
      setToast({ 
        message: 'Обновление загружено! Приложение будет перезапущено через 3 секунды...', 
        type: 'success' 
      });
      // Статус 'ready' означает, что обновление готово к установке
      // Установка произойдет автоматически через 3 секунды в main процессе
    };

    const handleUpdateError = (error: any) => {
      console.error('[App] Ошибка обновления (raw):', error);
      console.error('[App] Тип ошибки:', typeof error);
      console.error('[App] Ошибка JSON:', JSON.stringify(error, null, 2));
      
      if (checkingTimeout) {
        clearTimeout(checkingTimeout);
        checkingTimeout = null;
      }
      
      // Обрабатываем разные форматы ошибки
      let errorMessage = 'Неизвестная ошибка';
      if (error === null || error === undefined) {
        // Если ошибка undefined, возможно это ошибка app-update.yml, которая уже обработана
        // Проверяем контекст - если это происходит после начала загрузки, игнорируем
        console.log('[App] Ошибка undefined - возможно это app-update.yml, игнорируем');
        setUpdateStatus(null);
        setUpdateError('');
        return;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (typeof error === 'object') {
        // Пытаемся извлечь сообщение из разных полей
        errorMessage = error.message || 
                      error.error || 
                      error.err || 
                      error.toString() || 
                      JSON.stringify(error) || 
                      'Неизвестная ошибка';
      } else {
        errorMessage = String(error);
      }
      
      console.log('[App] Обработанное сообщение об ошибке:', errorMessage);
      
      // Игнорируем ошибку app-update.yml (это нормально, если обновление еще не загружено)
      // Проверяем в разных форматах и регистрах
      const errorMessageLower = errorMessage.toLowerCase();
      const isAppUpdateYmlError = 
        errorMessage.includes('app-update.yml') ||
        errorMessage.includes('app-update') ||
        errorMessageLower.includes('app-update.yml') ||
        errorMessageLower.includes('app-update') ||
        (errorMessage.includes('ENOENT') && (errorMessage.includes('app-update') || errorMessage.includes('update') || errorMessageLower.includes('app-update'))) ||
        (errorMessageLower.includes('enoent') && (errorMessageLower.includes('app-update') || errorMessageLower.includes('update')));
      
      // Специальная обработка ошибки отсутствия latest.yml
      const isLatestYmlError = 
        (errorMessage.includes('latest.yml') || errorMessage.includes('Cannot find latest.yml')) &&
        !errorMessage.includes('Download not started'); // "Download not started" не означает, что latest.yml не найден
      
      // Ошибка "Download not started" - это означает, что загрузка не началась, но latest.yml может быть найден
      const isDownloadNotStartedError = 
        errorMessage.includes('Download not started') ||
        errorMessage.includes('no download-progress event');
      
      // Проверяем, не является ли это просто отсутствием обновлений
      const isNoUpdateError = 
        errorMessage.includes('No update available') ||
        errorMessage.includes('not available') ||
        errorMessage.includes('already the latest version') ||
        errorMessage.includes('latest version') ||
        (errorMessage.includes('404') && !errorMessage.includes('latest.yml')) ||
        (errorMessage.includes('Not Found') && !errorMessage.includes('latest.yml'));
      
      // Игнорируем ошибку "App not packaged" - это нормально для dev/unpacked
      const isAppNotPackagedError = 
        errorMessage.includes('App not packaged') ||
        errorMessage.includes('not packaged') ||
        errorMessage.includes('dev/unpacked');
      
      if (isAppNotPackagedError) {
        // Приложение не установлено - обновления недоступны, это нормально
        console.log('[App] Обновления недоступны в dev/unpacked режиме (это нормально)');
        setUpdateStatus(null);
        setUpdateError('');
        // НЕ показываем toast, чтобы не беспокоить пользователя
        return;
      }
      
      if (isAppUpdateYmlError) {
        // Ошибка app-update.yml - это нормально, файл создается после загрузки
        console.log('[App] Игнорируем ошибку app-update.yml (это нормально, файл создается после загрузки)');
        console.log('[App] Ожидаем событие download-progress...');
        // НЕ закрываем окно обновления, НЕ устанавливаем статус error
        // Продолжаем показывать статус "downloading" и ожидаем download-progress
        // Если статус еще не установлен, устанавливаем "downloading"
        if (updateStatus === null || updateStatus === 'checking') {
          setUpdateStatus('downloading');
        }
        setUpdateError('');
        return;
      }
      
      if (isDownloadNotStartedError) {
        // Ошибка "Download not started" - загрузка не началась, но latest.yml может быть найден
        console.log('[App] Ошибка: загрузка не началась');
        console.log('[App] Это может быть из-за проблем с доступом к файлу или форматом latest.yml');
        setUpdateError('Загрузка обновления не началась. Проверьте подключение к интернету и попробуйте позже.');
        setUpdateStatus('error');
        setToast({ 
          message: 'Не удалось начать загрузку обновления. Проверьте подключение к интернету.', 
          type: 'error' 
        });
        return;
      }
      
      if (isLatestYmlError) {
        // Ошибка отсутствия latest.yml - это означает, что файл не загружен на GitHub
        console.log('[App] Ошибка: latest.yml не найден на GitHub');
        setUpdateError('Файл latest.yml не найден в релизе GitHub. Пожалуйста, загрузите его вручную.');
        setUpdateStatus('error');
        setToast({ 
          message: 'Ошибка обновления: файл latest.yml не найден в релизе GitHub. Обратитесь к разработчикам.', 
          type: 'error' 
        });
        return;
      }
      
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

  // UpdateProgress показывается как overlay, не блокируя основной UI
  // Показываем если обновление доступно, идет загрузка или установка
  const showUpdateProgress = updateStatus && (
    updateStatus === 'available' ||
    updateStatus === 'downloading' || 
    updateStatus === 'downloaded' || 
    updateStatus === 'ready' ||
    updateStatus === 'error'
  );

  // Основное приложение
  return (
    <>
      <TitleBar />
      <Routes>
        <Route path="*" element={<MainLayout />} />
      </Routes>
      {showUpdateProgress && (
        <UpdateProgress
          version={updateVersion}
          progress={updateProgress}
          status={updateStatus}
          error={updateError}
          resultMessage={updateResultMessage}
          onDownload={async () => {
            console.log('[App] Пользователь нажал "Обновить"');
            setUpdateStatus('downloading');
            try {
              await window.electronAPI.downloadUpdate();
            } catch (error) {
              console.error('[App] Ошибка при вызове downloadUpdate:', error);
            }
          }}
        />
      )}
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
