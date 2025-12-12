import { useState } from 'react';
import { RefreshCw, Copy, Check } from 'lucide-react';
import { generatePassword } from '../utils/password';
import { copyToClipboard } from '../utils/clipboard';
import './PasswordGenerator.css';

interface PasswordGeneratorProps {
  onGenerate: (password: string) => void;
}

export function PasswordGenerator({ onGenerate }: PasswordGeneratorProps) {
  const [length, setLength] = useState(16);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [generated, setGenerated] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGeneratePassword = () => {
    const password = generatePassword({
      length,
      includeUppercase,
      includeLowercase,
      includeNumbers,
      includeSymbols,
    });
    setGenerated(password);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (generated) {
      const success = await copyToClipboard(generated);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleUsePassword = () => {
    if (generated) {
      onGenerate(generated);
    }
  };

  return (
    <div className="password-generator">
      <div className="password-generator-display">
        <input
          type="text"
          value={generated}
          readOnly
          placeholder="Сгенерированный пароль появится здесь"
          className="generated-password-input"
        />
        <div className="password-generator-actions">
          <button
            type="button"
            className="icon-button"
            onClick={handleGeneratePassword}
            title="Сгенерировать новый пароль"
          >
            <RefreshCw size={18} />
          </button>
          {generated && (
            <button
              type="button"
              className="icon-button"
              onClick={handleCopy}
              title="Скопировать"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          )}
        </div>
      </div>

      <div className="password-generator-settings">
        <div className="setting-group">
          <label>
            <span>Длина: {length}</span>
            <input
              type="range"
              min="8"
              max="64"
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeUppercase}
              onChange={(e) => setIncludeUppercase(e.target.checked)}
            />
            <span>Заглавные буквы (A-Z)</span>
          </label>
        </div>

        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeLowercase}
              onChange={(e) => setIncludeLowercase(e.target.checked)}
            />
            <span>Строчные буквы (a-z)</span>
          </label>
        </div>

        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeNumbers}
              onChange={(e) => setIncludeNumbers(e.target.checked)}
            />
            <span>Цифры (0-9)</span>
          </label>
        </div>

        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeSymbols}
              onChange={(e) => setIncludeSymbols(e.target.checked)}
            />
            <span>Символы (!@#$%...)</span>
          </label>
        </div>
      </div>

      <button
        type="button"
        className="use-password-button"
        onClick={handleUsePassword}
        disabled={!generated}
      >
        Использовать пароль
      </button>
    </div>
  );
}
