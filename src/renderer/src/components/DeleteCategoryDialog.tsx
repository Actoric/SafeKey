import { X, Trash2 } from 'lucide-react';
import './DeleteCategoryDialog.css';

interface DeleteCategoryDialogProps {
  categoryName: string;
  hasChildren: boolean;
}

export function DeleteCategoryDialog({ categoryName, hasChildren }: DeleteCategoryDialogProps) {
  const handleChoice = (confirmed: boolean) => {
    if (window.electronAPI && (window.electronAPI as any).ipcRenderer) {
      const ipcRenderer = (window.electronAPI as any).ipcRenderer;
      ipcRenderer.send('delete-category-dialog-choice', confirmed ? 'confirm' : 'cancel');
    }
  };

  return (
    <div className="delete-category-dialog-overlay">
      <div className="delete-category-dialog">
        <div className="delete-category-dialog-header">
          <div className="delete-category-dialog-icon">
            <Trash2 size={24} />
          </div>
          <h3>Удалить раскладку</h3>
          <button className="delete-category-dialog-close" onClick={() => handleChoice(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="delete-category-dialog-content">
          {hasChildren ? (
            <>
              <p>Раскладка <strong>"{categoryName}"</strong> содержит подкатегории.</p>
              <p>Удалить вместе с ними?</p>
            </>
          ) : (
            <p>Вы уверены, что хотите удалить раскладку <strong>"{categoryName}"</strong>?</p>
          )}
        </div>
        <div className="delete-category-dialog-actions">
          <button className="delete-category-dialog-button secondary" onClick={() => handleChoice(false)}>
            Отмена
          </button>
          <button className="delete-category-dialog-button danger" onClick={() => handleChoice(true)}>
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}
