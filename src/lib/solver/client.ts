import type { Move, Solution, SolverRequest, SolverResponse } from './types';

/** Reject a solve if the worker hasn't answered within this long (covers a stuck worker). */
const SOLVE_TIMEOUT_MS = 15000;

/** Split a raw solver string like "R U' F2" into individual moves. */
export function parseMoves(raw: string): Move[] {
  return raw.split(/\s+/).filter((m) => m.length > 0);
}

interface PendingSolve {
  resolve: (s: Solution) => void;
  reject: (e: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface ReadyWaiter {
  resolve: () => void;
  reject: (e: Error) => void;
}

/**
 * Typed client around the solver Web Worker. Owns the request/response
 * correlation (by id) and exposes a promise-based API. The worker hosts cubejs;
 * call `init()` early (e.g. when scanning starts) so the ~4-5s table build
 * overlaps with the user's scanning time and `solve()` is sub-second.
 *
 * Every promise is guaranteed to settle: a per-solve timeout, the worker's own
 * `error`/`messageerror` events, and an init-phase error (the worker reports
 * init failures with id -1) all reject the relevant pending promises instead of
 * leaving them hanging.
 */
export class SolverClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, PendingSolve>();
  private readyWaiters: ReadyWaiter[] = [];
  private _ready = false;

  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.addEventListener('message', this.onMessage);
    this.worker.addEventListener('error', this.onFatal);
    this.worker.addEventListener('messageerror', this.onFatal);
  }

  get ready(): boolean {
    return this._ready;
  }

  private onMessage = (ev: MessageEvent<SolverResponse>) => {
    const msg = ev.data;
    switch (msg.type) {
      case 'ready': {
        this._ready = true;
        const waiters = this.readyWaiters;
        this.readyWaiters = [];
        for (const w of waiters) w.resolve();
        return;
      }
      case 'progress':
        return;
      case 'solved': {
        const p = this.pending.get(msg.id);
        if (p) {
          clearTimeout(p.timeout);
          this.pending.delete(msg.id);
          p.resolve({ moves: parseMoves(msg.raw), raw: msg.raw });
        }
        return;
      }
      case 'error': {
        const p = this.pending.get(msg.id);
        if (p) {
          clearTimeout(p.timeout);
          this.pending.delete(msg.id);
          p.reject(new Error(msg.message));
          return;
        }
        // No pending solve owns this id (the worker uses id -1 for init-phase
        // failures): treat it as an init error and reject anyone awaiting ready.
        this.rejectReadyWaiters(new Error(msg.message));
        return;
      }
    }
  };

  /** Worker crashed (uncaught throw, failed import, structured-clone failure). */
  private onFatal = (ev: Event) => {
    const detail = ev instanceof ErrorEvent && ev.message ? `: ${ev.message}` : '';
    this.rejectAll(new Error(`Solver worker crashed${detail}`));
  };

  private rejectReadyWaiters(err: Error) {
    const waiters = this.readyWaiters;
    this.readyWaiters = [];
    for (const w of waiters) w.reject(err);
  }

  private rejectAll(err: Error) {
    for (const p of this.pending.values()) {
      clearTimeout(p.timeout);
      p.reject(err);
    }
    this.pending.clear();
    this.rejectReadyWaiters(err);
  }

  /** Kick off table initialization; resolves when the worker reports ready. */
  init(): Promise<void> {
    if (this._ready) return Promise.resolve();
    const p = new Promise<void>((resolve, reject) => {
      this.readyWaiters.push({ resolve, reject });
    });
    this.post({ type: 'init' });
    return p;
  }

  /** Solve a 54-char facelet string into a move sequence. */
  solve(facelets: string, maxDepth?: number): Promise<Solution> {
    const id = this.nextId++;
    return new Promise<Solution>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error('Solver timed out'));
      }, SOLVE_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timeout });
      this.post({ type: 'solve', id, facelets, maxDepth });
    });
  }

  dispose() {
    this.worker.removeEventListener('message', this.onMessage);
    this.worker.removeEventListener('error', this.onFatal);
    this.worker.removeEventListener('messageerror', this.onFatal);
    this.worker.terminate();
    this.rejectAll(new Error('Solver disposed'));
  }

  private post(msg: SolverRequest) {
    this.worker.postMessage(msg);
  }
}

/** Construct a SolverClient backed by the bundled solver worker. */
export function createSolverClient(): SolverClient {
  const worker = new Worker(new URL('../../workers/solver.worker.ts', import.meta.url), {
    type: 'module',
  });
  return new SolverClient(worker);
}
