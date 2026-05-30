import { FACE_ORDER, type FaceLetter } from '../cube';
import { rgb2lab, type RGB } from './colorspace';
import type { CenterPalette } from './classify';

/**
 * The standard Western color scheme: display hex per face. Single source for both
 * the UI swatches AND the illuminant-independent fallback palette used before the
 * 6 live centers are known (provisional scanning + center-color gating).
 */
export const DISPLAY_COLOR: Record<FaceLetter, string> = {
  U: '#f8f8f8', // white
  R: '#c41e3a', // red
  F: '#1c9c4b', // green
  D: '#ffd500', // yellow
  L: '#ff7a1a', // orange
  B: '#1d5cc8', // blue
};

export function hexToRgb(hex: string): RGB {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/** The standard scheme as a CIELAB center palette. */
export const STANDARD_PALETTE: CenterPalette = FACE_ORDER.reduce((palette, face) => {
  palette[face] = rgb2lab(hexToRgb(DISPLAY_COLOR[face]));
  return palette;
}, {} as CenterPalette);
