import { useEffect, useState, type FormEvent } from 'react';
import { useApp } from '../app/AppContext';
import { SolverProgress } from '../components/SolverProgress';
import { decodeFeatureCode, describeError, validate } from '../lib/cube';

export function WelcomeScreen() {
  const { dispatch, state, solver, retrySolverInit } = useApp();
  const [featureCode, setFeatureCode] = useState('');
  const [featureBusy, setFeatureBusy] = useState(false);
  const [featureError, setFeatureError] = useState<string | null>(null);
  const [showSolverStatus, setShowSolverStatus] = useState(true);

  const solverReady = state.solverReady && !state.solverError;
  const fadeSolverStatus = solverReady;

  useEffect(() => {
    if (!fadeSolverStatus) {
      setShowSolverStatus(true);
      return;
    }

    const timeout = window.setTimeout(() => setShowSolverStatus(false), 450);
    return () => window.clearTimeout(timeout);
  }, [fadeSolverStatus]);

  const handleFeatureSolve = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const rawCode = featureCode.trim();
    if (!rawCode) return;

    setFeatureError(null);
    let facelets: string;
    try {
      facelets = decodeFeatureCode(rawCode);
      const validation = validate(facelets);
      if (!validation.ok) {
        setFeatureError(validation.errors.map(describeError).join(' '));
        return;
      }
    } catch (e) {
      setFeatureError(e instanceof Error ? e.message : String(e));
      return;
    }

    setFeatureBusy(true);
    try {
      await solver.init();
      const solution = await solver.solve(facelets);
      dispatch({ type: 'SOLVE_OK', solution });
    } catch (e) {
      setFeatureError(e instanceof Error ? e.message : String(e));
    } finally {
      setFeatureBusy(false);
    }
  };

  return (
    <div className="center-col fade-in">
      <div style={{ fontSize: '3.5rem' }}>🧩</div>
      <div>
        <h1 className="title">SmartCube</h1>
        <p className="subtitle" style={{ maxWidth: 420 }}>
          Scan your scrambled 3×3 cube with the camera, then follow the 3D animation
          step by step to solve it in the fewest moves.
        </p>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: 440, textAlign: 'left' }}>
        <strong>How it works</strong>
        <ol style={{ margin: '10px 0 0', paddingLeft: 20, color: 'var(--text-dim)', lineHeight: 1.7 }}>
          <li>Keep the cube scrambled. Hold each face up to the camera — we use the fixed center piece to know which face it is, and capture when it's sharp and steady.</li>
          <li>Check the recognized colors and fix any that are off.</li>
          <li>Get the optimal solution and follow the animated moves.</li>
        </ol>
      </div>

      <button
        className="btn btn-primary"
        onClick={() => dispatch({ type: 'START' })}
        disabled={!solverReady}
      >
        Start camera & scan
      </button>

      <form
        className="card"
        onSubmit={handleFeatureSolve}
        style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}
      >
        <label htmlFor="feature-code-input" style={{ fontWeight: 700 }}>
          Cube feature code
        </label>
        <div className="row" style={{ alignItems: 'stretch', flexWrap: 'wrap' }}>
          <input
            id="feature-code-input"
            value={featureCode}
            onChange={(event) => setFeatureCode(event.currentTarget.value)}
            placeholder="SC1-..."
            spellCheck={false}
            style={{
              minWidth: 0,
              flex: '1 1 190px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg)',
              color: 'var(--text)',
              padding: '10px 12px',
              font: 'inherit',
            }}
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={!solverReady || featureBusy || !featureCode.trim()}
            style={{ flex: '1 0 150px' }}
          >
            {featureBusy ? 'Solving…' : 'Solve from code'}
          </button>
        </div>
        {featureError && (
          <p role="alert" style={{ margin: 0, color: 'var(--bad)', fontSize: '0.82rem', lineHeight: 1.4 }}>
            {featureError}
          </p>
        )}
      </form>

      {(state.solverProgress || state.solverError) && showSolverStatus ? (
        <div
          style={{
            width: '100%',
            maxWidth: 440,
            opacity: fadeSolverStatus ? 0 : 1,
            transform: fadeSolverStatus ? 'translateY(-4px)' : 'translateY(0)',
            transition: 'opacity 0.45s ease, transform 0.45s ease',
          }}
        >
          <SolverProgress
            progress={state.solverProgress}
            error={state.solverError}
            onRetry={retrySolverInit}
          />
        </div>
      ) : !state.solverReady ? (
        <p className="subtitle" style={{ fontSize: '0.8rem' }}>
          Preparing the solver… Camera access is required.
        </p>
      ) : null}
    </div>
  );
}
