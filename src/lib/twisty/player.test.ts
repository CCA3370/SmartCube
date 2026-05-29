import { describe, it, expect } from 'vitest';
import { Alg } from 'cubing/alg';
import { countMoves } from './player';

describe('twisty player helpers', () => {
  it('counts moves in a solution alg', () => {
    expect(countMoves(new Alg("R U R' U'"))).toBe(4);
    expect(countMoves(new Alg(''))).toBe(0);
    expect(countMoves(new Alg('R2 U2 F2'))).toBe(3);
  });

  it('invert trick: inverse of solution applied to solved == scramble origin', () => {
    // The setup-alg is the inverse of the solution. Applying solution after the
    // inverse must cancel to identity (back to solved) — the core guarantee that
    // animating the solution from the scrambled setup ends solved.
    const solution = new Alg("R U R' U' F2 L D'");
    const composed = solution.invert().concat(solution);
    // A simplified concat of an alg and its inverse reduces to nothing.
    expect(composed.experimentalSimplify({ cancel: true }).toString().trim()).toBe('');
  });
});
