import { describe, it, expect } from 'vitest';
import Cube from 'cubejs';
import { SOLVED, FACE_OFFSET, CENTER_INDEX, buildFaceletString, parseFaceletString } from './facelets';
import { FACE_ORDER } from './types';

describe('facelet index tables', () => {
  it('each face center sits 4 into its 9-facelet block', () => {
    for (const f of FACE_ORDER) {
      expect(CENTER_INDEX[f]).toBe(FACE_OFFSET[f] + 4);
      expect(SOLVED[CENTER_INDEX[f]]).toBe(f);
    }
  });
});

describe('buildFaceletString / parseFaceletString', () => {
  it('round-trips the solved string', () => {
    expect(buildFaceletString(parseFaceletString(SOLVED))).toBe(SOLVED);
  });

  it('round-trips a real scramble (centers stay fixed in URFDLB)', () => {
    const c = new Cube();
    c.move("R U R' U' F2 L D B'");
    const scramble = c.asString();
    expect(scramble).toHaveLength(54);
    expect(buildFaceletString(parseFaceletString(scramble))).toBe(scramble);
  });

  it('throws when a face center does not match its letter', () => {
    const state = parseFaceletString(SOLVED);
    state.faces.U.labels[4] = 'R';
    expect(() => buildFaceletString(state)).toThrow(/center/);
  });

  it('throws when a face block is not nine labels', () => {
    const state = parseFaceletString(SOLVED);
    state.faces.U.labels = state.faces.U.labels.slice(0, 8);
    expect(() => buildFaceletString(state)).toThrow(/expected 9/);
  });

  it('rejects a string that is not 54 chars', () => {
    expect(() => parseFaceletString('UUU')).toThrow(/54/);
  });
});
