import { useState } from 'react';
import { RefreshCw, Copy, Check } from 'lucide-react';
import { generatePassword } from '../utils/password';
import {
  generateEnglishMemorablePassphrase,
  generateXkcdPassphrase,
  type XkcdPassphraseStyle,
} from '../utils/password-phrase';
import { copyToClipboard } from '../utils/clipboard';
import './PasswordGenerator.css';

export type GeneratorMode = 'random' | 'xkcd' | 'ea_en';

interface PasswordGeneratorProps {
  onGenerate: (password: string) => void;
}

export function PasswordGenerator({ onGenerate }: PasswordGeneratorProps) {
  const [mode, setMode] = useState<GeneratorMode>('random');
  const [length, setLength] = useState(16);
  const [wordCount, setWordCount] = useState(4);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [generated, setGenerated] = useState('');
  const [copied, setCopied] = useState(false);
  const [xkcdStyle, setXkcdStyle] = useState<XkcdPassphraseStyle>('words_only');

  const handleGeneratePassword = () => {
    let password = '';
    if (mode === 'random') {
      password = generatePassword({
        length,
        includeUppercase,
        includeLowercase,
        includeNumbers,
        includeSymbols,
      });
    } else if (mode === 'xkcd') {
      password = generateXkcdPassphrase(wordCount, xkcdStyle);
    } else {
      password = generateEnglishMemorablePassphrase(wordCount);
    }
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
      <div className="password-generator-modes" role="tablist" aria-label="Тип генератора">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'random'}
          className={`password-mode-btn ${mode === 'random' ? 'active' : ''}`}
          onClick={() => setMode('random')}
        >
          Случайный
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'xkcd'}
          className={`password-mode-btn ${mode === 'xkcd' ? 'active' : ''}`}
          onClick={() => setMode('xkcd')}
        >
          Фраза (XKCD)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'ea_en'}
          className={`password-mode-btn ${mode === 'ea_en' ? 'active' : ''}`}
          onClick={() => setMode('ea_en')}
        >
          EA (EN)
        </button>
      </div>

      <p className="password-generator-hint">
        {mode === 'random' && 'Символы из выбранных наборов.'}
        {mode === 'xkcd' &&
          (xkcdStyle === 'words_only'
            ? 'Слова через дефис, каждое с заглавной буквы (Correct-Horse-Battery-Staple).'
            : 'То же, плюс дефис и 2–4 случайные цифры в конце (удобнее для сайтов, где нужны цифры).')}
        {mode === 'ea_en' &&
          'Английские слова в нижнем регистре, между ними случайные символы, в конце цифры (стиль memorable phrase).'}
      </p>

      <div className="password-generator-display">
        <input
          type="text"
          value={generated}
          readOnly
          placeholder="Нажмите «обновить», чтобы сгенерировать"
          className="generated-password-input"
        />
        <div className="password-generator-actions">
          <button
            type="button"
            className="icon-button"
            onClick={handleGeneratePassword}
            title="Сгенерировать"
          >
            <RefreshCw size={18} />
          </button>
          {generated && (
            <button type="button" className="icon-button" onClick={handleCopy} title="Скопировать">
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          )}
        </div>
      </div>

      <div className="password-generator-settings">
        {mode === 'random' && (
          <>
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
                <span>Заглавные (A–Z)</span>
              </label>
            </div>

            <div className="setting-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={includeLowercase}
                  onChange={(e) => setIncludeLowercase(e.target.checked)}
                />
                <span>Строчные (a–z)</span>
              </label>
            </div>

            <div className="setting-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={includeNumbers}
                  onChange={(e) => setIncludeNumbers(e.target.checked)}
                />
                <span>Цифры (0–9)</span>
              </label>
            </div>

            <div className="setting-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={includeSymbols}
                  onChange={(e) => setIncludeSymbols(e.target.checked)}
                />
                <span>Символы (!@#$%…)</span>
              </label>
            </div>
          </>
        )}

        {(mode === 'xkcd' || mode === 'ea_en') && (
          <>
            {mode === 'xkcd' && (
              <div className="setting-group xkcd-style-row">
                <span className="xkcd-style-label">Вариант XKCD:</span>
                <div className="xkcd-style-options">
                  <label className="checkbox-label">
                    <input
                      type="radio"
                      name="xkcd-style"
                      checked={xkcdStyle === 'words_only'}
                      onChange={() => setXkcdStyle('words_only')}
                    />
                    <span>Только слова</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="radio"
                      name="xkcd-style"
                      checked={xkcdStyle === 'words_with_digits'}
                      onChange={() => setXkcdStyle('words_with_digits')}
                    />
                    <span>Слова + цифры</span>
                  </label>
                </div>
              </div>
            )}
            <div className="setting-group">
              <label>
                <span>Число слов: {wordCount}</span>
                <input
                  type="range"
                  min="3"
                  max={mode === 'xkcd' ? '8' : '10'}
                  value={wordCount}
                  onChange={(e) => setWordCount(Number(e.target.value))}
                />
              </label>
            </div>
          </>
        )}
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
