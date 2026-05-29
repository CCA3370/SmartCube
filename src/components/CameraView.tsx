import type { Readiness } from '../lib/vision/readiness';
import './CameraView.css';

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  readiness: Readiness;
  /** 0..1 auto-capture fill. */
  autoProgress: number;
  overlayFraction?: number;
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
}: CameraViewProps) {
  const pct = overlayFraction * 100;
  const ringColor = readiness.ready ? 'var(--good)' : 'rgba(255,255,255,0.6)';
  return (
    <div className="camera-view">
      <video ref={videoRef} className="camera-video" playsInline muted autoPlay />
      <div className="camera-overlay">
        <div
          className="align-square"
          style={{
            width: `min(${pct}vw, ${pct}vh, 480px)`,
            aspectRatio: '1 / 1',
            borderColor: ringColor,
            boxShadow: readiness.ready ? '0 0 0 3px rgba(52,199,89,0.35)' : 'none',
          }}
        >
          <div className="grid-lines">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={`v${i}`} className="vline" style={{ left: `${(i / 3) * 100}%` }} />
            ))}
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={`h${i}`} className="hline" style={{ top: `${(i / 3) * 100}%` }} />
            ))}
          </div>
          {autoProgress > 0 && (
            <div className="auto-ring" style={{ '--p': autoProgress } as React.CSSProperties} />
          )}
        </div>
      </div>
    </div>
  );
}
