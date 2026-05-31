import { describe, it, expect } from 'vitest';
import { detectFace, detectionBBox, ANGLE_GATE, type DetectionResult } from './detectFace';

type RGB = [number, number, number];

interface FaceOpts {
  w?: number;
  h?: number;
  cx: number;
  cy: number;
  faceSize: number;
  gapFrac?: number;
  colors?: RGB[];
  angleDeg?: number;
  bg?: RGB;
  noise?: number;
  occlude?: number[];
}

// Six visually-distinct sticker colors (screen row-major default).
const DISTINCT: RGB[] = [
  [220, 40, 40], // red
  [240, 240, 240], // white
  [30, 140, 60], // green
  [250, 200, 30], // yellow
  [240, 130, 20], // orange
  [40, 70, 200], // blue
  [220, 40, 40],
  [30, 140, 60],
  [250, 200, 30],
];

/** Deterministic pseudo-noise so tests stay stable (no Math.random). */
function jitter(x: number, y: number, amp: number): number {
  if (!amp) return 0;
  return (((x * 7 + y * 13) % (2 * amp + 1)) + (2 * amp + 1)) % (2 * amp + 1) - amp;
}

/** Paint a 3x3 grid of colored stickers (with dark gaps) onto an ImageData. */
function renderFakeFace(o: FaceOpts): ImageData {
  const w = o.w ?? 240;
  const h = o.h ?? 240;
  const { cx, cy, faceSize } = o;
  const gapFrac = o.gapFrac ?? 0.16;
  const colors = o.colors ?? DISTINCT;
  const bg = o.bg ?? [26, 26, 30];
  const noise = o.noise ?? 0;
  const occlude = new Set(o.occlude ?? []);
  const pitch = faceSize / 3;
  const sticker = pitch * (1 - gapFrac);
  const a = (o.angleDeg ?? 0) * (Math.PI / 180);
  const cosA = Math.cos(a);
  const sinA = Math.sin(a);
  const half = faceSize / 2;

  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = bg[0];
    data[i * 4 + 1] = bg[1];
    data[i * 4 + 2] = bg[2];
    data[i * 4 + 3] = 255;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      // Rotate into face-local (undo +a).
      const lx = dx * cosA + dy * sinA;
      const ly = -dx * sinA + dy * cosA;
      const col = Math.floor((lx + half) / pitch);
      const row = Math.floor((ly + half) / pitch);
      if (col < 0 || col > 2 || row < 0 || row > 2) continue;
      const ccx = -half + (col + 0.5) * pitch;
      const ccy = -half + (row + 0.5) * pitch;
      if (Math.abs(lx - ccx) > sticker / 2 || Math.abs(ly - ccy) > sticker / 2) continue;
      const idx = row * 3 + col;
      if (occlude.has(idx)) continue;
      const c = colors[idx];
      const i = (y * w + x) * 4;
      data[i] = c[0] + jitter(x, y, noise);
      data[i + 1] = c[1] + jitter(y, x, noise);
      data[i + 2] = c[2] + jitter(x + 1, y, noise);
    }
  }
  return { data, width: w, height: h } as ImageData;
}

/** True image-space center of cell (idx) for the given face opts. */
function trueCenter(o: FaceOpts, idx: number): { x: number; y: number } {
  const pitch = o.faceSize / 3;
  const half = o.faceSize / 2;
  const col = idx % 3;
  const row = Math.floor(idx / 3);
  const ccx = -half + (col + 0.5) * pitch;
  const ccy = -half + (row + 0.5) * pitch;
  const a = (o.angleDeg ?? 0) * (Math.PI / 180);
  const cosA = Math.cos(a);
  const sinA = Math.sin(a);
  return { x: o.cx + ccx * cosA - ccy * sinA, y: o.cy + ccx * sinA + ccy * cosA };
}

function expectCellsMatch(res: DetectionResult, o: FaceOpts, tol: number) {
  expect(res.cells).toHaveLength(9);
  for (let idx = 0; idx < 9; idx++) {
    const t = trueCenter(o, idx);
    expect(res.cells[idx].x).toBeGreaterThan(t.x - tol);
    expect(res.cells[idx].x).toBeLessThan(t.x + tol);
    expect(res.cells[idx].y).toBeGreaterThan(t.y - tol);
    expect(res.cells[idx].y).toBeLessThan(t.y + tol);
  }
}

