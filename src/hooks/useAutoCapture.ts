import { useEffect, useRef, useState } from 'react';

const HOLD_MS = 4000; // continuous ready time before auto-firing
const TICK_MS = 100; // how often to advance the hold timer while ready

/**
 * Fires `onCapture` once `ready` has been continuously true for HOLD_MS. The
 * caller decides what "ready" means (frame readiness AND a located, steady cube
 * face). While ready+armed, a self-contained timer advances the hold independent
 * of the parent's render cadence — `ready` is a stable boolean, so we can't rely
 * on prop churn to tick it. Re-arms when `armed` or `resetKey` changes (e.g.
 * moving to the next face). Returns a 0..1 progress for the hold indicator.
 */
export function useAutoCapture(
  ready: boolean,
  armed: boolean,
  onCapture: () => void,
  resetKey?: unknown,
): number {
  const onCaptureRef = useRef(onCapture);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    onCaptureRef.current = onCapture;
  }, [onCapture]);

  useEffect(() => {
    if (!armed || !ready) {
      setProgress(0);
      return undefined;
    }
    const start = Date.now();
    setProgress(0);
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(1, elapsed / HOLD_MS));
      if (elapsed >= HOLD_MS) {
        clearInterval(id);
        onCaptureRef.current();
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [ready, armed, resetKey]);

  return progress;
}
