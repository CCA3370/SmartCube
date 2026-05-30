import { type FaceLetter, FACE_ORDER, type CubeState, type FaceLabels } from './types';

/** Solved-cube facelet string in URFDLB order (each face = 9 of its own letter). */
export const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

/** Starting facelet index of each face block within the 54-char string. */
export const FACE_OFFSET: Record<FaceLetter, number> = {
  U: 0,
  R: 9,
  F: 18,
  D: 27,
  L: 36,
  B: 45,
};

/** Index of each face's center facelet (always its own letter). */
export const CENTER_INDEX: Record<FaceLetter, number> = {
  U: 4,
  R: 13,
  F: 22,
  D: 31,
  L: 40,
  B: 49,
};

/**
 * Concatenate the 6 faces' labels (each in NET row-major order) into the
 * 54-char Kociemba facelet string. Asserts each block's center (index 4) equals
 * its own face letter — a cheap guard against an orientation/assembly bug
 * producing a structurally impossible string.
 */
export function buildFaceletString(state: CubeState): string {
  let out = '';
  for (const f of FACE_ORDER) {
    const labels = state.faces[f].labels;
    if (labels.length !== 9) {
      throw new Error(`Face ${f} has ${labels.length} labels (expected 9)`);
    }
    if (labels[4] !== f) {
      throw new Error(`Face ${f} center is ${labels[4]} (expected ${f}); orientation/assembly bug`);
    }
    out += labels.join('');
  }
  return out;
}

/** Parse a 54-char facelet string back into a CubeState (used by tests/fixtures). */
export function parseFaceletString(s: string): CubeState {
  if (s.length !== 54) throw new Error(`Facelet string must be 54 chars, got ${s.length}`);
  const faces = {} as Record<FaceLetter, FaceLabels>;
  for (const f of FACE_ORDER) {
    const start = FACE_OFFSET[f];
    const labels = s.slice(start, start + 9).split('') as FaceLetter[];
    faces[f] = { face: f, labels };
  }
  return { faces };
}