describe('detectFace — happy path', () => {
  it('detects a centered, axis-aligned face and orders cells screen row-major', () => {
    const o: FaceOpts = { cx: 120, cy: 120, faceSize: 150 };
    const res = detectFace(renderFakeFace(o));
    expect(res.found).toBe(true);
    expect(res.synthesized).toEqual([]);
    expect(res.confidence).toBeGreaterThan(0.8);
    expect(Math.abs(res.angle)).toBeLessThan(2);
    // center cell is index 4
    expect(res.cells[4].x).toBeCloseTo(120, 0);
    expect(res.cells[4].y).toBeCloseTo(120, 0);
    // ordering: top-left before bottom-right
    expect(res.cells[0].x).toBeLessThan(res.cells[8].x);
    expect(res.cells[0].y).toBeLessThan(res.cells[8].y);
    // top-right: right of top-left, same row
    expect(res.cells[2].x).toBeGreaterThan(res.cells[0].x);
    expect(res.cells[2].y).toBeCloseTo(res.cells[0].y, 0);
    expectCellsMatch(res, o, 4);
    // sticker-size estimate is in a sane range vs the painted sticker (~42px)
    expect(res.cell).toBeGreaterThan(25);
    expect(res.cell).toBeLessThan(50);
  });

  it('detects an off-center, smaller face', () => {
    const o: FaceOpts = { w: 320, h: 240, cx: 90, cy: 150, faceSize: 96 };
    const res = detectFace(renderFakeFace(o));
    expect(res.found).toBe(true);
    expectCellsMatch(res, o, 4);
  });

  it('recovers a small in-plane rotation and still orders cells correctly', () => {
    const o: FaceOpts = { cx: 120, cy: 120, faceSize: 150, angleDeg: 8 };
    const res = detectFace(renderFakeFace(o));
    expect(res.found).toBe(true);
    expect(res.angle).toBeGreaterThan(4);
    expect(res.angle).toBeLessThan(12);
    expect(res.cells[4].x).toBeCloseTo(120, 0);
    expect(res.cells[4].y).toBeCloseTo(120, 0);
    expectCellsMatch(res, o, 7);
  });

  it('synthesizes a single occluded sticker from the lattice', () => {
    const o: FaceOpts = { cx: 120, cy: 120, faceSize: 150, occlude: [2] };
    const res = detectFace(renderFakeFace(o));
    expect(res.found).toBe(true);
    expect(res.synthesized).toContain(2);
    // synthesized cell still lands near the true (missing) sticker center
    const t = trueCenter(o, 2);
    expect(res.cells[2].x).toBeCloseTo(t.x, -1);
    expect(res.cells[2].y).toBeCloseTo(t.y, -1);
  });

  it('still detects under moderate color noise', () => {
    const o: FaceOpts = { cx: 120, cy: 120, faceSize: 150, noise: 12 };
    const res = detectFace(renderFakeFace(o));
    expect(res.found).toBe(true);
    expectCellsMatch(res, o, 6);
  });

  it('reports an in-plane angle beyond the capture gate (caller rejects it)', () => {
    const o: FaceOpts = { cx: 120, cy: 120, faceSize: 150, angleDeg: 22 };
    const res = detectFace(renderFakeFace(o));
    expect(res.found).toBe(true);
    expect(Math.abs(res.angle)).toBeGreaterThan(ANGLE_GATE);
  });
});

describe('detectFace — rejection (no false grids)', () => {
  it('rejects a solid frame', () => {
    const data = new Uint8ClampedArray(240 * 240 * 4).fill(120);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    expect(detectFace({ data, width: 240, height: 240 } as ImageData).found).toBe(false);
  });

  it('rejects a high-frequency random frame', () => {
    const w = 240;
    const h = 240;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const v = (i * 73 + ((i / w) | 0) * 31) % 256;
      data[i * 4] = v;
      data[i * 4 + 1] = (v * 3) % 256;
      data[i * 4 + 2] = (v * 7) % 256;
      data[i * 4 + 3] = 255;
    }
    expect(detectFace({ data, width: w, height: h } as ImageData).found).toBe(false);
  });

  it('rejects a single large square (not a 3x3 grid)', () => {
    const w = 240;
    const h = 240;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = 26;
      data[i * 4 + 1] = 26;
      data[i * 4 + 2] = 30;
      data[i * 4 + 3] = 255;
    }
    for (let y = 80; y < 160; y++) {
      for (let x = 80; x < 160; x++) {
        const i = (y * w + x) * 4;
        data[i] = 200;
        data[i + 1] = 60;
        data[i + 2] = 60;
      }
    }
    expect(detectFace({ data, width: w, height: h } as ImageData).found).toBe(false);
  });
});

describe('detectionBBox', () => {
  it('returns the axis-aligned bbox of the quad when found', () => {
    const res = detectFace(renderFakeFace({ cx: 120, cy: 120, faceSize: 150 }));
    const bbox = detectionBBox(res);
    expect(bbox).not.toBeNull();
    expect(bbox!.x).toBeGreaterThan(20);
    expect(bbox!.x).toBeLessThan(60);
    expect(bbox!.w).toBeGreaterThan(120);
  });

  it('returns null when not found', () => {
    expect(detectionBBox({ found: false } as DetectionResult)).toBeNull();
  });
});
