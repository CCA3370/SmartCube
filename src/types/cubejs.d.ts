declare module 'cubejs' {
  /**
   * Minimal type surface for the parts of cubejs we use. cubejs ships no types;
   * this covers cube modeling + the Kociemba two-phase solver.
   */
  export default class Cube {
    constructor(other?: Cube);
    /** Apply a move sequence in standard notation, e.g. "R U R'". */
    move(algorithm: string): Cube;
    /** Current state as a 54-char URFDLB facelet string. */
    asString(): string;
    /** Whether the cube is solved. */
    isSolved(): boolean;
    /** Solve from the current state; returns a maneuver string (<= maxDepth moves). */
    solve(maxDepth?: number): string;

    /** Build a cube from a 54-char URFDLB facelet string. */
    static fromString(facelets: string): Cube;
    /** Precompute the solver's lookup tables (blocks ~4-5s). Call once. */
    static initSolver(): void;
    /** A random solvable cube. */
    static random(): Cube;
    /** A random scramble maneuver string. */
    static scramble(): string;
  }
}

/**
 * cubejs splits the Kociemba solver into a separate module. The package `main`
 * (lib/cube.js) only provides modeling (fromString/random/inverse); importing
 * this side-effect module attaches `initSolver()` and `Cube.prototype.solve()`
 * to the same Cube class. Must be imported alongside the default import.
 */
declare module 'cubejs/lib/solve.js';
