import { describe, it, expect, beforeAll, vi } from 'vitest';
import Cube from 'cubejs';
import 'cubejs/lib/solve.js';
import { parseMoves, SolverClient } from './client';
import type { SolverRequest, SolverResponse } from './types';

describe('parseMoves', () => {
  it('splits a raw solution into moves', () => {
    expect(parseMoves("R U' F2  L2")).toEqual(['R', "U'", 'F2', 'L2']);
  });
  it('handles empty / whitespace', () => {
    expect(parseMoves('   ')).toEqual([]);
    expect(parseMoves('')).toEqual([]);
  });
});

// Exercise the exact cubejs contract the worker depends on: fromString -> solve,
// and verify the solution actually solves the scramble.
describe('cubejs solver contract', () => {
  beforeAll(() => {
    Cube.initSolver();
  });

  it('solves random scrambles and the solution round-trips', () => {
    const moves = ['U', "U'", 'U2', 'D', "D'", 'D2', 'L', "L'", 'L2', 'R', "R'", 'R2', 'F', "F'", 'F2', 'B', "B'", 'B2'];
    for (let t = 0; t < 5; t++) {
      const scramble = Array.from({ length: 22 }, () => moves[Math.floor(Math.random() * moves.length)]).join(' ');
      const c = new Cube();
      c.move(scramble);
      const facelets = c.asString();

      const solution = Cube.fromString(facelets).solve(22);
      expect(typeof solution).toBe('string');
      expect(parseMoves(solution).length).toBeLessThanOrEqual(22);

      const check = new Cube();
      check.move(scramble);
      check.move(solution);
      expect(check.isSolved()).toBe(true);
    }
  });

  it('returns an identity-equivalent solution for an already-solved cube', () => {
    // cubejs does not special-case the solved state, so it may return a
    // non-empty maneuver — but it must still leave the cube solved.
    const c = new Cube();
    const solution = c.solve(22);
    c.move(solution);
    expect(c.isSolved()).toBe(true);
  });
});

// A minimal stand-in for the solver Web Worker: records posted messages and lets
// the test emit worker responses / a fatal error. Exercises the SolverClient's
// request/response correlation and its failure handling without a real worker.
class FakeWorker extends EventTarget {
  posted: SolverRequest[] = [];
  terminated = false;
  postMessage(msg: SolverRequest) {
    this.posted.push(msg);
  }
  terminate() {
    this.terminated = true;
  }
  emit(data: SolverResponse) {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }
  emitError(message?: string) {
    let ev: Event;
    try {
      ev = new ErrorEvent('error', { message });
    } catch {
      ev = new Event('error');
    }
    this.dispatchEvent(ev);
  }
  lastSolveId(): number {
    for (let i = this.posted.length - 1; i >= 0; i--) {
      const m = this.posted[i];
      if (m.type === 'solve') return m.id;
    }
    throw new Error('no solve request was posted');
  }
}

describe('SolverClient', () => {
  function setup() {
    const fake = new FakeWorker();
    const client = new SolverClient(fake as unknown as Worker);
    return { fake, client };
  }

  it('resolves init() when the worker reports ready', async () => {
    const { fake, client } = setup();
    const p = client.init();
    expect(fake.posted).toContainEqual({ type: 'init' });
    fake.emit({ type: 'ready' });
    await expect(p).resolves.toBeUndefined();
    expect(client.ready).toBe(true);
  });

  it('correlates a solve response by id and parses the moves', async () => {
    const { fake, client } = setup();
    const p = client.solve('does-not-matter-to-the-fake');
    const id = fake.lastSolveId();
    fake.emit({ type: 'solved', id, raw: "R U' F2" });
    await expect(p).resolves.toEqual({ moves: ['R', "U'", 'F2'], raw: "R U' F2" });
  });

  it('rejects a solve on an error response for its id', async () => {
    const { fake, client } = setup();
    const p = client.solve('x');
    fake.emit({ type: 'error', id: fake.lastSolveId(), message: 'unsolvable' });
    await expect(p).rejects.toThrow('unsolvable');
  });

  it('rejects init() on an init-phase error (worker uses id -1)', async () => {
    const { fake, client } = setup();
    const p = client.init();
    fake.emit({ type: 'error', id: -1, message: 'table build failed' });
    await expect(p).rejects.toThrow('table build failed');
  });

  it('rejects a solve that never gets a response (timeout)', async () => {
    vi.useFakeTimers();
    try {
      const { client } = setup();
      const p = client.solve('x');
      const assertion = expect(p).rejects.toThrow(/timed out/);
      await vi.advanceTimersByTimeAsync(15000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects all pending init/solve work when the worker crashes', async () => {
    const { fake, client } = setup();
    const initP = client.init();
    const solveP = client.solve('x');
    fake.emitError('boom');
    await expect(initP).rejects.toThrow(/crashed/);
    await expect(solveP).rejects.toThrow(/crashed/);
  });

  it('forwards progress messages via onProgress callback', async () => {
    const { fake, client } = setup();
    const progress: unknown[] = [];
    client.onProgress((p) => progress.push(p));
    client.init();
    fake.emit({ type: 'progress', done: 5, total: 10, label: 'Building', cached: false });
    fake.emit({ type: 'progress', done: 10, total: 10, label: 'Ready', cached: false });
    fake.emit({ type: 'ready' });
    await vi.waitFor(() => expect(progress).toHaveLength(2));
    expect(progress[0]).toEqual({ done: 5, total: 10, label: 'Building', cached: false });
    expect(progress[1]).toEqual({ done: 10, total: 10, label: 'Ready', cached: false });
  });

  it('rejects init if no progress arrives within the stall timeout', async () => {
    vi.useFakeTimers();
    try {
      const { client } = setup();
      const p = client.init();
      const assertion = expect(p).rejects.toThrow(/stalled/);
      await vi.advanceTimersByTimeAsync(20000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('resets the stall timer on each progress message', async () => {
    vi.useFakeTimers();
    try {
      const { fake, client } = setup();
      const p = client.init();
      // Advance 15s, post progress (resets the timer), advance another 15s, then ready.
      await vi.advanceTimersByTimeAsync(15000);
      fake.emit({ type: 'progress', done: 5, total: 10, label: 'Building', cached: false });
      await vi.advanceTimersByTimeAsync(15000);
      fake.emit({ type: 'ready' });
      await expect(p).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('duplicate init() calls attach to the same in-flight request', async () => {
    const { fake, client } = setup();
    const p1 = client.init();
    const p2 = client.init();
    expect(fake.posted.filter((m) => m.type === 'init')).toHaveLength(1);
    fake.emit({ type: 'ready' });
    await expect(p1).resolves.toBeUndefined();
    await expect(p2).resolves.toBeUndefined();
  });

  it('allows retry after an init error', async () => {
    const { fake, client } = setup();
    const p1 = client.init();
    fake.emit({ type: 'error', id: -1, message: 'first attempt failed' });
    await expect(p1).rejects.toThrow('first attempt failed');
    // Retry should post a fresh init.
    const p2 = client.init();
    expect(fake.posted.filter((m) => m.type === 'init')).toHaveLength(2);
    fake.emit({ type: 'ready' });
    await expect(p2).resolves.toBeUndefined();
  });
});
