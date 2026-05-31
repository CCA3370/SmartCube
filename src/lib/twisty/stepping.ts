import type { TwistyPlayer } from 'cubing/twisty';

/**
 * Isolated wrapper around TwistyPlayer's playback. ALL experimental cubing.js
 * APIs (controller.animationController.play, experimentalModel.indexer, the
 * timestamp setter) are confined to this file, so version churn touches one
 * place. Enum values (Direction.Forwards = 1, BoundaryType.Move = "move") are
 * inlined as literals because the enums are not exported from `cubing/twisty`.
 */

const DIRECTION_FORWARDS = 1;
const DIRECTION_BACKWARDS = -1;
const BOUNDARY_MOVE = 'move';

export interface Stepper {
  readonly total: number;
  /** Animate forward to the next move boundary. */
  next(): void;
  /** Animate backward to the previous move boundary. */
  prev(): void;
  /** Instantly seek to the start of move `i` (0..total). */
  seek(i: number): Promise<void>;
  play(): void;
  pause(): void;
  toStart(): void;
  toEnd(): void;
  subscribe(listener: StepperListener): () => void;
  dispose(): void;
}

export interface StepperState {
  index: number;
  playing: boolean;
  atEnd: boolean;
}

export type StepperListener = (state: StepperState) => void;

interface AnimationControllerLike {
  play(options: {
    direction?: number;
    untilBoundary?: string;
    autoSkipToOtherEndIfStartingAtBoundary?: boolean;
  }): void;
  pause(): void;
}

interface FreshProp<T> {
  addFreshListener(listener: (value: T) => void): void;
  removeFreshListener(listener: (value: T) => void): void;
}

interface CurrentLeavesSimplifiedLike {
  patternIndex: number;
}

interface DetailedTimelineInfoLike {
  atStart: boolean;
  atEnd: boolean;
}

interface PlayingInfoLike {
  playing: boolean;
}

interface TwistyPlayerModelLike {
  currentLeavesSimplified?: FreshProp<CurrentLeavesSimplifiedLike>;
  detailedTimelineInfo?: FreshProp<DetailedTimelineInfoLike>;
  playingInfo?: FreshProp<PlayingInfoLike>;
}

export function makeStepper(player: TwistyPlayer, total: number): Stepper {
  const ac = () =>
    (player.controller as unknown as { animationController: AnimationControllerLike })
      .animationController;
  const listeners = new Set<StepperListener>();
  const unlisteners: Array<() => void> = [];
  let disposed = false;
  let state: StepperState = { index: 0, playing: false, atEnd: total === 0 };
  let playTimer: number | null = null;

  const stopLoop = () => {
    if (playTimer !== null) {
      window.clearTimeout(playTimer);
      playTimer = null;
    }
  };

  const clampIndex = (i: number) => Math.max(0, Math.min(total, Number.isFinite(i) ? Math.trunc(i) : 0));
  const emit = (patch: Partial<StepperState>) => {
    if (disposed) return;
    const nextState = {
      ...state,
      ...patch,
      index: patch.index === undefined ? state.index : clampIndex(patch.index),
    };
    if (patch.atEnd === true) {
      nextState.index = total;
      nextState.playing = false;
    }
    if (patch.atEnd === false && nextState.index < total) {
      nextState.atEnd = false;
    }
    if (nextState.index === state.index && nextState.playing === state.playing && nextState.atEnd === state.atEnd) {
      return;
    }
    state = nextState;
    listeners.forEach((listener) => listener(state));
  };

  const listen = <T,>(prop: FreshProp<T> | undefined, listener: (value: T) => void) => {
    if (!prop) return;
    prop.addFreshListener(listener);
    unlisteners.push(() => prop.removeFreshListener(listener));
  };

  const next = () => {
    try {
      ac().play({ direction: DIRECTION_FORWARDS, untilBoundary: BOUNDARY_MOVE });
    } catch {
      // Fallback: just play forward.
      player.play();
    }
  };

  const model = player.experimentalModel as unknown as TwistyPlayerModelLike;
  listen(model.currentLeavesSimplified, (value) => {
    emit({ index: Number(value.patternIndex), atEnd: Number(value.patternIndex) >= total });
  });
  listen(model.detailedTimelineInfo, (value) => {
    emit({ atEnd: value.atEnd, index: value.atStart ? 0 : value.atEnd ? total : state.index });
  });
  listen(model.playingInfo, (value) => {
    // If a move just finished and we are logically playing, wait 2.0s and trigger next.
    if (!value.playing && state.playing && !state.atEnd) {
      stopLoop();
      playTimer = window.setTimeout(() => {
        if (state.playing && !state.atEnd) next();
      }, 2000);
    }
  });

  const prev = () => {
    stopLoop();
    emit({ playing: false });
    try {
      ac().play({ direction: DIRECTION_BACKWARDS, untilBoundary: BOUNDARY_MOVE });
    } catch {
      player.jumpToStart();
    }
  };

  const seek = async (i: number) => {
    stopLoop();
    emit({ playing: false });
    if (i <= 0) {
      player.timestamp = 'start';
      return;
    }
    if (i >= total) {
      player.timestamp = 'end';
      return;
    }
    try {
      const indexer = await (
        player.experimentalModel as unknown as {
          indexer: { get(): Promise<{ indexToMoveStartTimestamp(n: number): number }> };
        }
      ).indexer.get();
      const ts = indexer.indexToMoveStartTimestamp(i);
      // `timestamp` accepts a MillisecondTimestamp (a branded number) or a smart
      // keyword; the indexer returns a plain number, cast through the setter.
      (player as unknown as { timestamp: number }).timestamp = ts;
    } catch {
      // Worst case: snap to start; the move-list highlight still tracks intent.
      player.timestamp = 'start';
    }
  };

  return {
    total,
    next: () => {
      stopLoop();
      emit({ playing: false });
      next();
    },
    prev,
    seek,
    play: () => {
      if (state.atEnd) return;
      emit({ playing: true });
      next();
    },
    pause: () => {
      stopLoop();
      player.pause();
      emit({ playing: false });
    },
    toStart: () => {
      stopLoop();
      player.jumpToStart();
      emit({ playing: false });
    },
    toEnd: () => {
      stopLoop();
      player.jumpToEnd();
      emit({ playing: false });
    },
    subscribe: (listener: StepperListener) => {
      if (disposed) return () => undefined;
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      stopLoop();
      unlisteners.forEach((unlisten) => unlisten());
      unlisteners.length = 0;
      listeners.clear();
    },
  };
}
