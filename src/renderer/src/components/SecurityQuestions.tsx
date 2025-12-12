import { useState, useEffect } from 'react';
import { Plus, Trash2, X, Edit2, Save, ArrowUpDown } from 'lucide-react';
import { DatabaseSecurityQuestionEntry, SecurityQuestion, CreateSecurityQuestionEntryRequest, UpdateSecurityQuestionEntryRequest, SecurityQuestionEntryData } from '../../../shared/types';
import './SecurityQuestions.css';

type SortType = 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc' | 'none';

interface SecurityQuestionsProps {
  onClose?: () => void;
  sortType?: SortType;
  onSortChange?: (sortType: SortType) => void;
}

interface SecurityQuestionEntryWithData extends DatabaseSecurityQuestionEntry {
  data?: SecurityQuestionEntryData;
}

export function SecurityQuestions({ onClose, sortType = 'none', onSortChange }: SecurityQuestionsProps) {
  const [entries, setEntries] = useState<DatabaseSecurityQuestionEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<SecurityQuestionEntryWithData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newQuestions, setNewQuestions] = useState<SecurityQuestion[]>([{ question: '', answer: '' }]);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingQuestions, setEditingQuestions] = useState<SecurityQuestion[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  const sortEntries = (entriesList: DatabaseSecurityQuestionEntry[]): DatabaseSecurityQuestionEntry[] => {
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
      const data = await window.electronAPI.getSecurityQuestionEntries() as any;
      setEntries(sortEntries(data));
    } catch (error) {
      console.error('Ошибка загрузки контрольных вопросов:', error);
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
    if (!newTitle.trim() || newQuestions.some(q => !q.question.trim() || !q.answer.trim())) {
      alert('Заполните название и все вопросы с ответами');
      return;
    }

    try {
      const request: CreateSecurityQuestionEntryRequest = {
        title: newTitle.trim(),
        questions: newQuestions.filter(q => q.question.trim() && q.answer.trim()),
      };

      await window.electronAPI.createSecurityQuestionEntry(request);
      setNewTitle('');
      setNewQuestions([{ question: '', answer: '' }]);
      setShowAddForm(false);
      await loadEntries();
      
      // Автосохранение на облачные диски
      try {
        const cloudSettings = await window.electronAPI.getCloudSettings();
        if (cloudSettings.yandexDisk?.enabled || cloudSettings.googleDrive?.enabled) {
          await window.electronAPI.syncToCloud();
        }
      } catch (error) {
        console.error('Ошибка синхронизации с облаком:', error);
      }
    } catch (error) {
      console.error('Ошибка создания записи:', error);
      alert('Ошибка создания записи');
    }
  };

  const handleDeleteEntry = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту запись?')) {
      return;
    }

    try {
      await window.electronAPI.deleteSecurityQuestionEntry(id);
      if (selectedEntry?.id === id) {
        setSelectedEntry(null);
      }
      await loadEntries();
      
      // Автосохранение на облачные диски
      try {
        const cloudSettings = await window.electronAPI.getCloudSettings();
        if (cloudSettings.yandexDisk?.enabled || cloudSettings.googleDrive?.enabled) {
          await window.electronAPI.syncToCloud();
        }
      } catch (error) {
        console.error('Ошибка синхронизации с облаком:', error);
      }
    } catch (error) {
      console.error('Ошибка удаления записи:', error);
      alert('Ошибка удаления записи');
    }
  };

  const handleSelectEntry = async (entry: DatabaseSecurityQuestionEntry) => {
    try {
      const decrypted = await window.electronAPI.decryptSecurityQuestionEntry(entry) as SecurityQuestionEntryData;
      setSelectedEntry({ ...entry, data: decrypted });
      setEditingTitle(decrypted.title || entry.title || '');
      setEditingQuestions([...decrypted.questions]);
      setIsEditing(false);
    } catch (error) {
      console.error('Ошибка расшифровки:', error);
      alert('Ошибка расшифровки записи');
    }
  };

  const handleUpdateTitle = async () => {
    if (!selectedEntry) return;

    try {
      const request: UpdateSecurityQuestionEntryRequest = {
        title: editingTitle.trim(),
      };
      await window.electronAPI.updateSecurityQuestionEntry(selectedEntry.id, request);
      await loadEntries();
      const updated = await window.electronAPI.getSecurityQuestionEntryById(selectedEntry.id) as DatabaseSecurityQuestionEntry;
      const decrypted = await window.electronAPI.decryptSecurityQuestionEntry(updated) as SecurityQuestionEntryData;
      setSelectedEntry({ ...updated, data: decrypted });
      
      // Автосохранение на облачные диски
      try {
        const cloudSettings = await window.electronAPI.getCloudSettings();
        if (cloudSettings.yandexDisk?.enabled || cloudSettings.googleDrive?.enabled) {
          await window.electronAPI.syncToCloud();
        }
      } catch (error) {
        console.error('Ошибка синхронизации с облаком:', error);
      }
    } catch (error) {
      console.error('Ошибка обновления названия:', error);
      alert('Ошибка обновления названия');
    }
  };

  const handleSaveQuestions = async () => {
    if (!selectedEntry) return;

    if (editingQuestions.some(q => !q.question.trim() || !q.answer.trim())) {
      alert('Заполните все вопросы и ответы');
      return;
    }

    try {
      const request: UpdateSecurityQuestionEntryRequest = {
        questions: editingQuestions.filter(q => q.question.trim() && q.answer.trim()),
      };
      await window.electronAPI.updateSecurityQuestionEntry(selectedEntry.id, request);
      await loadEntries();
      const updated = await window.electronAPI.getSecurityQuestionEntryById(selectedEntry.id) as DatabaseSecurityQuestionEntry;
      const decrypted = await window.electronAPI.decryptSecurityQuestionEntry(updated) as SecurityQuestionEntryData;
      setSelectedEntry({ ...updated, data: decrypted });
      setEditingQuestions([...decrypted.questions]);
      setIsEditing(false);
      
      // Автосохранение на облачные диски
      try {
        const cloudSettings = await window.electronAPI.getCloudSettings();
        if (cloudSettings.yandexDisk?.enabled || cloudSettings.googleDrive?.enabled) {
          await window.electronAPI.syncToCloud();
        }
      } catch (error) {
        console.error('Ошибка синхронизации с облаком:', error);
      }
    } catch (error) {
      console.error('Ошибка обновления вопросов:', error);
      alert('Ошибка обновления вопросов');
    }
  };

  const addNewQuestion = () => {
    setNewQuestions([...newQuestions, { question: '', answer: '' }]);
  };

  const removeQuestion = (index: number) => {
    setNewQuestions(newQuestions.filter((_, i) => i !== index));
  };

  const updateNewQuestion = (index: number, field: 'question' | 'answer', value: string) => {
    const updated = [...newQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setNewQuestions(updated);
  };

  const addEditingQuestion = () => {
    setEditingQuestions([...editingQuestions, { question: '', answer: '' }]);
  };

  const removeEditingQuestion = (index: number) => {
    setEditingQuestions(editingQuestions.filter((_, i) => i !== index));
  };

  const updateEditingQuestion = (index: number, field: 'question' | 'answer', value: string) => {
    const updated = [...editingQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setEditingQuestions(updated);
  };

  if (loading) {
    return <div className="security-questions-loading">Загрузка...</div>;
  }

  return (
    <div className="security-questions">
      <div className="security-questions-header">
        <h2>Контрольные вопросы</h2>
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

      <div className="security-questions-content">
        <div className="security-questions-list">
          <button
            className="add-entry-button"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus size={18} />
            <span>Добавить контрольные вопросы</span>
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
              <div className="questions-form-list">
                {newQuestions.map((q, index) => (
                  <div key={index} className="question-form-item">
                    <input
                      type="text"
                      placeholder="Контрольный вопрос"
                      value={q.question}
                      onChange={(e) => updateNewQuestion(index, 'question', e.target.value)}
                      className="form-input"
                    />
                    <input
                      type="text"
                      placeholder="Ответ на вопрос"
                      value={q.answer}
                      onChange={(e) => updateNewQuestion(index, 'answer', e.target.value)}
                      className="form-input"
                    />
                    {newQuestions.length > 1 && (
                      <button
                        className="remove-question-button"
                        onClick={() => removeQuestion(index)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button className="add-question-button" onClick={addNewQuestion}>
                  <Plus size={16} />
                  <span>Добавить вопрос</span>
                </button>
              </div>
              <div className="form-actions">
                <button className="primary-button" onClick={handleAddEntry}>
                  Сохранить
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewTitle('');
                    setNewQuestions([{ question: '', answer: '' }]);
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

        <div className="security-questions-detail">
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
              <div className="questions-actions">
                {!isEditing ? (
                  <button className="edit-button" onClick={() => setIsEditing(true)}>
                    <Edit2 size={16} />
                    <span>Редактировать</span>
                  </button>
                ) : (
                  <button className="save-button" onClick={handleSaveQuestions}>
                    <Save size={16} />
                    <span>Сохранить</span>
                  </button>
                )}
              </div>
              <div className="questions-list">
                {(isEditing ? editingQuestions : selectedEntry.data?.questions || []).map((question: SecurityQuestion, index: number) => (
                  <div key={index} className="question-item">
                    {isEditing ? (
                      <>
                        <input
                          type="text"
                          value={question.question}
                          onChange={(e) => updateEditingQuestion(index, 'question', e.target.value)}
                          className="question-input"
                          placeholder="Контрольный вопрос"
                        />
                        <input
                          type="text"
                          value={question.answer}
                          onChange={(e) => updateEditingQuestion(index, 'answer', e.target.value)}
                          className="answer-input"
                          placeholder="Ответ на вопрос"
                        />
                        {editingQuestions.length > 1 && (
                          <button
                            className="remove-question-button"
                            onClick={() => removeEditingQuestion(index)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="question-text">{question.question}</div>
                        <div className="answer-text">{question.answer}</div>
                      </>
                    )}
                  </div>
                ))}
                {isEditing && (
                  <button className="add-question-button" onClick={addEditingQuestion}>
                    <Plus size={16} />
                    <span>Добавить вопрос</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>Выберите запись для просмотра вопросов</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

