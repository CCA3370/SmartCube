import { useEffect, useRef } from 'react';
import { createPlayer, setupFromSolution, makeStepper, type Stepper } from '../lib/twisty';

interface Props {
  solutionRaw: string;
  onReady: (stepper: Stepper) => void;
}

/**
 * Hosts the cubing.js <twisty-player>. The element is created imperatively once
 * (it's a web component, not a React-managed node) and the solution is loaded
 * via the invert trick so it opens on the scrambled state.
 */
export function TwistyView({ solutionRaw, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const player = createPlayer();
    container.appendChild(player);
    const { total } = setupFromSolution(player, solutionRaw);
    const stepper = makeStepper(player, total);
    onReadyRef.current(stepper);

    return () => {
      stepper.dispose();
      player.remove();
    };
  }, [solutionRaw]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        flex: 1,
        minHeight: 260,
        background: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}
    />
  );
}
