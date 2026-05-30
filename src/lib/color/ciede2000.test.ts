import { describe, it, expect } from 'vitest';
import { ciede2000 } from './ciede2000';
import type { LAB } from './colorspace';

const lab = (L: number, a: number, b: number): LAB => ({ L, a, b });

// Sharma–Wu–Dalal CIEDE2000 supplementary test data (a representative subset of
// the published 34 pairs, including the hard hue-wraparound and C'=0 cases). A
// correct ΔE00 implementation must reproduce these to the published precision.
// Reference: Sharma, Wu, Dalal, "The CIEDE2000 Color-Difference Formula:
// Implementation Notes, Supplementary Test Data, and Mathematical Observations".
const CASES: Array<[LAB, LAB, number]> = [
  [lab(50.0, 2.6772, -79.7751), lab(50.0, 0.0, -82.7485), 2.0425],
  [lab(50.0, 3.1571, -77.2803), lab(50.0, 0.0, -82.7485), 2.8615],
  [lab(50.0, 2.8361, -74.02), lab(50.0, 0.0, -82.7485), 3.4412],
  [lab(50.0, -1.3802, -84.2814), lab(50.0, 0.0, -82.7485), 1.0],
  [lab(50.0, 0.0, 0.0), lab(50.0, -1.0, 2.0), 2.3669],
  [lab(50.0, 2.49, -0.001), lab(50.0, -2.49, 0.0009), 7.1792],
  [lab(50.0, 2.5, 0.0), lab(50.0, 0.0, -2.5), 4.3065],
  [lab(50.0, 2.5, 0.0), lab(73.0, 25.0, -18.0), 27.1492],
  [lab(50.0, 2.5, 0.0), lab(56.0, -27.0, -3.0), 31.903],
  [lab(60.2574, -34.0099, 36.2677), lab(60.4626, -34.1751, 39.4387), 1.2644],
  [lab(63.0109, -31.0961, -5.8663), lab(62.8187, -29.7946, -4.0864), 1.263],
  [lab(22.7233, 20.0904, -46.694), lab(23.0331, 14.973, -42.5619), 2.0373],
  [lab(2.0776, 0.0795, -1.135), lab(0.9033, -0.0636, -0.5514), 0.9082],
];

describe('ciede2000', () => {
  it('matches the Sharma reference test data', () => {
    for (const [a, b, expected] of CASES) {
      expect(ciede2000(a, b)).toBeCloseTo(expected, 3);
    }
  });

  it('is zero for identical colors', () => {
    expect(ciede2000(lab(50, 20, -30), lab(50, 20, -30))).toBeCloseTo(0, 6);
  });

  it('is symmetric in its arguments', () => {
    const a = lab(50, 2.6772, -79.7751);
    const b = lab(50, 0, -82.7485);
    expect(ciede2000(a, b)).toBeCloseTo(ciede2000(b, a), 6);
  });
});
