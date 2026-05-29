import { FACE_ORDER, type FaceLetter } from '../cube';
import type { RGB } from './colorspace';
import { rgb2lab } from './colorspace';
import { nearestCenter, type CenterPalette } from './classify';

export interface CenterColorReading {
  expected: FaceLetter;
  detected: FaceLetter | null;
  ok: boolean;
  confidence: number;
  sample: RGB | null;
}

function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const value = Number.parseInt(clean, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

const REFERENCE_COLORS: Record<FaceLetter, string> = {
  U: '#f8f8f8',
  R: '#c41e3a',
  F: '#1c9c4b',
  D: '#ffd500',
  L: '#ff7a1a',
  B: '#1d5cc8',
};

const REFERENCE_PALETTE: CenterPalette = FACE_ORDER.reduce((palette, face) => {
  palette[face] = rgb2lab(hexToRgb(REFERENCE_COLORS[face]));
  return palette;
}, {} as CenterPalette);

export function classifyCenterColor(sample: RGB, expected: FaceLetter): CenterColorReading {
  const { face, best, second } = nearestCenter(rgb2lab(sample), REFERENCE_PALETTE);
  return {
    expected,
    detected: face,
    ok: face === expected,
    confidence: second - best,
    sample,
  };
}

export function emptyCenterColorReading(expected: FaceLetter): CenterColorReading {
  return {
    expected,
    detected: null,
    ok: false,
    confidence: 0,
    sample: null,
  };
}
