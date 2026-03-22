import { X, Trash2 } from 'lucide-react';
import './DeleteSecurityQuestionDialog.css';

interface DeleteSecurityQuestionDialogProps {
  entryTitle: string;
}

export function DeleteSecurityQuestionDialog({ entryTitle }: DeleteSecurityQuestionDialogProps) {
  const handleChoice = (confirmed: boolean) => {
    if (window.electronAPI && (window.electronAPI as any).ipcRenderer) {
      const ipcRenderer = (window.electronAPI as any).ipcRenderer;
      ipcRenderer.send('delete-security-question-dialog-choice', confirmed ? 'confirm' : 'cancel');
    }
  };

  return (
    <div className="delete-security-question-dialog-overlay">
      <div className="delete-security-question-dialog">
        <div className="delete-security-question-dialog-header">
          <div className="delete-security-question-dialog-icon">
            <Trash2 size={24} />
          </div>
          <h3>Удалить контрольные вопросы</h3>
          <button className="delete-security-question-dialog-close" onClick={() => handleChoice(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="delete-security-question-dialog-content">
          <p>Вы уверены, что хотите удалить контрольные вопросы <strong>"{entryTitle}"</strong>?</p>
        </div>
        <div className="delete-security-question-dialog-actions">
          <button className="delete-security-question-dialog-button secondary" onClick={() => handleChoice(false)}>
            Отмена
          </button>
          <button className="delete-security-question-dialog-button danger" onClick={() => handleChoice(true)}>
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}
