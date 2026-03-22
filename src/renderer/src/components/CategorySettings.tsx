import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Category } from '../../../shared/types';
import './CategorySettings.css';

interface CategorySettingsProps {
  category: Category;
  onClose: () => void;
  onSave: (category: Category) => void;
}

export function CategorySettings({ category, onClose, onSave }: CategorySettingsProps) {
  const [boundApp, setBoundApp] = useState<string | null>(category.bound_app || null);
  const [runningApps, setRunningApps] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [customApp, setCustomApp] = useState('');

  useEffect(() => {
    loadRunningApps();
  }, []);

  const loadRunningApps = async () => {
    try {
      setLoading(true);
      const apps = await window.electronAPI.getRunningApps();
      setRunningApps(apps);
    } catch (error) {
      console.error('Ошибка загрузки списка приложений:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const appToBind = boundApp === 'custom' ? customApp.trim() || null : boundApp;
      const updated = await window.electronAPI.updateCategoryBoundApp(category.id, appToBind);
      if (updated) {
        onSave(updated);
        onClose();
      }
    } catch (error) {
      console.error('Ошибка сохранения настроек раскладки:', error);
      alert('Ошибка сохранения настроек');
    }
  };

  const handleDetectActiveApp = async () => {
    try {
      const activeApp = await window.electronAPI.getActiveApp();
      if (activeApp) {
        setBoundApp(activeApp);
        setCustomApp(activeApp);
      } else {
        alert('Не удалось определить активное приложение');
      }
    } catch (error) {
      console.error('Ошибка определения активного приложения:', error);
      alert('Ошибка определения активного приложения');
    }
  };

  return (
    <div className="category-settings-overlay" onClick={onClose}>
      <div className="category-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="category-settings-header">
          <h3>Настройки раскладки: {category.name}</h3>
          <button className="category-settings-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="category-settings-content">
          <div className="category-settings-field">
            <label>Привязать к приложению:</label>
            <div className="category-settings-app-select">
              <select
                value={boundApp || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setBoundApp(value === '' ? null : value);
                  if (value !== 'custom') {
                    setCustomApp('');
                  }
                }}
              >
                <option value="">Не привязано</option>
                <option value="custom">Указать вручную</option>
                {runningApps.map((app) => (
                  <option key={app} value={app}>
                    {app}
                  </option>
                ))}
              </select>
              <button
                className="category-settings-detect-btn"
                onClick={handleDetectActiveApp}
                title="Определить активное приложение"
              >
                Определить
              </button>
            </div>
            {boundApp === 'custom' && (
              <input
                type="text"
                placeholder="Введите имя приложения (например: chrome, notepad)"
                value={customApp}
                onChange={(e) => setCustomApp(e.target.value)}
                className="category-settings-custom-input"
              />
            )}
            {boundApp && boundApp !== 'custom' && (
              <div className="category-settings-info">
                Раскладка будет показываться только когда активно приложение: <strong>{boundApp}</strong>
              </div>
            )}
            {boundApp === 'custom' && customApp && (
              <div className="category-settings-info">
                Раскладка будет показываться только когда активно приложение: <strong>{customApp}</strong>
              </div>
            )}
          </div>
          <div className="category-settings-actions">
            <button className="category-settings-save-btn" onClick={handleSave}>
              Сохранить
            </button>
            <button className="category-settings-cancel-btn" onClick={onClose}>
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
