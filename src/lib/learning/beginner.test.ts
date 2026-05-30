import Cube from 'cubejs';
import { describe, expect, it } from 'vitest';
import { SOLVED } from '../cube';
import { buildBeginnerPlan } from './beginner';

const STAGE_IDS = [
  'white-cross',
  'white-down-regrip',
  'first-layer-corners',
  'second-layer-edges',
  'yellow-cross',
  'yellow-face',
  'last-layer-corners',
  'last-layer-edges',
];

function faceletsAfter(algorithm: string): string {
  const cube = new Cube();
  cube.move(algorithm);
  return cube.asString();
}

function inverseMoves(algorithm: string): string[] {
  return algorithm.split(/\s+/).filter(Boolean).reverse().map((move) => {
    if (move.endsWith('2')) return move;
    if (move.endsWith("'")) return move.slice(0, -1);
    return `${move}'`;
  });
}

describe('beginner LBL plan builder', () => {
  it('builds the fixed LBL stage shell for a solved cube', () => {
    const plan = buildBeginnerPlan(SOLVED, []);

    expect(plan.method).toBe('lbl');
    expect(plan.sourceFacelets).toBe(SOLVED);
    expect(plan.physicalMoves).toEqual([]);
    expect(plan.stages.map((stage) => stage.id)).toEqual(STAGE_IDS);
    expect(plan.stages[1].steps.some((step) => step.kind === 'regrip')).toBe(true);
  });

  it('validates that the physical move sequence solves the source cube', () => {
    const sourceFacelets = faceletsAfter('R U');
    const plan = buildBeginnerPlan(sourceFacelets, inverseMoves('R U'));
    const check = Cube.fromString(sourceFacelets);

    check.move(plan.physicalMoves.join(' '));

    expect(check.isSolved()).toBe(true);
    expect(plan.stages.flatMap((stage) => stage.steps).some((step) => step.kind === 'checkpoint')).toBe(true);
  });

  it('rejects a move sequence that does not solve the source cube', () => {
    expect(() => buildBeginnerPlan(faceletsAfter('R'), ['U'])).toThrow(/could not be verified/i);
  });

  it('builds verifiable plans for fixed scrambles', () => {
    const scrambles = [
      'R',
      'U R',
      "R U R'",
      'F R U',
      "L D F'",
      'B2 U R',
      "R U R' U'",
      'F2 L D',
      "B U2 R'",
      'L2 F U',
      "D R2 B'",
      'U F R D',
      "R2 U2 F'",
      'L B D2 R',
      "F U R U'",
      'B2 L2 U',
      "R D R' F",
      'U2 L F2',
      "F R U R'",
      'D2 B U L',
    ];

    for (const scramble of scrambles) {
      const sourceFacelets = faceletsAfter(scramble);
      const plan = buildBeginnerPlan(sourceFacelets, inverseMoves(scramble));
      const check = Cube.fromString(sourceFacelets);
      check.move(plan.physicalMoves.join(' '));

      expect(check.isSolved(), scramble).toBe(true);
      expect(plan.stages.map((stage) => stage.id)).toEqual(STAGE_IDS);
    }
  });
});
