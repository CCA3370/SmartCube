import { useCallback, useEffect, useMemo } from 'react';
import { useApp } from '../app/AppContext';
import { useCamera } from '../hooks/useCamera';
import { useFrameAnalyzer } from '../hooks/useFrameAnalyzer';
import { useAutoCapture } from '../hooks/useAutoCapture';
import { CameraView } from '../components/CameraView';
import { ReadinessIndicator } from '../components/ReadinessIndicator';
import { ProgressDots } from '../components/ProgressDots';
import { HoldOrientationHint } from '../components/HoldOrientationHint';
import { FaceGrid } from '../components/FaceGrid';
import { CAPTURE_SEQUENCE, type FaceLetter } from '../lib/cube';
import { centeredFaceSquare, get2d } from '../lib/util/canvas';
import { recognizeFace } from '../app/recognition';

const OVERLAY_FRACTION = 0.7;

export function ScanScreen() {
  const { state, dispatch } = useApp();
  const camera = useCamera();
  const step = CAPTURE_SEQUENCE[state.scanIndex];

  // Start the camera once on mount.
  useEffect(() => {
    camera.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readiness = useFrameAnalyzer(camera.videoRef, camera.status === 'live');

  const doCapture = useCallback(() => {
    const video = camera.videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = camera.captureFrame();
    if (!canvas) return;
    const frame = get2d(canvas).getImageData(0, 0, canvas.width, canvas.height);
    const square = centeredFaceSquare(canvas.width, canvas.height, OVERLAY_FRACTION);
    const { capture, labels } = recognizeFace(frame, square, step);
    dispatch({ type: 'CAPTURE_FACE', face: step.face, capture, labels });
  }, [camera, dispatch, step]);

  // Auto-capture only after the camera is live and this face isn't captured yet.
  const armed = camera.status === 'live';
  const autoProgress = useAutoCapture(readiness, armed, doCapture);

  const capturedFaces = useMemo(() => Object.keys(state.labels) as FaceLetter[], [state.labels]);
  const lastCapture = state.labels[step.face];

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
        />
      )}

      <HoldOrientationHint step={step} />
      <ReadinessIndicator readiness={readiness} />

      <div className="row spread">
        <button
          className="btn btn-ghost"
          disabled={state.scanIndex === 0}
          onClick={() => dispatch({ type: 'PREV_FACE' })}
        >
          ← Back
        </button>

        {lastCapture && (
          <div className="row" style={{ gap: 8 }}>
            <FaceGrid labels={lastCapture.labels} size={48} />
            <span className="subtitle" style={{ fontSize: '0.78rem' }}>captured</span>
          </div>
        )}

        <button className="btn btn-primary" onClick={doCapture} disabled={camera.status !== 'live'}>
          📸 Capture
        </button>
      </div>

      {capturedFaces.length === 6 && (
        <button className="btn" onClick={() => dispatch({ type: 'GOTO_REVIEW' })}>
          Review all faces →
        </button>
      )}
    </div>
  );
}
