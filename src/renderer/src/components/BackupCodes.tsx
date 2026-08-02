import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Copy, Check, X, ArrowUpDown, Download, Trash, Upload } from 'lucide-react';
import { DatabaseBackupCodeEntry, BackupCode, CreateBackupCodeEntryRequest, UpdateBackupCodeEntryRequest, BackupCodeEntryData } from '../../../shared/types';
import { triggerCloudSync } from '../utils/cloud-sync';
import './BackupCodes.css';

type SortType = 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc' | 'none';

interface BackupCodesProps {
  onClose?: () => void;
  sortType?: SortType;
  onSortChange?: (sortType: SortType) => void;
}

interface BackupCodeEntryWithData extends DatabaseBackupCodeEntry {
  data?: BackupCodeEntryData;
}

export function BackupCodes({ onClose, sortType = 'none', onSortChange }: BackupCodesProps) {
  const [entries, setEntries] = useState<DatabaseBackupCodeEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<BackupCodeEntryWithData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCodes, setNewCodes] = useState<string>('');
  const [editingTitle, setEditingTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sortEntries = (entriesList: DatabaseBackupCodeEntry[]): DatabaseBackupCodeEntry[] => {
    if (sortType === 'none') return entriesList;
    
    const sorted = [...entriesList];
    switch (sortType) {
      case 'name-asc':
        return sorted.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase(), 'ru'));
      case 'name-desc':
        return sorted.sort((a, b) => b.title.toLowerCase().localeCompare(a.title.toLowerCase(), 'ru'));
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
        return entriesList;
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const data = await window.electronAPI.getBackupCodeEntries() as any;
      setEntries(sortEntries(data));
    } catch (error) {
      console.error('Ошибка загрузки резервных кодов:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && entries.length > 0) {
      const sorted = sortEntries(entries);
      const needsUpdate = JSON.stringify(sorted) !== JSON.stringify(entries);
      if (needsUpdate) {
        setEntries(sorted);
      }
    }
  }, [sortType]);

  const handleAddEntry = async () => {
    if (!newTitle.trim() || !newCodes.trim()) {
      alert('Заполните название и коды');
      return;
    }

    try {
      // Разделяем коды по пробелам, переносам строк, запятым и другим разделителям
      // Сначала разбиваем по переносам строк, потом по пробелам и запятым
      const codesArray = newCodes
        .split(/\n/)
        .flatMap(line => line.split(/[\s,;]+/))
        .map(code => code.trim())
        .filter(code => code.length > 0);

      if (codesArray.length === 0) {
        alert('Добавьте хотя бы один код');
        return;
      }

      const request: CreateBackupCodeEntryRequest = {
        title: newTitle.trim(),
        codes: codesArray,
      };

      await window.electronAPI.createBackupCodeEntry(request);
      setNewTitle('');
      setNewCodes('');
      setShowAddForm(false);
      await loadEntries();
      
      // Автосохранение на облачные диски
      await triggerCloudSync();
    } catch (error) {
      console.error('Ошибка создания записи:', error);
      alert('Ошибка создания записи');
    }
  };

  const handleDeleteEntry = async (id: number) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    const confirmed = await window.electronAPI.showDeleteBackupCodeDialog(entry.title, true);
    if (!confirmed) {
      return;
    }

    try {
      await window.electronAPI.deleteBackupCodeEntry(id);
      if (selectedEntry?.id === id) {
        setSelectedEntry(null);
      }
      await loadEntries();
      
      // Автосохранение на облачные диски
      await triggerCloudSync();
    } catch (error) {
      console.error('Ошибка удаления записи:', error);
      alert('Ошибка удаления записи');
    }
  };

  const handleToggleCode = async (entryId: number, codeIndex: number) => {
    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      // Расшифровываем данные
      const decrypted = await window.electronAPI.decryptBackupCodeEntry(entry) as BackupCodeEntryData;
      const codes: BackupCode[] = decrypted.codes || [];

      // Переключаем статус кода
      codes[codeIndex].used = !codes[codeIndex].used;

      const request: UpdateBackupCodeEntryRequest = {
        codes: codes,
      };

      await window.electronAPI.updateBackupCodeEntry(entryId, request);
      await loadEntries();

      // Обновляем выбранную запись
      if (selectedEntry?.id === entryId) {
        const updated = await window.electronAPI.getBackupCodeEntryById(entryId) as DatabaseBackupCodeEntry;
        const decryptedUpdated = await window.electronAPI.decryptBackupCodeEntry(updated) as BackupCodeEntryData;
        setSelectedEntry({ ...updated, data: decryptedUpdated });
      }
      
      // Автосохранение на облачные диски
      await triggerCloudSync();
    } catch (error) {
      console.error('Ошибка обновления кода:', error);
      alert('Ошибка обновления кода');
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      // Можно добавить toast уведомление
    } catch (error) {
      console.error('Ошибка копирования:', error);
    }
  };

  const handleDeleteCode = async (entryId: number, codeIndex: number) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    const decrypted = await window.electronAPI.decryptBackupCodeEntry(entry) as BackupCodeEntryData;
    const codes: BackupCode[] = decrypted.codes || [];
    const codeToDelete = codes[codeIndex];
    
    if (!codeToDelete) return;

    const confirmed = await window.electronAPI.showDeleteBackupCodeDialog(codeToDelete.code, false);
    if (!confirmed) {
      return;
    }

    try {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const decrypted = await window.electronAPI.decryptBackupCodeEntry(entry) as BackupCodeEntryData;
      const codes: BackupCode[] = decrypted.codes || [];

      // Удаляем код по индексу
      codes.splice(codeIndex, 1);

      const request: UpdateBackupCodeEntryRequest = {
        codes: codes,
      };

      await window.electronAPI.updateBackupCodeEntry(entryId, request);
      await loadEntries();

      // Обновляем выбранную запись
      if (selectedEntry?.id === entryId) {
        const updated = await window.electronAPI.getBackupCodeEntryById(entryId) as DatabaseBackupCodeEntry;
        const decryptedUpdated = await window.electronAPI.decryptBackupCodeEntry(updated) as BackupCodeEntryData;
        setSelectedEntry({ ...updated, data: decryptedUpdated });
      }
      
      void triggerCloudSync();
    } catch (error) {
      console.error('Ошибка удаления кода:', error);
      alert('Ошибка удаления кода');
    }
  };

  const handleLoadFromTxt = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.txt')) {
      alert('Пожалуйста, выберите TXT файл');
      return;
    }

    try {
      const text = await file.text();
      // Парсим коды из текста (каждая строка или разделенные пробелами/запятыми)
      const codes = text
        .split(/\n/)
        .flatMap(line => line.split(/[\s,;]+/))
        .map(code => code.trim())
        .filter(code => code.length > 0)
        .filter((code, index, arr) => {
          // Убираем дубликаты и пустые строки
          return code && arr.indexOf(code) === index;
        });

      if (codes.length === 0) {
        alert('Не удалось найти коды в файле');
        return;
      }

      setNewCodes(codes.join('\n'));
      if (!newTitle.trim() && file.name) {
        // Предлагаем название из имени файла
        const suggestedTitle = file.name.replace(/\.txt$/i, '').trim();
        if (suggestedTitle) {
          setNewTitle(suggestedTitle);
        }
      }
      
      // Сбрасываем input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Ошибка чтения файла:', error);
      alert('Ошибка чтения файла');
    }
  };

  const handleExportToTxt = async (entry: BackupCodeEntryWithData) => {
    if (!entry.data?.codes || entry.data.codes.length === 0) {
      alert('Нет кодов для экспорта');
      return;
    }

    try {
      const title = entry.data.title || entry.title || 'Резервные коды';
      let content = `${title}\n${'='.repeat(title.length)}\n\n`;
      
      entry.data.codes.forEach((code: BackupCode, index: number) => {
        const status = code.used ? '[ИСПОЛЬЗОВАН]' : '';
        content += `${index + 1}. ${code.code} ${status}\n`;
      });

      // Создаем blob и скачиваем
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title.replace(/[^a-zа-яё0-9]/gi, '_')}_backup_codes.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка экспорта:', error);
      alert('Ошибка экспорта в TXT');
    }
  };

  const handleSelectEntry = async (entry: DatabaseBackupCodeEntry) => {
    try {
      const decrypted = await window.electronAPI.decryptBackupCodeEntry(entry) as BackupCodeEntryData;
      setSelectedEntry({ ...entry, data: decrypted });
      setEditingTitle(decrypted.title || entry.title || '');
    } catch (error) {
      console.error('Ошибка расшифровки:', error);
      alert('Ошибка расшифровки записи');
    }
  };

  const handleUpdateTitle = async () => {
    if (!selectedEntry) return;

    try {
      const request: UpdateBackupCodeEntryRequest = {
        title: editingTitle.trim(),
      };
      await window.electronAPI.updateBackupCodeEntry(selectedEntry.id, request);
      await loadEntries();
      const updated = await window.electronAPI.getBackupCodeEntryById(selectedEntry.id) as DatabaseBackupCodeEntry;
      const decrypted = await window.electronAPI.decryptBackupCodeEntry(updated) as BackupCodeEntryData;
      setSelectedEntry({ ...updated, data: decrypted });
      
      // Автосохранение на облачные диски
      await triggerCloudSync();
    } catch (error) {
      console.error('Ошибка обновления названия:', error);
      alert('Ошибка обновления названия');
    }
  };

  if (loading) {
    return <div className="backup-codes-loading">Загрузка...</div>;
  }

  return (
    <div className="backup-codes">
      <div className="backup-codes-header">
        <h2>Резервные коды</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onSortChange && (
            <div className="sort-control">
              <ArrowUpDown size={16} />
              <select value={sortType} onChange={(e) => onSortChange(e.target.value as SortType)} className="sort-select">
                <option value="none">Без сортировки</option>
                <option value="name-asc">По имени (А-Я)</option>
                <option value="name-desc">По имени (Я-А)</option>
                <option value="date-desc">По дате (новые)</option>
                <option value="date-asc">По дате (старые)</option>
              </select>
            </div>
          )}
          {onClose && (
            <button className="close-button" onClick={onClose}>
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="backup-codes-content">
        <div className="backup-codes-list">
          <button
            className="add-entry-button"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus size={18} />
            <span>Добавить резервные коды</span>
          </button>

          {showAddForm && (
            <div className="add-entry-form">
              <input
                type="text"
                placeholder="Название (например: Google Account)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="form-input"
              />
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".txt"
                  onChange={handleLoadFromTxt}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Upload size={14} />
                  Загрузить из TXT
                </button>
              </div>
              <textarea
                placeholder="Введите коды, каждый с новой строки или загрузите из TXT файла"
                value={newCodes}
                onChange={(e) => setNewCodes(e.target.value)}
                className="form-textarea"
                rows={8}
              />
              <div className="form-actions">
                <button className="primary-button" onClick={handleAddEntry}>
                  Сохранить
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewTitle('');
                    setNewCodes('');
                  }}
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          <div className="entries-list">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={`entry-item ${selectedEntry?.id === entry.id ? 'selected' : ''}`}
                onClick={() => handleSelectEntry(entry)}
              >
                <div className="entry-title">{entry.title}</div>
                <button
                  className="delete-entry-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteEntry(entry.id);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="backup-codes-detail">
          {selectedEntry ? (
            <div className="entry-detail">
              <div className="entry-detail-header">
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={handleUpdateTitle}
                  onKeyPress={(e) => e.key === 'Enter' && handleUpdateTitle()}
                  className="entry-title-input"
                />
              </div>
              <div className="codes-header-actions">
                <button
                  className="export-button"
                  onClick={() => handleExportToTxt(selectedEntry)}
                  title="Экспортировать в TXT"
                >
                  <Download size={16} />
                  <span>Экспорт в TXT</span>
                </button>
              </div>
              <div className="codes-grid">
                {selectedEntry.data?.codes?.map((code: BackupCode, index: number) => (
                  <div
                    key={index}
                    className={`code-item ${code.used ? 'used' : ''}`}
                  >
                    <div className="code-number">{index + 1}</div>
                    <div className="code-content">
                      <span className={`code-text ${code.used ? 'code-text-used' : ''}`}>{code.code}</span>
                      {code.used && (
                        <span className="code-used-badge">Использован</span>
                      )}
                    </div>
                    <div className="code-actions">
                      {!code.used && (
                        <>
                          <button
                            className="copy-code-button"
                            onClick={() => handleCopyCode(code.code)}
                            title="Копировать код"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            className="mark-used-button"
                            onClick={() => handleToggleCode(selectedEntry.id, index)}
                            title="Отметить как использованный"
                          >
                            <Check size={14} />
                          </button>
                        </>
                      )}
                      <button
                        className="delete-code-button"
                        onClick={() => handleDeleteCode(selectedEntry.id, index)}
                        title="Удалить код"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>Выберите запись для просмотра кодов</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

