/** A single cube move in standard notation, e.g. "R", "U'", "F2". */
export type Move = string;

export interface Solution {
  /** Individual moves, e.g. ["R", "U'", "F2"]. */
  moves: Move[];
  /** The raw solver output string, e.g. "R U' F2". */
  raw: string;
}

// --- Worker message protocol (main thread <-> solver.worker.ts) ---

export type SolverRequest =
  | { type: 'init' }
  | { type: 'solve'; id: number; facelets: string; maxDepth?: number };

export type SolverResponse =
  | { type: 'ready' }
  | { type: 'progress'; phase: 'init' }
  | { type: 'solved'; id: number; raw: string }
  | { type: 'error'; id: number; message: string };
