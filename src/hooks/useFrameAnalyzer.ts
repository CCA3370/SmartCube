import { useEffect, useState } from 'react';
import {
  classifyReadiness,
  DEFAULT_THRESHOLDS,
  type Readiness,
} from '../lib/vision/readiness';
import type { AnalyzerResponse } from '../workers/frameAnalyzer.worker';

const ANALYZE_SIZE = 192; // downscaled square fed to the worker

const INITIAL: Readiness = classifyReadiness(
  { sharpness: 0, exposure: 0, stability: Infinity },
  DEFAULT_THRESHOLDS,
);

/**
 * Drive a per-frame analysis loop: on each new video frame, draw the centered
 * face region into a small offscreen canvas, hand the bitmap to the analyzer
 * worker, and surface the latest readiness. Uses requestVideoFrameCallback when
 * available (processes each unique frame once), else falls back to rAF. At most
 * one frame is in flight at a time — frames are dropped while the worker is busy.
 */
export function useFrameAnalyzer(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  active: boolean,
): Readiness {
  const [readiness, setReadiness] = useState<Readiness>(INITIAL);

  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    if (!video) return;

    const worker = new Worker(
      new URL('../workers/frameAnalyzer.worker.ts', import.meta.url),
      { type: 'module' },
    );
    let inFlight = false;
    worker.addEventListener('message', (ev: MessageEvent<AnalyzerResponse>) => {
      if (ev.data.type === 'metrics') {
        inFlight = false;
        setReadiness(ev.data.readiness);
      }
    });
    worker.postMessage({ type: 'reset' });

    const canvas = document.createElement('canvas');
    canvas.width = ANALYZE_SIZE;
    canvas.height = ANALYZE_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let stopped = false;
    let rafHandle = 0;
    let rvfcHandle = 0;

    const processFrame = () => {
      // Skip while a frame is still being analyzed: bounds the worker queue to a
      // single in-flight bitmap and drops frames it can't keep up with.
      if (stopped || inFlight || !ctx || !video.videoWidth) return;
      const side = Math.min(video.videoWidth, video.videoHeight);
      const sx = (video.videoWidth - side) / 2;
      const sy = (video.videoHeight - side) / 2;
      // Draw the centered square region, downscaled to ANALYZE_SIZE.
      ctx.drawImage(video, sx, sy, side, side, 0, 0, ANALYZE_SIZE, ANALYZE_SIZE);
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
    };
  }, [active, videoRef]);

  return readiness;
}
