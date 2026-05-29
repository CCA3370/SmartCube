import { CAPTURE_SEQUENCE, type FaceLetter } from '../lib/cube';
import { DISPLAY_COLOR } from '../app/recognition';

interface Props {
  capturedFaces: FaceLetter[];
  currentFace: FaceLetter;
}

export function ProgressDots({ capturedFaces, currentFace }: Props) {
  return (
    <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
      {CAPTURE_SEQUENCE.map((step) => {
        const done = capturedFaces.includes(step.face);
        const current = step.face === currentFace;
        return (
          <div
            key={step.face}
            title={step.face}
            style={{
              width: current ? 16 : 12,
              height: current ? 16 : 12,
              borderRadius: '50%',
              background: done ? DISPLAY_COLOR[step.face] : 'transparent',
              border: `2px solid ${current ? 'var(--accent)' : done ? DISPLAY_COLOR[step.face] : 'var(--border)'}`,
              transition: 'all 0.15s',
            }}
          />
        );
      })}
    </div>
  );
}
