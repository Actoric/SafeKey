import { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { PinCodeLogin } from './components/PinCodeLogin';
import { MainLayout } from './components/MainLayout';
import { OverlayWindow } from './components/OverlayWindow';
import { TitleBar } from './components/TitleBar';
import { CloseDialog } from './components/CloseDialog';
import { DeleteCategoryDialog } from './components/DeleteCategoryDialog';
import { DeleteSecurityQuestionDialog } from './components/DeleteSecurityQuestionDialog';
import { DeleteBackupCodeDialog } from './components/DeleteBackupCodeDialog';
import { useAuth } from './hooks/useAuth';

function App() {
  const location = useLocation();
  const { isAuthenticated, isInitialized, checkAuth } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        if (!window.electronAPI) {
          setLoading(false);
          return;
        }

        try {
          const settings = await window.electronAPI.getAppSettings();
          const theme = settings.theme || 'light';
          document.documentElement.setAttribute('data-theme', theme);
        } catch {
          /* ignore */
        }

        await window.electronAPI.initDatabase('');
        await checkAuth();
        setLoading(false);
      } catch (error) {
        console.error('[App] init:', error);
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

  if (location.hash === '#overlay') {
    return <OverlayWindow />;
  }

  if (location.hash.startsWith('#close-dialog')) {
    return <CloseDialog />;
  }

  if (location.hash.startsWith('#delete-category-dialog')) {
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    const categoryName = decodeURIComponent(params.get('name') || '');
    const hasChildren = params.get('hasChildren') === 'true';
    return <DeleteCategoryDialog categoryName={categoryName} hasChildren={hasChildren} />;
  }

  if (location.hash.startsWith('#delete-security-question-dialog')) {
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    const entryTitle = decodeURIComponent(params.get('title') || '');
    return <DeleteSecurityQuestionDialog entryTitle={entryTitle} />;
  }

  if (location.hash.startsWith('#delete-backup-code-dialog')) {
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    const codeText = decodeURIComponent(params.get('code') || '');
    const isEntry = params.get('isEntry') === 'true';
    return <DeleteBackupCodeDialog codeText={codeText} isEntry={isEntry} />;
  }

  if (!isAuthenticated) {
    return (
      <>
        <TitleBar />
        <PinCodeLogin />
      </>
    );
  }

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
