import { describe, it, expect } from 'vitest';
import { smoothDetection, meanPointDelta } from './smooth';
import type { DetectionResult } from './detectFace';
import type { Pt } from './coords';

function quad(x: number, y: number): [Pt, Pt, Pt, Pt] {
  return [
    { x, y },
    { x: x + 10, y },
    { x: x + 10, y: y + 10 },
    { x, y: y + 10 },
  ];
}

function found(x: number, y: number): DetectionResult {
  return {
    found: true,
    quad: quad(x, y),
    cells: Array.from({ length: 9 }, (_, i) => ({ x: x + i, y: y + i })),
    cell: 10,
    angle: 0,
    confidence: 0.9,
    synthesized: [],
  };
}

const NOT_FOUND: DetectionResult = {
  found: false,
  quad: null,
  cells: [],
  cell: 0,
  angle: 0,
  confidence: 0,
  synthesized: [],
};

describe('meanPointDelta', () => {
  it('is zero for identical point lists', () => {
    expect(meanPointDelta(quad(5, 5), quad(5, 5))).toBe(0);
  });
  it('measures mean displacement', () => {
    expect(meanPointDelta(quad(0, 0), quad(3, 4))).toBeCloseTo(5); // each corner moved (3,4)
  });
  it('is Infinity for mismatched lengths', () => {
    expect(meanPointDelta([{ x: 0, y: 0 }], [])).toBe(Infinity);
  });
});

describe('smoothDetection', () => {
  it('returns next as-is when there is no previous box', () => {
    expect(smoothDetection(null, found(0, 0), 0.5)).toEqual(found(0, 0));
  });

  it('clears immediately when the new detection is lost', () => {
    expect(smoothDetection(found(0, 0), NOT_FOUND, 0.5)).toEqual(NOT_FOUND);
  });

  it('blends corners halfway at alpha=0.5', () => {
    const out = smoothDetection(found(0, 0), found(10, 20), 0.5);
    expect(out.quad![0]).toEqual({ x: 5, y: 10 });
    expect(out.cells[0]).toEqual({ x: 5, y: 10 });
  });

  it('converges toward the target over repeated frames', () => {
    let s = found(0, 0);
    for (let i = 0; i < 30; i++) s = smoothDetection(s, found(100, 100), 0.35);
    expect(s.quad![0].x).toBeCloseTo(100, 1);
    expect(s.quad![0].y).toBeCloseTo(100, 1);
  });

  it('keeps the latest confidence and synthesized list', () => {
    const next = { ...found(10, 10), confidence: 0.6, synthesized: [3] };
    const out = smoothDetection(found(0, 0), next, 0.5);
    expect(out.confidence).toBe(0.6);
    expect(out.synthesized).toEqual([3]);
  });
});
