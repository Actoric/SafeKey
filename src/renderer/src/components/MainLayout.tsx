import { useState, useEffect } from 'react';
import { PasswordList } from './PasswordList';
import { PasswordEditor } from './PasswordEditor';
import { Sidebar } from './Sidebar';
import { Settings } from './Settings';
import { BackupCodes } from './BackupCodes';
import { SecurityQuestions } from './SecurityQuestions';
import { Toast, ToastType } from './Toast';
import { PasswordEntry, PasswordEntryData } from '../../../shared/types';
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
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number | null; show: boolean }>({ id: null, show: false });
  const [sortType, setSortType] = useState<SortType>('none');

  useEffect(() => {
    loadPasswords();
  }, [selectedCategoryId, showFavorites]);

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
      
      if (isEditing) {
        await window.electronAPI.updatePasswordEntry(selectedPassword.id, saveData);
      } else {
        await window.electronAPI.createPasswordEntry(saveData);
      }
      
      // Автосохранение на облачные диски
      try {
        const cloudSettings = await window.electronAPI.getCloudSettings();
        if (cloudSettings.yandexDisk?.enabled || cloudSettings.googleDrive?.enabled) {
          await window.electronAPI.syncToCloud();
        }
      } catch (error) {
        console.error('Ошибка синхронизации с облаком:', error);
        setToast({ message: 'Пароль сохранен, но ошибка синхронизации с облаком', type: 'error' });
      }
      
      await loadPasswords();
      setSelectedPassword(null); // Сбрасываем выбранный пароль
    } catch (error) {
      console.error('Ошибка сохранения пароля:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setToast({ message: `Ошибка сохранения пароля: ${errorMessage}`, type: 'error' });
    }
  };

  const handleDeletePassword = (id: number) => {
    // Показываем неблокирующий диалог подтверждения
    setDeleteConfirm({ id, show: true });
  };

  const confirmDelete = async () => {
    const id = deleteConfirm.id;
    if (!id) return;
    
    setDeleteConfirm({ id: null, show: false });
    
    try {
      // Сбрасываем выбранный пароль сразу, чтобы не блокировать UI
      setSelectedPassword(null);
      
      // Выполняем удаление асинхронно, не блокируя UI
      window.electronAPI.deletePasswordEntry(id).then(async () => {
        await loadPasswords();
        
        // Автосохранение на облачные диски после удаления (в фоне)
        window.electronAPI.getCloudSettings().then(async (cloudSettings) => {
          if (cloudSettings.yandexDisk?.enabled || cloudSettings.googleDrive?.enabled) {
            try {
              await window.electronAPI.syncToCloud();
            } catch (error) {
              console.error('Ошибка синхронизации с облаком:', error);
            }
          }
        }).catch((error) => {
          console.error('Ошибка получения настроек облака:', error);
        });
      }).catch((error) => {
        console.error('Ошибка удаления пароля:', error);
        setToast({ message: 'Ошибка удаления пароля', type: 'error' });
      });
    } catch (error) {
      console.error('Ошибка удаления пароля:', error);
      setToast({ message: 'Ошибка удаления пароля', type: 'error' });
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm({ id: null, show: false });
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
            onToggleFavorite={handleToggleFavorite}
            loading={loading}
            sortType={sortType}
            onSortChange={setSortType}
          />
          <PasswordEditor
            password={selectedPassword}
            onSave={handleSavePassword}
            onCancel={() => setSelectedPassword(null)}
            selectedCategoryId={selectedCategoryId}
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
        <div className="confirm-overlay" onClick={cancelDelete}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Подтверждение удаления</h3>
            <p>Вы уверены, что хотите удалить этот пароль?</p>
            <div className="confirm-actions">
              <button className="secondary-button" onClick={cancelDelete}>
                Отмена
              </button>
              <button className="primary-button" onClick={confirmDelete}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
