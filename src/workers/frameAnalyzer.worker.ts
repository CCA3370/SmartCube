/// <reference lib="webworker" />
import {
  computeMetrics,
  classifyReadiness,
  DEFAULT_THRESHOLDS,
  type ReadinessThresholds,
  type Readiness,
} from '../lib/vision/readiness';
import { detectFace, detectionBBox, type DetectionResult } from '../lib/vision/detectFace';

// Analyzes downscaled FULL frames (sent as ImageBitmaps): locates the cube face,
// then measures readiness (sharpness/exposure scoped to the located face, stability
// whole-frame) and posts both back. Keeps the previous grayscale buffer for stability.

export type AnalyzerRequest =
  | { type: 'config'; thresholds: Partial<ReadinessThresholds> }
  | { type: 'frame'; bitmap: ImageBitmap }
  | { type: 'reset' };

export type AnalyzerResponse = {
  type: 'metrics';
  readiness: Readiness;
  detection: DetectionResult;
  /** Detect-space dimensions of the analyzed frame (for mapping back). */
  detectSize: { w: number; h: number };
};

let thresholds: ReadinessThresholds = { ...DEFAULT_THRESHOLDS };
let prevGray: Float32Array | null = null;
let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

function post(msg: AnalyzerResponse) {
  (self as unknown as Worker).postMessage(msg);
}

self.addEventListener('message', (ev: MessageEvent<AnalyzerRequest>) => {
  const msg = ev.data;
  if (msg.type === 'config') {
    thresholds = { ...thresholds, ...msg.thresholds };
    return;
  }
  if (msg.type === 'reset') {
    prevGray = null;
    return;
  }
  // frame
  const { bitmap } = msg;
  const w = bitmap.width;
  const h = bitmap.height;
  if (!canvas || canvas.width !== w || canvas.height !== h) {
    canvas = new OffscreenCanvas(w, h);
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    prevGray = null; // dimensions changed: stale stability reference
  }
  if (!ctx) {
    bitmap.close();
    return;
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const frame = ctx.getImageData(0, 0, w, h);

  const detection = detectFace(frame);
  const roi = detectionBBox(detection) ?? undefined;
  const { metrics, gray } = computeMetrics(
    frame.data as Uint8ClampedArray,
    w,
    h,
    prevGray,
    roi,
  );
  prevGray = gray;
  post({
    type: 'metrics',
    readiness: classifyReadiness(metrics, thresholds),
    detection,
    detectSize: { w, h },
  });
});
