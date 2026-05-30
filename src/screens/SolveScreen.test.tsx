import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState, type AppEvent, type AppState } from '../app/machine';
import { SolveScreen } from './SolveScreen';

interface MockAppContext {
  state: AppState;
  dispatch: ReturnType<typeof vi.fn<(event: AppEvent) => void>>;
}

const mocks = vi.hoisted(() => ({
  app: null as unknown as MockAppContext,
  stepper: {
    total: 3,
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
      return <div>Twisty preview</div>;
    },
  };
});

describe('SolveScreen', () => {
  beforeEach(() => {
    mocks.stepper.next.mockClear();
    mocks.stepper.prev.mockClear();
    mocks.stepper.seek.mockClear();
    mocks.stepper.play.mockClear();
    mocks.stepper.pause.mockClear();
    mocks.stepper.toStart.mockClear();
    mocks.stepper.toEnd.mockClear();
    mocks.stepper.subscribe.mockClear();
    mocks.app = {
      state: {
        ...initialState,
        screen: 'solve',
        solution: { moves: ['R', 'U', 'F2'], raw: 'R U F2' },
      },
      dispatch: vi.fn(),
    };
  });

  it('switches to Learn mode with the current move hidden until reveal', () => {
    render(<SolveScreen />);

    fireEvent.click(screen.getByRole('button', { name: /learn/i }));

    expect(screen.getByText('Learn mode')).toBeInTheDocument();
    expect(screen.queryByText('R: Right face clockwise')).not.toBeInTheDocument();
    expect(screen.getAllByText('???')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

    expect(screen.getByText('R: Right face clockwise')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'R' })).toBeInTheDocument();
    expect(screen.getAllByText('???')).toHaveLength(2);
  });

  it('hides the next answer again after moving forward in Learn mode', () => {
    render(<SolveScreen />);

    fireEvent.click(screen.getByRole('button', { name: /learn/i }));
    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(mocks.stepper.next).toHaveBeenCalled();
    expect(screen.queryByText('U: Up face clockwise')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show answer/i })).toBeInTheDocument();
  });

  it('keeps the existing finish action available at the end', () => {
    render(<SolveScreen />);

    fireEvent.click(screen.getByRole('button', { name: /jump to end/i }));
    fireEvent.click(screen.getByRole('button', { name: /cube solved/i }));

    expect(mocks.stepper.toEnd).toHaveBeenCalled();
    expect(mocks.app.dispatch).toHaveBeenCalledWith({ type: 'FINISH' });
  });
});
