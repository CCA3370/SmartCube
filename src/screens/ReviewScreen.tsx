import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../app/AppContext';
import { FaceGrid } from '../components/FaceGrid';
import { recognizeCube } from '../app/recognition';
import {
  FACE_ORDER,
  FACE_COLOR_NAME,
  buildFaceletString,
  buildCubeStateFromLabels,
  validate,
  describeError,
  type FaceLetter,
  type FaceCapture,
  type FaceLabels,
} from '../lib/cube';

function sameArray<T>(a: readonly T[] | undefined, b: readonly T[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((value, i) => value === b[i]);
}

function sameFaceLabels(a: FaceLabels | undefined, b: FaceLabels): boolean {
  return Boolean(a && a.face === b.face && sameArray(a.labels, b.labels) && sameArray(a.confidence, b.confidence));
}

export function ReviewScreen() {
  const { state, dispatch, solver } = useApp();
  const [busy, setBusy] = useState(false);

  // On entry, run the definitive whole-cube classification (relative to the 6
  // live centers) once, if labels look provisional. We only do this if we have
  // all six captures.
  useEffect(() => {
    const haveAll = FACE_ORDER.every((f) => state.captures[f]);
    if (!haveAll) return;
    const captures = state.captures as Record<FaceLetter, FaceCapture>;
    const recognized = recognizeCube(captures);
    if (FACE_ORDER.some((f) => !sameFaceLabels(state.labels[f], recognized[f]))) {
      dispatch({ type: 'SET_RECOGNIZED_LABELS', labels: recognized });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    dispatch({ type: 'SOLVE_START' });
    try {
      await solver.init();
      const solution = await solver.solve(facelets);
      dispatch({ type: 'SOLVE_OK', solution });
    } catch (e) {
      dispatch({
        type: 'SET_VALIDATION',
        result: {
          ok: false,
          errors: [{ kind: 'solver-rejected', message: e instanceof Error ? e.message : String(e) }],
          suspectFaces: [...FACE_ORDER],
        },
      });
      dispatch({ type: 'SOLVE_ERROR', message: e instanceof Error ? e.message : String(e) });
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
