import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Star, Settings, LogOut, ChevronDown, ChevronRight, Folder, FolderOpen, Key, HelpCircle, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Category, CloudStorageQuota } from '../../../shared/types';
import { triggerCloudSync } from '../utils/cloud-sync';
import './Sidebar.css';

interface SidebarProps {
  onSearch: (query: string) => void;
  onNewPassword?: () => void;
  onCategorySelect?: (categoryId: number | null) => void;
  onFavoriteClick?: () => void;
  onSettingsClick?: () => void;
  onBackupCodesClick?: () => void;
  onSecurityQuestionsClick?: () => void;
  selectedCategoryId?: number | null;
  showFavorites?: boolean;
  showBackupCodes?: boolean;
  showSecurityQuestions?: boolean;
  onCategoryCreated?: () => void; // Callback для обновления категорий после создания
}

export function Sidebar({ 
  onSearch, 
  onNewPassword, 
  onCategorySelect,
  onFavoriteClick,
  onSettingsClick,
  onBackupCodesClick,
  onSecurityQuestionsClick,
  selectedCategoryId,
  showFavorites = false,
  onCategoryCreated,
  showBackupCodes = false,
  showSecurityQuestions = false
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [parentCategoryId, setParentCategoryId] = useState<number | null>(null);
  const [quotas, setQuotas] = useState<CloudStorageQuota[]>([]);
  const [cloudConnected, setCloudConnected] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | undefined>();
  const { logout } = useAuth();

  useEffect(() => {
    loadCategories();
    loadCloudInfo();
  }, []);

  const loadCloudInfo = async () => {
    try {
      const settings = await window.electronAPI.getCloudSettings();
      const yandex = !!(settings.yandexDisk?.enabled && (settings.yandexDisk.connected || settings.yandexDisk.token));
      const google = !!(settings.googleDrive?.enabled && (settings.googleDrive.connected || settings.googleDrive.token));
      setCloudConnected(yandex || google);
      setLastBackupAt(settings.status?.lastBackupAt);
      if (yandex || google) {
        const result = await window.electronAPI.getCloudStorageQuota();
        if (result.success) setQuotas(result.quotas || []);
      } else {
        setQuotas([]);
      }
    } catch (error) {
      console.error('Ошибка загрузки облачной информации:', error);
    }
  };

  const formatQuota = (bytes: number) => {
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} МБ`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ГБ`;
  };

  const formatRelative = (iso?: string) => {
    if (!iso) return 'нет бэкапа';
    const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return 'только что';
    if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
    return new Date(iso).toLocaleDateString('ru-RU');
  };

  const providerShort = (p: string) => (p === 'yandex' ? 'Яндекс.Диск' : 'Google Drive');

  const loadCategories = async () => {
    try {
      const cats = await window.electronAPI.getCategories();
      setCategories(cats);
    } catch (error) {
      console.error('Ошибка загрузки категорий:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Очищаем предыдущий таймер
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Устанавливаем новый таймер для debounce (300ms)
    searchTimeoutRef.current = setTimeout(() => {
      onSearch(query);
    }, 300);
  };

  useEffect(() => {
    // Очищаем таймер при размонтировании
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const toggleCategory = (categoryId: number) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleCategoryClick = (categoryId: number | null) => {
    if (onCategorySelect) {
      onCategorySelect(categoryId);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await window.electronAPI.createCategory(newCategoryName.trim(), parentCategoryId);
      setNewCategoryName('');
      setParentCategoryId(null);
      setShowCreateCategory(false);
      await loadCategories();
      // Уведомляем родительский компонент о создании категории
      if (onCategoryCreated) {
        onCategoryCreated();
      }
    } catch (error) {
      console.error('Ошибка создания категории:', error);
      alert('Ошибка создания категории');
    }
  };

  const handleDeleteCategory = async (categoryId: number, categoryName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Предотвращаем выбор категории при клике на кнопку удаления
    
    // Проверяем, есть ли дочерние категории
    const hasChildren = categories.some(c => c.parent_id === categoryId);
    
    // Используем кастомный диалог
    const confirmed = await window.electronAPI.showDeleteCategoryDialog(categoryName, hasChildren);
    if (!confirmed) {
      // Немедленно разблокируем поля ввода при отмене
      const unlockInputs = () => {
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach((input) => {
          if (input instanceof HTMLElement) {
            input.style.pointerEvents = 'auto';
            input.style.opacity = '1';
            input.style.cursor = 'text';
            input.removeAttribute('disabled');
            input.removeAttribute('readonly');
            input.removeAttribute('aria-disabled');
            input.classList.remove('disabled', 'readonly', 'blocked');
          }
        });
        const containers = document.querySelectorAll('.password-editor, .settings-field, form, .main-content');
        containers.forEach((container) => {
          if (container instanceof HTMLElement) {
            container.style.pointerEvents = 'auto';
          }
        });
      };
      unlockInputs();
      return;
    }

    try {
      // Немедленно разблокируем поля ввода перед удалением
      const unlockInputs = () => {
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach((input) => {
          if (input instanceof HTMLElement) {
            input.style.pointerEvents = 'auto';
            input.style.opacity = '1';
            input.style.cursor = 'text';
            input.removeAttribute('disabled');
            input.removeAttribute('readonly');
            input.removeAttribute('aria-disabled');
            input.classList.remove('disabled', 'readonly', 'blocked');
          }
        });
        const containers = document.querySelectorAll('.password-editor, .settings-field, form, .main-content');
        containers.forEach((container) => {
          if (container instanceof HTMLElement) {
            container.style.pointerEvents = 'auto';
          }
        });
      };
      unlockInputs();

      await window.electronAPI.deleteCategory(categoryId);
      await loadCategories();
      // Если удаленная категория была выбрана, сбрасываем выбор
      if (selectedCategoryId === categoryId && onCategorySelect) {
        onCategorySelect(null);
      }
      // Уведомляем родительский компонент об удалении категории
      if (onCategoryCreated) {
        onCategoryCreated();
      }
      
      // Синхронизация с облаком в фоне (не блокирует UI)
      void triggerCloudSync();
      
      // Дополнительная разблокировка после удаления
      setTimeout(unlockInputs, 50);
      setTimeout(unlockInputs, 100);
    } catch (error) {
      console.error('Ошибка удаления категории:', error);
      alert('Ошибка удаления категории');
      
      // Разблокируем поля ввода даже при ошибке
      const unlockInputs = () => {
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach((input) => {
          if (input instanceof HTMLElement) {
            input.style.pointerEvents = 'auto';
            input.style.opacity = '1';
            input.style.cursor = 'text';
            input.removeAttribute('disabled');
            input.removeAttribute('readonly');
            input.removeAttribute('aria-disabled');
            input.classList.remove('disabled', 'readonly', 'blocked');
          }
        });
        const containers = document.querySelectorAll('.password-editor, .settings-field, form, .main-content');
        containers.forEach((container) => {
          if (container instanceof HTMLElement) {
            container.style.pointerEvents = 'auto';
          }
        });
      };
      unlockInputs();
      setTimeout(unlockInputs, 50);
      setTimeout(unlockInputs, 100);
    }
  };

  const renderCategory = (category: Category, level: number = 0) => {
    const children = categories.filter(c => c.parent_id === category.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedCategories.has(category.id);
    const isSelected = selectedCategoryId === category.id;

    return (
      <div key={category.id}>
        <div
          className={`category-item ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${12 + level * 20}px` }}
          onClick={() => {
            if (hasChildren) {
              toggleCategory(category.id);
            }
            handleCategoryClick(category.id);
          }}
        >
          {hasChildren ? (
            <button
              className="category-toggle"
              onClick={(e) => {
                e.stopPropagation();
                toggleCategory(category.id);
              }}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span style={{ width: '14px' }} />
          )}
          {isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
          <span className="category-name">{category.name}</span>
          <div className="category-actions">
            <button
              className="category-delete-btn"
              onClick={(e) => handleDeleteCategory(category.id, category.name, e)}
              title="Удалить раскладку"
            >
              <X size={12} />
            </button>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div className="category-children">
            {children.map(child => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootCategories = categories.filter(c => c.parent_id === null);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="brand-mark lg" aria-hidden />
        <div className="sidebar-header-text">
          <h2>SafeKey</h2>
          <span className="sidebar-header-sub">локальное хранилище</span>
        </div>
      </div>

      <div className="sidebar-search">
        <Search size={16} />
        <input
          type="text"
          placeholder="Поиск по сервисам…"
          value={searchQuery}
          onChange={handleSearchChange}
        />
      </div>

      <div className="sidebar-nav">
        <button className="nav-item" onClick={onNewPassword}>
          <Plus size={18} />
          <span>Новый пароль</span>
        </button>
        <button className={`nav-item ${showFavorites ? 'selected' : ''}`} onClick={onFavoriteClick}>
          <Star size={18} />
          <span>Избранное</span>
        </button>
        <button className={`nav-item ${showBackupCodes ? 'selected' : ''}`} onClick={onBackupCodesClick}>
          <Key size={18} />
          <span>Резервные коды</span>
        </button>
        <button className={`nav-item ${showSecurityQuestions ? 'selected' : ''}`} onClick={onSecurityQuestionsClick}>
          <HelpCircle size={18} />
          <span>Контрольные вопросы</span>
        </button>
      </div>

      <div className="sidebar-categories">
        <div className="sidebar-section-header">
          <span>Раскладки</span>
          <button
            className="icon-button-small"
            onClick={() => setShowCreateCategory(!showCreateCategory)}
            title="Создать раскладку"
          >
            <Plus size={14} />
          </button>
        </div>
        {showCreateCategory && (
          <div className="create-category-form">
            <input
              type="text"
              placeholder="Название раскладки"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateCategory()}
              autoFocus
            />
            <div className="create-category-actions">
              <button onClick={handleCreateCategory} className="small-button">Создать</button>
              <button onClick={() => {
                setShowCreateCategory(false);
                setNewCategoryName('');
              }} className="small-button secondary">Отмена</button>
            </div>
          </div>
        )}
        <button
          className={`category-item ${selectedCategoryId === null && !showFavorites && !showBackupCodes && !showSecurityQuestions ? 'selected' : ''}`}
          onClick={() => {
            handleCategoryClick(null);
          }}
        >
          <Folder size={16} />
          <span className="category-name">Все пароли</span>
        </button>
        {loading ? (
          <div className="loading">Загрузка...</div>
        ) : (
          rootCategories.map(cat => renderCategory(cat))
        )}
      </div>

      <div className="sidebar-footer">
        {cloudConnected && (
          <div className="sidebar-sync-pill">
            <span className="sidebar-sync-dot" />
            Облако · {formatRelative(lastBackupAt)}
          </div>
        )}
        {quotas.length > 0 && (
          <div className="sidebar-storage">
            {quotas.map((q) => (
              <div className="sidebar-storage-row" key={q.provider}>
                <div className="sidebar-storage-head">
                  <span>{providerShort(q.provider)}</span>
                  <span>{formatQuota(q.used)} / {formatQuota(q.total)}</span>
                </div>
                <div className="sidebar-storage-bar">
                  <i
                    className="sidebar-storage-fill"
                    style={{ width: `${Math.min(100, Math.round((q.used / q.total) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="settings-btn" onClick={onSettingsClick}>
          <Settings size={16} />
          Параметры
        </button>
        <button className="nav-item sidebar-logout" onClick={logout}>
          <LogOut size={18} />
          <span>Выход</span>
        </button>
      </div>
    </div>
  );
}
