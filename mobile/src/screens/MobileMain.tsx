import { useState, useEffect } from 'react';
import { LogOut, RefreshCw } from 'lucide-react';
import { mobileAPI } from '../api/mobile-bridge';
import type { DatabasePasswordEntry } from '../types';
import type { Category } from '../types';
import '../MobileLayout.css';

interface MobileMainProps {
  onLogout: () => void;
}

export function MobileMain({ onLogout }: MobileMainProps) {
  const [passwords, setPasswords] = useState<(DatabasePasswordEntry & { data: { service: string; login: string; password: string; url?: string; notes?: string } })[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const loadData = async () => {
    const [entries, cats] = await Promise.all([
      selectedCategoryId === null
        ? mobileAPI.getPasswordEntries()
        : mobileAPI.getPasswordsByCategory(selectedCategoryId),
      mobileAPI.getCategories(),
    ]);
    setPasswords(entries as (DatabasePasswordEntry & { data: { service: string; login: string; password: string; url?: string; notes?: string } })[]);
    setCategories(cats as Category[]);
  };

  useEffect(() => {
    loadData();
  }, [selectedCategoryId]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const ok = await mobileAPI.syncToCloud();
      setSyncMessage(ok ? 'Синхронизировано' : 'Ошибка синхронизации');
    } catch {
      setSyncMessage('Ошибка');
    }
    setSyncing(false);
  };

  const handleCopy = async (text: string) => {
    await mobileAPI.copyToClipboard(text);
  };

  return (
    <div className="mobile-page" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
      <header className="mobile-header">
        <h1 className="mobile-header-title">SafeKey</h1>
        <button type="button" onClick={onLogout} className="mobile-icon-btn" title="Выйти">
          <LogOut size={24} />
        </button>
      </header>

      <nav className="mobile-nav">
        <button
          type="button"
          onClick={() => setSelectedCategoryId(null)}
          className={`mobile-nav-btn ${selectedCategoryId === null ? 'active' : ''}`}
        >
          Все
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategoryId(cat.id)}
            className={`mobile-nav-btn ${selectedCategoryId === cat.id ? 'active' : ''}`}
          >
            {cat.name}
          </button>
        ))}
      </nav>

      <div className="mobile-content mobile-container mobile-container-wide">
        {passwords.length === 0 ? (
          <p className="mobile-subtitle" style={{ textAlign: 'center', marginTop: '1.5rem' }}>Нет паролей</p>
        ) : (
          <ul className="mobile-list">
            {passwords.map((entry) => (
              <li key={entry.id} className="mobile-card">
                <div className="mobile-card-title">{entry.title}</div>
                <div className="mobile-card-meta">{entry.data?.service || entry.data?.login || '—'}</div>
                <div className="mobile-card-actions">
                  <button type="button" onClick={() => handleCopy(entry.data?.login ?? '')} className="mobile-card-btn mobile-card-btn-primary">
                    Копировать логин
                  </button>
                  <button type="button" onClick={() => handleCopy(entry.data?.password ?? '')} className="mobile-card-btn mobile-card-btn-outline">
                    Копировать пароль
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="mobile-footer">
        <button type="button" onClick={handleSync} disabled={syncing} className="mobile-btn mobile-btn-primary" style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
          <RefreshCw size={18} style={{ opacity: syncing ? 0.5 : 1 }} />
          {syncing ? 'Синхронизация…' : 'Синхронизировать'}
        </button>
        {syncMessage && <span className="mobile-subtitle" style={{ marginBottom: 0 }}>{syncMessage}</span>}
      </footer>
    </div>
  );
}
