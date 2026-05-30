import type { LearningMethod, LearningStageId } from './types';

const STORAGE_KEY = 'smartcube.learning.v1';

export interface LearningPlanSummary {
  method: LearningMethod;
  moveCount: number;
  updatedAt: number;
}

export interface LearningProgress {
  completedStages: string[];
  masteredFormulaIds: string[];
  lastPlan: LearningPlanSummary | null;
}

export function emptyLearningProgress(): LearningProgress {
  return {
    completedStages: [],
    masteredFormulaIds: [],
    lastPlan: null,
  };
}

export function loadLearningProgress(): LearningProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyLearningProgress();
    const parsed = JSON.parse(raw) as Partial<LearningProgress>;
    return {
      completedStages: Array.isArray(parsed.completedStages) ? parsed.completedStages : [],
      masteredFormulaIds: Array.isArray(parsed.masteredFormulaIds) ? parsed.masteredFormulaIds : [],
      lastPlan: parsed.lastPlan ?? null,
    };
  } catch {
    return emptyLearningProgress();
  }
}

export function saveLearningProgress(progress: LearningProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function updateLearningProgress(update: {
  completedStage?: LearningStageId;
  masteredFormulaId?: string;
  lastPlan?: LearningPlanSummary;
}): LearningProgress {
  const progress = loadLearningProgress();
  const completedStages = new Set(progress.completedStages);
  const masteredFormulaIds = new Set(progress.masteredFormulaIds);
  if (update.completedStage) completedStages.add(update.completedStage);
  if (update.masteredFormulaId) masteredFormulaIds.add(update.masteredFormulaId);

  const next: LearningProgress = {
    completedStages: [...completedStages],
    masteredFormulaIds: [...masteredFormulaIds],
    lastPlan: update.lastPlan ?? progress.lastPlan,
  };
  saveLearningProgress(next);
  return next;
}
