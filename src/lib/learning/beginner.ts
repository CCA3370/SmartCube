import Cube from 'cubejs';
import 'cubejs/lib/solve.js';
import { parseMoves } from '../solver/client';
import type { LearningPlan, LearningStage, LearningStageId, LearningStep } from './types';

interface StageCopy {
  id: LearningStageId;
  titleEn: string;
  titleZh: string;
  goalEn: string;
  goalZh: string;
}

const STAGES: StageCopy[] = [
  {
    id: 'white-cross',
    titleEn: 'White cross',
    titleZh: '白色十字',
    goalEn: 'Build a white cross with each edge matching its side center.',
    goalZh: '做出白色十字，并让每个白色棱块的侧面颜色对齐中心。',
  },
  {
    id: 'white-down-regrip',
    titleEn: 'Regrip: white down, yellow up',
    titleZh: '换握：白面向下，黄面向上',
    goalEn: 'Turn the whole cube over so the solved white work stays on the bottom.',
    goalZh: '把整块魔方翻转，让已经完成的白色部分放到底层。',
  },
  {
    id: 'first-layer-corners',
    titleEn: 'First-layer corners',
    titleZh: '第一层角块',
    goalEn: 'Insert the four white corners without breaking the white cross.',
    goalZh: '放入四个白色角块，同时不要破坏白色十字。',
  },
  {
    id: 'second-layer-edges',
    titleEn: 'Second-layer edges',
    titleZh: '第二层棱块',
    goalEn: 'Insert the four middle-layer edges.',
    goalZh: '放入中层四个不含黄色的棱块。',
  },
  {
    id: 'yellow-cross',
    titleEn: 'Yellow cross',
    titleZh: '黄色十字',
    goalEn: 'Orient the yellow edges to form a cross on top.',
    goalZh: '翻好黄色棱块，在顶面形成黄色十字。',
  },
  {
    id: 'yellow-face',
    titleEn: 'Yellow face',
    titleZh: '黄色顶面',
    goalEn: 'Orient the yellow corners until the full top face is yellow.',
    goalZh: '翻好黄色角块，让整个顶面都变成黄色。',
  },
  {
    id: 'last-layer-corners',
    titleEn: 'Last-layer corner permutation',
    titleZh: '顶层角块换位',
    goalEn: 'Move the yellow corners into their correct positions.',
    goalZh: '把顶层角块换到正确位置。',
  },
  {
    id: 'last-layer-edges',
    titleEn: 'Last-layer edge permutation',
    titleZh: '顶层棱块换位',
    goalEn: 'Cycle the final edges until the cube is solved.',
    goalZh: '调整最后的棱块位置，直到魔方复原。',
  },
];

export function buildBeginnerPlan(sourceFacelets: string, physicalMoves?: string[]): LearningPlan {
  const moves = physicalMoves ?? solveWithCubejs(sourceFacelets);
  verifySolves(sourceFacelets, moves);
  return {
    method: 'lbl',
    sourceFacelets,
    stages: buildStages(moves),
    physicalMoves: moves,
    createdAt: Date.now(),
  };
}

function solveWithCubejs(facelets: string): string[] {
  const cube = Cube.fromString(facelets);
  const raw = cube.solve(22);
  if (typeof raw !== 'string') {
    throw new Error('Beginner plan could not be generated: solver returned no solution.');
  }
  return parseMoves(raw);
}

function verifySolves(sourceFacelets: string, physicalMoves: string[]): void {
  const cube = Cube.fromString(sourceFacelets);
  if (physicalMoves.length > 0) {
    cube.move(physicalMoves.join(' '));
  }
  if (!cube.isSolved()) {
    throw new Error('Beginner plan could not be verified against the scanned cube.');
  }
}

function buildStages(physicalMoves: string[]): LearningStage[] {
  const moveChunks = splitMovesForStages(physicalMoves);
  let rangeStart = 0;
  return STAGES.map((stage, index) => {
    if (stage.id === 'white-down-regrip') {
      return {
        ...stage,
        steps: [
          {
            kind: 'regrip',
            id: `${stage.id}-regrip`,
            orientationId: 'white-down',
            titleEn: 'Turn the whole cube over',
            titleZh: '把整块魔方翻转',
            bodyEn: 'Hold the cube with yellow on top and the completed white work on the bottom. Keep green facing you unless a later step says otherwise.',
            bodyZh: '把黄面放在上方，已完成的白色部分放到底部。除非后续步骤说明，否则保持绿面朝向自己。',
          },
          checkpointStep(stage.id, 'Confirm the new grip', '确认新的握法'),
        ],
      };
    }

    const chunk = moveChunks[index] ?? [];
    const steps: LearningStep[] = [
      {
        kind: 'subgoal',
        id: `${stage.id}-goal`,
        titleEn: stage.titleEn,
        titleZh: stage.titleZh,
        bodyEn: stage.goalEn,
        bodyZh: stage.goalZh,
      },
    ];

    if (chunk.length > 0) {
      const rangeEnd = rangeStart + chunk.length;
      steps.push({
        kind: chunk.length === 1 ? 'turn' : 'formula',
        id: `${stage.id}-moves`,
        formulaId: `${stage.id}-sequence`,
        moves: chunk,
        moveRange: { start: rangeStart, end: rangeEnd },
        titleEn: chunk.length === 1 ? 'Do the next turn' : 'Practice this sequence',
        titleZh: chunk.length === 1 ? '完成下一步转动' : '练习这组动作',
        bodyEn: 'Try to predict the moves first, then reveal the answer and follow the 3D preview.',
        bodyZh: '先尝试自己判断，再揭示答案并跟随 3D 预览执行。',
      } as LearningStep);
      rangeStart = rangeEnd;
    }

    steps.push(checkpointStep(stage.id, `Check ${stage.titleEn.toLowerCase()}`, `检查${stage.titleZh}`));
    return { ...stage, steps };
  });
}

function checkpointStep(stageId: LearningStageId, titleEn: string, titleZh: string): LearningStep {
  return {
    kind: 'checkpoint',
    id: `${stageId}-checkpoint`,
    titleEn,
    titleZh,
    bodyEn: 'Look at your cube and confirm this stage before continuing.',
    bodyZh: '观察你的魔方，确认这个阶段完成后再继续。',
  };
}

function splitMovesForStages(moves: string[]): string[][] {
  const chunks = STAGES.map(() => [] as string[]);
  const movableStageIndexes = STAGES
    .map((stage, index) => (stage.id === 'white-down-regrip' ? -1 : index))
    .filter((index) => index >= 0);
  moves.forEach((move, i) => {
    chunks[movableStageIndexes[i % movableStageIndexes.length]].push(move);
  });
  return chunks;
}
