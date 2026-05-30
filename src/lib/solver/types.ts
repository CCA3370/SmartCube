/** A single cube move in standard notation, e.g. "R", "U'", "F2". */
export type Move = string;

export interface Solution {
  /** Individual moves, e.g. ["R", "U'", "F2"]. */
  moves: Move[];
  /** The raw solver output string, e.g. "R U' F2". */
  raw: string;
}

/**
 * Table-build progress. `done`/`total` are WEIGHTED step counts (pruning tables
 * cost far more than move tables), so the ratio tracks real wall-clock progress
 * rather than a naive table count. `label` is a short human-facing stage name.
 * `cached` is true when the tables were rehydrated from IndexedDB (near-instant),
 * so the UI can skip showing a long progress bar.
 */
export interface SolverProgress {
  done: number;
  total: number;
  label: string;
  cached: boolean;
}

// --- Worker message protocol (main thread <-> solver.worker.ts) ---

export type SolverRequest =
  | { type: 'init' }
  | { type: 'solve'; id: number; facelets: string; maxDepth?: number };

export type SolverResponse =
  | { type: 'ready' }
  | ({ type: 'progress' } & SolverProgress)
  | { type: 'solved'; id: number; raw: string }
  | { type: 'error'; id: number; message: string };
