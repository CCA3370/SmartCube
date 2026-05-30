import type { SolverTables } from './tables';

/**
 * Persistent cache for the Kociemba lookup tables (cubejs `moveTables` +
 * `pruningTables`). Building them from scratch takes ~4-5s; rehydrating them
 * from IndexedDB is near-instant, so the solver is effectively ready on every
 * visit after the first.
 *
 * The tables are plain nested arrays of numbers, so IndexedDB stores them via
 * the structured-clone algorithm with no JSON (de)serialization. Everything here
 * is feature-detected and fully try/caught: a cache miss, a private-mode block,
 * or a quota error degrades silently to "rebuild from scratch" — the cache is a
 * pure optimization and must never break solving.
 */

// Bump when the cubejs version or the table shape changes, to invalidate stale
// caches. Tied to cubejs@1.1.0 + this snapshot schema.
const CACHE_VERSION = 'cubejs-1.1.0-v1';

const DB_NAME = 'smartcube-solver';
const STORE = 'tables';
const KEY = CACHE_VERSION;

function idb(): IDBFactory | null {
  try {
    // Available on both window and WorkerGlobalScope.
    return typeof indexedDB !== 'undefined' ? indexedDB : null;
  } catch {
    return null;
  }
}

function openDb(): Promise<IDBDatabase | null> {
  const factory = idb();
  if (!factory) return Promise.resolve(null);
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = factory.open(DB_NAME, 1);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

/** Load cached tables for the current version, or null on any miss/error. */
export async function loadTables(): Promise<SolverTables | null> {
  // Timeout the cache load after 2s to avoid blocking init.
  const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));

  const loadPromise = (async () => {
    const db = await openDb();
    if (!db) return null;
    try {
      return await new Promise<SolverTables | null>((resolve) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve((req.result as SolverTables | undefined) ?? null);
        req.onerror = () => resolve(null);
        tx.onerror = () => resolve(null);
      });
    } catch {
      return null;
    } finally {
      db.close();
    }
  })();

  return Promise.race([loadPromise, timeoutPromise]);
}

/** Persist tables for the current version. Best-effort; never throws. */
export async function saveTables(tables: SolverTables): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
      try {
        tx.objectStore(STORE).put(tables, KEY);
      } catch {
        resolve();
      }
    });
  } catch {
    // ignore — caching is best-effort
  } finally {
    db.close();
  }
}
