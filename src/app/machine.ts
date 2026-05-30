import type { FaceLetter, FaceCapture, FaceLabels, ValidationResult } from '../lib/cube';
import type { Solution, SolverProgress } from '../lib/solver/types';
import type { LearningPlan } from '../lib/learning/types';
import { CAPTURE_SEQUENCE, FACE_ORDER } from '../lib/cube';
import { recognizeCapturedFaces, recognizeCube } from './recognition';

export type Screen = 'welcome' | 'scan' | 'review' | 'solve' | 'learn' | 'done';

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
  sourceFacelets: string | null;
  learningPlan: LearningPlan | null;
  learningError: string | null;
  solverReady: boolean;
  /** Latest table-build progress (for the progress bar), or null before any. */
  solverProgress: SolverProgress | null;
  /** Set if solver init failed; surfaced with a Retry affordance. */
  solverError: string | null;
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
  | { type: 'SOLVER_PROGRESS'; progress: SolverProgress }
  | { type: 'SOLVER_ERROR'; message: string }
  | { type: 'SOLVER_RETRY' }
  | { type: 'SOLVE_OK'; solution: Solution; sourceFacelets?: string }
  | { type: 'LEARN_OK'; plan: LearningPlan }
  | { type: 'LEARN_ERROR'; message: string }
  | { type: 'LEARN_RESTART' }
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
  sourceFacelets: null,
  learningPlan: null,
  learningError: null,
  solverReady: false,
  solverProgress: null,
  solverError: null,
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
      return {
        ...initialState,
        screen: 'scan',
        solverReady: state.solverReady,
        solverProgress: state.solverProgress,
      };

    case 'CAPTURE_FACE': {
      const captures = { ...state.captures, [event.face]: event.capture };
      // The reducer owns the captures -> labels derivation. Re-classify every
      // captured face against the progressive palette, since a newly added live
      // center can shift the labels of faces captured earlier.
      const labels = recognizeCapturedFaces(captures);
      const nextState = { ...state, captures, labels, validation: null };
      const allDone = CAPTURE_SEQUENCE.every((s) => labels[s.face]);
      if (allDone) return toReview(nextState);
      for (let k = 1; k <= CAPTURE_SEQUENCE.length; k++) {
        const idx = (state.scanIndex + k) % CAPTURE_SEQUENCE.length;
        if (!labels[CAPTURE_SEQUENCE[idx].face]) return { ...nextState, scanIndex: idx };
      }
      return nextState;
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
      return { ...state, solverReady: true, solverError: null };

    case 'SOLVER_PROGRESS':
      return { ...state, solverProgress: event.progress };

    case 'SOLVER_ERROR':
      return { ...state, solverError: event.message };

    case 'SOLVER_RETRY':
      return { ...state, solverError: null };

    case 'SET_VALIDATION':
      return { ...state, validation: event.result };

    case 'SOLVE_OK':
      return {
        ...state,
        solution: event.solution,
        sourceFacelets: event.sourceFacelets ?? state.sourceFacelets,
        screen: 'solve',
      };

    case 'LEARN_OK':
      return {
        ...state,
        learningPlan: event.plan,
        learningError: null,
        sourceFacelets: event.plan.sourceFacelets,
        screen: 'learn',
      };

    case 'LEARN_ERROR':
      return { ...state, learningPlan: null, learningError: event.message };

    case 'LEARN_RESTART':
      return { ...state, screen: 'learn' };

    case 'FINISH':
      return { ...state, screen: 'done' };

    case 'RESTART':
      return {
        ...initialState,
        solverReady: state.solverReady,
        solverProgress: state.solverProgress,
      };

    default:
      return state;
  }
}
