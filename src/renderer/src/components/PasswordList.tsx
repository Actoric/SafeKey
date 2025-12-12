import { PasswordEntry } from '../../../shared/types';
import { Trash2, Edit, Star, ArrowUpDown } from 'lucide-react';
import './PasswordList.css';

type SortType = 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc' | 'none';

interface PasswordListProps {
  passwords: PasswordEntry[];
  onSelect: (password: PasswordEntry | null) => void;
  onDelete: (id: number) => void;
  onToggleFavorite?: (id: number) => void;
  loading: boolean;
  sortType?: SortType;
  onSortChange?: (sortType: SortType) => void;
}

export function PasswordList({ passwords, onSelect, onDelete, onToggleFavorite, loading, sortType = 'none', onSortChange }: PasswordListProps) {
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onSortChange) {
      onSortChange(e.target.value as SortType);
    }
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
      </div>
      <div className="password-list-content">
        {passwords.map((password) => (
          <div
            key={password.id}
            className="password-item"
            onClick={() => onSelect(password)}
          >
            <div className="password-item-main">
              <div className="password-item-icon">
                {password.data.service.charAt(0).toUpperCase()}
              </div>
              <div className="password-item-info">
                <div className="password-item-title">{password.data.service}</div>
                <div className="password-item-subtitle">{password.data.login}</div>
              </div>
            </div>
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
          </div>
        ))}
      </div>
    </div>
  );
}