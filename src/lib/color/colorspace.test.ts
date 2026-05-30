import { describe, it, expect } from 'vitest';
import { rgb2lab, srgbToLinear, type RGB } from './colorspace';

function hex(h: string): RGB {
  const v = Number.parseInt(h.replace('#', ''), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

describe('srgbToLinear', () => {
  it('maps the channel endpoints to 0 and 1', () => {
    expect(srgbToLinear(0)).toBe(0);
    expect(srgbToLinear(255)).toBeCloseTo(1, 10);
  });

  it('is continuous across the 0.04045 piecewise boundary', () => {
    // c/255 ≈ 0.04045 at c ≈ 10.31; check both sides agree near the knee.
    const below = srgbToLinear(10);
    const above = srgbToLinear(11);
    expect(below).toBeLessThan(above);
    expect(below).toBeCloseTo(10 / 255 / 12.92, 6); // linear branch
  });
});

describe('rgb2lab', () => {
  it('maps white to L≈100 with near-zero chroma', () => {
    const { L, a, b } = rgb2lab({ r: 255, g: 255, b: 255 });
    expect(L).toBeCloseTo(100, 1);
    expect(a).toBeCloseTo(0, 1);
    expect(b).toBeCloseTo(0, 1);
  });

  it('maps black to (0, 0, 0)', () => {
    const { L, a, b } = rgb2lab({ r: 0, g: 0, b: 0 });
    expect(L).toBeCloseTo(0, 5);
    expect(a).toBeCloseTo(0, 5);
    expect(b).toBeCloseTo(0, 5);
  });

  it('places the cube hues in the expected CIELAB quadrants', () => {
    expect(rgb2lab(hex('#c41e3a')).a).toBeGreaterThan(0); // red  -> +a
    expect(rgb2lab(hex('#1c9c4b')).a).toBeLessThan(0); // green -> -a
    expect(rgb2lab(hex('#ffd500')).b).toBeGreaterThan(0); // yellow -> +b
    expect(rgb2lab(hex('#1d5cc8')).b).toBeLessThan(0); // blue  -> -b
  });
});
