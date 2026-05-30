/// <reference lib="webworker" />
import Cube from 'cubejs';
// cubejs splits the solver out of its main entry: this side-effect import
// attaches Cube.initSolver() and Cube.prototype.solve(). Without it, the package
// default only exposes modeling (fromString/random) and initSolver is undefined.
import 'cubejs/lib/solve.js';
import type { SolverRequest, SolverResponse, SolverProgress } from '../lib/solver/types';
import {
  BUILD_STEPS,
  TOTAL_WEIGHT,
  buildStep,
  snapshotTables,
  restoreTables,
  type CubejsStatic,
} from '../lib/solver/tables';
import { loadTables, saveTables } from '../lib/solver/tableCache';

// Web Worker that hosts the cubejs Kociemba two-phase solver. The lookup tables
// take ~4-5s to build, so the work lives off the main thread and is kicked off
// as soon as the app starts. The build is driven one table at a time so we can
// post real progress, and the finished tables are cached in IndexedDB so repeat
// visits rehydrate near-instantly.

const CubeTables = Cube as unknown as CubejsStatic;

/** A single in-flight init; both `init` and the solve fallback await it. */
let initPromise: Promise<void> | null = null;

function post(msg: SolverResponse) {
  (self as unknown as Worker).postMessage(msg);
}

function postProgress(p: SolverProgress) {
  post({ type: 'progress', ...p });
}

/** Yield to the event loop so a posted progress message can flush to the UI. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// Catch any uncaught errors in the worker and report them instead of letting
// the worker die silently (which would leave init() waiting on the stall timer).
self.addEventListener('error', (ev: ErrorEvent) => {
  post({ type: 'error', id: -1, message: `Worker error: ${ev.message}` });
});

// Heartbeat on load: confirms the worker module imported successfully (a failed
// import — e.g. the cubejs `this.Cube` crash — never reaches this line) and
// resets the client's init stall watchdog the instant the worker is alive.
post({ type: 'progress', done: 0, total: TOTAL_WEIGHT, label: 'Starting', cached: false });

async function buildTables(): Promise<void> {
  // 1. Try the persistent cache first — a hit makes the solver effectively
  //    instant on repeat visits.
  try {
    const cached = await loadTables();
    if (restoreTables(CubeTables, cached)) {
      postProgress({ done: TOTAL_WEIGHT, total: TOTAL_WEIGHT, label: 'Ready', cached: true });
      return;
    }
  } catch {
    // Fall through to fresh build on any cache error.
  }

  // 2. Staged build. Post progress after each table; yield between steps so the
  //    progress message reaches the main thread before the next (blocking) step.
  let done = 0;
  postProgress({ done, total: TOTAL_WEIGHT, label: 'Starting', cached: false });
  for (const step of BUILD_STEPS) {
    buildStep(CubeTables, step);
    done += step.weight;
    postProgress({ done, total: TOTAL_WEIGHT, label: step.label, cached: false });
    await tick();
  }

  // 3. Cache for next time (best-effort; never blocks readiness).
  try {
    void saveTables(snapshotTables(CubeTables));
  } catch {
    // ignore — caching is a pure optimization
  }
}

/** Idempotent: returns the shared init promise, retrying after a prior failure. */
function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = buildTables().catch((e) => {
      // Clear so a later init/solve can retry from scratch.
      initPromise = null;
      throw e;
    });
  }
  return initPromise;
}

self.addEventListener('message', (ev: MessageEvent<SolverRequest>) => {
  const msg = ev.data;
  switch (msg.type) {
    case 'init': {
      ensureInit().then(
        () => post({ type: 'ready' }),
        (e) => post({ type: 'error', id: -1, message: errMsg(e) }),
      );
      return;
    }
    case 'solve': {
      ensureInit().then(
        () => {
          try {
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
        },
        (e) => post({ type: 'error', id: msg.id, message: errMsg(e) }),
      );
      return;
    }
  }
});

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
