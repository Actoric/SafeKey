import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Star, Settings, LogOut, ChevronDown, ChevronRight, Folder, FolderOpen, Key, HelpCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Category } from '../../../shared/types';
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
  const { logout } = useAuth();

  useEffect(() => {
    loadCategories();
  }, []);

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
    } catch (error) {
      console.error('Ошибка создания категории:', error);
      alert('Ошибка создания категории');
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
        <h2>SafeKey</h2>
      </div>

      <div className="sidebar-search">
        <Search size={18} />
        <input
          type="text"
          placeholder="Поиск..."
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
        <button className="nav-item" onClick={onSettingsClick}>
          <Settings size={18} />
          <span>Настройки</span>
        </button>
        <button className="nav-item" onClick={logout}>
          <LogOut size={18} />
          <span>Выход</span>
        </button>
      </div>
    </div>
  );
}
