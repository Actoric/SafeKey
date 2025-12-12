import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import './MasterPasswordLogin.css';

export function MasterPasswordLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      console.log('[Login] Отправка формы входа...');
      const result = await login(password);
      console.log('[Login] Результат login:', result);
      if (!result) {
        console.log('[Login] Неверный пароль, показываем ошибку');
        setError('Неверный пароль');
      } else {
        console.log('[Login] Вход успешен, ожидаем обновление UI...');
      }
    } catch (err) {
      console.error('[Login] Ошибка при входе:', err);
      setError('Ошибка при входе: ' + (err instanceof Error ? err.message : 'Неизвестная ошибка'));
    }
  };

  return (
    <div className="master-password-container">
      <div className="master-password-card">
        <h1>SafeKey</h1>
        <p className="subtitle">Введите мастер-пароль</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">Мастер-пароль</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите мастер-пароль"
              autoFocus
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="primary-button">
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}
