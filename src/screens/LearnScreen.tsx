import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../app/AppContext';
import { MoveList } from '../components/MoveList';
import { StepControls } from '../components/StepControls';
import { TwistyView } from '../components/TwistyView';
import type { Stepper, StepperState } from '../lib/twisty';
import type { LearningStep } from '../lib/learning/types';
import { loadLearningProgress, updateLearningProgress } from '../lib/learning/progress';

export function LearnScreen() {
  const { state, dispatch } = useApp();
  const plan = state.learningPlan;
  const stepperRef = useRef<Stepper | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [moveIndex, setMoveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(() => loadLearningProgress());

  useEffect(() => {
    if (!plan) return;
    setProgress(updateLearningProgress({
      lastPlan: { method: plan.method, moveCount: plan.physicalMoves.length, updatedAt: Date.now() },
    }));
  }, [plan]);

  const syncStepperState = useCallback((next: StepperState) => {
    setMoveIndex(next.index);
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

  useEffect(() => {
    setRevealed(false);
  }, [stageIndex, stepIndex]);

  const currentStage = plan?.stages[stageIndex] ?? null;
  const currentStep = currentStage?.steps[stepIndex] ?? null;
  const moves = plan?.physicalMoves ?? [];
  const solutionRaw = moves.join(' ');
  const totalMoves = moves.length;

  const totalSteps = useMemo(() => plan?.stages.reduce((sum, stage) => sum + stage.steps.length, 0) ?? 0, [plan]);
  const completedSteps = useMemo(() => {
    if (!plan) return 0;
    let sum = 0;
    for (let i = 0; i < stageIndex; i++) sum += plan.stages[i].steps.length;
    return sum + stepIndex;
  }, [plan, stageIndex, stepIndex]);

  if (!plan || !currentStage || !currentStep) {
    return (
      <div className="center-col fade-in">
        <h2 className="title">No learning plan</h2>
        <p className="subtitle">Return to review and generate a beginner method plan first.</p>
        <button className="btn btn-primary" onClick={() => dispatch({ type: 'RESTART' })}>
          Start over
        </button>
      </div>
    );
  }

  const seekTo = (index: number) => {
    stepperRef.current?.seek(index);
    setMoveIndex(Math.max(0, Math.min(totalMoves, index)));
    setPlaying(false);
  };

  const advance = () => {
    if (currentStep.kind === 'checkpoint') {
      setProgress(updateLearningProgress({ completedStage: currentStage.id }));
    }
    if ('moveRange' in currentStep && currentStep.moveRange) {
      seekTo(currentStep.moveRange.end);
    }
    const nextStepIndex = stepIndex + 1;
    if (nextStepIndex < currentStage.steps.length) {
      setStepIndex(nextStepIndex);
      return;
    }
    const nextStageIndex = stageIndex + 1;
    if (nextStageIndex < plan.stages.length) {
      setStageIndex(nextStageIndex);
      setStepIndex(0);
      return;
    }
    setDone(true);
    seekTo(totalMoves);
  };

  const markFormulaKnown = (step: LearningStep) => {
    if (step.kind !== 'formula') return;
    setProgress(updateLearningProgress({ masteredFormulaId: step.formulaId }));
  };

  const prevMove = () => seekTo(Math.max(0, moveIndex - 1));
  const nextMove = () => seekTo(Math.min(totalMoves, moveIndex + 1));
  const playPause = () => {
    const stepper = stepperRef.current;
    if (!stepper) return;
    if (playing) {
      stepper.pause();
      setPlaying(false);
    } else {
      stepper.play();
      setPlaying(true);
    }
  };

  if (done) {
    return (
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 className="title">Beginner method complete</h2>
          <p className="subtitle">
            You completed {plan.stages.length} stages and marked {progress.masteredFormulaIds.length} formulas as known.
          </p>
          <p className="subtitle">
            你完成了 {plan.stages.length} 个阶段，并标记了 {progress.masteredFormulaIds.length} 个已掌握公式。
          </p>
        </div>
        <TwistyView solutionRaw={solutionRaw} onReady={onReady} />
        <button className="btn btn-primary" onClick={() => dispatch({ type: 'FINISH' })}>
          Finish learning
        </button>
      </div>
    );
  }

  const hasHiddenAnswer = (currentStep.kind === 'turn' || currentStep.kind === 'formula') && !revealed;
  const moveText = (currentStep.kind === 'turn' || currentStep.kind === 'formula') ? currentStep.moves.join(' ') : '';
  const currentMoveStart = currentStep.moveRange?.start ?? moveIndex;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div className="row spread">
        <div>
          <h2 className="title" style={{ fontSize: '1.15rem' }}>Learn beginner method</h2>
          <p className="subtitle" style={{ margin: 0, fontSize: '0.82rem' }}>
            Stage {stageIndex + 1} / {plan.stages.length} · Step {completedSteps + 1} / {totalSteps}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={() => dispatch({ type: 'RESTART' })}>
          New scan
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {plan.stages.map((stage, i) => (
          <button
            key={stage.id}
            className={i === stageIndex ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ padding: '6px 10px', fontSize: '0.78rem' }}
            onClick={() => {
              setStageIndex(i);
              setStepIndex(0);
            }}
          >
            {i + 1}. {stage.titleEn}
          </button>
        ))}
      </div>

      <TwistyView solutionRaw={solutionRaw} onReady={onReady} />

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ color: 'var(--accent)', fontWeight: 700 }}>{currentStage.titleEn}</div>
          <div style={{ color: 'var(--text-dim)', fontWeight: 700 }}>{currentStage.titleZh}</div>
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>{currentStep.titleEn}</h3>
          <p className="subtitle" style={{ margin: '4px 0 0' }}>{currentStep.titleZh}</p>
        </div>
        <p style={{ margin: 0, lineHeight: 1.45 }}>{currentStep.bodyEn}</p>
        <p className="subtitle" style={{ margin: 0 }}>{currentStep.bodyZh}</p>

        {(currentStep.kind === 'turn' || currentStep.kind === 'formula') && (
          <div
            style={{
              padding: 12,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-elev-2)',
              border: '1px solid var(--border)',
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {revealed ? moveText : 'Think first'}
          </div>
        )}

        <div className="row" style={{ flexWrap: 'wrap' }}>
          {hasHiddenAnswer ? (
            <button className="btn btn-primary" onClick={() => setRevealed(true)}>
              Show answer
            </button>
          ) : currentStep.kind === 'checkpoint' ? (
            <button className="btn btn-primary" onClick={advance}>
              Confirm checkpoint
            </button>
          ) : currentStep.kind === 'turn' || currentStep.kind === 'formula' ? (
            <button className="btn btn-primary" onClick={advance}>
              I did it
            </button>
          ) : (
            <button className="btn btn-primary" onClick={advance}>
              Continue
            </button>
          )}

          {currentStep.kind === 'formula' && revealed && (
            <button
              className="btn"
              onClick={() => markFormulaKnown(currentStep)}
              disabled={progress.masteredFormulaIds.includes(currentStep.formulaId)}
            >
              {progress.masteredFormulaIds.includes(currentStep.formulaId) ? 'Formula known' : 'I know this formula'}
            </button>
          )}
        </div>
      </section>

      <MoveList
        moves={moves}
        currentIndex={moveIndex}
        onJump={seekTo}
        maskFromIndex={hasHiddenAnswer ? currentMoveStart : undefined}
        revealCurrent={!hasHiddenAnswer}
      />

      <StepControls
        index={moveIndex}
        total={totalMoves}
        playing={playing}
        onPrev={prevMove}
        onNext={nextMove}
        onPlayPause={playPause}
        onToStart={() => seekTo(0)}
        onToEnd={() => seekTo(totalMoves)}
      />
    </div>
  );
}
