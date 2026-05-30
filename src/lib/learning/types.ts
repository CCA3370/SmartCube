export type LearningMethod = 'lbl';

export type LearningStageId =
  | 'white-cross'
  | 'white-down-regrip'
  | 'first-layer-corners'
  | 'second-layer-edges'
  | 'yellow-cross'
  | 'yellow-face'
  | 'last-layer-corners'
  | 'last-layer-edges';

export interface MoveRange {
  start: number;
  end: number;
}

interface BaseLearningStep {
  id: string;
  titleEn: string;
  titleZh: string;
  bodyEn: string;
  bodyZh: string;
  moveRange?: MoveRange;
}

export interface RegripStep extends BaseLearningStep {
  kind: 'regrip';
  orientationId: 'white-down';
}

export interface SubgoalStep extends BaseLearningStep {
  kind: 'subgoal';
}

export interface TurnStep extends BaseLearningStep {
  kind: 'turn';
  moves: string[];
}

export interface FormulaStep extends BaseLearningStep {
  kind: 'formula';
  formulaId: string;
  moves: string[];
}

export interface CheckpointStep extends BaseLearningStep {
  kind: 'checkpoint';
}

export interface QuizStep extends BaseLearningStep {
  kind: 'quiz';
  answerEn: string;
  answerZh: string;
}

export type LearningStep = RegripStep | SubgoalStep | TurnStep | FormulaStep | CheckpointStep | QuizStep;

export interface LearningStage {
  id: LearningStageId;
  titleEn: string;
  titleZh: string;
  goalEn: string;
  goalZh: string;
  steps: LearningStep[];
}

export interface LearningPlan {
  method: LearningMethod;
  sourceFacelets: string;
  stages: LearningStage[];
  physicalMoves: string[];
  createdAt: number;
}
