/** sRGB <-> CIELAB color conversion (D65 white point, 2° observer). */

export interface RGB {
  r: number; // 0..255
  g: number;
  b: number;
}

export interface LAB {
  L: number;
  a: number;
  b: number;
}

/** Inverse sRGB companding: gamma-expand an 8-bit channel to linear [0,1]. */
export function srgbToLinear(c: number): number {
  const cs = c / 255;
  return cs > 0.04045 ? Math.pow((cs + 0.055) / 1.055, 2.4) : cs / 12.92;
}

// D65 reference white (normalized so Y = 1).
const Xn = 0.95047;
const Yn = 1.0;
const Zn = 1.08883;

function fLab(t: number): number {
  // CIE standard: epsilon = 216/24389, kappa = 24389/27
  return t > 0.008856451679035631 ? Math.cbrt(t) : 7.787037037037035 * t + 16 / 116;
}

/** Convert an sRGB color (0..255 channels) to CIELAB under D65. */
export function rgb2lab({ r, g, b }: RGB): LAB {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);

  // Linear sRGB -> CIE XYZ (D65), then normalize by the white point.
  const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / Xn;
  const y = (R * 0.2126729 + G * 0.7151522 + B * 0.072175) / Yn;
  const z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / Zn;

  const fx = fLab(x);
  const fy = fLab(y);
  const fz = fLab(z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}
