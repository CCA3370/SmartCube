import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { Readiness } from '../lib/vision/readiness';
import type { FaceLetter } from '../lib/cube';
import { FaceGrid } from './FaceGrid';
import './CameraView.css';

interface CapturedFaceOverlay {
  labels: FaceLetter[];
  confidence?: number[];
}

interface CameraViewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  readiness: Readiness;
  /** 0..1 auto-capture fill. */
  autoProgress: number;
  overlayFraction?: number;
  capturedFace?: CapturedFaceOverlay;
}

interface Size {
  width: number;
  height: number;
}

export interface OverlayRect {
  left: number;
  top: number;
  size: number;
}

export function projectCenteredSampleSquare(
  video: Size,
  viewport: Size,
  overlayFraction: number,
): OverlayRect | null {
  if (video.width <= 0 || video.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return null;
  }

  const fraction = Math.max(0, Math.min(1, overlayFraction));
  const scale = Math.max(viewport.width / video.width, viewport.height / video.height);
  const renderedWidth = video.width * scale;
  const renderedHeight = video.height * scale;
  const renderedLeft = (viewport.width - renderedWidth) / 2;
  const renderedTop = (viewport.height - renderedHeight) / 2;
  const sampleSize = Math.min(video.width, video.height) * fraction;

  return {
    left: renderedLeft + ((video.width - sampleSize) / 2) * scale,
    top: renderedTop + ((video.height - sampleSize) / 2) * scale,
    size: sampleSize * scale,
  };
}

/**
 * The live video with a centered 3x3 alignment overlay. The overlay square uses
 * the SAME geometry (centered, `overlayFraction` of the smaller dimension) that
 * the sampler reads, so what the user aligns is exactly what we sample.
 */
export function CameraView({
  videoRef,
  readiness,
  autoProgress,
  overlayFraction = 0.7,
  capturedFace,
}: CameraViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [overlayRect, setOverlayRect] = useState<OverlayRect | null>(null);
  const pct = overlayFraction * 100;
  const ringColor = readiness.ready ? 'var(--accent)' : 'rgba(255,255,255,0.6)';
  const reviewing = Boolean(capturedFace);

  const updateOverlayRect = useCallback(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container || !video.videoWidth || !video.videoHeight) {
      setOverlayRect(null);
      return;
    }

    const bounds = container.getBoundingClientRect();
    setOverlayRect(
      projectCenteredSampleSquare(
        { width: video.videoWidth, height: video.videoHeight },
        { width: bounds.width, height: bounds.height },
        overlayFraction,
      ),
    );
  }, [overlayFraction, videoRef]);

  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    updateOverlayRect();
    if (!container || !video) return undefined;

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateOverlayRect);
    observer?.observe(container);
    video.addEventListener('loadedmetadata', updateOverlayRect);
    video.addEventListener('resize', updateOverlayRect);
    window.addEventListener('resize', updateOverlayRect);

    return () => {
      observer?.disconnect();
      video.removeEventListener('loadedmetadata', updateOverlayRect);
      video.removeEventListener('resize', updateOverlayRect);
      window.removeEventListener('resize', updateOverlayRect);
    };
  }, [updateOverlayRect, videoRef]);

  const alignStyle: CSSProperties = {
    ...(overlayRect
      ? {
          position: 'absolute',
          left: overlayRect.left,
          top: overlayRect.top,
          width: overlayRect.size,
          height: overlayRect.size,
        }
      : {
          width: `${pct}%`,
          aspectRatio: '1 / 1',
        }),
    borderColor: reviewing ? 'var(--warn)' : ringColor,
    boxShadow: reviewing
      ? '0 0 0 3px rgba(255,176,32,0.25), 0 16px 38px rgba(0,0,0,0.34)'
      : readiness.ready ? '0 0 0 3px rgba(76,154,255,0.35)' : 'none',
  };

  return (
    <div ref={containerRef} className={`camera-view${reviewing ? ' reviewing' : ''}`}>
      <video
        ref={videoRef}
        className={`camera-video${reviewing ? ' hidden' : ''}`}
        playsInline
        muted
        autoPlay
      />
      <div className={`camera-overlay${reviewing ? ' reviewing' : ''}`}>
        <div
          className={`align-square${readiness.ready ? ' ready' : ''}${autoProgress > 0 ? ' holding' : ''}${reviewing ? ' recognized' : ''}`}
          style={alignStyle}
        >
          {capturedFace ? (
            <FaceGrid
              labels={capturedFace.labels}
              confidence={capturedFace.confidence}
              fill
            />
          ) : (
            <>
              <div className="grid-lines">
                {Array.from({ length: 2 }).map((_, i) => (
                  <span key={`v${i}`} className="vline" style={{ left: `${((i + 1) / 3) * 100}%` }} />
                ))}
                {Array.from({ length: 2 }).map((_, i) => (
                  <span key={`h${i}`} className="hline" style={{ top: `${((i + 1) / 3) * 100}%` }} />
                ))}
              </div>
              {autoProgress > 0 && (
                <div className="hold-bar">
                  <span style={{ transform: `scaleX(${autoProgress})` }} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
