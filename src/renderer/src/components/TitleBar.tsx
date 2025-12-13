import { Minus, Square, X } from 'lucide-react';
import './TitleBar.css';

export function TitleBar() {
  const handleMinimize = () => {
    if (window.electronAPI && typeof window.electronAPI.minimize === 'function') {
      window.electronAPI.minimize();
    }
  };

  const handleMaximize = () => {
    if (window.electronAPI && typeof window.electronAPI.maximize === 'function') {
      window.electronAPI.maximize();
    }
  };

  const handleClose = () => {
    if (window.electronAPI && typeof window.electronAPI.close === 'function') {
      window.electronAPI.close();
    }
  };

  return (
    <div className="title-bar">
      <div className="title-bar-drag-region">
        <div className="title-bar-title">SafeKey</div>
      </div>
      <div className="title-bar-controls">
        <button className="title-bar-button" onClick={handleMinimize} title="Свернуть">
          <Minus size={14} />
        </button>
        <button className="title-bar-button close" onClick={handleClose} title="Закрыть">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
