/// <reference lib="webworker" />
import {
  computeMetrics,
  classifyReadiness,
  DEFAULT_THRESHOLDS,
  type ReadinessThresholds,
  type Readiness,
} from '../lib/vision/readiness';

// Analyzes downscaled frames (sent as ImageBitmaps) and posts back readiness.
// Keeps the previous grayscale buffer to measure stability.

export type AnalyzerRequest =
  | { type: 'config'; thresholds: Partial<ReadinessThresholds> }
  | { type: 'frame'; bitmap: ImageBitmap }
  | { type: 'reset' };

export type AnalyzerResponse = { type: 'metrics'; readiness: Readiness };

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
  }
  if (!ctx) {
    bitmap.close();
    return;
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, w, h);
  const { metrics, gray } = computeMetrics(data as Uint8ClampedArray, w, h, prevGray);
  prevGray = gray;
  post({ type: 'metrics', readiness: classifyReadiness(metrics, thresholds) });
});
