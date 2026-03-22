import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import React from 'react';
import { PasswordEntry, Category } from '../../../shared/types';
import { PasswordGenerator } from './PasswordGenerator';
import { Copy, Eye, EyeOff, ExternalLink, Upload } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import './PasswordEditor.css';

interface PasswordEditorProps {
  password: PasswordEntry | null;
  onSave: (entry: Partial<PasswordEntry>) => void;
  onCancel: () => void;
  selectedCategoryId?: number | null;
  onCategoryCreated?: () => void;
}

export const PasswordEditor = forwardRef<{ refreshCategories: () => void }, PasswordEditorProps>(
  ({ password, onSave, onCancel, selectedCategoryId, onCategoryCreated }, ref) => {
  const [service, setService] = useState('');
  const [login, setLogin] = useState('');
  const [pass, setPass] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(selectedCategoryId || null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importCategoryName, setImportCategoryName] = useState('');
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; visible: boolean }>({ current: 0, total: 0, visible: false });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  // Обновляем список категорий при каждом открытии редактора
  useEffect(() => {
    if (!password) {
      // При создании нового пароля обновляем список категорий
      loadCategories();
    }
  }, [password]);

  useEffect(() => {
    if (password) {
      setService(password.data.service || '');
      setLogin(password.data.login || '');
      setPass(password.data.password || '');
      setUrl(password.data.url || '');
      setNotes(password.data.notes || '');
      setCategoryId(password.category_id);
    } else {
      // Сбрасываем форму при создании нового пароля
      resetForm();
      // Устанавливаем фокус на первое поле при создании нового пароля
      setTimeout(() => {
        const firstInput = document.getElementById('service');
        if (firstInput) {
          firstInput.focus();
        }
      }, 100);
    }
  }, [password]);

  const loadCategories = async () => {
    try {
      const cats = await window.electronAPI.getCategories();
      setCategories(cats);
    } catch (error) {
      console.error('Ошибка загрузки категорий:', error);
    }
  };

  // Expose refreshCategories method via ref
  useImperativeHandle(ref, () => ({
    refreshCategories: loadCategories
  }));

  const renderCategoryOption = (category: Category, level: number = 0): JSX.Element[] => {
    const children = categories.filter(c => c.parent_id === category.id);
    const result: JSX.Element[] = [
      <option key={category.id} value={category.id}>
        {'  '.repeat(level)}📁 {category.name}
      </option>
    ];
    
    children.forEach(child => {
      result.push(...renderCategoryOption(child, level + 1));
    });
    
    return result;
  };


  const resetForm = () => {
    setService('');
    setLogin('');
    setPass('');
    setUrl('');
    setNotes('');
    setCategoryId(selectedCategoryId || null);
    setShowPassword(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title: service || 'Без названия',
      category_id: categoryId,
      data: {
        service,
        login,
        password: pass,
        url,
        notes,
      },
    });
    if (!password) {
      resetForm();
    }
  };

  const handleCopy = async (text: string) => {
    await copyToClipboard(text);
  };

  // Парсинг TXT файла (простой формат: каждая строка = сервис:логин:пароль или сервис:пароль)
  const parseTxtFile = (content: string): Partial<PasswordEntry>[] => {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const entries: Partial<PasswordEntry>[] = [];

    for (const line of lines) {
      const parts = line.split(':').map(p => p.trim());
      if (parts.length >= 2) {
        const service = parts[0];
        const login = parts.length >= 3 ? parts[1] : '';
        const password = parts.length >= 3 ? parts[2] : parts[1];
        
        entries.push({
          title: service,
          category_id: categoryId,
          data: {
            service,
            login,
            password,
            url: '',
            notes: '',
          },
        });
      }
    }

    return entries;
  };

  // Парсинг CSV файла (Яндекс формат)
  const parseCsvFile = (content: string): Partial<PasswordEntry>[] => {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const entries: Partial<PasswordEntry>[] = [];

    // Пропускаем заголовок, если он есть
    let startIndex = 0;
    if (lines.length > 0 && (lines[0].toLowerCase().includes('url') || lines[0].toLowerCase().includes('login') || lines[0].toLowerCase().includes('сайт'))) {
      startIndex = 1;
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      // Простой CSV парсинг (без учета кавычек и запятых внутри значений)
      const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
      
      // Яндекс формат обычно: URL/Сайт, Login, Password
      if (parts.length >= 2) {
        const siteOrUrl = parts[0]; // Первое поле - сайт/URL
        const login = parts.length >= 3 ? (parts[1] || '') : '';
        const password = parts.length >= 3 ? (parts[2] || '') : (parts[1] || '');
        
        // Используем первое поле (сайт) как название пароля
        let service = siteOrUrl;
        let url = '';
        
        // Если это URL, извлекаем домен для названия, но сохраняем URL
        if (siteOrUrl.startsWith('http://') || siteOrUrl.startsWith('https://')) {
          try {
            const urlObj = new URL(siteOrUrl);
            service = urlObj.hostname.replace('www.', '');
            url = siteOrUrl;
          } catch {
            service = siteOrUrl;
            url = siteOrUrl;
          }
        } else {
          // Если не URL, используем как есть
          service = siteOrUrl;
        }

        entries.push({
          title: service,
          category_id: categoryId,
          data: {
            service,
            login,
            password,
            url,
            notes: '',
          },
        });
      }
    }

    return entries;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Проверяем, что форма пустая (создание нового пароля)
    if (password) {
      alert('Импорт доступен только при создании нового пароля');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Показываем диалог для ввода названия импорта
    setShowImportDialog(true);
  };

  const handleImportConfirm = async () => {
    if (!importCategoryName.trim()) {
      alert('Введите название импорта');
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setShowImportDialog(false);
      return;
    }

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        let entries: Partial<PasswordEntry>[] = [];

        if (fileExtension === 'txt') {
          entries = parseTxtFile(content);
        } else if (fileExtension === 'csv') {
          entries = parseCsvFile(content);
        } else {
          alert('Неподдерживаемый формат файла. Используйте .txt или .csv');
          setShowImportDialog(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          return;
        }

        if (entries.length === 0) {
          alert('Не удалось найти пароли в файле. Проверьте формат файла.');
          setShowImportDialog(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          return;
        }

        // Создаем категорию с указанным названием
        let importCategoryId: number | null = null;
        try {
          const newCategory = await window.electronAPI.createCategory(importCategoryName.trim());
          importCategoryId = newCategory.id;
          // Обновляем список категорий
          await loadCategories();
          if (onCategoryCreated) {
            onCategoryCreated();
          }
        } catch (error) {
          console.error('Ошибка создания категории:', error);
          alert('Ошибка создания категории. Пароли будут импортированы без категории.');
        }

        // Показываем прогресс-бар импорта
        setImportProgress({ current: 0, total: entries.length, visible: true });
        setShowImportDialog(false);

        // Импортируем все пароли в созданную категорию
        let importedCount = 0;
        for (const entry of entries) {
          if (entry.data?.service && entry.data?.password) {
            onSave({
              ...entry,
              category_id: importCategoryId,
            });
            importedCount++;
            setImportProgress({ current: importedCount, total: entries.length, visible: true });
            // Небольшая задержка между импортами для избежания проблем
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        // Обновляем категории еще раз после импорта для гарантии
        await loadCategories();
        if (onCategoryCreated) {
          onCategoryCreated();
        }

        // Скрываем прогресс-бар через небольшую задержку
        setTimeout(() => {
          setImportProgress({ current: 0, total: 0, visible: false });
          alert(`Успешно импортировано ${importedCount} паролей в категорию "${importCategoryName.trim()}"`);
          setImportCategoryName('');
          resetForm();
        }, 500);
      } catch (error) {
        console.error('Ошибка импорта:', error);
        alert('Ошибка при импорте файла: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'));
        setShowImportDialog(false);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.onerror = () => {
      alert('Ошибка чтения файла');
      setShowImportDialog(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file, 'UTF-8');
  };

  return (
    <div className="password-editor">
      <div className="password-editor-header">
        <h3>{password ? 'Редактировать пароль' : 'Новый пароль'}</h3>
      </div>
      <form onSubmit={handleSubmit} className="password-editor-form">
        <div className="form-group">
          <label htmlFor="service">Название сервиса</label>
          <input
            type="text"
            id="service"
            value={service}
            onChange={(e) => setService(e.target.value)}
            placeholder="Например: Gmail"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="login">Логин / Email</label>
          <div className="input-with-action">
            <input
              type="text"
              id="login"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="user@example.com (необязательно)"
            />
            {login && (
              <button
                type="button"
                className="icon-button"
                onClick={() => handleCopy(login)}
              >
                <Copy size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="password">Пароль</label>
          <div className="input-with-action">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Введите пароль"
              required
            />
            <div className="input-actions">
              {pass && (
                <>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => handleCopy(pass)}
                  >
                    <Copy size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            className="link-button"
            onClick={() => setShowGenerator(!showGenerator)}
          >
            Сгенерировать пароль
          </button>
          {showGenerator && (
            <PasswordGenerator
              onGenerate={(generated) => {
                setPass(generated);
                setShowGenerator(false);
              }}
            />
          )}
        </div>

        <div className="form-group">
          <label htmlFor="url">URL (опционально)</label>
          <div className="input-with-action">
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
            />
            {url && (
              <>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => handleCopy(url)}
                  title="Копировать ссылку"
                >
                  <Copy size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={async () => {
                    if (url && window.electronAPI.openUrl) {
                      await window.electronAPI.openUrl(url);
                    }
                  }}
                  title="Открыть ссылку"
                >
                  <ExternalLink size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="notes">Заметки</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Дополнительная информация..."
            rows={2}
          />
        </div>

        <div className="form-group">
          <label htmlFor="category">Раскладка</label>
          <select
            id="category"
            value={categoryId || ''}
            onChange={(e) => setCategoryId(e.target.value ? parseInt(e.target.value) : null)}
          >
            <option value="">Без раскладки</option>
            {categories.filter(c => c.parent_id === null).flatMap(cat => renderCategoryOption(cat))}
          </select>
        </div>


        {!password && (
          <div className="form-group">
            <label>Импорт паролей</label>
            <input
              type="file"
              ref={fileInputRef}
              accept=".txt,.csv"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="import-button"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} />
              <span>Импортировать из TXT/CSV (Яндекс)</span>
            </button>
          </div>
        )}

        {showImportDialog && (
          <div className="import-dialog-overlay" onClick={() => setShowImportDialog(false)}>
            <div className="import-dialog" onClick={(e) => e.stopPropagation()}>
              <h3>Импорт паролей</h3>
              <p>Введите название для создаваемой раскладки (категории):</p>
              <input
                type="text"
                value={importCategoryName}
                onChange={(e) => setImportCategoryName(e.target.value)}
                placeholder="Например: Импорт из Яндекса"
                className="import-dialog-input"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleImportConfirm();
                  } else if (e.key === 'Escape') {
                    setShowImportDialog(false);
                    setImportCategoryName('');
                  }
                }}
              />
              <div className="import-dialog-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setShowImportDialog(false);
                    setImportCategoryName('');
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleImportConfirm}
                >
                  Импортировать
                </button>
              </div>
            </div>
          </div>
        )}

        {importProgress.visible && (
          <div className="import-progress-overlay">
            <div className="import-progress-dialog">
              <h3>Импорт паролей</h3>
              <p className="import-progress-text">
                Импортировано: {importProgress.current} из {importProgress.total} паролей
              </p>
              <div className="import-progress-bar-container">
                <div className="import-progress-bar">
                  <div 
                    className="import-progress-bar-fill" 
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Отмена
          </button>
          <button type="submit" className="primary-button">
            {password ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  );
});
