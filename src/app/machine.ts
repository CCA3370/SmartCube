import type { FaceLetter, FaceCapture, FaceLabels, ValidationResult } from '../lib/cube';
import type { Solution } from '../lib/solver/types';
import { CAPTURE_SEQUENCE } from '../lib/cube';

export type Screen = 'welcome' | 'scan' | 'review' | 'solve' | 'done';

export interface AppState {
  screen: Screen;
  /** Index into CAPTURE_SEQUENCE (0..5). */
  scanIndex: number;
  /** Captured RGB faces, keyed by face. */
  captures: Partial<Record<FaceLetter, FaceCapture>>;
  /** Recognized labels per face (editable in review). */
  labels: Partial<Record<FaceLetter, FaceLabels>>;
  validation: ValidationResult | null;
  solution: Solution | null;
  solverReady: boolean;
  solving: boolean;
  stepIndex: number;
  error: string | null;
}

export type AppEvent =
  | { type: 'START' }
  | { type: 'CAPTURE_FACE'; face: FaceLetter; capture: FaceCapture; labels: FaceLabels }
  | { type: 'PREV_FACE' }
  | { type: 'NEXT_FACE' }
  | { type: 'GOTO_REVIEW' }
  | { type: 'SET_RECOGNIZED_LABELS'; labels: Partial<Record<FaceLetter, FaceLabels>> }
  | { type: 'EDIT_STICKER'; face: FaceLetter; index: number; color: FaceLetter }
  | { type: 'RESCAN_FACE'; face: FaceLetter }
  | { type: 'SOLVER_READY' }
  | { type: 'SOLVE_START' }
  | { type: 'SOLVE_OK'; solution: Solution }
  | { type: 'VALIDATION_FAILED'; result: ValidationResult }
  | { type: 'SOLVE_ERROR'; message: string }
  | { type: 'SET_VALIDATION'; result: ValidationResult }
  | { type: 'STEP_TO'; index: number }
  | { type: 'FINISH' }
  | { type: 'RESTART' };

export const initialState: AppState = {
  screen: 'welcome',
  scanIndex: 0,
  captures: {},
  labels: {},
  validation: null,
  solution: null,
  solverReady: false,
  solving: false,
  stepIndex: 0,
  error: null,
};

export function reducer(state: AppState, event: AppEvent): AppState {
  switch (event.type) {
    case 'START':
      return { ...initialState, screen: 'scan', solverReady: state.solverReady };

    case 'CAPTURE_FACE': {
      const captures = { ...state.captures, [event.face]: event.capture };
      const labels = { ...state.labels, [event.face]: event.labels };
      return { ...state, captures, labels, validation: null };
    }

    case 'NEXT_FACE': {
      const allDone = CAPTURE_SEQUENCE.every((s) => state.labels[s.face]);
      if (allDone) return { ...state, screen: 'review' };
      for (let k = 1; k <= CAPTURE_SEQUENCE.length; k++) {
        const idx = (state.scanIndex + k) % CAPTURE_SEQUENCE.length;
        if (!state.labels[CAPTURE_SEQUENCE[idx].face]) return { ...state, scanIndex: idx };
      }
      return state;
    }

    case 'PREV_FACE':
      return { ...state, scanIndex: Math.max(0, state.scanIndex - 1) };

    case 'GOTO_REVIEW':
      return { ...state, screen: 'review' };

    case 'SET_RECOGNIZED_LABELS':
      return { ...state, labels: { ...state.labels, ...event.labels }, validation: null };

    case 'EDIT_STICKER': {
      const fl = state.labels[event.face];
      if (!fl) return state;
      // Center (index 4) is locked — it defines the face.
      if (event.index === 4) return state;
      const newLabels = fl.labels.slice();
      newLabels[event.index] = event.color;
      return {
        ...state,
        labels: { ...state.labels, [event.face]: { ...fl, labels: newLabels } },
        validation: null,
      };
    }

    case 'RESCAN_FACE': {
      const idx = CAPTURE_SEQUENCE.findIndex((s) => s.face === event.face);
      const captures = { ...state.captures };
      const labels = { ...state.labels };
      delete captures[event.face];
      delete labels[event.face];
      return { ...state, captures, labels, screen: 'scan', scanIndex: idx < 0 ? 0 : idx, validation: null };
    }

    case 'SOLVER_READY':
      return { ...state, solverReady: true };

    case 'SOLVE_START':
      return { ...state, solving: true, error: null };

    case 'SET_VALIDATION':
      return { ...state, validation: event.result };

    case 'VALIDATION_FAILED':
      return { ...state, solving: false, validation: event.result };

    case 'SOLVE_OK':
      return {
        ...state,
        solving: false,
        solution: event.solution,
        stepIndex: 0,
        screen: 'solve',
      };

    case 'SOLVE_ERROR':
      return { ...state, solving: false, error: event.message };

    case 'STEP_TO':
      return { ...state, stepIndex: event.index };

    case 'FINISH':
      return { ...state, screen: 'done' };

    case 'RESTART':
      return { ...initialState, solverReady: state.solverReady };

    default:
      return state;
  }
}
