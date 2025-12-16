import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import React from 'react';
import { PasswordEntry, Category } from '../../../shared/types';
import { PasswordGenerator } from './PasswordGenerator';
import { Copy, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import './PasswordEditor.css';

interface PasswordEditorProps {
  password: PasswordEntry | null;
  onSave: (entry: Partial<PasswordEntry>) => void;
  onCancel: () => void;
  selectedCategoryId?: number | null;
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
