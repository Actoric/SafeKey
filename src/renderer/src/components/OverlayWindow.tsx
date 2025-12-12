import { useState, useEffect } from 'react';
import { Search, X, Copy, Eye, EyeOff, User, Globe } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import './OverlayWindow.css';

export function OverlayWindow() {
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
    notification.textContent = 'Скопировано!';
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
              placeholder="Поиск пароля..."
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
            <div className="overlay-loading">Поиск...</div>
          ) : filteredPasswords.length === 0 ? (
            <div className="overlay-empty">Пароли не найдены</div>
          ) : (
            filteredPasswords.map((password) => {
              const isExpanded = expandedPasswords.has(password.id);
              const isPasswordVisible = visiblePasswords.has(password.id);
              return (
                <div key={password.id} className={`overlay-item ${isExpanded ? 'expanded' : ''}`}>
                  <div className="overlay-item-header" onClick={() => toggleExpand(password.id)}>
                    <div className="overlay-item-info">
                      <div className="overlay-item-title">{password.data?.service || password.title || 'Без названия'}</div>
                      <div className="overlay-item-subtitle">{password.data?.login || 'Нет логина'}</div>
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
                        <span className="overlay-detail-label"><User size={14} /> Логин:</span>
                        <div className="overlay-detail-value">
                          <span>{password.data?.login || 'Нет логина'}</span>
                          {password.data?.login && (
                            <button
                              className="overlay-copy-btn"
                              onClick={() => handleCopy(password.data.login)}
                              title="Копировать логин"
                            >
                              <Copy size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="overlay-detail-row">
                        <span className="overlay-detail-label">Пароль:</span>
                        <div className="overlay-detail-value">
                          <span className="overlay-password">
                            {isPasswordVisible ? (password.data?.password || '') : '••••••••'}
                          </span>
                          <div className="overlay-password-actions">
                            <button
                              className="overlay-copy-btn"
                              onClick={() => handleCopy(password.data?.password || '')}
                              title="Копировать пароль"
                            >
                              <Copy size={12} />
                            </button>
                            <button
                              className="overlay-copy-btn"
                              onClick={() => togglePasswordVisibility(password.id)}
                              title={isPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'}
                            >
                              {isPasswordVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          </div>
                        </div>
                      </div>
                      {password.data?.url && (
                        <div className="overlay-detail-row">
                          <span className="overlay-detail-label"><Globe size={14} /> URL:</span>
                          <div className="overlay-detail-value">
                            <span className="overlay-url">{password.data.url}</span>
                            <button
                              className="overlay-copy-btn"
                              onClick={() => handleCopy(password.data.url)}
                              title="Копировать URL"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                      {password.data?.notes && (
                        <div className="overlay-detail-row">
                          <span className="overlay-detail-label">Заметки:</span>
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
