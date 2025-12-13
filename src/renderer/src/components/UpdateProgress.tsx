import { Download, CheckCircle, AlertCircle } from 'lucide-react';
import './UpdateProgress.css';

interface UpdateProgressProps {
  version?: string;
  progress?: number;
  status: 'checking' | 'downloading' | 'downloaded' | 'error' | 'ready' | 'completed';
  error?: string;
  resultMessage?: string;
}

export function UpdateProgress({ version, progress = 0, status, error, resultMessage }: UpdateProgressProps) {
  // Всегда показываем, если есть статус обновления
  if (!status) return null;

  return (
    <div className="update-progress-overlay">
      <div className="update-progress-modal">
        <div className="update-progress-header">
          <h2>Обновление SafeKey</h2>
        </div>
        
        <div className="update-progress-content">
          {status === 'checking' && (
            <div className="update-status">
              <div className="update-spinner"></div>
              <p>Проверка обновлений...</p>
            </div>
          )}

          {status === 'downloading' && (
            <div className="update-status">
              <Download size={32} className="update-icon" />
              <p>Загрузка обновления {version}...</p>
              <div className="progress-bar-container">
                <div className="progress-bar">
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <span className="progress-text">{Math.round(progress)}%</span>
              </div>
            </div>
          )}

          {status === 'downloaded' && (
            <div className="update-status">
              <CheckCircle size={32} className="update-icon success" />
              <p>Обновление загружено!</p>
              <p className="update-subtitle">Готово к установке</p>
            </div>
          )}

          {status === 'ready' && (
            <div className="update-status">
              <CheckCircle size={32} className="update-icon success" />
              <p>Обновление готово к установке</p>
              <p className="update-subtitle">Приложение будет перезапущено</p>
            </div>
          )}

          {status === 'error' && (
            <div className="update-status">
              <AlertCircle size={32} className="update-icon error" />
              <p>Ошибка обновления</p>
              {error && <p className="update-error">{error}</p>}
              <button 
                className="update-close-btn"
                onClick={() => {
                  window.location.reload();
                }}
              >
                Закрыть
              </button>
            </div>
          )}

          {status === 'completed' && (
            <div className="update-status">
              <CheckCircle size={32} className="update-icon success" />
              <p>{resultMessage || 'Проверка завершена'}</p>
              <p className="update-subtitle">Окно закроется автоматически...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

