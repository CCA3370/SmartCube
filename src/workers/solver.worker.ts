/// <reference lib="webworker" />
import Cube from 'cubejs';
// cubejs splits the solver out of its main entry: this side-effect import
// attaches Cube.initSolver() and Cube.prototype.solve(). Without it, the package
// default only exposes modeling (fromString/random) and initSolver is undefined.
import 'cubejs/lib/solve.js';
import type { SolverRequest, SolverResponse } from '../lib/solver/types';

// Web Worker that hosts the cubejs Kociemba two-phase solver. Table init
// (Cube.initSolver) blocks for several seconds, so it lives off the main thread
// and is kicked off as soon as the app starts scanning.

let initialized = false;

function post(msg: SolverResponse) {
  (self as unknown as Worker).postMessage(msg);
}

self.addEventListener('message', (ev: MessageEvent<SolverRequest>) => {
  const msg = ev.data;
  switch (msg.type) {
    case 'init': {
      if (initialized) {
        post({ type: 'ready' });
        return;
      }
      post({ type: 'progress', phase: 'init' });
      try {
        Cube.initSolver();
        initialized = true;
        post({ type: 'ready' });
      } catch (e) {
        post({ type: 'error', id: -1, message: errMsg(e) });
      }
      return;
    }
    case 'solve': {
      try {
        if (!initialized) {
          Cube.initSolver();
          initialized = true;
          post({ type: 'ready' });
        }
        const cube = Cube.fromString(msg.facelets);
        const raw: string = cube.solve(msg.maxDepth ?? 22);
        if (typeof raw !== 'string') {
          post({ type: 'error', id: msg.id, message: 'Solver returned no solution for this state.' });
          return;
        }
        post({ type: 'solved', id: msg.id, raw: raw.trim() });
      } catch (e) {
        post({ type: 'error', id: msg.id, message: errMsg(e) });
      }
      return;
    }
  }
});

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
