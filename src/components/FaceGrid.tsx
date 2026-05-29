import { DISPLAY_COLOR } from '../app/recognition';
import type { FaceLetter } from '../lib/cube';
import './FaceGrid.css';

const CYCLE: FaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B'];

interface FaceGridProps {
  labels: FaceLetter[];
  confidence?: number[];
  /** Highlight stickers whose confidence is below this margin. */
  lowConfidenceBelow?: number;
  editable?: boolean;
  onEdit?: (index: number, color: FaceLetter) => void;
  size?: number;
  suspect?: boolean;
}

export function FaceGrid({
  labels,
  confidence,
  lowConfidenceBelow = 6,
  editable = false,
  onEdit,
  size = 120,
  suspect = false,
}: FaceGridProps) {
  const cell = size / 3;
  return (
    <div
      className={`face-grid${suspect ? ' suspect' : ''}`}
      style={{ width: size, height: size }}
    >
      {labels.map((label, i) => {
        const isCenter = i === 4;
        const low =
          !isCenter && confidence && confidence[i] !== undefined && confidence[i] < lowConfidenceBelow;
        const handleClick = () => {
          if (!editable || isCenter || !onEdit) return;
          const next = CYCLE[(CYCLE.indexOf(label) + 1) % CYCLE.length];
          onEdit(i, next);
        };
        return (
          <button
            key={i}
            className={`sticker${isCenter ? ' center' : ''}${low ? ' low' : ''}`}
            style={{
              width: cell,
              height: cell,
              background: DISPLAY_COLOR[label],
              cursor: editable && !isCenter ? 'pointer' : 'default',
            }}
            onClick={handleClick}
            title={editable && !isCenter ? 'Click to change color' : label}
            aria-label={`sticker ${i + 1}: ${label}`}
          />
        );
      })}
    </div>
  );
}
