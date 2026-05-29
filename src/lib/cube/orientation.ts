import { type FaceLetter, type CubeState, type FaceLabels, FACE_ORDER } from './types';

/**
 * Standard Western color scheme (BOY-adjacent), used ONLY for the human-facing
 * hold instructions. The recognition pipeline itself is color-name-agnostic — it
 * classifies relative to whatever the 6 centers actually are.
 */
export const FACE_COLOR_NAME: Record<FaceLetter, string> = {
  U: 'White',
  R: 'Red',
  F: 'Green',
  D: 'Yellow',
  L: 'Orange',
  B: 'Blue',
};

/** Clockwise rotation (degrees) applied to the SCREEN-order grid to get NET order. */
export type Rotation = 0 | 90 | 180 | 270;

export interface CaptureStep {
  face: FaceLetter;
  /** Color the user should point at the camera. */
  toCamera: FaceLetter;
  /** Color the user should keep pointing up. */
  up: FaceLetter;
  rotation: Rotation;
  instruction: string;
}

/**
 * The fixed capture sequence.
 *
 * GEOMETRY / why every rotation is 0
 * ----------------------------------
 * Net-up / net-right directions of each face in the cube frame (x=right, y=up,
 * z=toward camera/front), derived from the standard URFDLB unfolded net:
 *   U: up=-z right=+x   R: up=+y right=-z   F: up=+y right=+x
 *   D: up=+z right=+x   L: up=+y right=+z   B: up=+y right=-x
 *
 * - Side faces (F,R,B,L): held with WHITE up, the named face turned to the
 *   camera by yawing about the vertical (y) axis. White-up keeps world-up = +y =
 *   each side face's net-up, and the straight-on view makes screen-right = the
 *   face's net-right. => screen order already equals net order, rotation 0.
 * - U: tilt the TOP toward the camera (rotate cube +90° about x). U's net-up
 *   (-z) rotates to world-up, net-right (+x) is unchanged => rotation 0. The
 *   face left pointing up is Blue, so the cue is "White to camera, Blue up".
 * - D: tilt the BOTTOM toward the camera (rotate cube -90° about x). D's net-up
 *   (+z) rotates to world-up, net-right (+x) unchanged => rotation 0. Green ends
 *   up on top, so the cue is "Yellow to camera, Green up".
 *
 * The preview is NEVER mirrored (even for a front camera) so that what the user
 * aligns equals the pixels we sample equals net order. If real-world testing
 * ever shows a face is rotated, fix is a single `rotation` value here.
 */
export const CAPTURE_SEQUENCE: CaptureStep[] = [
  { face: 'F', toCamera: 'F', up: 'U', rotation: 0, instruction: 'Point the Green-center side at the camera, with the White-center side up. (Other stickers stay scrambled.)' },
  { face: 'R', toCamera: 'R', up: 'U', rotation: 0, instruction: 'Turn so the Red-center side faces the camera, keeping the White-center side up.' },
  { face: 'B', toCamera: 'B', up: 'U', rotation: 0, instruction: 'Turn so the Blue-center side faces the camera, keeping the White-center side up.' },
  { face: 'L', toCamera: 'L', up: 'U', rotation: 0, instruction: 'Turn so the Orange-center side faces the camera, keeping the White-center side up.' },
  { face: 'U', toCamera: 'U', up: 'B', rotation: 0, instruction: 'Tilt the top toward you: the White-center side faces the camera, the Blue-center side up.' },
  { face: 'D', toCamera: 'D', up: 'F', rotation: 0, instruction: 'Tilt the bottom toward you: the Yellow-center side faces the camera, the Green-center side up.' },
];

// new[i] = old[MAP[i]] — index permutations for rotating a 3x3 grid clockwise.
const ROT_MAP: Record<Rotation, number[]> = {
  0: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  90: [6, 3, 0, 7, 4, 1, 8, 5, 2],
  180: [8, 7, 6, 5, 4, 3, 2, 1, 0],
  270: [2, 5, 8, 1, 4, 7, 0, 3, 6],
};

/** Rotate a 9-element grid (screen row-major) clockwise by `rot` -> net row-major. */
export function applyRotation<T>(cells: T[], rot: Rotation): T[] {
  if (cells.length !== 9) throw new Error(`applyRotation expects 9 cells, got ${cells.length}`);
  const map = ROT_MAP[rot];
  return map.map((src) => cells[src]);
}

/** Inverse rotation (net -> screen); used by tests to simulate the camera view. */
export function inverseRotation(rot: Rotation): Rotation {
  return rot === 90 ? 270 : rot === 270 ? 90 : rot;
}

/** Assemble a CubeState from per-face NET-order label arrays. */
export function buildCubeStateFromLabels(perFace: Record<FaceLetter, FaceLetter[]>): CubeState {
  const faces = {} as Record<FaceLetter, FaceLabels>;
  for (const f of FACE_ORDER) {
    faces[f] = { face: f, labels: perFace[f] };
  }
  return { faces };
}
