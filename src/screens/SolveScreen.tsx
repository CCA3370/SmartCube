import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../app/AppContext';
import { TwistyView } from '../components/TwistyView';
import { MoveList } from '../components/MoveList';
import { StepControls } from '../components/StepControls';
import type { Stepper, StepperState } from '../lib/twisty';

export function SolveScreen() {
  const { state, dispatch } = useApp();
  const stepperRef = useRef<Stepper | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const moves = state.solution?.moves ?? [];
  const total = moves.length;
  const raw = state.solution?.raw ?? '';

  const syncStepperState = useCallback((next: StepperState) => {
    setIndex(next.index);
    setPlaying(next.playing);
  }, []);

  const onReady = useCallback((stepper: Stepper) => {
    unsubscribeRef.current?.();
    stepperRef.current = stepper;
    unsubscribeRef.current = stepper.subscribe(syncStepperState);
  }, [syncStepperState]);

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, []);

  const setStep = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(total, next)));
    },
    [total],
  );

  const next = () => {
    const s = stepperRef.current;
    if (!s || index >= total) return;
    s.next();
    setStep(index + 1);
  };
  const prev = () => {
    const s = stepperRef.current;
    if (!s || index <= 0) return;
    s.prev();
    setStep(index - 1);
  };
  const playPause = () => {
    const s = stepperRef.current;
    if (!s) return;
    if (playing) {
      s.pause();
      setPlaying(false);
    } else {
      if (index >= total) {
        s.toStart();
        setStep(0);
      }
      s.play();
      setPlaying(true);
    }
  };
  const toStart = () => {
    stepperRef.current?.toStart();
    setStep(0);
    setPlaying(false);
  };
  const toEnd = () => {
    stepperRef.current?.toEnd();
    setStep(total);
    setPlaying(false);
  };
  const jumpTo = (i: number) => {
    stepperRef.current?.seek(i);
    setStep(i);
    setPlaying(false);
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div className="row spread">
        <div>
          <h2 className="title" style={{ fontSize: '1.15rem' }}>Solve — {total} moves</h2>
          <p className="subtitle" style={{ margin: 0, fontSize: '0.82rem' }}>
            Hold your cube with <strong>White up, Green facing you</strong>, then follow each move.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={() => dispatch({ type: 'RESTART' })}>
          New scan
        </button>
      </div>

      <TwistyView solutionRaw={raw} onReady={onReady} />

      <MoveList moves={moves} currentIndex={index} onJump={jumpTo} />

      <StepControls
        index={index}
        total={total}
        playing={playing}
        onPrev={prev}
        onNext={next}
        onPlayPause={playPause}
        onToStart={toStart}
        onToEnd={toEnd}
      />

      {index >= total && total > 0 && (
        <button className="btn btn-primary" onClick={() => dispatch({ type: 'FINISH' })}>
          I'm done — cube solved! 🎉
        </button>
      )}
    </div>
  );
}
