import type { Move, Solution, SolverRequest, SolverResponse } from './types';

/** Split a raw solver string like "R U' F2" into individual moves. */
export function parseMoves(raw: string): Move[] {
  return raw.split(/\s+/).filter((m) => m.length > 0);
}

/**
 * Typed client around the solver Web Worker. Owns the request/response
 * correlation (by id) and exposes a promise-based API. The worker hosts cubejs;
 * call `init()` early (e.g. when scanning starts) so the ~4-5s table build
 * overlaps with the user's scanning time and `solve()` is sub-second.
 */
export class SolverClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, { resolve: (s: Solution) => void; reject: (e: Error) => void }>();
  private readyResolvers: Array<() => void> = [];
  private _ready = false;

  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.addEventListener('message', this.onMessage);
  }

  get ready(): boolean {
    return this._ready;
  }

  private onMessage = (ev: MessageEvent<SolverResponse>) => {
    const msg = ev.data;
    switch (msg.type) {
      case 'ready': {
        this._ready = true;
        for (const r of this.readyResolvers) r();
        this.readyResolvers = [];
        return;
      }
      case 'progress':
        return;
      case 'solved': {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          p.resolve({ moves: parseMoves(msg.raw), raw: msg.raw });
        }
        return;
      }
      case 'error': {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          p.reject(new Error(msg.message));
        }
        return;
      }
    }
  };

  /** Kick off table initialization; resolves when the worker reports ready. */
  init(): Promise<void> {
    if (this._ready) return Promise.resolve();
    const p = new Promise<void>((resolve) => this.readyResolvers.push(resolve));
    this.post({ type: 'init' });
    return p;
  }

  /** Solve a 54-char facelet string into a move sequence. */
  solve(facelets: string, maxDepth?: number): Promise<Solution> {
    const id = this.nextId++;
    const p = new Promise<Solution>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.post({ type: 'solve', id, facelets, maxDepth });
    return p;
  }

  dispose() {
    this.worker.removeEventListener('message', this.onMessage);
    this.worker.terminate();
    this.pending.clear();
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
