import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { mobileAPI } from './api/mobile-bridge';
import { MobileLogin } from './screens/MobileLogin';
import { MobileMain } from './screens/MobileMain';
import './MobileLayout.css';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      await mobileAPI.initSqlJs();
      const hasKey = await mobileAPI.hasStoredKeyData();
      const open = mobileAPI.isDbOpen();
      const auth = await mobileAPI.checkAuthStatus();
      setAuthenticated(!!(open && auth));
      if (!hasKey && !open) {
        setAuthenticated(false);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const applyTheme = async () => {
      const settings = await mobileAPI.getAppSettings();
      const theme = settings.theme || 'light';
      document.documentElement.setAttribute('data-theme', theme);
    };
    applyTheme();
  }, []);

  if (loading) {
    return (
      <div className="mobile-center" style={{ flex: 1 }}>
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          authenticated ? (
            <MobileMain
              onLogout={() => {
                mobileAPI.logout();
                setAuthenticated(false);
                navigate('/', { replace: true });
              }}
            />
          ) : (
            <MobileLogin
              onSuccess={() => {
                setAuthenticated(true);
                navigate('/', { replace: true });
              }}
            />
          )
        }
      />
      <Route path="*" element={authenticated ? <MobileMain onLogout={() => {}} /> : <MobileLogin onSuccess={() => navigate('/', { replace: true })} />} />
    </Routes>
  );
}
