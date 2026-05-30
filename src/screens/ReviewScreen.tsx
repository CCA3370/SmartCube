import { useMemo, useState } from 'react';
import { useApp } from '../app/AppContext';
import { FaceGrid } from '../components/FaceGrid';
import { SolverProgress } from '../components/SolverProgress';
import {
  FACE_ORDER,
  FACE_COLOR_NAME,
  buildFaceletString,
  buildCubeStateFromLabels,
  validate,
  describeError,
  type FaceLetter,
  type FaceLabels,
} from '../lib/cube';

export function ReviewScreen() {
  const { state, dispatch, solver, retrySolverInit } = useApp();
  const [busy, setBusy] = useState(false);
  const [solveError, setSolveError] = useState<string | null>(null);

  const facelets = useMemo(() => {
    const haveAll = FACE_ORDER.every((f) => state.labels[f]);
    if (!haveAll) return null;
    try {
      const perFace = {} as Record<FaceLetter, FaceLetter[]>;
      for (const f of FACE_ORDER) perFace[f] = (state.labels[f] as FaceLabels).labels;
      return buildFaceletString(buildCubeStateFromLabels(perFace));
    } catch {
      return null;
    }
  }, [state.labels]);

  const liveValidation = useMemo(() => (facelets ? validate(facelets) : null), [facelets]);
  const suspect = new Set(liveValidation?.suspectFaces ?? []);

  const handleSolve = async () => {
    if (!facelets) return;
    const v = validate(facelets);
    if (!v.ok) {
      dispatch({ type: 'SET_VALIDATION', result: v });
      return;
    }
    setBusy(true);
    setSolveError(null);
    try {
      await solver.init();
      const solution = await solver.solve(facelets);
      dispatch({ type: 'SOLVE_OK', solution });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setSolveError(message);
      dispatch({
        type: 'SET_VALIDATION',
        result: {
          ok: false,
          errors: [{ kind: 'solver-rejected', message }],
          suspectFaces: [...FACE_ORDER],
        },
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'auto' }}>
      <div>
        <h2 className="title">Check the colors</h2>
        <p className="subtitle">
          Tap any sticker to correct it. Centers are locked — they define each face.
          Orange dots mark low-confidence reads.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 16,
        }}
      >
        {FACE_ORDER.map((f) => {
          const fl = state.labels[f];
          if (!fl) return null;
          return (
            <div key={f} className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 14 }}>
              <div className="row spread" style={{ width: '100%' }}>
                <strong style={{ fontSize: '0.85rem' }}>
                  {FACE_COLOR_NAME[f]} <span style={{ color: 'var(--text-dim)' }}>({f})</span>
                </strong>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => dispatch({ type: 'RESCAN_FACE', face: f })}
                >
                  Re-scan
                </button>
              </div>
              <FaceGrid
                labels={fl.labels}
                confidence={fl.confidence}
                editable
                suspect={suspect.has(f)}
                onEdit={(index, color) => dispatch({ type: 'EDIT_STICKER', face: f, index, color })}
                size={130}
              />
            </div>
          );
        })}
      </div>

      {state.validation && !state.validation.ok && (
        <div className="card" style={{ borderColor: 'var(--bad)' }}>
          <strong style={{ color: 'var(--bad)' }}>This doesn't look like a solvable cube yet:</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--text-dim)' }}>
            {state.validation.errors.map((e, i) => (
              <li key={i}>{describeError(e)}</li>
            ))}
          </ul>
        </div>
      )}

      {liveValidation && liveValidation.ok && !state.validation && (
        <p className="subtitle" style={{ color: 'var(--good)' }}>✓ Looks like a valid cube.</p>
      )}

      {busy && (
        <div>
          {!state.solverReady ? (
            <SolverProgress
              progress={state.solverProgress}
              error={state.solverError}
              onRetry={retrySolverInit}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  border: '3px solid var(--accent)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>Solving…</span>
            </div>
          )}
        </div>
      )}

      {solveError && !busy && (
        <div className="card" style={{ borderColor: 'var(--bad)', padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--bad)', fontSize: '0.9rem' }}>⚠️ Solve failed</span>
            <button className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={handleSolve}>
              Retry
            </button>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'var(--text-dim)' }}>{solveError}</p>
        </div>
      )}

      <div className="row spread" style={{ position: 'sticky', bottom: 0, paddingTop: 8 }}>
        <button className="btn btn-ghost" onClick={() => dispatch({ type: 'RESTART' })}>
          Start over
        </button>
        <button className="btn btn-primary" onClick={handleSolve} disabled={busy || !facelets}>
          {busy ? 'Solving…' : 'Solve it →'}
        </button>
      </div>
    </div>
  );
}
