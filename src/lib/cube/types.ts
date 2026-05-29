import type { RGB } from '../color/colorspace';

/** The six cube faces, named by the Kociemba face letters. */
export type FaceLetter = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';

/** Facelet-string face order expected by Kociemba/cubejs: U, R, F, D, L, B. */
export const FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

/** Stable list usable as a value (e.g. palette keys, iteration). */
export const FACES: readonly FaceLetter[] = FACE_ORDER;

/**
 * A captured face: 9 sampled RGB colors in NET row-major order — i.e. already
 * de-rotated by `applyRotation` so index 0 is the net top-left of that face.
 * Index 4 is always the center (defines the face's reference color).
 */
export interface FaceCapture {
  face: FaceLetter;
  rgb: RGB[]; // length 9, net order
}

/** Recognized color labels for one face, NET row-major order. */
export interface FaceLabels {
  face: FaceLetter;
  labels: FaceLetter[]; // length 9
  /** Per-sticker confidence (margin to 2nd-nearest center); optional. */
  confidence?: number[];
}

/** The full recognized cube: one FaceLabels per face. */
export interface CubeState {
  faces: Record<FaceLetter, FaceLabels>;
}
