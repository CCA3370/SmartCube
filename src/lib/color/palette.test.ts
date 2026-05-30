import { describe, it, expect } from 'vitest';
import { DISPLAY_COLOR, STANDARD_PALETTE, hexToRgb } from './palette';
import { FACES } from '../cube';

describe('palette', () => {
  it('hexToRgb parses #rrggbb into channels', () => {
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#c41e3a')).toEqual({ r: 196, g: 30, b: 58 });
  });

  it('defines a display color for every face', () => {
    for (const f of FACES) expect(DISPLAY_COLOR[f]).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('builds a finite, distinct CIELAB center for every face', () => {
    for (const f of FACES) {
      const c = STANDARD_PALETTE[f];
      expect(Number.isFinite(c.L)).toBe(true);
      expect(Number.isFinite(c.a)).toBe(true);
      expect(Number.isFinite(c.b)).toBe(true);
    }
    const fingerprints = new Set(
      FACES.map((f) => `${STANDARD_PALETTE[f].L.toFixed(2)},${STANDARD_PALETTE[f].a.toFixed(2)}`),
    );
    expect(fingerprints.size).toBe(6);
  });
});
