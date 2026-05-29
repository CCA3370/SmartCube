import { describe, it, expect } from 'vitest';
import { validate } from './validate';
import { SOLVED } from './facelets';

describe('validate', () => {
  it('accepts the solved cube', () => {
    const r = validate(SOLVED);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('accepts real scrambled states from cubejs', async () => {
    const { default: Cube } = await import('cubejs');
    const moves = ['U', "U'", 'U2', 'D', 'L', 'R', "R'", 'F', 'B2', "L'", 'F2', 'B'];
    for (let t = 0; t < 10; t++) {
      const c = new Cube();
      c.move(moves.map(() => moves[Math.floor(Math.random() * moves.length)]).join(' '));
      const r = validate(c.asString());
      expect(r.ok).toBe(true);
    }
  });

  it('flags wrong length', () => {
    const r = validate('UUU');
    expect(r.ok).toBe(false);
    expect(r.errors[0].kind).toBe('length');
  });

  it('flags a color count error', () => {
    // Turn one U into an extra R: U count 8, R count 10.
    const bad = 'RUUUUUUUU' + 'RRRRRRRRR' + 'FFFFFFFFF' + 'DDDDDDDDD' + 'LLLLLLLLL' + 'BBBBBBBBB';
    const r = validate(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.kind === 'count')).toBe(true);
  });

  it('flags a center mismatch', () => {
    // Swap U center (idx 4) with a non-U letter while keeping counts valid is hard;
    // instead make counts valid but center wrong by swapping two centers' blocks.
    // Build a string where U block center is 'R' but counts stay 9 each:
    // Move U[4] -> R and R[4] -> U (swap centers only).
    const arr = SOLVED.split('');
    arr[4] = 'R'; // U center
    arr[13] = 'U'; // R center
    const r = validate(arr.join(''));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.kind === 'center-mismatch')).toBe(true);
  });

  it('flags edge-flip parity (single edge flipped)', () => {
    // Take solved, flip the UF edge's two stickers (idx 7 = U row, idx 19 = F).
    const arr = SOLVED.split('');
    // UF edge facelets per table: [7, 19]; swap their colors.
    const tmp = arr[7];
    arr[7] = arr[19];
    arr[19] = tmp;
    const r = validate(arr.join(''));
    expect(r.ok).toBe(false);
    // A single flipped edge violates edge-flip parity.
    expect(r.errors.some((e) => e.kind === 'edge-flip-parity' || e.kind === 'piece-undefined')).toBe(true);
  });
});
