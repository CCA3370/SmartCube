import { useCallback, useEffect, useMemo } from 'react';
import { useApp } from '../app/AppContext';
import { useCamera } from '../hooks/useCamera';
import { useFrameAnalyzer } from '../hooks/useFrameAnalyzer';
import { useAutoCapture } from '../hooks/useAutoCapture';
import { useCenterColorCheck } from '../hooks/useCenterColorCheck';
import { CameraView } from '../components/CameraView';
import { ReadinessIndicator } from '../components/ReadinessIndicator';
import { ProgressDots } from '../components/ProgressDots';
import { HoldOrientationHint } from '../components/HoldOrientationHint';
import { FaceGrid } from '../components/FaceGrid';
import { CenterColorIndicator } from '../components/CenterColorIndicator';
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
  const capturedFaces = useMemo(() => Object.keys(state.labels) as FaceLetter[], [state.labels]);
  const lastCapture = state.labels[step.face];
  const allCaptured = capturedFaces.length === CAPTURE_SEQUENCE.length;
  const centerReading = useCenterColorCheck(
    camera.videoRef,
    camera.status === 'live',
    step.toCamera,
    OVERLAY_FRACTION,
  );
  const gatedReadiness = useMemo(
    () => ({ ...readiness, ready: readiness.ready && centerReading.ok }),
    [readiness, centerReading.ok],
  );

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

  // Re-arm on each uncaptured scan step; a captured face waits for user review.
  const armed = camera.status === 'live' && !lastCapture;
  const autoProgress = useAutoCapture(gatedReadiness, armed, doCapture, state.scanIndex);
  const canCapture = camera.status === 'live' && centerReading.ok;

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
          readiness={gatedReadiness}
          autoProgress={autoProgress}
          overlayFraction={OVERLAY_FRACTION}
        />
      )}

      <HoldOrientationHint step={step} />
      <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <ReadinessIndicator readiness={readiness} />
        <CenterColorIndicator reading={centerReading} />
      </div>

      {lastCapture && (
        <div
          className="card"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            padding: 12,
          }}
        >
          <FaceGrid labels={lastCapture.labels} size={82} />
          <div>
            <strong style={{ display: 'block', fontSize: '0.9rem' }}>Face captured</strong>
            <span className="subtitle" style={{ display: 'block', margin: '2px 0 0', fontSize: '0.78rem' }}>
              Check the stickers, then continue.
            </span>
          </div>
        </div>
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
            <button className="btn" onClick={doCapture} disabled={!canCapture}>
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
