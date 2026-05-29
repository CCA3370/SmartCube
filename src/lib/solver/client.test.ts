import { describe, it, expect, beforeAll } from 'vitest';
import Cube from 'cubejs';
import 'cubejs/lib/solve.js';
import { parseMoves } from './client';

describe('parseMoves', () => {
  it('splits a raw solution into moves', () => {
    expect(parseMoves("R U' F2  L2")).toEqual(['R', "U'", 'F2', 'L2']);
  });
  it('handles empty / whitespace', () => {
    expect(parseMoves('   ')).toEqual([]);
    expect(parseMoves('')).toEqual([]);
  });
});

// Exercise the exact cubejs contract the worker depends on: fromString -> solve,
// and verify the solution actually solves the scramble.
describe('cubejs solver contract', () => {
  beforeAll(() => {
    Cube.initSolver();
  });

  it('solves random scrambles and the solution round-trips', () => {
    const moves = ['U', "U'", 'U2', 'D', "D'", 'D2', 'L', "L'", 'L2', 'R', "R'", 'R2', 'F', "F'", 'F2', 'B', "B'", 'B2'];
    for (let t = 0; t < 5; t++) {
      const scramble = Array.from({ length: 22 }, () => moves[Math.floor(Math.random() * moves.length)]).join(' ');
      const c = new Cube();
      c.move(scramble);
      const facelets = c.asString();

      const solution = Cube.fromString(facelets).solve(22);
      expect(typeof solution).toBe('string');
      expect(parseMoves(solution).length).toBeLessThanOrEqual(22);

      const check = new Cube();
      check.move(scramble);
      check.move(solution);
      expect(check.isSolved()).toBe(true);
    }
  });

  it('returns an identity-equivalent solution for an already-solved cube', () => {
    // cubejs does not special-case the solved state, so it may return a
    // non-empty maneuver — but it must still leave the cube solved.
    const c = new Cube();
    const solution = c.solve(22);
    c.move(solution);
    expect(c.isSolved()).toBe(true);
  });
});
