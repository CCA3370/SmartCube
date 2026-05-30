import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
      state: initialState,
      dispatch: vi.fn(),
      solver: {
        init: vi.fn().mockResolvedValue(undefined),
        solve: vi.fn().mockResolvedValue({ moves: ['R'], raw: 'R' }),
      },
      retrySolverInit: vi.fn(),
    };
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
