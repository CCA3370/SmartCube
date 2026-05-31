import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { Readiness } from '../lib/vision/readiness';
import { videoPointToViewport, coverScale, scalePoint, type Pt, type Size } from '../lib/vision/coords';
import { ANGLE_GATE, type DetectionResult } from '../lib/vision/detectFace';
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
  /** Color to breathe in the center cell when a new step begins (hex). */
  centerHintColor?: string;
  /** Changes per capture step to re-trigger the center-cell color cue. */
  centerHintKey?: unknown;
  /** Live, smoothed cube-face detection that drives the tracking box. */
  detection?: DetectionResult;
  /** Detect-space dimensions the detection coordinates are expressed in. */
  detectSize?: { w: number; h: number } | null;
  /** True when the cube is located, steady and ready — paints the box as locked. */
  locked?: boolean;
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
  const sampleSize = Math.min(video.width, video.height) * fraction;
  const topLeft = videoPointToViewport(
    { x: (video.width - sampleSize) / 2, y: (video.height - sampleSize) / 2 },
    video,
    viewport,
  );

  return {
    left: topLeft.x,
    top: topLeft.y,
    size: sampleSize * coverScale(video, viewport),
  };
}

/**
 * The live video with an automatic cube-face tracking overlay. A canvas draws the
 * detected quad + 3x3 grid (mapped detect -> video -> viewport) each frame; when
 * no face is found we fall back to a faint centered guide ("searching") that also
 * marks the region the manual Capture button samples.
 */
export function CameraView({
  videoRef,
  readiness,
  autoProgress,
  overlayFraction = 0.7,
  capturedFace,
  centerHintColor,
  centerHintKey,
  detection,
  detectSize,
  locked = false,
}: CameraViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drewBoxRef = useRef(false);
  const [overlayRect, setOverlayRect] = useState<OverlayRect | null>(null);
  const [centerHintVisible, setCenterHintVisible] = useState(false);
  const pct = overlayFraction * 100;
  const ringColor = readiness.ready ? 'var(--accent)' : 'rgba(255,255,255,0.6)';
  const reviewing = Boolean(capturedFace);
  const tracking = !reviewing && Boolean(detection?.found);

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

  // Draw (or clear) the tracking box on the overlay canvas.
  const drawTracking = useCallback(() => {
    const shouldDraw =
      !reviewing && Boolean(detection?.found && detection.quad && detectSize);
    // Nothing to draw and nothing previously drawn — skip touching the canvas.
    if (!shouldDraw && !drewBoxRef.current) return;

    const canvas = overlayCanvasRef.current;
    const container = containerRef.current;
    const video = videoRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bounds = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(bounds.width * dpr));
    const H = Math.max(1, Math.round(bounds.height * dpr));
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, bounds.width, bounds.height);

    if (!shouldDraw || !video || !video.videoWidth || !detection?.quad || !detectSize) {
      drewBoxRef.current = false;
      return;
    }

    const vsz = { width: video.videoWidth, height: video.videoHeight };
    const vpsz = { width: bounds.width, height: bounds.height };
    const sx = vsz.width / detectSize.w;
    const sy = vsz.height / detectSize.h;
    const toView = (p: Pt) => videoPointToViewport(scalePoint(p, sx, sy), vsz, vpsz);
    const q = detection.quad.map(toView);

    const tilted = Math.abs(detection.angle) > ANGLE_GATE;
    const strong = locked
      ? 'rgba(76,154,255,0.95)'
      : tilted
        ? 'rgba(255,176,32,0.95)'
        : 'rgba(255,255,255,0.92)';
    const faint = locked
      ? 'rgba(76,154,255,0.5)'
      : tilted
        ? 'rgba(255,176,32,0.5)'
        : 'rgba(255,255,255,0.45)';
    const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(q[0].x, q[0].y);
    ctx.lineTo(q[1].x, q[1].y);
    ctx.lineTo(q[2].x, q[2].y);
    ctx.lineTo(q[3].x, q[3].y);
    ctx.closePath();
    ctx.lineWidth = locked ? 3 : 2;
    ctx.strokeStyle = strong;
    ctx.stroke();

    ctx.lineWidth = 1;
    ctx.strokeStyle = faint;
    for (const t of [1 / 3, 2 / 3]) {
      const top = lerp(q[0], q[1], t);
      const bot = lerp(q[3], q[2], t);
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(bot.x, bot.y);
      ctx.stroke();
      const left = lerp(q[0], q[3], t);
      const right = lerp(q[1], q[2], t);
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.stroke();
    }

    // Auto-capture hold: fill the bottom edge of the box as the user holds steady.
    if (autoProgress > 0) {
      const a = q[3];
      const b = q[2];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + (b.x - a.x) * autoProgress, a.y + (b.y - a.y) * autoProgress);
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(76,154,255,0.95)';
      ctx.stroke();
    }

    drewBoxRef.current = true;
  }, [detection, detectSize, reviewing, locked, autoProgress, videoRef]);

  const drawRef = useRef(drawTracking);
  useEffect(() => {
    drawRef.current = drawTracking;
    drawTracking();
  }, [drawTracking]);

  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    const onResize = () => {
      updateOverlayRect();
      drawRef.current();
    };
    onResize();
    if (!container || !video) return undefined;

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize);
    observer?.observe(container);
    video.addEventListener('loadedmetadata', onResize);
    video.addEventListener('resize', onResize);
    window.addEventListener('resize', onResize);

    return () => {
      observer?.disconnect();
      video.removeEventListener('loadedmetadata', onResize);
      video.removeEventListener('resize', onResize);
      window.removeEventListener('resize', onResize);
    };
  }, [updateOverlayRect, videoRef]);

  useEffect(() => {
    if (!centerHintColor || reviewing) {
      setCenterHintVisible(false);
      return undefined;
    }

    setCenterHintVisible(true);
    const timer = window.setTimeout(() => setCenterHintVisible(false), 2000);
    return () => window.clearTimeout(timer);
  }, [centerHintColor, centerHintKey, reviewing]);

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
      : 'none',
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
      <canvas ref={overlayCanvasRef} className="tracking-overlay" aria-hidden="true" />
      <div className={`camera-overlay${reviewing ? ' reviewing' : ''}`}>
        {reviewing ? (
          <div className="align-square recognized" style={alignStyle}>
            <FaceGrid labels={capturedFace!.labels} confidence={capturedFace!.confidence} fill />
          </div>
        ) : tracking ? null : (
          <div className="align-square searching" style={alignStyle}>
            {centerHintVisible && centerHintColor && (
              <span
                aria-hidden="true"
                className="center-color-hint"
                data-testid="center-color-hint"
                style={{ backgroundColor: centerHintColor, color: centerHintColor }}
              />
            )}
            <div className="grid-lines">
              {Array.from({ length: 2 }).map((_, i) => (
                <span key={`v${i}`} className="vline" style={{ left: `${((i + 1) / 3) * 100}%` }} />
              ))}
              {Array.from({ length: 2 }).map((_, i) => (
                <span key={`h${i}`} className="hline" style={{ top: `${((i + 1) / 3) * 100}%` }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
