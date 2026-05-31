import { describe, it, expect } from 'vitest';
import { computeMetrics, classifyReadiness, DEFAULT_THRESHOLDS } from './readiness';

function solidFrame(w: number, h: number, v: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < px.length; i += 4) {
    px[i] = v;
    px[i + 1] = v;
    px[i + 2] = v;
    px[i + 3] = 255;
  }
  return px;
}

function checkerFrame(w: number, h: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = (x + y) % 2 === 0 ? 0 : 255;
      const i = (y * w + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = v;
      px[i + 3] = 255;
    }
  }
  return px;
}

describe('frame metrics', () => {
  it('flat frame has ~zero sharpness, exposure = its value', () => {
    const { metrics } = computeMetrics(solidFrame(16, 16, 128), 16, 16, null);
    expect(metrics.sharpness).toBeCloseTo(0, 5);
    expect(metrics.exposure).toBeCloseTo(128, 5);
  });

  it('high-frequency (checker) frame has high sharpness', () => {
    const { metrics } = computeMetrics(checkerFrame(16, 16), 16, 16, null);
    expect(metrics.sharpness).toBeGreaterThan(1000);
  });

  it('first frame is never stable; identical next frame is perfectly stable', () => {
    const f = solidFrame(16, 16, 100);
    const { metrics: m1, gray } = computeMetrics(f, 16, 16, null);
    expect(m1.stability).toBe(Infinity);
    const { metrics: m2 } = computeMetrics(f, 16, 16, gray);
    expect(m2.stability).toBeCloseTo(0, 5);
  });

  it('classifyReadiness combines the three gates', () => {
    const r = classifyReadiness({ sharpness: 100, exposure: 128, stability: 1 }, DEFAULT_THRESHOLDS);
    expect(r.ready).toBe(true);
    const dark = classifyReadiness({ sharpness: 100, exposure: 10, stability: 1 }, DEFAULT_THRESHOLDS);
    expect(dark.exposed).toBe(false);
    expect(dark.ready).toBe(false);
    const blurry = classifyReadiness({ sharpness: 5, exposure: 128, stability: 1 }, DEFAULT_THRESHOLDS);
    expect(blurry.sharp).toBe(false);
  });

  it('scopes exposure to the ROI when given', () => {
    // Dark frame with a bright 8x8 patch at (4,4).
    const w = 24;
    const h = 24;
    const px = solidFrame(w, h, 10);
    for (let y = 4; y < 12; y++) {
      for (let x = 4; x < 12; x++) {
        const i = (y * w + x) * 4;
        px[i] = px[i + 1] = px[i + 2] = 240;
      }
    }
    const whole = computeMetrics(px, w, h, null).metrics.exposure;
    const inPatch = computeMetrics(px, w, h, null, { x: 4, y: 4, w: 8, h: 8 }).metrics.exposure;
    expect(whole).toBeLessThan(40);
    expect(inPatch).toBeCloseTo(240, 0);
  });

  it('scopes sharpness to the ROI and falls back to full frame for a tiny ROI', () => {
    const w = 24;
    const h = 24;
    // Flat left half, checker right half.
    const px = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = x >= 12 ? ((x + y) % 2 === 0 ? 0 : 255) : 100;
        const i = (y * w + x) * 4;
        px[i] = px[i + 1] = px[i + 2] = v;
        px[i + 3] = 255;
      }
    }
    const flatRoi = computeMetrics(px, w, h, null, { x: 0, y: 0, w: 10, h: 24 }).metrics.sharpness;
    const checkerRoi = computeMetrics(px, w, h, null, { x: 12, y: 0, w: 12, h: 24 }).metrics.sharpness;
    expect(flatRoi).toBeCloseTo(0, 3);
    expect(checkerRoi).toBeGreaterThan(1000);
    // A 1px ROI is too small to measure → falls back to the whole frame.
    const tiny = computeMetrics(px, w, h, null, { x: 5, y: 5, w: 1, h: 1 }).metrics.sharpness;
    const full = computeMetrics(px, w, h, null).metrics.sharpness;
    expect(tiny).toBeCloseTo(full, 5);
  });
});
