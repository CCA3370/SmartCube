import { useEffect, useRef, useState } from 'react';
import { DISPLAY_COLOR } from '../lib/color';
import { FACES, FACE_COLOR_NAME, type FaceLetter } from '../lib/cube';
import './FaceGrid.css';

interface FaceGridProps {
  labels: FaceLetter[];
  confidence?: number[];
  /** Highlight stickers whose confidence is below this margin. */
  lowConfidenceBelow?: number;
  editable?: boolean;
  onEdit?: (index: number, color: FaceLetter) => void;
  size?: number;
  fill?: boolean;
  suspect?: boolean;
}

export function FaceGrid({
  labels,
  confidence,
  lowConfidenceBelow = 6,
  editable = false,
  onEdit,
  size = 120,
  fill = false,
  suspect = false,
}: FaceGridProps) {
  // Index of the sticker whose color picker is open (null = none).
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  // Dismiss the picker on Escape or a pointer down outside the grid.
  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIndex(null);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) setOpenIndex(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [openIndex]);

  const choose = (index: number, color: FaceLetter) => {
    onEdit?.(index, color);
    setOpenIndex(null);
  };

  return (
    <div
      ref={gridRef}
      className={`face-grid${suspect ? ' suspect' : ''}`}
      style={{ width: fill ? '100%' : size, height: fill ? '100%' : size }}
    >
      {labels.map((label, i) => {
        const isCenter = i === 4;
        const low =
          !isCenter && confidence && confidence[i] !== undefined && confidence[i] < lowConfidenceBelow;
        const canEdit = editable && !isCenter && !!onEdit;
        const isOpen = openIndex === i;
        return (
          <div key={i} className="sticker-cell">
            <button
              className={`sticker${isCenter ? ' center' : ''}${low ? ' low' : ''}`}
              style={{ background: DISPLAY_COLOR[label], cursor: canEdit ? 'pointer' : 'default' }}
              onClick={() => canEdit && setOpenIndex(isOpen ? null : i)}
              title={canEdit ? 'Tap to change color' : FACE_COLOR_NAME[label]}
              aria-label={`Sticker ${i + 1}: ${FACE_COLOR_NAME[label]}${canEdit ? ' — tap to change' : ''}`}
              aria-haspopup={canEdit ? 'menu' : undefined}
              aria-expanded={canEdit ? isOpen : undefined}
            >
              <span className="sticker-letter" aria-hidden="true">
                {label}
              </span>
            </button>

            {isOpen && (
              <div className="color-picker" role="menu" aria-label={`Choose color for sticker ${i + 1}`}>
                {FACES.map((f) => (
                  <button
                    key={f}
                    role="menuitemradio"
                    aria-checked={f === label}
                    className={`color-swatch${f === label ? ' selected' : ''}`}
                    style={{ background: DISPLAY_COLOR[f] }}
                    onClick={() => choose(i, f)}
                    title={FACE_COLOR_NAME[f]}
                    aria-label={FACE_COLOR_NAME[f]}
                  >
                    <span className="sticker-letter" aria-hidden="true">
                      {f}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
