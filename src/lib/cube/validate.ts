import { type FaceLetter, FACES } from './types';
import { CENTER_INDEX } from './facelets';

export type ValidationError =
  | { kind: 'length'; actual: number }
  | { kind: 'count'; color: FaceLetter; actual: number }
  | { kind: 'center-mismatch'; face: FaceLetter; got: FaceLetter }
  | { kind: 'piece-undefined'; pieceType: 'edge' | 'corner' }
  | { kind: 'edge-flip-parity' }
  | { kind: 'corner-twist-parity' }
  | { kind: 'permutation-parity' }
  | { kind: 'solver-rejected'; message: string };

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
  /** Faces the user should re-scan to fix the errors (best-effort). */
  suspectFaces: FaceLetter[];
}

export function describeError(e: ValidationError): string {
  switch (e.kind) {
    case 'length':
      return `Internal error: expected 54 facelets, got ${e.actual}.`;
    case 'count':
      return `Color ${e.color} appears ${e.actual} times (must be exactly 9). Re-scan or correct the affected faces.`;
    case 'center-mismatch':
      return `The ${e.face} face center reads as ${e.got}. Re-scan the ${e.face} face.`;
    case 'piece-undefined':
      return `An impossible ${e.pieceType} was detected (a sticker color combination that can't exist). Check your colors.`;
    case 'edge-flip-parity':
      return `One edge appears flipped — a single sticker is likely misread. Double-check the highlighted stickers.`;
    case 'corner-twist-parity':
      return `One corner appears twisted — a single sticker is likely misread. Double-check the highlighted stickers.`;
    case 'permutation-parity':
      return `Two pieces appear swapped — usually two stickers are mixed up. Double-check your colors.`;
    case 'solver-rejected':
      return `The solver rejected this state: ${e.message}`;
  }
}

// --- Kociemba facelet index tables (URFDLB numbering) ---
// prettier-ignore
const CORNER_FACELET = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
];
// prettier-ignore
const CORNER_COLOR: FaceLetter[][] = [
  ['U', 'R', 'F'], ['U', 'F', 'L'], ['U', 'L', 'B'], ['U', 'B', 'R'],
  ['D', 'F', 'R'], ['D', 'L', 'F'], ['D', 'B', 'L'], ['D', 'R', 'B'],
];
// prettier-ignore
const EDGE_FACELET = [
  [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25],
  [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14],
];
// prettier-ignore
const EDGE_COLOR: FaceLetter[][] = [
  ['U', 'R'], ['U', 'F'], ['U', 'L'], ['U', 'B'], ['D', 'R'], ['D', 'F'],
  ['D', 'L'], ['D', 'B'], ['F', 'R'], ['F', 'L'], ['B', 'L'], ['B', 'R'],
];

function permutationParity(perm: number[]): number {
  let s = 0;
  for (let i = perm.length - 1; i > 0; i--) {
    for (let j = i - 1; j >= 0; j--) {
      if (perm[j] > perm[i]) s++;
    }
  }
  return s % 2;
}

/**
 * Two-stage validation of a 54-char facelet string.
 * Stage 1 (facelet level): length, exactly 9 of each color, centers correct.
 * Stage 2 (cubie level): pieces well-defined, edge-flip/corner-twist sums,
 * and permutation parity — the deep invariants that make a cube physically solvable.
 */
export function validate(facelets: string): ValidationResult {
  const errors: ValidationError[] = [];
  const suspect = new Set<FaceLetter>();

  if (facelets.length !== 54) {
    return { ok: false, errors: [{ kind: 'length', actual: facelets.length }], suspectFaces: [] };
  }

  // Stage 1a: color counts.
  const counts: Record<string, number> = {};
  for (const ch of facelets) counts[ch] = (counts[ch] ?? 0) + 1;
  for (const f of FACES) {
    const c = counts[f] ?? 0;
    if (c !== 9) {
      errors.push({ kind: 'count', color: f, actual: c });
      for (const sf of FACES) suspect.add(sf);
    }
  }

  // Stage 1b: centers must equal their own face letter.
  for (const f of FACES) {
    const got = facelets[CENTER_INDEX[f]] as FaceLetter;
    if (got !== f) {
      errors.push({ kind: 'center-mismatch', face: f, got });
      suspect.add(f);
    }
  }

  // If the facelet-level checks already failed, stop — cubie decoding would be
  // meaningless and could throw.
  if (errors.length > 0) {
    return { ok: false, errors, suspectFaces: [...suspect] };
  }

  // Stage 2: decode into cubie permutation + orientation.
  const cp = new Array(8).fill(-1);
  const co = new Array(8).fill(0);
  for (let i = 0; i < 8; i++) {
    let ori = 0;
    for (; ori < 3; ori++) {
      const ch = facelets[CORNER_FACELET[i][ori]];
      if (ch === 'U' || ch === 'D') break;
    }
    if (ori === 3) {
      errors.push({ kind: 'piece-undefined', pieceType: 'corner' });
      break;
    }
    const col1 = facelets[CORNER_FACELET[i][(ori + 1) % 3]];
    const col2 = facelets[CORNER_FACELET[i][(ori + 2) % 3]];
    let found = -1;
    for (let j = 0; j < 8; j++) {
      if (col1 === CORNER_COLOR[j][1] && col2 === CORNER_COLOR[j][2]) {
        found = j;
        break;
      }
    }
    if (found === -1) {
      errors.push({ kind: 'piece-undefined', pieceType: 'corner' });
      break;
    }
    cp[i] = found;
    co[i] = ori;
  }

  const ep = new Array(12).fill(-1);
  const eo = new Array(12).fill(0);
  for (let i = 0; i < 12; i++) {
    const f0 = facelets[EDGE_FACELET[i][0]];
    const f1 = facelets[EDGE_FACELET[i][1]];
    let found = -1;
    let orient = 0;
    for (let j = 0; j < 12; j++) {
      if (f0 === EDGE_COLOR[j][0] && f1 === EDGE_COLOR[j][1]) {
        found = j;
        orient = 0;
        break;
      }
      if (f0 === EDGE_COLOR[j][1] && f1 === EDGE_COLOR[j][0]) {
        found = j;
        orient = 1;
        break;
      }
    }
    if (found === -1) {
      errors.push({ kind: 'piece-undefined', pieceType: 'edge' });
      break;
    }
    ep[i] = found;
    eo[i] = orient;
  }

  if (errors.some((e) => e.kind === 'piece-undefined')) {
    return { ok: false, errors, suspectFaces: [...FACES] };
  }

  // Each piece must appear exactly once.
  const cornerSeen = new Set(cp);
  const edgeSeen = new Set(ep);
  if (cornerSeen.size !== 8) errors.push({ kind: 'piece-undefined', pieceType: 'corner' });
  if (edgeSeen.size !== 12) errors.push({ kind: 'piece-undefined', pieceType: 'edge' });

  // Orientation sums.
  const coSum = co.reduce((a, b) => a + b, 0);
  if (coSum % 3 !== 0) errors.push({ kind: 'corner-twist-parity' });
  const eoSum = eo.reduce((a, b) => a + b, 0);
  if (eoSum % 2 !== 0) errors.push({ kind: 'edge-flip-parity' });

  // Permutation parity must match between corners and edges.
  if (cornerSeen.size === 8 && edgeSeen.size === 12) {
    if (permutationParity(cp) !== permutationParity(ep)) {
      errors.push({ kind: 'permutation-parity' });
    }
  }

  const ok = errors.length === 0;
  return { ok, errors, suspectFaces: ok ? [] : [...FACES] };
}
