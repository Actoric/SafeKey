import { useState, useEffect, useRef } from 'react';
import { PasswordList } from './PasswordList';
import { PasswordEditor } from './PasswordEditor';
import { Sidebar } from './Sidebar';
import { Settings } from './Settings';
import { BackupCodes } from './BackupCodes';
import { SecurityQuestions } from './SecurityQuestions';
import { Toast, ToastType } from './Toast';
import { CloudSyncProgress } from './CloudSyncProgress';
import { Trash2, X } from 'lucide-react';
import { PasswordEntry, PasswordEntryData } from '../../../shared/types';
import { isCloudBackupEnabled } from '../utils/cloud-sync';
import './MainLayout.css';

type SortType = 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc' | 'none';

export function MainLayout() {
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [selectedPassword, setSelectedPassword] = useState<PasswordEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [showSecurityQuestions, setShowSecurityQuestions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number | null; ids: number[]; show: boolean }>({ id: null, ids: [], show: false });
  const [sortType, setSortType] = useState<SortType>('none');
  const [cloudSyncProgress, setCloudSyncProgress] = useState<{ progress: number; visible: boolean; message?: string }>({ progress: 0, visible: false });
  const passwordEditorRef = useRef<{ refreshCategories: () => void }>(null);
  const hideProgressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadPasswords();
  }, [selectedCategoryId, showFavorites]);

  useEffect(() => {
    const api = window.electronAPI.ipcRenderer;
    if (!api) return;

    const onProgress = (payload: { progress: number; message?: string }) => {
      if (hideProgressTimer.current) {
        clearTimeout(hideProgressTimer.current);
        hideProgressTimer.current = null;
      }
      setCloudSyncProgress({
        progress: payload.progress,
        visible: true,
        message: payload.message,
      });
      if (payload.progress >= 100) {
        hideProgressTimer.current = setTimeout(() => {
          setCloudSyncProgress({ progress: 0, visible: false });
        }, 1000);
      }
    };

    api.on('cloud-sync-progress', onProgress);
    return () => {
      api.removeAllListeners('cloud-sync-progress');
      if (hideProgressTimer.current) clearTimeout(hideProgressTimer.current);
    };
  }, []);

  // Функция для разблокировки всех полей ввода
  const ensureInputsAreEditable = () => {
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach((input) => {
      if (input instanceof HTMLElement) {
        // Убираем любые блокировки через стили
        input.style.pointerEvents = 'auto';
        input.style.opacity = '1';
        input.style.cursor = 'text';
        
        // Убираем атрибуты блокировки
        input.removeAttribute('disabled');
        input.removeAttribute('readonly');
        input.removeAttribute('aria-disabled');
        
        // Убираем классы блокировки (если есть)
        input.classList.remove('disabled', 'readonly', 'blocked');
        
        // Убеждаемся, что элемент не заблокирован через tabIndex
        if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) {
          if (input.tabIndex === -1 && input.hasAttribute('disabled')) {
            input.tabIndex = 0;
          }
        }
      }
    });
    
    // Также проверяем родительские элементы на блокировку
    const containers = document.querySelectorAll('.password-editor, .settings-field, form');
    containers.forEach((container) => {
      if (container instanceof HTMLElement) {
        container.style.pointerEvents = 'auto';
      }
    });
  };

  // Исправление проблемы с полями ввода после запуска
  useEffect(() => {
    // Выполняем проверку после небольшой задержки
    const timeout = setTimeout(ensureInputsAreEditable, 500);
    return () => clearTimeout(timeout);
  }, [loading]);

  const sortPasswords = (entries: PasswordEntry[]): PasswordEntry[] => {
    if (sortType === 'none') return entries;
    
    const sorted = [...entries];
    switch (sortType) {
      case 'name-asc':
        return sorted.sort((a, b) => {
          const nameA = (a.data?.service || a.title || '').toLowerCase();
          const nameB = (b.data?.service || b.title || '').toLowerCase();
          return nameA.localeCompare(nameB, 'ru');
        });
      case 'name-desc':
        return sorted.sort((a, b) => {
          const nameA = (a.data?.service || a.title || '').toLowerCase();
          const nameB = (b.data?.service || b.title || '').toLowerCase();
          return nameB.localeCompare(nameA, 'ru');
        });
      case 'date-asc':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
          const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
          return dateA - dateB;
        });
      case 'date-desc':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
          const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
          return dateB - dateA;
        });
      default:
        return entries;
    }
  };

  const loadPasswords = async () => {
    try {
      setLoading(true);
      let entries: PasswordEntry[];
      
      if (showFavorites) {
        entries = await window.electronAPI.getFavoritePasswords() as any;
      } else if (selectedCategoryId !== null) {
        entries = await window.electronAPI.getPasswordsByCategory(selectedCategoryId) as any;
      } else {
        entries = await window.electronAPI.getPasswordEntries() as any;
      }
      
      const sorted = sortPasswords(entries);
      setPasswords(sorted);
    } catch (error) {
      console.error('Ошибка загрузки паролей:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && passwords.length > 0) {
      const sorted = sortPasswords(passwords);
      // Проверяем, что сортировка действительно изменила порядок
      const needsUpdate = JSON.stringify(sorted) !== JSON.stringify(passwords);
      if (needsUpdate) {
        setPasswords(sorted);
      }
    }
  }, [sortType]);


  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      try {
        setLoading(true);
        const results: PasswordEntry[] = await window.electronAPI.searchPasswords(query) as any;
        setPasswords(results);
      } catch (error) {
        console.error('Ошибка поиска:', error);
        setPasswords([]);
      } finally {
        setLoading(false);
      }
    } else {
      loadPasswords();
    }
  };

  const handleCategorySelect = (categoryId: number | null) => {
    setSelectedCategoryId(categoryId);
    setShowFavorites(false);
    setShowBackupCodes(false);
    setShowSecurityQuestions(false);
    setSearchQuery(''); // Сбрасываем поиск при переключении
  };

  const handleFavoriteClick = () => {
    setShowFavorites(true);
    setSelectedCategoryId(null);
    setSearchQuery('');
    setShowBackupCodes(false);
    setShowSecurityQuestions(false);
  };

  const handleBackupCodesClick = () => {
    setShowBackupCodes(!showBackupCodes);
    if (!showBackupCodes) {
      setShowSecurityQuestions(false);
      setShowFavorites(false);
      setSelectedCategoryId(null);
    }
  };

  const handleSecurityQuestionsClick = () => {
    setShowSecurityQuestions(!showSecurityQuestions);
    if (!showSecurityQuestions) {
      setShowBackupCodes(false);
      setShowFavorites(false);
      setSelectedCategoryId(null);
    }
  };

  const handleSavePassword = async (entry: Partial<PasswordEntry>) => {
    try {
      // Проверяем, что данные валидны (логин теперь необязателен)
      const entryData = entry.data as PasswordEntryData | undefined;
      if (!entryData || !entryData.service || !entryData.password) {
        setToast({ message: 'Заполните обязательные поля: название сервиса и пароль', type: 'error' });
        return;
      }

      const saveData = {
        title: entry.title || entryData.service || 'Без названия',
        category_id: entry.category_id !== undefined ? entry.category_id : selectedCategoryId,
        data: entryData,
      };
      
      const isEditing = selectedPassword?.id;
      
      // Сначала сохраняем локально (быстро)
      if (isEditing) {
        await window.electronAPI.updatePasswordEntry(selectedPassword.id, saveData);
      } else {
        await window.electronAPI.createPasswordEntry(saveData);
      }
      
      // Сразу обновляем список паролей и закрываем редактор
      await loadPasswords();
      setSelectedPassword(null); // Сбрасываем выбранный пароль
      
      // Синхронизация с облаком в фоне (прогресс через cloud-sync-progress)
      window.electronAPI.getCloudSettings().then(async (cloudSettings) => {
        if (isCloudBackupEnabled(cloudSettings)) {
          try {
            setCloudSyncProgress({ progress: 0, visible: true });
            await window.electronAPI.syncToCloud();
            console.log('Синхронизация с облаком завершена');
          } catch (error) {
            console.error('Ошибка синхронизации с облаком:', error);
            setCloudSyncProgress({ progress: 0, visible: false });
          }
        }
      }).catch((error) => {
        console.error('Ошибка получения настроек облака:', error);
        setCloudSyncProgress({ progress: 0, visible: false });
      });
    } catch (error) {
      console.error('Ошибка сохранения пароля:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setToast({ message: `Ошибка сохранения пароля: ${errorMessage}`, type: 'error' });
    }
  };

  const handleDeletePassword = (id: number) => {
    // Показываем неблокирующий диалог подтверждения
    setDeleteConfirm({ id, ids: [], show: true });
  };

  const handleDeleteMultiple = (ids: number[]) => {
    // Показываем диалог подтверждения для множественного удаления
    setDeleteConfirm({ id: null, ids, show: true });
  };

  const confirmDelete = async () => {
    const idsToDelete = deleteConfirm.ids.length > 0 ? deleteConfirm.ids : (deleteConfirm.id ? [deleteConfirm.id] : []);
    if (idsToDelete.length === 0) return;
    
    setDeleteConfirm({ id: null, ids: [], show: false });
    
    try {
      // Сбрасываем выбранный пароль сразу, чтобы не блокировать UI
      if (idsToDelete.length === 1 && selectedPassword?.id === idsToDelete[0]) {
        setSelectedPassword(null);
      }
      
      // Выполняем удаление асинхронно, не блокируя UI
      const deletePromises = idsToDelete.map(id => window.electronAPI.deletePasswordEntry(id));
      Promise.all(deletePromises).then(async () => {
        await loadPasswords();
        
        // Автосохранение на облачные диски после удаления (в фоне)
        window.electronAPI.getCloudSettings().then(async (cloudSettings) => {
          if (isCloudBackupEnabled(cloudSettings)) {
            try {
              await window.electronAPI.syncToCloud();
              console.log('Синхронизация с облаком завершена после удаления');
            } catch (error) {
              console.error('Ошибка синхронизации с облаком:', error);
            }
          }
        }).catch((error) => {
          console.error('Ошибка получения настроек облака:', error);
        });
      }).catch((error) => {
        console.error('Ошибка удаления паролей:', error);
        setToast({ message: 'Ошибка удаления паролей', type: 'error' });
      });
    } catch (error) {
      console.error('Ошибка удаления паролей:', error);
      setToast({ message: 'Ошибка удаления паролей', type: 'error' });
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm({ id: null, ids: [], show: false });
  };

  const handleToggleFavorite = async (id: number) => {
    try {
      await window.electronAPI.toggleFavorite(id);
      await loadPasswords();
      // Обновить выбранный пароль, если он изменен
      if (selectedPassword?.id === id) {
        const updated = await window.electronAPI.getPasswordEntries() as any;
        const found = updated.find((p: PasswordEntry) => p.id === id);
        if (found) {
          setSelectedPassword(found);
        }
      }
    } catch (error) {
      console.error('Ошибка изменения избранного:', error);
    }
  };

  return (
    <div className="main-layout">
        <Sidebar 
        onSearch={handleSearch} 
        onNewPassword={() => {
          setSelectedPassword(null);
          setShowFavorites(false);
          setShowBackupCodes(false);
          setShowSecurityQuestions(false);
          setSelectedCategoryId(null);
        }}
        onCategorySelect={handleCategorySelect}
        onFavoriteClick={handleFavoriteClick}
        onBackupCodesClick={handleBackupCodesClick}
        onSecurityQuestionsClick={handleSecurityQuestionsClick}
        onSettingsClick={() => setShowSettings(true)}
        selectedCategoryId={showFavorites || showBackupCodes || showSecurityQuestions ? undefined : selectedCategoryId}
        onCategoryCreated={() => {
          // Обновляем список категорий в PasswordEditor после создания категории
          if (passwordEditorRef.current) {
            passwordEditorRef.current.refreshCategories();
          }
        }}
        showFavorites={showFavorites}
        showBackupCodes={showBackupCodes}
        showSecurityQuestions={showSecurityQuestions}
      />
      {showBackupCodes ? (
        <div className="main-content">
          <BackupCodes sortType={sortType} onSortChange={setSortType} />
        </div>
      ) : showSecurityQuestions ? (
        <div className="main-content">
          <SecurityQuestions sortType={sortType} onSortChange={setSortType} />
        </div>
      ) : (
        <div className="main-content">
          <PasswordList
            passwords={passwords}
            onSelect={setSelectedPassword}
            onDelete={handleDeletePassword}
            onDeleteMultiple={handleDeleteMultiple}
            onToggleFavorite={handleToggleFavorite}
            loading={loading}
            sortType={sortType}
            onSortChange={setSortType}
            selectedId={selectedPassword?.id ?? null}
          />
          <PasswordEditor
            ref={passwordEditorRef}
            password={selectedPassword}
            onSave={handleSavePassword}
            onCancel={() => setSelectedPassword(null)}
            selectedCategoryId={selectedCategoryId}
            onCategoryCreated={() => {
              // Обновляем категории в PasswordEditor после создания категории
              if (passwordEditorRef.current) {
                passwordEditorRef.current.refreshCategories();
              }
            }}
          />
        </div>
      )}
      {showSettings && (
        <Settings 
          onClose={() => setShowSettings(false)}
          onSaveSuccess={() => {
            setToast({ message: 'Настройки успешно сохранены', type: 'success' });
          }}
          onSaveError={(error) => {
            setToast({ message: `Ошибка сохранения настроек: ${error}`, type: 'error' });
          }}
        />
      )}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {deleteConfirm.show && (
        <div className="delete-password-dialog-overlay" onClick={cancelDelete}>
          <div className="delete-password-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="delete-password-dialog-header">
              <div className="delete-password-dialog-icon">
                <Trash2 size={24} />
              </div>
              <h3>Подтверждение удаления</h3>
              <button className="delete-password-dialog-close" onClick={cancelDelete}>
                <X size={18} />
              </button>
            </div>
            <div className="delete-password-dialog-content">
              {deleteConfirm.ids.length > 0 ? (
                <p>Вы уверены, что хотите удалить <strong>{deleteConfirm.ids.length}</strong> {deleteConfirm.ids.length === 1 ? 'пароль' : deleteConfirm.ids.length < 5 ? 'пароля' : 'паролей'}?</p>
              ) : (
                <p>Вы уверены, что хотите удалить этот пароль?</p>
              )}
            </div>
            <div className="delete-password-dialog-actions">
              <button className="delete-password-dialog-button secondary" onClick={cancelDelete}>
                Отмена
              </button>
              <button className="delete-password-dialog-button danger" onClick={confirmDelete}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
      <CloudSyncProgress
        progress={cloudSyncProgress.progress}
        visible={cloudSyncProgress.visible}
        message={cloudSyncProgress.message}
      />
    </div>
  );
}
