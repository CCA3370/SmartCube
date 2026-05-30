import type { MoveFace } from './moves';

export type TeachingOrientation = Record<Exclude<MoveFace, 'unknown'>, Exclude<MoveFace, 'unknown'>>;

export const WHITE_DOWN_ORIENTATION: TeachingOrientation = {
  U: 'D',
  D: 'U',
  F: 'F',
  B: 'B',
  R: 'R',
  L: 'L',
};

const MOVE_RE = /^([UDLRFB])(['2]?)$/;

export function localMoveToGlobal(move: string, orientation: TeachingOrientation): string {
  const trimmed = move.trim();
  const match = MOVE_RE.exec(trimmed);
  if (!match) return trimmed;
  const face = match[1] as Exclude<MoveFace, 'unknown'>;
  return `${orientation[face]}${match[2]}`;
}

export function localAlgorithmToGlobal(algorithm: string, orientation: TeachingOrientation): string[] {
  return algorithm.split(/\s+/).filter(Boolean).map((move) => localMoveToGlobal(move, orientation));
}
