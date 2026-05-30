import { beforeEach, describe, expect, it } from 'vitest';
import { loadLearningProgress, saveLearningProgress, updateLearningProgress } from './progress';

describe('learning progress storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty progress record when storage is empty', () => {
    expect(loadLearningProgress()).toEqual({
      completedStages: [],
      masteredFormulaIds: [],
      lastPlan: null,
    });
  });

  it('persists completed stages, formulas, and the last plan summary', () => {
    saveLearningProgress({
      completedStages: ['white-cross'],
      masteredFormulaIds: ['sune'],
      lastPlan: { method: 'lbl', moveCount: 12, updatedAt: 123 },
    });

    expect(loadLearningProgress()).toEqual({
      completedStages: ['white-cross'],
      masteredFormulaIds: ['sune'],
      lastPlan: { method: 'lbl', moveCount: 12, updatedAt: 123 },
    });
  });

  it('updates progress without duplicating ids', () => {
    updateLearningProgress({ completedStage: 'white-cross', masteredFormulaId: 'sune' });
    updateLearningProgress({ completedStage: 'white-cross', masteredFormulaId: 'sune' });

    expect(loadLearningProgress()).toEqual({
      completedStages: ['white-cross'],
      masteredFormulaIds: ['sune'],
      lastPlan: null,
    });
  });
});
