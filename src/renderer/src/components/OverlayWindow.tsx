import { useState, useEffect } from 'react';
import { Search, X, Copy, Eye, EyeOff, User, Globe } from 'lucide-react';
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

  useEffect(() => {
    loadPasswords();
  }, []);

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

  const filteredPasswords = passwords.slice(0, 10);

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
