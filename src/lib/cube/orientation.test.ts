import { describe, it, expect } from 'vitest';
import {
  applyRotation,
  inverseRotation,
  CAPTURE_SEQUENCE,
  buildCubeStateFromLabels,
  type Rotation,
} from './orientation';
import { buildFaceletString, parseFaceletString, SOLVED } from './facelets';
import { type FaceLetter, FACE_ORDER, FACES } from './types';

describe('applyRotation', () => {
  const grid = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  it('rotation 0 is identity', () => {
    expect(applyRotation(grid, 0)).toEqual(grid);
  });
  it('rotation 90 clockwise', () => {
    // top row [0,1,2] becomes right column -> [6,3,0,...]
    expect(applyRotation(grid, 90)).toEqual([6, 3, 0, 7, 4, 1, 8, 5, 2]);
  });
  it('rotation 180', () => {
    expect(applyRotation(grid, 180)).toEqual([8, 7, 6, 5, 4, 3, 2, 1, 0]);
  });
  it('four 90° rotations return to identity', () => {
    let g = grid;
    for (let i = 0; i < 4; i++) g = applyRotation(g, 90);
    expect(g).toEqual(grid);
  });
  it('inverseRotation undoes applyRotation', () => {
    for (const rot of [0, 90, 180, 270] as Rotation[]) {
      expect(applyRotation(applyRotation(grid, rot), inverseRotation(rot))).toEqual(grid);
    }
    // center is always fixed
    for (const rot of [0, 90, 180, 270] as Rotation[]) {
      expect(applyRotation(grid, rot)[4]).toBe(4);
    }
  });
});

describe('facelet build/parse round-trip', () => {
  it('SOLVED parses and rebuilds identically', () => {
    expect(buildFaceletString(parseFaceletString(SOLVED))).toBe(SOLVED);
  });
  it('throws when a center is wrong', () => {
    const bad = parseFaceletString(SOLVED);
    bad.faces.U.labels[4] = 'R';
    expect(() => buildFaceletString(bad)).toThrow(/center/i);
  });
});

// ---------------------------------------------------------------------------
// Independent 3D sticker model (test-only). Derived purely from sticker
// geometry + a rotation matrix, with NO reference to orientation.ts's `rotation`
// constants — so it can falsify them. Coordinate frame: x=right, y=up,
// z=toward the camera. Face normals and the net-up/net-right directions of each
// face in the solved/home orientation:
type V3 = [number, number, number];
const NORMAL: Record<FaceLetter, V3> = {
  U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0],
};
const NET_UP: Record<FaceLetter, V3> = {
  U: [0, 0, -1], R: [0, 1, 0], F: [0, 1, 0], D: [0, 0, 1], L: [0, 1, 0], B: [0, 1, 0],
};
const NET_RIGHT: Record<FaceLetter, V3> = {
  U: [1, 0, 0], R: [0, 0, -1], F: [1, 0, 0], D: [1, 0, 0], L: [0, 0, 1], B: [-1, 0, 0],
};

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];

/** 3D position of a face's sticker at net (row, col), row 0 = top, col 0 = left. */
function stickerPos(face: FaceLetter, row: number, col: number): V3 {
  const base = scale(NORMAL[face], 1.5);
  const up = scale(NET_UP[face], 1 - row);
  const right = scale(NET_RIGHT[face], col - 1);
  return add(add(base, up), right);
}

/**
 * Simulate what the camera sees (screen row-major) for a given hold: rotate the
 * cube so `toCamera` normal -> +z and `up` normal -> +y, then bin the toCamera
 * face's 9 stickers by their rotated screen position.
 */
function simulateCameraView(faceColors: FaceLetter[], toCamera: FaceLetter, up: FaceLetter): FaceLetter[] {
  const nC = NORMAL[toCamera];
  const nU = NORMAL[up];
  const vx = cross(nU, nC); // cube vector that maps to +x
  // Rotation matrix rows map cube vectors to world axes (orthonormal frame).
  const R = (p: V3): V3 => [dot(vx, p), dot(nU, p), dot(nC, p)];

  const screen: FaceLetter[] = new Array(9);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const p = R(stickerPos(toCamera, row, col));
      const sr = 1 - Math.round(p[1]); // +y = top
      const sc = Math.round(p[0]) + 1; // -x = left
      expect(Math.round(p[2])).toBe(2); // 1.5 -> rounds to 2: this is the front face
      screen[sr * 3 + sc] = faceColors[row * 3 + col];
    }
  }
  return screen;
}

const MOVES = ['U', "U'", 'U2', 'D', "D'", 'D2', 'L', "L'", 'L2', 'R', "R'", 'R2', 'F', "F'", 'F2', 'B', "B'", 'B2'];
function randomScramble(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += (i ? ' ' : '') + MOVES[Math.floor(Math.random() * MOVES.length)];
  return s;
}

function faceNetColors(facelets: string, face: FaceLetter): FaceLetter[] {
  const off = FACE_ORDER.indexOf(face) * 9;
  return facelets.slice(off, off + 9).split('') as FaceLetter[];
}

describe('orientation mapping (crown jewel)', () => {
  it('solved cube reconstructs to SOLVED', () => {
    // Each face shown: camera sees 9 of that face color; rotation maps to net.
    const perFace = {} as Record<FaceLetter, FaceLetter[]>;
    for (const step of CAPTURE_SEQUENCE) {
      const screen = simulateCameraView(
        faceNetColors(SOLVED, step.face),
        step.toCamera,
        step.up,
      );
      perFace[step.face] = applyRotation(screen, step.rotation);
    }
    expect(buildFaceletString(buildCubeStateFromLabels(perFace))).toBe(SOLVED);
  });

  it('reconstructs arbitrary scrambles (rotation constants are correct)', async () => {
    const { default: Cube } = await import('cubejs');
    for (let t = 0; t < 25; t++) {
      const scramble = randomScramble(25);
      const cube = new Cube();
      cube.move(scramble);
      const trueFacelets: string = cube.asString();

      const perFace = {} as Record<FaceLetter, FaceLetter[]>;
      for (const step of CAPTURE_SEQUENCE) {
        // The camera sees the face's true colors arranged in screen order.
        const screen = simulateCameraView(
          faceNetColors(trueFacelets, step.face),
          step.toCamera,
          step.up,
        );
        // Production code de-rotates screen -> net.
        perFace[step.face] = applyRotation(screen, step.rotation);
      }
      const reconstructed = buildFaceletString(buildCubeStateFromLabels(perFace));
      expect(reconstructed).toBe(trueFacelets);
    }
  });

  it('every center maps to its own face letter for all holds', () => {
    for (const step of CAPTURE_SEQUENCE) {
      const colors = faceNetColors(SOLVED, step.face); // all === step.face
      const screen = simulateCameraView(colors, step.toCamera, step.up);
      const net = applyRotation(screen, step.rotation);
      expect(net[4]).toBe(step.face);
    }
  });

  it('covers all six faces exactly once', () => {
    const seen = CAPTURE_SEQUENCE.map((s) => s.face).sort();
    expect(seen).toEqual([...FACES].sort());
  });
});
