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
});
