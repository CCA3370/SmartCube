import { describe, it, expect } from 'vitest';
import Cube from 'cubejs';
import 'cubejs/lib/solve.js';
import {
  BUILD_STEPS,
  buildStep,
  snapshotTables,
  restoreTables,
  type CubejsStatic,
} from './tables';

const CubeTables = Cube as unknown as CubejsStatic;

describe('staged table build', () => {
  it('building one table at a time produces the same result as initSolver()', () => {
    // Build via the staged path.
    for (const step of BUILD_STEPS) {
      buildStep(CubeTables, step);
    }
    const staged = snapshotTables(CubeTables);

    // Reset and build via the one-shot path.
    for (const key of Object.keys(CubeTables.moveTables)) {
      if (key !== 'parity') CubeTables.moveTables[key] = null;
    }
    for (const key of Object.keys(CubeTables.pruningTables)) {
      CubeTables.pruningTables[key] = null;
    }
    Cube.initSolver();
    const oneShot = snapshotTables(CubeTables);

    // Both should produce identical tables.
    expect(staged).toEqual(oneShot);
  });

  it('snapshot → reset → restore still solves correctly', () => {
    // Ensure tables are built.
    Cube.initSolver();
    const snapshot = snapshotTables(CubeTables);

    // Reset all tables to null.
    for (const key of Object.keys(CubeTables.moveTables)) {
      if (key !== 'parity') CubeTables.moveTables[key] = null;
    }
    for (const key of Object.keys(CubeTables.pruningTables)) {
      CubeTables.pruningTables[key] = null;
    }

    // Restore from snapshot.
    const ok = restoreTables(CubeTables, snapshot);
    expect(ok).toBe(true);

    // Verify the restored tables can solve a scramble.
    const scramble = 'R U R\' U\' F2 D L2 B2 U\' R2 D\' F2 U B2 U2 L\' F D\' R\' B';
    const c = new Cube();
    c.move(scramble);
    const solution = c.solve(22);
    expect(typeof solution).toBe('string');
    c.move(solution);
    expect(c.isSolved()).toBe(true);
  });

  it('restoreTables rejects incomplete snapshots', () => {
    const partial = { moveTables: { twist: [] }, pruningTables: {} };
    const ok = restoreTables(CubeTables, partial);
    expect(ok).toBe(false);
  });
});
