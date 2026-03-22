import { X, Trash2 } from 'lucide-react';
import './DeleteBackupCodeDialog.css';

interface DeleteBackupCodeDialogProps {
  codeText: string;
  isEntry: boolean;
}

export function DeleteBackupCodeDialog({ codeText, isEntry }: DeleteBackupCodeDialogProps) {
  const handleChoice = (confirmed: boolean) => {
    if (window.electronAPI && (window.electronAPI as any).ipcRenderer) {
      const ipcRenderer = (window.electronAPI as any).ipcRenderer;
      ipcRenderer.send('delete-backup-code-dialog-choice', confirmed ? 'confirm' : 'cancel');
    }
  };

  return (
    <div className="delete-backup-code-dialog-overlay">
      <div className="delete-backup-code-dialog">
        <div className="delete-backup-code-dialog-header">
          <div className="delete-backup-code-dialog-icon">
            <Trash2 size={24} />
          </div>
          <h3>{isEntry ? 'Удалить резервные коды' : 'Удалить код'}</h3>
          <button className="delete-backup-code-dialog-close" onClick={() => handleChoice(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="delete-backup-code-dialog-content">
          {isEntry ? (
            <p>Вы уверены, что хотите удалить запись <strong>"{codeText}"</strong>?</p>
          ) : (
            <p>Вы уверены, что хотите удалить код <strong>"{codeText}"</strong>?</p>
          )}
        </div>
        <div className="delete-backup-code-dialog-actions">
          <button className="delete-backup-code-dialog-button secondary" onClick={() => handleChoice(false)}>
            Отмена
          </button>
          <button className="delete-backup-code-dialog-button danger" onClick={() => handleChoice(true)}>
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}
