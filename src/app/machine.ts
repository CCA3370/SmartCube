import type { FaceLetter, FaceCapture, FaceLabels, ValidationResult } from '../lib/cube';
import type { Solution } from '../lib/solver/types';
import { CAPTURE_SEQUENCE, FACE_ORDER } from '../lib/cube';
import { recognizeCapturedFaces, recognizeCube } from './recognition';

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
}

export type AppEvent =
  | { type: 'START' }
  | { type: 'CAPTURE_FACE'; face: FaceLetter; capture: FaceCapture }
  | { type: 'PREV_FACE' }
  | { type: 'NEXT_FACE' }
  | { type: 'GOTO_REVIEW' }
  | { type: 'EDIT_STICKER'; face: FaceLetter; index: number; color: FaceLetter }
  | { type: 'RESCAN_FACE'; face: FaceLetter }
  | { type: 'SOLVER_READY' }
  | { type: 'SOLVE_OK'; solution: Solution }
  | { type: 'SET_VALIDATION'; result: ValidationResult }
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
};

/**
 * Transition into Review with the DEFINITIVE whole-cube classification: build the
 * 6-color palette from the live centers and re-label all 54 stickers together
 * (`recognizeCube`). Runs once per review entry, so manual `EDIT_STICKER` fixes
 * made while reviewing are preserved. Defensively falls back to just switching
 * screens if (impossibly, from the UI) not all six faces are captured yet.
 */
function toReview(state: AppState): AppState {
  const haveAll = FACE_ORDER.every((f) => state.captures[f]);
  if (!haveAll) return { ...state, screen: 'review' };
  const labels = recognizeCube(state.captures as Record<FaceLetter, FaceCapture>);
  return { ...state, labels, screen: 'review', validation: null };
}

export function reducer(state: AppState, event: AppEvent): AppState {
  switch (event.type) {
    case 'START':
      return { ...initialState, screen: 'scan', solverReady: state.solverReady };

    case 'CAPTURE_FACE': {
      const captures = { ...state.captures, [event.face]: event.capture };
      // The reducer owns the captures -> labels derivation. Re-classify every
      // captured face against the progressive palette, since a newly added live
      // center can shift the labels of faces captured earlier.
      const labels = recognizeCapturedFaces(captures);
      return { ...state, captures, labels, validation: null };
    }

    case 'NEXT_FACE': {
      const allDone = CAPTURE_SEQUENCE.every((s) => state.labels[s.face]);
      if (allDone) return toReview(state);
      for (let k = 1; k <= CAPTURE_SEQUENCE.length; k++) {
        const idx = (state.scanIndex + k) % CAPTURE_SEQUENCE.length;
        if (!state.labels[CAPTURE_SEQUENCE[idx].face]) return { ...state, scanIndex: idx };
      }
      return state;
    }

    case 'PREV_FACE':
      return { ...state, scanIndex: Math.max(0, state.scanIndex - 1) };

    case 'GOTO_REVIEW':
      return toReview(state);

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
      delete captures[event.face];
      // Removing a center changes the progressive palette, so re-derive the
      // remaining faces' labels too.
      const labels = recognizeCapturedFaces(captures);
      return { ...state, captures, labels, screen: 'scan', scanIndex: idx < 0 ? 0 : idx, validation: null };
    }

    case 'SOLVER_READY':
      return { ...state, solverReady: true };

    case 'SET_VALIDATION':
      return { ...state, validation: event.result };

    case 'SOLVE_OK':
      return { ...state, solution: event.solution, screen: 'solve' };

    case 'FINISH':
      return { ...state, screen: 'done' };

    case 'RESTART':
      return { ...initialState, solverReady: state.solverReady };

    default:
      return state;
  }
}
