import { useMemo, useState } from 'react';
import { useApp } from '../app/AppContext';
import { FaceGrid } from '../components/FaceGrid';
import { SolverProgress } from '../components/SolverProgress';
import { buildBeginnerPlan } from '../lib/learning/beginner';
import {
  FACE_ORDER,
  FACE_COLOR_NAME,
  buildFaceletString,
  buildCubeStateFromLabels,
  encodeFeatureCode,
  validate,
  describeError,
  type FaceLetter,
  type FaceLabels,
} from '../lib/cube';

export function ReviewScreen() {
  const { state, dispatch, solver, retrySolverInit } = useApp();
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<'learn' | 'solve' | null>(null);
  const [solveError, setSolveError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

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
  const featureCode = useMemo(
    () => (facelets && liveValidation?.ok ? encodeFeatureCode(facelets) : null),
    [facelets, liveValidation],
  );
  const suspect = new Set(liveValidation?.suspectFaces ?? []);

  const copyFeatureCode = async () => {
    if (!featureCode) return;
    try {
      await writeClipboard(featureCode);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };

  const solveCurrentFacelets = async (mode: 'learn' | 'solve') => {
    if (!facelets) return;
    const v = validate(facelets);
    if (!v.ok) {
      dispatch({ type: 'SET_VALIDATION', result: v });
      return;
    }
    setBusy(true);
    setBusyAction(mode);
    setSolveError(null);
    try {
      await solver.init();
      const solution = await solver.solve(facelets);
      if (mode === 'learn') {
        dispatch({ type: 'LEARN_OK', plan: buildBeginnerPlan(facelets, solution.moves) });
      } else {
        dispatch({ type: 'SOLVE_OK', solution, sourceFacelets: facelets });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setSolveError(message);
      if (mode === 'learn') {
        dispatch({ type: 'LEARN_ERROR', message });
      } else {
        dispatch({
          type: 'SET_VALIDATION',
          result: {
            ok: false,
            errors: [{ kind: 'solver-rejected', message }],
            suspectFaces: [...FACE_ORDER],
          },
        });
      }
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  };

  const handleSolve = () => void solveCurrentFacelets('solve');
  const handleLearn = () => void solveCurrentFacelets('learn');

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

      {featureCode && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
          <div className="row spread">
            <strong style={{ fontSize: '0.9rem' }}>Feature code</strong>
            <button
              className="btn btn-ghost"
              style={{ padding: '6px 10px', fontSize: '0.8rem' }}
              onClick={copyFeatureCode}
              aria-label="Copy feature code"
            >
              {copyStatus === 'copied' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <code
            style={{
              display: 'block',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              padding: '10px 12px',
              wordBreak: 'break-all',
              lineHeight: 1.5,
              fontSize: '0.84rem',
            }}
          >
            {featureCode}
          </code>
          {copyStatus === 'failed' && (
            <p role="alert" style={{ margin: 0, color: 'var(--bad)', fontSize: '0.8rem' }}>
              Copy failed.
            </p>
          )}
        </div>
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

      {state.learningError && !busy && (
        <div className="card" style={{ borderColor: 'var(--bad)', padding: 14 }}>
          <strong style={{ color: 'var(--bad)' }}>Beginner learning plan failed</strong>
          <p className="subtitle" style={{ margin: '6px 0 0' }}>{state.learningError}</p>
          <button className="btn" style={{ marginTop: 10 }} onClick={handleSolve}>
            Use optimal solve instead
          </button>
        </div>
      )}

      <div className="row spread" style={{ position: 'sticky', bottom: 0, paddingTop: 8 }}>
        <button className="btn btn-ghost" onClick={() => dispatch({ type: 'RESTART' })}>
          Start over
        </button>
        <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn" onClick={handleLearn} disabled={busy || !facelets}>
            {busy && busyAction === 'learn' ? 'Preparing…' : 'Learn beginner method'}
          </button>
          <button className="btn btn-primary" onClick={handleSolve} disabled={busy || !facelets}>
            {busy && busyAction === 'solve' ? 'Solving…' : 'Optimal solve →'}
          </button>
        </div>
      </div>
    </div>
  );
}

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) throw new Error('Copy command failed');
}
