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
}

interface AnimationControllerLike {
  play(options: {
    direction?: number;
    untilBoundary?: string;
    autoSkipToOtherEndIfStartingAtBoundary?: boolean;
  }): void;
  pause(): void;
}

export function makeStepper(player: TwistyPlayer, total: number): Stepper {
  const ac = () =>
    (player.controller as unknown as { animationController: AnimationControllerLike })
      .animationController;

  const next = () => {
    try {
      ac().play({ direction: DIRECTION_FORWARDS, untilBoundary: BOUNDARY_MOVE });
    } catch {
      // Fallback: just play forward.
      player.play();
    }
  };

  const prev = () => {
    try {
      ac().play({ direction: DIRECTION_BACKWARDS, untilBoundary: BOUNDARY_MOVE });
    } catch {
      player.jumpToStart();
    }
  };

  const seek = async (i: number) => {
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
    next,
    prev,
    seek,
    play: () => player.play(),
    pause: () => player.pause(),
    toStart: () => player.jumpToStart(),
    toEnd: () => player.jumpToEnd(),
  };
}
