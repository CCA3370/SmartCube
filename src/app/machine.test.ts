import { describe, it, expect } from 'vitest';
import { reducer, initialState, type AppState } from './machine';
import { CAPTURE_SEQUENCE, FACE_ORDER, type FaceLetter, type FaceCapture } from '../lib/cube';
import { DISPLAY_COLOR } from '../lib/color';

function hexToRgb(hex: string) {
  const v = Number.parseInt(hex.replace('#', ''), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

/** A solved face: all 9 stickers painted that face's standard color. */
function cap(face: FaceLetter): FaceCapture {
  const c = hexToRgb(DISPLAY_COLOR[face]);
  return { face, rgb: Array.from({ length: 9 }, () => ({ ...c })) };
}

function captureAll(state: AppState): AppState {
  let s = state;
  for (const step of CAPTURE_SEQUENCE) {
    s = reducer(s, { type: 'CAPTURE_FACE', face: step.face, capture: cap(step.face) });
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
    });

    expect(s.screen).toBe('scan');
    expect(s.scanIndex).toBe(0);

    s = reducer(s, { type: 'NEXT_FACE' });
    expect(s.scanIndex).toBe(1);
  });

  it('CAPTURE_FACE derives provisional labels for every captured face', () => {
    let s = reducer(initialState, { type: 'START' });
    s = reducer(s, { type: 'CAPTURE_FACE', face: 'F', capture: cap('F') });
    expect(s.labels.F?.labels).toEqual(Array(9).fill('F'));

    // A second capture re-derives all captured faces against the progressive palette.
    s = reducer(s, { type: 'CAPTURE_FACE', face: 'R', capture: cap('R') });
    expect(s.labels.R?.labels).toEqual(Array(9).fill('R'));
    expect(s.labels.F?.labels).toEqual(Array(9).fill('F'));
  });

  it('NEXT_FACE goes to review only after all six faces are captured', () => {
    let s = reducer(initialState, { type: 'START' });
    s = captureAll(s);
    expect(s.screen).toBe('review');
    expect(Object.keys(s.labels)).toHaveLength(6);
  });

  it('entering review runs the definitive whole-cube recognition', () => {
    let s = reducer(initialState, { type: 'START' });
    s = captureAll(s);
    expect(s.screen).toBe('review');
    for (const f of FACE_ORDER) {
      expect(s.labels[f]?.labels).toEqual(Array(9).fill(f));
      expect(s.labels[f]?.confidence).toHaveLength(9);
    }
  });

  it('GOTO_REVIEW also triggers the definitive recognition', () => {
    let s = reducer(initialState, { type: 'START' });
    for (const step of CAPTURE_SEQUENCE) {
      s = reducer(s, { type: 'CAPTURE_FACE', face: step.face, capture: cap(step.face) });
    }
    s = reducer(s, { type: 'GOTO_REVIEW' });
    expect(s.screen).toBe('review');
    expect(s.labels.U?.confidence).toHaveLength(9);
    expect(s.labels.U?.labels).toEqual(Array(9).fill('U'));
  });

  it('EDIT_STICKER changes a non-center sticker and clears validation', () => {
    let s = reducer(initialState, { type: 'START' });
    s = captureAll(s);
    s = { ...s, validation: { ok: true, errors: [], suspectFaces: [] } };
    s = reducer(s, { type: 'EDIT_STICKER', face: 'U', index: 0, color: 'R' });
    expect(s.labels.U!.labels[0]).toBe('R');
    expect(s.validation).toBeNull();
  });

  it('EDIT_STICKER edits survive subsequent non-recognition events', () => {
    let s = reducer(initialState, { type: 'START' });
    s = captureAll(s);
    s = reducer(s, { type: 'EDIT_STICKER', face: 'U', index: 0, color: 'R' });
    // A later edit on another face must not clobber the first.
    s = reducer(s, { type: 'EDIT_STICKER', face: 'F', index: 1, color: 'D' });
    expect(s.labels.U!.labels[0]).toBe('R');
    expect(s.labels.F!.labels[1]).toBe('D');
  });

  it('EDIT_STICKER cannot change the center', () => {
    let s = reducer(initialState, { type: 'START' });
    s = captureAll(s);
    const before = s.labels.U!.labels[4];
    s = reducer(s, { type: 'EDIT_STICKER', face: 'U', index: 4, color: 'R' });
    expect(s.labels.U!.labels[4]).toBe(before);
  });

  it('RESCAN_FACE clears only that face and re-derives the remaining ones', () => {
    let s = reducer(initialState, { type: 'START' });
    s = captureAll(s);
    s = reducer(s, { type: 'RESCAN_FACE', face: 'B' });
    expect(s.screen).toBe('scan');
    expect(CAPTURE_SEQUENCE[s.scanIndex].face).toBe('B');
    expect(s.labels.B).toBeUndefined();
    expect(s.captures.B).toBeUndefined();
    expect(Object.keys(s.labels)).toHaveLength(5);
    // Remaining faces are still labeled (re-derived from the surviving captures).
    for (const f of FACE_ORDER) {
      if (f === 'B') continue;
      expect(s.labels[f]?.labels).toEqual(Array(9).fill(f));
    }
  });

  it('SOLVE_OK transitions to solve with the solution', () => {
    let s = reducer(initialState, { type: 'START' });
    s = captureAll(s);
    s = reducer(s, { type: 'SOLVE_OK', solution: { moves: ['R', "U'"], raw: "R U'" }, sourceFacelets: 'source' });
    expect(s.screen).toBe('solve');
    expect(s.solution!.moves).toEqual(['R', "U'"]);
    expect(s.sourceFacelets).toBe('source');
  });

  it('LEARN_OK transitions to learn with the beginner learning plan', () => {
    const plan = {
      method: 'lbl' as const,
      sourceFacelets: 'source',
      stages: [],
      physicalMoves: [],
      createdAt: 1,
    };

    const s = reducer(initialState, { type: 'LEARN_OK', plan });

    expect(s.screen).toBe('learn');
    expect(s.learningPlan).toBe(plan);
    expect(s.sourceFacelets).toBe('source');
    expect(s.learningError).toBeNull();
  });

  it('LEARN_ERROR stays on review and exposes a fallback message', () => {
    const s = reducer({ ...initialState, screen: 'review' }, { type: 'LEARN_ERROR', message: 'No beginner path' });

    expect(s.screen).toBe('review');
    expect(s.learningPlan).toBeNull();
    expect(s.learningError).toBe('No beginner path');
  });

  it('RESTART preserves solverReady and solverProgress', () => {
    const initial: AppState = {
      ...initialState,
      solverReady: true,
      solverProgress: { done: 10, total: 10, label: 'Ready', cached: true },
    };
    let s = reducer(initial, { type: 'START' });
    s = reducer(s, { type: 'RESTART' });
    expect(s.screen).toBe('welcome');
    expect(s.solverReady).toBe(true);
    expect(s.solverProgress).toEqual({ done: 10, total: 10, label: 'Ready', cached: true });
  });
});
