import { useState } from 'react';
import { PasswordEntry } from '../../../shared/types';
import { Trash2, Edit, Star, ArrowUpDown, CheckSquare, Square } from 'lucide-react';
import './PasswordList.css';

type SortType = 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc' | 'none';

interface PasswordListProps {
  passwords: PasswordEntry[];
  onSelect: (password: PasswordEntry | null) => void;
  onDelete: (id: number) => void;
  onDeleteMultiple?: (ids: number[]) => void;
  onToggleFavorite?: (id: number) => void;
  loading: boolean;
  sortType?: SortType;
  onSortChange?: (sortType: SortType) => void;
}

export function PasswordList({ passwords, onSelect, onDelete, onDeleteMultiple, onToggleFavorite, loading, sortType = 'none', onSortChange }: PasswordListProps) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onSortChange) {
      onSortChange(e.target.value as SortType);
    }
  };

  const toggleSelection = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === passwords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(passwords.map(p => p.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (onDeleteMultiple && selectedIds.size > 0) {
      onDeleteMultiple(Array.from(selectedIds));
      setSelectedIds(new Set());
      setSelectionMode(false);
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };
  if (loading) {
    return (
      <div className="password-list">
        <div className="password-list-header">
          <h3>Пароли</h3>
        </div>
        <div className="password-list-content">
          <div className="loading">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (passwords.length === 0) {
    return (
      <div className="password-list">
        <div className="password-list-header">
          <h3>Пароли</h3>
        </div>
        <div className="password-list-content">
          <div className="empty-state">
            <p>Паролей пока нет</p>
            <p className="empty-state-subtitle">Нажмите "Новый пароль" для создания</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="password-list">
      <div className="password-list-header">
        <h3>Пароли ({passwords.length})</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {selectionMode ? (
            <>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Выбрано: {selectedIds.size}
              </span>
              {selectedIds.size > 0 && onDeleteMultiple && (
                <button
                  className="icon-button danger"
                  onClick={handleDeleteSelected}
                  title="Удалить выбранные"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                className="icon-button"
                onClick={exitSelectionMode}
                title="Выйти из режима выбора"
              >
                <Square size={16} />
              </button>
            </>
          ) : (
            <>
              {onSortChange && (
                <div className="sort-control">
                  <ArrowUpDown size={16} />
                  <select value={sortType} onChange={handleSortChange} className="sort-select">
                    <option value="none">Без сортировки</option>
                    <option value="name-asc">По имени (А-Я)</option>
                    <option value="name-desc">По имени (Я-А)</option>
                    <option value="date-desc">По дате (новые)</option>
                    <option value="date-asc">По дате (старые)</option>
                  </select>
                </div>
              )}
              {onDeleteMultiple && (
                <button
                  className="icon-button"
                  onClick={() => setSelectionMode(true)}
                  title="Выбрать несколько"
                >
                  <CheckSquare size={16} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <div className="password-list-content">
        {selectionMode && passwords.length > 0 && (
          <div className="password-item-select-all">
            <button
              className="select-all-checkbox"
              onClick={toggleSelectAll}
            >
              {selectedIds.size === passwords.length ? (
                <CheckSquare size={18} />
              ) : (
                <Square size={18} />
              )}
            </button>
            <span onClick={toggleSelectAll} style={{ cursor: 'pointer', flex: 1 }}>
              {selectedIds.size === passwords.length ? 'Снять выделение' : 'Выбрать все'}
            </span>
          </div>
        )}
        {passwords.map((password) => (
          <div
            key={password.id}
            className={`password-item ${selectionMode ? 'selection-mode' : ''} ${selectedIds.has(password.id) ? 'selected' : ''}`}
            onClick={() => {
              if (selectionMode) {
                toggleSelection(password.id);
              } else {
                onSelect(password);
              }
            }}
          >
            {selectionMode && (
              <div className="password-item-checkbox" onClick={(e) => e.stopPropagation()}>
                <button
                  className="checkbox-button"
                  onClick={() => toggleSelection(password.id)}
                >
                  {selectedIds.has(password.id) ? (
                    <CheckSquare size={18} />
                  ) : (
                    <Square size={18} />
                  )}
                </button>
              </div>
            )}
            <div className="password-item-main">
              <div className="password-item-icon">
                {password.data.service.charAt(0).toUpperCase()}
              </div>
              <div className="password-item-info">
                <div className="password-item-title">{password.data.service}</div>
                <div className="password-item-subtitle">{password.data.login}</div>
              </div>
            </div>
            {!selectionMode && (
              <div className="password-item-actions">
                {onToggleFavorite && (
                  <button
                    className={`icon-button ${password.is_favorite ? 'favorite' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(password.id);
                    }}
                    title={password.is_favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
                  >
                    <Star size={16} fill={password.is_favorite ? 'currentColor' : 'none'} />
                  </button>
                )}
                <button
                  className="icon-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(password);
                  }}
                >
                  <Edit size={16} />
                </button>
                <button
                  className="icon-button danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(password.id);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}