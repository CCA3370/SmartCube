import { describe, it, expect } from 'vitest';
import { ciede2000 } from './ciede2000';
import { rgb2lab } from './colorspace';
import type { LAB } from './colorspace';
import { structuralCleanup, classifyRelativeToCenters, type CenterPalette } from './classify';
import type { FaceLetter } from '../cube/types';

// Reference vectors from Sharma, Wu & Dalal (2005), "The CIEDE2000
// Color-Difference Formula: Implementation Notes, Supplementary Test Data and
// Mathematical Observations". These are the canonical sanity checks for any
// CIEDE2000 implementation (they exercise the discontinuity edge cases).
const SHARMA: Array<[LAB, LAB, number]> = [
  [{ L: 50, a: 2.6772, b: -79.7751 }, { L: 50, a: 0, b: -82.7485 }, 2.0425],
  [{ L: 50, a: 3.1571, b: -77.2803 }, { L: 50, a: 0, b: -82.7485 }, 2.8615],
  [{ L: 50, a: 2.8361, b: -74.02 }, { L: 50, a: 0, b: -82.7485 }, 3.4412],
  [{ L: 50, a: -1.3802, b: -84.2814 }, { L: 50, a: 0, b: -82.7485 }, 1.0],
  [{ L: 50, a: -1.1848, b: -84.8006 }, { L: 50, a: 0, b: -82.7485 }, 1.0],
  [{ L: 50, a: 0, b: 0 }, { L: 50, a: -1, b: 2 }, 2.3669],
  [{ L: 50, a: 2.49, b: -0.001 }, { L: 50, a: -2.49, b: 0.0009 }, 7.1792],
  [{ L: 60.2574, a: -34.0099, b: 36.2677 }, { L: 60.4626, a: -34.1751, b: 39.4387 }, 1.2644],
  [{ L: 63.0109, a: -31.0961, b: -5.8663 }, { L: 62.8187, a: -29.7946, b: -4.0864 }, 1.263],
  [{ L: 22.7233, a: 20.0904, b: -46.694 }, { L: 23.0331, a: 14.973, b: -42.5619 }, 2.0373],
  [{ L: 36.4612, a: 47.858, b: 18.3852 }, { L: 36.2715, a: 50.5065, b: 21.2231 }, 1.4146],
  [{ L: 2.0776, a: 0.0795, b: -1.135 }, { L: 0.9033, a: -0.0636, b: -0.5514 }, 0.9082],
];

describe('ciede2000', () => {
  it('matches Sharma et al. reference vectors', () => {
    for (const [a, b, expected] of SHARMA) {
      expect(ciede2000(a, b)).toBeCloseTo(expected, 3);
    }
  });

  it('is zero for identical colors and symmetric', () => {
    const c: LAB = { L: 40, a: 12, b: -7 };
    expect(ciede2000(c, c)).toBeCloseTo(0, 10);
    const d: LAB = { L: 70, a: -20, b: 30 };
    expect(ciede2000(c, d)).toBeCloseTo(ciede2000(d, c), 10);
  });
});

// Canonical Western cube scheme RGBs (approximate sticker colors).
const SCHEME: Record<FaceLetter, [number, number, number]> = {
  U: [255, 255, 255], // white
  R: [200, 30, 30], // red
  F: [0, 160, 70], // green
  D: [255, 215, 0], // yellow
  L: [255, 100, 20], // orange
  B: [0, 70, 180], // blue
};

function palette(): CenterPalette {
  return Object.fromEntries(
    (Object.keys(SCHEME) as FaceLetter[]).map((f) => [f, rgb2lab({ r: SCHEME[f][0], g: SCHEME[f][1], b: SCHEME[f][2] })]),
  ) as CenterPalette;
}

describe('classification', () => {
  it('classifies clean samples to their own center', () => {
    const pal = palette();
    const faces = Object.keys(SCHEME) as FaceLetter[];
    const labs = faces.map((f) => rgb2lab({ r: SCHEME[f][0], g: SCHEME[f][1], b: SCHEME[f][2] }));
    const { labels } = classifyRelativeToCenters(labs, pal);
    expect(labels).toEqual(faces);
  });

  it('structuralCleanup forces exactly 9 of each color on a 54-sticker input', () => {
    const pal = palette();
    const faces = Object.keys(SCHEME) as FaceLetter[];
    // Build a solved-cube set of 54 LABs (9 of each), then perturb a few
    // orange stickers toward red to create a count violation.
    const labs: LAB[] = [];
    for (const f of faces) {
      for (let i = 0; i < 9; i++) labs.push(rgb2lab({ r: SCHEME[f][0], g: SCHEME[f][1], b: SCHEME[f][2] }));
    }
    // Nudge two oranges (face L) halfway to red (face R).
    labs[FACES_INDEX('L') * 9 + 0] = rgb2lab({ r: 228, g: 65, b: 25 });
    labs[FACES_INDEX('L') * 9 + 1] = rgb2lab({ r: 228, g: 65, b: 25 });

    const { labels } = structuralCleanup(labs, pal);
    const counts: Record<string, number> = {};
    for (const l of labels) counts[l] = (counts[l] ?? 0) + 1;
    for (const f of faces) expect(counts[f]).toBe(9);
  });

  it('structuralCleanup flags reassigned stickers with low (negative) confidence', () => {
    const pal = palette();
    const faces = Object.keys(SCHEME) as FaceLetter[];
    const solved: LAB[] = [];
    for (const f of faces) {
      for (let i = 0; i < 9; i++) solved.push(rgb2lab({ r: SCHEME[f][0], g: SCHEME[f][1], b: SCHEME[f][2] }));
    }

    // Clean cube: every sticker sits on its own center, so all margins are positive.
    const clean = structuralCleanup(solved, pal);
    expect(Math.min(...clean.confidence)).toBeGreaterThan(0);

    // Force a count violation: paint one white (U) sticker pure red (R -> 10, U -> 8).
    // Rebalancing moves one R-assigned sticker to U; that sticker's assigned label
    // is then NOT its nearest center, so its margin is negative and it gets flagged.
    const violating = solved.slice();
    violating[0] = rgb2lab({ r: SCHEME.R[0], g: SCHEME.R[1], b: SCHEME.R[2] });
    const fixed = structuralCleanup(violating, pal);
    const counts: Record<string, number> = {};
    for (const l of fixed.labels) counts[l] = (counts[l] ?? 0) + 1;
    for (const f of faces) expect(counts[f]).toBe(9);
    expect(Math.min(...fixed.confidence)).toBeLessThan(0);
  });
});

function FACES_INDEX(f: FaceLetter): number {
  return (['U', 'R', 'F', 'D', 'L', 'B'] as FaceLetter[]).indexOf(f);
}
