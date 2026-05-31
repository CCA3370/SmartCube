import { useEffect, useState } from 'react';
import {
  classifyReadiness,
  DEFAULT_THRESHOLDS,
  type Readiness,
} from '../lib/vision/readiness';
import { DETECT_SIZE, type DetectionResult } from '../lib/vision/detectFace';
import { smoothDetection, meanPointDelta } from '../lib/vision/smooth';
import type { AnalyzerResponse } from '../workers/frameAnalyzer.worker';

const SMOOTH_ALPHA = 0.4; // EMA weight of the newest detection for the overlay
const STABLE_FRAMES = 5; // consecutive low-motion frames before "steady"
const STABLE_FRAC = 0.2; // per-frame box motion below this x sticker-size = steady

const INITIAL_READINESS: Readiness = classifyReadiness(
  { sharpness: 0, exposure: 0, stability: Infinity },
  DEFAULT_THRESHOLDS,
);

const INITIAL_DETECTION: DetectionResult = {
  found: false,
  quad: null,
  cells: [],
  cell: 0,
  angle: 0,
  confidence: 0,
  synthesized: [],
};

export interface FrameAnalysis {
  readiness: Readiness;
  /** Temporally smoothed detection (used for both the overlay and capture sampling). */
  detection: DetectionResult;
  /** Detect-space dims of the analyzed frame, or null before the first frame. */
  detectSize: { w: number; h: number } | null;
  /** True once the (raw) detected box has held still for several frames. */
  gridStable: boolean;
}

const INITIAL: FrameAnalysis = {
  readiness: INITIAL_READINESS,
  detection: INITIAL_DETECTION,
  detectSize: null,
  gridStable: false,
};

/**
 * Drive a per-frame analysis loop: on each new video frame, draw the WHOLE frame
 * downscaled (longest side DETECT_SIZE) into an offscreen canvas, hand the bitmap
 * to the analyzer worker, and surface the latest readiness + cube-face detection.
 * Uses requestVideoFrameCallback when available (processes each unique frame once),
 * else rAF. At most one frame is in flight — frames are dropped while the worker
 * is busy. The detection is EMA-smoothed for a calm overlay; a separate raw-motion
 * tracker reports when the box has held steady.
 */
export function useFrameAnalyzer(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  active: boolean,
): FrameAnalysis {
  const [analysis, setAnalysis] = useState<FrameAnalysis>(INITIAL);

  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    if (!video) return;

    const worker = new Worker(
      new URL('../workers/frameAnalyzer.worker.ts', import.meta.url),
      { type: 'module' },
    );

    // Per-session smoothing + stability state (reset whenever this effect re-runs).
    let inFlight = false;
    let smoothed: DetectionResult | null = null;
    let prevRawQuad: DetectionResult['quad'] = null;
    let stableCount = 0;

    worker.addEventListener('message', (ev: MessageEvent<AnalyzerResponse>) => {
      if (ev.data.type !== 'metrics') return;
      inFlight = false;
      const { readiness, detection, detectSize } = ev.data;

      // Raw-motion stability (compare consecutive raw boxes, not the damped ones).
      if (detection.found && detection.quad) {
        const tol = Math.max(2, detection.cell * STABLE_FRAC);
        if (prevRawQuad && meanPointDelta(prevRawQuad, detection.quad) <= tol) stableCount++;
        else stableCount = 0;
        prevRawQuad = detection.quad;
      } else {
        prevRawQuad = null;
        stableCount = 0;
      }

      smoothed = smoothDetection(smoothed, detection, SMOOTH_ALPHA);
      setAnalysis({
        readiness,
        detection: smoothed,
        detectSize,
        gridStable: stableCount >= STABLE_FRAMES,
      });
    });
    worker.postMessage({ type: 'reset' });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let stopped = false;
    let rafHandle = 0;
    let rvfcHandle = 0;

    const processFrame = () => {
      // Skip while a frame is still being analyzed: bounds the worker queue to a
      // single in-flight bitmap and drops frames it can't keep up with.
      if (stopped || inFlight || !ctx || !video.videoWidth) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      // Downscale the WHOLE frame (aspect preserved) so the cube can be found
      // anywhere in view — not just a centered crop.
      const scale = DETECT_SIZE / Math.max(vw, vh);
      const dw = Math.max(1, Math.round(vw * scale));
      const dh = Math.max(1, Math.round(vh * scale));
      if (canvas.width !== dw || canvas.height !== dh) {
        canvas.width = dw;
        canvas.height = dh;
      }
      ctx.drawImage(video, 0, 0, vw, vh, 0, 0, dw, dh);
      inFlight = true;
      // createImageBitmap yields a transferable bitmap (zero-copy postMessage).
      createImageBitmap(canvas)
        .then((bm) => {
          if (stopped) {
            bm.close();
            inFlight = false;
            return;
          }
          worker.postMessage({ type: 'frame', bitmap: bm }, [bm]);
        })
        .catch(() => {
          inFlight = false;
        });
    };

    const loopRVFC = () => {
      if (stopped) return;
      processFrame();
      rvfcHandle = video.requestVideoFrameCallback!(() => loopRVFC());
    };
    const loopRAF = () => {
      if (stopped) return;
      processFrame();
      rafHandle = requestAnimationFrame(loopRAF);
    };

    if (typeof video.requestVideoFrameCallback === 'function') {
      loopRVFC();
    } else {
      loopRAF();
    }

    return () => {
      stopped = true;
      if (rafHandle) cancelAnimationFrame(rafHandle);
      if (rvfcHandle && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(rvfcHandle);
      worker.terminate();
      setAnalysis(INITIAL);
    };
  }, [active, videoRef]);

  return analysis;
}
