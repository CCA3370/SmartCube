import { useEffect, useRef, useState } from 'react';
import type { Readiness } from '../lib/vision/readiness';

const HOLD_MS = 4000; // continuous ready time before auto-firing

/**
 * Fires `onCapture` once the frame has been continuously ready (sharp + exposed
 * + stable) for HOLD_MS. Re-arms when `armed` changes or when
 * `resetKey` changes (e.g. moving to the next face). Returns a 0..1 progress
 * for the readiness ring.
 */
export function useAutoCapture(
  readiness: Readiness,
  armed: boolean,
  onCapture: () => void,
  resetKey?: unknown,
): number {
  const readySinceRef = useRef<number | null>(null);
  const firedRef = useRef(false);
  const onCaptureRef = useRef(onCapture);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    onCaptureRef.current = onCapture;
  }, [onCapture]);

  useEffect(() => {
    readySinceRef.current = null;
    firedRef.current = false;
    setProgress(0);
  }, [armed, resetKey]);

  useEffect(() => {
    if (!armed || firedRef.current) return;
    const now = performance.now();
    if (readiness.ready) {
      readySinceRef.current ??= now;
      const elapsed = now - readySinceRef.current;
      setProgress(Math.min(1, elapsed / HOLD_MS));
      if (elapsed >= HOLD_MS) {
        firedRef.current = true;
        onCaptureRef.current();
      }
    } else {
      readySinceRef.current = null;
      setProgress(0);
    }
  }, [readiness, armed]);

  return progress;
}
