import { useEffect, useRef, useState } from 'react';
import './AreaSelector.css';

interface AreaSelectorProps {
  onSelect: (bounds: { x: number; y: number; width: number; height: number }) => void;
  onCancel: () => void;
}

export function AreaSelector({ onSelect, onCancel }: AreaSelectorProps) {
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const getWindowBounds = () => {
      return {
        x: window.screenX || 0,
        y: window.screenY || 0,
      };
    };

    let startScreenPos: { x: number; y: number } | null = null;

    const handleMouseDown = (e: MouseEvent) => {
      const windowBounds = getWindowBounds();
      const relX = e.screenX - windowBounds.x;
      const relY = e.screenY - windowBounds.y;
      startScreenPos = { x: e.screenX, y: e.screenY };
      setStartPos({ x: relX, y: relY });
      setCurrentPos({ x: relX, y: relY });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (startPos && startScreenPos) {
        const windowBounds = getWindowBounds();
        const relX = e.screenX - windowBounds.x;
        const relY = e.screenY - windowBounds.y;
        setCurrentPos({ x: relX, y: relY });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (startScreenPos) {
        const screenX = e.screenX;
        const screenY = e.screenY;
        
        // Используем абсолютные координаты экрана для захвата
        const x = Math.min(startScreenPos.x, screenX);
        const y = Math.min(startScreenPos.y, screenY);
        const width = Math.abs(screenX - startScreenPos.x);
        const height = Math.abs(screenY - startScreenPos.y);

        if (width > 10 && height > 10) {
          onSelect({ x, y, width, height });
        } else {
          onCancel();
        }
      }
      startScreenPos = null;
      setStartPos(null);
      setCurrentPos(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [startPos, currentPos, onSelect, onCancel]);

  const getSelectionBounds = () => {
    if (!startPos || !currentPos) return null;

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);

    return { x, y, width, height };
  };

  const bounds = getSelectionBounds();

  return (
    <div ref={overlayRef} className="area-selector-overlay">
      {bounds && (
        <div
          className="area-selector-selection"
          style={{
            left: `${bounds.x}px`,
            top: `${bounds.y}px`,
            width: `${bounds.width}px`,
            height: `${bounds.height}px`,
          }}
        >
          <div className="area-selector-info">
            {bounds.width} × {bounds.height}
          </div>
        </div>
      )}
      <div className="area-selector-instructions">
        <p>Выделите область экрана</p>
        <p className="area-selector-hint">Нажмите ESC для отмены</p>
      </div>
    </div>
  );
}

