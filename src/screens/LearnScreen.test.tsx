import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState, type AppEvent, type AppState } from '../app/machine';
import type { LearningPlan } from '../lib/learning/types';
import { LearnScreen } from './LearnScreen';

interface MockAppContext {
  state: AppState;
  dispatch: ReturnType<typeof vi.fn<(event: AppEvent) => void>>;
}

const plan: LearningPlan = {
  method: 'lbl',
  sourceFacelets: 'source',
  physicalMoves: ['R', 'U'],
  createdAt: 123,
  stages: [
    {
      id: 'white-cross',
      titleEn: 'White cross',
      titleZh: '白色十字',
      goalEn: 'Build the white cross.',
      goalZh: '完成白色十字。',
      steps: [
        {
          kind: 'subgoal',
          id: 'cross-goal',
          titleEn: 'Find a white edge',
          titleZh: '找到白色棱块',
          bodyEn: 'Look for an edge with white.',
          bodyZh: '找一个带白色的棱块。',
        },
        {
          kind: 'formula',
          id: 'cross-move',
          formulaId: 'cross-insert',
          moves: ['R', 'U'],
          moveRange: { start: 0, end: 2 },
          titleEn: 'Insert the edge',
          titleZh: '放入棱块',
          bodyEn: 'Use this sequence.',
          bodyZh: '使用这组动作。',
        },
        {
          kind: 'checkpoint',
          id: 'cross-check',
          titleEn: 'Check the white cross',
          titleZh: '检查白色十字',
          bodyEn: 'The white cross should be complete.',
          bodyZh: '白色十字应该完成。',
        },
      ],
    },
  ],
};

const mocks = vi.hoisted(() => ({
  app: null as unknown as MockAppContext,
  stepper: {
    total: 2,
    next: vi.fn(),
    prev: vi.fn(),
    seek: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    toStart: vi.fn(),
    toEnd: vi.fn(),
    subscribe: vi.fn((listener: (state: { index: number; playing: boolean; atEnd: boolean }) => void) => {
      listener({ index: 0, playing: false, atEnd: false });
      return vi.fn();
    }),
    dispose: vi.fn(),
  },
}));

vi.mock('../app/AppContext', () => ({
  useApp: () => mocks.app,
}));

vi.mock('../components/TwistyView', async () => {
  const { useEffect } = await vi.importActual<typeof import('react')>('react');
  return {
    TwistyView: ({ onReady }: { onReady: (stepper: typeof mocks.stepper) => void }) => {
      useEffect(() => {
        onReady(mocks.stepper);
      }, [onReady]);
      return <div>Learning twisty preview</div>;
    },
  };
});

describe('LearnScreen', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.stepper.seek.mockClear();
    mocks.app = {
      state: {
        ...initialState,
        screen: 'learn',
        learningPlan: plan,
        sourceFacelets: 'source',
      },
      dispatch: vi.fn(),
    };
  });

  it('shows the current LBL stage and advances through non-move steps', () => {
    render(<LearnScreen />);

    expect(screen.getByText('White cross')).toBeInTheDocument();
    expect(screen.getByText('白色十字')).toBeInTheDocument();
    expect(screen.getByText('Find a white edge')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText('Insert the edge')).toBeInTheDocument();
    expect(screen.queryByText('R U')).not.toBeInTheDocument();
  });

  it('reveals a formula, marks it known, and seeks to the completed move range', () => {
    render(<LearnScreen />);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

    expect(screen.getByText('R U')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /i know this formula/i }));
    fireEvent.click(screen.getByRole('button', { name: /i did it/i }));

    expect(mocks.stepper.seek).toHaveBeenCalledWith(2);
    expect(JSON.parse(localStorage.getItem('smartcube.learning.v1') ?? '{}').masteredFormulaIds).toEqual(['cross-insert']);
  });

  it('records checkpoint completion in local progress', () => {
    render(<LearnScreen />);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    fireEvent.click(screen.getByRole('button', { name: /i did it/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm checkpoint/i }));

    expect(JSON.parse(localStorage.getItem('smartcube.learning.v1') ?? '{}').completedStages).toEqual(['white-cross']);
  });
});
