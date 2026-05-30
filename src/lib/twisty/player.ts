import { TwistyPlayer } from 'cubing/twisty';
import { Alg } from 'cubing/alg';

export interface PlayerSetup {
  /** The solution alg the player will animate forward. */
  alg: Alg;
  /** Number of animated moves in the solution. */
  total: number;
}

/**
 * Create a TwistyPlayer configured for the guided-solve view: a 3x3, no built-in
 * control panel (we drive our own), back view so the user sees hidden faces.
 */
export function createPlayer(): TwistyPlayer {
  const player = new TwistyPlayer({
    puzzle: '3x3x3',
    background: 'none',
    controlPanel: 'none',
    backView: 'top-right',
    hintFacelets: 'none',
    cameraLatitude: 27,
    cameraLongitude: 30,
    tempoScale: 2,
  });
  player.style.width = '100%';
  player.style.height = '100%';
  // cubing's closed shadow layout relies on the host being a grid; block makes
  // the internal wrapper/canvases collapse to 0 height.
  player.style.display = 'grid';
  return player;
}

/**
 * The "invert trick": to show the user's SCRAMBLED cube as the starting state and
 * animate the solution forward, set the setup-alg to the INVERSE of the solution
 * (applying the inverse to a solved cube reproduces the scramble), and set the
 * playable alg to the solution itself. No facelet->KPattern conversion needed.
 */
export function setupFromSolution(player: TwistyPlayer, solutionRaw: string): PlayerSetup {
  const alg = new Alg(solutionRaw);
  const total = countMoves(alg);
  player.alg = alg;
  player.experimentalSetupAlg = alg.invert();
  player.experimentalSetupAnchor = 'start';
  // Park at the very beginning (scrambled state, before the first move).
  player.timestamp = 'start';
  return { alg, total };
}

/** Count animated leaves (moves) in an alg. */
export function countMoves(alg: Alg): number {
  let n = 0;
  for (const _node of alg.childAlgNodes()) n++;
  return n;
}
