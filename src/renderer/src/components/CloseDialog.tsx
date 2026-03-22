import { X } from 'lucide-react';
import './CloseDialog.css';

export function CloseDialog() {
  const handleChoice = (choice: 'minimize' | 'quit') => {
    if (window.electronAPI && (window.electronAPI as any).ipcRenderer) {
      const ipcRenderer = (window.electronAPI as any).ipcRenderer;
      ipcRenderer.send('close-dialog-choice', choice);
    }
  };

  return (
    <div className="close-dialog-overlay">
      <div className="close-dialog">
        <div className="close-dialog-header">
          <h3>Закрыть SafeKey?</h3>
          <button className="close-dialog-close" onClick={() => handleChoice('minimize')}>
            <X size={18} />
          </button>
        </div>
        <div className="close-dialog-content">
          <p>Что вы хотите сделать?</p>
          <p className="close-dialog-detail">Выберите действие при закрытии окна</p>
        </div>
        <div className="close-dialog-actions">
          <button className="close-dialog-button secondary" onClick={() => handleChoice('minimize')}>
            Свернуть в трей
          </button>
          <button className="close-dialog-button primary" onClick={() => handleChoice('quit')}>
            Закрыть приложение
          </button>
        </div>
      </div>
    </div>
  );
}
