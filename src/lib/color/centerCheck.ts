import type { FaceLetter } from '../cube';
import type { RGB } from './colorspace';
import { rgb2lab } from './colorspace';
import { nearestCenter } from './classify';
import { STANDARD_PALETTE } from './palette';

export interface CenterColorReading {
  expected: FaceLetter;
  detected: FaceLetter | null;
  ok: boolean;
  confidence: number;
  sample: RGB | null;
}

export function classifyCenterColor(sample: RGB, expected: FaceLetter): CenterColorReading {
  const { face, best, second } = nearestCenter(rgb2lab(sample), STANDARD_PALETTE);
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
