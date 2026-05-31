import { useEffect, useState } from 'react';
import { FACE_COLOR_NAME, type FaceLetter } from '../lib/cube';
import './ScanTransitionOverlay.css';

interface Props {
  finished: FaceLetter;
  next: FaceLetter | null;
  onDone: () => void;
}

export function ScanTransitionOverlay({ finished, next, onDone }: Props) {
  const [phase, setPhase] = useState<1 | 2>(1);

  useEffect(() => {
    const timer1 = setTimeout(() => setPhase(2), 2000);
    const timer2 = setTimeout(onDone, 4000);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onDone]);

  return (
    <div className="scan-transition-overlay">
      {phase === 1 ? (
        <div className="scan-msg fade-in-out">
          <p className="scan-status">Scan Complete</p>
          <h2 className="scan-face-name">{FACE_COLOR_NAME[finished]} Face</h2>
        </div>
      ) : (
        <div className="scan-msg fade-in-out">
          {next ? (
            <>
              <p className="scan-status">Next</p>
              <h2 className="scan-face-name">{FACE_COLOR_NAME[next]} Face</h2>
            </>
          ) : (
            <h2 className="scan-face-name">All Faces Scanned!</h2>
          )}
        </div>
      )}
    </div>
  );
}
