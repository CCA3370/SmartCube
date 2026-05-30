import { describe, it, expect } from 'vitest';
import { reducer, initialState, type AppState } from './machine';
import { CAPTURE_SEQUENCE, FACE_ORDER, type FaceLetter, type FaceCapture, type FaceLabels } from '../lib/cube';

function cap(face: FaceLetter): FaceCapture {
  return { face, rgb: Array.from({ length: 9 }, () => ({ r: 0, g: 0, b: 0 })) };
}
function lab(face: FaceLetter): FaceLabels {
  return { face, labels: Array.from({ length: 9 }, () => face) };
}

function captureAll(state: AppState): AppState {
  let s = state;
  for (const step of CAPTURE_SEQUENCE) {
    s = reducer(s, { type: 'CAPTURE_FACE', face: step.face, capture: cap(step.face), labels: lab(step.face) });
    s = reducer(s, { type: 'NEXT_FACE' });
  }
  return s;
}

describe('app machine', () => {
  it('START moves to scan', () => {
    const s = reducer(initialState, { type: 'START' });
    expect(s.screen).toBe('scan');
    expect(s.scanIndex).toBe(0);
  });

  it('capturing a face stays on the same scan step until NEXT_FACE', () => {
    let s = reducer(initialState, { type: 'START' });
    s = reducer(s, {
      type: 'CAPTURE_FACE',
      face: CAPTURE_SEQUENCE[0].face,
      capture: cap(CAPTURE_SEQUENCE[0].face),
      labels: lab(CAPTURE_SEQUENCE[0].face),
    });

    expect(s.screen).toBe('scan');
    expect(s.scanIndex).toBe(0);

    s = reducer(s, { type: 'NEXT_FACE' });
    expect(s.scanIndex).toBe(1);
  });

  it('NEXT_FACE goes to review only after all six faces are captured', () => {
    let s = reducer(initialState, { type: 'START' });
    s = captureAll(s);
    expect(s.screen).toBe('review');
    expect(Object.keys(s.labels)).toHaveLength(6);
  });

  it('EDIT_STICKER changes a non-center sticker and clears validation', () => {
    let s = reducer(initialState, { type: 'START' });
    s = captureAll(s);
    s = { ...s, validation: { ok: true, errors: [], suspectFaces: [] } };
    s = reducer(s, { type: 'EDIT_STICKER', face: 'U', index: 0, color: 'R' });
    expect(s.labels.U!.labels[0]).toBe('R');
    expect(s.validation).toBeNull();
  });

  it('EDIT_STICKER cannot change the center', () => {
    let s = reducer(initialState, { type: 'START' });
    s = captureAll(s);
    const before = s.labels.U!.labels[4];
    s = reducer(s, { type: 'EDIT_STICKER', face: 'U', index: 4, color: 'R' });
    expect(s.labels.U!.labels[4]).toBe(before);
  });

  it('SET_RECOGNIZED_LABELS replaces labels with recognition confidence', () => {
    let s = reducer(initialState, { type: 'START' });
    s = captureAll(s);
    const recognized = {} as Record<FaceLetter, FaceLabels>;
    for (const face of FACE_ORDER) {
      recognized[face] = {
        face,
        labels: Array.from({ length: 9 }, () => face),
        confidence: Array.from({ length: 9 }, (_, i) => i / 10),
      };
    }

    s = reducer(s, { type: 'SET_RECOGNIZED_LABELS', labels: recognized });

    expect(s.labels.U!.confidence).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
  });

  it('RESCAN_FACE jumps to that face in scan and clears only that face', () => {
    let s = reducer(initialState, { type: 'START' });
    s = captureAll(s);
    s = reducer(s, { type: 'RESCAN_FACE', face: 'B' });
    expect(s.screen).toBe('scan');
    expect(CAPTURE_SEQUENCE[s.scanIndex].face).toBe('B');
    expect(s.labels.B).toBeUndefined();
    expect(s.captures.B).toBeUndefined();
    expect(Object.keys(s.labels)).toHaveLength(5);
  });

  it('SOLVE_OK transitions to solve with the solution', () => {
    let s = reducer(initialState, { type: 'START' });
    s = captureAll(s);
    s = reducer(s, { type: 'SOLVE_OK', solution: { moves: ['R', "U'"], raw: "R U'" } });
    expect(s.screen).toBe('solve');
    expect(s.solution!.moves).toEqual(['R', "U'"]);
  });

  it('RESTART preserves solverReady', () => {
    let s = { ...initialState, solverReady: true };
    s = reducer(s, { type: 'START' });
    s = reducer(s, { type: 'RESTART' });
    expect(s.screen).toBe('welcome');
    expect(s.solverReady).toBe(true);
  });
});
