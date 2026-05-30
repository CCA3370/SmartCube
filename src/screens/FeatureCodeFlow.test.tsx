import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState, type AppEvent, type AppState } from '../app/machine';
import { SOLVED, parseFaceletString } from '../lib/cube';
import { encodeFeatureCode } from '../lib/cube/featureCode';
import { ReviewScreen } from './ReviewScreen';
import { WelcomeScreen } from './WelcomeScreen';

interface MockAppContext {
  state: AppState;
  dispatch: ReturnType<typeof vi.fn<(event: AppEvent) => void>>;
  solver: {
    init: ReturnType<typeof vi.fn<() => Promise<void>>>;
    solve: ReturnType<typeof vi.fn<(facelets: string) => Promise<{ moves: string[]; raw: string }>>>;
  };
  retrySolverInit: ReturnType<typeof vi.fn<() => void>>;
}

const app = vi.hoisted(() => ({ value: null as unknown as MockAppContext }));

vi.mock('../app/AppContext', () => ({
  useApp: () => app.value,
}));

describe('feature code flow', () => {
  beforeEach(() => {
    app.value = {
      state: { ...initialState, solverReady: true },
      dispatch: vi.fn(),
      solver: {
        init: vi.fn().mockResolvedValue(undefined),
        solve: vi.fn().mockResolvedValue({ moves: ['R'], raw: 'R' }),
      },
      retrySolverInit: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('solves a pasted feature code directly from the welcome screen', async () => {
    render(<WelcomeScreen />);

    fireEvent.change(screen.getByLabelText(/cube feature code/i), {
      target: { value: encodeFeatureCode(SOLVED) },
    });
    fireEvent.click(screen.getByRole('button', { name: /solve from code/i }));

    await waitFor(() => expect(app.value.solver.solve).toHaveBeenCalledWith(SOLVED));
    expect(app.value.dispatch).toHaveBeenCalledWith({
      type: 'SOLVE_OK',
      solution: { moves: ['R'], raw: 'R' },
    });
  });

  it('disables both welcome start actions until the solver is ready', () => {
    app.value.state = {
      ...initialState,
      solverReady: false,
      solverProgress: { done: 1, total: 10, label: 'Starting', cached: false },
    };

    const { rerender } = render(<WelcomeScreen />);
    fireEvent.change(screen.getByLabelText(/cube feature code/i), {
      target: { value: encodeFeatureCode(SOLVED) },
    });

    expect(screen.getByRole('button', { name: /start camera & scan/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /solve from code/i })).toBeDisabled();

    app.value.state = {
      ...app.value.state,
      solverReady: true,
      solverProgress: { done: 10, total: 10, label: 'Ready', cached: true },
    };
    rerender(<WelcomeScreen />);

    expect(screen.getByRole('button', { name: /start camera & scan/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /solve from code/i })).toBeEnabled();
  });

  it('fades away the welcome solver progress after the solver becomes ready', () => {
    vi.useFakeTimers();
    app.value.state = {
      ...initialState,
      solverReady: false,
      solverProgress: { done: 1, total: 10, label: 'Starting', cached: false },
    };

    const { rerender } = render(<WelcomeScreen />);
    expect(screen.getByText('Starting')).toBeInTheDocument();

    app.value.state = {
      ...app.value.state,
      solverReady: true,
      solverProgress: { done: 10, total: 10, label: 'Ready', cached: true },
    };
    rerender(<WelcomeScreen />);

    expect(screen.getByText('Ready')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByText('Ready')).not.toBeInTheDocument();
  });

  it('shows and copies the current valid review feature code', async () => {
    const code = encodeFeatureCode(SOLVED);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    app.value.state = {
      ...initialState,
      screen: 'review',
      labels: parseFaceletString(SOLVED).faces,
    };

    render(<ReviewScreen />);

    expect(screen.getByText(code)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /copy feature code/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(code));
  });
});
