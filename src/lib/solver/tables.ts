/**
 * Staged construction and snapshot/restore of the cubejs Kociemba lookup tables.
 *
 * cubejs exposes `Cube.computeMoveTables(...names)` and
 * `Cube.computePruningTables(...names)`, each of which skips tables that are
 * already built (non-null). `Cube.initSolver()` is just those two called with no
 * args, in one ~4-5s synchronous burst. We instead drive the build one table at
 * a time so the worker can post real progress between steps, and we snapshot the
 * finished tables (plain nested number arrays) for IndexedDB caching.
 *
 * `Cube` is passed in rather than imported here, so this module stays pure and
 * testable without pulling cubejs's `solve.js` side-effect import. All access to
 * cubejs's untyped table internals is confined to this file.
 */

/** Minimal structural view of the cubejs default export we depend on. */
export interface CubejsStatic {
  computeMoveTables(...names: string[]): unknown;
  computePruningTables(...names: string[]): unknown;
  moveTables: Record<string, unknown>;
  pruningTables: Record<string, unknown>;
}

/** A cloneable snapshot of all solver tables (structured-clone / IndexedDB safe). */
export interface SolverTables {
  moveTables: Record<string, unknown>;
  pruningTables: Record<string, unknown>;
}

type BuildStep = {
  kind: 'move' | 'pruning';
  name: string;
  label: string;
  /** Approximate relative cost, so the progress ratio tracks wall-clock time. */
  weight: number;
};

/**
 * Build order: every move table first, then the pruning tables (which read the
 * move tables). `parity` is pre-populated by cubejs as a literal, so it's not a
 * build step. Weights are approximate — the pruning tables are multi-pass BFS
 * over ~1M entries each and dominate, so they carry far more weight than the
 * move tables. The exact numbers don't matter; the ratio just needs to feel
 * honest (no zip-then-stall).
 */
export const BUILD_STEPS: BuildStep[] = [
  { kind: 'move', name: 'twist', label: 'Move tables', weight: 2 },
  { kind: 'move', name: 'flip', label: 'Move tables', weight: 2 },
  { kind: 'move', name: 'FRtoBR', label: 'Move tables', weight: 6 },
  { kind: 'move', name: 'URFtoDLF', label: 'Move tables', weight: 8 },
  { kind: 'move', name: 'URtoDF', label: 'Move tables', weight: 8 },
  { kind: 'move', name: 'URtoUL', label: 'Move tables', weight: 1 },
  { kind: 'move', name: 'UBtoDF', label: 'Move tables', weight: 1 },
  { kind: 'move', name: 'mergeURtoDF', label: 'Move tables', weight: 8 },
  { kind: 'pruning', name: 'sliceTwist', label: 'Solver tables', weight: 60 },
  { kind: 'pruning', name: 'sliceFlip', label: 'Solver tables', weight: 56 },
  { kind: 'pruning', name: 'sliceURFtoDLFParity', label: 'Solver tables', weight: 50 },
  { kind: 'pruning', name: 'sliceURtoDFParity', label: 'Solver tables', weight: 50 },
];

/** Total weight of all build steps (denominator for progress). */
export const TOTAL_WEIGHT = BUILD_STEPS.reduce((sum, s) => sum + s.weight, 0);

/** Build a single table (no-op if cubejs already has it). */
export function buildStep(Cube: CubejsStatic, step: BuildStep): void {
  if (step.kind === 'move') Cube.computeMoveTables(step.name);
  else Cube.computePruningTables(step.name);
}

/** Capture all current move + pruning tables for caching. */
export function snapshotTables(Cube: CubejsStatic): SolverTables {
  return {
    moveTables: { ...Cube.moveTables },
    pruningTables: { ...Cube.pruningTables },
  };
}

/**
 * Rehydrate cubejs's tables from a cached snapshot. Returns true if the snapshot
 * looked complete (every expected table present and non-null) and was applied;
 * false if it was partial/corrupt, in which case nothing is mutated and the
 * caller should fall back to a fresh build.
 */
export function restoreTables(Cube: CubejsStatic, tables: SolverTables | null): boolean {
  if (!tables || !tables.moveTables || !tables.pruningTables) return false;
  const moveOk = BUILD_STEPS.filter((s) => s.kind === 'move').every(
    (s) => tables.moveTables[s.name] != null,
  );
  const pruneOk = BUILD_STEPS.filter((s) => s.kind === 'pruning').every(
    (s) => tables.pruningTables[s.name] != null,
  );
  if (!moveOk || !pruneOk) return false;
  for (const key of Object.keys(tables.moveTables)) {
    Cube.moveTables[key] = tables.moveTables[key];
  }
  for (const key of Object.keys(tables.pruningTables)) {
    Cube.pruningTables[key] = tables.pruningTables[key];
  }
  return true;
}
