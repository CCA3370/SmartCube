import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../app/AppContext';
import { useCamera } from '../hooks/useCamera';
import { useFrameAnalyzer } from '../hooks/useFrameAnalyzer';
import { useAutoCapture } from '../hooks/useAutoCapture';
import { CameraView } from '../components/CameraView';
import { ScanTransitionOverlay } from '../components/ScanTransitionOverlay';
import { ReadinessIndicator } from '../components/ReadinessIndicator';
import { ProgressDots } from '../components/ProgressDots';
import { HoldOrientationHint } from '../components/HoldOrientationHint';
import { CAPTURE_SEQUENCE, type FaceLetter } from '../lib/cube';
import { DISPLAY_COLOR } from '../lib/color';
import { centeredFaceSquare, get2d } from '../lib/util/canvas';
import { recognizeFace, recognizeFaceFromGrid } from '../app/recognition';
import { scalePoint } from '../lib/vision/coords';
import { ANGLE_GATE } from '../lib/vision/detectFace';

const OVERLAY_FRACTION = 0.7;

export function ScanScreen() {
  const { state, dispatch } = useApp();
  const camera = useCamera();
  const step = CAPTURE_SEQUENCE[state.scanIndex];
  const [transition, setTransition] = useState<{ finished: FaceLetter; next: FaceLetter | null } | null>(null);

  // Start the camera once on mount.
  useEffect(() => {
    camera.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { readiness, detection, detectSize, gridStable } = useFrameAnalyzer(
    camera.videoRef,
    camera.status === 'live',
  );
  const capturedFaces = useMemo(() => Object.keys(state.labels) as FaceLetter[], [state.labels]);
  const lastCapture = state.labels[step.face];
  const allCaptured = capturedFaces.length === CAPTURE_SEQUENCE.length;

  const doCapture = useCallback(() => {
    const video = camera.videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = camera.captureFrame();
    if (!canvas) return;
    const frame = get2d(canvas).getImageData(0, 0, canvas.width, canvas.height);

    // Prefer the live-detected grid; fall back to the centered square when no face
    // is located (manual fallback). Either path de-rotates sampled stickers into net
    // order and builds the FaceCapture; the reducer re-derives all faces' labels.
    if (detection.found && detectSize) {
      const sx = canvas.width / detectSize.w;
      const sy = canvas.height / detectSize.h;
      const centers = detection.cells.map((c) => scalePoint(c, sx, sy));
      const cell = detection.cell * ((sx + sy) / 2);
      const { capture } = recognizeFaceFromGrid(frame, centers, cell, step);
      dispatch({ type: 'CAPTURE_FACE', face: step.face, capture });
    } else {
      const square = centeredFaceSquare(canvas.width, canvas.height, OVERLAY_FRACTION);
      const { capture } = recognizeFace(frame, square, step);
      dispatch({ type: 'CAPTURE_FACE', face: step.face, capture });
    }

    // Trigger the feedback transition sequence (4s).
    const nextIdx = CAPTURE_SEQUENCE.findIndex((s, i) => i > state.scanIndex && !state.labels[s.face]);
    const nextFace = nextIdx >= 0 ? CAPTURE_SEQUENCE[nextIdx].face : null;
    setTransition({ finished: step.face, next: nextFace });
  }, [camera, dispatch, step, detection, detectSize, state.scanIndex, state.labels]);

  const retake = useCallback(() => {
    dispatch({ type: 'RESCAN_FACE', face: step.face });
  }, [dispatch, step.face]);

  const clearTransition = useCallback(() => setTransition(null), []);

  // The cube is "located" only when found and roughly upright — a large in-plane
  // rotation would break the screen->net cell ordering, so we refuse to capture it.
  const located = detection.found && Math.abs(detection.angle) <= ANGLE_GATE;
  const tilted = detection.found && Math.abs(detection.angle) > ANGLE_GATE;
  const autoReady = readiness.ready && located && gridStable;

  // Re-arm on each uncaptured scan step. Captures advance immediately, so the
  // next render normally lands on a fresh face.
  const armed = camera.status === 'live' && !lastCapture;
  const autoProgress = useAutoCapture(autoReady, armed, doCapture, state.scanIndex);
  const canCapture = camera.status === 'live';

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div className="row spread">
        <div>
          <h2 className="title" style={{ fontSize: '1.15rem' }}>
            Face {state.scanIndex + 1} of 6
          </h2>
          <ProgressDots capturedFaces={capturedFaces} currentFace={step.face} />
        </div>
        <div className="row">
          {camera.capabilities.torch && (
            <button className="btn btn-ghost" onClick={() => camera.setTorch(!camera.torchOn)}>
              {camera.torchOn ? '🔦 On' : '🔦 Off'}
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => camera.switchFacing()} title="Switch camera">
            🔄
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {camera.status === 'denied' || camera.status === 'error' ? (
          <div className="card center-col" style={{ flex: 1 }}>
            <p className="subtitle">{camera.error}</p>
            <button className="btn btn-primary" onClick={() => camera.start()}>
              Retry camera
            </button>
          </div>
        ) : (
          <CameraView
            videoRef={camera.videoRef}
            readiness={readiness}
            autoProgress={autoProgress}
            overlayFraction={OVERLAY_FRACTION}
            centerHintColor={DISPLAY_COLOR[step.toCamera]}
            centerHintKey={state.scanIndex}
            capturedFace={undefined}
            detection={detection}
            detectSize={detectSize}
            locked={autoReady}
          />
        )}
        {transition && (
          <ScanTransitionOverlay
            finished={transition.finished}
            next={transition.next}
            onDone={clearTransition}
          />
        )}
      </div>

      <HoldOrientationHint step={step} />
      {!lastCapture ? (
        <div
          className="row"
          style={{ gap: 6, justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}
        >
          {!detection.found ? (
            <p className="subtitle" style={{ margin: 0, textAlign: 'center', fontSize: '0.82rem' }}>
              🔍 Searching for a cube face — hold one flat to the camera.
            </p>
          ) : tilted ? (
            <p
              className="subtitle"
              style={{ margin: 0, textAlign: 'center', fontSize: '0.82rem', color: 'var(--warn)' }}
            >
              ↻ Straighten the cube to capture.
            </p>
          ) : null}
          <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <ReadinessIndicator readiness={readiness} />
          </div>
        </div>
      ) : (
        <p className="subtitle" style={{ margin: 0, textAlign: 'center', fontSize: '0.82rem' }}>
          This face is already captured. Continue, or retake it.
        </p>
      )}

      <div className="row spread">
        <button
          className="btn btn-ghost"
          disabled={state.scanIndex === 0}
          onClick={() => dispatch({ type: 'PREV_FACE' })}
        >
          ← Back
        </button>

        <div className="row" style={{ gap: 8 }}>
          {lastCapture && (
            <button className="btn" onClick={retake}>
              Retake
            </button>
          )}
          {lastCapture ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                if (allCaptured) dispatch({ type: 'GOTO_REVIEW' });
                else dispatch({ type: 'NEXT_FACE' });
              }}
            >
              {allCaptured ? 'Review all faces →' : 'Next face →'}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={doCapture} disabled={!canCapture}>
              📸 Capture
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
