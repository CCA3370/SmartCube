import { useEffect, useRef, useState } from 'react';
import type { Readiness } from '../lib/vision/readiness';

const HOLD_FRAMES = 5; // consecutive ready frames before auto-firing

/**
 * Fires `onCapture` once the frame has been continuously ready (sharp + exposed
 * + stable) for HOLD_FRAMES updates. Re-arms when `armed` toggles true again
 * (e.g. moving to the next face). Returns a 0..1 progress for the readiness ring.
 */
export function useAutoCapture(
  readiness: Readiness,
  armed: boolean,
  onCapture: () => void,
): number {
  const countRef = useRef(0);
  const firedRef = useRef(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!armed) {
      countRef.current = 0;
      firedRef.current = false;
      setProgress(0);
    }
  }, [armed]);

  useEffect(() => {
    if (!armed || firedRef.current) return;
    if (readiness.ready) {
      countRef.current += 1;
      setProgress(Math.min(1, countRef.current / HOLD_FRAMES));
      if (countRef.current >= HOLD_FRAMES) {
        firedRef.current = true;
        onCapture();
      }
    } else {
      countRef.current = 0;
      setProgress(0);
    }
  }, [readiness, armed, onCapture]);

  return progress;
}
